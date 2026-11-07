import base64
import zlib

import requests
from django.conf import settings

from .base import TTSProvider

API = "https://api.sarvam.ai/text-to-speech"
MODEL = "bulbul:v3"

# Bulbul v3's native Indian-English voices, split by the gender they read as.
# The accent is built into the voices, so unlike the OpenAI adapter there's no
# accent prompt to maintain.
FEMALE_VOICES = ("ritu", "priya", "neha", "kavya", "ishita", "pooja")
MALE_VOICES = ("shubh", "aditya", "rahul", "rohan", "amit", "dev")

# Sarvam caps a request at 2,500 characters for bulbul:v3; SpeakRequestSerializer
# already limits input to 2,000.


class SarvamTTSProvider(TTSProvider):
    name = "sarvam"

    @property
    def is_configured(self) -> bool:
        return bool(settings.SARVAM_API_KEY)

    def synthesize(self, text: str, *, gender: str, seed: str = "") -> bytes:
        pool = MALE_VOICES if gender == "male" else FEMALE_VOICES
        index = zlib.crc32(seed.encode()) % len(pool) if seed else 0

        resp = requests.post(
            API,
            headers={"api-subscription-key": settings.SARVAM_API_KEY},
            json={
                "text": text,
                "language_code": "en-IN",
                "model": MODEL,
                "speaker": pool[index],
                "pace": 1.0,
                # Higher than the 0.6 default: more intonation variety, less
                # of the flat read-aloud cadence.
                "temperature": 0.75,
                "speech_sample_rate": 24000,
                "output_audio_codec": "mp3",
            },
            timeout=30,
        )
        resp.raise_for_status()
        audios = resp.json().get("audios") or []
        if not audios:
            raise RuntimeError("Sarvam returned no audio")
        return base64.b64decode(audios[0])
