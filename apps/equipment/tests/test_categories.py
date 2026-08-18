"""Le vocabulaire fermé des catégories, et ce que la migration ne doit pas perdre."""

import pytest
from django.urls import reverse

from accounts.models import User
from equipment.models import Equipment
from equipment.services import normalize_category
from households.models import Household, HouseholdMember


@pytest.fixture
def user(db):
    return User.objects.create_user(email="eq-cat@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Cat home")


@pytest.fixture
def membership(user, household):
    return HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )


@pytest.fixture
def client(user, membership, household):
    from rest_framework.test import APIClient

    api = APIClient()
    api.force_authenticate(user=user)
    api.defaults["HTTP_X_HOUSEHOLD_ID"] = str(household.id)
    return api


class TestTheVocabularyGathersWhatUsersTyped:
    """Les 13 orthographes réellement trouvées en base retombent sur 6 valeurs."""

    @pytest.mark.parametrize(
        "typed,expected",
        [
            ("heating", "heating"),
            ("hvac", "heating"),
            ("Chauffage", "heating"),
            ("appliance", "appliance"),
            ("électroménager", "appliance"),
            ("tool", "tool"),
            ("outil", "tool"),
            ("Machine", "tool"),
            ("machine", "tool"),
            ("garden", "garden"),
            ("jardin", "garden"),
            ("mobility", "mobility"),
            ("voiture", "mobility"),
            ("general", "other"),
            ("", "other"),
            (None, "other"),
            ("un truc jamais vu", "other"),
        ],
    )
    def test_it_normalizes(self, typed, expected):
        assert normalize_category(typed) == expected


@pytest.mark.django_db
class TestTheApiRefusesAnInventedCategory:
    """Un axe de classement dont chaque saisie invente une valeur ne classe rien."""

    def test_it_rejects_free_text(self, client):
        response = client.post(
            reverse("equipment-list"),
            {"name": "Mower", "category": "tondeuse à gazon", "status": "active"},
            format="json",
        )
        assert response.status_code == 400
        assert "category" in response.data

    def test_it_accepts_a_known_value(self, client, household):
        response = client.post(
            reverse("equipment-list"),
            {"name": "Mower", "category": "garden", "status": "active"},
            format="json",
        )
        assert response.status_code == 201
        assert Equipment.objects.get(id=response.data["id"]).category == "garden"

    def test_the_default_is_other_not_general(self, client):
        response = client.post(
            reverse("equipment-list"), {"name": "Thing", "status": "active"}, format="json"
        )
        assert response.status_code == 201
        assert response.data["category"] == "other"


@pytest.mark.django_db
class TestTheMigrationKeepsWhatItCannotTranslate:
    """Une migration qui perd une saisie du foyer pour faire propre fait un mauvais échange.

    Le test rejoue la fonction de la migration sur des lignes écrites en base,
    plutôt que de la relire : c'est la seule façon de savoir ce qu'elle fait à des
    données qui existent déjà.
    """

    def test_known_values_are_gathered_and_unknown_ones_land_in_tags(self, household, user):
        from importlib import import_module

        from django.apps import apps as django_apps

        migration = import_module("equipment.migrations.0006_equipment_category_vocabulary")

        gathered = Equipment.objects.create(
            household=household, created_by=user, name="Boiler", category="hvac"
        )
        preserved = Equipment.objects.create(
            household=household, created_by=user, name="Odd one", category="Bidule"
        )
        default = Equipment.objects.create(
            household=household, created_by=user, name="Plain", category="general"
        )

        migration.normalize_categories(django_apps, None)

        gathered.refresh_from_db()
        preserved.refresh_from_db()
        default.refresh_from_db()

        assert gathered.category == "heating"
        # Ce qu'on ne sait pas traduire n'est pas jeté.
        assert preserved.category == "other"
        assert "Bidule" in preserved.tags
        # …mais le défaut historique du formulaire n'est pas une saisie : pas de tag.
        assert default.category == "other"
        assert default.tags == []
