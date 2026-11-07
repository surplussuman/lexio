"""
ASGI config for Lexio. Serves plain HTTP (DRF) and the practice-session
WebSockets (LLD §18.1) from the same process — `manage.py runserver` picks
this up because `daphne` is first in INSTALLED_APPS.
"""
import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Must be initialised before importing anything that touches models.
django_asgi_app = get_asgi_application()

from apps.practice.middleware import JWTAuthMiddleware  # noqa: E402
from apps.practice.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(JWTAuthMiddleware(URLRouter(websocket_urlpatterns))),
    }
)
