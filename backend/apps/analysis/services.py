"""The AI analysis pipeline (LLD §6.2). Invoked from the assessment submit
flow via runner.py — never from a view directly."""
import logging
import time

from django.utils import timezone

from apps.assessments.models import OBJECTIVE_MODES, SPEAKING_TARGETS, VOICE_MODES, AssessmentSession, Mode
from apps.core.ai import ai
from apps.core.stt import stt

from . import authenticity as authenticity_check
from . import gd, presentation
from .models import SessionScore
from .prompts import (
    NARRATIVE_SYSTEM,
    SCORING_SYSTEM,
    build_objective_narrative_prompt,
    build_scoring_prompt,
)
from .rubrics import (
    apply_time_adherence,
    audio_features,
    overall_score,
    score_objective_answers,
    time_adherence,
    time_adherence_note,
    weights_for,
)

logger = logging.getLogger(__name__)

VALID_ANNOTATION_TYPES = {"filler", "grammar", "hedge", "strong", "structure_gap"}


def analyse_session(session_id) -> SessionScore:
    """Run the full pipeline for one session and persist a SessionScore.

    Marks the session complete on success, failed on error — the client polls
    GET /api/assessment/:id/status for exactly this transition (LLD §5.2).
    """
    session = AssessmentSession.objects.select_related("prompt").get(id=session_id)
    started = time.monotonic()
    try:
        score = _run(session)
    except Exception as exc:
        logger.exception("Analysis failed for session %s", session_id)
        session.status = AssessmentSession.Status.FAILED
        session.error = str(exc)[:500]
        session.save(update_fields=["status", "error"])
        raise

    score.processing_ms = int((time.monotonic() - started) * 1000)
    score.save(update_fields=["processing_ms"])

    session.status = AssessmentSession.Status.COMPLETE
    session.completed_at = timezone.now()
    session.save(update_fields=["status", "completed_at"])

    _run_post_analysis(session, score)
    return score


def _run_post_analysis(session: AssessmentSession, score: SessionScore) -> None:
    """LLD §6.2 steps 6-7: recommend content for the new gaps, then let the
    path engine re-weight. Neither should be able to lose a student's score,
    so failures here are logged, not raised."""
    from apps.content.services import recommend_for_session
    from apps.gamification.services import award_session_xp
    from apps.learning_path.services import generate_path

    from .overview import is_baseline_complete

    award_session_xp(session, score)

    try:
        _log_progress(session, score)
    except Exception:
        logger.exception("Progress logging failed for session %s", session.id)

    try:
        recommend_for_session(session, score)
    except Exception:
        logger.exception("Recommendation step failed for session %s", session.id)

    try:
        # A path built from one or two scored modes only covers whichever
        # dimensions those modes happen to touch, and surfacing it mid-baseline
        # is exactly the "result after one round" the student shouldn't see
        # yet (§9's own baseline-report gate makes the same call). Once the
        # baseline is complete this fires on every session after, same as
        # before — practice sessions, reassessments, everything.
        if is_baseline_complete(session.user):
            generate_path(session.user)
    except Exception:
        logger.exception("Path generation failed for session %s", session.id)

    try:
        _update_retention(session)
    except Exception:
        logger.exception("Retention update failed for session %s", session.id)


def _update_retention(session: AssessmentSession) -> None:
    """LLD §21.4/§21.5 — Echo remembers what keeps coming up, and today's
    Daily Drill closes itself if this session was it."""
    from apps.retention.services import complete_challenge_for_session, refresh_echo

    complete_challenge_for_session(session)
    session.user.refresh_from_db()
    refresh_echo(session.user)


def _run(session: AssessmentSession) -> SessionScore:
    if session.mode in OBJECTIVE_MODES:
        return _score_objective(session)
    return _score_open_response(session)


def _log_progress(session: AssessmentSession, score: SessionScore) -> None:
    """LLD §22.3 — one event per dimension the session measured, so each
    dimension has a reviewable timeline of its own."""
    from apps.content.attribution import log_event
    from apps.content.attribution_models import ProgressEvent

    for dimension, value in (score.dimension_scores or {}).items():
        log_event(
            session.user,
            dimension=dimension,
            event_type=ProgressEvent.EventType.SESSION_SCORED,
            ref_id=score.id,
            label=f"{session.get_mode_display()} assessment",
            score=value,
        )


def _score_open_response(session: AssessmentSession) -> SessionScore:
    """Voice and text modes: transcribe if needed, then one combined AI call
    for scores + annotations + narrative (§17.3)."""
    features = {}
    if session.mode in VOICE_MODES:
        transcript = _transcribe(session)
        session.transcript = transcript.text
        session.duration_seconds = int(transcript.duration_seconds)
        session.save(update_fields=["transcript", "duration_seconds"])
        features = audio_features(transcript.text, transcript.words, transcript.duration_seconds)
    else:
        session.transcript = session.raw_response.get("text", "")
        session.save(update_fields=["transcript"])

    response_text = session.transcript.strip()
    if not response_text:
        raise ValueError("No response content to analyse — the recording or text was empty.")

    timing = _timing_for(session)
    visual, coverage, doubts_note = _presentation_signals(session)
    delivery_text = presentation.delivery_note(visual, coverage)
    if doubts_note:
        delivery_text = f"{delivery_text}\n\n{doubts_note}" if delivery_text else doubts_note
    if session.mode == Mode.GD:
        gd_note = gd.context_note((session.raw_response or {}).get("discussion_log") or [])
        if gd_note:
            delivery_text = f"{delivery_text}\n\n{gd_note}" if delivery_text else gd_note

    weights = weights_for(session.mode)
    result = ai().generate_json(
        call_type=f"scoring:{session.mode}",
        system=SCORING_SYSTEM,
        user=build_scoring_prompt(
            mode=session.mode,
            prompt_text=session.prompt.text,
            response_text=response_text,
            weights=weights,
            audio=features or None,
            timing_note=time_adherence_note(timing),
            delivery_note=delivery_text,
        ),
    )

    dimension_scores = _clean_dimensions(result.get("dimensions", []), weights)
    if not dimension_scores:
        raise ValueError("AI returned no usable dimension scores")

    dimension_scores = presentation.visual_adjusted_scores(dimension_scores, visual)
    dimension_scores = apply_time_adherence(dimension_scores, timing)

    return SessionScore.objects.create(
        session=session,
        user=session.user,
        overall_score=overall_score(dimension_scores, session.mode),
        dimension_scores=dimension_scores,
        audio_features=features,
        timing=timing,
        visual_metrics=visual,
        slide_coverage=coverage,
        authenticity=authenticity_check.assess(
            model_result=result,
            integrity_signals=session.integrity_signals,
            response_text=response_text,
        ),
        annotations=_resolve_annotations(result.get("annotations", []), response_text),
        feedback_narrative=(result.get("narrative") or "").strip(),
        ai_model_version=_last_model(),
    )


def _timing_for(session: AssessmentSession) -> dict:
    """Did they use the time they were given? Only meaningful for the modes
    that hand the student a clock (§5.1) — see rubrics.time_adherence.

    GD is the one exception to "actual_seconds = the whole recording": the
    room session the recording spans is a multi-turn conversation, mostly
    other people's (simulated) turns and silence, not the student talking.
    What belongs against the 120s target is their own cumulative floor time,
    from the turn log — not however long the room happened to run."""
    target = SPEAKING_TARGETS.get(session.mode)
    if not target:
        return {}
    actual = (
        gd.student_speaking_seconds((session.raw_response or {}).get("discussion_log") or [])
        if session.mode == Mode.GD
        else session.duration_seconds
    )
    if not actual:
        return {}
    return time_adherence(actual_seconds=actual, **target)


def _presentation_signals(session: AssessmentSession) -> tuple[dict, list, str]:
    if session.mode != Mode.PRESENT:
        return {}, [], ""
    raw = session.raw_response or {}
    slides = session.prompt.payload.get("slides", [])
    timings = raw.get("slide_timings", [])
    visual = presentation.clean_visual_metrics(raw.get("visual_metrics"))
    coverage = presentation.slide_coverage(slides, timings, session.duration_seconds)
    doubts_note = presentation.doubt_note(raw.get("doubt_questions") or [], timings, len(slides))
    return visual, coverage, doubts_note


def _score_objective(session: AssessmentSession) -> SessionScore:
    """MCQ modes: scored deterministically from the answer key; one small AI
    call for Echo's narrative only."""
    questions = session.prompt.payload.get("questions", [])
    answers = session.raw_response.get("answers", [])
    percentage, breakdown = score_objective_answers(questions, answers)

    weights = weights_for(session.mode)
    dimension_scores = {dimension: percentage for dimension in weights}

    try:
        narrative = ai().generate_text(
            call_type=f"narrative:{session.mode}",
            system=NARRATIVE_SYSTEM,
            user=build_objective_narrative_prompt(mode=session.mode, percentage=percentage, breakdown=breakdown),
        ).strip()
    except Exception as exc:  # a missing narrative must not lose the student's score
        logger.warning("Narrative generation failed for %s: %s", session.id, exc)
        narrative = ""

    return SessionScore.objects.create(
        session=session,
        user=session.user,
        overall_score=percentage,
        dimension_scores=dimension_scores,
        answer_breakdown=breakdown,
        authenticity=authenticity_check.assess_objective(session.integrity_signals),
        feedback_narrative=narrative,
        ai_model_version=_last_model(),
    )


def _transcribe(session: AssessmentSession):
    from apps.core.storage import get_storage

    audio = get_storage().read(session.media_key)
    return stt().transcribe(audio, content_type="audio/webm")


def _clean_dimensions(raw: list, weights: dict) -> dict[str, int]:
    """Keep only dimensions this mode actually assesses, clamped to 0-100 —
    the model occasionally invents a dimension or returns a string."""
    cleaned = {}
    for item in raw:
        dimension = item.get("id")
        if dimension not in weights:
            continue
        try:
            cleaned[dimension] = max(0, min(100, int(round(float(item.get("score", 0))))))
        except (TypeError, ValueError):
            continue
    return cleaned


def _resolve_annotations(raw: list, transcript: str) -> list[dict]:
    """Convert the model's verbatim `text` snippets into character offsets
    (see prompts.py for why offsets aren't asked for directly). Snippets that
    can't be located in the transcript are dropped rather than mis-highlighted."""
    annotations = []
    search_from = 0
    for item in raw:
        snippet = (item.get("text") or "").strip()
        annotation_type = item.get("type")
        if not snippet or annotation_type not in VALID_ANNOTATION_TYPES:
            continue
        start = transcript.find(snippet, search_from)
        if start == -1:
            start = transcript.find(snippet)  # allow out-of-order matches
        if start == -1:
            continue
        end = start + len(snippet)
        search_from = end
        annotations.append(
            {
                "span_start": start,
                "span_end": end,
                "text": snippet,
                "type": annotation_type,
                "message": (item.get("message") or "").strip(),
            }
        )
    return annotations


def _last_model() -> str:
    from apps.core.models import AICallLog

    latest = AICallLog.objects.filter(error="").order_by("-created_at").values_list("model", flat=True).first()
    return latest or ""
