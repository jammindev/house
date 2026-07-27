# interactions/tests/test_repairs.py
"""La réparation des dépenses restées à 0 €.

L'ancien formulaire du journal écrivait le montant dans `metadata` alors que
c'est une colonne depuis `0023`/`0024`. Rien ne lisait plus cette clé : la
dépense valait **0 €** dans tous les budgets, tous les totaux et tous les
bilans, sans que rien ne le signale. C'est le pire genre de défaut — il ne
produit pas d'erreur, il produit un chiffre faux.
"""
from __future__ import annotations

from decimal import Decimal

import pytest
from django.utils import timezone

from households.models import Household
from interactions.models import Interaction
from interactions.repairs import promote_misplaced_expense_fields

from accounts.tests.factories import UserFactory


@pytest.fixture
def household(db):
    return Household.objects.create(name="Repairs House")


def make(household, **kwargs):
    defaults = {
        "subject": "Restaurant",
        "type": "expense",
        "occurred_at": timezone.now(),
    }
    return Interaction.objects.create(household=household, **{**defaults, **kwargs})


def run():
    return promote_misplaced_expense_fields(Interaction)


@pytest.mark.django_db
class TestPromotingWhatWasMisplaced:
    def test_a_zero_euro_expense_recovers_its_amount(self, household):
        expense = make(household, metadata={"amount": "32.00", "supplier": "Le Bistrot"})

        stats = run()
        expense.refresh_from_db()

        assert expense.amount == Decimal("32.00")
        assert expense.supplier == "Le Bistrot"
        assert stats["amount_promoted"] == 1
        assert stats["supplier_promoted"] == 1

    def test_the_keys_are_removed_afterwards(self, household):
        """Les laisser garderait vivante la source du malentendu."""
        expense = make(household, metadata={"amount": "32.00", "supplier": "Le Bistrot"})

        run()
        expense.refresh_from_db()

        assert "amount" not in expense.metadata
        assert "supplier" not in expense.metadata

    def test_the_column_always_wins(self, household):
        """Une clé JSON à côté d'une colonne renseignée est un résidu, pas une correction."""
        expense = make(
            household,
            amount=Decimal("50.00"),
            supplier="Vrai",
            metadata={"amount": "9999.00", "supplier": "Faux"},
        )

        run()
        expense.refresh_from_db()

        assert expense.amount == Decimal("50.00")
        assert expense.supplier == "Vrai"
        assert expense.metadata == {}

    def test_an_unreadable_amount_is_left_absent(self, household):
        """Un montant faux est pire qu'un montant absent — celui-là, au moins, se voit."""
        expense = make(household, metadata={"amount": "beaucoup"})

        stats = run()
        expense.refresh_from_db()

        assert expense.amount is None
        assert stats["unreadable"] == 1

    def test_other_metadata_survives(self, household):
        expense = make(
            household,
            metadata={"amount": "12.00", "source_name": "Stock", "unit_price": "3.00"},
        )

        run()
        expense.refresh_from_db()

        assert expense.metadata == {"source_name": "Stock", "unit_price": "3.00"}

    def test_a_renovation_entry_is_never_touched(self, household):
        """Le carnet de rénovation garde ses clés — elles ne sont pas des colonnes.

        Une entrée de carnet porte un ``type`` curaté (ici ``installation``) et
        son discriminateur en ``metadata.kind`` : la réparation ne filtre que
        ``type='expense'``, exactement comme ``0024``.
        """
        note = make(
            household,
            type="installation",
            subject="Fenêtres",
            metadata={"kind": "renovation", "amount": "800.00"},
        )

        run()
        note.refresh_from_db()

        assert note.metadata == {"kind": "renovation", "amount": "800.00"}

    def test_running_it_twice_changes_nothing(self, household):
        expense = make(household, metadata={"amount": "32.00"})

        run()
        second = run()
        expense.refresh_from_db()

        assert expense.amount == Decimal("32.00")
        assert second == {
            "scanned": 0,
            "amount_promoted": 0,
            "supplier_promoted": 0,
            "unreadable": 0,
        }

    def test_a_healthy_expense_is_not_even_scanned(self, household):
        make(household, amount=Decimal("20.00"), metadata={"source_name": "Stock"})

        assert run()["scanned"] == 0


@pytest.mark.django_db
class TestItActuallyFixesTheFigures:
    """La preuve qui compte : le budget cesse d'ignorer la dépense."""

    def test_the_expense_summary_counts_it_again(self, household):
        from interactions.aggregations import compute_expense_summary

        user = UserFactory()
        make(household, created_by=user, metadata={"amount": "32.00"})

        before = compute_expense_summary(
            household_id=household.id, from_dt=None, to_dt=None
        )
        run()
        after = compute_expense_summary(household_id=household.id, from_dt=None, to_dt=None)

        assert before["total"] == "0.00"
        assert after["total"] == "32.00"
