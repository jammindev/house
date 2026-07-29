"""La conversion groupes → catégories (`budget.0007`) — testée sur de vraies lignes.

Une migration de données est le seul code qui s'exécute **une fois**, sur les
données réelles, sans personne pour regarder. Ici l'échec serait silencieux par
nature : un foyer qui avait groupé ses enveloppes les retrouverait éparpillées,
sans rien pour l'expliquer.

La migration n'est pas rejouée (la base de test l'a déjà appliquée) : sa
transformation est importée et exercée directement sur les modèles réels — ce qui
est possible parce que `Budget.parent` survit délibérément un déploiement avant
d'être supprimé.
"""
from __future__ import annotations

import importlib
from decimal import Decimal

import pytest
from django.utils import timezone

from budget.models import Budget, BudgetCategory, RecurringExpense
from interactions.models import Interaction

from .test_categories import make_budget, make_household_user

migration = importlib.import_module("budget.migrations.0007_groups_become_categories")


class FakeApps:
    """`apps.get_model` du contexte de migration, câblé sur les modèles réels."""

    _MODELS = {
        ("budget", "Budget"): Budget,
        ("budget", "BudgetCategory"): BudgetCategory,
        ("budget", "RecurringExpense"): RecurringExpense,
        ("interactions", "Interaction"): Interaction,
    }

    def get_model(self, app_label, model_name):
        return self._MODELS[(app_label, model_name)]


def run_migration():
    migration.groups_become_categories(FakeApps(), None)


@pytest.mark.django_db
class TestGroupsBecomeCategories:
    def test_a_parent_becomes_a_category_and_its_children_are_filed(self):
        hh, _ = make_household_user()
        house = make_budget(hh, "Maison", "500")
        diy = make_budget(hh, "Bricolage", "200")
        energy = make_budget(hh, "Énergie", "250")
        Budget.objects.filter(pk__in=[diy.pk, energy.pk]).update(parent_id=house.pk)

        run_migration()

        category = BudgetCategory.objects.get(household=hh, name="Maison")
        # Le plafond du groupe suit : une catégorie peut en porter un.
        assert category.monthly_amount == Decimal("500.00")
        diy.refresh_from_db()
        energy.refresh_from_db()
        assert diy.category_id == category.id
        assert energy.category_id == category.id
        assert diy.parent_id is None
        # La coquille vide disparaît — elle n'a jamais été qu'un intitulé.
        assert not Budget.objects.filter(pk=house.pk).exists()

    def test_an_uncapped_group_becomes_an_uncapped_category(self):
        hh, _ = make_household_user()
        house = make_budget(hh, "Maison")
        diy = make_budget(hh, "Bricolage", "200")
        Budget.objects.filter(pk=diy.pk).update(parent_id=house.pk)

        run_migration()

        assert BudgetCategory.objects.get(household=hh, name="Maison").monthly_amount is None

    def test_a_parent_that_carries_money_is_kept_as_a_budget(self):
        """Le garde-fou défensif : on ne détache jamais de vrais euros en silence.

        La règle de la PR #432 interdisait à un parent de porter des dépenses,
        mais une ligne écrite directement par l'ORM, ou antérieure à la règle,
        existe peut-être. La supprimer détacherait ses dépenses vers « hors
        budget » — perdre l'attribution d'euros réels n'est pas un prix qu'une
        migration décide toute seule de payer.
        """
        hh, user = make_household_user()
        house = make_budget(hh, "Maison", "500")
        diy = make_budget(hh, "Bricolage", "200")
        Budget.objects.filter(pk=diy.pk).update(parent_id=house.pk)
        Interaction.objects.create(
            household=hh,
            created_by=user,
            subject="Achat sur le parent",
            type="expense",
            amount=Decimal("42.00"),
            kind="manual",
            budget=house,
            occurred_at=timezone.now(),
        )

        run_migration()

        category = BudgetCategory.objects.get(household=hh, name="Maison")
        house.refresh_from_db()
        # L'enveloppe survit, rangée dans la catégorie qu'elle était.
        assert house.category_id == category.id
        assert Interaction.objects.get(subject="Achat sur le parent").budget_id == house.pk

    def test_a_budget_with_no_group_is_left_alone(self):
        hh, _ = make_household_user()
        gifts = make_budget(hh, "Cadeaux", "80")

        run_migration()

        gifts.refresh_from_db()
        assert gifts.category_id is None
        assert not BudgetCategory.objects.filter(household=hh).exists()

    def test_each_household_keeps_its_own(self):
        hh_a, _ = make_household_user()
        hh_b, _ = make_household_user()
        for hh in (hh_a, hh_b):
            parent = make_budget(hh, "Maison", "500")
            child = make_budget(hh, "Bricolage", "200")
            Budget.objects.filter(pk=child.pk).update(parent_id=parent.pk)

        run_migration()

        assert BudgetCategory.objects.filter(household=hh_a).count() == 1
        assert BudgetCategory.objects.filter(household=hh_b).count() == 1
        # Le nom est unique **par foyer** : les deux « Maison » coexistent.
        assert BudgetCategory.objects.filter(name="Maison").count() == 2
