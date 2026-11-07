"""LLD §12.5 — the gamification API."""
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.dashboard.views import LeaderboardView  # §12.5 and §7.3 are the same leaderboard

from .models import Badge, UserBadge
from .services import LEVELS, level_for_xp, xp_to_next_level

__all__ = ["StatusView", "BadgeListView", "LeaderboardView"]


class StatusView(APIView):
    def get(self, request):
        user = request.user
        level, title = level_for_xp(user.total_xp)
        earned = list(
            UserBadge.objects.filter(user=user).select_related("badge").order_by("-earned_at")
        )
        held_keys = {row.badge.key for row in earned}
        next_badge = Badge.objects.exclude(key__in=held_keys).first()

        return Response(
            {
                "level": level,
                "level_title": title,
                "total_xp": user.total_xp,
                "xp_to_next_level": xp_to_next_level(user.total_xp),
                "streak_days": user.streak_days,
                "streak_freezes": user.streak_freezes,
                "badges_earned": [
                    {
                        "key": row.badge.key,
                        "name": row.badge.name,
                        "description": row.badge.description,
                        "icon": row.badge.icon,
                        "earned_at": row.earned_at,
                    }
                    for row in earned
                ],
                "next_badge": (
                    {"key": next_badge.key, "name": next_badge.name, "description": next_badge.description}
                    if next_badge
                    else None
                ),
                "levels": [{"level": lvl, "title": t, "xp_required": xp} for lvl, t, xp in LEVELS],
            }
        )


class BadgeListView(APIView):
    """All badge definitions with earned/locked status (LLD §12.5)."""

    def get(self, request):
        earned_at_by_key = {
            row.badge.key: row.earned_at
            for row in UserBadge.objects.filter(user=request.user).select_related("badge")
        }
        return Response(
            {
                "badges": [
                    {
                        "key": badge.key,
                        "name": badge.name,
                        "description": badge.description,
                        "icon": badge.icon,
                        "earned": badge.key in earned_at_by_key,
                        "earned_at": earned_at_by_key.get(badge.key),
                    }
                    for badge in Badge.objects.all()
                ]
            }
        )
