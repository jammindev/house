"""Backfill ``Interaction.recurring_expense`` from ``metadata['recurring_id']``.

Parcours 26, lot 6. The column exists because the conformity control has to
**group** occurrences by recurrence, and CLAUDE.md forbids querying ``metadata``:
a JSON key can be neither indexed nor constrained, so a detector built on it would
be both slow and unverifiable.

Two deliberate choices:

- **the JSON key is kept.** It costs nothing, it is what the existing display code
  reads, and removing it in the same migration that adds the column would make a
  rollback lose information;
- **a dangling id is skipped, not raised.** ``recurring_id`` is a plain string with
  no referential integrity behind it, so a recurrence deleted before this migration
  leaves an id pointing at nothing. Failing the whole migration over a row whose
  target no longer exists would block a deploy for data that is already lost.
"""
from django.db import migrations


def backfill(apps, schema_editor):
    Interaction = apps.get_model("interactions", "Interaction")
    RecurringExpense = apps.get_model("budget", "RecurringExpense")

    known = set(str(pk) for pk in RecurringExpense.objects.values_list("id", flat=True))
    if not known:
        return

    for interaction in Interaction.objects.filter(
        kind="recurring", recurring_expense__isnull=True
    ).iterator():
        raw = (interaction.metadata or {}).get("recurring_id")
        if not raw or str(raw) not in known:
            continue
        interaction.recurring_expense_id = str(raw)
        interaction.save(update_fields=["recurring_expense"])


def clear(apps, schema_editor):
    """Reversible: the JSON key was never removed, so nothing is lost."""
    Interaction = apps.get_model("interactions", "Interaction")
    Interaction.objects.filter(recurring_expense__isnull=False).update(recurring_expense=None)


class Migration(migrations.Migration):
    dependencies = [
        ("interactions", "0026_interaction_recurring_expense_and_more"),
        ("budget", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(backfill, clear),
    ]
