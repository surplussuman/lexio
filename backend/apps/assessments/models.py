import uuid

from django.conf import settings
from django.db import models


class Mode(models.TextChoices):
    """The 8 assessment modes, LLD §5.1."""

    SPEAK = "speak", "Speaking"
    PRESENT = "present", "Presentation"
    WRITE = "write", "Writing"
    VOCAB = "vocab", "Vocabulary"
    GRAMMAR = "grammar", "Grammar"
    READ = "read", "Reading Comprehension"
    LISTEN = "listen", "Listening"
    GD = "gd", "Group Discussion"


# How each mode collects a response — drives which interface the frontend
# renders and how apps.analysis scores it.
VOICE_MODES = {Mode.SPEAK, Mode.PRESENT, Mode.GD}
TEXT_MODES = {Mode.WRITE}
OBJECTIVE_MODES = {Mode.VOCAB, Mode.GRAMMAR, Mode.READ, Mode.LISTEN}

MODE_META = {
    Mode.SPEAK: {"duration_minutes": 3, "interface": "voice"},
    Mode.PRESENT: {"duration_minutes": 5, "interface": "presentation"},
    Mode.WRITE: {"duration_minutes": 15, "interface": "text"},
    Mode.VOCAB: {"duration_minutes": 8, "interface": "mcq"},
    Mode.GRAMMAR: {"duration_minutes": 6, "interface": "mcq"},
    Mode.READ: {"duration_minutes": 12, "interface": "passage_mcq"},
    Mode.LISTEN: {"duration_minutes": 10, "interface": "audio_mcq"},
    Mode.GD: {"duration_minutes": 10, "interface": "voice"},
}

# How long the student is actually expected to talk for, per mode. Separate
# from `duration_minutes` (which is how long the whole exercise takes,
# including reading the prompt) because holding the floor for the time you
# were given is itself part of the assessment — see analysis.rubrics.
# `min_ratio` is how much of the target counts as a genuine attempt; below it
# the response is treated as incomplete rather than merely short.
SPEAKING_TARGETS = {
    Mode.SPEAK: {"target_seconds": 180, "min_ratio": 0.6, "max_ratio": 1.15},
    Mode.PRESENT: {"target_seconds": 300, "min_ratio": 0.6, "max_ratio": 1.15},
    Mode.GD: {"target_seconds": 120, "min_ratio": 0.5, "max_ratio": 1.25},
}


class Prompt(models.Model):
    """LLD §5.3. `payload` is an addition to the LLD's table: objective modes
    (vocab/grammar/read/listen) need somewhere to carry their questions,
    passages and answer keys, which the LLD's text/tips fields can't hold."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mode = models.CharField(max_length=10, choices=Mode.choices)
    level = models.SmallIntegerField(default=1)  # 1=beginner, 2=intermediate, 3=advanced
    text = models.TextField()
    tips = models.JSONField(default=list, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    # Prompts written by the AI against a student's chosen domains. Shared
    # across students who picked the same set (`topic_key`) so the same
    # question doesn't get paid for twice — §17.3.
    is_generated = models.BooleanField(default=False)
    topics = models.JSONField(default=list, blank=True)
    topic_key = models.CharField(max_length=200, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["mode", "level", "is_active"]),
            models.Index(fields=["mode", "level", "topic_key"]),
        ]

    def __str__(self):
        return f"{self.mode} L{self.level}: {self.text[:48]}"


class AssessmentSession(models.Model):
    """LLD §5.3."""

    class Status(models.TextChoices):
        RECORDING = "recording", "Recording"
        SUBMITTED = "submitted", "Submitted"
        PROCESSING = "processing", "Processing"
        COMPLETE = "complete", "Complete"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assessment_sessions")
    mode = models.CharField(max_length=10, choices=Mode.choices)
    is_baseline = models.BooleanField(default=True)
    prompt = models.ForeignKey(Prompt, on_delete=models.PROTECT, related_name="sessions")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.RECORDING)
    media_url = models.TextField(blank=True)  # servable URL, for playback (LLD §5.3)
    media_key = models.TextField(blank=True)  # storage key, for re-reading the bytes to transcribe
    transcript = models.TextField(blank=True)
    raw_response = models.JSONField(default=dict, blank=True)
    # Work in progress, saved as the student goes. An assessment they walked
    # away from must still be there when they come back, so nothing is thrown
    # away until they actually submit.
    draft = models.JSONField(default=dict, blank=True)
    # Client-observed integrity signals (paste events, tab switches, time
    # spent off-page). Evidence for the authenticity read, never a verdict on
    # its own — see analysis.authenticity.
    integrity_signals = models.JSONField(default=dict, blank=True)
    duration_seconds = models.IntegerField(default=0)
    error = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "mode", "is_baseline"]),
            models.Index(fields=["status", "started_at"]),
        ]
        ordering = ["-started_at"]
        constraints = [
            # A student can only have one assessment of a mode open at a time.
            # Without this, two near-simultaneous starts (a double-click, a
            # retry, React's development double-mount) both find nothing open
            # and both create a session — and the autosaved draft then lands
            # on whichever one the next resume doesn't return.
            models.UniqueConstraint(
                fields=["user", "mode", "is_baseline"],
                condition=models.Q(status="recording"),
                name="one_open_session_per_mode",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} {self.mode} {self.status}"
