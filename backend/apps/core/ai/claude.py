from django.conf import settings

from .base import AIProvider, AIResponse


class ClaudeProvider(AIProvider):
    """Configured as the primary provider (LLD §17), but inactive until
    ANTHROPIC_API_KEY is set — the router skips it and uses Gemini."""

    name = "claude"

    @property
    def is_configured(self) -> bool:
        return bool(settings.ANTHROPIC_API_KEY)

    def generate(self, system: str, user: str, json_mode: bool = False, call_type: str = "") -> AIResponse:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        if json_mode:
            # Claude has no JSON mode; the prompt already demands JSON-only,
            # and the router strips any stray markdown fence.
            user = f"{user}\n\nRespond with raw JSON only. No markdown, no prose."
        msg = client.messages.create(
            model=settings.AI_MODEL_CLAUDE,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return AIResponse(
            text="".join(block.text for block in msg.content if block.type == "text"),
            model=settings.AI_MODEL_CLAUDE,
            input_tokens=msg.usage.input_tokens,
            output_tokens=msg.usage.output_tokens,
        )
