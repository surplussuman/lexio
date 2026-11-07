"""LLD §8.4 — practice REST endpoints. The live loop runs over the WebSocket
(consumers.py); these cover start, end and browsing session types."""
import random

from rest_framework import serializers, status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assessments.models import Prompt

from .models import SESSION_TYPE_META, PracticeSession, SessionType
from .services import end_session, mode_for, opening_line


class PracticeSessionSerializer(serializers.ModelSerializer):
    overall_score = serializers.SerializerMethodField()
    narrative = serializers.SerializerMethodField()
    dimension_scores = serializers.SerializerMethodField()
    annotations = serializers.SerializerMethodField()

    class Meta:
        model = PracticeSession
        fields = [
            "id", "session_type", "mode", "topic", "status", "transcript", "turns",
            "coaching_nudges", "session_metrics", "question_count", "xp_awarded",
            "error", "started_at", "ended_at",
            "overall_score", "dimension_scores", "narrative", "annotations",
        ]

    def _score(self, session):
        return getattr(session, "score", None)

    def get_overall_score(self, session):
        score = self._score(session)
        return score.overall_score if score else None

    def get_dimension_scores(self, session):
        score = self._score(session)
        return score.dimension_scores if score else {}

    def get_narrative(self, session):
        score = self._score(session)
        return score.feedback_narrative if score else ""

    def get_annotations(self, session):
        score = self._score(session)
        return score.annotations if score else []


class SessionTypeListView(APIView):
    """LLD §8.4 GET /api/practice/prompts/:type is folded in here: the catalog
    carries a sample topic per type so the launcher can show one."""

    def get(self, request):
        types = []
        for session_type in SessionType:
            meta = SESSION_TYPE_META[session_type]
            types.append(
                {
                    "id": session_type.value,
                    "title": meta["title"],
                    "blurb": meta["blurb"],
                    "multi_turn": meta["multi_turn"],
                    "mode": mode_for(session_type.value),
                }
            )
        return Response({"session_types": types})


class StartPracticeView(APIView):
    def post(self, request):
        session_type = request.data.get("session_type")
        if session_type not in SessionType.values:
            return Response(
                {"error": {"code": "unknown_type", "message": f"Unknown session type '{session_type}'."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mode = mode_for(session_type)
        topic = (request.data.get("topic") or "").strip()
        prompt = None
        if not topic:
            prompt = _random_prompt(mode)
            topic = prompt.text if prompt else "Tell me about a challenge you handled recently."

        session = PracticeSession.objects.create(
            user=request.user, session_type=session_type, mode=mode, prompt=prompt, topic=topic
        )
        try:
            opener = opening_line(session)
        except Exception:
            opener = f"Take a moment, then start whenever you're ready: {topic}"

        session.refresh_from_db()
        return Response(
            {"session": PracticeSessionSerializer(session).data, "opening_line": opener},
            status=status.HTTP_201_CREATED,
        )


class EndPracticeView(APIView):
    """Fallback for clients that lose the socket — ending over WebSocket is
    the normal path."""

    def post(self, request, session_id):
        session = PracticeSession.objects.filter(id=session_id, user=request.user).first()
        if session is None:
            return Response(
                {"error": {"code": "not_found", "message": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if session.status != PracticeSession.Status.ACTIVE:
            return Response({"session": PracticeSessionSerializer(session).data})

        session = end_session(session, request.data.get("metrics") or {})
        return Response({"session": PracticeSessionSerializer(session).data})


class PracticeDetailView(APIView):
    def get(self, request, session_id):
        session = (
            PracticeSession.objects.filter(id=session_id, user=request.user).select_related("score").first()
        )
        if session is None:
            return Response(
                {"error": {"code": "not_found", "message": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"session": PracticeSessionSerializer(session).data})


class PracticeHistoryView(ListAPIView):
    serializer_class = PracticeSessionSerializer

    def get_queryset(self):
        return PracticeSession.objects.filter(user=self.request.user).select_related("score")


def _random_prompt(mode):
    prompts = list(Prompt.objects.filter(mode=mode, is_active=True))
    return random.choice(prompts) if prompts else None
