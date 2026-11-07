import uuid

from django.conf import settings
from django.db import models


class Resource(models.Model):
    """LLD §11.3 — the master content library.

    `sub_skill_tag` and `body` are additions: §22.6 ranks candidates by
    sub-skill (e.g. 'filler_words', not just 'fluency'), and Lexio-authored
    micro-lessons need somewhere to keep their actual content.
    """

    class Type(models.TextChoices):
        VIDEO = "video", "Video"
        ARTICLE = "article", "Article"
        LESSON = "lesson", "Micro-lesson"
        AUDIO_DRILL = "audio_drill", "Audio drill"
        PROMPT_PACK = "prompt_pack", "Practice prompt pack"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=12, choices=Type.choices)
    title = models.CharField(max_length=300)
    source = models.CharField(max_length=100)
    url = models.TextField(blank=True)
    youtube_id = models.CharField(max_length=20, blank=True)
    thumbnail_url = models.TextField(blank=True)
    duration_minutes = models.SmallIntegerField(default=0)
    dimension_tags = models.JSONField(default=list)
    sub_skill_tag = models.CharField(max_length=100, blank=True)
    difficulty_level = models.SmallIntegerField(default=1)
    summary = models.TextField(blank=True)
    body = models.JSONField(default=dict, blank=True)  # Lexio-authored lesson content
    is_active = models.BooleanField(default=True)
    view_count = models.IntegerField(default=0)
    # LLD §22.5 — rolling average dimension delta across students who consumed
    # this resource. Recomputed nightly; feeds the §22.6 ranking.
    effectiveness_score = models.FloatField(null=True, blank=True)
    effectiveness_sample_size = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["type", "is_active"])]

    def __str__(self):
        return f"{self.type}: {self.title[:48]}"


class ContentRecommendation(models.Model):
    """LLD §11.2 — resources recommended off the back of one session's gaps."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recommendations")
    session = models.ForeignKey(
        "assessments.AssessmentSession", on_delete=models.CASCADE, related_name="recommendations"
    )
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name="recommendations")
    dimension = models.CharField(max_length=50)
    rank = models.SmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["session", "rank"])]
        ordering = ["rank"]


class Bookmark(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookmarks")
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name="bookmarks")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "resource"], name="unique_user_bookmark")]


# Module 12 models live in their own file for readability; imported here so
# Django discovers them and `from apps.content.models import X` keeps working.
from .attribution_models import (  # noqa: E402,F401
    AttributionRecord,
    ContentCandidate,
    ContentConsumption,
    ProgressEvent,
)
