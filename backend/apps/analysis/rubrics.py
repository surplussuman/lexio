"""Scoring rubric — pure data + pure functions, no I/O. Unit-tested directly.

Weights come from LLD §6.5. That table omits `present` and `read`; those two
rows are filled in here from each mode's stated rubric dimensions in §5.1
(Presentation: structure/delivery/pace/eye-contact/Q&A → structure,
confidence, fluency, clarity, tone; Reading: main idea/inference/vocab in
context → comprehension + vocabulary).
"""

# The 8 communication dimensions (LLD §1).
DIMENSIONS = {
    "fluency": "Fluency & Pace",
    "clarity": "Clarity & Pronunciation",
    "grammar": "Grammar Accuracy",
    "structure": "Structure & Coherence",
    "tone": "Tone & Empathy",
    "confidence": "Confidence & Delivery",
    "vocabulary": "Vocabulary Range",
    "listening": "Active Listening",
}

RUBRIC_WEIGHTS = {
    "speak": {"fluency": 25, "clarity": 20, "grammar": 15, "structure": 15, "tone": 10, "confidence": 15},
    "write": {"clarity": 15, "grammar": 25, "structure": 25, "tone": 10, "vocabulary": 25},
    "vocab": {"vocabulary": 100},
    "grammar": {"grammar": 100},
    "listen": {"listening": 100},
    "read": {"listening": 70, "vocabulary": 30},
    "present": {"structure": 25, "confidence": 25, "fluency": 20, "clarity": 20, "tone": 10},
    "gd": {"fluency": 15, "clarity": 15, "grammar": 10, "structure": 15, "tone": 20, "confidence": 15, "vocabulary": 10},
}

FILLER_WORDS = {
    "um", "uh", "er", "ah", "like", "basically", "actually", "honestly",
    "literally", "sorta", "kinda", "hmm", "erm",
}


def weights_for(mode: str) -> dict[str, int]:
    if mode not in RUBRIC_WEIGHTS:
        raise ValueError(f"No rubric defined for mode '{mode}'")
    return RUBRIC_WEIGHTS[mode]


def overall_score(dimension_scores: dict[str, float], mode: str) -> int:
    """Weighted composite of the mode's rubric dimensions, 0-100.

    Dimensions the mode doesn't assess are ignored. Missing dimensions are
    dropped and the remaining weights renormalised, so a partial AI response
    still yields a sensible score rather than a deflated one.
    """
    weights = weights_for(mode)
    scored = {d: w for d, w in weights.items() if d in dimension_scores}
    if not scored:
        return 0
    total_weight = sum(scored.values())
    weighted = sum(dimension_scores[d] * w for d, w in scored.items())
    return round(weighted / total_weight)


def audio_features(transcript_text: str, words: list, duration_seconds: float) -> dict:
    """LLD §6.2 step 1 / §18.3. Derived from the STT transcript + word
    timings rather than raw DSP: WPM, filler count, and pauses (gaps over
    800ms between consecutive words). Pitch range needs signal analysis the
    browser does client-side during practice (LLD §18.3) — it is absent here
    rather than faked."""
    tokens = [t.strip(".,!?;:").lower() for t in transcript_text.split() if t.strip(".,!?;:")]
    word_count = len(tokens)
    filler_count = sum(1 for t in tokens if t in FILLER_WORDS)

    pause_count = 0
    longest_pause_ms = 0
    for previous, current in zip(words, words[1:]):
        gap = current.start_ms - previous.end_ms
        if gap > 800:
            pause_count += 1
            longest_pause_ms = max(longest_pause_ms, gap)

    wpm = round(word_count / (duration_seconds / 60)) if duration_seconds > 0 else 0
    filler_ratio = round(filler_count / word_count * 100, 1) if word_count else 0.0

    return {
        "wpm": wpm,
        "word_count": word_count,
        "filler_count": filler_count,
        "filler_ratio": filler_ratio,
        "pause_count": pause_count,
        "longest_pause_ms": longest_pause_ms,
        "duration_seconds": round(duration_seconds, 1),
    }


# --- Time adherence -------------------------------------------------------
#
# Holding the floor for the time you were given is part of the skill being
# assessed: a 3-minute brief asks "can you develop an idea for three minutes",
# and 30 seconds does not answer it however well-phrased those 30 seconds are.
# The LLD's §6.5 rubric has no term for this, so it is added here (logged as a
# deviation) and applied as a *ceiling* on the dimensions that coverage
# actually bears on, rather than as an arbitrary subtraction from the total.

# Dimensions a short or over-running answer genuinely undermines. Grammar and
# vocabulary are deliberately absent — those can be flawless in 30 seconds.
UNDER_TIME_SENSITIVE = ("structure", "fluency", "confidence")
OVER_TIME_SENSITIVE = ("structure", "fluency")

# (minimum ratio of the target, ceiling applied at or above it).
UNDER_TIME_CEILINGS = ((0.85, 100), (0.6, 85), (0.35, 70), (0.0, 55))
OVER_TIME_CEILINGS = ((1.4, 80), (1.15, 90), (0.0, 100))

# Stopping within 15% of the target is finishing on time, not stopping early.
ON_TARGET_FLOOR = 0.85


def time_adherence(*, target_seconds: int, actual_seconds: float, min_ratio: float, max_ratio: float) -> dict:
    """How much of the allotted time the student actually used, and the score
    ceiling that follows from it."""
    if not target_seconds:
        return {}

    ratio = round(actual_seconds / target_seconds, 3) if actual_seconds else 0.0

    if ratio > max_ratio:
        band = "over"
        ceiling = next(value for threshold, value in OVER_TIME_CEILINGS if ratio >= threshold)
        dimensions = OVER_TIME_SENSITIVE
    elif ratio < ON_TARGET_FLOOR:
        # `min_ratio` marks where a short answer stops being a genuine attempt
        # at the brief and starts being a fragment of one.
        band = "under" if ratio >= min_ratio else "well_under"
        ceiling = next(value for threshold, value in UNDER_TIME_CEILINGS if ratio >= threshold)
        dimensions = UNDER_TIME_SENSITIVE
    else:
        band, ceiling, dimensions = "on_target", 100, ()

    return {
        "target_seconds": target_seconds,
        "actual_seconds": round(actual_seconds),
        "ratio": ratio,
        "percent_used": round(ratio * 100),
        "band": band,
        "ceiling": ceiling,
        "capped_dimensions": list(dimensions),
    }


def apply_time_adherence(dimension_scores: dict[str, int], timing: dict) -> dict[str, int]:
    """Cap the coverage-sensitive dimensions. Returns a new dict; the original
    AI scores are kept in `timing['uncapped']` so the report can show both."""
    ceiling = timing.get("ceiling", 100)
    if not timing or ceiling >= 100:
        return dict(dimension_scores)

    capped = dict(dimension_scores)
    changed = {}
    for dimension in timing.get("capped_dimensions", []):
        if dimension in capped and capped[dimension] > ceiling:
            changed[dimension] = capped[dimension]
            capped[dimension] = ceiling
    timing["uncapped"] = changed
    return capped


def time_adherence_note(timing: dict) -> str:
    """One honest sentence for the report and for the AI's narrative."""
    if not timing or timing.get("band") == "on_target":
        return ""
    target = f"{timing['target_seconds'] // 60}m{timing['target_seconds'] % 60:02d}s"
    actual = f"{timing['actual_seconds'] // 60}m{timing['actual_seconds'] % 60:02d}s"
    if timing["band"] == "over":
        return (
            f"They were given {target} and ran to {actual} ({timing['percent_used']}% of the time). "
            "Going long usually means the point arrived late — tightening matters more than adding."
        )
    return (
        f"They were asked to speak for {target} and stopped at {actual} — only "
        f"{timing['percent_used']}% of the time given. Developing an idea for the full duration is "
        "part of what this assessment measures, so say so directly and kindly."
    )


def score_objective_answers(questions: list[dict], answers: list) -> tuple[int, list[dict]]:
    """Deterministic scoring for MCQ modes (vocab/grammar/read/listen) — no
    AI call needed to know whether an answer is right. Returns the percentage
    correct and a per-question breakdown for the feedback page."""
    breakdown = []
    correct = 0
    for index, question in enumerate(questions):
        given = answers[index] if index < len(answers) else None
        is_correct = given == question["answer"]
        correct += int(is_correct)
        breakdown.append(
            {
                "question": question["question"],
                "given": given,
                "answer": question["answer"],
                "options": question.get("options", []),
                "is_correct": is_correct,
                "explanation": question.get("explanation", ""),
            }
        )
    percentage = round(correct / len(questions) * 100) if questions else 0
    return percentage, breakdown
