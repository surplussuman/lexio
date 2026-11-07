"""Is this the student's own work?

There is no proctoring here — no webcam lock, no tab policing, no way to stop
someone pasting a chatbot's answer. Trying to build that for a self-improvement
product would be both futile and the wrong relationship to have with a learner.
So Lexio does two things instead:

1. Asks for a commitment up front (the pledge modal on the frontend).
2. Reports an authenticity read alongside the score — framed as a nudge back
   towards doing it for themselves, never as an accusation or a penalty.

Deliberately, this NEVER changes the student's score. AI-detection is not
reliable enough to punish anyone with, and a false positive on a student who
simply writes formally would do real harm. It is a mirror, not a verdict.
"""

# Two independent sources of evidence:
#  - what the model makes of the response's voice and texture
#  - what the client observed while they worked (pastes, tab switches)
# Behavioural evidence is the stronger of the two, so it can raise the read
# but the model's assessment alone can never push it past "unclear".
BANDS = (
    (75, "likely_assisted"),
    (45, "unclear"),
    (0, "own_work"),
)

MESSAGES = {
    "own_work": (
        "This reads like you. That's worth more than a perfect score — the whole "
        "point is knowing where you actually stand."
    ),
    "unclear": (
        "Some of this reads more like written-out prose than how you'd naturally "
        "speak or write under time pressure. No judgement either way — just check "
        "that what we're measuring is really you, because that's the only thing "
        "this score is useful for."
    ),
    "likely_assisted": (
        "This one looks like it had help. That's okay — a lot of people reach for "
        "it when they're not sure they're good enough yet. But an assessment "
        "someone else answered can't tell you anything about you, and it quietly "
        "sends your learning path off in the wrong direction. Try the next one "
        "as yourself, however rough it comes out. Rough is workable. We can do a "
        "lot with rough."
    ),
}

# A paste of this many characters or more is a hard behavioural signal — it is
# not how anyone composes an answer in an exercise box.
SUBSTANTIAL_PASTE_CHARS = 120
MODEL_ONLY_CEILING = 70  # the model's read alone can't reach "likely_assisted"


def band_for(likelihood: int) -> str:
    return next(name for threshold, name in BANDS if likelihood >= threshold)


def _behavioural_signals(integrity: dict, response_length: int) -> tuple[int, list[str]]:
    """Read the client-reported signals. Returns (floor, human-readable notes).

    `floor` is a lower bound on the likelihood — behaviour that can only be
    explained one way shouldn't be argued away by the model's opinion of the
    prose.
    """
    floor, notes = 0, []
    pasted_chars = int(integrity.get("pasted_chars") or 0)
    paste_count = int(integrity.get("paste_count") or 0)
    away_seconds = int(integrity.get("away_seconds") or 0)
    away_count = int(integrity.get("away_count") or 0)

    if pasted_chars >= SUBSTANTIAL_PASTE_CHARS:
        share = round(pasted_chars / response_length * 100) if response_length else 100
        floor = max(floor, 85 if share >= 60 else 60)
        notes.append(f"{share}% of this answer arrived as a paste, not as typing")
    elif paste_count:
        notes.append("a short paste during the answer")

    if away_count >= 2 and away_seconds >= 45:
        floor = max(floor, 50)
        notes.append(f"{away_count} switches away from the page, {away_seconds}s off-tab")

    return floor, notes


def assess(*, model_result: dict, integrity_signals: dict, response_text: str) -> dict:
    """Combine the model's read with what the client observed."""
    raw = (model_result or {}).get("authenticity") or {}
    try:
        model_likelihood = max(0, min(100, int(round(float(raw.get("ai_likelihood", 0))))))
    except (TypeError, ValueError):
        model_likelihood = 0

    model_signals = [str(s).strip() for s in (raw.get("signals") or []) if str(s).strip()][:4]
    floor, behaviour_signals = _behavioural_signals(integrity_signals or {}, len(response_text or ""))

    likelihood = max(min(model_likelihood, MODEL_ONLY_CEILING), floor)
    band = band_for(likelihood)

    return {
        "ai_likelihood": likelihood,
        "band": band,
        "signals": behaviour_signals + model_signals,
        "message": MESSAGES[band],
        # Said out loud in the payload so the UI can't present this as a verdict.
        "affects_score": False,
        "disclaimer": (
            "This is an estimate, not a finding. It never changes your score — "
            "it's here so the number you're looking at is one you can trust."
        ),
    }


def assess_objective(integrity_signals: dict) -> dict:
    """MCQ modes: there is no prose to read, so only behaviour speaks."""
    floor, notes = _behavioural_signals(integrity_signals or {}, 0)
    band = band_for(floor)
    return {
        "ai_likelihood": floor,
        "band": band,
        "signals": notes,
        "message": MESSAGES[band],
        "affects_score": False,
        "disclaimer": "Based only on how the answers were entered, not on their content.",
    }
