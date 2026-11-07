import uuid

from django.conf import settings
from django.db import models


class Badge(models.Model):
    """LLD §12.3 — badge definitions. Seeded by `manage.py seed_badges`."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=200)
    icon = models.CharField(max_length=8, blank=True)
    order_index = models.SmallIntegerField(default=0)

    class Meta:
        ordering = ["order_index"]

    def __str__(self):
        return self.name


class UserBadge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="badges")
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name="awards")
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-earned_at"]
        constraints = [models.UniqueConstraint(fields=["user", "badge"], name="unique_user_badge")]


class DailyActivity(models.Model):
    """LLD §12.4 — one row per active day, the source of truth for streaks.
    `User.streak_days` is a cached read of what this table implies."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="daily_activity")
    date = models.DateField()
    session_count = models.SmallIntegerField(default=0)
    items_completed = models.SmallIntegerField(default=0)

    class Meta:
        ordering = ["-date"]
        constraints = [models.UniqueConstraint(fields=["user", "date"], name="unique_user_day")]
        indexes = [models.Index(fields=["user", "-date"])]
