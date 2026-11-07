import zlib

import requests
from django.conf import settings

from .base import TTSProvider

API = "https://api.openai.com/v1/audio/speech"

# OpenAI's stock voices, split by the gender they read as — there's no
# accent-native "Indian voice" in the catalogue, so the accent itself comes
# from `instructions` below rather than voice choice.
MALE_VOICES = ("onyx", "echo", "ash")
FEMALE_VOICES = ("nova", "shimmer", "coral")

ACCENT_INSTRUCTIONS = (
    "Speak naturally and warmly with an Indian English accent and rhythm, like a real person in "
    "a live conversation — not reading aloud, not a narrator."
)


class OpenAITTSProvider(TTSProvider):
    name = "openai"

    @property
    def is_configured(self) -> bool:
        return bool(settings.OPENAI_API_KEY)

    def synthesize(self, text: str, *, gender: str, seed: str = "") -> bytes:
        pool = MALE_VOICES if gender == "male" else FEMALE_VOICES
        index = zlib.crc32(seed.encode()) % len(pool) if seed else 0
        voice = pool[index]

        resp = requests.post(
            API,
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            json={
                "model": "gpt-4o-mini-tts",
                "voice": voice,
                "input": text,
                "instructions": ACCENT_INSTRUCTIONS,
                "response_format": "mp3",
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.content
