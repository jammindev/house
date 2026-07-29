# budget/tests/test_categories.py
"""Des catégories de budget — « Maison » au-dessus de « Bricolage ».

Une catégorie est un **type à part**, pas un budget dans un mode particulier.
C'est toute la thèse, et ces tests existent pour qu'elle reste vraie : aucune
dépense ne peut atterrir sur une catégorie, parce que ``Interaction.budget``
pointe vers un ``Budget`` et qu'une catégorie n'en est pas un. Rien à valider,
rien à filtrer dans les six sélecteurs de dépense, et « dépensé » garde
exactement un sens.

⚠️ La classe la plus importante du fichier est ``TestTheChoiceIsActuallySaved``.
La version précédente de cette feature (`Budget.parent`, PR #432) était **morte à
la livraison** : le sérialiseur validait le groupe, le panneau le proposait, et
``create_budget`` — dont la signature est un allowlist — ne l'acceptait pas, donc
la vue le laissait tomber en silence. Seize tests étaient verts, parce qu'ils
construisaient tous leurs parents par ``Budget.objects.create(parent=…)`` en
direct et n'ont jamais fait un POST. **Un test qui écrit par l'ORM ne teste pas
le chemin d'écriture.**
"""
from __future__ import annotations

import itertools
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from django.utils import timezone

from accounts.models import User
from budget.aggregations import compute_budget_overview
from budget.models import Budget, BudgetCategory
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from interactions.services import _resolve_expense_budget

_counter = itertools.count()
BUDGETS_URL = "/api/budget/budgets/"
CATEGORIES_URL = "/api/budget/categories/"


def make_household_user():
    household = Household.objects.create(name=f"Categories {next(_counter)}")
    user = User.objects.create_user(email=f"c-{next(_counter)}@example.com", password="pass1234")
    HouseholdMember.objects.create(
        household=household, user=user, role=HouseholdMember.Role.MEMBER
    )
    user.active_household = household
    user.save(update_fields=["active_household"])
    return household, user


def make_category(household, name, amount=None):
    return BudgetCategory.objects.create(
        household=household,
        name=name,
        monthly_amount=None if amount is None else Decimal(amount),
    )


def make_budget(household, name, amount=None, *, category=None, is_global=False):
    return Budget.objects.create(
        household=household,
        name=name,
        monthly_amount=None if amount is None else Decimal(amount),
        category=category,
        is_global=is_global,
    )


def spend(household, user, budget, amount):
    return Interaction.objects.create(
        household=household,
        created_by=user,
        subject=f"Achat {amount}",
        type="expense",
        amount=Decimal(amount),
        kind="manual",
        budget=budget,
        occurred_at=timezone.now(),
    )


def row_for(overview, name, key="categories"):
    return next(r for r in overview[key] if r["name"] == name)


@pytest.fixture
def context(db):
    household, user = make_household_user()
    client = APIClient()
    client.force_authenticate(user=user)
    return {"household": household, "user": user, "client": client}


class TestTheChoiceIsActuallySaved:
    """Le chemin d'écriture réel, de bout en bout — la classe qui manquait.

    Chaque test ici passe par l'API et **relit en base**. C'est le seul moyen
    d'attraper un champ validé puis jeté par une vue qui recopie ses clés à la
    main.
    """

    def test_creating_a_budget_in_a_category_files_it_there(self, context):
        house = make_category(context["household"], "Maison")

        response = context["client"].post(
            BUDGETS_URL,
            {"name": "Bricolage", "monthly_amount": "200.00", "category_id": str(house.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["category"] == {"id": str(house.id), "name": "Maison"}
        # Et surtout : en base, pas seulement dans la réponse.
        assert Budget.objects.get(name="Bricolage").category_id == house.id

    def test_filing_an_existing_budget_into_a_category_sticks(self, context):
        house = make_category(context["household"], "Maison")
        diy = make_budget(context["household"], "Bricolage", "200")

        response = context["client"].patch(
            f"{BUDGETS_URL}{diy.id}/",
            {"category_id": str(house.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        diy.refresh_from_db()
        assert diy.category_id == house.id

    def test_clearing_the_category_takes_the_budget_out(self, context):
        """Le rangement doit marcher dans les deux sens.

        Un ``None`` explicite sort le budget de sa catégorie ; le filtrer comme
        une valeur vide rendrait le classement à sens unique.
        """
        house = make_category(context["household"], "Maison")
        diy = make_budget(context["household"], "Bricolage", "200", category=house)

        response = context["client"].patch(
            f"{BUDGETS_URL}{diy.id}/", {"category_id": None}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        diy.refresh_from_db()
        assert diy.category_id is None

    def test_a_partial_patch_leaves_the_category_alone(self, context):
        """Renommer un budget ne doit pas le déranger de sa catégorie."""
        house = make_category(context["household"], "Maison")
        diy = make_budget(context["household"], "Bricolage", "200", category=house)

        response = context["client"].patch(
            f"{BUDGETS_URL}{diy.id}/", {"name": "Outillage"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        diy.refresh_from_db()
        assert diy.name == "Outillage"
        assert diy.category_id == house.id

    def test_the_agent_write_path_files_it_too(self, context):
        """Le service est partagé avec l'agent : il doit accepter le champ lui aussi."""
        from budget.services import create_budget

        house = make_category(context["household"], "Maison")
        budget = create_budget(
            context["household"],
            context["user"],
            name="Énergie",
            monthly_amount=Decimal("250"),
            category_id=str(house.id),
        )

        assert Budget.objects.get(pk=budget.pk).category_id == house.id


class TestTheCategoryShowsTheTotal:
    def test_a_category_totals_the_budgets_it_holds(self, context):
        hh, user = context["household"], context["user"]
        house = make_category(hh, "Maison")
        diy = make_budget(hh, "Bricolage", "200", category=house)
        energy = make_budget(hh, "Énergie", "250", category=house)
        spend(hh, user, diy, "120.00")
        spend(hh, user, energy, "220.00")

        overview = compute_budget_overview(household=hh)

        assert row_for(overview, "Maison")["spent"] == "340.00"
        # Sans plafond propre, la catégorie vaut la somme de ce qu'elle range.
        assert row_for(overview, "Maison")["amount"] == "450.00"
        assert row_for(overview, "Maison")["budget_count"] == 2

    def test_the_budget_rows_keep_their_own_figures(self, context):
        """La catégorie totalise **à côté**, elle n'absorbe pas ses budgets.

        Si une ligne de budget se mettait à porter le total de ses voisines,
        quiconque somme ``budgets`` compterait le même euro deux fois.
        """
        hh, user = context["household"], context["user"]
        house = make_category(hh, "Maison")
        diy = make_budget(hh, "Bricolage", "200", category=house)
        energy = make_budget(hh, "Énergie", "250", category=house)
        spend(hh, user, diy, "120.00")
        spend(hh, user, energy, "220.00")

        overview = compute_budget_overview(household=hh)

        assert row_for(overview, "Bricolage", "budgets")["spent"] == "120.00"
        assert row_for(overview, "Énergie", "budgets")["spent"] == "220.00"
        assert row_for(overview, "Bricolage", "budgets")["category_id"] == str(house.id)

    def test_the_category_state_is_measured_on_its_total(self, context):
        """« Maison 420 € / 500 € » peut alerter sans qu'aucun budget n'alerte."""
        hh, user = context["household"], context["user"]
        house = make_category(hh, "Maison", "500")
        diy = make_budget(hh, "Bricolage", "1000", category=house)
        energy = make_budget(hh, "Énergie", "1000", category=house)
        spend(hh, user, diy, "220.00")
        spend(hh, user, energy, "200.00")

        overview = compute_budget_overview(household=hh)

        assert row_for(overview, "Maison")["state"] == "warning"
        assert all(r["state"] == "ok" for r in overview["budgets"])

    def test_an_empty_category_is_uncapped_not_zero(self, context):
        """Un sous-total de rien n'est pas un plafond de 0 €.

        Même raison que pour un budget sans plafond : 0 € est perpétuellement
        dépassé, et une barre rouge sur une catégorie qu'on vient de créer ne dit
        rien de vrai.
        """
        make_category(context["household"], "Maison")

        row = row_for(compute_budget_overview(household=context["household"]), "Maison")

        assert row["amount"] is None
        assert row["state"] == "uncapped"

    def test_a_category_with_no_ceiling_of_its_own_says_so(self, context):
        hh = context["household"]
        house = make_category(hh, "Maison")
        make_budget(hh, "Bricolage", "200", category=house)
        capped = make_category(hh, "Loisirs", "300")
        make_budget(hh, "Cinéma", "100", category=capped)

        overview = compute_budget_overview(household=hh)

        assert row_for(overview, "Maison")["has_own_amount"] is False
        assert row_for(overview, "Loisirs")["has_own_amount"] is True


class TestTheGlobalCeilingIsNotCountedTwice:
    def test_a_capped_category_replaces_its_budgets(self, context):
        """500 € de « Maison » par-dessus 200 € + 250 €, c'est 500 €, pas 950 €.

        Additionner les deux ferait crier « les enveloppes dépassent le plafond
        global » à un foyer parfaitement cohérent.
        """
        hh = context["household"]
        house = make_category(hh, "Maison", "500")
        make_budget(hh, "Bricolage", "200", category=house)
        make_budget(hh, "Énergie", "250", category=house)

        assert compute_budget_overview(household=hh)["named_total_amount"] == "500.00"

    def test_an_uncapped_category_is_worth_what_it_holds(self, context):
        hh = context["household"]
        house = make_category(hh, "Maison")
        make_budget(hh, "Bricolage", "200", category=house)
        make_budget(hh, "Énergie", "250", category=house)

        assert compute_budget_overview(household=hh)["named_total_amount"] == "450.00"

    def test_ungrouped_budgets_still_count(self, context):
        hh = context["household"]
        house = make_category(hh, "Maison", "500")
        make_budget(hh, "Bricolage", "200", category=house)
        make_budget(hh, "Cadeaux", "80")

        assert compute_budget_overview(household=hh)["named_total_amount"] == "580.00"

    def test_the_overshoot_is_still_reported_when_it_is_real(self, context):
        hh = context["household"]
        make_budget(hh, "Global", "300", is_global=True)
        house = make_category(hh, "Maison", "500")
        make_budget(hh, "Bricolage", "200", category=house)

        assert compute_budget_overview(household=hh)["named_exceeds_global"] is True


class TestACategoryIsNotABudget:
    def test_no_expense_can_ever_land_on_a_category(self, context):
        """La séparation est structurelle, pas une règle à faire respecter.

        Une catégorie n'a pas d'id qui puisse arriver comme ``budget_id`` : elle
        vit dans une autre table. C'est exactement ce que l'ancien design payait
        en une requête ``children.exists()`` sur chaque écriture de dépense.
        """
        hh = context["household"]
        house = make_category(hh, "Maison")

        with pytest.raises(ValueError, match="not found"):
            _resolve_expense_budget(hh.id, str(house.id))

    def test_a_budget_inside_a_category_stays_a_valid_target(self, context):
        """Ranger une enveloppe ne la retire pas des sélecteurs de dépense.

        C'est la régression centrale de l'ancien design : un budget qui recevait
        des enfants cessait, en silence, de pouvoir recevoir des dépenses.
        """
        hh = context["household"]
        house = make_category(hh, "Maison")
        diy = make_budget(hh, "Bricolage", "200", category=house)

        assert _resolve_expense_budget(hh.id, str(diy.id)) == diy

    def test_a_budget_that_carries_money_can_still_be_filed(self, context):
        """L'autre régression : classer une enveloppe déjà utilisée était refusé."""
        hh, user = context["household"], context["user"]
        house = make_category(hh, "Maison")
        diy = make_budget(hh, "Bricolage", "200")
        spend(hh, user, diy, "50.00")

        response = context["client"].patch(
            f"{BUDGETS_URL}{diy.id}/", {"category_id": str(house.id)}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        diy.refresh_from_db()
        assert diy.category_id == house.id


class TestTheShapeOfTheFiling:
    def test_a_category_from_another_household_is_refused(self, context):
        other_household, _ = make_household_user()
        theirs = make_category(other_household, "Chez eux")

        response = context["client"].post(
            BUDGETS_URL,
            {"name": "Bricolage", "category_id": str(theirs.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "category_id" in response.data

    def test_an_unknown_category_is_refused(self, context):
        response = context["client"].post(
            BUDGETS_URL,
            {"name": "Bricolage", "category_id": "3f4e0f2e-0000-4000-8000-000000000000"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_the_global_budget_is_filed_under_nothing(self, context):
        """Il plafonne déjà toutes les catégories : le ranger dans l'une d'elles
        en ferait un membre de ce qu'il mesure."""
        house = make_category(context["household"], "Maison")

        response = context["client"].post(
            BUDGETS_URL,
            {
                "name": "Global",
                "monthly_amount": "1000.00",
                "is_global": True,
                "category_id": str(house.id),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "category_id" in response.data

    def test_two_categories_cannot_share_a_name(self, context):
        make_category(context["household"], "Maison")

        response = context["client"].post(
            CATEGORIES_URL, {"name": "Maison"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.data

    def test_a_category_ceiling_of_zero_is_refused(self, context):
        """Zéro n'est pas « pas de plafond » : c'est un plafond toujours dépassé."""
        response = context["client"].post(
            CATEGORIES_URL, {"name": "Maison", "monthly_amount": "0"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestDeletingACategoryFreesItsBudgets:
    def test_the_budgets_survive_unfiled(self, context):
        """Un intitulé qui disparaît n'emporte pas les enveloppes qui portent l'argent."""
        hh, user = context["household"], context["user"]
        house = make_category(hh, "Maison")
        diy = make_budget(hh, "Bricolage", "200", category=house)
        spend(hh, user, diy, "120.00")

        response = context["client"].delete(f"{CATEGORIES_URL}{house.id}/")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        diy.refresh_from_db()
        assert diy.category_id is None
        assert diy.monthly_amount == Decimal("200")
        # Et l'euro dépensé reste attribué à son enveloppe.
        assert row_for(
            compute_budget_overview(household=hh), "Bricolage", "budgets"
        )["spent"] == "120.00"

    def test_the_category_list_is_scoped_to_the_household(self, context):
        other_household, _ = make_household_user()
        make_category(other_household, "Chez eux")
        make_category(context["household"], "Maison")

        response = context["client"].get(CATEGORIES_URL)

        rows = response.data["results"] if isinstance(response.data, dict) else response.data
        assert [row["name"] for row in rows] == ["Maison"]


class TestTheGlobalBudgetStaysFiledUnderNothing:
    def test_promoting_a_filed_budget_to_global_unfiles_it(self, context):
        """L'invariant ne doit pas dépendre des clés que le client a envoyées.

        Refuser `category_id` sur un budget global ne suffit pas : un PATCH qui
        ne parle que d'`is_global` n'atteint jamais ce contrôle, et laissait un
        budget global rangé dans une catégorie — c'est-à-dire membre de ce qu'il
        mesure.
        """
        hh = context["household"]
        house = make_category(hh, "Maison")
        diy = make_budget(hh, "Bricolage", "200", category=house)

        response = context["client"].patch(
            f"{BUDGETS_URL}{diy.id}/", {"is_global": True}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        diy.refresh_from_db()
        assert diy.is_global is True
        assert diy.category_id is None

    def test_the_agent_can_file_a_budget_at_creation(self, context):
        """Le mapping de l'agent est un allowlist lui aussi.

        Même classe de défaut que celle qui a tué la PR #432 : un champ absent
        du mapping est jeté sans un mot.
        """
        from budget.apps import _create_budget_from_agent

        house = make_category(context["household"], "Maison")
        budget = _create_budget_from_agent(
            context["household"],
            context["user"],
            {"name": "Énergie", "monthly_amount": "250", "category_id": str(house.id)},
        )

        assert Budget.objects.get(pk=budget.pk).category_id == house.id

    def test_listing_categories_costs_one_query_per_page(self, context, django_assert_max_num_queries):
        """``budget_count`` est annoté, pas compté par ligne."""
        hh = context["household"]
        for name in ("Maison", "Loisirs", "Santé"):
            category = make_category(hh, name)
            make_budget(hh, f"Budget {name}", "100", category=category)

        with django_assert_max_num_queries(4):
            response = context["client"].get(CATEGORIES_URL)

        rows = response.data["results"] if isinstance(response.data, dict) else response.data
        assert sorted(r["budget_count"] for r in rows) == [1, 1, 1]
