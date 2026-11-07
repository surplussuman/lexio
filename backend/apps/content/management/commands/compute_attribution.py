"""LLD §22.5 nightly job. Run from cron/Task Scheduler:
    python manage.py compute_attribution
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.content.attribution import compute_attribution_for_user, refresh_effectiveness_scores


class Command(BaseCommand):
    help = "Compute attribution records and refresh content effectiveness scores."

    def handle(self, *args, **options):
        created = 0
        for user in User.objects.filter(is_active=True, consumption__isnull=False).distinct():
            created += len(compute_attribution_for_user(user))

        refreshed = refresh_effectiveness_scores()
        if options.get("verbosity", 1):
            self.stdout.write(
                self.style.SUCCESS(
                    f"Attribution: {created} new record(s); refreshed {refreshed} resource score(s)."
                )
            )
