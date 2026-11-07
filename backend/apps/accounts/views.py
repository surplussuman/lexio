from django.conf import settings
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.storage import get_storage

from .serializers import LoginSerializer, ProfileUpdateSerializer, RegisterSerializer, UserSerializer
from .topics import MAX_TOPICS, TOPIC_CATALOG


def _tokens_for(user):
    """LLD §4.3 responses say `{ user, token }`; token is issued as an
    access/refresh pair per §19.1's refresh-token-rotation requirement."""
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class AuthRateThrottle(AnonRateThrottle):
    """LLD §19.1: 10 req/min on auth endpoints, per IP.

    Configurable because the e2e suite registers a fresh user per test from a
    single IP and would otherwise throttle itself. The default is the LLD's
    number — only the test environment raises it.
    """

    scope = "lexio_auth"

    def get_rate(self):
        return settings.AUTH_THROTTLE_RATE


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"user": UserSerializer(user).data, "token": _tokens_for(user)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        user.last_active_at = timezone.now()
        user.save(update_fields=["last_active_at"])
        return Response({"user": UserSerializer(user).data, "token": _tokens_for(user)})


class MeView(APIView):
    def get(self, request):
        return Response({"user": UserSerializer(request.user).data})


class ProfileView(APIView):
    def put(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({"user": UserSerializer(user).data})


class TopicCatalogView(APIView):
    """The domains a student can have their assessment prompts drawn from.
    Served from the backend so the picker and the generator can never drift
    apart on what a valid topic is."""

    def get(self, request):
        return Response(
            {
                "topics": TOPIC_CATALOG,
                "max_topics": MAX_TOPICS,
                "selected": request.user.topic_preferences or [],
            }
        )


class LogoutView(APIView):
    def post(self, request):
        refresh = request.data.get("refresh")
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except Exception:
                pass  # already invalid/expired — logout still succeeds
        return Response(status=status.HTTP_204_NO_CONTENT)


class GoogleOAuthView(APIView):
    """LLD §4.3 GET /api/auth/google — OAuth redirect. Stubbed until
    GOOGLE_OAUTH_CLIENT_ID/SECRET are supplied (see CLAUDE.md credentials
    note); returns 501 rather than silently failing so the frontend can
    detect "not configured yet" instead of erroring on a bad redirect."""

    permission_classes = [AllowAny]

    def get(self, request):
        if not settings.GOOGLE_OAUTH_CLIENT_ID:
            return Response(
                {"error": {"code": "not_configured", "message": "Google OAuth is not configured yet."}},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )
        return redirect("/dashboard")  # real OAuth flow wired in once credentials exist


class AvatarUploadURLView(APIView):
    """Not in the LLD's explicit endpoint list, but required by the
    <AvatarUpload> component (§4.4), which uploads to S3 via a presigned
    URL. Returns a presigned POST in prod, or a direct-upload marker in dev
    (local storage has no presigned-upload concept)."""

    def post(self, request):
        content_type = request.data.get("content_type", "image/png")
        key = f"avatars/{request.user.id}/{timezone.now().timestamp()}.png"
        upload_info = get_storage().presigned_upload_url(key, content_type)
        return Response({"upload": upload_info, "avatar_url": get_storage().url_for(key)})
