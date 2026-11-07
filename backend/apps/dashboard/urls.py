from django.urls import path

from . import views

urlpatterns = [
    path("summary", views.SummaryView.as_view(), name="dashboard-summary"),
    path("progress", views.ProgressView.as_view(), name="dashboard-progress"),
    path("leaderboard", views.LeaderboardView.as_view(), name="dashboard-leaderboard"),
]
