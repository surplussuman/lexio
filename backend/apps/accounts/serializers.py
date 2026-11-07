from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import User
from .topics import MAX_TOPICS, is_valid_topic


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "email", "name", "avatar_url", "college", "batch_year",
            "role", "onboarding_step", "has_baseline", "total_xp",
            "current_level", "streak_days", "goals", "topic_preferences",
            "created_at",
        ]
        read_only_fields = [
            "id", "role", "onboarding_step", "has_baseline", "total_xp",
            "current_level", "streak_days", "created_at",
        ]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["email", "password", "name", "college", "batch_year"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            self.context["request"], email=attrs["email"], password=attrs["password"]
        )
        if user is None:
            raise serializers.ValidationError("Invalid email or password.", code="invalid_credentials")
        attrs["user"] = user
        return attrs


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["name", "college", "batch_year", "goals", "topic_preferences"]

    def validate_topic_preferences(self, value):
        """Up to three domains, from the catalog or the student's own
        `other:<text>`. These drive every generated prompt, so a malformed
        entry here would show up as a nonsense assessment later."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list of topics.")
        cleaned = []
        for topic in value:
            topic = str(topic).strip()
            if not is_valid_topic(topic):
                raise serializers.ValidationError(f"'{topic}' is not a valid topic.")
            if topic not in cleaned:
                cleaned.append(topic)
        if len(cleaned) > MAX_TOPICS:
            raise serializers.ValidationError(f"Pick at most {MAX_TOPICS} topics.")
        return cleaned
