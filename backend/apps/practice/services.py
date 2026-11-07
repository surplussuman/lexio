"""Practice engine services (LLD §8.2). The two latency-sensitive AI calls —
coaching nudges and follow-up questions — live here."""
import logging

from django.utils import timezone

from apps.analysis.models import SessionScore
from apps.analysis.prompts import SCORING_SYSTEM, build_scoring_prompt
from apps.analysis.rubrics import FILLER_WORDS, overall_score, weights_for
from apps.analysis.services import _clean_dimensions, _resolve_annotations
from apps.core.ai import ai

from .models import SESSION_TYPE_MODE, PracticeSession, SessionType

logger = logging.getLogger(__name__)

MIN_CHUNK_WORDS = 12  # below this there isn't enough signal for a useful tip
XP_PRACTICE_SESSION = 80  # LLD §12.1

COACH_SYSTEM = (
    "You are Echo, a live speaking coach listening while a student talks. "
    "You give ONE tip at a time. MAX 12 words. No emojis, no preamble, no markdown. "
    "Plain English, imperative voice. If the excerpt is already strong, say what worked instead."
)

INTERVIEWER_SYSTEM = (
    "You are Echo, conducting a practice interview with a college student. "
    "You ask ONE question at a time, in plain English, max 25 words. No preamble, no commentary, "
    "no markdown — return only the question itself."
)


def coaching_nudge(session: PracticeSession, chunk_transcript: str) -> dict | None:
    """LLD §8.2 — a tip from the last ~30s of speech.

    Returns None rather than a filler tip when the excerpt is too short to say
    anything useful (§17.3: nudges only fire when the student is actually
    speaking, which keeps the call volume down).
    """
    words = chunk_transcript.split()
    if len(words) < MIN_CHUNK_WORDS:
        return None

    filler_count = sum(1 for word in words if word.strip(".,!?;:").lower() in FILLER_WORDS)
    tip = ai().generate_text(
        call_type="coaching_nudge",
        system=COACH_SYSTEM,
        user=(
            f"The student is doing a {session.get_session_type_display()} on: {session.topic or 'an open topic'}.\n"
            f"Last 30 seconds of what they said:\n\"\"\"\n{chunk_transcript}\n\"\"\"\n"
            f"Filler words in this excerpt: {filler_count}.\n"
            "Give ONE coaching tip, max 12 words."
        ),
    ).strip().strip('"')

    nudge = {
        "timestamp_s": int((timezone.now() - session.started_at).total_seconds()),
        "message": tip,
        "dimension": "fluency" if filler_count >= 2 else "delivery",
        "severity": "warn" if filler_count >= 2 else "info",
    }
    session.coaching_nudges = [*session.coaching_nudges, nudge]
    session.save(update_fields=["coaching_nudges"])
    return nudge


def next_question(session: PracticeSession) -> str:
    """LLD §8.4 — a follow-up that reacts to what the student just said."""
    history = "\n".join(
        f"{'Echo' if turn['role'] == 'echo' else 'Student'}: {turn['text']}" for turn in session.turns[-6:]
    )
    question = ai().generate_text(
        call_type="next_question",
        system=INTERVIEWER_SYSTEM,
        user=(
            f"Topic: {session.topic or 'general behavioural interview'}.\n"
            f"Conversation so far:\n{history or '(nothing yet)'}\n\n"
            "Ask the next question. If the student's last answer was vague or missed a result, "
            "probe that specifically rather than moving on."
        ),
    ).strip().strip('"')

    session.turns = [*session.turns, {"role": "echo", "text": question}]
    session.question_count += 1
    session.current_question = session.question_count
    session.save(update_fields=["turns", "question_count", "current_question"])
    return question


def record_student_turn(session: PracticeSession, text: str) -> None:
    session.turns = [*session.turns, {"role": "student", "text": text}]
    session.transcript = "\n".join(
        turn["text"] for turn in session.turns if turn["role"] == "student"
    ).strip()
    session.save(update_fields=["turns", "transcript"])


def end_session(session: PracticeSession, metrics: dict | None = None) -> PracticeSession:
    """LLD §8.4 POST /api/practice/end — score the session, award XP.

    Scoring reuses the assessment rubric for the equivalent mode, so practice
    feeds the same eight dimensions and therefore the learning path.
    """
    session.session_metrics = metrics or session.session_metrics
    session.status = PracticeSession.Status.PROCESSING
    session.ended_at = timezone.now()
    session.save(update_fields=["session_metrics", "status", "ended_at"])

    transcript = (session.transcript or "").strip()
    if not transcript:
        session.status = PracticeSession.Status.ABANDONED
        session.error = "No speech was captured in this session."
        session.save(update_fields=["status", "error"])
        return session

    try:
        score = _score_practice(session, transcript)
    except Exception as exc:
        logger.exception("Practice scoring failed for %s", session.id)
        session.status = PracticeSession.Status.ABANDONED
        session.error = str(exc)[:500]
        session.save(update_fields=["status", "error"])
        return session

    from apps.gamification.services import award_xp, record_activity
    from apps.learning_path.services import generate_path

    award_xp(session.user, XP_PRACTICE_SESSION)
    record_activity(session.user, sessions=1)
    session.xp_awarded = XP_PRACTICE_SESSION
    session.status = PracticeSession.Status.COMPLETE
    session.save(update_fields=["xp_awarded", "status"])

    try:
        generate_path(session.user)
    except Exception:
        logger.exception("Path refresh after practice failed for %s", session.id)

    from apps.gamification.badges import evaluate_badges

    session.user.refresh_from_db()
    evaluate_badges(session.user, score=score)
    return session


def _score_practice(session: PracticeSession, transcript: str) -> SessionScore:
    weights = weights_for(session.mode)
    metrics = session.session_metrics or {}
    audio = (
        {
            "wpm": metrics.get("avg_wpm", 0),
            "filler_count": metrics.get("filler_count", 0),
            "filler_ratio": metrics.get("filler_ratio", 0),
            "pause_count": metrics.get("pause_count", 0),
            "duration_seconds": session.duration_seconds,
        }
        if metrics
        else None
    )

    result = ai().generate_json(
        call_type=f"scoring:practice:{session.session_type}",
        system=SCORING_SYSTEM,
        user=build_scoring_prompt(
            mode=session.mode,
            prompt_text=session.topic or session.get_session_type_display(),
            response_text=transcript,
            weights=weights,
            audio=audio,
        ),
    )

    dimension_scores = _clean_dimensions(result.get("dimensions", []), weights)
    if not dimension_scores:
        raise ValueError("AI returned no usable dimension scores")

    return SessionScore.objects.create(
        practice_session=session,
        user=session.user,
        overall_score=overall_score(dimension_scores, session.mode),
        dimension_scores=dimension_scores,
        audio_features=audio or {},
        annotations=_resolve_annotations(result.get("annotations", []), transcript),
        feedback_narrative=(result.get("narrative") or "").strip(),
    )


def opening_line(session: PracticeSession) -> str:
    """The first thing Echo says. Interview-style sessions ask a question;
    the rest just set the student going."""
    if session.session_type in (SessionType.MOCK_INTERVIEW, SessionType.DEBATE):
        return next_question(session)
    return f"Take a moment, then start whenever you're ready: {session.topic}"


def mode_for(session_type: str) -> str:
    return SESSION_TYPE_MODE[SessionType(session_type)]
