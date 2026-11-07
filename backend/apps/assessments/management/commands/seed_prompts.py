import copy

from django.core.management.base import BaseCommand

from apps.assessments.models import Prompt
from apps.assessments.seed_data import SEED_PROMPTS


def _rotate_answers(payload: dict) -> dict:
    """Seed questions are authored with the correct option written first, which
    keeps the source file readable. Storing them that way would make every
    assessment answerable by always picking option A, so each question's
    options are rotated by its position on the way into the database.
    Deterministic, so tests and re-seeds stay stable.
    """
    payload = copy.deepcopy(payload)
    for index, question in enumerate(payload.get("questions", [])):
        options = question.get("options") or []
        if len(options) < 2:
            continue
        shift = index % len(options)
        question["options"] = options[-shift:] + options[:-shift] if shift else options
        question["answer"] = (question["answer"] + shift) % len(options)
    return payload


class Command(BaseCommand):
    help = "Load the assessment prompt bank. Idempotent — re-running updates existing prompts in place."

    def handle(self, *args, **options):
        created = updated = 0
        seeded_ids = set()
        for entry in SEED_PROMPTS:
            prompt, was_created = Prompt.objects.update_or_create(
                mode=entry["mode"],
                text=entry["text"],
                defaults={
                    "level": entry.get("level", 1),
                    "tips": entry.get("tips", []),
                    "payload": _rotate_answers(entry.get("payload", {})),
                    "is_active": True,
                },
            )
            seeded_ids.add(prompt.id)
            created += was_created
            updated += not was_created

        # `update_or_create` matches on (mode, text), so editing a seed entry's
        # wording — rather than its level/tips/payload — leaves the old row
        # behind, active, instead of replacing it. That's exactly how a
        # slide-less Presentation prompt from before the §5.1 rework stayed
        # selectable after the seed data was rewritten to carry slides:
        # deactivate (not delete — PROTECT on AssessmentSession.prompt) any
        # seeded prompt that's no longer in the current bank.
        retired = (
            Prompt.objects.filter(is_generated=False, is_active=True)
            .exclude(id__in=seeded_ids)
            .update(is_active=False)
        )

        if options.get("verbosity", 1):
            message = f"Prompts seeded: {created} created, {updated} updated"
            if retired:
                message += f", {retired} retired (edited out of the bank)"
            self.stdout.write(self.style.SUCCESS(message + "."))
