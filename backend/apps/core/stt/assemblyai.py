import time

import requests
from django.conf import settings

from .base import STTProvider, Transcript, Word

API = "https://api.assemblyai.com/v2"
POLL_INTERVAL_S = 2
POLL_TIMEOUT_S = 300


class AssemblyAIProvider(STTProvider):
    """`disfluencies=True` keeps "um"/"uh" in the transcript — required, since
    filler-word counting is a scored dimension (LLD §6.2, §9.3)."""

    name = "assemblyai"

    @property
    def is_configured(self) -> bool:
        return bool(settings.ASSEMBLYAI_API_KEY)

    @property
    def _headers(self):
        return {"authorization": settings.ASSEMBLYAI_API_KEY}

    def transcribe(self, audio: bytes, content_type: str) -> Transcript:
        upload = requests.post(f"{API}/upload", headers=self._headers, data=audio, timeout=120)
        upload.raise_for_status()
        audio_url = upload.json()["upload_url"]

        created = requests.post(
            f"{API}/transcript",
            headers=self._headers,
            json={"audio_url": audio_url, "disfluencies": True, "punctuate": True, "format_text": True},
            timeout=30,
        )
        created.raise_for_status()
        transcript_id = created.json()["id"]

        deadline = time.monotonic() + POLL_TIMEOUT_S
        while time.monotonic() < deadline:
            poll = requests.get(f"{API}/transcript/{transcript_id}", headers=self._headers, timeout=30)
            poll.raise_for_status()
            data = poll.json()
            if data["status"] == "completed":
                return self._to_transcript(data)
            if data["status"] == "error":
                raise RuntimeError(f"AssemblyAI transcription failed: {data.get('error')}")
            time.sleep(POLL_INTERVAL_S)

        raise TimeoutError("AssemblyAI transcription timed out")

    @staticmethod
    def _to_transcript(data: dict) -> Transcript:
        words = [Word(text=w["text"], start_ms=w["start"], end_ms=w["end"]) for w in data.get("words") or []]
        duration = words[-1].end_ms / 1000 if words else 0.0
        return Transcript(text=data.get("text") or "", words=words, duration_seconds=duration)
