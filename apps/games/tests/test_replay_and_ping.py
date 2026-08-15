"""Rejouer une chasse, et l'invitation du samedi pluvieux (lot 4).

Deux mécanismes sans rapport technique, mais une même question produit : **faire
revenir le jeu sans que personne n'y pense**. Ce qu'ils défendent :

1. **rejouer ne détruit rien** — l'originale garde ses `found_at`, sa date et son
   statut. Un « rejouer » qui remettrait la partie de l'an dernier à zéro
   effacerait la seule trace que le foyer a jouée, et ça ne se voit qu'après ;
2. **l'ordre change vraiment** — rejouer à l'identique n'est pas rejouer : les
   enfants connaissent la suite et le jeu s'arrête au premier scan ;
3. **le ping ne part presque jamais** — un test par condition, parce qu'une seule
   qui manquerait suffirait à en faire un rappel périodique, c'est-à-dire du
   bruit ; et le bruit emporte avec lui la notification rare qui comptait.

Couvre `CHAS-13` et `CHAS-14` côté serveur ; le parcours navigateur du rejeu est
dans `e2e/hunt-replay.spec.ts` (le ping n'a pas de surface navigateur).
"""
import random
from datetime import date
from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from games.models import Hunt, HuntStep
from games.pings import NOTIFICATION_TYPE, build_hunt_suggestion_ping
from games.services import HuntError, replay_hunt
from households.models import Household, HouseholdMember
from notifications.models import MUTABLE_TYPES, Notification
from zones.models import Zone

pytestmark = pytest.mark.django_db

# Un samedi et un mercredi, tous deux réels — une date choisie au hasard finirait
# par tomber le mauvais jour de la semaine et rendrait le test intermittent.
A_SATURDAY = date(2026, 8, 15)
A_WEDNESDAY = date(2026, 8, 12)


@pytest.fixture
def owner(db):
    return UserFactory(email="replay-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = Household.objects.create(
        name="Replay House", latitude=48.85, longitude=2.35, timezone="Europe/Paris"
    )
    HouseholdMember.objects.create(
        user=owner, household=instance, role=HouseholdMember.Role.OWNER
    )
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


@pytest.fixture
def rooms(household, owner):
    return [
        Zone.objects.create(household=household, name=name, created_by=owner)
        for name in ("Cuisine", "Salon", "Garage", "Chambre")
    ]


def _played_hunt(household, rooms, *, treasure="Dans le four éteint") -> Hunt:
    """Une chasse terminée, telle que le foyer la laisse après une partie."""
    from django.utils import timezone

    hunt = Hunt.objects.create(
        household=household,
        name="Chasse de Pâques",
        treasure_text=treasure,
        status=Hunt.Status.DONE,
        finished_at=timezone.now(),
    )
    for position, zone in enumerate(rooms):
        HuntStep.objects.create(
            household=household,
            hunt=hunt,
            position=position,
            zone=zone,
            riddle=f"Énigme {position}",
            found_at=timezone.now(),
        )
    return hunt


def _rain(probability: int, on: date) -> dict:
    return {"daily": [{"date": on.isoformat(), "precipitation_probability_max": probability}]}


class TestReplayingNeverTouchesTheOriginal:
    """CHAS-13 — ressortir une chasse sans tout ressaisir."""

    def test_it_creates_a_new_draft_with_the_same_rooms(self, household, rooms, owner_client):
        original = _played_hunt(household, rooms)

        response = owner_client.post(reverse("hunt-replay", args=[original.id]))

        assert response.status_code == status.HTTP_201_CREATED
        copy = Hunt.objects.get(pk=response.data["id"])
        assert copy.id != original.id
        assert copy.status == Hunt.Status.DRAFT
        assert copy.name == original.name
        assert copy.treasure_text == original.treasure_text
        assert {s.zone_id for s in copy.steps.all()} == {s.zone_id for s in original.steps.all()}
        assert {s.riddle for s in copy.steps.all()} == {s.riddle for s in original.steps.all()}

    def test_the_new_steps_are_all_unfound(self, household, rooms, owner_client):
        original = _played_hunt(household, rooms)

        response = owner_client.post(reverse("hunt-replay", args=[original.id]))

        copy = Hunt.objects.get(pk=response.data["id"])
        assert list(copy.steps.values_list("found_at", flat=True)) == [None] * len(rooms)
        assert [s.position for s in copy.steps.all()] == list(range(len(rooms)))

    def test_the_original_keeps_its_history(self, household, rooms, owner_client):
        """Le point le plus important du lot, et le plus facile à casser : la
        partie de l'an dernier est la seule trace que le foyer a joué."""
        original = _played_hunt(household, rooms)
        before = list(original.steps.values_list("id", "position", "zone_id", "found_at"))

        owner_client.post(reverse("hunt-replay", args=[original.id]))

        original.refresh_from_db()
        assert original.status == Hunt.Status.DONE
        assert original.finished_at is not None
        assert list(original.steps.values_list("id", "position", "zone_id", "found_at")) == before

    def test_the_order_differs(self, household, rooms):
        """Graine fixée : le test doit prouver le mélange, pas tirer au sort son
        propre verdict."""
        original = _played_hunt(household, rooms)

        copy = replay_hunt(original, rng=random.Random(1234))

        assert [s.zone_id for s in copy.steps.all()] != [
            s.zone_id for s in original.steps.all()
        ]

    def test_a_shuffle_that_lands_on_itself_is_retried(self, household, rooms):
        """`random.shuffle` a le droit de rendre l'ordre d'origine — une chance
        sur deux à deux étapes. Le bouton n'aurait alors rien fait, sans le dire.

        Le générateur figé ci-dessous rend **toujours** la permutation identité :
        c'est le seul moyen de prouver que le code ne s'en contente pas.
        """
        original = _played_hunt(household, rooms)

        class _NeverShuffles(random.Random):
            def shuffle(self, seq):  # noqa: D102 — l'identité, exprès
                return None

        copy = replay_hunt(original, rng=_NeverShuffles())

        assert [s.zone_id for s in copy.steps.all()] != [
            s.zone_id for s in original.steps.all()
        ]

    def test_a_single_step_hunt_is_replayed_without_looping(self, household, rooms):
        """Une étape ne se mélange pas — et surtout, on ne fait pas tourner
        l'algorithme vingt fois pour le découvrir."""
        original = _played_hunt(household, rooms[:1])

        copy = replay_hunt(original)

        assert copy.steps.count() == 1

    def test_an_empty_hunt_cannot_be_replayed(self, household):
        empty = Hunt.objects.create(household=household, name="Vide", status=Hunt.Status.DONE)

        with pytest.raises(HuntError):
            replay_hunt(empty)

    def test_a_stranger_cannot_replay_this_households_hunt(self, household, rooms):
        original = _played_hunt(household, rooms)
        stranger = UserFactory(email="stranger-replay@example.com")
        elsewhere = Household.objects.create(name="Ailleurs")
        HouseholdMember.objects.create(
            user=stranger, household=elsewhere, role=HouseholdMember.Role.OWNER
        )
        stranger.active_household = elsewhere
        stranger.save(update_fields=["active_household"])
        client = APIClient()
        client.force_authenticate(user=stranger)

        response = client.post(reverse("hunt-replay", args=[original.id]))

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert Hunt.objects.filter(household=elsewhere).count() == 0


class TestThePingOnlyFiresWhenPlayingIsAGoodIdea:
    """CHAS-14 — un test par condition, parce qu'une seule qui manque suffit.

    Le risque n'est pas de rater un envoi : c'est d'en faire un rappel
    périodique. Une invitation qui part tous les samedis apprend à ignorer la
    cloche, et emporte avec elle la notification rare qui comptait.
    """

    def test_it_fires_on_a_rainy_weekend(self, household, rooms, owner):
        with patch("weather.services.get_forecast", return_value=_rain(80, A_SATURDAY)):
            message = build_hunt_suggestion_ping(household, owner, today=A_SATURDAY)

        assert message is not None
        assert Notification.objects.filter(user=owner, type=NOTIFICATION_TYPE).count() == 1

    def test_it_stays_silent_on_a_weekday(self, household, rooms, owner):
        with patch("weather.services.get_forecast", return_value=_rain(90, A_WEDNESDAY)):
            assert build_hunt_suggestion_ping(household, owner, today=A_WEDNESDAY) is None

    def test_it_stays_silent_when_it_is_dry(self, household, rooms, owner):
        with patch("weather.services.get_forecast", return_value=_rain(10, A_SATURDAY)):
            assert build_hunt_suggestion_ping(household, owner, today=A_SATURDAY) is None

    def test_it_stays_silent_without_enough_rooms(self, household, owner):
        Zone.objects.create(household=household, name="Cuisine", created_by=owner)

        with patch("weather.services.get_forecast", return_value=_rain(90, A_SATURDAY)) as fc:
            assert build_hunt_suggestion_ping(household, owner, today=A_SATURDAY) is None

        # Et on n'appelle pas le fournisseur pour rien.
        fc.assert_not_called()

    def test_it_stays_silent_while_a_hunt_is_running(self, household, rooms, owner):
        hunt = Hunt.objects.create(
            household=household, name="En cours", status=Hunt.Status.ACTIVE
        )
        HuntStep.objects.create(
            household=household, hunt=hunt, position=0, zone=rooms[0], riddle="?"
        )

        with patch("weather.services.get_forecast", return_value=_rain(90, A_SATURDAY)):
            assert build_hunt_suggestion_ping(household, owner, today=A_SATURDAY) is None

    def test_it_stays_silent_without_a_location(self, household, rooms, owner):
        household.latitude = None
        household.longitude = None
        household.save(update_fields=["latitude", "longitude"])

        assert build_hunt_suggestion_ping(household, owner, today=A_SATURDAY) is None

    def test_it_stays_silent_when_the_weather_module_is_off(self, household, rooms, owner):
        household.disabled_modules = ["weather"]
        household.save(update_fields=["disabled_modules"])

        with patch("weather.services.get_forecast", return_value=_rain(90, A_SATURDAY)) as fc:
            assert build_hunt_suggestion_ping(household, owner, today=A_SATURDAY) is None

        fc.assert_not_called()

    def test_an_unreachable_forecast_degrades_silently(self, household, rooms, owner):
        """Une invitation à jouer n'est jamais assez importante pour lever."""
        with patch("weather.services.get_forecast", side_effect=RuntimeError("boom")):
            assert build_hunt_suggestion_ping(household, owner, today=A_SATURDAY) is None

    def test_a_forecast_without_today_says_no(self, household, rooms, owner):
        with patch("weather.services.get_forecast", return_value=_rain(90, A_WEDNESDAY)):
            assert build_hunt_suggestion_ping(household, owner, today=A_SATURDAY) is None

    def test_it_never_creates_a_hunt(self, household, rooms, owner):
        """Le ping propose, il n'engage rien : une chasse créée par une
        notification serait une chasse que personne n'a voulue, avec des pièces
        que personne n'a choisies."""
        with patch("weather.services.get_forecast", return_value=_rain(90, A_SATURDAY)):
            build_hunt_suggestion_ping(household, owner, today=A_SATURDAY)

        assert Hunt.objects.count() == 0

    def test_the_bell_leads_to_the_composer(self, household, rooms, owner):
        with patch("weather.services.get_forecast", return_value=_rain(90, A_SATURDAY)):
            build_hunt_suggestion_ping(household, owner, today=A_SATURDAY)

        assert Notification.objects.get(user=owner).url == "/app/games"

    def test_a_second_pass_the_same_day_does_not_ring_twice(self, household, rooms, owner):
        with patch("weather.services.get_forecast", return_value=_rain(90, A_SATURDAY)):
            build_hunt_suggestion_ping(household, owner, today=A_SATURDAY)
            build_hunt_suggestion_ping(household, owner, today=A_SATURDAY)

        assert Notification.objects.filter(user=owner, type=NOTIFICATION_TYPE).count() == 1


class TestTheInvitationCanBeSilenced:
    """L'archétype du fréquent non actionnable : il doit pouvoir se taire."""

    def test_the_type_is_declared_in_the_enum(self):
        """Une string littérale persisterait très bien — et vivrait hors de
        l'affichage admin et hors de `MUTABLE_TYPES`, comme `weather_alert`."""
        assert NOTIFICATION_TYPE in Notification.Type.values

    def test_it_belongs_to_the_mutable_set(self):
        assert Notification.Type.HUNT_SUGGESTION in MUTABLE_TYPES

    def test_a_muted_user_gets_nothing(self, household, rooms, owner):
        owner.muted_notification_types = [NOTIFICATION_TYPE]
        owner.save(update_fields=["muted_notification_types"])

        with patch("weather.services.get_forecast", return_value=_rain(90, A_SATURDAY)):
            message = build_hunt_suggestion_ping(household, owner, today=A_SATURDAY)

        # Le Telegram part quand même — c'est un canal, pas un type — mais la
        # cloche se tait, et c'est elle que la préférence gouverne.
        assert message is not None
        assert Notification.objects.filter(user=owner).count() == 0


class TestThePingIsWiredToTheScheduler:
    """Un ping non enregistré est un ping qui n'existe pas."""

    def test_it_is_in_the_registry(self):
        from pings.registry import find_spec

        spec = find_spec("hunt_suggestion")
        assert spec is not None
        assert spec.module == "games"

    def test_the_games_module_switches_it_off(self, household):
        """Couper le module coupe le ping — mais pas le scan de zone du lot 1,
        qui vit dans les zones et reste utile sans les jeux."""
        from pings.registry import specs_for_household

        household.disabled_modules = ["games"]
        household.save(update_fields=["disabled_modules"])

        assert "hunt_suggestion" not in {s.ping_type for s in specs_for_household(household)}
