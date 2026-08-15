"""Un total à zéro ne suffit pas : il faut savoir *pourquoi* il vaut zéro.

C'est la quatrième fois que ce projet rencontre le même défaut — après
`coverage.window_status()`, `inflow_nature == ""` et `Document.purpose` vide.
Le résumé d'alertes le rencontrait à son tour, et sous sa forme la plus
trompeuse : un foyer né trente secondes plus tôt s'entendait dire « tout est
sous contrôle, rien ne demande votre attention ».

Ce que ces tests tiennent :

1. **Le zéro porte sa raison**, dans la même réponse — pas dans un second appel
   qui pourrait arriver après et faire clignoter l'écran d'un état à l'autre.
2. **La zone racine ne remplit pas un foyer.** Un ``post_save`` en crée une à la
   naissance ; sans ce test, le booléen serait vrai pour tout le monde dès le
   premier jour, et rien ne le signalerait.
3. **La mesure porte sur le foyer**, pas sur le lecteur ni sur ses voisins.
4. **Elle est mesurée, jamais déclarée** — cocher une case du tutoriel ne
   remplit pas un foyer.
"""
from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from alerts.services import build_alerts_summary, household_has_content
from households.models import Household, HouseholdMember
from zones.models import Zone

pytestmark = pytest.mark.django_db


@pytest.fixture
def household():
    return Household.objects.create(name="Chez nous")


@pytest.fixture
def owner(household):
    user = UserFactory()
    HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )
    return user


@pytest.fixture
def client(owner):
    api = APIClient()
    api.force_authenticate(user=owner)
    return api


def _root(household):
    return Zone.objects.get(household=household, parent__isnull=True)


class TestTheRootZoneDoesNotCountAsContent:
    """Le piège qui rendrait tout le mécanisme muet.

    ``households.signals.create_root_zone_for_household`` crée une zone
    « Maison » à la naissance du foyer. Un ``EXISTS`` naïf sur ``Zone`` serait
    donc vrai partout, ce booléen vaudrait toujours « non vide », et l'écran
    continuerait d'annoncer « tout est sous contrôle » — sans qu'aucun test ne
    rougisse.
    """

    def test_a_brand_new_household_already_owns_a_zone(self, household):
        assert Zone.objects.filter(household=household).count() == 1
        assert household_has_content(household) is False

    def test_a_zone_somebody_created_does_count(self, household):
        Zone.objects.create(household=household, name="Cuisine")
        assert household_has_content(household) is True

    def test_the_criterion_holds_because_the_model_guarantees_it(self, household):
        """``Zone.save()`` rattache toute zone sans parent à la racine.

        C'est ce qui rend « une zone avec un parent » un critère solide plutôt
        qu'une convention : on ne peut pas créer une seconde zone orpheline.
        """
        cuisine = Zone.objects.create(household=household, name="Cuisine")
        assert cuisine.parent_id == _root(household).id
        assert Zone.objects.filter(household=household, parent__isnull=True).count() == 1


class TestAZeroCarriesItsReason:
    def test_a_brand_new_household_is_flagged_empty(self, household):
        summary = build_alerts_summary(household)
        assert summary["total"] == 0
        assert summary["household_is_empty"] is True

    def test_the_two_states_are_told_apart(self, household):
        """Le cœur du sujet : deux foyers, deux zéros, deux sens.

        Sans ce champ, l'écran rend la même phrase dans les deux cas — et c'est
        la phrase rassurante qui gagne.
        """
        avant = build_alerts_summary(household)
        Zone.objects.create(household=household, name="Cuisine")
        apres = build_alerts_summary(household)

        assert avant["total"] == apres["total"] == 0
        assert avant["household_is_empty"] is True
        assert apres["household_is_empty"] is False

    @pytest.mark.parametrize("kind", ["equipment", "task", "interaction", "account"])
    def test_any_of_the_five_tables_is_enough(self, household, owner, kind):
        """La checklist propose sept portes d'entrée ; en franchir une suffit."""
        if kind == "equipment":
            from equipment.models import Equipment

            Equipment.objects.create(household=household, name="Chaudière")
        elif kind == "task":
            from tasks.models import Task

            Task.objects.create(household=household, created_by=owner, subject="Tondre")
        elif kind == "interaction":
            from django.utils import timezone

            from interactions.models import Interaction

            # `occurred_at` est requis par contrainte de base : une entrée de
            # journal sans date n'est pas une entrée de journal.
            Interaction.objects.create(
                household=household,
                created_by=owner,
                type="note",
                subject="Une note",
                occurred_at=timezone.now(),
            )
        else:
            from banking.models import BankAccount

            BankAccount.objects.create(household=household, name="Compte courant")

        assert household_has_content(household) is True


class TestTheMeasureIsScopedToTheHousehold:
    def test_a_neighbours_content_does_not_fill_mine(self, household):
        voisin = Household.objects.create(name="Chez le voisin")
        Zone.objects.create(household=voisin, name="Salon du voisin")

        assert household_has_content(voisin) is True
        assert household_has_content(household) is False


class TestItIsMeasuredAndNotDeclared:
    def test_ticking_a_tutorial_box_does_not_fill_a_household(self, household, owner):
        """La progression du tutoriel est déclarative — elle dit ce que
        l'utilisateur a coché, pas ce que le foyer contient. Les deux divergent
        au premier oubli comme à la première case cochée par curiosité."""
        owner.completed_tutorials = ["create-zone", "add-equipment", "first-task"]
        owner.save(update_fields=["completed_tutorials"])

        assert household_has_content(household) is False


class TestTheEndpointServesIt:
    def test_the_summary_endpoint_carries_the_flag(self, client):
        response = client.get(reverse("alerts-summary"))
        assert response.status_code == status.HTTP_200_OK
        # Dans la **même** réponse que le total : un second appel arriverait
        # après, et l'écran passerait de « tout va bien » à « bienvenue » sous
        # les yeux du lecteur.
        assert response.data["total"] == 0
        assert response.data["household_is_empty"] is True
