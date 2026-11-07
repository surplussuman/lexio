"""Speech-to-text provider interface. LLD §6.2 step 1 / §18.2."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class Word:
    text: str
    start_ms: int
    end_ms: int


@dataclass
class Transcript:
    text: str
    words: list[Word] = field(default_factory=list)
    duration_seconds: float = 0.0


class STTProvider(ABC):
    name: str

    @abstractmethod
    def transcribe(self, audio: bytes, content_type: str) -> Transcript:
        """Blocking transcription of a complete recording."""

    @property
    def is_configured(self) -> bool:
        return True
