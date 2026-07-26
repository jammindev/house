"""Retire the ``banking`` key from stored household configuration (parcours 26, lot 2).

The « Argent » shell merges ``banking``, ``expenses`` and ``budget`` into a single
``money`` module. ``banking`` was the only one of the three a household could
switch off, so it is the only one that can appear in ``disabled_modules``.

Leaving it there would be a dead key: nothing reads it anymore, and the next person
to open ``disabled_modules`` would find a value that maps to no module — an orphan
of configuration, which is exactly the kind of silent leftover this parcours exists
to remove.

Deliberately **not reversible in effect**: going back would mean guessing which
households had banking off, and the merged module is core anyway.
"""
from django.db import migrations


def drop_banking_key(apps, schema_editor):
    Household = apps.get_model("households", "Household")
    for household in Household.objects.exclude(disabled_modules=[]).iterator():
        disabled = household.disabled_modules or []
        cleaned = [key for key in disabled if key != "banking"]
        if cleaned != disabled:
            household.disabled_modules = cleaned
            household.save(update_fields=["disabled_modules"])


class Migration(migrations.Migration):
    dependencies = [
        ("households", "0010_household_latitude_household_location_label_and_more"),
    ]

    operations = [
        migrations.RunPython(drop_banking_key, migrations.RunPython.noop),
    ]
