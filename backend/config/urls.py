from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.content.review_views import DimensionProgressView as ProgressView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/assessment/", include("apps.assessments.urls")),
    path("api/feedback/", include("apps.feedback.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/path/", include("apps.learning_path.urls")),
    path("api/dashboard/", include("apps.dashboard.urls")),
    path("api/gamification/", include("apps.gamification.urls")),
    path("api/practice/", include("apps.practice.urls")),
    path("api/reassessment/", include("apps.reassessment.urls")),
    path("api/progress/<str:dimension>", ProgressView.as_view(), name="dimension-progress"),
    path("api/", include("apps.retention.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
