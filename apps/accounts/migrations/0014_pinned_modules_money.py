"""Fold the three money pins into ``money`` (parcours 26, lot 2).

``User.pinned_modules`` holds navigation keys. The « Argent » shell replaces
``banking``, ``expenses`` and ``budget`` with a single ``money`` entry, so a user
who had pinned any of them must keep a pin — otherwise their sidebar silently
loses a shortcut they put there on purpose, with nothing to tell them why.

Order is preserved: ``money`` takes the position of the **first** of the three
keys found, so a user who had « Dépenses » at the top still finds « Argent » at the
top. Duplicates are collapsed (someone who pinned both budget and banking gets one
entry, not two).
"""
from django.db import migrations

LEGACY = ("banking", "expenses", "budget")


def fold_into_money(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.exclude(pinned_modules=[]).iterator():
        pinned = user.pinned_modules or []
        if not any(key in LEGACY for key in pinned):
            continue

        folded = []
        for key in pinned:
            replacement = "money" if key in LEGACY else key
            if replacement not in folded:
                folded.append(replacement)

        user.pinned_modules = folded
        user.save(update_fields=["pinned_modules"])


def unfold_from_money(apps, schema_editor):
    """Best effort rollback: ``money`` becomes ``expenses``.

    Which of the three the user had pinned is not recoverable — the information was
    collapsed on purpose. ``expenses`` is the least surprising landing spot, and it
    was core (so always visible) unlike ``banking``.
    """
    User = apps.get_model("accounts", "User")
    for user in User.objects.exclude(pinned_modules=[]).iterator():
        pinned = user.pinned_modules or []
        if "money" not in pinned:
            continue
        user.pinned_modules = ["expenses" if key == "money" else key for key in pinned]
        user.save(update_fields=["pinned_modules"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0013_user_digest_disabled_sections"),
    ]

    operations = [
        migrations.RunPython(fold_into_money, unfold_from_money),
    ]
