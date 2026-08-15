"""Ancrage physique d'une zone — jeton, scan, planche d'étiquettes (parcours 31, lot 1).

Trois invariants, et chacun défend une promesse différente :

1. **chaque zone a son propre jeton** — sinon la maison entière n'est qu'une seule
   pièce aux yeux du jeu, et c'est la migration qui décide ;
2. **le jeton ne sort que par la planche d'impression** — un jeton lisible sans se
   déplacer n'est plus une preuve de présence ;
3. **un jeton d'un autre foyer se refuse en le disant** — un 404 enverrait
   chercher une étiquette abîmée qui n'existe pas.

Style et fixtures calqués sur `test_zone_ordering.py`.
"""
import importlib

import pytest
from django.apps import apps as django_apps
from django.db import connection
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from zones import qr
from zones.models import Zone, generate_zone_token
from zones.services import UnknownZoneToken, resolve_qr_token, rotate_qr_token


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


@pytest.fixture
def owner(db):
    return UserFactory(email="zones-qr-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = Household.objects.create(name="QR House")
    _membership(owner, instance)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def stranger(db):
    """Un membre d'un **autre** foyer, avec son propre foyer actif."""
    user = UserFactory(email="zones-qr-stranger@example.com")
    other = Household.objects.create(name="Other House")
    _membership(user, other)
    user.active_household = other
    user.save(update_fields=["active_household"])
    return user


def _root(household):
    return Zone.objects.get(household=household, parent__isnull=True)


def _zone(household, name, owner, parent=None):
    return Zone.objects.create(
        household=household, name=name, parent=parent, created_by=owner
    )


class TestTheBackfillGivesEachZoneItsOwnToken:
    """Régression de la migration `0008_zone_qr_token`.

    Django n'évalue le `default` d'une `AddField` qu'**une fois** et le pose sur
    toutes les lignes par un unique `ALTER TABLE`. Le seul remplissage correct
    boucle sur les lignes — et c'est exactement ce que ces deux tests tiennent,
    l'un sur le comportement, l'autre sur la forme.
    """

    def test_every_existing_zone_gets_a_distinct_token(self, household, owner):
        for name in ("Cuisine", "Salon", "Garage", "Buanderie"):
            _zone(household, name, owner)

        # On remet la colonne dans l'état d'avant le remplissage. Le DDL est
        # transactionnel sous PostgreSQL : pytest-django annule tout à la sortie.
        #
        # `SET CONSTRAINTS ALL IMMEDIATE` d'abord : les FK différées des zones
        # qu'on vient de créer sont encore en attente dans la transaction, et
        # PostgreSQL refuse d'altérer une table qui porte des « pending trigger
        # events ».
        with connection.cursor() as cursor:
            cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
            cursor.execute("ALTER TABLE zones ALTER COLUMN qr_token DROP NOT NULL")
            cursor.execute("UPDATE zones SET qr_token = NULL")

        migration = importlib.import_module("zones.migrations.0008_zone_qr_token")
        migration.assign_tokens(django_apps, None)

        tokens = list(Zone.objects.values_list("qr_token", flat=True))
        assert all(tokens), "une zone est restée sans jeton"
        assert len(set(tokens)) == len(tokens), (
            "deux zones partagent le même jeton — le remplissage n'a pas bouclé "
            "sur les lignes"
        )

    def test_the_migration_adds_the_column_before_making_it_unique(self):
        """La forme, pas seulement le résultat.

        Un `makemigrations` qui « simplifierait » ce fichier en une seule
        `AddField(unique=True, default=…)` repasserait le test de comportement
        ci-dessus (il n'y a pas de lignes préexistantes en test) tout en cassant
        la migration sur une base réelle. Seule la forme l'attrape.
        """
        migration = importlib.import_module("zones.migrations.0008_zone_qr_token")
        kinds = [op.__class__.__name__ for op in migration.Migration.operations]
        assert kinds == ["AddField", "RunPython", "AlterField"], kinds

        add_field = migration.Migration.operations[0]
        assert not add_field.field.unique, "la colonne ne doit pas naître unique"
        assert add_field.field.null, "la colonne doit naître nullable"
        assert not add_field.field.has_default(), (
            "un default appelable sur l'AddField donnerait le même jeton à toutes "
            "les zones existantes"
        )


class TestTheTokenNeverLeaks:
    """Le jeton ne sort que par la planche d'impression."""

    def test_the_zone_crud_never_returns_the_token(self, household, owner, owner_client):
        zone = _zone(household, "Cave", owner)

        listing = owner_client.get(reverse("zone-list"))
        assert listing.status_code == status.HTTP_200_OK
        assert "qr_token" not in str(listing.data)

        detail = owner_client.get(reverse("zone-detail", args=[zone.id]))
        assert detail.status_code == status.HTTP_200_OK
        assert "qr_token" not in detail.data
        assert zone.qr_token not in str(detail.data)

    def test_the_tree_endpoint_never_returns_the_token(self, household, owner, owner_client):
        zone = _zone(household, "Grenier", owner)
        response = owner_client.get(
            reverse("zone-tree"), {"household_id": str(household.id)}
        )
        assert response.status_code == status.HTTP_200_OK
        assert zone.qr_token not in str(response.data)


class TestThePrintSheet:
    """CHAS-01 — imprimer une planche d'étiquettes, une par pièce."""

    def test_it_returns_one_label_per_zone_with_a_scannable_svg(
        self, household, owner, owner_client
    ):
        _zone(household, "Cuisine", owner)
        _zone(household, "Salon", owner)

        response = owner_client.get(reverse("zone-print-sheet"))
        assert response.status_code == status.HTTP_200_OK

        expected = Zone.objects.filter(household=household).count()
        assert response.data["count"] == expected
        assert len(response.data["labels"]) == expected

        label = response.data["labels"][0]
        assert set(label) == {"zone_id", "name", "full_path", "path", "url", "svg"}
        assert label["svg"].startswith("<svg")
        assert label["path"].startswith("/z/")

    @override_settings(FRONTEND_URL="https://maison.example.com/")
    def test_the_encoded_url_uses_the_instance_address(self, household, owner, owner_client):
        """Une seule définition de « l'adresse publique de cette instance ».

        Un QR imprimé avec la mauvaise ne se corrige qu'en décollant les
        étiquettes — d'où la réutilisation de `FRONTEND_URL`, celui du lien
        d'invitation.
        """
        response = owner_client.get(reverse("zone-print-sheet"))
        for label in response.data["labels"]:
            assert label["url"].startswith("https://maison.example.com/z/")
            assert "//z/" not in label["url"], "slash doublé au recollement de l'URL"

    def test_a_stranger_never_sees_this_households_labels(self, household, owner, stranger):
        _zone(household, "Cuisine", owner)
        response = _client_for(stranger).get(reverse("zone-print-sheet"))
        assert response.status_code == status.HTTP_200_OK
        for label in response.data["labels"]:
            assert label["name"] != "Cuisine"


class TestScanningALabel:
    """CHAS-02 — scanner l'étiquette d'une pièce ouvre cette pièce."""

    def test_scanning_a_label_returns_its_zone(self, household, owner, owner_client):
        zone = _zone(household, "Buanderie", owner)

        response = owner_client.post(
            reverse("zone-scan"), {"token": zone.qr_token}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["zone"]["id"] == str(zone.id)
        assert response.data["zone"]["name"] == "Buanderie"

    def test_an_unknown_token_is_a_404(self, household, owner_client):
        response = owner_client.post(
            reverse("zone-scan"), {"token": generate_zone_token()}, format="json"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_a_missing_token_is_a_404_not_a_crash(self, household, owner_client):
        response = owner_client.post(reverse("zone-scan"), {}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_a_label_from_another_household_is_refused_by_saying_so(
        self, household, owner, stranger
    ):
        """403, jamais 404.

        Le jeton existe — il n'est simplement pas d'ici. Un 404 enverrait
        chercher une étiquette abîmée qui va très bien.
        """
        zone = _zone(household, "Cellier", owner)

        response = _client_for(stranger).post(
            reverse("zone-scan"), {"token": zone.qr_token}, format="json"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "another household" in response.data["detail"]

    def test_scanning_requires_authentication(self, household, owner):
        zone = _zone(household, "Atelier", owner)
        response = APIClient().post(
            reverse("zone-scan"), {"token": zone.qr_token}, format="json"
        )
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


class TestRotatingAToken:
    """CHAS-03 — régénérer le jeton d'une pièce."""

    def test_rotating_silences_the_old_label(self, household, owner, owner_client):
        zone = _zone(household, "Chambre", owner)
        old_token = zone.qr_token

        response = owner_client.post(reverse("zone-rotate-qr", args=[zone.id]))
        assert response.status_code == status.HTTP_200_OK

        zone.refresh_from_db()
        assert zone.qr_token != old_token
        assert response.data["path"] == f"/z/{zone.qr_token}"

        stale = owner_client.post(
            reverse("zone-scan"), {"token": old_token}, format="json"
        )
        assert stale.status_code == status.HTTP_404_NOT_FOUND

    def test_the_service_refuses_an_unknown_token(self, household):
        with pytest.raises(UnknownZoneToken):
            resolve_qr_token("nope")
        with pytest.raises(UnknownZoneToken):
            resolve_qr_token(None)

    def test_rotation_keeps_every_other_zone_untouched(self, household, owner):
        first = _zone(household, "Bureau", owner)
        second = _zone(household, "Couloir", owner)
        second_token = second.qr_token

        rotate_qr_token(first)

        second.refresh_from_db()
        assert second.qr_token == second_token


class TestTheUrlsAreTheOnesTheFrontCalls:
    """Les chemins littéraux, pas seulement les noms inversés.

    Piège rencontré à l'écriture du lot : DRF **nomme** la route en tirets
    (`zone-print-sheet`) tout en servant `print_sheet/` par défaut, parce que
    `url_name` remplace les underscores et pas `url_path`. Tous les tests qui
    passent par `reverse()` restaient donc verts pendant que le front — qui écrit
    l'URL en dur — prenait un 404. Seul un test sur le **chemin** l'attrape.
    """

    def test_the_action_paths_use_dashes(self):
        assert reverse("zone-print-sheet") == "/api/zones/print-sheet/"
        assert reverse("zone-scan") == "/api/zones/scan/"
        assert reverse("zone-rotate-qr", args=["11111111-1111-1111-1111-111111111111"]) == (
            "/api/zones/11111111-1111-1111-1111-111111111111/rotate-qr/"
        )


class TestTheLabelItself:
    def test_a_label_encodes_the_path_of_its_own_zone(self, household, owner):
        zone = _zone(household, "Véranda", owner)
        label = qr.label_for(zone)
        assert label["path"] == f"/z/{zone.qr_token}"
        assert label["url"].endswith(label["path"])
        assert label["name"] == "Véranda"

    def test_two_zones_never_share_a_token(self, household, owner):
        tokens = {_zone(household, f"Pièce {i}", owner).qr_token for i in range(12)}
        assert len(tokens) == 12
