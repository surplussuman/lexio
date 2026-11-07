from django.urls import path

from . import views

urlpatterns = [
    path("", views.PathView.as_view(), name="path-detail"),
    path("regenerate", views.RegeneratePathView.as_view(), name="path-regenerate"),
    path("module/<uuid:module_id>", views.ModuleDetailView.as_view(), name="path-module"),
    path("module/<uuid:module_id>/complete", views.CompleteModuleView.as_view(), name="path-module-complete"),
    path("item/<uuid:item_id>/complete", views.CompleteItemView.as_view(), name="path-item-complete"),
]
