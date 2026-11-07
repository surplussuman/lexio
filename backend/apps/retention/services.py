"""Echo companion + daily habit loop (LLD §21.4, §21.5)."""
import random
from collections import Counter
from datetime import datetime, time, timedelta

from django.utils import timezone

from apps.analysis.aggregates import latest_dimension_scores
from apps.analysis.models import SessionScore
from apps.analysis.rubrics import DIMENSIONS
from apps.assessments.models import Prompt

from .models import DailyChallenge, EchoState

# §21.4 — five visual stages across the eight levels of §12.2.
LEVEL_TO_STAGE = {1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 5}
REMEMBERED_WEAK_POINTS = 3
SESSIONS_TO_SCAN = 5
DAILY_CHALLENGE_XP = 25

# Annotation types (§9.3) phrased the way Echo would raise them.
WEAK_POINT_LABELS = {
    "filler": "filler words",
    "hedge": "hedging phrases",
    "grammar": "grammar slips",
    "structure_gap": "missing structure",
}

# Modes short enough to be a two-minute drill (§21.5), per dimension.
DIMENSION_DRILL_MODES = {
    "fluency": ["speak"],
    "clarity": ["speak"],
    "confidence": ["speak"],
    "tone": ["speak", "gd"],
    "structure": ["speak", "write"],
    "grammar": ["grammar", "write"],
    "vocabulary": ["vocab", "write"],
    "listening": ["listen", "read"],
}


def stage_for_level(level: int) -> int:
    return LEVEL_TO_STAGE.get(level, 5 if level > 8 else 1)


def recurring_weak_points(user) -> list[dict]:
    """§21.4 — the issues that keep coming up, read from the student's own
    annotations rather than invented."""
    counts = Counter()
    scores = SessionScore.objects.filter(user=user).order_by("-created_at")[:SESSIONS_TO_SCAN]
    for score in scores:
        for annotation in score.annotations or []:
            annotation_type = annotation.get("type")
            if annotation_type in WEAK_POINT_LABELS:
                counts[annotation_type] += 1

    return [
        {"type": annotation_type, "label": WEAK_POINT_LABELS[annotation_type], "count": count}
        for annotation_type, count in counts.most_common(REMEMBERED_WEAK_POINTS)
    ]


def refresh_echo(user) -> EchoState:
    """Recompute Echo's state. Called after every scored session."""
    state, _ = EchoState.objects.get_or_create(user=user)
    state.evolution_stage = stage_for_level(user.current_level)
    state.remembered_weak_points = recurring_weak_points(user)
    state.relationship_score = min(100, state.relationship_score + 1)
    state.save()
    return state


def daily_message(user, state: EchoState) -> str:
    """§21.4 — Echo initiates. Specific where it can be, honest where it can't.

    Deliberately templated rather than AI-generated: it fires for every user
    every day, so an API call per person per day is the wrong trade (§17.3),
    and the specificity comes from their own data either way.
    """
    weak_points = state.remembered_weak_points or []
    if not SessionScore.objects.filter(user=user).exists():
        return "Let's find out where you're starting from — one assessment is all it takes."

    if user.streak_days >= 3:
        streak_line = f"{user.streak_days} days running. "
    elif user.streak_days == 0:
        streak_line = "Good to see you back. "
    else:
        streak_line = ""

    if weak_points:
        top = weak_points[0]
        return f"{streak_line}Last few sessions, {top['label']} kept coming up — want to take a run at that today?"

    scores = latest_dimension_scores(user)
    if scores:
        weakest = min(scores, key=scores.get)
        return f"{streak_line}{DIMENSIONS[weakest]} is your biggest gap right now. Two minutes on it?"
    return f"{streak_line}Ready when you are."


def _end_of_local_day() -> datetime:
    """§21.5 — challenges expire at midnight. Uses the server's configured
    timezone; per-student local midnight needs a timezone on the profile,
    which the LLD doesn't model."""
    tomorrow = timezone.localdate() + timedelta(days=1)
    return timezone.make_aware(datetime.combine(tomorrow, time.min))


def get_or_create_daily_challenge(user, today=None) -> DailyChallenge | None:
    """§21.5 — today's Daily Drill, auto-selected from the weakest dimension.

    `today` is injectable for the same reason as gamification.record_activity:
    determinism in tests, and the seam per-student local midnight will need.
    """
    today = today or timezone.localdate()
    existing = DailyChallenge.objects.filter(user=user, date=today).first()
    if existing:
        return existing

    DailyChallenge.objects.filter(
        user=user, status=DailyChallenge.Status.PENDING, expires_at__lt=timezone.now()
    ).update(status=DailyChallenge.Status.EXPIRED)

    scores = latest_dimension_scores(user)
    dimension = min(scores, key=scores.get) if scores else "fluency"

    for mode in DIMENSION_DRILL_MODES.get(dimension, ["speak"]):
        prompts = list(Prompt.objects.filter(mode=mode, is_active=True, level=1))
        if prompts:
            return DailyChallenge.objects.create(
                user=user,
                date=today,
                dimension=dimension,
                mode=mode,
                prompt=random.choice(prompts),
                xp_reward=DAILY_CHALLENGE_XP,
                expires_at=_end_of_local_day(),
            )
    return None


def complete_challenge_for_session(session) -> DailyChallenge | None:
    """Mark today's drill done when the student finishes a session using its
    prompt. Server-side so the client doesn't have to remember to report it."""
    from apps.gamification.services import award_xp

    challenge = DailyChallenge.objects.filter(
        user=session.user,
        prompt_id=session.prompt_id,
        status=DailyChallenge.Status.PENDING,
        date=timezone.localdate(),
    ).first()
    if challenge is None:
        return None

    challenge.status = DailyChallenge.Status.COMPLETE
    challenge.completed_at = timezone.now()
    challenge.save(update_fields=["status", "completed_at"])
    award_xp(session.user, challenge.xp_reward)
    return challenge
