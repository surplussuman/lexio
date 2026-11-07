import uuid

from django.conf import settings
from django.db import models

from apps.content.models import Resource


class ModuleDefinition(models.Model):
    """The pre-authored module catalog referenced by LLD §10.2 step 4
    ("map each dimension to a set of LearningModule definitions"), which the
    LLD never actually models. Seeded by `manage.py seed_content`."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.SlugField(max_length=60, unique=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    dimension = models.CharField(max_length=50)
    estimated_minutes = models.SmallIntegerField(default=20)
    xp_reward = models.SmallIntegerField(default=150)
    mastery_threshold = models.SmallIntegerField(default=70)
    sub_skill_tags = models.JSONField(default=list)
    order_hint = models.SmallIntegerField(default=0)  # tie-break within a dimension

    class Meta:
        ordering = ["dimension", "order_hint"]

    def __str__(self):
        return f"{self.dimension}/{self.key}"


class SkillGraph(models.Model):
    """LLD §22.2 — the prerequisite edges. Modelled against ModuleDefinition
    rather than the per-user LearningModule the LLD's table names, because
    prerequisites are a property of the catalog, not of one student's copy of
    it. `mastery_threshold` lives on ModuleDefinition for the same reason."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(ModuleDefinition, on_delete=models.CASCADE, related_name="prerequisite_edges")
    prerequisite = models.ForeignKey(ModuleDefinition, on_delete=models.CASCADE, related_name="unlocks_edges")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["module", "prerequisite"], name="unique_skill_edge")]


class LearningPath(models.Model):
    """LLD §10.3 — one active path per user."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learning_path")
    generated_at = models.DateTimeField(auto_now_add=True)
    last_updated_at = models.DateTimeField(auto_now=True)
    total_modules = models.SmallIntegerField(default=0)
    completed_modules = models.SmallIntegerField(default=0)
    # Scores the ordering was last computed from — the §22.2 path-stability
    # rule compares against this so the path doesn't reshuffle after every
    # minor score wobble.
    scores_at_generation = models.JSONField(default=dict, blank=True)
    narrative = models.TextField(blank=True)


class LearningModule(models.Model):
    """LLD §10.3 — one student's instance of a ModuleDefinition."""

    class Status(models.TextChoices):
        LOCKED = "locked", "Locked"
        AVAILABLE = "available", "Available"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETE = "complete", "Complete"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    path = models.ForeignKey(LearningPath, on_delete=models.CASCADE, related_name="modules")
    definition = models.ForeignKey(ModuleDefinition, on_delete=models.PROTECT, related_name="instances")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    dimension = models.CharField(max_length=50)
    order_index = models.SmallIntegerField(default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.LOCKED)
    progress_pct = models.SmallIntegerField(default=0)
    xp_reward = models.SmallIntegerField(default=150)
    estimated_minutes = models.SmallIntegerField(default=20)
    gap_score = models.SmallIntegerField(default=0)  # why this module ranked where it did
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["order_index"]
        constraints = [models.UniqueConstraint(fields=["path", "definition"], name="unique_module_per_path")]

    def __str__(self):
        return f"{self.title} ({self.status})"


class LearningPathItem(models.Model):
    """LLD §10.3 — one content item inside a module."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETE = "complete", "Complete"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(LearningModule, on_delete=models.CASCADE, related_name="items")
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name="path_items")
    order_index = models.SmallIntegerField(default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["order_index"]
        indexes = [models.Index(fields=["module", "status"])]
