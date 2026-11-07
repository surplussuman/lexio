"""Module 12 models (LLD §22.1, §22.5) — the content pipeline and the
attribution engine. Kept beside the M8 library models they extend."""
import uuid

from django.conf import settings
from django.db import models

from .models import Resource


class ContentCandidate(models.Model):
    """LLD §22.1 — proposed content waiting on a human reviewer. Nothing
    reaches the live library without approval; there is no fully automated
    ingestion path."""

    class Source(models.TextChoices):
        YOUTUBE = "youtube", "YouTube"
        ARTICLE = "article", "Article"
        LICENSED = "licensed", "Licensed"

    class ProposedBy(models.TextChoices):
        AI_SCAN = "ai_scan", "AI weekly scan"
        MANUAL = "manual", "Manual"

    class ReviewStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.CharField(max_length=10, choices=Source.choices)
    proposed_by = models.CharField(max_length=10, choices=ProposedBy.choices, default=ProposedBy.AI_SCAN)

    title = models.CharField(max_length=300)
    url = models.TextField(blank=True)
    youtube_id = models.CharField(max_length=20, blank=True)
    duration_minutes = models.SmallIntegerField(default=0)
    summary = models.TextField(blank=True)
    dimension_tags = models.JSONField(default=list)
    sub_skill_tag = models.CharField(max_length=100, blank=True)
    difficulty_level = models.SmallIntegerField(default=1)

    review_status = models.CharField(max_length=10, choices=ReviewStatus.choices, default=ReviewStatus.PENDING)
    review_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="content_reviews"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    promoted_resource = models.ForeignKey(
        Resource, on_delete=models.SET_NULL, null=True, blank=True, related_name="promoted_from"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["review_status", "-created_at"]
        indexes = [models.Index(fields=["review_status", "-created_at"])]

    def __str__(self):
        return f"{self.review_status}: {self.title[:48]}"


class ContentConsumption(models.Model):
    """LLD §22.5 — what the student actually consumed, and how much of it."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="consumption")
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name="consumption")
    dimension = models.CharField(max_length=50)
    consumed_pct = models.SmallIntegerField(default=0)
    consumed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-consumed_at"]
        indexes = [models.Index(fields=["user", "resource"]), models.Index(fields=["resource"])]


class AttributionRecord(models.Model):
    """LLD §22.5 — links content consumed to the score movement that followed.

    Explicitly correlational, not causal: repetition and ordinary learning move
    scores too. It's a motivating narrative for the student and a ranking
    signal for content — never presented as proof.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attributions")
    dimension = models.CharField(max_length=50)
    score_before = models.SmallIntegerField()
    score_after = models.SmallIntegerField()
    delta = models.SmallIntegerField()
    contributing_resource_ids = models.JSONField(default=list)
    window_days = models.SmallIntegerField(default=14)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "dimension"])]


class ProgressEvent(models.Model):
    """LLD §22.3 — an append-only log so progress is reviewable over time,
    not just 'where is it right now'."""

    class EventType(models.TextChoices):
        CONTENT_STARTED = "content_started", "Content started"
        CONTENT_COMPLETED = "content_completed", "Content completed"
        MODULE_MASTERED = "module_mastered", "Module mastered"
        SESSION_SCORED = "session_scored", "Session scored"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="progress_events")
    dimension = models.CharField(max_length=50)
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    ref_id = models.UUIDField(null=True, blank=True)  # resource / module / score, per event_type
    label = models.CharField(max_length=200, blank=True)
    score_at_event = models.SmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["user", "dimension", "created_at"])]
