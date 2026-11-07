from django.urls import path

from . import views

urlpatterns = [
    path("<uuid:session_id>", views.FeedbackView.as_view(), name="feedback-detail"),
]
