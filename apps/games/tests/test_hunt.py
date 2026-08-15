"""La chasse au trésor — composition, partie, et les deux règles du jeu.

Ce que ces tests défendent, dans l'ordre d'importance :

1. **le trésor ne fuite jamais avant la dernière étape** — c'est la seule
   régression irrattrapable : un texte révélé ne se « désrévèle » pas, et la
   partie est gâchée ;
2. **un mauvais scan ne révèle rien et n'écrit rien** — sans quoi la triche
   consiste à scanner toute la maison ;
3. **une seule chasse active par foyer**, tenue par la base et pas seulement par
   la vue.

Couvre `CHAS-04` à `CHAS-10` côté serveur ; le parcours navigateur est dans
`e2e/hunt.spec.ts`.
"""
import pytest
from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from games.models import Hunt, HuntStep
from games.services import (
    VERDICT_ADVANCED,
    VERDICT_ALREADY_FOUND,
    VERDICT_FINISHED,
    VERDICT_NO_HUNT,
    VERDICT_WRONG_ZONE,
    HuntError,
    record_scan,
    start_hunt,
)
from households.models import Household, HouseholdMember
from zones.models import Zone


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def owner(db):
    return UserFactory(email="games-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = Household.objects.create(name="Games House")
    HouseholdMember.objects.create(
        user=owner, household=instance, role=HouseholdMember.Role.OWNER
    )
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def rooms(household, owner):
    return [
        Zone.objects.create(household=household, name=name, created_by=owner)
        for name in ("Cuisine", "Salon", "Garage")
    ]


def _hunt(household, rooms, *, name="Chasse de Pâques", treasure="Dans le four éteint"):
    hunt = Hunt.objects.create(
        household=household, name=name, treasure_text=treasure
    )
    for position, zone in enumerate(rooms):
        HuntStep.objects.create(
            household=household,
            hunt=hunt,
            position=position,
            zone=zone,
            riddle=f"Énigme {position}",
        )
    return hunt


class TestComposingAHunt:
    """CHAS-04 — composer une chasse avant d'appeler les enfants."""

    def test_a_hunt_is_created_with_its_steps_in_order(self, household, rooms, owner_client):
        response = owner_client.post(
            reverse("hunt-list"),
            {
                "name": "Chasse du dimanche",
                "treasure_text": "Sous le coussin du canapé",
                "steps": [
                    {"zone": str(rooms[0].id), "riddle": "Là où l'eau chante"},
                    {"zone": str(rooms[1].id), "riddle": "Là où l'on s'assoit"},
                ],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        hunt = Hunt.objects.get(pk=response.data["id"])
        assert hunt.status == Hunt.Status.DRAFT
        assert [s.position for s in hunt.steps.all()] == [0, 1]
        assert [s.zone_id for s in hunt.steps.all()] == [rooms[0].id, rooms[1].id]

    def test_a_step_pointing_at_another_households_room_is_refused(
        self, household, owner_client, owner
    ):
        other = Household.objects.create(name="Ailleurs")
        foreign_room = Zone.objects.create(household=other, name="Cuisine", created_by=owner)

        response = owner_client.post(
            reverse("hunt-list"),
            {
                "name": "Chasse tordue",
                "steps": [{"zone": str(foreign_room.id), "riddle": "?"}],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_editing_replaces_the_steps_wholesale(self, household, rooms, owner_client):
        hunt = _hunt(household, rooms)

        response = owner_client.patch(
            reverse("hunt-detail", args=[hunt.id]),
            {"steps": [{"zone": str(rooms[2].id), "riddle": "Seule étape"}]},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert hunt.steps.count() == 1
        assert hunt.steps.first().zone_id == rooms[2].id


class TestStartingAHunt:
    """CHAS-05 et CHAS-10 — lancer, et une seule à la fois."""

    def test_starting_marks_it_active(self, household, rooms, owner_client):
        hunt = _hunt(household, rooms)
        response = owner_client.post(reverse("hunt-start", args=[hunt.id]))

        assert response.status_code == status.HTTP_200_OK
        hunt.refresh_from_db()
        assert hunt.status == Hunt.Status.ACTIVE
        assert hunt.started_at is not None

    def test_an_empty_hunt_cannot_start(self, household, owner_client):
        """Sinon elle se terminerait à l'instant où elle commence."""
        hunt = Hunt.objects.create(household=household, name="Vide", treasure_text="X")
        response = owner_client.post(reverse("hunt-start", args=[hunt.id]))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_second_hunt_cannot_run_at_the_same_time(self, household, rooms, owner_client):
        first = _hunt(household, rooms)
        start_hunt(first)
        second = _hunt(household, rooms, name="Deuxième")

        response = owner_client.post(reverse("hunt-start", args=[second.id]))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        second.refresh_from_db()
        assert second.status == Hunt.Status.DRAFT

    def test_the_database_refuses_two_active_hunts_even_without_the_view(
        self, household, rooms
    ):
        """La règle est tenue par la base, pas seulement par la vue.

        Une règle de jeu qui ne vit que dans une vue tombe au premier appelant
        qui ne passe pas par elle — un service, une commande, un shell.
        """
        first = _hunt(household, rooms)
        start_hunt(first)
        second = _hunt(household, rooms, name="Deuxième")

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Hunt.objects.filter(pk=second.pk).update(status=Hunt.Status.ACTIVE)


class TestScanningDuringAHunt:
    """CHAS-06, CHAS-07, CHAS-08 — l'avancement, et ce qu'il ne dit pas."""

    def test_the_right_room_reveals_the_next_riddle(self, household, rooms):
        hunt = _hunt(household, rooms)
        start_hunt(hunt)

        outcome = record_scan(household, rooms[0])

        assert outcome["verdict"] == VERDICT_ADVANCED
        assert outcome["step"].position == 1
        assert outcome["step"].riddle == "Énigme 1"

    def test_a_wrong_room_changes_nothing_and_reveals_nothing(self, household, rooms):
        hunt = _hunt(household, rooms)
        start_hunt(hunt)

        outcome = record_scan(household, rooms[2])

        assert outcome["verdict"] == VERDICT_WRONG_ZONE
        assert outcome["step"] is None, "un mauvais scan ne doit rien dévoiler"
        assert hunt.steps.filter(found_at__isnull=False).count() == 0

    def test_rescanning_a_found_room_is_not_an_error(self, household, rooms):
        """Un enfant qui repasse devant la porte ne casse pas la partie."""
        hunt = _hunt(household, rooms)
        start_hunt(hunt)
        record_scan(household, rooms[0])

        outcome = record_scan(household, rooms[0])

        assert outcome["verdict"] == VERDICT_ALREADY_FOUND
        assert hunt.steps.filter(found_at__isnull=False).count() == 1

    def test_the_last_room_finishes_the_hunt(self, household, rooms):
        hunt = _hunt(household, rooms)
        start_hunt(hunt)
        record_scan(household, rooms[0])
        record_scan(household, rooms[1])

        outcome = record_scan(household, rooms[2])

        assert outcome["verdict"] == VERDICT_FINISHED
        hunt.refresh_from_db()
        assert hunt.status == Hunt.Status.DONE
        assert hunt.finished_at is not None

    def test_scanning_without_a_running_hunt_says_so(self, household, rooms):
        outcome = record_scan(household, rooms[0])
        assert outcome["verdict"] == VERDICT_NO_HUNT
        assert outcome["hunt"] is None


class TestTheTreasureStaysSecret:
    """La régression la plus coûteuse du lot — une fuite gâche la partie."""

    def test_the_play_payload_hides_the_treasure_until_the_end(
        self, household, rooms, owner_client
    ):
        hunt = _hunt(household, rooms, treasure="Dans la boîte à biscuits")
        start_hunt(hunt)

        response = owner_client.get(reverse("hunt-active"))
        body = str(response.data)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["hunt"]["treasure_text"] is None
        assert "biscuits" not in body

    def test_the_scan_response_never_leaks_the_treasure_mid_game(
        self, household, rooms, owner_client
    ):
        hunt = _hunt(household, rooms, treasure="Dans la boîte à biscuits")
        start_hunt(hunt)

        response = owner_client.post(
            reverse("zone-scan"), {"token": rooms[0].qr_token}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["verdict"] == VERDICT_ADVANCED
        assert "biscuits" not in str(response.data)

    def test_the_scan_response_never_leaks_the_target_room(
        self, household, rooms, owner_client
    ):
        """Un mauvais scan ne doit pas dire **où** il fallait aller.

        Nuance tranchée à l'écriture : l'énigme *courante* a le droit d'être dans
        le payload — le téléphone l'affiche déjà, c'est celle qu'on est en train
        de chercher. Ce qui doit rester secret, c'est la **pièce** qu'elle
        désigne, et le nombre d'étapes qu'il reste.
        """
        hunt = _hunt(household, rooms)
        start_hunt(hunt)

        response = owner_client.post(
            reverse("zone-scan"), {"token": rooms[2].qr_token}, format="json"
        )

        assert response.data["verdict"] == VERDICT_WRONG_ZONE
        assert response.data["next_step"] is None

        played = response.data["hunt"]
        assert played["current_step"]["position"] == 0
        assert "zone" not in played["current_step"], "la réponse ne se donne pas"
        assert rooms[0].name not in str(played)
        assert str(rooms[0].id) not in str(played)

    def test_the_treasure_appears_once_the_hunt_is_done(
        self, household, rooms, owner_client
    ):
        hunt = _hunt(household, rooms, treasure="Dans la boîte à biscuits")
        start_hunt(hunt)
        for room in rooms:
            record_scan(household, room)

        response = owner_client.get(reverse("hunt-detail", args=[hunt.id]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["treasure_text"] == "Dans la boîte à biscuits"


class TestAHuntSurvivesTheDevice:
    """CHAS-09 — l'état vit en base, pas dans l'onglet."""

    def test_another_member_sees_the_same_running_hunt(self, household, rooms, owner):
        hunt = _hunt(household, rooms)
        start_hunt(hunt)
        record_scan(household, rooms[0])

        other = UserFactory(email="games-other@example.com")
        HouseholdMember.objects.create(
            user=other, household=household, role=HouseholdMember.Role.MEMBER
        )
        other.active_household = household
        other.save(update_fields=["active_household"])

        response = _client_for(other).get(reverse("hunt-active"))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["hunt"]["id"] == str(hunt.id)
        assert response.data["hunt"]["found_count"] == 1
        assert response.data["hunt"]["current_step"]["position"] == 1

    def test_no_running_hunt_answers_none_rather_than_404(self, household, owner_client):
        response = owner_client.get(reverse("hunt-active"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["hunt"] is None


class TestARoomInUseIsProtected:
    def test_deleting_a_room_used_by_a_hunt_is_refused(self, household, rooms, owner_client):
        """Supprimer une pièce ne doit pas amputer une chasse en silence."""
        _hunt(household, rooms)

        response = owner_client.delete(reverse("zone-detail", args=[rooms[0].id]))

        assert response.status_code == status.HTTP_409_CONFLICT
        assert Zone.objects.filter(pk=rooms[0].pk).exists()


class TestScopingAcrossHouseholds:
    def test_a_stranger_never_sees_this_households_hunts(self, household, rooms):
        _hunt(household, rooms)
        stranger = UserFactory(email="games-stranger@example.com")
        other = Household.objects.create(name="Ailleurs")
        HouseholdMember.objects.create(
            user=stranger, household=other, role=HouseholdMember.Role.OWNER
        )
        stranger.active_household = other
        stranger.save(update_fields=["active_household"])

        response = _client_for(stranger).get(reverse("hunt-list"))

        assert response.status_code == status.HTTP_200_OK
        body = response.data
        results = body["results"] if isinstance(body, dict) else body
        assert len(results) == 0
