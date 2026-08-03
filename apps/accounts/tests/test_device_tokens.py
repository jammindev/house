"""Jeton d'appareil — envoyer des photos depuis un téléphone, sans mot de passe.

Ce que ces tests tiennent :

1. **Le secret ne se relit jamais.** Il est rendu une fois à l'émission et n'existe
   ensuite qu'en empreinte. Un jeton qu'on peut relire en base n'est plus un jeton,
   c'est un mot de passe de plus.
2. **⚠️ Un jeton résout le foyer aussi bien qu'un JWT.** C'est *le* piège de ce lot :
   ``ActiveHouseholdMiddleware`` s'exécute **avant** l'authentification DRF et ne
   connaissait que le Bearer JWT, la session et le ``_force_auth_user`` des tests.
   Une classe d'authentification seule authentifierait l'utilisateur au niveau de la
   vue, mais le middleware aurait déjà posé ``request.household = None`` — et
   l'upload répondrait « A valid household context is required ». Ces tests passent
   donc par un **vrai en-tête HTTP**, jamais par ``force_authenticate``, sans quoi
   ils ne testeraient pas le chemin qui casse.
3. **Révoquer coupe tout de suite.** Pas au prochain redéploiement, pas à
   l'expiration : à la requête suivante.
4. **Un jeton ne donne accès qu'à l'envoi.** Le refus est le défaut : une vue qui
   n'a pas déclaré l'accepter le refuse, sans qu'on ait à y penser. C'est la règle
   de ``views_media`` (« ce qui n'est pas explicitement autorisé est refusé »)
   appliquée à l'authentification.
5. **Ce qui revient est borné aussi.** La réponse d'upload embarque normalement les
   cinq dernières entrées du journal du foyer, pour que l'interface web propose d'y
   relier le document. Un raccourci qui envoie une photo n'a pas à recevoir les
   libellés des dernières dépenses bancaires : « ne donner accès qu'à l'envoi » vaut
   pour la réponse autant que pour la requête.
"""
import io

import pytest
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import DeviceToken
from accounts.tests.factories import UserFactory
from documents.models import Document
from households.models import Household, HouseholdMember


def _jpeg(size=(600, 400)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (120, 160, 200)).save(buffer, "JPEG")
    return buffer.getvalue()


def _file(name="photo.jpg"):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(name, _jpeg(), content_type="image/jpeg")


@pytest.fixture
def household_and_user(db):
    user = UserFactory(email="device-owner@example.com")
    household = Household.objects.create(name="Device House", timezone="Europe/Paris")
    HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )
    user.active_household_id = household.id
    user.save(update_fields=["active_household_id"])
    return household, user


@pytest.fixture
def issued(household_and_user):
    """Un jeton émis, et son secret en clair — comme au moment de l'émission."""
    _, user = household_and_user
    token, raw = DeviceToken.issue(user=user, name="iPhone de Ben")
    return token, raw


def _client(raw: str) -> APIClient:
    """Un client authentifié **par en-tête**, jamais par force_authenticate."""
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Device {raw}")
    return client


def _upload(client, name="photo.jpg"):
    return client.post(
        reverse("document-upload"),
        {"file": _file(name), "type": "photo"},
        format="multipart",
    )


@pytest.mark.django_db
class TestTheSecretIsNeverReadableTwice:
    def test_the_raw_token_is_not_stored(self, issued):
        token, raw = issued
        token.refresh_from_db()

        assert raw not in str(token.__dict__.values())
        assert token.token_hash != raw
        assert len(token.token_hash) == 64  # sha256 hexdigest

    def test_two_tokens_never_share_a_secret(self, household_and_user):
        _, user = household_and_user
        _, first = DeviceToken.issue(user=user, name="a")
        _, second = DeviceToken.issue(user=user, name="b")

        assert first != second


@pytest.mark.django_db
class TestTheTokenResolvesTheHousehold:
    """Le piège du middleware — la régression que ce lot doit empêcher pour toujours."""

    def test_an_upload_authenticated_by_device_token_lands_in_the_household(
        self, issued, household_and_user
    ):
        household, _ = household_and_user
        token, raw = issued

        response = _upload(_client(raw))

        assert response.status_code == status.HTTP_201_CREATED, response.data
        document = Document.objects.get(id=response.data["document"]["id"])
        assert document.household_id == household.id
        assert document.type == "photo"

    def test_the_last_use_is_recorded(self, issued):
        token, raw = issued
        assert token.last_used_at is None

        _upload(_client(raw))

        token.refresh_from_db()
        assert token.last_used_at is not None

    def test_an_unknown_token_is_refused(self, household_and_user):
        response = _upload(_client("mzn_totally-made-up"))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestRevokingCutsAccessImmediately:
    def test_a_revoked_token_can_no_longer_send(self, issued):
        token, raw = issued
        assert _upload(_client(raw)).status_code == status.HTTP_201_CREATED

        token.revoke()

        assert _upload(_client(raw)).status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestATokenOnlyGrantsSending:
    """Refus par défaut : une vue qui n'a pas déclaré accepter les jetons les refuse."""

    def test_listing_documents_is_refused(self, issued):
        _, raw = issued

        response = _client(raw).get(reverse("document-list"))

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_reading_the_household_is_refused(self, issued):
        _, raw = issued

        response = _client(raw).get(reverse("accounts-me"))

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestTheResponseIsBoundedToo:
    def test_the_household_journal_does_not_travel_back_to_a_device(self, issued):
        _, raw = issued

        response = _upload(_client(raw))

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["document"].get("recent_interaction_candidates") in (None, [])

    def test_a_session_client_still_gets_the_candidates_key(self, household_and_user):
        _, user = household_and_user
        client = APIClient()
        client.force_authenticate(user=user)

        response = _upload(client)

        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert "recent_interaction_candidates" in response.data["document"]
