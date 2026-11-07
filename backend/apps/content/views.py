from django.db.models import F
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Bookmark, Resource
from .serializers import BookmarkSerializer, ResourceSerializer


class ResourceListView(ListAPIView):
    """LLD §15.2 GET /api/content/resources — filterable library browse."""

    serializer_class = ResourceSerializer

    def get_queryset(self):
        queryset = Resource.objects.filter(is_active=True)
        dimension = self.request.query_params.get("dimension")
        resource_type = self.request.query_params.get("type")
        if dimension:
            queryset = queryset.filter(dimension_tags__contains=[dimension])
        if resource_type:
            queryset = queryset.filter(type=resource_type)
        return queryset.order_by("difficulty_level", "title")


class ResourceDetailView(APIView):
    def get(self, request, resource_id):
        try:
            resource = Resource.objects.get(id=resource_id, is_active=True)
        except Resource.DoesNotExist:
            return Response(
                {"error": {"code": "not_found", "message": "Resource not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        Resource.objects.filter(id=resource.id).update(view_count=F("view_count") + 1)
        return Response({"resource": ResourceSerializer(resource).data})


class BookmarkView(APIView):
    def get(self, request):
        bookmarks = Bookmark.objects.filter(user=request.user).select_related("resource")
        return Response({"bookmarks": BookmarkSerializer(bookmarks, many=True).data})

    def post(self, request):
        resource_id = request.data.get("resource_id")
        if not Resource.objects.filter(id=resource_id).exists():
            return Response(
                {"error": {"code": "not_found", "message": "Resource not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        Bookmark.objects.get_or_create(user=request.user, resource_id=resource_id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request):
        Bookmark.objects.filter(user=request.user, resource_id=request.data.get("resource_id")).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
