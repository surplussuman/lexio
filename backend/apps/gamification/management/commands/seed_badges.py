from django.core.management.base import BaseCommand

from apps.gamification.badges import BADGE_CATALOG
from apps.gamification.models import Badge


class Command(BaseCommand):
    help = "Load the badge definitions (LLD §12.3). Idempotent."

    def handle(self, *args, **options):
        for index, entry in enumerate(BADGE_CATALOG):
            Badge.objects.update_or_create(
                key=entry["key"],
                defaults={
                    "name": entry["name"],
                    "description": entry["description"],
                    "icon": entry.get("icon", ""),
                    "order_index": index,
                },
            )
        if options.get("verbosity", 1):
            self.stdout.write(self.style.SUCCESS(f"Badges seeded: {Badge.objects.count()}."))
