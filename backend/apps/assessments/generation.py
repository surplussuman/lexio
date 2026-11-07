"""Assessment prompts written by the AI against the student's chosen domains.

The LLD's §5.3 prompt bank is a fixed, hand-seeded table. That works, but it
means an economics student argues about GPU pricing and a CS student gets asked
about monetary policy — and once they've seen the bank, they've seen it. So
prompts are generated instead, from the 1-3 topics the student picked (see
`accounts.topics`), with the seeded bank kept as the fallback for when
generation fails or no key is configured. Nothing here can leave a student
unable to start an assessment.

Cost (§17.3): a generated prompt is stored keyed on (mode, level, topic set)
and reused by anyone who picked the same domains and hasn't seen it, so the
call cost amortises across the cohort instead of being paid per session.
"""
import json
import logging

from apps.accounts.topics import effective_topics, label_for, topic_key
from apps.core.ai import ai

from .models import Mode, Prompt

logger = logging.getLogger(__name__)

# How many unseen generated prompts to keep per (mode, level, topics) before
# reusing instead of generating more.
POOL_TARGET = 4

SYSTEM = (
    "You write assessment material for a communication-skills platform used by college "
    "students. You return ONLY a JSON object — no markdown fences, no commentary. The "
    "material must be answerable by a bright undergraduate with general knowledge of the "
    "topic: never require a specific news event, a statistic they'd have to look up, or "
    "insider expertise."
)

# Per-mode: what to ask for, and the JSON shape expected back.
MODE_SPECS = {
    Mode.SPEAK: {
        "task": (
            "Write ONE speaking prompt: a question or position the student will talk about "
            "out loud for three minutes, unscripted. It must be genuinely arguable, not a "
            "recitation of facts, and be answerable from opinion plus general knowledge."
        ),
        "shape": '{"text": "the prompt, one or two sentences", "tips": ["3 short tips, max 12 words each"]}',
    },
    Mode.GD: {
        "task": (
            "Write ONE group-discussion motion, plus three opening statements from AI peers "
            "who disagree with each other. The student joins after these and makes their case."
        ),
        "shape": (
            '{"text": "the motion", "tips": ["3 short tips"], '
            '"payload": {"peers": [{"name": "first name", "gender": "male or female — must match '
            'the name", "stance": "one sentence position", '
            '"opening": "2-3 sentences they say out loud"}]}}'
        ),
    },
    Mode.WRITE: {
        "task": (
            "Write ONE writing brief: a short argumentative or explanatory piece the student "
            "writes in 15 minutes (roughly 250-350 words). State who they are writing for."
        ),
        "shape": '{"text": "the brief", "tips": ["3 short tips"]}',
    },
    Mode.PRESENT: {
        "task": (
            "Build a SHORT SLIDE DECK the student will present from, cold, for five minutes. "
            "Exactly 5 slides. Each slide has a title and 3-4 terse bullet points — bullets are "
            "cues, NOT sentences to read aloud, so keep each under 9 words. Slide 1 sets up the "
            "subject, slides 2-4 develop it (include at least one slide with a tension or "
            "trade-off to argue), slide 5 closes. Do NOT write speaker notes: the student has to "
            "find the words themselves, that is the assessment."
        ),
        "shape": (
            '{"text": "one-line framing of what they are presenting and to whom", '
            '"tips": ["3 short tips"], '
            '"payload": {"slides": [{"title": "slide title", "bullets": ["cue", "cue", "cue"]}]}}'
        ),
    },
    Mode.VOCAB: {
        "task": (
            "Write 10 multiple-choice vocabulary questions set in the context of the topics: "
            "word choice, precision, connotation and register. Each has exactly 4 options with "
            "exactly one defensible answer. Vary which position the correct option sits in."
        ),
        "shape": (
            '{"text": "one-line instruction to the student", '
            '"payload": {"questions": [{"question": "...", "options": ["a","b","c","d"], '
            '"answer": 0, "explanation": "one sentence"}]}}'
        ),
    },
    Mode.GRAMMAR: {
        "task": (
            "Write 10 multiple-choice grammar questions using sentences drawn from the topics: "
            "agreement, tense, modifiers, parallelism, punctuation. Exactly 4 options, exactly "
            "one correct. Vary which position the correct option sits in."
        ),
        "shape": (
            '{"text": "one-line instruction to the student", '
            '"payload": {"questions": [{"question": "...", "options": ["a","b","c","d"], '
            '"answer": 0, "explanation": "one sentence"}]}}'
        ),
    },
    Mode.READ: {
        "task": (
            "Write ONE passage of 280-350 words on the topics, with a clear argument and at "
            "least one implied (not stated) conclusion. Then 6 multiple-choice questions on it: "
            "main idea, inference, vocabulary-in-context, and the author's stance."
        ),
        "shape": (
            '{"text": "one-line instruction", '
            '"payload": {"passage": "the full passage", "questions": [{"question": "...", '
            '"options": ["a","b","c","d"], "answer": 0, "explanation": "one sentence"}]}}'
        ),
    },
    Mode.LISTEN: {
        "task": (
            "Write ONE spoken briefing script of 180-240 words on the topics — written to be "
            "heard, not read: conversational, with a couple of specific details worth catching. "
            "Then 6 multiple-choice questions testing what they actually heard, including one "
            "about the speaker's attitude."
        ),
        "shape": (
            '{"text": "one-line instruction", '
            '"payload": {"script": "the briefing, spoken aloud to the student", '
            '"questions": [{"question": "...", "options": ["a","b","c","d"], "answer": 0, '
            '"explanation": "one sentence"}]}}'
        ),
    },
}

LEVEL_NOTES = {
    1: "Pitch it at a first-year undergraduate. Keep the language plain.",
    2: "Pitch it at a final-year undergraduate. Some nuance is expected.",
    3: "Pitch it at a graduate about to interview. Make them work for it.",
}


def build_user_prompt(mode: str, topics: list[str], level: int) -> str:
    spec = MODE_SPECS[mode]
    topic_line = ", ".join(label_for(topic) for topic in topics)
    return f"""Student's chosen interest areas: {topic_line}.
Everything you write must sit inside those areas — that is the whole point, so do not drift
to a generic topic. If several areas are listed, pick one or combine two naturally.

{LEVEL_NOTES.get(level, LEVEL_NOTES[1])}

{spec['task']}

Return JSON exactly matching this shape:
{spec['shape']}"""


# --- validation -----------------------------------------------------------
#
# A generated prompt goes straight in front of a student and, for MCQ modes,
# is scored against its own answer key. Anything malformed is rejected and the
# seeded bank is used instead — a wrong answer key would mark a correct
# student wrong, which is worse than a less relevant question.

MIN_QUESTIONS = {Mode.VOCAB: 6, Mode.GRAMMAR: 6, Mode.READ: 4, Mode.LISTEN: 4}


def _clean_questions(raw, minimum: int) -> list[dict] | None:
    questions = []
    for item in raw if isinstance(raw, list) else []:
        options = item.get("options")
        answer = item.get("answer")
        if not isinstance(options, list) or len(options) < 3:
            continue
        options = [str(option).strip() for option in options if str(option).strip()]
        if len(set(options)) != len(options) or len(options) < 3:
            continue
        if not isinstance(answer, int) or not 0 <= answer < len(options):
            continue
        question = str(item.get("question") or "").strip()
        if not question:
            continue
        questions.append(
            {
                "question": question,
                "options": options,
                "answer": answer,
                "explanation": str(item.get("explanation") or "").strip(),
            }
        )
    if len(questions) < minimum:
        return None
    # All-same-index answer keys make the paper answerable by pattern alone.
    if len({q["answer"] for q in questions}) < 2:
        return None
    return questions


def validate(mode: str, result: dict) -> dict | None:
    """Return a clean {text, tips, payload} or None if unusable."""
    text = str(result.get("text") or "").strip()
    if not text:
        return None
    tips = [str(tip).strip() for tip in (result.get("tips") or []) if str(tip).strip()][:4]
    payload = result.get("payload") if isinstance(result.get("payload"), dict) else {}

    if mode in MIN_QUESTIONS:
        questions = _clean_questions(payload.get("questions"), MIN_QUESTIONS[mode])
        if questions is None:
            return None
        payload = {**payload, "questions": questions}
        if mode == Mode.READ and len(str(payload.get("passage") or "").strip()) < 200:
            return None
        if mode == Mode.LISTEN and len(str(payload.get("script") or "").strip()) < 120:
            return None

    if mode == Mode.PRESENT:
        slides = []
        for slide in payload.get("slides") or []:
            title = str(slide.get("title") or "").strip()
            bullets = [str(b).strip() for b in (slide.get("bullets") or []) if str(b).strip()][:5]
            if title and bullets:
                slides.append({"title": title, "bullets": bullets})
        if len(slides) < 3:
            return None
        payload = {**payload, "slides": slides}

    if mode == Mode.GD:
        peers = []
        for index, peer in enumerate(payload.get("peers") or []):
            opening = str(peer.get("opening") or "").strip()
            if opening:
                gender = str(peer.get("gender") or "").strip().lower()
                if gender not in ("male", "female"):
                    # The model occasionally drops this field — alternate
                    # rather than default everyone to one gender, so the
                    # avatar/voice picked on the frontend (which trusts this
                    # field) is at least not uniformly wrong.
                    gender = "male" if index % 2 == 0 else "female"
                peers.append(
                    {
                        "name": str(peer.get("name") or "Peer").strip(),
                        "gender": gender,
                        "stance": str(peer.get("stance") or "").strip(),
                        "opening": opening,
                    }
                )
        if len(peers) < 2:
            return None
        payload = {**payload, "peers": peers}

    return {"text": text, "tips": tips, "payload": payload}


# --- entry point ----------------------------------------------------------


def generate_prompt(mode: str, topics: list[str], level: int = 1) -> Prompt | None:
    """One AI call; persists and returns the Prompt, or None if it failed.

    Failure is never raised: the caller falls back to the seeded bank so a
    provider outage can't stop a student assessing themselves.
    """
    if mode not in MODE_SPECS:
        return None
    try:
        result = ai().generate_json(
            call_type=f"prompt_generation:{mode}",
            system=SYSTEM,
            user=build_user_prompt(mode, topics, level),
        )
    except Exception:
        logger.exception("Prompt generation failed for mode %s", mode)
        return None

    cleaned = validate(mode, result)
    if cleaned is None:
        logger.warning("Generated prompt for %s failed validation: %s", mode, json.dumps(result)[:400])
        return None

    return Prompt.objects.create(
        mode=mode,
        level=level,
        text=cleaned["text"],
        tips=cleaned["tips"],
        payload=cleaned["payload"],
        is_generated=True,
        topics=list(topics),
        topic_key=topic_key(topics),
    )


DOUBT_SYSTEM = (
    "You are a sharp, curious listener at a student presentation. You ask short follow-up "
    "questions that test whether the student actually understands and can defend what they "
    "just said, live and unscripted. Return ONLY a JSON object — no markdown, no commentary."
)


def _build_doubt_prompt(slides: list[dict], timings: list[dict]) -> str:
    by_index = {}
    for entry in timings or []:
        try:
            index = int(entry.get("index"))
        except (TypeError, ValueError):
            continue
        by_index[index] = entry

    lines = []
    for index, slide in enumerate(slides):
        said = (by_index.get(index, {}).get("transcript") or "").strip()
        lines.append(f"Slide '{slide.get('title', f'Slide {index + 1}')}': {said or '(nothing said)'}")

    return (
        "Here is what a student just presented, slide by slide, in their own words:\n\n"
        + "\n\n".join(lines)
        + "\n\nWrite exactly 2 short follow-up questions (max 20 words each) that put them on "
        "the spot about something specific THEY said — reference a detail from their own answer "
        "in each one. Never ask about something not covered above, and never ask something "
        "answerable by a generic definition instead of their own material.\n\n"
        'Return JSON exactly matching this shape: {"questions": ["...", "..."]}'
    )


def generate_doubt_questions(slides: list[dict], timings: list[dict]) -> list[str]:
    """Live follow-ups generated from what the student actually said on their
    slides, asked cold with no slide to lean on. Never raises — a failure
    here just means the review screen skips straight past the doubt round;
    it must never be able to block finishing an assessment."""
    if not slides or not any((entry.get("transcript") or "").strip() for entry in timings or []):
        return []
    try:
        result = ai().generate_json(
            call_type="presentation_doubts", system=DOUBT_SYSTEM, user=_build_doubt_prompt(slides, timings)
        )
    except Exception:
        logger.exception("Doubt-question generation failed")
        return []

    questions = [str(q).strip() for q in (result.get("questions") or []) if str(q).strip()]
    return questions[:2]


GD_TURN_SYSTEM = (
    "You are directing a live group discussion simulation for a communication-skills exercise. "
    "You control every AI participant in it. Given the discussion so far, produce exactly ONE "
    "next line from exactly one AI participant — never from the student, never more than one "
    "speaker. Choose whichever peer actually has the strongest reason to talk next — who "
    "disagrees most with what was just said, who has a stake in the point, who's been quiet and "
    "would naturally jump in now. Real conversation doesn't take turns in a fixed order — do "
    "NOT simply cycle through the participants one after another; picking the same peer twice in "
    "a row is fine if they're the one with something to say. Stay fully in character for "
    "whichever peer you pick: their existing stance and tone. Return ONLY a JSON object, no "
    "markdown, no commentary."
)

GD_TURN_INSTRUCTIONS = {
    # Right after the student speaks: react to them specifically.
    "after_student": (
        "{student} just spoke. Pick ONE peer to respond — they may push back, build on the "
        "point, or ask {student} a direct follow-up question. If reacting, reference something "
        "specific {student} said."
    ),
    # The floor has been open for a while and the student has never spoken.
    "idle_nudge": (
        "{student} hasn't jumped into the discussion at all yet. Pick ONE peer to directly "
        "prompt them by name — e.g. asking what they think — to draw them in. This line MUST "
        "address {student} by name and end in a question to them."
    ),
    # Nobody has spoken in a beat; the room shouldn't just go quiet.
    "continue": (
        "Nobody has jumped in for a moment. Pick ONE peer to add their next point and keep the "
        "discussion moving — building tension with another peer's stance is good."
    ),
}


def _build_gd_turn_prompt(motion: str, peers: list[dict], history: list[dict], event: str, student: str) -> str:
    peer_lines = "\n".join(
        f"- {peer.get('name', 'Peer')}: stance — {peer.get('stance') or 'unstated'}" for peer in peers
    )
    recent = [entry for entry in (history or []) if (entry.get("text") or "").strip()][-16:]
    history_lines = (
        "\n".join(
            f"{student if entry.get('role') == 'student' else entry.get('speaker', 'Peer')}: {entry.get('text', '')}"
            for entry in recent
        )
        or "(nobody has spoken yet)"
    )
    # Named explicitly, not left for the model to re-derive from the log —
    # otherwise the easiest pattern to fall into is just continuing whatever
    # order peers last spoke in, which is exactly the mechanical rotation
    # the system prompt is telling it to avoid.
    recent_peer_speakers = [
        entry.get("speaker") for entry in reversed(recent) if entry.get("role") == "peer" and entry.get("speaker")
    ]
    last_two = list(dict.fromkeys(recent_peer_speakers))[:2]  # de-duped, most recent first
    rotation_note = (
        f"\nMost recently, {' then '.join(reversed(last_two))} spoke. Don't just continue that "
        "pattern by default — only pick one of them again if they genuinely have the strongest "
        "reason to speak now."
        if last_two
        else ""
    )

    instruction = GD_TURN_INSTRUCTIONS.get(event, GD_TURN_INSTRUCTIONS["continue"]).format(student=student)

    return f"""Motion: {motion}

Participants:
{peer_lines}

Discussion so far:
{history_lines}
{rotation_note}

{instruction}

Return JSON exactly matching this shape:
{{"peer": "<name, exactly as listed above>", "text": "what they say, 1-3 sentences",
  "addresses_student": true or false}}"""


def generate_gd_turn(motion: str, peers: list[dict], history: list[dict], event: str, student_name: str) -> dict | None:
    """The next line in a live group-discussion room — one AI participant
    continuing their own point, reacting to the student, or (for
    `event="idle_nudge"`) directly prompting a student who hasn't spoken.
    Never raises — a failure here just means the room stays quiet for that
    beat; it must never be able to block the discussion or the submit."""
    if not peers:
        return None
    student = (student_name or "").strip() or "the student"
    try:
        result = ai().generate_json(
            call_type="gd_turn", system=GD_TURN_SYSTEM,
            user=_build_gd_turn_prompt(motion, peers, history, event, student),
        )
    except Exception:
        logger.exception("GD turn generation failed")
        return None

    peer_name = str(result.get("peer") or "").strip()
    text = str(result.get("text") or "").strip()
    if not peer_name or not text:
        return None
    known = {peer.get("name", "").strip().lower() for peer in peers}
    if peer_name.lower() not in known:
        # The model invented a name not in the roster — safer to drop it
        # than put words in the mouth of a participant who doesn't exist.
        return None
    return {
        "peer": peer_name,
        "text": text,
        "addresses_student": bool(result.get("addresses_student")),
    }


def prompt_for(user, mode: str, level: int = 1, exclude_ids=()) -> Prompt | None:
    """The prompt this student should get next for this mode.

    Reuse an unseen generated prompt matching their topics → generate a new one
    → fall back to the seeded bank.
    """
    import random

    topics = effective_topics(user)
    key = topic_key(topics)

    pool = list(
        Prompt.objects.filter(
            mode=mode, level=level, is_active=True, is_generated=True, topic_key=key
        ).exclude(id__in=exclude_ids)
    )
    # Keep generating until the pool has some depth, so two students in the
    # same cohort don't reliably get the same question.
    if pool and len(pool) >= POOL_TARGET:
        return random.choice(pool)

    generated = generate_prompt(mode, topics, level)
    if generated is not None:
        return generated
    if pool:
        return random.choice(pool)

    bank = list(Prompt.objects.filter(mode=mode, level=level, is_active=True, is_generated=False))
    unseen = [prompt for prompt in bank if prompt.id not in set(exclude_ids)]
    candidates = unseen or bank
    return random.choice(candidates) if candidates else None
