"""L'assistant de premier démarrage — la porte qui ne se rouvre pas.

Ce qu'il faut tenir dans le temps, et que rien d'autre ne tient :

1. **La garde bascule et reste basculée.** Une configuration initiale ouverte
   après coup est une prise de contrôle offerte à qui trouve l'URL.
2. **La création est entière.** Compte *et* foyer *et* appartenance *et* foyer
   actif. Un compte sans foyer arrive sur une application vide de tout — « un
   demi-succès qui ressemble exactement à un échec » (`create_admin`).
3. **Le refus se dit en 403.** Jamais 401 : aucun identifiant n'ouvrira une
   configuration déjà faite, et 401 veut dire « recommence avec des
   identifiants ».
4. **Le mot de passe est validé.** C'est le premier de l'instance, et il ouvre un
   superutilisateur.
5. **Les deux chemins produisent la même chose** — l'assistant et
   `create_admin` passent par le même service, et ce test le vérifie plutôt que
   de l'espérer.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from households.models import Household, HouseholdMember

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def url():
    return reverse("accounts-setup")


def _payload(**overrides):
    data = {
        "email": "moi@exemple.fr",
        "password": "un-mot-de-passe-solide-42",
        "household_name": "Chez nous",
    }
    data.update(overrides)
    return data


class TestTheDoorOpensOnceAndNeverAgain:
    def test_setup_is_required_on_a_blank_instance(self, client, url):
        assert User.objects.count() == 0
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"required": True, "demo": None}

    def test_setup_stops_being_required_once_an_account_exists(self, client, url, django_user_model):
        django_user_model.objects.create_user(email="deja@la.fr", password="x" * 20)
        assert client.get(url).data == {"required": False, "demo": None}

    def test_a_second_setup_is_refused(self, client, url):
        assert client.post(url, _payload(), format="json").status_code == status.HTTP_201_CREATED

        response = client.post(url, _payload(email="autre@exemple.fr"), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert User.objects.count() == 1

    def test_the_refusal_is_403_and_never_401(self, client, url, django_user_model):
        """401 dirait « identifie-toi et recommence » sur une porte murée.

        DRF convertit un refus de permission en 401 dès qu'un authenticator
        annonce un `WWW-Authenticate` — c'est ce qui a dû être corrigé sur le
        refus d'inscription, et la même erreur serait ici plus trompeuse encore.
        """
        django_user_model.objects.create_user(email="deja@la.fr", password="x" * 20)
        response = client.post(url, _payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestTheFirstAccountIsCreatedWhole:
    def test_it_creates_the_account_its_household_and_the_link(self, client, url):
        response = client.post(url, _payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED

        user = User.objects.get()
        assert user.email == "moi@exemple.fr"
        assert user.is_superuser and user.is_staff

        household = Household.objects.get()
        assert household.name == "Chez nous"
        # Le foyer actif : sans lui, la première page est vide de tout.
        assert user.active_household == household

        membership = HouseholdMember.objects.get()
        assert membership.user == user
        assert membership.household == household
        assert membership.role == HouseholdMember.Role.OWNER

    def test_the_password_actually_works(self, client, url):
        client.post(url, _payload(), format="json")
        user = User.objects.get()
        assert user.check_password("un-mot-de-passe-solide-42")

    def test_the_email_is_normalised(self, client, url):
        client.post(url, _payload(email="  MOI@Exemple.FR  "), format="json")
        assert User.objects.get().email == "moi@exemple.fr"

    def test_the_household_name_has_a_default(self, client, url):
        client.post(url, _payload(household_name=""), format="json")
        assert Household.objects.get().name == "Ma maisonnée"


class TestTheFirstPasswordIsValidated:
    """`set_password` hache n'importe quoi — c'est le défaut de #569, ici aussi."""

    @pytest.mark.parametrize("weak", ["abc", "12345678", "password"])
    def test_a_weak_password_is_refused(self, client, url, weak):
        response = client.post(url, _payload(password=weak), format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.data
        assert User.objects.count() == 0

    def test_a_refused_setup_leaves_the_door_open(self, client, url):
        """Un échec ne doit pas consommer la seule occasion de configurer."""
        client.post(url, _payload(password="abc"), format="json")
        assert client.get(url).data == {"required": True, "demo": None}


class TestTheUnattendedPathAgreesWithTheAssistant:
    """Deux chemins, un seul service — vérifié, pas espéré."""

    def test_create_admin_does_nothing_without_a_password(self, client, url):
        call_command("create_admin", email="scripté@exemple.fr", password="")
        assert User.objects.count() == 0
        # Et l'assistant reste donc la porte d'entrée.
        assert client.get(url).data == {"required": True, "demo": None}

    def test_create_admin_with_a_password_closes_the_assistant(self, client, url):
        call_command(
            "create_admin",
            email="scripté@exemple.fr",
            password="un-mot-de-passe-solide-42",
            household="Le mas",
        )
        assert client.get(url).data == {"required": False, "demo": None}

    @staticmethod
    def _shape():
        """La forme observable du premier compte, **détachée** de ses lignes.

        On relève des valeurs, pas des objets : le test vide la base entre les
        deux chemins, et un `User` gardé en mémoire pointerait ensuite sur un
        foyer supprimé.
        """
        user = User.objects.get()
        membership = HouseholdMember.objects.get()
        return {
            "is_superuser": user.is_superuser,
            "is_staff": user.is_staff,
            "has_usable_password": user.has_usable_password(),
            "household": user.active_household.name,
            "role": membership.role,
            "member_is_the_user": membership.user_id == user.id,
        }

    def test_both_paths_build_the_same_shape(self, client, url):
        call_command(
            "create_admin",
            email="scripté@exemple.fr",
            password="un-mot-de-passe-solide-42",
            household="Le mas",
        )
        by_command = self._shape()

        HouseholdMember.objects.all().delete()
        User.objects.all().delete()
        Household.objects.all().delete()

        client.post(url, _payload(household_name="Le mas"), format="json")
        by_assistant = self._shape()

        assert by_command == by_assistant
