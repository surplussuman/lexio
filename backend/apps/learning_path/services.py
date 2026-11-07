"""The Learning Path Engine — LLD §10.2, extended with the §22.2 additions
(explicit skill graph, mastery gate, path-stability rule).

Pure decision logic lives in `plan_modules` so it can be unit-tested without a
database; `generate_path` persists the result.
"""
import logging

from django.db import transaction
from django.utils import timezone

from apps.analysis.aggregates import gap_scores, latest_dimension_scores
from apps.content.models import Resource

from .models import LearningModule, LearningPath, LearningPathItem, ModuleDefinition, SkillGraph

logger = logging.getLogger(__name__)

# §22.2 path-stability rule: only reorder when a dimension has moved more than
# this since the ordering was last computed.
STABILITY_THRESHOLD = 5

ITEMS_PER_MODULE = 3


def plan_modules(
    dimension_scores: dict[str, int],
    definitions: list,
    prerequisites: dict[str, set[str]],
    completed_keys: set[str] | None = None,
) -> list[dict]:
    """LLD §10.2 steps 1-6, as a pure function.

    Returns an ordered plan: weakest dimension first. A module is 'available'
    only when every prerequisite has actually been *completed* by the student
    (§10.2 step 5: "Foundations must complete before Persuasion") — being
    earlier in the path is not enough. `definitions` are ModuleDefinition-like
    objects; `prerequisites` maps a module key to the keys it depends on.
    """
    completed = completed_keys or set()
    ranked_dimensions = [dimension for dimension, _ in gap_scores(dimension_scores)]
    gap_by_dimension = dict(gap_scores(dimension_scores))

    by_dimension = {}
    for definition in definitions:
        by_dimension.setdefault(definition.dimension, []).append(definition)
    for group in by_dimension.values():
        group.sort(key=lambda d: d.order_hint)

    plan = []
    for dimension in ranked_dimensions:
        for definition in by_dimension.get(dimension, []):
            required = prerequisites.get(definition.key, set())
            plan.append(
                {
                    "definition": definition,
                    "dimension": dimension,
                    "gap_score": gap_by_dimension[dimension],
                    "status": LearningModule.Status.AVAILABLE
                    if required.issubset(completed)
                    else LearningModule.Status.LOCKED,
                }
            )

    for index, entry in enumerate(plan):
        entry["order_index"] = index
    return plan


def should_regenerate(previous_scores: dict[str, int], current_scores: dict[str, int]) -> bool:
    """§22.2 path-stability rule. A newly assessed dimension always counts as
    a reason to regenerate, since it can reorder the whole path."""
    if not previous_scores:
        return True
    for dimension, value in current_scores.items():
        if dimension not in previous_scores:
            return True
        if abs(value - previous_scores[dimension]) > STABILITY_THRESHOLD:
            return True
    return False


@transaction.atomic
def generate_path(user, *, force: bool = False) -> LearningPath | None:
    """Create or update the user's path. Returns None when the stability rule
    says the existing ordering still stands."""
    scores = latest_dimension_scores(user)
    if not scores:
        return None

    path, _ = LearningPath.objects.get_or_create(user=user)
    if not force and path.modules.exists() and not should_regenerate(path.scores_at_generation, scores):
        return None

    definitions = list(ModuleDefinition.objects.filter(dimension__in=scores.keys()))
    if not definitions:
        logger.warning("No module definitions seeded for dimensions %s", list(scores))
        return path

    prerequisites: dict[str, set[str]] = {}
    for edge in SkillGraph.objects.select_related("module", "prerequisite"):
        prerequisites.setdefault(edge.module.key, set()).add(edge.prerequisite.key)

    completed_keys = set(
        path.modules.filter(status=LearningModule.Status.COMPLETE).values_list("definition__key", flat=True)
    )
    plan = plan_modules(scores, definitions, prerequisites, completed_keys)

    for entry in plan:
        definition = entry["definition"]
        module, created = LearningModule.objects.get_or_create(
            path=path,
            definition=definition,
            defaults={
                "title": definition.title,
                "description": definition.description,
                "dimension": definition.dimension,
                "xp_reward": definition.xp_reward,
                "estimated_minutes": definition.estimated_minutes,
            },
        )
        module.order_index = entry["order_index"]
        module.gap_score = entry["gap_score"]
        # Never demote finished work when the path re-orders.
        if definition.key not in completed_keys:
            module.status = entry["status"]
        module.save()

        if created:
            _attach_items(module, definition)

    path.total_modules = path.modules.count()
    path.completed_modules = path.modules.filter(status=LearningModule.Status.COMPLETE).count()
    path.scores_at_generation = scores
    path.save()
    return path


def _attach_items(module: LearningModule, definition: ModuleDefinition) -> None:
    """LLD §10.2 step 7 — assign content items to a module.

    Ranked by sub-skill match first (§22.6), then by dimension tag. Full
    ranking (level match, format affinity, effectiveness score) lands with the
    attribution engine in Phase 6.
    """
    candidates = list(
        Resource.objects.filter(is_active=True, dimension_tags__contains=[definition.dimension])
    )
    sub_skills = set(definition.sub_skill_tags or [])
    candidates.sort(key=lambda r: (0 if r.sub_skill_tag in sub_skills else 1, r.difficulty_level))

    for index, resource in enumerate(candidates[:ITEMS_PER_MODULE]):
        LearningPathItem.objects.create(module=module, resource=resource, order_index=index)


def refresh_module_progress(module: LearningModule) -> None:
    """Recompute progress_pct from item completion and move the module out of
    'available' once work has started. Completion itself is gated by mastery
    (see `try_complete_module`) — consuming the content is necessary but not
    sufficient (§22.2)."""
    items = list(module.items.all())
    if not items:
        return
    done = sum(1 for item in items if item.status == LearningPathItem.Status.COMPLETE)
    module.progress_pct = round(done / len(items) * 100)
    if module.status == LearningModule.Status.AVAILABLE and done:
        module.status = LearningModule.Status.IN_PROGRESS
    module.save(update_fields=["progress_pct", "status"])


def try_complete_module(module: LearningModule) -> tuple[bool, str]:
    """§22.2 mastery gate: a module completes only when its content is consumed
    AND a later session in that dimension scores at or above the threshold.
    Returns (completed, reason)."""
    items = list(module.items.all())
    if items and any(item.status != LearningPathItem.Status.COMPLETE for item in items):
        return False, "Finish every item in this module first."

    threshold = module.definition.mastery_threshold
    scores = latest_dimension_scores(module.path.user)
    current = scores.get(module.dimension)
    if current is None:
        return False, f"Take an assessment that measures {module.dimension} to prove mastery."
    if current < threshold:
        return False, f"Your {module.dimension} score is {current}; reach {threshold} to master this module."

    module.status = LearningModule.Status.COMPLETE
    module.progress_pct = 100
    module.completed_at = timezone.now()
    module.save(update_fields=["status", "progress_pct", "completed_at"])

    path = module.path
    path.completed_modules = path.modules.filter(status=LearningModule.Status.COMPLETE).count()
    path.save(update_fields=["completed_modules"])

    _unlock_dependents(module)
    _maybe_trigger_reassessment(path)
    return True, "Module mastered."


def _maybe_trigger_reassessment(path: LearningPath) -> None:
    """LLD §13.1 primary trigger: finishing the whole path starts a
    reassessment cycle. Failing here must not undo the module the student
    just earned, so it's logged rather than raised."""
    if not path.total_modules or path.completed_modules < path.total_modules:
        return

    from apps.reassessment.models import Reassessment
    from apps.reassessment.services import start_reassessment

    try:
        if Reassessment.objects.filter(user=path.user, status=Reassessment.Status.IN_PROGRESS).exists():
            return
        start_reassessment(path.user, Reassessment.TriggeredBy.PATH_COMPLETE)
    except Exception:
        logger.exception("Auto-triggering reassessment failed for user %s", path.user_id)


def _unlock_dependents(module: LearningModule) -> None:
    """Open any locked module whose prerequisites are now all complete."""
    path = module.path
    completed_keys = set(
        path.modules.filter(status=LearningModule.Status.COMPLETE).values_list("definition__key", flat=True)
    )
    for locked in path.modules.filter(status=LearningModule.Status.LOCKED).select_related("definition"):
        required = set(
            SkillGraph.objects.filter(module=locked.definition).values_list("prerequisite__key", flat=True)
        )
        if required.issubset(completed_keys):
            locked.status = LearningModule.Status.AVAILABLE
            locked.save(update_fields=["status"])
