import os

from django.conf import settings

from .base import Storage, UploadResult


class LocalFileStorage(Storage):
    """Writes under MEDIA_ROOT, served via Django's static-file server in dev.
    Never used in prod — see S3Storage."""

    def _path_for(self, key: str) -> str:
        path = os.path.join(settings.MEDIA_ROOT, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path

    def save(self, key: str, content: bytes, content_type: str = "application/octet-stream") -> UploadResult:
        with open(self._path_for(key), "wb") as f:
            f.write(content)
        return UploadResult(url=self.url_for(key), key=key)

    def presigned_upload_url(self, key: str, content_type: str, expires_in: int = 300) -> dict:
        # No native presigned-upload concept for local disk — the client
        # uploads the file to our own upload endpoint instead, which then
        # calls .save() directly. Callers should check STORAGE_BACKEND if
        # they need to branch on this, or just always use the returned URL.
        return {"url": f"{settings.MEDIA_URL.rstrip('/')}/uploads/direct", "fields": {"key": key}, "direct": True}

    def read(self, key: str) -> bytes:
        with open(self._path_for(key), "rb") as f:
            return f.read()

    def delete(self, key: str) -> None:
        path = self._path_for(key)
        if os.path.exists(path):
            os.remove(path)

    def url_for(self, key: str) -> str:
        return f"{settings.MEDIA_URL.rstrip('/')}/{key.lstrip('/')}"
