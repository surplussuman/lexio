import json

from rest_framework import serializers

from .models import MODE_META, SPEAKING_TARGETS, AssessmentSession, Mode, Prompt


class FlexibleJSONField(serializers.JSONField):
    """Voice modes must submit as multipart (the audio blob), so their
    structured fields arrive as strings rather than decoded JSON. Accept both
    shapes so one serializer covers multipart and JSON bodies alike."""

    def to_internal_value(self, data):
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except ValueError:
                self.fail("invalid")
        return super().to_internal_value(data)


class PromptSerializer(serializers.ModelSerializer):
    """`payload` is sanitised: MCQ answer keys must never reach the client
    before submission, or the assessment is trivially gameable."""

    payload = serializers.SerializerMethodField()

    class Meta:
        model = Prompt
        fields = ["id", "mode", "level", "text", "tips", "payload"]

    def get_payload(self, prompt):
        payload = dict(prompt.payload or {})
        questions = payload.get("questions")
        if questions:
            payload["questions"] = [
                {"id": index, "question": q["question"], "options": q.get("options", [])}
                for index, q in enumerate(questions)
            ]
        return payload


class SessionSerializer(serializers.ModelSerializer):
    prompt = PromptSerializer(read_only=True)
    target_seconds = serializers.SerializerMethodField()

    class Meta:
        model = AssessmentSession
        fields = [
            "id", "mode", "is_baseline", "prompt", "status", "media_url",
            "transcript", "duration_seconds", "draft", "target_seconds",
            "started_at", "submitted_at", "completed_at",
        ]

    def get_target_seconds(self, session):
        """How long they're expected to speak for — shown in the recorder so
        the clock isn't a surprise at scoring time."""
        target = SPEAKING_TARGETS.get(session.mode)
        return target["target_seconds"] if target else None


class SessionListSerializer(serializers.ModelSerializer):
    overall_score = serializers.SerializerMethodField()

    class Meta:
        model = AssessmentSession
        fields = ["id", "mode", "is_baseline", "status", "duration_seconds", "started_at", "completed_at", "overall_score"]

    def get_overall_score(self, session):
        score = getattr(session, "score", None)
        return score.overall_score if score else None


class StartSessionSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=Mode.choices)
    is_baseline = serializers.BooleanField(default=True)
    level = serializers.IntegerField(required=False, min_value=1, max_value=3)


class SubmitSessionSerializer(serializers.Serializer):
    """One of `audio` (voice modes), `text` (write) or `answers` (MCQ modes)
    depending on the mode — validated against the session in the view."""

    session_id = serializers.UUIDField()
    audio = serializers.FileField(required=False)
    text = serializers.CharField(required=False, allow_blank=True)
    answers = serializers.JSONField(required=False)
    duration_seconds = serializers.IntegerField(required=False, min_value=0)
    # Presentation only.
    slide_timings = FlexibleJSONField(required=False)
    visual_metrics = FlexibleJSONField(required=False)
    doubt_questions = FlexibleJSONField(required=False)
    # Group Discussion only — the room's full turn-by-turn log.
    discussion_log = FlexibleJSONField(required=False)
    integrity_signals = FlexibleJSONField(required=False)


class DraftSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    draft = serializers.JSONField()
    integrity_signals = serializers.JSONField(required=False)


class DoubtsRequestSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    slide_timings = FlexibleJSONField(required=False)


class GdTurnRequestSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    history = serializers.ListField(child=serializers.DictField(), required=False)
    event = serializers.ChoiceField(choices=["after_student", "idle_nudge", "continue"], default="continue")


class AbandonSessionSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()


class SpeakRequestSerializer(serializers.Serializer):
    """One spoken line for an AI persona — a GD peer or the Presentation
    follow-up avatar. No session lookup: the line itself, who's saying it
    (gender, for voice choice) and a seed are all a TTS call needs."""

    text = serializers.CharField(max_length=2500)
    gender = serializers.ChoiceField(choices=["male", "female"])
    voice_seed = serializers.CharField(max_length=100, required=False, allow_blank=True)


def mode_catalog() -> list[dict]:
    """LLD §5.1 — the 8 modes with the metadata the onboarding page needs."""
    return [
        {
            "id": mode.value,
            "name": mode.label,
            "duration_minutes": MODE_META[mode]["duration_minutes"],
            "interface": MODE_META[mode]["interface"],
        }
        for mode in Mode
    ]
