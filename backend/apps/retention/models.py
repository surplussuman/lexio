import uuid

from django.conf import settings
from django.db import models

from apps.assessments.models import Prompt


class EchoState(models.Model):
    """LLD §21.4 — Echo as a persistent identity rather than narration text.

    `remembered_weak_points` is what makes Echo feel like it remembers you:
    it's derived from the student's own annotation history, so Echo can say
    "last time your filler count was 8" instead of something generic.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="echo_state")
    evolution_stage = models.SmallIntegerField(default=1)  # 1-5, derived from User.current_level
    remembered_weak_points = models.JSONField(default=list, blank=True)  # rolling last 3
    last_daily_message_sent = models.DateTimeField(null=True, blank=True)
    relationship_score = models.SmallIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Echo for {self.user_id} (stage {self.evolution_stage})"


class DailyChallenge(models.Model):
    """LLD §21.5 — the Daily Drill Card: one short challenge a day, aimed at
    the student's weakest dimension, expiring at local midnight."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETE = "complete", "Complete"
        EXPIRED = "expired", "Expired"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="daily_challenges")
    date = models.DateField()
    dimension = models.CharField(max_length=50)
    mode = models.CharField(max_length=10)
    prompt = models.ForeignKey(Prompt, on_delete=models.PROTECT, related_name="daily_challenges")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    xp_reward = models.SmallIntegerField(default=25)
    expires_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-date"]
        constraints = [models.UniqueConstraint(fields=["user", "date"], name="unique_daily_challenge")]
        indexes = [models.Index(fields=["user", "expires_at"])]

    def __str__(self):
        return f"{self.user_id} {self.date} ({self.status})"
