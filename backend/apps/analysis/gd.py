"""Group Discussion mode: turning the room's turn-by-turn log into scoring
context.

The room is one continuous recording spanning the whole multi-turn session —
silent whenever an AI peer is "talking" (synthesised client-side, never fed
into the student's mic) or nobody is — so server-side transcription already
produces exactly what the student said, in the order they said it, across
every turn they took. That covers the words. What it can't carry is the
room's side of the conversation: what a peer asked them, and whether they
answered when singled out by name. That context is built here, from the log
the client submits alongside the audio (`raw_response.discussion_log`).
"""


def student_speaking_seconds(log: list[dict]) -> int:
    """Cumulative time the student actually held the floor — not the length
    of the recording, which spans the whole room session and is mostly
    peers "talking" or silence. This is what time-adherence scores against
    for GD; see `analysis.services._timing_for`."""
    return round(sum(float(entry.get("seconds") or 0) for entry in (log or []) if entry.get("role") == "student"))


def context_note(log: list[dict]) -> str:
    """What the AI scorer needs to know about the room that the transcript
    alone doesn't carry."""
    if not log:
        return ""

    student_turns = [entry for entry in log if entry.get("role") == "student"]
    if not student_turns:
        return (
            "GROUP DISCUSSION — the student never took the floor at all, even after being "
            "prompted by name. Score initiative and collaboration accordingly."
        )

    lines = [
        f"GROUP DISCUSSION FLOW — the student spoke {len(student_turns)} time(s). Full room "
        "log, in order ('You' is the student):"
    ]
    for entry in log[-24:]:  # a very long room session shouldn't blow the prompt
        text = (entry.get("text") or "").strip()
        if not text:
            continue
        speaker = "You" if entry.get("role") == "student" else entry.get("speaker") or "Peer"
        tag = " [asked the student directly]" if entry.get("addressed_student") else ""
        lines.append(f"{speaker}{tag}: {text}")

    nudge_indices = [
        index for index, entry in enumerate(log) if entry.get("role") == "peer" and entry.get("addressed_student")
    ]
    if nudge_indices:
        answered = any(
            index + 1 < len(log) and log[index + 1].get("role") == "student" for index in nudge_indices
        )
        lines.append(
            "The student was directly addressed by name at least once — "
            + ("they responded." if answered else "note whether they engaged when singled out.")
        )

    lines.append(
        "Judge initiative, active listening, persuasion and collaboration against this whole "
        "flow, not just the transcript in isolation — credit responding to a peer's specific "
        "point or question, not just speaking."
    )
    return "\n".join(lines)
