"""Turn the short-lived budget *groups* into real ``BudgetCategory`` rows.

A budget that had children was never anything but a heading: the serializer
already refused to let it carry a single expense. So the conversion is
information-preserving — name and ceiling move to the category, the children are
filed under it, and the empty shell is deleted.

Defensively, a parent that *does* carry money (a row predating the rule, or one
written straight through the ORM) is **kept as a budget** and filed under its own
new category. Deleting it would silently detach its expenses to « hors budget »,
and losing the attribution of real euros is not a price a data migration gets to
pay on its own.
"""
from django.db import migrations


def groups_become_categories(apps, schema_editor):
    Budget = apps.get_model("budget", "Budget")
    BudgetCategory = apps.get_model("budget", "BudgetCategory")
    Interaction = apps.get_model("interactions", "Interaction")
    RecurringExpense = apps.get_model("budget", "RecurringExpense")

    parent_ids = (
        Budget.objects.filter(parent__isnull=False)
        .values_list("parent_id", flat=True)
        .distinct()
    )
    for parent in Budget.objects.filter(id__in=list(parent_ids)):
        category = BudgetCategory.objects.create(
            household_id=parent.household_id,
            name=parent.name,
            monthly_amount=parent.monthly_amount,
            created_by_id=parent.created_by_id,
        )
        Budget.objects.filter(parent_id=parent.id).update(
            category_id=category.id, parent_id=None
        )

        carries_money = (
            Interaction.objects.filter(budget_id=parent.id).exists()
            or RecurringExpense.objects.filter(budget_id=parent.id).exists()
        )
        if carries_money:
            # Keep the envelope AND put it in its own category: its euros stay
            # attributed, and the heading it used to be still exists.
            Budget.objects.filter(id=parent.id).update(category_id=category.id)
        else:
            parent.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("budget", "0006_alter_budget_parent_budgetcategory_budget_category_and_more"),
        # Latest, not 0001: the historical model must already carry ``budget_id``
        # for the "does this parent hold real euros?" guard to be able to ask.
        ("interactions", "0028_promote_misplaced_expense_fields"),
    ]

    operations = [
        # Irreversible on purpose: ``parent`` is dropped in the next release, so
        # rebuilding groups from categories would restore a column with no code
        # left to read it. Rolling back this far means restoring a dump.
        migrations.RunPython(groups_become_categories, migrations.RunPython.noop),
    ]
