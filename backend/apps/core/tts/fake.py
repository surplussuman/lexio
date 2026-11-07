from .base import TTSProvider


class FakeProvider(TTSProvider):
    """Used in tests (TTS_PROVIDER_PRIMARY="fake") — deterministic, no network."""

    name = "fake"

    @property
    def is_configured(self) -> bool:
        return True

    def synthesize(self, text: str, *, gender: str, seed: str = "") -> bytes:
        return f"FAKE-AUDIO:{gender}:{seed}:{text}".encode()
