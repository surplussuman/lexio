from django.core.management.base import BaseCommand
from django.db import transaction

from apps.content.models import Resource
from apps.content.seed_data import MODULE_DEFINITIONS, RESOURCES
from apps.learning_path.models import ModuleDefinition, SkillGraph


class Command(BaseCommand):
    help = "Load the content library and the learning-module catalog. Idempotent."

    @transaction.atomic
    def handle(self, *args, **options):
        for entry in RESOURCES:
            data = {k: v for k, v in entry.items() if k != "key"}
            if data.get("youtube_id") and not data.get("url"):
                data["url"] = f"https://www.youtube.com/watch?v={data['youtube_id']}"
                data.setdefault("thumbnail_url", f"https://img.youtube.com/vi/{data['youtube_id']}/hqdefault.jpg")
            Resource.objects.update_or_create(title=entry["title"], source=entry["source"], defaults=data)

        for entry in MODULE_DEFINITIONS:
            ModuleDefinition.objects.update_or_create(
                key=entry["key"],
                defaults={k: v for k, v in entry.items() if k not in ("key", "prerequisites")},
            )

        SkillGraph.objects.all().delete()
        for entry in MODULE_DEFINITIONS:
            module = ModuleDefinition.objects.get(key=entry["key"])
            for prerequisite_key in entry["prerequisites"]:
                SkillGraph.objects.create(
                    module=module, prerequisite=ModuleDefinition.objects.get(key=prerequisite_key)
                )

        if options.get("verbosity", 1):
            self.stdout.write(
                self.style.SUCCESS(
                    f"Content seeded: {Resource.objects.count()} resources, "
                    f"{ModuleDefinition.objects.count()} module definitions, "
                    f"{SkillGraph.objects.count()} prerequisite edges."
                )
            )
