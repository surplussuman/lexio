"""LLD §21.7 — Echo and daily-challenge endpoints."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analysis.rubrics import DIMENSIONS
from apps.assessments.serializers import PromptSerializer

from .models import DailyChallenge
from .services import daily_message, get_or_create_daily_challenge, refresh_echo


class EchoStateView(APIView):
    """§21.7 GET /api/echo/state."""

    def get(self, request):
        state = refresh_echo(request.user)
        return Response(
            {
                "evolution_stage": state.evolution_stage,
                "relationship_score": state.relationship_score,
                "remembered_weak_points": state.remembered_weak_points,
                "daily_message": daily_message(request.user, state),
            }
        )


class DailyChallengeView(APIView):
    """§21.7 GET /api/daily-challenge — today's Daily Drill Card."""

    def get(self, request):
        challenge = get_or_create_daily_challenge(request.user)
        if challenge is None:
            return Response({"challenge": None, "message": "No drill available — seed the prompt bank."})

        return Response(
            {
                "challenge": {
                    "id": str(challenge.id),
                    "dimension": challenge.dimension,
                    "dimension_label": DIMENSIONS.get(challenge.dimension, challenge.dimension),
                    "mode": challenge.mode,
                    "status": challenge.status,
                    "xp_reward": challenge.xp_reward,
                    "expires_at": challenge.expires_at,
                    "prompt": PromptSerializer(challenge.prompt).data,
                }
            }
        )


class DailyChallengeHistoryView(APIView):
    def get(self, request):
        all_challenges = DailyChallenge.objects.filter(user=request.user)
        return Response(
            {
                "challenges": [
                    {
                        "id": str(c.id),
                        "date": c.date,
                        "dimension": c.dimension,
                        "status": c.status,
                        "xp_reward": c.xp_reward,
                    }
                    for c in all_challenges[:30]
                ],
                "completed_count": all_challenges.filter(status=DailyChallenge.Status.COMPLETE).count(),
            },
            status=status.HTTP_200_OK,
        )
