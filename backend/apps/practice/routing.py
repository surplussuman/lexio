from django.urls import re_path

from .consumers import PracticeConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/practice/(?P<session_id>[0-9a-f-]{36})/$",
        PracticeConsumer.as_asgi(),
        name="practice-ws",
    ),
]
