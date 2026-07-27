# interactions/tests/test_purchase_budget.py
"""Le budget se saisit sur **tous** les formulaires d'achat.

`Interaction.budget` est le seul axe qui classe un euro (projet et zone disent
*sur quoi* et *où*, pas *de quelle nature*), et le détecteur
`expense_without_budget` en réclame un sur chaque dépense de la fenêtre. Or les
cinq chemins d'achat de l'app — stock, équipement, projet, poule, liste de
courses — créaient jusqu'ici des dépenses sans budget, **sans même offrir le
champ**. L'app fabriquait donc ses propres écarts, un par achat, à charge de
l'utilisateur d'aller tous les réparer ailleurs.

Ces tests tiennent les deux moitiés de la correction : le budget arrive bien
jusqu'à l'interaction, et un budget qui n'est pas au foyer est un **400**, pas
un 500 — la résolution lève un `ValueError`, qui sorti d'une vue est une erreur
serveur sur une simple erreur client.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from budget.models import Budget
from chickens.models import Chicken
from equipment.models import Equipment
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from projects.models import Project
from shopping.models import ShoppingListItem
from stock.models import StockCategory, StockItem
from zones.models import Zone

_counter = itertools.count()


def make_household_user():
    household = Household.objects.create(name=f"Budget forms {next(_counter)}")
    user = User.objects.create_user(email=f"u-{next(_counter)}@example.com", password="pass1234")
    HouseholdMember.objects.create(
        household=household, user=user, role=HouseholdMember.Role.MEMBER
    )
    user.active_household = household
    user.save(update_fields=["active_household"])
    return household, user


def make_budget(household, name="Bricolage", *, is_global=False):
    return Budget.objects.create(
        household=household,
        name=name,
        monthly_amount=Decimal("400.00"),
        is_global=is_global,
    )


def api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def context(db):
    household, user = make_household_user()
    return {
        "household": household,
        "user": user,
        "budget": make_budget(household),
        "client": api(user),
    }


def zone_of(household):
    return Zone.objects.create(household=household, name="Maison")


# --- Un budget par chemin d'achat --------------------------------------------


class TestEveryPurchaseFormCarriesItsBudget:
    """Cinq chemins, une seule attente : l'enveloppe choisie arrive à l'écriture."""

    def test_stock_purchase(self, context):
        category = StockCategory.objects.create(
            household=context["household"], name="Consommables"
        )
        item = StockItem.objects.create(
            household=context["household"], category=category, name="Vis", unit="boîte", quantity=0
        )

        response = context["client"].post(
            f"/api/stock/{item.id}/purchase/",
            {"delta": "2", "amount": "19.90", "budget_id": str(context["budget"].id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        expense = Interaction.objects.get(id=response.data["interaction_id"])
        assert expense.budget_id == context["budget"].id

    def test_equipment_purchase(self, context):
        equipment = Equipment.objects.create(
            household=context["household"], name="Perceuse", zone=zone_of(context["household"])
        )

        response = context["client"].post(
            f"/api/equipment/{equipment.id}/register-purchase/",
            {"amount": "89.00", "budget_id": str(context["budget"].id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        expense = Interaction.objects.get(id=response.data["interaction_id"])
        assert expense.budget_id == context["budget"].id

    def test_project_purchase(self, context):
        project = Project.objects.create(household=context["household"], title="Salle de bain")

        response = context["client"].post(
            f"/api/projects/projects/{project.id}/register-purchase/",
            {"amount": "150.00", "budget_id": str(context["budget"].id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        expense = Interaction.objects.get(id=response.data["interaction_id"])
        assert expense.budget_id == context["budget"].id

    def test_chicken_purchase(self, context):
        chicken = Chicken.objects.create(household=context["household"], name="Roussette")

        response = context["client"].post(
            f"/api/chickens/{chicken.id}/purchase/",
            {"amount": "24.00", "budget_id": str(context["budget"].id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        expense = Interaction.objects.get(id=response.data["interaction_id"])
        assert expense.budget_id == context["budget"].id

    def test_shopping_commit(self, context):
        line = ShoppingListItem.objects.create(
            household=context["household"], label="Farine", quantity=1
        )
        StockCategory.objects.create(household=context["household"], name="Épicerie")

        response = context["client"].post(
            f"/api/shopping/items/{line.id}/commit-to-stock/",
            {
                "delta": "1",
                "amount": "3.20",
                "category": "Épicerie",
                "budget_id": str(context["budget"].id),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        expense = Interaction.objects.filter(type="expense").latest("created_at")
        assert expense.budget_id == context["budget"].id


# --- Et l'erreur client reste une erreur client -------------------------------


class TestABadBudgetIsA400:
    """Le résolveur lève un ``ValueError`` ; sorti d'une vue, c'est un 500.

    C'est exactement la régression que `set_allocations` avait déjà connue : un
    mauvais id renvoyé par un client donnait une erreur serveur sur ce qui est
    une faute de saisie. Le garde-fou vaut pour les cinq chemins, il est testé
    sur deux — l'un qui passe par une vue, l'autre par un service intermédiaire.
    """

    def test_a_budget_from_another_household_is_refused(self, context):
        other_household, _ = make_household_user()
        stranger = make_budget(other_household, name="Chez le voisin")
        project = Project.objects.create(household=context["household"], title="Terrasse")

        response = context["client"].post(
            f"/api/projects/projects/{project.id}/register-purchase/",
            {"amount": "10.00", "budget_id": str(stranger.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "budget_id" in response.data
        assert not Interaction.objects.filter(type="expense").exists()

    def test_the_global_budget_is_refused(self, context):
        """Le plafond global couvre tout : il n'est la catégorie de rien."""
        overall = make_budget(context["household"], name="Global", is_global=True)
        category = StockCategory.objects.create(
            household=context["household"], name="Consommables"
        )
        item = StockItem.objects.create(
            household=context["household"], category=category, name="Vis", unit="boîte", quantity=0
        )

        response = context["client"].post(
            f"/api/stock/{item.id}/purchase/",
            {"delta": "1", "amount": "5.00", "budget_id": str(overall.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        # ⚠️ L'achat est refusé **en entier** : le budget est validé avant que
        # quoi que ce soit ne soit écrit. Incrémenter le stock puis échouer sur
        # l'enveloppe laisserait une quantité fausse et aucune dépense.
        item.refresh_from_db()
        assert item.quantity == 0


class TestTheBudgetStaysOptional:
    """Ne pas choisir reste possible — le Contrôle le signalera, pas le formulaire.

    Exiger un budget à la saisie transformerait chaque achat pressé en cul-de-sac.
    L'écart `expense_without_budget` existe précisément pour rattraper ça plus tard.
    """

    def test_a_purchase_without_budget_still_works(self, context):
        project = Project.objects.create(household=context["household"], title="Jardin")

        response = context["client"].post(
            f"/api/projects/projects/{project.id}/register-purchase/",
            {"amount": "42.00"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        expense = Interaction.objects.get(id=response.data["interaction_id"])
        assert expense.budget_id is None
