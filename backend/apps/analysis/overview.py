"""The baseline report — one read of the student across all eight modes.

Per-assessment feedback used to appear the moment each session was scored.
That turned out to be the wrong shape: a student who has done one assessment
sees a "score" that is really a single data point, reacts to it, and often
retakes it instead of finishing the picture. So the detailed reports are held
back until all eight baseline modes are done, and then arrive together — an
overview first, then the per-assessment detail underneath it.
"""
import hashlib

from django.core.cache import cache

from apps.assessments.models import AssessmentSession, Mode

from .aggregates import composite_score, latest_dimension_scores
from .models import SessionScore
from .rubrics import DIMENSIONS

NARRATIVE_CACHE_SECONDS = 60 * 60 * 24 * 30
HIGHLIGHT_COUNT = 3

OVERVIEW_SYSTEM = (
    "You are Echo, a communication coach writing a student's first full assessment report. "
    "You have their scores across all eight modes. Write in the second person, plainly, with "
    "no markdown, no headings and no bullet points. Be specific about what the pattern across "
    "modes shows — the point is what they could not see from any single assessment."
)


def baseline_sessions(user):
    """The scored baseline session per mode, newest first within each mode."""
    sessions = (
        AssessmentSession.objects.filter(
            user=user, is_baseline=True, status=AssessmentSession.Status.COMPLETE
        )
        .select_related("score")
        .order_by("mode", "-completed_at")
    )
    seen, latest = set(), []
    for session in sessions:
        if session.mode not in seen and getattr(session, "score", None):
            seen.add(session.mode)
            latest.append(session)
    return latest


def is_baseline_complete(user) -> bool:
    return len(baseline_sessions(user)) == len(Mode.choices)


def _narrative(user, sessions, dimension_scores) -> str:
    """Generated once per set of baseline sessions and cached — this is a
    report the student will open repeatedly, not a per-view call (§17.3)."""
    from apps.core.ai import ai

    fingerprint = hashlib.sha256(
        "|".join(sorted(str(session.score.id) for session in sessions)).encode()
    ).hexdigest()[:16]
    key = f"baseline_report:{user.id}:{fingerprint}"

    cached = cache.get(key)
    if cached is not None:
        return cached

    mode_lines = "\n".join(
        f"- {session.get_mode_display()}: {session.score.overall_score}/100"
        for session in sorted(sessions, key=lambda s: -s.score.overall_score)
    )
    dimension_lines = "\n".join(
        f"- {DIMENSIONS[dimension]}: {value}/100"
        for dimension, value in sorted(dimension_scores.items(), key=lambda pair: -pair[1])
    )

    try:
        narrative = ai().generate_text(
            call_type="baseline_overview",
            system=OVERVIEW_SYSTEM,
            user=f"""A student has just finished all eight baseline assessments.

Score per mode:
{mode_lines}

Score per dimension:
{dimension_lines}

Write three short paragraphs, max 180 words total:
1. What they are already good at, named specifically — the thing that shows up across modes.
2. The one pattern holding them back, and what it looks like in practice.
3. What to do first, concretely. One thing, not a list.

Do not restate the numbers back to them; they can see those.""",
        ).strip()
    except Exception:
        # A missing narrative must never block the report the student earned.
        return ""

    cache.set(key, narrative, NARRATIVE_CACHE_SECONDS)
    return narrative


def baseline_report(user) -> dict:
    """The full report, or the progress towards it if it isn't earned yet."""
    sessions = baseline_sessions(user)
    total = len(Mode.choices)
    payload = {
        "baseline_complete": len(sessions) == total,
        "modes_completed": len(sessions),
        "modes_total": total,
        "report": None,
    }
    if not payload["baseline_complete"]:
        return payload

    dimension_scores = latest_dimension_scores(user)
    ranked = sorted(dimension_scores.items(), key=lambda pair: -pair[1])

    payload["report"] = {
        "overall_score": composite_score(dimension_scores),
        "dimension_scores": dimension_scores,
        "dimension_labels": DIMENSIONS,
        "strongest": [{"dimension": d, "label": DIMENSIONS[d], "score": v} for d, v in ranked[:HIGHLIGHT_COUNT]],
        "weakest": [
            {"dimension": d, "label": DIMENSIONS[d], "score": v}
            for d, v in reversed(ranked[-HIGHLIGHT_COUNT:])
        ],
        "narrative": _narrative(user, sessions, dimension_scores),
        "sessions": [_session_row(session) for session in sorted(sessions, key=lambda s: s.mode)],
        "completed_at": max(session.completed_at for session in sessions),
    }
    return payload


def _session_row(session) -> dict:
    score: SessionScore = session.score
    return {
        "session_id": str(session.id),
        "mode": session.mode,
        "mode_name": session.get_mode_display(),
        "overall_score": score.overall_score,
        "dimension_scores": score.dimension_scores,
        "completed_at": session.completed_at,
        "authenticity_band": (score.authenticity or {}).get("band"),
        "timing_band": (score.timing or {}).get("band"),
    }
