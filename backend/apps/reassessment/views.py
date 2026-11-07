"""LLD §13.5 — reassessment API."""
from rest_framework import serializers, status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analysis.rubrics import DIMENSIONS
from apps.learning_path.models import LearningModule, LearningPath

from .models import Reassessment
from .services import (
    can_request_manually,
    highlight_moments,
    outstanding_modes,
    should_auto_nudge,
    start_reassessment,
    try_complete,
)


class ReassessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reassessment
        fields = [
            "id", "status", "triggered_by", "baseline_snapshot", "new_scores", "delta_scores",
            "overall_before", "overall_after", "overall_delta", "improvement_narrative",
            "required_modes", "started_at", "completed_at",
        ]


class StartReassessmentView(APIView):
    """§13.5 POST /api/reassessment/start."""

    def post(self, request):
        active = Reassessment.objects.filter(
            user=request.user, status=Reassessment.Status.IN_PROGRESS
        ).first()
        if active:
            return Response(
                {
                    "reassessment": ReassessmentSerializer(active).data,
                    "outstanding_modes": outstanding_modes(active),
                    "resumed": True,
                }
            )

        allowed, message = can_request_manually(request.user)
        if not allowed:
            return Response(
                {"error": {"code": "cooldown", "message": message}},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        reassessment = start_reassessment(request.user, Reassessment.TriggeredBy.MANUAL)
        return Response(
            {
                "reassessment": ReassessmentSerializer(reassessment).data,
                "outstanding_modes": outstanding_modes(reassessment),
                "resumed": False,
            },
            status=status.HTTP_201_CREATED,
        )


class ReassessmentStatusView(APIView):
    """What the /reassessment launcher needs: whether one is running, whether
    the student is eligible, and why it's being suggested."""

    def get(self, request):
        active = Reassessment.objects.filter(
            user=request.user, status=Reassessment.Status.IN_PROGRESS
        ).first()

        # Reading this endpoint is what finishes a cycle whose last mode was
        # just submitted. When that happens the student must be pointed at the
        # report they've earned — landing them back on a "start one" screen
        # would lose it.
        just_completed = None
        if active:
            active = try_complete(active)
            if active.status == Reassessment.Status.COMPLETE:
                just_completed = active
                active = None

        allowed, message = can_request_manually(request.user)
        path = LearningPath.objects.filter(user=request.user).first()
        path_complete = bool(
            path
            and path.total_modules
            and path.completed_modules == path.total_modules
        )

        return Response(
            {
                "active": ReassessmentSerializer(active).data if active else None,
                "outstanding_modes": outstanding_modes(active) if active else [],
                "just_completed": ReassessmentSerializer(just_completed).data if just_completed else None,
                "can_request": allowed,
                "cooldown_message": message,
                "path_complete": path_complete,
                "auto_nudge": should_auto_nudge(request.user),
            }
        )


class ReassessmentReportView(APIView):
    """§13.5 GET /api/reassessment/:id/report."""

    def get(self, request, reassessment_id):
        reassessment = Reassessment.objects.filter(id=reassessment_id, user=request.user).first()
        if reassessment is None:
            return Response(
                {"error": {"code": "not_found", "message": "Reassessment not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        reassessment = try_complete(reassessment)
        if reassessment.status != Reassessment.Status.COMPLETE:
            return Response(
                {
                    "error": {
                        "code": "not_ready",
                        "message": "Finish every mode in this reassessment to see the report.",
                        "details": {"outstanding_modes": outstanding_modes(reassessment)},
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            {
                "reassessment": ReassessmentSerializer(reassessment).data,
                "highlights": highlight_moments(reassessment.delta_scores),
                "dimension_labels": DIMENSIONS,
                "new_path_preview": self._path_preview(request.user),
            }
        )

    @staticmethod
    def _path_preview(user):
        """§13.4 — a peek at the path regenerated from the new scores."""
        modules = (
            LearningModule.objects.filter(path__user=user)
            .exclude(status=LearningModule.Status.COMPLETE)
            .order_by("order_index")[:3]
        )
        return [
            {"id": str(m.id), "title": m.title, "dimension": m.dimension, "estimated_minutes": m.estimated_minutes}
            for m in modules
        ]


class ReassessmentHistoryView(ListAPIView):
    serializer_class = ReassessmentSerializer

    def get_queryset(self):
        return Reassessment.objects.filter(user=self.request.user)
