"""Module 12 endpoints: consumption tracking, per-dimension progress (§22.3),
and the content-ops review queue (§22.1)."""
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.analysis.aggregates import latest_dimension_scores
from apps.analysis.rubrics import DIMENSIONS

from .attribution import dimension_timeline, format_affinity, record_consumption
from .attribution_models import AttributionRecord, ContentCandidate
from .models import Resource


class IsAdmin(BasePermission):
    """§22.1 requires a human content-ops reviewer; only admins qualify."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN)


class ConsumptionView(APIView):
    def post(self, request):
        resource = Resource.objects.filter(id=request.data.get("resource_id")).first()
        if resource is None:
            return Response(
                {"error": {"code": "not_found", "message": "Resource not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        dimension = request.data.get("dimension") or (resource.dimension_tags or [""])[0]
        consumption = record_consumption(
            request.user, resource, dimension, int(request.data.get("consumed_pct", 100))
        )
        return Response(
            {"consumed_pct": consumption.consumed_pct, "dimension": consumption.dimension},
            status=status.HTTP_201_CREATED,
        )


class DimensionProgressView(APIView):
    """§22.3 GET /api/progress/:dimension — a skill-specific timeline,
    distinct from the composite 30-day chart on the dashboard."""

    def get(self, request, dimension):
        if dimension not in DIMENSIONS:
            return Response(
                {"error": {"code": "unknown_dimension", "message": f"Unknown dimension '{dimension}'."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        attributions = AttributionRecord.objects.filter(user=request.user, dimension=dimension)
        return Response(
            {
                "dimension": dimension,
                "label": DIMENSIONS[dimension],
                "current_score": latest_dimension_scores(request.user).get(dimension),
                "timeline": dimension_timeline(request.user, dimension),
                "attributions": [
                    {
                        "score_before": record.score_before,
                        "score_after": record.score_after,
                        "delta": record.delta,
                        "resource_count": len(record.contributing_resource_ids),
                        "created_at": record.created_at,
                    }
                    for record in attributions
                ],
                # Stated plainly because the LLD insists it must not read as proof.
                "caveat": (
                    "These links are correlational, not proof. Repetition and ordinary practice "
                    "move scores too."
                ),
                "format_affinity": format_affinity(request.user),
            }
        )


class CandidateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentCandidate
        fields = [
            "id", "source", "proposed_by", "title", "url", "youtube_id", "duration_minutes",
            "summary", "dimension_tags", "sub_skill_tag", "difficulty_level",
            "review_status", "review_note", "reviewed_at", "created_at",
        ]


class CandidateQueueView(APIView):
    """§22.1 — the review queue. No candidate becomes a live resource without
    passing through here."""

    permission_classes = [IsAdmin]

    def get(self, request):
        queryset = ContentCandidate.objects.all()
        review_status = request.query_params.get("status", ContentCandidate.ReviewStatus.PENDING)
        if review_status != "all":
            queryset = queryset.filter(review_status=review_status)
        return Response({"candidates": CandidateSerializer(queryset, many=True).data})

    def post(self, request):
        serializer = CandidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        candidate = serializer.save(proposed_by=ContentCandidate.ProposedBy.MANUAL)
        return Response({"candidate": CandidateSerializer(candidate).data}, status=status.HTTP_201_CREATED)


class CandidateReviewView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, candidate_id):
        candidate = ContentCandidate.objects.filter(id=candidate_id).first()
        if candidate is None:
            return Response(
                {"error": {"code": "not_found", "message": "Candidate not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        decision = request.data.get("decision")
        if decision not in (ContentCandidate.ReviewStatus.APPROVED, ContentCandidate.ReviewStatus.REJECTED):
            return Response(
                {"error": {"code": "invalid_decision", "message": "Decision must be 'approved' or 'rejected'."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        candidate.review_status = decision
        candidate.review_note = request.data.get("note", "")
        candidate.reviewed_by = request.user
        candidate.reviewed_at = timezone.now()

        if decision == ContentCandidate.ReviewStatus.APPROVED and candidate.promoted_resource is None:
            candidate.promoted_resource = Resource.objects.create(
                type=Resource.Type.VIDEO if candidate.youtube_id else Resource.Type.ARTICLE,
                title=candidate.title,
                source=candidate.get_source_display(),
                url=candidate.url,
                youtube_id=candidate.youtube_id,
                thumbnail_url=(
                    f"https://img.youtube.com/vi/{candidate.youtube_id}/hqdefault.jpg"
                    if candidate.youtube_id
                    else ""
                ),
                duration_minutes=candidate.duration_minutes,
                dimension_tags=candidate.dimension_tags,
                sub_skill_tag=candidate.sub_skill_tag,
                difficulty_level=candidate.difficulty_level,
                summary=candidate.summary,
            )

        candidate.save()
        return Response(
            {
                "candidate": CandidateSerializer(candidate).data,
                "promoted_resource_id": str(candidate.promoted_resource_id) if candidate.promoted_resource_id else None,
            }
        )
