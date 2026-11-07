"""Entry point for text-to-speech: `from apps.core.tts import tts`.

Same primary/fallback shape as apps.core.ai / apps.core.stt. Used for AI
personas talking out loud in a live assessment (Group Discussion peers, the
Presentation follow-up avatar) — see apps.assessments.views.SpeakView. A
provider failure here is never fatal to the caller: the frontend always has
the browser's own speechSynthesis as a last-resort fallback (lib/tts.js), so
this only needs to raise cleanly and let the view respond "nothing to play".
"""
import logging

from django.conf import settings

from .base import TTSProvider  # noqa: F401

logger = logging.getLogger(__name__)


class TTSUnavailable(RuntimeError):
    pass


def _build(name: str) -> TTSProvider | None:
    if name == "sarvam":
        from .sarvam_tts import SarvamTTSProvider

        return SarvamTTSProvider()
    if name == "openai":
        from .openai_tts import OpenAITTSProvider

        return OpenAITTSProvider()
    if name == "fake":
        from .fake import FakeProvider

        return FakeProvider()
    # "elevenlabs" is named in settings as the historical fallback but has no
    # adapter built yet (no key to build or test against) — same posture as
    # STT's Deepgram slot: the router just skips it.
    return None


class _TTS:
    def speak(self, text: str, *, gender: str, seed: str = "") -> bytes:
        names = [settings.TTS_PROVIDER_PRIMARY, settings.TTS_PROVIDER_FALLBACK]
        providers = [p for p in (_build(n) for n in names if n) if p is not None and p.is_configured]
        if not providers:
            raise TTSUnavailable("No TTS provider is configured — set SARVAM_API_KEY.")

        last_error = None
        for provider in providers:
            try:
                return provider.synthesize(text, gender=gender, seed=seed)
            except Exception as exc:
                last_error = exc
                logger.warning("TTS provider %s failed: %s", provider.name, exc)
        raise TTSUnavailable(f"All TTS providers failed: {last_error}")


def tts() -> _TTS:
    return _TTS()
