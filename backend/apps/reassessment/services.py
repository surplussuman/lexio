"""Reassessment & comparison engine (LLD §13). The delta maths is pure and
unit-tested; the narrative is the only AI call."""
import logging
from datetime import timedelta

from django.utils import timezone

from apps.analysis.aggregates import composite_score, latest_dimension_scores
from apps.analysis.rubrics import DIMENSIONS
from apps.assessments.models import AssessmentSession, Mode
from apps.core.ai import ai

from .models import Reassessment

logger = logging.getLogger(__name__)

MANUAL_COOLDOWN_DAYS = 14  # §13.1 "allowed once per 2 weeks"
PRACTICE_SESSIONS_FOR_NUDGE = 10  # §13.1 auto-nudge threshold
XP_REASSESSMENT = 100  # §12.1
XP_IMPROVEMENT_BONUS = 100  # §12.1 "improve overall score by 5 points"
IMPROVEMENT_BONUS_THRESHOLD = 5

NARRATIVE_SYSTEM = (
    "You are Echo, a communication coach writing to a student about how far they've come. "
    "Second person, warm but honest, no markdown, no lists, no preamble. "
    "If something regressed, say so plainly and without drama."
)


def compute_deltas(before: dict[str, int], after: dict[str, int]) -> dict[str, int]:
    """Per-dimension change. Only dimensions measured in *both* rounds appear —
    a dimension with nothing to compare against isn't an improvement or a
    regression, and reporting it as one would be misleading."""
    return {
        dimension: after[dimension] - before[dimension]
        for dimension in after
        if dimension in before
    }


def highlight_moments(deltas: dict[str, int], limit: int = 3) -> list[dict]:
    """§13.4 — the biggest improvements, for the achievement cards."""
    improved = sorted(((d, v) for d, v in deltas.items() if v > 0), key=lambda pair: -pair[1])
    return [
        {"dimension": dimension, "label": DIMENSIONS.get(dimension, dimension), "delta": delta}
        for dimension, delta in improved[:limit]
    ]


def can_request_manually(user) -> tuple[bool, str]:
    """§13.1 — manual reassessment is allowed once per two weeks."""
    last = Reassessment.objects.filter(user=user, triggered_by=Reassessment.TriggeredBy.MANUAL).first()
    if last is None:
        return True, ""
    next_allowed = last.started_at + timedelta(days=MANUAL_COOLDOWN_DAYS)
    if timezone.now() >= next_allowed:
        return True, ""
    days = max(1, (next_allowed - timezone.now()).days)
    return False, f"You can request another reassessment in {days} day{'s' if days != 1 else ''}."


def should_auto_nudge(user) -> bool:
    """§13.1 — nudge after 10+ practice sessions since the last assessment."""
    from apps.practice.models import PracticeSession

    last_assessment = (
        AssessmentSession.objects.filter(user=user, status=AssessmentSession.Status.COMPLETE)
        .order_by("-completed_at")
        .first()
    )
    if last_assessment is None:
        return False
    since = PracticeSession.objects.filter(
        user=user, status=PracticeSession.Status.COMPLETE, started_at__gt=last_assessment.completed_at
    ).count()
    return since >= PRACTICE_SESSIONS_FOR_NUDGE


def start_reassessment(user, triggered_by=Reassessment.TriggeredBy.MANUAL) -> Reassessment:
    """§13.2 — snapshot where the student stands, then ask them to redo the
    modes they've already been assessed on."""
    baseline = latest_dimension_scores(user)
    assessed_modes = list(
        AssessmentSession.objects.filter(user=user, status=AssessmentSession.Status.COMPLETE)
        .values_list("mode", flat=True)
        .distinct()
    )
    required = assessed_modes or [Mode.SPEAK]

    return Reassessment.objects.create(
        user=user,
        baseline_snapshot=baseline,
        overall_before=composite_score(baseline) or 0,
        required_modes=required,
        triggered_by=triggered_by,
    )


def outstanding_modes(reassessment: Reassessment) -> list[str]:
    """Modes still to redo in this cycle."""
    done = set(
        AssessmentSession.objects.filter(
            user=reassessment.user,
            status=AssessmentSession.Status.COMPLETE,
            is_baseline=False,
            completed_at__gte=reassessment.started_at,
        ).values_list("mode", flat=True)
    )
    return [mode for mode in reassessment.required_modes if mode not in done]


def try_complete(reassessment: Reassessment) -> Reassessment:
    """Finish the cycle once every required mode has been redone."""
    if reassessment.status == Reassessment.Status.COMPLETE:
        return reassessment
    if outstanding_modes(reassessment):
        return reassessment

    after = latest_dimension_scores(reassessment.user)
    deltas = compute_deltas(reassessment.baseline_snapshot, after)

    reassessment.new_scores = after
    reassessment.delta_scores = deltas
    reassessment.overall_after = composite_score(after) or 0
    reassessment.overall_delta = reassessment.overall_after - reassessment.overall_before
    reassessment.session_ids = [
        str(session_id)
        for session_id in AssessmentSession.objects.filter(
            user=reassessment.user,
            status=AssessmentSession.Status.COMPLETE,
            completed_at__gte=reassessment.started_at,
        ).values_list("id", flat=True)
    ]
    reassessment.improvement_narrative = _narrative(reassessment, deltas)
    reassessment.status = Reassessment.Status.COMPLETE
    reassessment.completed_at = timezone.now()
    reassessment.save()

    _award_and_regenerate(reassessment)
    return reassessment


def _narrative(reassessment: Reassessment, deltas: dict[str, int]) -> str:
    if not deltas:
        return ""
    lines = "\n".join(
        f"- {DIMENSIONS.get(d, d)}: {reassessment.baseline_snapshot.get(d)} → {reassessment.new_scores.get(d)} "
        f"({'+' if v >= 0 else ''}{v})"
        for d, v in sorted(deltas.items(), key=lambda pair: -pair[1])
    )
    try:
        return ai().generate_text(
            call_type="comparison_narrative",
            system=NARRATIVE_SYSTEM,
            user=(
                f"A student retook their assessments. Overall: {reassessment.overall_before} → "
                f"{reassessment.overall_after} ({'+' if reassessment.overall_delta >= 0 else ''}"
                f"{reassessment.overall_delta}).\n\nPer dimension:\n{lines}\n\n"
                "Write 3 short paragraphs: what improved and what that means in practice, what "
                "still needs work, and what to focus on next. Max 200 words."
            ),
        ).strip()
    except Exception:
        logger.exception("Comparison narrative failed for %s", reassessment.id)
        return ""


def _award_and_regenerate(reassessment: Reassessment) -> None:
    """§13.2 steps 6-7: update the path from the new scores, award XP."""
    from apps.gamification.badges import evaluate_badges
    from apps.gamification.models import Badge, UserBadge
    from apps.gamification.services import award_xp
    from apps.learning_path.services import generate_path

    award_xp(reassessment.user, XP_REASSESSMENT)
    if reassessment.overall_delta >= IMPROVEMENT_BONUS_THRESHOLD:
        award_xp(reassessment.user, XP_IMPROVEMENT_BONUS)

    # §12.3 "Level Up" — improve overall by 10 points in one reassessment.
    if reassessment.overall_delta >= 10:
        badge = Badge.objects.filter(key="improvement_10").first()
        if badge:
            UserBadge.objects.get_or_create(user=reassessment.user, badge=badge)

    reassessment.user.refresh_from_db()
    evaluate_badges(reassessment.user)

    try:
        generate_path(reassessment.user, force=True)
    except Exception:
        logger.exception("Path regeneration after reassessment failed for %s", reassessment.id)
