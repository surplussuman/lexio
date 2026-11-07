from django.urls import path

from . import review_views, views

urlpatterns = [
    path("resources", views.ResourceListView.as_view(), name="content-resources"),
    path("resources/<uuid:resource_id>", views.ResourceDetailView.as_view(), name="content-resource-detail"),
    path("bookmark", views.BookmarkView.as_view(), name="content-bookmark"),
    path("consumption", review_views.ConsumptionView.as_view(), name="content-consumption"),
    # §22.1 content-ops review queue (admin only)
    path("candidates", review_views.CandidateQueueView.as_view(), name="content-candidates"),
    path("candidates/<uuid:candidate_id>/review", review_views.CandidateReviewView.as_view(), name="content-candidate-review"),
]
