from django.urls import path

from . import views

urlpatterns = [
    path("status", views.StatusView.as_view(), name="gamification-status"),
    path("badges", views.BadgeListView.as_view(), name="gamification-badges"),
    path("leaderboard", views.LeaderboardView.as_view(), name="gamification-leaderboard"),
]
