"""Presentation mode: slide pacing and camera-derived delivery signals.

Presentation is the one mode where the student is given material to present
rather than a topic to talk about, so it is scored on two things the other
modes have no equivalent of:

- **Slide coverage** — did they actually present every slide, and was the time
  spread sensibly, or did three slides eat the whole clock?
- **Visual delivery** — framing, steadiness, how much of the time they were
  looking at the camera, and whether the background was working against them.

The visual numbers are computed in the browser (see `useCameraPresence` on the
frontend) and arrive here already aggregated: the video itself never leaves the
student's machine, which is what makes camera use defensible at all — the LLD's
own §21.8 flags camera analysis as needing privacy scoping, and keeping the
frames local is that scoping.

Everything here validates and clamps what the client sent. A client can lie;
these are treated as reported measurements, not trusted facts, and they inform
the narrative and one dimension rather than driving the whole score.
"""

VISUAL_KEYS = ("eye_contact", "posture", "steadiness", "background", "framing")
MIN_SAMPLES_TO_TRUST = 20  # ~20s at 1Hz; below this the read is too thin to use

# A slide that got less than this share of its fair time was rushed; more than
# this multiple of it, dwelt on.
RUSHED_RATIO = 0.4
DWELT_RATIO = 2.2
MIN_WORDS_PER_SLIDE = 12  # below this, the slide was shown but not presented


def clean_visual_metrics(raw: dict | None) -> dict:
    """Keep the five reported signals, clamped, plus the sample count that
    says how much to trust them."""
    raw = raw or {}
    cleaned = {}
    for key in VISUAL_KEYS:
        try:
            cleaned[key] = max(0, min(100, int(round(float(raw[key])))))
        except (KeyError, TypeError, ValueError):
            continue

    samples = int(raw.get("samples") or 0)
    face_seconds = int(raw.get("face_seconds") or 0)
    if not cleaned:
        return {}

    cleaned["samples"] = samples
    cleaned["face_seconds"] = face_seconds
    cleaned["reliable"] = samples >= MIN_SAMPLES_TO_TRUST
    cleaned["composite"] = round(sum(cleaned[k] for k in VISUAL_KEYS if k in cleaned) / len([k for k in VISUAL_KEYS if k in cleaned]))
    return cleaned


def slide_coverage(slides: list[dict], timings: list[dict], total_seconds: float) -> list[dict]:
    """Per-slide: how long they spent, how much they said, and whether that
    was proportionate."""
    if not slides:
        return []

    by_index = {}
    for entry in timings or []:
        try:
            index = int(entry.get("index"))
        except (TypeError, ValueError):
            continue
        if 0 <= index < len(slides):
            by_index[index] = entry

    fair_share = (total_seconds / len(slides)) if total_seconds else 0
    coverage = []
    for index, slide in enumerate(slides):
        entry = by_index.get(index, {})
        seconds = max(0.0, float(entry.get("seconds") or 0))
        words = max(0, int(entry.get("words") or 0))

        if not seconds:
            verdict = "skipped"
        elif words < MIN_WORDS_PER_SLIDE:
            verdict = "shown_not_presented"
        elif fair_share and seconds < fair_share * RUSHED_RATIO:
            verdict = "rushed"
        elif fair_share and seconds > fair_share * DWELT_RATIO:
            verdict = "dwelt"
        else:
            verdict = "covered"

        coverage.append(
            {
                "index": index,
                "title": slide.get("title", f"Slide {index + 1}"),
                "seconds": round(seconds),
                "words": words,
                "wpm": round(words / (seconds / 60)) if seconds >= 5 else 0,
                "verdict": verdict,
                "transcript": (entry.get("transcript") or "").strip()[:2000],
            }
        )
    return coverage


def delivery_note(visual: dict, coverage: list[dict]) -> str:
    """What the AI needs to know about the delivery it cannot hear."""
    lines = []

    if visual and visual.get("reliable"):
        lines.append(
            "Camera-derived delivery signals (0-100, measured in the student's browser): "
            + ", ".join(f"{key.replace('_', ' ')} {visual[key]}" for key in VISUAL_KEYS if key in visual)
            + f". They were visible on camera for {visual.get('face_seconds', 0)}s."
        )
    elif visual:
        lines.append(
            "Camera signals were captured but from too few samples to be reliable — do not "
            "draw conclusions about their body language."
        )

    if coverage:
        skipped = [c for c in coverage if c["verdict"] == "skipped"]
        thin = [c for c in coverage if c["verdict"] == "shown_not_presented"]
        rushed = [c for c in coverage if c["verdict"] == "rushed"]
        dwelt = [c for c in coverage if c["verdict"] == "dwelt"]

        lines.append(f"They presented {len(coverage) - len(skipped)} of {len(coverage)} slides.")
        for label, group in (("never reached", skipped), ("shown but barely spoken to", thin),
                             ("rushed through", rushed), ("dwelt on well past their share", dwelt)):
            if group:
                titles = ", ".join(f"'{c['title']}'" for c in group[:3])
                lines.append(f"Slides {label}: {titles}.")

        pace = [c for c in coverage if c["wpm"]]
        if pace:
            lines.append(f"Speaking pace per slide ranged {min(c['wpm'] for c in pace)}-{max(c['wpm'] for c in pace)} wpm.")

    if not lines:
        return ""
    return (
        "PRESENTATION DELIVERY — judge structure, confidence and pace against this, and refer to "
        "specific slides by name in the narrative:\n" + "\n".join(lines)
    )


def doubt_note(doubt_questions: list[str], timings: list[dict], slide_count: int) -> str:
    """What they said when pressed live, on the spot, about their own
    material — the follow-up round after the last slide (see
    `apps.assessments.generation.generate_doubt_questions`). These answers
    arrive in `slide_timings` too, indexed past the real slides, the same way
    a slide's transcript does."""
    if not doubt_questions:
        return ""

    by_index = {}
    for entry in timings or []:
        try:
            index = int(entry.get("index"))
        except (TypeError, ValueError):
            continue
        if index >= slide_count:
            by_index[index] = entry

    lines = [
        f"They were also asked {len(doubt_questions)} live follow-up question(s) on the spot, "
        "with no slide to lean on:"
    ]
    for offset, question in enumerate(doubt_questions):
        answer = (by_index.get(slide_count + offset, {}).get("transcript") or "").strip()
        lines.append(f"Q: {question}\nA: {answer or '(no audible answer)'}")
    return "\n".join(lines)


def visual_adjusted_scores(dimension_scores: dict[str, int], visual: dict) -> dict[str, int]:
    """Blend the camera read into `confidence`.

    Presentation's confidence score is the one dimension where what the AI can
    infer from a transcript is genuinely weaker than what the camera measured,
    so the two are averaged (weighted towards the transcript, which is the
    richer signal) rather than either being taken alone.
    """
    if not visual or not visual.get("reliable") or "confidence" not in dimension_scores:
        return dict(dimension_scores)

    camera = round((visual.get("eye_contact", 0) + visual.get("posture", 0) + visual.get("steadiness", 0)) / 3)
    adjusted = dict(dimension_scores)
    adjusted["confidence"] = round(dimension_scores["confidence"] * 0.65 + camera * 0.35)
    return adjusted
