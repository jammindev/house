"""Point the ``money`` pin at a page of the « Argent » group (issue #562).

``User.pinned_modules`` holds navigation keys, and the serializer refuses any key
that is not pinnable. Splitting ``money`` into three pages therefore leaves a
stored key that matches nothing — and it does not fail quietly: the sidebar sends
the **whole** list back on the next pin toggle, so a user who never touched money
would get a 400 on an unrelated shortcut. A dead key here is not cosmetic.

The pin is moved rather than dropped, for the reason migration 0014 gave when it
folded the three keys into one: a shortcut the user put there on purpose must not
disappear with nothing to explain why. It lands on ``money_budgets`` — the first
page of the group and where ``/app/money`` now leads — and keeps its position in
the list.
"""
from django.db import migrations

MONEY_PAGES = ("money_budgets", "money_expenses", "money_accounts")
DEFAULT_PAGE = "money_budgets"


def split_money_pin(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.exclude(pinned_modules=[]).iterator():
        pinned = user.pinned_modules or []
        if "money" not in pinned:
            continue

        split = []
        for key in pinned:
            replacement = DEFAULT_PAGE if key == "money" else key
            if replacement not in split:
                split.append(replacement)

        user.pinned_modules = split
        user.save(update_fields=["pinned_modules"])


def fold_back_into_money(apps, schema_editor):
    """Rollback: any of the three pages becomes ``money`` again, collapsed."""
    User = apps.get_model("accounts", "User")
    for user in User.objects.exclude(pinned_modules=[]).iterator():
        pinned = user.pinned_modules or []
        if not any(key in MONEY_PAGES for key in pinned):
            continue

        folded = []
        for key in pinned:
            replacement = "money" if key in MONEY_PAGES else key
            if replacement not in folded:
                folded.append(replacement)

        user.pinned_modules = folded
        user.save(update_fields=["pinned_modules"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0017_device_token"),
    ]

    operations = [
        migrations.RunPython(split_money_pin, fold_back_into_money),
    ]
