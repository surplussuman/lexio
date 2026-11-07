"""Badge catalog and award rules (LLD §12.3).

Each badge is a key plus a predicate over the student's state. Keeping them
declarative means awarding is one loop, and a new badge is one entry.
"""
from apps.analysis.aggregates import composite_score, latest_dimension_scores

BADGE_CATALOG = [
    {"key": "first_session", "name": "First Step", "description": "Complete your first assessment.", "icon": "◎"},
    {"key": "baseline_done", "name": "Diagnosed", "description": "Complete all 8 baseline modes.", "icon": "◍"},
    {"key": "streak_7", "name": "Week Warrior", "description": "Keep a 7-day streak.", "icon": "▲"},
    {"key": "streak_30", "name": "Monthly Grind", "description": "Keep a 30-day streak.", "icon": "★"},
    {"key": "score_80", "name": "High Achiever", "description": "Reach an overall score of 80.", "icon": "◆"},
    {"key": "filler_free", "name": "Clean Speaker", "description": "Fewer than 2 fillers in a spoken session.", "icon": "○"},
    {"key": "module_1_done", "name": "Foundations", "description": "Master your first learning module.", "icon": "▣"},
    {"key": "vocab_master", "name": "Word Wizard", "description": "Reach a vocabulary score of 85.", "icon": "✦"},
    {"key": "improvement_10", "name": "Level Up", "description": "Improve your overall score by 10 in a reassessment.", "icon": "▲"},
    {"key": "gd_champ", "name": "Room Reader", "description": "Score 85+ in Group Discussion.", "icon": "◈"},
]

MIN_WORDS_FOR_FILLER_BADGE = 40  # a two-word answer with no fillers isn't an achievement


def _completed_session_count(user) -> int:
    from apps.assessments.models import AssessmentSession

    return AssessmentSession.objects.filter(user=user, status=AssessmentSession.Status.COMPLETE).count()


def _distinct_completed_modes(user) -> int:
    from apps.assessments.models import AssessmentSession

    return (
        AssessmentSession.objects.filter(user=user, status=AssessmentSession.Status.COMPLETE)
        .values("mode")
        .distinct()
        .count()
    )


def earned_badge_keys(user, *, session=None, score=None) -> set[str]:
    """Every badge key the student currently qualifies for.

    `session`/`score` are the ones just completed, when there is one — some
    rules (filler-free, GD score) are about a single session rather than the
    student's running state.
    """
    from apps.assessments.models import Mode
    from apps.learning_path.models import LearningModule

    keys = set()

    if _completed_session_count(user):
        keys.add("first_session")
    if _distinct_completed_modes(user) >= len(Mode.choices):
        keys.add("baseline_done")

    if user.streak_days >= 7:
        keys.add("streak_7")
    if user.streak_days >= 30:
        keys.add("streak_30")

    dimension_scores = latest_dimension_scores(user)
    overall = composite_score(dimension_scores)
    if overall is not None and overall >= 80:
        keys.add("score_80")
    if dimension_scores.get("vocabulary", 0) >= 85:
        keys.add("vocab_master")

    if LearningModule.objects.filter(path__user=user, status=LearningModule.Status.COMPLETE).exists():
        keys.add("module_1_done")

    if score is not None:
        features = score.audio_features or {}
        if features.get("word_count", 0) >= MIN_WORDS_FOR_FILLER_BADGE and features.get("filler_count", 0) < 2:
            keys.add("filler_free")
        if session is not None and session.mode == Mode.GD and score.overall_score >= 85:
            keys.add("gd_champ")

    return keys


def evaluate_badges(user, *, session=None, score=None) -> list:
    """Award any newly earned badges. Returns the UserBadge rows created."""
    from .models import Badge, UserBadge

    qualified = earned_badge_keys(user, session=session, score=score)
    if not qualified:
        return []

    already_held = set(UserBadge.objects.filter(user=user).values_list("badge__key", flat=True))
    newly_earned = qualified - already_held
    if not newly_earned:
        return []

    badges = Badge.objects.filter(key__in=newly_earned)
    return UserBadge.objects.bulk_create([UserBadge(user=user, badge=badge) for badge in badges])
