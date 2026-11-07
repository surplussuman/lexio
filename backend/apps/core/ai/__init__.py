"""Entry point for every AI call in Lexio: `from apps.core.ai import ai`.

Tries the primary provider, falls back to the secondary on failure or when
the primary has no API key configured (LLD §17.2 "fallback: retry with
exponential backoff"; here: try primary, then fallback, then raise). Every
call is logged to AICallLog with model, tokens and latency, per §17.2.
"""
import json
import logging
import time

from django.conf import settings

from .base import AIProvider, AIResponse  # noqa: F401

logger = logging.getLogger(__name__)


class AIUnavailable(RuntimeError):
    """No configured provider could answer."""


# A malformed/truncated JSON reply is common enough with today's models to be
# worth one immediate retry of the SAME provider before writing it off and
# moving to the fallback — this is what "same API as local, works there,
# fails in prod" usually is: not an environment difference, just the model
# occasionally returning something unparseable, on any deployment. Each
# provider gets this many tries before the router moves on.
RETRIES_PER_PROVIDER = 2


def _build(name: str) -> AIProvider | None:
    if name == "claude":
        from .claude import ClaudeProvider

        return ClaudeProvider()
    if name == "gemini":
        from .gemini import GeminiProvider

        return GeminiProvider()
    if name == "fake":
        from .fake import FakeProvider

        return FakeProvider()
    return None


def _providers() -> list[AIProvider]:
    names = [settings.AI_PROVIDER_PRIMARY, settings.AI_PROVIDER_FALLBACK]
    built = [_build(n) for n in names if n]
    return [p for p in built if p is not None and p.is_configured]


def _strip_fence(text: str) -> str:
    """Providers without a strict JSON mode sometimes wrap output in ```json."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t
        t = t.rsplit("```", 1)[0]
    return t.strip()


def parse_json(raw: str) -> dict:
    """Parse a model's JSON reply, tolerating the two ways they routinely break
    it: a code fence around the object, and a sentence either side of it.

    Raises ValueError if there's nothing usable — the caller treats that as a
    provider failure and moves on to the next one.
    """
    text = _strip_fence(raw)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Second chance: the largest {...} span in the response.
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    raise ValueError("no parsable JSON object in the response")


class _AI:
    def generate_text(self, call_type: str, system: str, user: str) -> str:
        return self._call(call_type, system, user, json_mode=False)[0].text

    def generate_json(self, call_type: str, system: str, user: str) -> dict:
        return self._call(call_type, system, user, json_mode=True, parse=parse_json)[1]

    def _call(self, call_type: str, system: str, user: str, json_mode: bool, parse=None):
        """Try each configured provider in turn. Returns (response, parsed).

        A reply that can't be parsed counts as a failure of that provider, not
        of the call: models occasionally emit truncated or commentary-wrapped
        JSON, and before this the fallback provider never got a turn — a single
        malformed response failed the student's whole assessment.
        """
        providers = _providers()
        if not providers:
            raise AIUnavailable("No AI provider is configured — set ANTHROPIC_API_KEY or GEMINI_API_KEY.")

        last_error = None
        for provider in providers:
            for attempt in range(RETRIES_PER_PROVIDER):
                started = time.monotonic()
                try:
                    resp = provider.generate(system, user, json_mode=json_mode, call_type=call_type)
                except Exception as exc:  # provider/network failure — retry, then try the next provider
                    last_error = exc
                    logger.warning(
                        "AI provider %s failed on %s (attempt %d/%d): %s",
                        provider.name, call_type, attempt + 1, RETRIES_PER_PROVIDER, exc,
                    )
                    self._log(provider.name, "", call_type, started, 0, 0, str(exc)[:500])
                    continue

                parsed = None
                if parse is not None:
                    try:
                        parsed = parse(resp.text)
                    except ValueError as exc:
                        last_error = exc
                        logger.warning(
                            "AI provider %s returned unparsable output on %s (attempt %d/%d)",
                            provider.name, call_type, attempt + 1, RETRIES_PER_PROVIDER,
                        )
                        self._log(
                            provider.name, resp.model, call_type, started,
                            resp.input_tokens, resp.output_tokens, f"unparsable output: {exc}",
                        )
                        continue

                self._log(provider.name, resp.model, call_type, started, resp.input_tokens, resp.output_tokens, "")
                return resp, parsed

        raise AIUnavailable(f"All AI providers failed for {call_type}: {last_error}")

    @staticmethod
    def _log(provider, model, call_type, started, input_tokens, output_tokens, error):
        from apps.core.models import AICallLog

        AICallLog.objects.create(
            provider=provider,
            model=model,
            call_type=call_type,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=int((time.monotonic() - started) * 1000),
            error=error,
        )


def ai() -> _AI:
    return _AI()
