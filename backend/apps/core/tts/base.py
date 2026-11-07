"""TTS provider interface. Call sites never import a vendor SDK directly —
they go through `apps.core.tts.tts()` (see __init__.py)."""
from abc import ABC, abstractmethod


class TTSProvider(ABC):
    name: str

    @abstractmethod
    def synthesize(self, text: str, *, gender: str, seed: str = "") -> bytes:
        """One spoken line as encoded audio bytes (mp3). `gender` picks the
        voice pool ("male"/"female"); `seed` keeps the same persona on the
        same voice across calls within a session without the caller needing
        to know which voice that is."""

    @property
    def is_configured(self) -> bool:
        """False when the API key is missing — the router skips to the next
        provider rather than failing."""
        return True
