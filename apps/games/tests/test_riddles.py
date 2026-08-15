"""Les énigmes proposées par le modèle — et les quatre façons de se tromper.

Ce que ces tests défendent, dans l'ordre d'importance :

1. **rien n'est écrit en base** — ni par la génération réussie, ni surtout par
   celle qui échoue à mi-parcours. La relecture par le parent n'est pas un
   confort : un modèle qui écrirait directement pourrait désigner la mauvaise
   pièce, et personne ne s'en apercevrait avant que l'enfant tourne en rond ;
2. **une instance sans clé joue quand même** — seule l'aide à l'écriture
   disparaît, et elle se **déclare** absente (503 nommé) plutôt que de répondre
   un 500 ou un 200 inventé ;
3. **une réponse mal formée n'écrit rien et se dit** — un demi-résultat se lit
   plus mal qu'aucun résultat ;
4. **le chemin littéral est celui que le front appelle** — `reverse()` ne le
   prouve pas, DRF ne dérivant pas `url_path` et `url_name` de la même façon.

Couvre `CHAS-11` et `CHAS-12` côté serveur ; le parcours navigateur est dans
`e2e/hunt-riddles.spec.ts`.
"""
import json
from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from agent.llm import LLMError, LLMResponse
from games.models import Hunt, HuntStep
from games.riddles import MAX_ZONES, generate_riddles
from households.models import Household, HouseholdMember
from zones.models import Zone

RIDDLES_URL = "/api/games/hunts/generate-riddles/"

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(db):
    return UserFactory(email="riddles-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = Household.objects.create(name="Riddles House")
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
        for name in ("Cuisine", "Salle de bain", "Garage")
    ]


def _reply(text: str) -> LLMResponse:
    return LLMResponse(
        text=text, input_tokens=10, output_tokens=20, duration_ms=5, model="test-model"
    )


def _three_riddles() -> LLMResponse:
    return _reply(json.dumps([
        {"index": 0, "riddle": "Je sens bon le pain grillé."},
        {"index": 1, "riddle": "Je suis là où l'eau chante le matin."},
        {"index": 2, "riddle": "Je garde ce qui a des roues."},
    ], ensure_ascii=False))


def _payload(rooms, **extra) -> dict:
    return {"zones": [str(zone.id) for zone in rooms], **extra}


@pytest.fixture
def with_key(settings):
    """Une instance qui a sa clé. `override_settings` ne décore pas une classe
    pytest (il exige une `SimpleTestCase`) : c'est la fixture `settings` de
    pytest-django qui joue ce rôle, et elle restaure toute seule."""
    settings.ANTHROPIC_API_KEY = "sk-ant-test"
    settings.LLM_PROVIDER = "anthropic"


@pytest.fixture
def without_key(settings):
    """Une instance d'auto-hébergeur qui n'a posé aucune clé."""
    settings.ANTHROPIC_API_KEY = ""
    settings.LLM_PROVIDER = "anthropic"


@pytest.mark.usefixtures("with_key")
class TestTheAssistantProposesAndTheParentDecides:
    """CHAS-11 — deux minutes de préparation au lieu de vingt."""

    def test_one_riddle_per_room_in_the_order_asked(self, rooms, owner_client):
        with patch("games.riddles.get_llm_client") as get_client:
            get_client.return_value.complete.return_value = _three_riddles()

            response = owner_client.post(RIDDLES_URL, _payload(rooms), format="json")

        assert response.status_code == status.HTTP_200_OK
        riddles = response.data["riddles"]
        assert [row["index"] for row in riddles] == [0, 1, 2]
        assert [row["zone"] for row in riddles] == [str(zone.id) for zone in rooms]
        assert riddles[1]["riddle"] == "Je suis là où l'eau chante le matin."

    def test_all_the_rooms_travel_in_a_single_call(self, rooms, owner_client):
        """Six étapes ne doivent pas coûter six allers-retours.

        Ce n'est pas qu'une question de latence ou de facture : six énigmes
        écrites dans l'ignorance les unes des autres se répètent, et deux pièces
        finissent avec la même image.
        """
        with patch("games.riddles.get_llm_client") as get_client:
            complete = get_client.return_value.complete
            complete.return_value = _three_riddles()

            owner_client.post(RIDDLES_URL, _payload(rooms), format="json")

        assert complete.call_count == 1
        sent = complete.call_args.kwargs["user"]
        for zone in rooms:
            assert zone.name in sent

    def test_nothing_is_written_to_the_database(self, rooms, owner_client):
        """Le critère central du lot : proposer n'est pas enregistrer."""
        with patch("games.riddles.get_llm_client") as get_client:
            get_client.return_value.complete.return_value = _three_riddles()

            owner_client.post(RIDDLES_URL, _payload(rooms), format="json")

        assert Hunt.objects.count() == 0
        assert HuntStep.objects.count() == 0

    def test_the_age_band_reaches_the_model(self, rooms, owner_client):
        with patch("games.riddles.get_llm_client") as get_client:
            complete = get_client.return_value.complete
            complete.return_value = _three_riddles()

            owner_client.post(RIDDLES_URL, _payload(rooms, age="small"), format="json")

        assert "4-6 years old" in complete.call_args.kwargs["user"]

    def test_an_unknown_age_band_is_refused_rather_than_guessed(self, rooms, owner_client):
        with patch("games.riddles.get_llm_client") as get_client:
            get_client.return_value.complete.return_value = _three_riddles()

            response = owner_client.post(
                RIDDLES_URL, _payload(rooms, age="grand-pere"), format="json"
            )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_the_riddles_are_written_in_the_readers_language(self, rooms, household, owner):
        """La langue de génération est celle de qui compose, pas du serveur.

        Un foyer francophone qui reçoit six énigmes en anglais n'a rien gagné sur
        la saisie manuelle — même défaut que les notifications rendues une seule
        fois dans la langue de l'acteur.
        """
        with patch("games.riddles.get_llm_client") as get_client:
            complete = get_client.return_value.complete
            complete.return_value = _three_riddles()

            generate_riddles(household, rooms, language="de", user=owner)

        assert "Language for the riddles: de" in complete.call_args.kwargs["user"]


@pytest.mark.usefixtures("with_key")
class TestAMalformedAnswerWritesNothing:
    """Un demi-résultat se lit plus mal qu'aucun résultat."""

    @pytest.mark.parametrize("text", [
        "",
        "Bien sûr ! Voici vos énigmes.",
        json.dumps([{"index": 0, "riddle": "seule"}]),
        json.dumps([{"index": 0, "riddle": "a"}, {"index": 0, "riddle": "b"},
                    {"index": 1, "riddle": "c"}]),
        json.dumps([{"index": 0, "riddle": ""}, {"index": 1, "riddle": "b"},
                    {"index": 2, "riddle": "c"}]),
        json.dumps({"0": "pas un tableau"}),
    ])
    def test_every_broken_shape_is_refused(self, rooms, owner_client, text):
        with patch("games.riddles.get_llm_client") as get_client:
            get_client.return_value.complete.return_value = _reply(text)

            response = owner_client.post(RIDDLES_URL, _payload(rooms), format="json")

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert response.data["detail"]
        assert Hunt.objects.count() == 0

    def test_a_fenced_block_is_still_read(self, rooms, owner_client):
        """Le seul écart de forme qu'un modèle produit encore, et il ne change
        rien au contenu — le refuser coûterait une génération pour du décor."""
        fenced = "```json\n" + _three_riddles().text + "\n```"
        with patch("games.riddles.get_llm_client") as get_client:
            get_client.return_value.complete.return_value = _reply(fenced)

            response = owner_client.post(RIDDLES_URL, _payload(rooms), format="json")

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["riddles"]) == 3

    def test_a_provider_outage_degrades_into_a_readable_refusal(self, rooms, owner_client):
        with patch("games.riddles.get_llm_client") as get_client:
            get_client.return_value.complete.side_effect = LLMError("boom")

            response = owner_client.post(RIDDLES_URL, _payload(rooms), format="json")

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert response.data["detail"]

    def test_too_many_rooms_are_refused_before_the_call(self, household, owner, owner_client):
        many = [
            Zone.objects.create(household=household, name=f"Pièce {i}", created_by=owner)
            for i in range(MAX_ZONES + 1)
        ]
        with patch("games.riddles.get_llm_client") as get_client:
            response = owner_client.post(RIDDLES_URL, _payload(many), format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        get_client.assert_not_called()


@pytest.mark.usefixtures("without_key")
class TestAnInstanceWithoutAKeyStillPlays:
    """CHAS-12 — sans clé Anthropic, tout marche sauf l'aide à l'écriture."""

    def test_the_endpoint_says_what_is_missing(self, rooms, owner_client):
        response = owner_client.post(RIDDLES_URL, _payload(rooms), format="json")

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.data["capability"] == "hunt_riddles"
        assert "ANTHROPIC_API_KEY" in response.data["env_vars"]
        assert response.data["docs_url"]

    def test_the_refusal_comes_before_any_provider_call(self, rooms, owner_client):
        """`capabilities.require` est posé **avant** l'appel qui coûte."""
        with patch("games.riddles.get_llm_client") as get_client:
            owner_client.post(RIDDLES_URL, _payload(rooms), format="json")

        get_client.assert_not_called()

    def test_the_screen_can_read_the_absence_before_promising(self, owner_client):
        response = owner_client.get("/api/capabilities/")

        rows = {row["key"]: row for row in response.json()["capabilities"]}
        assert rows["hunt_riddles"]["available"] is False

    def test_composing_by_hand_still_works_end_to_end(self, rooms, owner_client):
        """Le repli manuel n'est pas un mode dégradé : c'est le chemin normal."""
        created = owner_client.post(
            reverse("hunt-list"),
            {
                "name": "Chasse écrite à la main",
                "treasure_text": "Dans le four éteint",
                "steps": [
                    {"zone": str(rooms[0].id), "riddle": "Je sens le pain grillé"},
                    {"zone": str(rooms[1].id), "riddle": "L'eau y chante"},
                ],
            },
            format="json",
        )
        assert created.status_code == status.HTTP_201_CREATED

        started = owner_client.post(reverse("hunt-start", args=[created.data["id"]]))
        assert started.status_code == status.HTTP_200_OK
        assert started.data["current_step"]["riddle"] == "Je sens le pain grillé"


@pytest.mark.usefixtures("with_key")
class TestTheDoorIsWhereTheFrontKnocks:
    """DRF ne dérive pas `url_path` et `url_name` de la même façon.

    `url_name` remplace les underscores par des tirets, `url_path` non : une
    action nommée `generate_riddles` se sert donc par défaut sur
    `/generate_riddles/` tout en se nommant `hunt-generate-riddles`. Un test qui
    passe par `reverse()` reste vert pendant que le front prend un 404 — c'est
    exactement ce qui est arrivé à la planche d'impression du lot 1. D'où le test
    sur le **chemin littéral**, seul à valoir preuve.
    """

    def test_the_literal_path_answers(self, rooms, owner_client):
        with patch("games.riddles.get_llm_client") as get_client:
            get_client.return_value.complete.return_value = _three_riddles()

            response = owner_client.post(RIDDLES_URL, _payload(rooms), format="json")

        assert response.status_code == status.HTTP_200_OK

    def test_reverse_agrees_with_the_literal_path(self):
        assert reverse("hunt-generate-riddles") == RIDDLES_URL

    def test_it_refuses_an_anonymous_caller(self, rooms):
        response = APIClient().post(RIDDLES_URL, _payload(rooms), format="json")

        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN
        )

    def test_it_refuses_a_room_from_another_household(self, owner, owner_client, household):
        """Sans ce contrôle, un client ferait écrire des énigmes sur les pièces
        du voisin — et apprendrait leurs noms au passage."""
        elsewhere = Household.objects.create(name="Ailleurs")
        foreign = Zone.objects.create(household=elsewhere, name="Cave", created_by=owner)

        with patch("games.riddles.get_llm_client") as get_client:
            response = owner_client.post(RIDDLES_URL, _payload([foreign]), format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        get_client.assert_not_called()
