"""AI provider interface. Call sites never import a vendor SDK directly —
they go through `apps.core.ai.ai()` (see __init__.py), which picks the
configured provider and falls back if it fails. LLD §17."""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class AIResponse:
    text: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


class AIProvider(ABC):
    name: str

    @abstractmethod
    def generate(self, system: str, user: str, json_mode: bool = False, call_type: str = "") -> AIResponse:
        """Single-turn completion. `json_mode` asks the provider for strict
        JSON output where it supports it."""

    @property
    def is_configured(self) -> bool:
        """False when the API key is missing — the router skips to the next
        provider rather than failing."""
        return True
