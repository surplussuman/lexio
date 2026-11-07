from django.conf import settings
from django.db import migrations, models


def close_duplicate_open_sessions(apps, schema_editor):
    """Reconcile the duplicates the constraint below now prevents.

    Two near-simultaneous starts could both open a session for the same mode,
    leaving a spurious twin the student never saw. Keep the one that holds
    their work — the one with a draft, else the oldest — and retire the rest.
    Empty twins are deleted; anything carrying content is preserved as a failed
    session rather than thrown away.
    """
    Session = apps.get_model("assessments", "AssessmentSession")
    open_sessions = Session.objects.filter(status="recording").order_by("user_id", "mode", "is_baseline", "started_at")

    groups = {}
    for session in open_sessions:
        groups.setdefault((session.user_id, session.mode, session.is_baseline), []).append(session)

    for sessions in groups.values():
        if len(sessions) < 2:
            continue
        keep = next((s for s in sessions if s.draft), sessions[0])
        for session in sessions:
            if session.pk == keep.pk:
                continue
            if session.draft or session.media_key or session.raw_response:
                session.status = "failed"
                session.error = "Superseded by a duplicate open session (see migration 0003)."
                session.save(update_fields=["status", "error"])
            else:
                session.delete()


class Migration(migrations.Migration):
    # Postgres refuses to build the index in the same transaction as the
    # cleanup above ("pending trigger events" from the cascading deletes), so
    # the two steps commit separately.
    atomic = False

    dependencies = [
        ('assessments', '0002_assessmentsession_draft_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(close_duplicate_open_sessions, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='assessmentsession',
            constraint=models.UniqueConstraint(condition=models.Q(('status', 'recording')), fields=('user', 'mode', 'is_baseline'), name='one_open_session_per_mode'),
        ),
    ]
