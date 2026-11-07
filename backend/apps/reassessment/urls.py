from django.urls import path

from . import views

urlpatterns = [
    path("status", views.ReassessmentStatusView.as_view(), name="reassessment-status"),
    path("start", views.StartReassessmentView.as_view(), name="reassessment-start"),
    path("history", views.ReassessmentHistoryView.as_view(), name="reassessment-history"),
    path("<uuid:reassessment_id>/report", views.ReassessmentReportView.as_view(), name="reassessment-report"),
]
