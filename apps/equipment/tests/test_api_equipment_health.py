"""Ce que le module dit de l'état d'un équipement — et qui doit le dire pareil.

Trois défauts réels sont tenus ici :

1. la liste affichait une garantie expirée et un entretien en retard **dans le
   même gris** que le reste, pendant que la fiche écrivait « Expirée » en rouge ;
2. « Enregistrer une intervention » ne touchait pas à ``last_service_at`` : la
   date annoncée ne bougeait jamais, et l'alerte restait allumée ;
3. le bandeau et les pastilles auraient pu compter deux choses différentes.
"""

from datetime import date, timedelta

import pytest
from django.urls import reverse

from accounts.models import User
from equipment.models import Equipment, EquipmentInteraction
from equipment.services import maintenance_state, warranty_state
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from zones.models import Zone


@pytest.fixture
def user(db):
    return User.objects.create_user(email="eq-health@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Health home")


@pytest.fixture
def membership(user, household):
    return HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )


@pytest.fixture
def zone(household, user):
    return Zone.objects.create(household=household, name="Cellar", created_by=user)


@pytest.fixture
def client(user, membership, household):
    from rest_framework.test import APIClient

    api = APIClient()
    api.force_authenticate(user=user)
    api.defaults["HTTP_X_HOUSEHOLD_ID"] = str(household.id)
    return api


def _equipment(household, user, zone=None, **fields):
    return Equipment.objects.create(
        household=household, zone=zone, created_by=user, **fields
    )


@pytest.mark.django_db
class TestTheVerdictsSayWhatTheyKnow:
    def test_a_missing_warranty_is_unknown_never_expired(self, household, user):
        equipment = _equipment(household, user, name="No warranty")
        assert warranty_state(equipment, date.today())["state"] == "unknown"

    def test_an_equipment_without_interval_is_not_ok(self, household, user):
        """Pas suivi n'est pas « à jour » — la coche verte d'un contrôle qui n'a rien vérifié."""
        equipment = _equipment(
            household, user, name="Untracked", last_service_at=date.today()
        )
        assert maintenance_state(equipment, date.today())["state"] == "unknown"

    def test_an_overdue_maintenance_is_overdue(self, household, user):
        today = date.today()
        equipment = _equipment(
            household,
            user,
            name="Boiler",
            last_service_at=today - timedelta(days=400),
            maintenance_interval_months=12,
        )
        verdict = maintenance_state(equipment, today)
        assert verdict["state"] == "overdue"
        assert verdict["days"] < 0


@pytest.mark.django_db
class TestTheListAndTheDetailAgree:
    """Le défaut d'origine : deux écrans, deux voix sur le même fait.

    Les deux lisent désormais le même champ servi par le même serializer — donc
    le test compare la liste à la fiche, pas un rendu à un autre rendu.
    """

    def test_list_and_detail_serve_the_same_verdicts(self, client, household, user):
        today = date.today()
        equipment = _equipment(
            household,
            user,
            name="Boiler",
            warranty_expires_on=today - timedelta(days=2000),
            last_service_at=today - timedelta(days=400),
            maintenance_interval_months=12,
        )

        listed = client.get(reverse("equipment-list")).data
        row = listed[0] if isinstance(listed, list) else listed["results"][0]
        detail = client.get(reverse("equipment-detail", kwargs={"pk": equipment.id})).data

        assert row["warranty_state"] == detail["warranty_state"]
        assert row["maintenance_state"] == detail["maintenance_state"]
        assert row["warranty_state"]["state"] == "expired"
        assert row["maintenance_state"]["state"] == "overdue"


@pytest.mark.django_db
class TestTheBannerAgreesWithTheChip:
    """Un compteur ne peut pas avoir deux définitions.

    Le bandeau annonce un nombre, la pastille filtre la liste : cliquer doit
    ramener exactement ce qui a été annoncé, sinon les deux perdent leur crédit.
    """

    def test_each_count_matches_what_its_filter_returns(self, client, household, user):
        today = date.today()
        _equipment(
            household, user, name="Expired warranty",
            warranty_expires_on=today - timedelta(days=30),
        )
        _equipment(
            household, user, name="Warranty soon",
            warranty_expires_on=today + timedelta(days=10),
        )
        _equipment(
            household, user, name="Overdue service",
            last_service_at=today - timedelta(days=400), maintenance_interval_months=12,
        )
        _equipment(household, user, name="Nothing to say")

        counts = client.get(reverse("equipment-attention")).data

        for key in ("maintenance_overdue", "warranty_expired", "warranty_expiring"):
            listed = client.get(reverse("equipment-list"), {"attention": key}).data
            rows = listed if isinstance(listed, list) else listed["results"]
            assert counts[key] == len(rows), f"{key}: bandeau {counts[key]} ≠ liste {len(rows)}"

    def test_a_retired_equipment_asks_for_nothing(self, client, household, user):
        """Une garantie expirée sur un appareil au rebut est un reproche sans geste."""
        today = date.today()
        _equipment(
            household, user, name="Dead fridge",
            warranty_expires_on=today - timedelta(days=30),
            status=Equipment.Status.RETIRED,
        )
        assert client.get(reverse("equipment-attention")).data["warranty_expired"] == 0

    def test_an_unknown_filter_is_refused(self, client):
        response = client.get(reverse("equipment-list"), {"attention": "whatever"})
        assert response.status_code == 400


@pytest.mark.django_db
class TestLoggingAServiceMovesTheDate:
    """Le trou du module : la trace existait, la date ne bougeait pas."""

    def _url(self, equipment):
        return reverse("equipment-log-service", kwargs={"pk": equipment.id})

    def test_it_writes_the_date_and_the_trace_together(self, client, household, user, zone):
        today = date.today()
        equipment = _equipment(
            household, user, zone,
            name="Boiler",
            last_service_at=today - timedelta(days=400),
            maintenance_interval_months=12,
        )
        assert maintenance_state(equipment, today)["state"] == "overdue"

        response = client.post(self._url(equipment), {}, format="json")
        assert response.status_code == 201

        equipment.refresh_from_db()
        assert equipment.last_service_at == today
        # …et l'échéance suivante repart d'aujourd'hui : l'alerte s'éteint.
        assert response.data["maintenance_state"]["state"] == "ok"

        interaction = Interaction.objects.get(id=response.data["interaction_id"])
        assert interaction.type == "maintenance"
        assert equipment.name in interaction.subject
        # Un entretien n'est pas une dépense — sinon il entrerait dans les totaux.
        assert interaction.amount is None
        assert interaction.kind == ""
        # La zone de l'équipement suit, comme pour un achat.
        assert list(interaction.zones.values_list("id", flat=True)) == [zone.id]
        # Et la table de liaison reste alimentée : c'est ce que lit l'agent.
        assert EquipmentInteraction.objects.filter(
            equipment=equipment, interaction=interaction
        ).exists()

    def test_a_future_maintenance_is_refused(self, client, household, user):
        """Repousser l'échéance sur la foi d'un entretien qui n'a pas eu lieu."""
        equipment = _equipment(household, user, name="Boiler", maintenance_interval_months=12)
        response = client.post(
            self._url(equipment),
            {"serviced_on": (date.today() + timedelta(days=1)).isoformat()},
            format="json",
        )
        assert response.status_code == 400

    def test_it_accepts_an_explicit_past_date_and_a_note(self, client, household, user):
        equipment = _equipment(household, user, name="Boiler", maintenance_interval_months=6)
        when = date.today() - timedelta(days=3)
        response = client.post(
            self._url(equipment),
            {"serviced_on": when.isoformat(), "notes": "Changed the filter"},
            format="json",
        )
        assert response.status_code == 201
        equipment.refresh_from_db()
        assert equipment.last_service_at == when
        assert Interaction.objects.get(id=response.data["interaction_id"]).content == "Changed the filter"

    def test_another_household_cannot_log_a_service(self, client, db, user):
        stranger_home = Household.objects.create(name="Elsewhere")
        stranger = User.objects.create_user(email="eq-stranger@test.dev", password="secret")
        equipment = _equipment(stranger_home, stranger, name="Not yours")
        assert client.post(self._url(equipment), {}, format="json").status_code == 404


@pytest.mark.django_db
class TestTheHistoryShowsEverythingThatHappened:
    """Une dépense enregistrée depuis la fiche n'apparaissait pas dans son historique."""

    def test_it_unions_both_links(self, client, household, user, zone):
        equipment = _equipment(household, user, zone, name="Boiler", maintenance_interval_months=12)

        client.post(
            reverse("equipment-register-purchase", kwargs={"pk": equipment.id}),
            {"amount": "120.00", "supplier": "Viessmann"},
            format="json",
        )
        client.post(reverse("equipment-log-service", kwargs={"pk": equipment.id}), {}, format="json")

        listed = client.get(reverse("equipment-history", kwargs={"pk": equipment.id})).data
        rows = listed if isinstance(listed, list) else listed["results"]
        types = {row["type"] for row in rows}
        assert types == {"expense", "maintenance"}, types
