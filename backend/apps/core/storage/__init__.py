from functools import lru_cache

from django.conf import settings

from .base import Storage, UploadResult  # noqa: F401


@lru_cache(maxsize=1)
def get_storage() -> Storage:
    if settings.STORAGE_BACKEND == "s3":
        from .s3 import S3Storage

        return S3Storage()
    from .local import LocalFileStorage

    return LocalFileStorage()
