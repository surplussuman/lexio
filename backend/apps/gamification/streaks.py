"""Streak maths (LLD §12.4), kept pure so the edge cases are unit-testable.

Rules from the LLD:
- a day counts as active if the student completed a session OR marked a
  resource complete;
- the streak breaks after 48 hours of inactivity, i.e. missing a single day
  still counts as "yesterday" and keeps the streak alive today;
- one freeze token is earned per 7-day streak and lets a student skip a day
  without breaking it.
"""
from datetime import date, timedelta

FREEZE_EARNED_EVERY = 7


def compute_streak(active_dates: set[date], today: date) -> int:
    """Consecutive active days ending today or yesterday.

    Ending *yesterday* still counts: the LLD's 48-hour grace means a student
    who was active yesterday but hasn't opened the app yet today has not lost
    their streak.
    """
    if not active_dates:
        return 0

    anchor = today if today in active_dates else today - timedelta(days=1)
    if anchor not in active_dates:
        return 0

    streak = 0
    cursor = anchor
    while cursor in active_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def freezes_earned(streak_days: int) -> int:
    """Total freeze tokens a streak of this length has earned (§12.4)."""
    return streak_days // FREEZE_EARNED_EVERY


def should_spend_freeze(active_dates: set[date], today: date) -> bool:
    """True when exactly one day is missing between the last active day and
    today — the only gap a freeze token can bridge. A longer absence is a
    broken streak no token can save."""
    if today in active_dates or not active_dates:
        return False
    last_active = max(active_dates)
    return (today - last_active).days == 2
