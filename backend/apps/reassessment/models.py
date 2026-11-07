import uuid

from django.conf import settings
from django.db import models


class Reassessment(models.Model):
    """LLD §13.3 — a before/after comparison cycle."""

    class TriggeredBy(models.TextChoices):
        PATH_COMPLETE = "path_complete", "Path complete"
        MANUAL = "manual", "Manual request"
        AUTO_NUDGE = "auto_nudge", "Auto nudge"
        ADMIN = "admin", "Admin"

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETE = "complete", "Complete"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reassessments")

    baseline_snapshot = models.JSONField(default=dict)  # dimension scores when the cycle started
    new_scores = models.JSONField(default=dict, blank=True)
    delta_scores = models.JSONField(default=dict, blank=True)
    overall_delta = models.SmallIntegerField(default=0)
    overall_before = models.SmallIntegerField(default=0)
    overall_after = models.SmallIntegerField(default=0)
    improvement_narrative = models.TextField(blank=True)

    # Which modes the student must redo, and which sessions satisfied them.
    required_modes = models.JSONField(default=list)
    session_ids = models.JSONField(default=list, blank=True)

    triggered_by = models.CharField(max_length=16, choices=TriggeredBy.choices, default=TriggeredBy.MANUAL)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.IN_PROGRESS)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["user", "-started_at"])]

    def __str__(self):
        return f"Reassessment {self.user_id} ({self.status})"
