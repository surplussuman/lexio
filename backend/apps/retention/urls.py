from django.urls import path

from . import views

urlpatterns = [
    path("echo/state", views.EchoStateView.as_view(), name="echo-state"),
    path("daily-challenge", views.DailyChallengeView.as_view(), name="daily-challenge"),
    path("daily-challenge/history", views.DailyChallengeHistoryView.as_view(), name="daily-challenge-history"),
]
