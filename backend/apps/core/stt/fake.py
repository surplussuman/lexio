from .base import STTProvider, Transcript, Word

FAKE_TEXT = (
    "um so during my final year project we had a really tight deadline and honestly "
    "I had to take charge of the team and reorganise the work"
)


class FakeProvider(STTProvider):
    """Used by every test (see apps.core.testing) — no network, no credits."""

    name = "fake"

    def transcribe(self, audio: bytes, content_type: str) -> Transcript:
        words = []
        cursor = 0
        for token in FAKE_TEXT.split():
            words.append(Word(text=token, start_ms=cursor, end_ms=cursor + 400))
            cursor += 500
        return Transcript(text=FAKE_TEXT, words=words, duration_seconds=cursor / 1000)
