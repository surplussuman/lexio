"""LLD §9.4 — GET /api/feedback/:session_id returns everything the feedback
page renders: session, scores, annotations, transcript, narrative, and the
delta against the student's previous session in the same mode."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analysis.models import SessionScore
from apps.analysis.overview import is_baseline_complete
from apps.analysis.rubrics import DIMENSIONS
from apps.assessments.models import AssessmentSession
from apps.assessments.serializers import SessionSerializer
from apps.content.models import ContentRecommendation
from apps.content.serializers import RecommendationSerializer


class FeedbackView(APIView):
    def get(self, request, session_id):
        try:
            session = AssessmentSession.objects.select_related("prompt", "score").get(
                id=session_id, user=request.user
            )
        except AssessmentSession.DoesNotExist:
            return Response(
                {"error": {"code": "not_found", "message": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        score = getattr(session, "score", None)
        if score is None:
            return Response(
                {"error": {"code": "not_ready", "message": "This session has not been analysed yet."}},
                status=status.HTTP_409_CONFLICT,
            )

        # Baseline feedback is held back until every mode is done — a single
        # mode's report in isolation is the thing that sends students into
        # retaking one assessment instead of finishing the picture. Sessions
        # outside the baseline (reassessment, practice) are unaffected.
        if session.is_baseline and not is_baseline_complete(request.user):
            return Response(
                {
                    "error": {
                        "code": "reports_locked",
                        "message": "Your reports unlock when all eight baseline assessments are done.",
                    }
                },
                status=status.HTTP_423_LOCKED,
            )

        return Response(
            {
                "session": SessionSerializer(session).data,
                "score": {
                    "overall_score": score.overall_score,
                    "dimension_scores": score.dimension_scores,
                    "audio_features": score.audio_features,
                    "answer_breakdown": score.answer_breakdown,
                    "authenticity": score.authenticity,
                    "timing": score.timing,
                    "visual_metrics": score.visual_metrics,
                    "slide_coverage": score.slide_coverage,
                    "narrative": score.feedback_narrative,
                    "created_at": score.created_at,
                },
                "annotations": score.annotations,
                "transcript": session.transcript,
                "delta": self._delta(request.user, session, score),
                "dimension_labels": DIMENSIONS,
                "resources": RecommendationSerializer(
                    ContentRecommendation.objects.filter(session=session).select_related("resource"),
                    many=True,
                ).data,
            }
        )

    @staticmethod
    def _delta(user, session, score):
        previous = (
            SessionScore.objects.filter(user=user, session__mode=session.mode)
            .exclude(session_id=session.id)
            .filter(created_at__lt=score.created_at)
            .order_by("-created_at")
            .first()
        )
        if previous is None:
            return None
        return {
            "overall": score.overall_score - previous.overall_score,
            "dimensions": {
                dimension: value - previous.dimension_scores.get(dimension, value)
                for dimension, value in score.dimension_scores.items()
            },
        }
