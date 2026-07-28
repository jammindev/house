"""Ranger un lot de photos : `POST {list}/bulk_add_zones/`.

Le lot **ajoute** les zones choisies, il ne remplace pas. Un lot qui remplacerait
effacerait en silence le rangement de photos qu'on n'a pas regardées une par une —
et cet effacement ne se verrait nulle part. Corollaire assumé, tenu par les tests
ci-dessous : le lot ne sait pas *retirer* une zone, ça reste le geste unitaire
(`set_zones`).

L'application est **tout ou rien** : une photo hors foyer dans la liste refuse le lot
entier plutôt que d'en ranger la moitié.
"""
import uuid

import pytest
from django.contrib.contenttypes.models import ContentType
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from documents.models import Document, DocumentLink
from documents.services import link_document
from households.models import Household, HouseholdMember
from zones.models import Zone

BULK_URL = "/api/documents/documents/bulk_add_zones/"


def _photo(household, user, name="Photo") -> Document:
    return Document.objects.create(
        household=household,
        created_by=user,
        file_path=f"documents/{name.lower()}.jpg",
        name=name,
        mime_type="image/jpeg",
        type="photo",
    )


def _zone_links(document) -> set[str]:
    ct = ContentType.objects.get_for_model(Zone)
    return {
        str(oid)
        for oid in DocumentLink.objects.filter(
            document=document, content_type=ct
        ).values_list("object_id", flat=True)
    }


@pytest.fixture
def owner(db):
    return UserFactory(email="bulk-zones@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Bulk Zones House")
    HouseholdMember.objects.create(
        user=owner, household=hh, role=HouseholdMember.Role.OWNER
    )
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def client(owner, household):
    api = APIClient()
    api.force_authenticate(user=owner)
    api.credentials(HTTP_X_HOUSEHOLD_ID=str(household.id))
    return api


@pytest.fixture
def salon(household, owner):
    return Zone.objects.create(household=household, name="Salon", created_by=owner)


@pytest.fixture
def cuisine(household, owner):
    return Zone.objects.create(household=household, name="Cuisine", created_by=owner)


@pytest.fixture
def photos(household, owner):
    return [_photo(household, owner, f"P{index}") for index in range(3)]


@pytest.mark.django_db
class TestBulkAddZones:
    def test_assigns_a_zone_to_every_selected_photo(self, client, photos, salon):
        response = client.post(
            BULK_URL,
            {
                "document_ids": [photo.id for photo in photos],
                "zone_ids": [str(salon.id)],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["updated"] == 3
        for photo in photos:
            assert _zone_links(photo) == {str(salon.id)}

    def test_adds_without_erasing_what_was_already_there(
        self, client, photos, salon, cuisine
    ):
        """Le lot est une addition — c'est toute la différence avec `set_zones`."""
        link_document(entity=cuisine, document=photos[0])

        client.post(
            BULK_URL,
            {
                "document_ids": [photo.id for photo in photos],
                "zone_ids": [str(salon.id)],
            },
            format="json",
        )

        assert _zone_links(photos[0]) == {str(cuisine.id), str(salon.id)}
        assert _zone_links(photos[1]) == {str(salon.id)}

    def test_a_photo_already_in_the_zone_is_left_untouched(self, client, photos, salon):
        """Ré-ajouter ne réécrit rien : un lien porte aussi `note`/`phase`."""
        link, _ = link_document(
            entity=salon, document=photos[0], note="mur nord", phase="before"
        )

        client.post(
            BULK_URL,
            {"document_ids": [photos[0].id], "zone_ids": [str(salon.id)]},
            format="json",
        )

        link.refresh_from_db()
        assert (link.note, link.phase) == ("mur nord", "before")
        assert _zone_links(photos[0]) == {str(salon.id)}

    def test_several_zones_at_once(self, client, photos, salon, cuisine):
        client.post(
            BULK_URL,
            {
                "document_ids": [photos[0].id],
                "zone_ids": [str(salon.id), str(cuisine.id)],
            },
            format="json",
        )

        assert _zone_links(photos[0]) == {str(salon.id), str(cuisine.id)}

    def test_an_empty_zone_list_is_refused(self, client, photos):
        """Vider les zones d'un lot n'est pas un geste offert — ce serait une
        destruction de masse déguisée en raccourci."""
        response = client.post(
            BULK_URL,
            {"document_ids": [photos[0].id], "zone_ids": []},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_an_empty_document_list_is_refused(self, client, salon):
        response = client.post(
            BULK_URL,
            {"document_ids": [], "zone_ids": [str(salon.id)]},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_both_keys_are_required(self, client, photos, salon):
        assert (
            client.post(BULK_URL, {"zone_ids": [str(salon.id)]}, format="json").status_code
            == status.HTTP_400_BAD_REQUEST
        )
        assert (
            client.post(
                BULK_URL, {"document_ids": [photos[0].id]}, format="json"
            ).status_code
            == status.HTTP_400_BAD_REQUEST
        )

    def test_a_zone_of_another_household_is_refused(self, client, photos, owner):
        other = Household.objects.create(name="Ailleurs")
        foreign = Zone.objects.create(household=other, name="Garage", created_by=owner)

        response = client.post(
            BULK_URL,
            {"document_ids": [photo.id for photo in photos], "zone_ids": [str(foreign.id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert _zone_links(photos[0]) == set()

    def test_a_photo_of_another_household_refuses_the_whole_batch(
        self, client, photos, salon
    ):
        """Tout ou rien : ranger la moitié d'un lot sans le dire est pire qu'échouer."""
        stranger = UserFactory(email="bulk-stranger@example.com")
        other = Household.objects.create(name="Ailleurs")
        HouseholdMember.objects.create(
            user=stranger, household=other, role=HouseholdMember.Role.OWNER
        )
        foreign_photo = _photo(other, stranger, "Intruse")

        response = client.post(
            BULK_URL,
            {
                "document_ids": [photos[0].id, foreign_photo.id],
                "zone_ids": [str(salon.id)],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert _zone_links(photos[0]) == set()
        assert _zone_links(foreign_photo) == set()

    def test_an_unknown_photo_refuses_the_whole_batch(self, client, photos, salon):
        response = client.post(
            BULK_URL,
            {"document_ids": [photos[0].id, 10_000_000], "zone_ids": [str(salon.id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert _zone_links(photos[0]) == set()

    def test_a_malformed_id_is_a_client_error_not_a_crash(self, client, photos, salon):
        assert (
            client.post(
                BULK_URL,
                {"document_ids": ["nope"], "zone_ids": [str(salon.id)]},
                format="json",
            ).status_code
            == status.HTTP_400_BAD_REQUEST
        )
        assert (
            client.post(
                BULK_URL,
                {"document_ids": [photos[0].id], "zone_ids": ["nope"]},
                format="json",
            ).status_code
            == status.HTTP_400_BAD_REQUEST
        )

    def test_an_unknown_zone_is_refused(self, client, photos):
        response = client.post(
            BULK_URL,
            {"document_ids": [photos[0].id], "zone_ids": [str(uuid.uuid4())]},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_repeated_photo_is_counted_once(self, client, photos, salon):
        response = client.post(
            BULK_URL,
            {
                "document_ids": [photos[0].id, photos[0].id],
                "zone_ids": [str(salon.id)],
            },
            format="json",
        )

        assert response.json()["updated"] == 1

    def test_the_batch_costs_a_bounded_number_of_queries(
        self, client, household, owner, salon, django_assert_max_num_queries
    ):
        """Trente photos ne valent pas trente allers-retours de plus.

        La version naïve — un `set_zones` par photo depuis le client — coûtait un
        appel HTTP par photo ; celle-ci ne doit pas refaire la même faute en SQL.
        """
        batch = [_photo(household, owner, f"B{index}") for index in range(30)]

        with django_assert_max_num_queries(20):
            response = client.post(
                BULK_URL,
                {"document_ids": [photo.id for photo in batch], "zone_ids": [str(salon.id)]},
                format="json",
            )
            assert response.status_code == status.HTTP_200_OK

    def test_anonymous_is_rejected(self, photos, salon):
        response = APIClient().post(
            BULK_URL,
            {"document_ids": [photos[0].id], "zone_ids": [str(salon.id)]},
            format="json",
        )
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
