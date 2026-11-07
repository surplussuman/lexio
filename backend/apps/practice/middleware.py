"""JWT auth for WebSocket connections.

Browsers can't set an Authorization header on a WebSocket handshake, so the
access token travels as a query parameter — the standard approach, and safe
here because the connection is same-origin and (in production) wss://.
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _user_from_token(raw_token: str):
    from rest_framework_simplejwt.exceptions import TokenError
    from rest_framework_simplejwt.tokens import AccessToken

    from apps.accounts.models import User

    try:
        token = AccessToken(raw_token)
        return User.objects.get(id=token["user_id"])
    except (TokenError, KeyError, User.DoesNotExist):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs((scope.get("query_string") or b"").decode())
        raw_token = (query.get("token") or [None])[0]
        scope["user"] = await _user_from_token(raw_token) if raw_token else AnonymousUser()
        return await super().__call__(scope, receive, send)
