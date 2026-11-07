import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """LLD §4.2. password_hash is handled by AbstractBaseUser's `password`
    field (bcrypt-equivalent via Django's PBKDF2/bcrypt hasher — see
    PASSWORD_HASHERS in settings if we need to swap to bcrypt specifically
    for the §19.1 "bcrypt cost factor 12" requirement)."""

    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        MENTOR = "mentor", "Mentor"
        ADMIN = "admin", "Admin"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100, blank=True)
    avatar_url = models.TextField(blank=True, null=True)
    college = models.CharField(max_length=200, blank=True)
    batch_year = models.SmallIntegerField(null=True, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)

    onboarding_step = models.SmallIntegerField(default=0)  # 0=not started, 1-5=in progress, 6=complete
    has_baseline = models.BooleanField(default=False)

    total_xp = models.IntegerField(default=0)
    current_level = models.SmallIntegerField(default=1)
    streak_days = models.SmallIntegerField(default=0)
    # LLD §12.4 streak freezes: one earned per 7-day streak, spent to bridge a
    # single missed day. The running total is tracked separately so the same
    # milestone can't grant a token twice.
    streak_freezes = models.SmallIntegerField(default=0)
    streak_freezes_earned_total = models.SmallIntegerField(default=0)

    goals = models.JSONField(default=list, blank=True)
    # Up to 3 domains the student wants their assessment prompts drawn from.
    # Empty means "not chosen yet" — the frontend shows the picker on that.
    topic_preferences = models.JSONField(default=list, blank=True)

    last_active_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["college", "batch_year"]),
            models.Index(fields=["-total_xp"]),  # leaderboard (M9)
        ]

    def __str__(self):
        return self.email
