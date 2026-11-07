from django.urls import path

from . import views

urlpatterns = [
    path("types", views.SessionTypeListView.as_view(), name="practice-types"),
    path("start", views.StartPracticeView.as_view(), name="practice-start"),
    path("history", views.PracticeHistoryView.as_view(), name="practice-history"),
    path("<uuid:session_id>", views.PracticeDetailView.as_view(), name="practice-detail"),
    path("<uuid:session_id>/end", views.EndPracticeView.as_view(), name="practice-end"),
]
