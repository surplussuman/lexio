"""
Storage abstraction so the rest of the codebase never imports boto3 or the
filesystem directly. Two implementations: LocalFileStorage (dev default,
backend/media/) and S3Storage (prod). Selected by STORAGE_BACKEND env var —
see config/settings/base.py and CLAUDE.md "Stack & why".
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class UploadResult:
    url: str
    key: str


class Storage(ABC):
    @abstractmethod
    def save(self, key: str, content: bytes, content_type: str = "application/octet-stream") -> UploadResult:
        """Persist `content` under `key`, return its public/servable URL."""

    @abstractmethod
    def presigned_upload_url(self, key: str, content_type: str, expires_in: int = 300) -> dict:
        """Return {"url": ..., "fields": {...}} (or equivalent) the client can
        POST/PUT a file to directly, without proxying bytes through Django."""

    @abstractmethod
    def read(self, key: str) -> bytes:
        """Read back the bytes stored under `key` (used to re-send a
        recording to the STT provider)."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Remove the object at `key`. No-op if it doesn't exist."""

    @abstractmethod
    def url_for(self, key: str) -> str:
        """Public URL for an already-stored key."""
