from rest_framework import serializers

from .models import Bookmark, ContentRecommendation, Resource


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = [
            "id", "type", "title", "source", "url", "youtube_id", "thumbnail_url",
            "duration_minutes", "dimension_tags", "sub_skill_tag", "difficulty_level",
            "summary", "body",
        ]


class RecommendationSerializer(serializers.ModelSerializer):
    resource = ResourceSerializer(read_only=True)

    class Meta:
        model = ContentRecommendation
        fields = ["id", "dimension", "rank", "resource"]


class BookmarkSerializer(serializers.ModelSerializer):
    resource = ResourceSerializer(read_only=True)

    class Meta:
        model = Bookmark
        fields = ["id", "resource", "created_at"]
