"""LLD §10.4 — the learning path API."""
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analysis.overview import is_baseline_complete
from apps.content.attribution import log_event, record_consumption
from apps.content.attribution_models import ProgressEvent
from apps.content.serializers import ResourceSerializer
from apps.gamification.badges import evaluate_badges
from apps.gamification.services import award_xp, record_item_activity

from .models import LearningModule, LearningPath, LearningPathItem
from .services import generate_path, refresh_module_progress, try_complete_module

PATH_LOCKED_MESSAGE = "Your path unlocks once all eight baseline assessments are done — it needs the full picture, not just one mode."

XP_ITEM_COMPLETE = 15  # LLD §12.1 "mark a resource complete"


class ItemSerializer(serializers.ModelSerializer):
    resource = ResourceSerializer(read_only=True)

    class Meta:
        model = LearningPathItem
        fields = ["id", "order_index", "status", "completed_at", "resource"]


class ModuleSerializer(serializers.ModelSerializer):
    items = ItemSerializer(many=True, read_only=True)
    mastery_threshold = serializers.IntegerField(source="definition.mastery_threshold", read_only=True)

    class Meta:
        model = LearningModule
        fields = [
            "id", "title", "description", "dimension", "order_index", "status",
            "progress_pct", "xp_reward", "estimated_minutes", "gap_score",
            "mastery_threshold", "completed_at", "items",
        ]


class PathView(APIView):
    def get(self, request):
        # A path can exist from before this gate (or from a mid-baseline
        # generation that has since been superseded) without covering every
        # dimension yet — hide it rather than show a partial read, same rule
        # the baseline report itself follows (analysis/overview.py).
        if not is_baseline_complete(request.user):
            return Response({"path": None, "message": PATH_LOCKED_MESSAGE})

        path = LearningPath.objects.filter(user=request.user).first()
        if path is None:
            path = generate_path(request.user)
        if path is None:
            return Response(
                {
                    "path": None,
                    "message": "Complete at least one assessment and your path will be generated.",
                }
            )
        modules = path.modules.select_related("definition").prefetch_related("items__resource")
        return Response(
            {
                "path": {
                    "id": str(path.id),
                    "generated_at": path.generated_at,
                    "last_updated_at": path.last_updated_at,
                    "total_modules": path.total_modules,
                    "completed_modules": path.completed_modules,
                    "modules": ModuleSerializer(modules, many=True).data,
                }
            }
        )


class ModuleDetailView(APIView):
    def get(self, request, module_id):
        module = _get_module(request.user, module_id)
        if module is None:
            return _not_found()
        return Response({"module": ModuleSerializer(module).data})


class CompleteItemView(APIView):
    def post(self, request, item_id):
        item = LearningPathItem.objects.filter(id=item_id, module__path__user=request.user).select_related(
            "module"
        ).first()
        if item is None:
            return _not_found()

        awarded = 0
        if item.status != LearningPathItem.Status.COMPLETE:
            item.status = LearningPathItem.Status.COMPLETE
            item.completed_at = timezone.now()
            item.save(update_fields=["status", "completed_at"])
            award_xp(request.user, XP_ITEM_COMPLETE)
            record_item_activity(request.user)  # §12.4: keeps the streak alive
            # §22.5: finishing an item is a full consumption of that resource.
            record_consumption(
                request.user, item.resource, item.module.dimension, int(request.data.get("consumed_pct", 100))
            )
            awarded = XP_ITEM_COMPLETE

        refresh_module_progress(item.module)
        return Response({"item": ItemSerializer(item).data, "xp_awarded": awarded})


class CompleteModuleView(APIView):
    """Mastery-gated (LLD §22.2): consuming the content isn't enough on its
    own — a later session in the dimension must clear the threshold."""

    def post(self, request, module_id):
        module = _get_module(request.user, module_id)
        if module is None:
            return _not_found()
        if module.status == LearningModule.Status.COMPLETE:
            return Response({"completed": True, "message": "Already mastered.", "xp_awarded": 0})

        completed, message = try_complete_module(module)
        awarded = 0
        if completed:
            award_xp(request.user, module.xp_reward)
            awarded = module.xp_reward
            evaluate_badges(request.user)  # e.g. "Foundations" on a first mastery
            log_event(
                request.user,
                dimension=module.dimension,
                event_type=ProgressEvent.EventType.MODULE_MASTERED,
                ref_id=module.id,
                label=module.title,
            )

        # 200 even when the gate refuses: the server was asked "have I
        # mastered this?" and answered "not yet, here's why". That's a
        # successful evaluation carrying domain data the UI shows inline —
        # not an error, so it doesn't use the §15.1 error envelope.
        return Response(
            {
                "completed": completed,
                "message": message,
                "xp_awarded": awarded,
                "module": ModuleSerializer(_get_module(request.user, module_id)).data,
            }
        )


class RegeneratePathView(APIView):
    def post(self, request):
        if not is_baseline_complete(request.user):
            return Response(
                {"error": {"code": "baseline_incomplete", "message": PATH_LOCKED_MESSAGE}},
                status=status.HTTP_409_CONFLICT,
            )
        path = generate_path(request.user, force=True)
        if path is None:
            return Response(
                {"error": {"code": "no_scores", "message": "Complete an assessment first."}},
                status=status.HTTP_409_CONFLICT,
            )
        return Response({"regenerated": True, "total_modules": path.total_modules})


def _get_module(user, module_id):
    return (
        LearningModule.objects.filter(id=module_id, path__user=user)
        .select_related("definition", "path")
        .prefetch_related("items__resource")
        .first()
    )


def _not_found():
    return Response(
        {"error": {"code": "not_found", "message": "Not found."}}, status=status.HTTP_404_NOT_FOUND
    )
