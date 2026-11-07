"""XP, levels, streaks and badge awards — the M9 engine (LLD §12)."""
from django.db.models import F
from django.utils import timezone

from apps.accounts.models import User

from .badges import evaluate_badges
from .streaks import compute_streak, freezes_earned, should_spend_freeze

XP_BASELINE_ASSESSMENT = 50
XP_PRACTICE_SESSION = 80
XP_REASSESSMENT = 100

# LLD §12.2 — (level, title, xp required)
LEVELS = [
    (1, "Newcomer", 0),
    (2, "Beginner", 500),
    (3, "Apprentice", 1200),
    (4, "Communicator", 2500),
    (5, "Speaker", 4500),
    (6, "Orator", 7500),
    (7, "Influencer", 12000),
    (8, "Master", 20000),
]


def level_for_xp(total_xp: int) -> tuple[int, str]:
    level, title = LEVELS[0][0], LEVELS[0][1]
    for candidate_level, candidate_title, required in LEVELS:
        if total_xp >= required:
            level, title = candidate_level, candidate_title
    return level, title


def xp_to_next_level(total_xp: int) -> int | None:
    """XP still needed for the next level, or None at max level."""
    for _, _, required in LEVELS:
        if total_xp < required:
            return required - total_xp
    return None


def award_xp(user, amount: int) -> User:
    User.objects.filter(pk=user.pk).update(total_xp=F("total_xp") + amount)
    user.refresh_from_db(fields=["total_xp"])
    level, _ = level_for_xp(user.total_xp)
    if level != user.current_level:
        User.objects.filter(pk=user.pk).update(current_level=level)
        user.refresh_from_db(fields=["current_level"])
    return user


def award_session_xp(session, score=None) -> None:
    """Called once an assessment completes analysis: XP, then the day's
    activity (which drives the streak), then any badges that unlocks."""
    award_xp(session.user, XP_BASELINE_ASSESSMENT)
    record_activity(session.user, sessions=1)
    session.user.refresh_from_db()
    evaluate_badges(session.user, session=session, score=score)


def record_activity(user, *, sessions: int = 0, items: int = 0, today=None):
    """LLD §12.4 — log today as active and recompute the streak.

    A day counts when the student completes a session OR marks a resource
    complete. The streak is recomputed from DailyActivity rather than
    incremented, so it's always consistent with what actually happened.

    `today` is injectable so a caller can pin the date. Tests use it to stay
    deterministic across local midnight, and it's the seam per-student
    timezones will need (§21.5 talks about *local* midnight, which the LLD
    doesn't model on the profile yet).
    """
    from .models import DailyActivity

    today = today or timezone.localdate()
    activity, _ = DailyActivity.objects.get_or_create(user=user, date=today)
    DailyActivity.objects.filter(pk=activity.pk).update(
        session_count=F("session_count") + sessions, items_completed=F("items_completed") + items
    )

    active_dates = set(DailyActivity.objects.filter(user=user).values_list("date", flat=True))
    streak = compute_streak(active_dates, today)

    # A freeze bridges exactly one missed day. `active_dates` already contains
    # today, so check the gap that existed before this activity was logged.
    previous_dates = active_dates - {today}
    if user.streak_freezes > 0 and should_spend_freeze(previous_dates, today):
        bridged = compute_streak(previous_dates, max(previous_dates)) if previous_dates else 0
        streak = bridged + 1
        User.objects.filter(pk=user.pk).update(streak_freezes=F("streak_freezes") - 1)

    earned = freezes_earned(streak)
    User.objects.filter(pk=user.pk).update(streak_days=streak)
    if earned > user.streak_freezes_earned_total:
        User.objects.filter(pk=user.pk).update(
            streak_freezes=F("streak_freezes") + (earned - user.streak_freezes_earned_total),
            streak_freezes_earned_total=earned,
        )
    user.refresh_from_db()
    return user


def record_item_activity(user):
    """Marking a learning-path resource complete also keeps a streak alive."""
    record_activity(user, items=1)
    evaluate_badges(user)
