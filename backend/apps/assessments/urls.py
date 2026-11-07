from django.urls import path

from . import views

urlpatterns = [
    path("modes", views.ModeListView.as_view(), name="assessment-modes"),
    path("prompt/<str:mode>", views.PromptView.as_view(), name="assessment-prompt"),
    path("start", views.StartSessionView.as_view(), name="assessment-start"),
    path("draft", views.SaveDraftView.as_view(), name="assessment-draft"),
    path("present/doubts", views.PresentationDoubtsView.as_view(), name="assessment-present-doubts"),
    path("gd/turn", views.GdTurnView.as_view(), name="assessment-gd-turn"),
    path("tts/speak", views.SpeakView.as_view(), name="assessment-tts-speak"),
    path("abandon", views.AbandonSessionView.as_view(), name="assessment-abandon"),
    path("submit", views.SubmitSessionView.as_view(), name="assessment-submit"),
    path("report", views.BaselineReportView.as_view(), name="assessment-report"),
    path("history", views.SessionHistoryView.as_view(), name="assessment-history"),
    path("<uuid:session_id>/status", views.SessionStatusView.as_view(), name="assessment-status"),
]
