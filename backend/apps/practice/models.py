import uuid

from django.conf import settings
from django.db import models

from apps.assessments.models import Mode, Prompt


class SessionType(models.TextChoices):
    """LLD §8.1."""

    MOCK_INTERVIEW = "mock_interview", "Mock Interview"
    IMPROMPTU = "impromptu", "Impromptu Speaking"
    DEBATE = "debate", "Debate / GD"
    PRESENTATION = "presentation", "Presentation"
    WRITING_DRILL = "writing_drill", "Writing Drill"


# Which assessment mode's rubric each practice type is scored against, so a
# practice session feeds the same eight dimensions as an assessment.
SESSION_TYPE_MODE = {
    SessionType.MOCK_INTERVIEW: Mode.SPEAK,
    SessionType.IMPROMPTU: Mode.SPEAK,
    SessionType.DEBATE: Mode.GD,
    SessionType.PRESENTATION: Mode.PRESENT,
    SessionType.WRITING_DRILL: Mode.WRITE,
}

SESSION_TYPE_META = {
    SessionType.MOCK_INTERVIEW: {
        "title": "Mock Interview",
        "blurb": "Echo interviews you with follow-up questions that react to your answers.",
        "multi_turn": True,
    },
    SessionType.IMPROMPTU: {
        "title": "Impromptu Speaking",
        "blurb": "A topic card, a moment to think, then two minutes on the clock.",
        "multi_turn": False,
    },
    SessionType.DEBATE: {
        "title": "Debate / Group Discussion",
        "blurb": "Hold your position against AI peers who push back.",
        "multi_turn": True,
    },
    SessionType.PRESENTATION: {
        "title": "Presentation",
        "blurb": "Deliver a short talk and get scored on structure and delivery.",
        "multi_turn": False,
    },
    SessionType.WRITING_DRILL: {
        "title": "Writing Drill",
        "blurb": "A timed written prompt, scored on grammar, structure and range.",
        "multi_turn": False,
    },
}


class PracticeSession(models.Model):
    """LLD §8.3."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PROCESSING = "processing", "Processing"
        COMPLETE = "complete", "Complete"
        ABANDONED = "abandoned", "Abandoned"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="practice_sessions")
    session_type = models.CharField(max_length=20, choices=SessionType.choices)
    mode = models.CharField(max_length=10, choices=Mode.choices)
    prompt = models.ForeignKey(Prompt, on_delete=models.PROTECT, related_name="practice_sessions", null=True, blank=True)
    topic = models.TextField(blank=True)

    transcript = models.TextField(blank=True)
    turns = models.JSONField(default=list, blank=True)  # [{role: echo|student, text}]
    coaching_nudges = models.JSONField(default=list, blank=True)  # [{timestamp_s, message, dimension, severity}]
    session_metrics = models.JSONField(default=dict, blank=True)  # {avg_wpm, filler_ratio, ...}

    question_count = models.SmallIntegerField(default=0)
    current_question = models.SmallIntegerField(default=0)
    xp_awarded = models.SmallIntegerField(default=0)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    error = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["user", "-started_at"])]

    def __str__(self):
        return f"{self.session_type} ({self.status})"

    @property
    def duration_seconds(self) -> int:
        if not self.ended_at:
            return 0
        return int((self.ended_at - self.started_at).total_seconds())
