"""Zones d'une photo : lisibles dans la liste, éditables depuis la photo.

Une photo mal rangée ne se corrigeait que depuis la zone (`attach_document`) ou à
l'upload, et rien ne distinguait celles qui n'ont aucune zone. Ce module couvre les
trois pièces qui manquaient :

  1. `zone_links` sur le serializer de **liste** — sans lui la galerie ne peut ni
     afficher la zone d'une vignette ni savoir laquelle n'en a pas ;
  2. le budget de requêtes de ce champ : la liste n'est **pas paginée**, donc
     résoudre la `GenericForeignKey` photo par photo coûterait une requête par lien ;
  3. `?without_zone=1` et `POST {detail}/set_zones/`.
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
from projects.models import Project
from zones.models import Zone

LIST_URL = "/api/documents/documents/"


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
    return UserFactory(email="photo-zones@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Photo Zones House")
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
def photo(household, owner):
    return _photo(household, owner)


# ---------------------------------------------------------------------------
# 1. zone_links dans la liste
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestZoneLinksInTheList:
    """La liste dit à quelle zone appartient chaque photo — et laquelle n'en a pas."""

    def test_list_exposes_zone_links_of_each_photo(self, client, photo, salon):
        link_document(entity=salon, document=photo)

        response = client.get(LIST_URL, {"type": "photo"})

        assert response.status_code == status.HTTP_200_OK
        payload = response.json()
        items = payload if isinstance(payload, list) else payload["results"]
        assert [
            (link["zone_id"], link["zone_name"]) for link in items[0]["zone_links"]
        ] == [(str(salon.id), "Salon")]

    def test_a_photo_without_zone_exposes_an_empty_list(self, client, photo):
        response = client.get(LIST_URL, {"type": "photo"})

        payload = response.json()
        items = payload if isinstance(payload, list) else payload["results"]
        # Une liste vide, jamais l'absence de clé : c'est ce qui fonde la pastille.
        assert items[0]["zone_links"] == []

    def test_a_project_link_is_not_a_zone_link(self, client, photo, household, owner):
        project = Project.objects.create(
            household=household, created_by=owner, title="Cuisine"
        )
        link_document(entity=project, document=photo)

        payload = client.get(LIST_URL, {"type": "photo"}).json()
        items = payload if isinstance(payload, list) else payload["results"]
        assert items[0]["zone_links"] == []

    def test_zone_links_cost_a_bounded_number_of_queries(
        self, client, household, owner, salon, django_assert_max_num_queries
    ):
        """La galerie n'est pas paginée : le coût ne peut pas suivre le nombre de photos.

        Sans prefetch de la `GenericForeignKey`, chaque lien tire sa zone à part —
        vingt photos, vingt requêtes de plus, et cinq cents pour un vrai foyer.
        """
        for index in range(20):
            link_document(entity=salon, document=_photo(household, owner, f"P{index}"))

        with django_assert_max_num_queries(15):
            response = client.get(LIST_URL, {"type": "photo"})
            assert response.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# 2. Filtre ?without_zone=1
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWithoutZoneFilter:
    def test_filter_returns_only_photos_without_a_zone(
        self, client, household, owner, salon
    ):
        zoned = _photo(household, owner, "Zoned")
        link_document(entity=salon, document=zoned)
        orphan = _photo(household, owner, "Orphan")

        payload = client.get(LIST_URL, {"type": "photo", "without_zone": "1"}).json()
        items = payload if isinstance(payload, list) else payload["results"]

        assert [str(item["id"]) for item in items] == [str(orphan.id)]

    def test_filter_off_returns_everything(self, client, household, owner, salon):
        link_document(entity=salon, document=_photo(household, owner, "Zoned"))
        _photo(household, owner, "Orphan")

        payload = client.get(LIST_URL, {"type": "photo"}).json()
        items = payload if isinstance(payload, list) else payload["results"]
        assert len(items) == 2

    def test_a_photo_linked_to_a_project_only_is_still_without_zone(
        self, client, household, owner
    ):
        photo = _photo(household, owner, "Chantier")
        project = Project.objects.create(
            household=household, created_by=owner, title="Chantier"
        )
        link_document(entity=project, document=photo)

        payload = client.get(LIST_URL, {"type": "photo", "without_zone": "1"}).json()
        items = payload if isinstance(payload, list) else payload["results"]
        assert [str(item["id"]) for item in items] == [str(photo.id)]


# ---------------------------------------------------------------------------
# 3. POST {detail}/set_zones/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSetZones:
    """Attribuer les zones d'une photo depuis la photo — remplacement atomique."""

    def url(self, photo):
        return f"{LIST_URL}{photo.id}/set_zones/"

    def test_assigns_zones_to_a_photo_without_any(self, client, photo, salon, cuisine):
        response = client.post(
            self.url(photo),
            {"zone_ids": [str(salon.id), str(cuisine.id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert _zone_links(photo) == {str(salon.id), str(cuisine.id)}
        assert {link["zone_name"] for link in response.json()["zone_links"]} == {
            "Salon",
            "Cuisine",
        }

    def test_replaces_the_previous_zones(self, client, photo, salon, cuisine):
        link_document(entity=salon, document=photo)

        response = client.post(
            self.url(photo), {"zone_ids": [str(cuisine.id)]}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert _zone_links(photo) == {str(cuisine.id)}

    def test_an_empty_list_clears_the_zones(self, client, photo, salon):
        link_document(entity=salon, document=photo)

        response = client.post(self.url(photo), {"zone_ids": []}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert _zone_links(photo) == set()
        assert response.json()["zone_links"] == []

    def test_a_kept_zone_link_is_left_untouched(self, client, photo, salon, cuisine):
        """Réenregistrer ne réécrit pas ce qui existait déjà.

        Un lien porte plus que sa cible (`note`, `phase`, `created_by`) : le
        ré-upserter à l'identique effacerait ce contexte en silence.
        """
        link, _ = link_document(
            entity=salon, document=photo, note="mur nord", phase="before"
        )

        client.post(
            self.url(photo),
            {"zone_ids": [str(salon.id), str(cuisine.id)]},
            format="json",
        )

        link.refresh_from_db()
        assert (link.note, link.phase) == ("mur nord", "before")

    def test_other_entity_links_survive(self, client, photo, salon, household, owner):
        project = Project.objects.create(
            household=household, created_by=owner, title="Chantier"
        )
        link_document(entity=project, document=photo)

        client.post(self.url(photo), {"zone_ids": [str(salon.id)]}, format="json")

        project_ct = ContentType.objects.get_for_model(Project)
        assert DocumentLink.objects.filter(
            document=photo, content_type=project_ct, object_id=project.id
        ).exists()

    def test_a_zone_of_another_household_is_refused(self, client, photo, owner):
        other = Household.objects.create(name="Ailleurs")
        foreign = Zone.objects.create(household=other, name="Garage", created_by=owner)

        response = client.post(
            self.url(photo), {"zone_ids": [str(foreign.id)]}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert _zone_links(photo) == set()

    def test_an_unknown_zone_is_refused(self, client, photo):
        response = client.post(
            self.url(photo), {"zone_ids": [str(uuid.uuid4())]}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_malformed_id_is_a_client_error_not_a_crash(self, client, photo):
        response = client.post(self.url(photo), {"zone_ids": ["nope"]}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_zone_ids_is_required(self, client, photo):
        response = client.post(self.url(photo), {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_zone_ids_must_be_a_list(self, client, photo, salon):
        response = client.post(
            self.url(photo), {"zone_ids": str(salon.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_photo_of_another_household_is_not_reachable(self, client, salon):
        stranger = UserFactory(email="stranger@example.com")
        other = Household.objects.create(name="Ailleurs")
        HouseholdMember.objects.create(
            user=stranger, household=other, role=HouseholdMember.Role.OWNER
        )
        foreign_photo = _photo(other, stranger, "Intruse")

        response = client.post(
            self.url(foreign_photo), {"zone_ids": [str(salon.id)]}, format="json"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_anonymous_is_rejected(self, photo, salon):
        response = APIClient().post(
            self.url(photo), {"zone_ids": [str(salon.id)]}, format="json"
        )
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
