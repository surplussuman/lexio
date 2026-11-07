"""
Lexio settings — one file, driven entirely by .env (python-decouple).
Same file runs dev and prod; only the .env values differ (DEBUG, secrets,
allowed hosts, DB/Redis, provider keys). See backend/.env.example.
"""
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

INSTALLED_APPS = [
    # `daphne` must come first: it makes `manage.py runserver` serve ASGI, so
    # the practice WebSockets work in dev without a second server process.
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "channels",
    # lexio apps — one per LLD module, added as each phase starts
    "apps.core",
    "apps.accounts",
    "apps.assessments",
    "apps.analysis",
    "apps.feedback",
    "apps.gamification",
    "apps.content",
    "apps.learning_path",
    "apps.dashboard",
    "apps.practice",
    "apps.reassessment",
    "apps.retention",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="lexio"),
        "USER": config("DB_USER", default="lexio"),
        "PASSWORD": config("DB_PASSWORD", default="lexio"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # `collectstatic` target — nginx serves this in prod
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF / JWT (LLD §15.1, §19.1) ---------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "EXCEPTION_HANDLER": "apps.core.exceptions.lexio_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=7),  # LLD §19.1: 7-day expiry
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# LLD §19.1: 10 req/min on auth endpoints. Raised only by the e2e environment,
# which registers a user per test from one IP. See CLAUDE.md for the open
# question about shared campus IPs.
AUTH_THROTTLE_RATE = config("AUTH_THROTTLE_RATE", default="10/min")

# --- CORS (LLD §19.1) ----------------------------------------------------
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173",
    cast=Csv(),
)
# Only matters for session-cookie-authenticated POSTs (the Django admin) —
# the JWT API itself carries no cookie for CSRF to protect. Empty by default
# since dev never hits /admin over anything but localhost.
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())

# --- Celery + Redis --------------------------------------------------------
REDIS_URL = config("REDIS_URL", default="redis://localhost:6379/1")
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

# --- Lexio provider config (core.storage / core.ai / core.stt / core.tts) --
# See CLAUDE.md "Stack & why" for the reasoning behind each abstraction.
STORAGE_BACKEND = config("STORAGE_BACKEND", default="local")  # local | s3
AWS_ACCESS_KEY_ID = config("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = config("AWS_SECRET_ACCESS_KEY", default="")
AWS_STORAGE_BUCKET_NAME = config("AWS_STORAGE_BUCKET_NAME", default="")
AWS_S3_REGION_NAME = config("AWS_S3_REGION_NAME", default="ap-south-1")
CLOUDFRONT_DOMAIN = config("CLOUDFRONT_DOMAIN", default="")

AI_PROVIDER_PRIMARY = config("AI_PROVIDER_PRIMARY", default="claude")  # claude | gemini | fake
AI_PROVIDER_FALLBACK = config("AI_PROVIDER_FALLBACK", default="gemini")
ANTHROPIC_API_KEY = config("ANTHROPIC_API_KEY", default="")
GEMINI_API_KEY = config("GEMINI_API_KEY", default="")
AI_MODEL_CLAUDE = config("AI_MODEL_CLAUDE", default="claude-sonnet-5")
AI_MODEL_GEMINI = config("AI_MODEL_GEMINI", default="gemini-2.5-flash")

# Analysis runs in a background thread so POST /api/assessment/submit returns
# immediately and the client polls /status, exactly as LLD §5.2 specifies —
# without requiring a separate Celery worker process for local dev. Tests set
# this True to run inline and stay deterministic. Swapping to Celery later
# means replacing one function call in apps/analysis/runner.py.
ANALYSIS_SYNC = config("ANALYSIS_SYNC", default=False, cast=bool)

STT_PROVIDER_PRIMARY = config("STT_PROVIDER_PRIMARY", default="deepgram")  # deepgram | assemblyai
STT_PROVIDER_FALLBACK = config("STT_PROVIDER_FALLBACK", default="assemblyai")
DEEPGRAM_API_KEY = config("DEEPGRAM_API_KEY", default="")
ASSEMBLYAI_API_KEY = config("ASSEMBLYAI_API_KEY", default="")

TTS_PROVIDER_PRIMARY = config("TTS_PROVIDER_PRIMARY", default="sarvam")  # sarvam | openai | elevenlabs | fake
TTS_PROVIDER_FALLBACK = config("TTS_PROVIDER_FALLBACK", default="openai")
SARVAM_API_KEY = config("SARVAM_API_KEY", default="")
OPENAI_API_KEY = config("OPENAI_API_KEY", default="")
ELEVENLABS_API_KEY = config("ELEVENLABS_API_KEY", default="")

YOUTUBE_DATA_API_KEY = config("YOUTUBE_DATA_API_KEY", default="")

GOOGLE_OAUTH_CLIENT_ID = config("GOOGLE_OAUTH_CLIENT_ID", default="")
GOOGLE_OAUTH_CLIENT_SECRET = config("GOOGLE_OAUTH_CLIENT_SECRET", default="")

SENDGRID_API_KEY = config("SENDGRID_API_KEY", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="Lexio <no-reply@lexio.app>")

# --- Production-only hardening, still in this one file ---------------------
if not DEBUG:
    # nginx terminates TLS and proxies to Daphne over plain HTTP — without
    # this, Django sees every request as insecure and SECURE_SSL_REDIRECT
    # loops it back to https:// forever. SECURE_SSL_REDIRECT itself is
    # overridable so a fresh deploy without a cert yet (testing straight
    # against an IP) isn't locked out before one's issued.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
