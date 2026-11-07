from django.conf import settings

from .base import AIProvider, AIResponse


class GeminiProvider(AIProvider):
    name = "gemini"

    @property
    def is_configured(self) -> bool:
        return bool(settings.GEMINI_API_KEY)

    def generate(self, system: str, user: str, json_mode: bool = False, call_type: str = "") -> AIResponse:
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            settings.AI_MODEL_GEMINI,
            system_instruction=system,
        )
        config = {"response_mime_type": "application/json"} if json_mode else {}
        resp = model.generate_content(user, generation_config=config)
        usage = getattr(resp, "usage_metadata", None)
        return AIResponse(
            text=resp.text,
            model=settings.AI_MODEL_GEMINI,
            input_tokens=getattr(usage, "prompt_token_count", 0) or 0,
            output_tokens=getattr(usage, "candidates_token_count", 0) or 0,
        )
