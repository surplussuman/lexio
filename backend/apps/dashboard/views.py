"""LLD §7.3 — dashboard aggregation. Read-only; no models of its own."""
import hashlib

from django.core.cache import cache
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.analysis.aggregates import composite_score, daily_progress, latest_dimension_scores
from apps.analysis.overview import is_baseline_complete
from apps.analysis.rubrics import DIMENSIONS
from apps.assessments.models import Mode
from apps.gamification.services import level_for_xp, xp_to_next_level
from apps.learning_path.models import LearningModule, LearningPath, LearningPathItem

LEADERBOARD_TTL_SECONDS = 300  # LLD §7.2: Redis cache, 5 min TTL


class SummaryView(APIView):
    def get(self, request):
        user = request.user
        level, title = level_for_xp(user.total_xp)

        # Per-assessment results are withheld until the whole baseline is
        # done (apps.analysis.overview) — the dashboard is where that leaked
        # first: a single completed mode used to fill in the composite score,
        # the dimension bars, the recommended path and Echo's targeted drill,
        # all inferred from one data point before the picture was complete.
        # `modes_completed`/`modes_total` stay visible either way — that's
        # progress, not a result.
        baseline_complete = is_baseline_complete(user)
        dimension_scores = latest_dimension_scores(user) if baseline_complete else {}

        return Response(
            {
                "baseline_complete": baseline_complete,
                "overall_score": composite_score(dimension_scores) if baseline_complete else None,
                "dimension_scores": dimension_scores,
                "dimension_labels": DIMENSIONS,
                "level": level,
                "level_title": title,
                "xp_to_next_level": xp_to_next_level(user.total_xp),
                "total_xp": user.total_xp,
                "streak_days": user.streak_days,
                "modes_completed": _modes_completed(user),
                "modes_total": len(Mode.choices),
                "todays_tasks": _todays_tasks(user) if baseline_complete else [],
                "recent_badges": [],  # M9 badges land in Phase 3
            }
        )


class ProgressView(APIView):
    def get(self, request):
        days = min(int(request.query_params.get("days", 30)), 365)
        return Response({"data_points": daily_progress(request.user, days)})


class LeaderboardView(APIView):
    """LLD §7.2 — cohort leaderboard by college batch, Redis-cached."""

    def get(self, request):
        user = request.user
        # Hashed because a college name can contain spaces/punctuation, which
        # aren't valid in a cache key for every backend.
        scope = f"{user.college or 'all'}:{user.batch_year or 'all'}"
        cache_key = f"leaderboard:{hashlib.sha1(scope.encode()).hexdigest()[:16]}"
        rankings = cache.get(cache_key)

        if rankings is None:
            peers = User.objects.filter(is_active=True)
            if user.college:
                peers = peers.filter(college=user.college)
            if user.batch_year:
                peers = peers.filter(batch_year=user.batch_year)
            rankings = [
                {
                    "rank": index + 1,
                    "id": str(peer.id),
                    "name": peer.name or peer.email.split("@")[0],
                    "xp": peer.total_xp,
                    "avatar_url": peer.avatar_url,
                }
                for index, peer in enumerate(peers.order_by("-total_xp", "created_at")[:10])
            ]
            cache.set(cache_key, rankings, LEADERBOARD_TTL_SECONDS)

        # The top-10 is cached for 5 minutes (§7.2), so a student who just
        # earned XP can be missing from it. Their own row is computed fresh and
        # appended, rather than leaving them unable to find themselves.
        your_row = next((row for row in rankings if row["id"] == str(user.id)), None)
        if your_row is None:
            your_row = {
                "rank": self._rank_of(user) ,
                "id": str(user.id),
                "name": user.name or user.email.split("@")[0],
                "xp": user.total_xp,
                "avatar_url": user.avatar_url,
            }

        return Response(
            {
                "rankings": rankings,
                "your_row": your_row,
                "in_top_ranks": any(row["id"] == str(user.id) for row in rankings),
                "scope": {"college": user.college, "batch_year": user.batch_year},
                "current_user_id": str(user.id),
            }
        )

    @staticmethod
    def _rank_of(user) -> int:
        peers = User.objects.filter(is_active=True, total_xp__gt=user.total_xp)
        if user.college:
            peers = peers.filter(college=user.college)
        if user.batch_year:
            peers = peers.filter(batch_year=user.batch_year)
        return peers.count() + 1


def _modes_completed(user) -> int:
    from apps.assessments.models import AssessmentSession

    return (
        AssessmentSession.objects.filter(user=user, status=AssessmentSession.Status.COMPLETE)
        .values("mode")
        .distinct()
        .count()
    )


def _todays_tasks(user) -> list[dict]:
    """LLD §7.2 — the next three pending items on the active path."""
    path = LearningPath.objects.filter(user=user).first()
    if path is None:
        return []

    items = (
        LearningPathItem.objects.filter(
            module__path=path,
            status=LearningPathItem.Status.PENDING,
            module__status__in=[LearningModule.Status.AVAILABLE, LearningModule.Status.IN_PROGRESS],
        )
        .select_related("resource", "module")
        .order_by("module__order_index", "order_index")[:3]
    )

    return [
        {
            "item_id": str(item.id),
            "module_id": str(item.module_id),
            "module_title": item.module.title,
            "dimension": item.module.dimension,
            "title": item.resource.title,
            "type": item.resource.type,
            "duration_minutes": item.resource.duration_minutes,
        }
        for item in items
    ]
