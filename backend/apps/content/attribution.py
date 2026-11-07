"""Attribution engine (LLD §22.5) and the progress log (§22.3).

The honest caveat from the LLD, restated because it matters: this is
correlational. A student who watched a video and then scored higher may have
improved for a dozen other reasons. It is used as a motivating narrative and a
content-ranking signal, never as proof that a resource caused an improvement.
"""
import logging
from datetime import timedelta

from django.db.models import Avg, Count
from django.utils import timezone

from apps.analysis.models import SessionScore

from .attribution_models import AttributionRecord, ContentConsumption, ProgressEvent
from .models import Resource

logger = logging.getLogger(__name__)

ATTRIBUTION_WINDOW_DAYS = 14  # §22.5 "within a 14-day window"
MIN_SAMPLE_FOR_EFFECTIVENESS = 3  # below this the average is noise, not signal


def log_event(user, *, dimension, event_type, ref_id=None, label="", score=None) -> ProgressEvent:
    return ProgressEvent.objects.create(
        user=user,
        dimension=dimension,
        event_type=event_type,
        ref_id=ref_id,
        label=label[:200],
        score_at_event=score,
    )


def record_consumption(user, resource: Resource, dimension: str, consumed_pct: int) -> ContentConsumption:
    """Track what was consumed and how much of it (§22.5). Also feeds the
    §22.6 'format affinity' signal — whether this student finishes videos or
    only ever finishes articles."""
    consumption = ContentConsumption.objects.create(
        user=user, resource=resource, dimension=dimension, consumed_pct=max(0, min(100, consumed_pct))
    )
    log_event(
        user,
        dimension=dimension,
        event_type=ProgressEvent.EventType.CONTENT_COMPLETED
        if consumed_pct >= 90
        else ProgressEvent.EventType.CONTENT_STARTED,
        ref_id=resource.id,
        label=resource.title,
    )
    return consumption


def _dimension_score_at(user, dimension: str, *, before, after=None):
    """The dimension's score from the nearest session in the given direction."""
    queryset = SessionScore.objects.filter(user=user).order_by("created_at")
    if after is None:
        queryset = queryset.filter(created_at__lt=before).order_by("-created_at")
    else:
        queryset = queryset.filter(created_at__gt=before, created_at__lte=after)

    for score in queryset:
        if dimension in (score.dimension_scores or {}):
            return score.dimension_scores[dimension], score.created_at
    return None, None


def compute_attribution_for_user(user) -> list[AttributionRecord]:
    """Pair each dimension's consumption with the score movement around it.

    One record per (dimension, window): everything consumed in that window
    shares the credit — the LLD is explicit that credit is *shown*, not split
    precisely, because there's no basis for splitting it.
    """
    created = []
    dimensions = (
        ContentConsumption.objects.filter(user=user).values_list("dimension", flat=True).distinct()
    )

    for dimension in dimensions:
        consumptions = list(
            ContentConsumption.objects.filter(user=user, dimension=dimension).order_by("consumed_at")
        )
        if not consumptions:
            continue

        window_start = consumptions[0].consumed_at
        while window_start:
            window_end = window_start + timedelta(days=ATTRIBUTION_WINDOW_DAYS)
            in_window = [c for c in consumptions if window_start <= c.consumed_at < window_end]
            if not in_window:
                break

            before, _ = _dimension_score_at(user, dimension, before=window_start)
            after, after_at = _dimension_score_at(user, dimension, before=window_start, after=window_end)

            if before is not None and after is not None:
                resource_ids = sorted({str(c.resource_id) for c in in_window})
                record, was_created = AttributionRecord.objects.get_or_create(
                    user=user,
                    dimension=dimension,
                    score_before=before,
                    score_after=after,
                    defaults={
                        "delta": after - before,
                        "contributing_resource_ids": resource_ids,
                        "window_days": ATTRIBUTION_WINDOW_DAYS,
                    },
                )
                if was_created:
                    created.append(record)

            remaining = [c for c in consumptions if c.consumed_at >= window_end]
            window_start = remaining[0].consumed_at if remaining else None

    return created


def refresh_effectiveness_scores() -> int:
    """LLD §22.5 nightly job — rolling average delta per resource, which then
    feeds the §22.6 ranking. Resources with too few data points are left
    unscored rather than ranked on one student's result."""
    updated = 0
    for resource in Resource.objects.filter(is_active=True):
        stats = AttributionRecord.objects.filter(
            contributing_resource_ids__contains=[str(resource.id)]
        ).aggregate(average=Avg("delta"), sample=Count("id"))

        sample = stats["sample"] or 0
        if sample >= MIN_SAMPLE_FOR_EFFECTIVENESS:
            resource.effectiveness_score = round(stats["average"], 2)
        else:
            resource.effectiveness_score = None
        resource.effectiveness_sample_size = sample
        resource.save(update_fields=["effectiveness_score", "effectiveness_sample_size"])
        updated += 1
    return updated


def format_affinity(user) -> dict[str, float]:
    """§22.6 — average completion by resource type. A student who never
    finishes videos but always finishes articles should see more articles."""
    rows = (
        ContentConsumption.objects.filter(user=user)
        .values("resource__type")
        .annotate(average=Avg("consumed_pct"), sample=Count("id"))
    )
    return {row["resource__type"]: round(row["average"], 1) for row in rows if row["sample"] >= 2}


def dimension_timeline(user, dimension: str) -> list[dict]:
    """§22.3 — the per-dimension timeline behind GET /api/progress/:dimension."""
    events = ProgressEvent.objects.filter(user=user, dimension=dimension)
    return [
        {
            "event_type": event.event_type,
            "label": event.label,
            "score_at_event": event.score_at_event,
            "created_at": event.created_at,
        }
        for event in events
    ]
