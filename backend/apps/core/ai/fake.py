import json

from .base import AIProvider, AIResponse

# Superset of every JSON shape the scoring call sites ask for, so one canned
# response satisfies any of them without the fake needing to know which one is
# calling. Scores are fixed so tests are deterministic.
FAKE_JSON = {
    "dimensions": [
        {"id": d, "score": 72, "rationale": f"Fake rationale for {d}.", "key_issues": [f"{d} issue"], "strong_moments": [f"{d} strength"]}
        for d in ["fluency", "clarity", "grammar", "structure", "tone", "confidence", "vocabulary", "listening"]
    ],
    # Annotations must carry verbatim `text`, exactly as the real providers
    # are prompted to — services._resolve_annotations locates the offsets.
    # These snippets appear in the fake STT transcript (core/stt/fake.py) and
    # in typical written answers, so the annotation path is genuinely covered.
    "annotations": [
        {"text": "um", "type": "filler", "message": "Filler word — try a pause instead."},
        {"text": "honestly", "type": "hedge", "message": "A hedge — it softens a point you can state plainly."},
    ],
    "authenticity": {"ai_likelihood": 10, "signals": ["natural hesitation and restarts"]},
    "narrative": "You held a clear line of argument and your pacing stayed steady. Watch the filler words at the start of sentences.",
}

FAKE_TEXT = "You made your point clearly. Tighten the opening next time."

# Prompt generation (apps.assessments.generation) asks for a different shape
# per mode, and the result goes through hard validation before a student ever
# sees it. Canning one response per mode means the generation path — including
# that validation — is exercised by the suite rather than always falling
# through to the seeded bank.
_QUESTIONS = [
    {
        "question": f"Fake generated question {index + 1}?",
        "options": [f"Option A{index}", f"Option B{index}", f"Option C{index}", f"Option D{index}"],
        # Rotated, because a bank whose answer is always index 0 is answerable
        # without reading it — the same rule the seeded bank is held to.
        "answer": index % 4,
        "explanation": "Because of the fake reason.",
    }
    for index in range(10)
]

_PASSAGE = (
    "Fake generated passage about the student's chosen topic. " * 12
).strip()

GENERATED_JSON = {
    "speak": {"text": "Fake generated speaking prompt.", "tips": ["Open with a claim", "Give one example", "Land the ending"]},
    "write": {"text": "Fake generated writing brief.", "tips": ["State your position", "Back it once", "Close cleanly"]},
    "gd": {
        "text": "Fake generated discussion motion.",
        "tips": ["Enter early", "Name a peer", "Bring evidence"],
        "payload": {
            "peers": [
                {"name": "Ana", "stance": "For", "opening": "I think the upside clearly outweighs the risk here."},
                {"name": "Dev", "stance": "Against", "opening": "That ignores who actually pays for the transition."},
                {"name": "Mei", "stance": "Undecided", "opening": "Both of you are assuming the rollout works at all."},
            ]
        },
    },
    "present": {
        "text": "Fake generated presentation brief.",
        "tips": ["Signpost each slide", "Argue, don't read", "Watch the clock"],
        "payload": {
            "slides": [
                {"title": f"Fake Slide {index + 1}", "bullets": ["First cue", "Second cue", "Third cue"]}
                for index in range(5)
            ]
        },
    },
    "vocab": {"text": "Choose the most precise word.", "payload": {"questions": _QUESTIONS}},
    "grammar": {"text": "Choose the correct sentence.", "payload": {"questions": _QUESTIONS}},
    "read": {"text": "Read the passage, then answer.", "payload": {"passage": _PASSAGE, "questions": _QUESTIONS[:6]}},
    "listen": {"text": "Listen, then answer.", "payload": {"script": _PASSAGE, "questions": _QUESTIONS[:6]}},
}


class FakeProvider(AIProvider):
    """Used by every test (see apps.core.testing) so the suite never spends
    API credits and never depends on a live network."""

    name = "fake"

    def generate(self, system: str, user: str, json_mode: bool = False, call_type: str = "") -> AIResponse:
        if call_type.startswith("prompt_generation:"):
            mode = call_type.split(":", 1)[1]
            text = json.dumps(GENERATED_JSON.get(mode, FAKE_JSON))
        elif call_type == "presentation_doubts":
            text = json.dumps({"questions": ["Fake follow-up question 1?", "Fake follow-up question 2?"]})
        elif call_type == "gd_turn":
            text = json.dumps(
                {"peer": "Ana", "text": "Fake in-character line from the room.", "addresses_student": False}
            )
        elif json_mode:
            text = json.dumps(FAKE_JSON)
        else:
            text = FAKE_TEXT
        return AIResponse(text=text, model="fake-1", input_tokens=len(user) // 4, output_tokens=len(text) // 4)
