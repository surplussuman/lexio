"""Entry point for speech-to-text: `from apps.core.stt import stt`.

Same primary/fallback pattern as apps.core.ai. Deepgram is named as primary
in the LLD/settings but has no adapter yet (no API key to build or test
against) — the router simply skips any provider it can't build or that has
no key, so AssemblyAI serves today and Deepgram slots in later.
"""
import logging

from django.conf import settings

from .base import STTProvider, Transcript, Word  # noqa: F401

logger = logging.getLogger(__name__)


class STTUnavailable(RuntimeError):
    pass


def _build(name: str) -> STTProvider | None:
    if name == "assemblyai":
        from .assemblyai import AssemblyAIProvider

        return AssemblyAIProvider()
    if name == "fake":
        from .fake import FakeProvider

        return FakeProvider()
    return None


class _STT:
    def transcribe(self, audio: bytes, content_type: str = "audio/webm") -> Transcript:
        names = [settings.STT_PROVIDER_PRIMARY, settings.STT_PROVIDER_FALLBACK]
        providers = [p for p in (_build(n) for n in names if n) if p is not None and p.is_configured]
        if not providers:
            raise STTUnavailable("No STT provider is configured — set ASSEMBLYAI_API_KEY.")

        last_error = None
        for provider in providers:
            try:
                return provider.transcribe(audio, content_type)
            except Exception as exc:
                last_error = exc
                logger.warning("STT provider %s failed: %s", provider.name, exc)
        raise STTUnavailable(f"All STT providers failed: {last_error}")


def stt() -> _STT:
    return _STT()
