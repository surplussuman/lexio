"""Cross-session score aggregation (LLD §7.2). Shared by the dashboard and
the learning-path engine so both read the student's standing the same way."""
from collections import defaultdict
from datetime import timedelta

from django.utils import timezone

from .models import SessionScore
from .rubrics import DIMENSIONS

RECENT_SESSIONS_PER_DIMENSION = 3  # §7.2 "AVG of last 3 sessions per dimension"


def latest_dimension_scores(user) -> dict[str, int]:
    """Average of each dimension's most recent scores, newest sessions first.

    A dimension only appears once the student has been assessed on a mode that
    scores it — an unassessed dimension is absent rather than zero, so it can't
    masquerade as a weakness in the path engine.
    """
    buckets = defaultdict(list)
    # `-id` is a tiebreaker, not decoration: ordering on `created_at` alone is
    # nondeterministic when two rows share a timestamp, which makes "the last
    # three" ambiguous and the result unstable between identical queries.
    scores = (
        SessionScore.objects.filter(user=user)
        .order_by("-created_at", "-id")
        .values_list("dimension_scores", flat=True)
    )

    for dimension_scores in scores:
        for dimension, value in (dimension_scores or {}).items():
            if dimension in DIMENSIONS and len(buckets[dimension]) < RECENT_SESSIONS_PER_DIMENSION:
                buckets[dimension].append(value)

    return {dimension: round(sum(values) / len(values)) for dimension, values in buckets.items() if values}


def composite_score(dimension_scores: dict[str, int]) -> int | None:
    """The headline number. §7.2 calls it a 'weighted composite of all 8
    dimension averages' but never gives cross-dimension weights — with none
    specified, the dimensions are weighted equally."""
    if not dimension_scores:
        return None
    return round(sum(dimension_scores.values()) / len(dimension_scores))


def gap_scores(dimension_scores: dict[str, int]) -> list[tuple[str, int]]:
    """LLD §10.2 steps 2-3: gap = target(100) - current, ranked weakest first."""
    return sorted(((d, 100 - v) for d, v in dimension_scores.items()), key=lambda pair: -pair[1])


def daily_progress(user, days: int = 30) -> list[dict]:
    """LLD §7.3 GET /api/dashboard/progress — one point per active day."""
    since = timezone.now() - timedelta(days=days)
    per_day = defaultdict(list)
    for created_at, overall in SessionScore.objects.filter(user=user, created_at__gte=since).values_list(
        "created_at", "overall_score"
    ):
        per_day[created_at.date()].append(overall)

    return [
        {"date": day.isoformat(), "score": round(sum(values) / len(values))}
        for day, values in sorted(per_day.items())
    ]
