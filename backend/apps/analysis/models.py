import uuid

from django.conf import settings
from django.db import models

from apps.assessments.models import AssessmentSession


class SessionScore(models.Model):
    """LLD §6.4 — the output of the AI analysis pipeline for one session.

    §14.1 lists a single `session_scores` table, but sessions live in two
    tables (assessment and practice). Rather than duplicate the scoring model,
    a score points at exactly one of them — which also means practice results
    feed `latest_dimension_scores` and therefore the learning path, without
    any special-casing downstream.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.OneToOneField(
        AssessmentSession, on_delete=models.CASCADE, related_name="score", null=True, blank=True
    )
    practice_session = models.OneToOneField(
        "practice.PracticeSession", on_delete=models.CASCADE, related_name="score", null=True, blank=True
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="session_scores")
    overall_score = models.SmallIntegerField()
    dimension_scores = models.JSONField(default=dict)
    audio_features = models.JSONField(default=dict, blank=True)
    annotations = models.JSONField(default=list, blank=True)
    answer_breakdown = models.JSONField(default=list, blank=True)  # objective modes
    # Whether the response reads as the student's own work. A supportive
    # signal shown back to them, not a disciplinary verdict — see
    # apps/analysis/authenticity.py for why it is framed that way.
    authenticity = models.JSONField(default=dict, blank=True)
    # Did they use the time they were given? {target_seconds, actual_seconds,
    # ratio, band, penalty}. Empty for modes that aren't timed this way.
    timing = models.JSONField(default=dict, blank=True)
    # Presentation mode only: camera-derived delivery signals and per-slide
    # pacing.
    visual_metrics = models.JSONField(default=dict, blank=True)
    slide_coverage = models.JSONField(default=list, blank=True)
    feedback_narrative = models.TextField(blank=True)
    ai_model_version = models.CharField(max_length=60, blank=True)
    processing_ms = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"])]
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(session__isnull=False, practice_session__isnull=True)
                    | models.Q(session__isnull=True, practice_session__isnull=False)
                ),
                name="score_belongs_to_exactly_one_session",
            )
        ]

    def __str__(self):
        return f"{self.overall_score}/100"
