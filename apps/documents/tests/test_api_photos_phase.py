"""
Tests for parcours-20: photo phases on DocumentLink.

Coverage:
  1. documents.services.link_document() persists the phase on the link.
  2. documents.services.set_document_phase() updates phase, returns 1.
  3. set_document_phase() returns 0 when the link does not exist.
  4. set_document_phase() raises ValueError on an invalid phase.
  5. DocumentLinkActionsMixin.attach_document via ProjectViewSet — with phase.
  6. DocumentLinkActionsMixin.set_document_phase via ProjectViewSet:
     - 200 + phase updated in DB.
     - 400 on invalid phase.
     - 404 when document not linked.
     - 401 for anonymous.
     - Cross-household isolation: other household user gets 403/404.
  7. GET /api/documents/documents/?project=<id>&type=photo exposes phase per doc.
"""
import pytest
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from documents.models import Document, DocumentLink
from documents.services import link_document, set_document_phase
from households.models import Household, HouseholdMember
from projects.models import Project


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _household(name: str) -> Household:
    return Household.objects.create(name=name)


def _membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _project(household, user, title="Phase project") -> Project:
    return Project.objects.create(
        household=household,
        created_by=user,
        title=title,
        status=Project.Status.ACTIVE,
        type=Project.Type.RENOVATION,
        priority=3,
    )


def _photo(household, user, name="Photo") -> Document:
    return Document.objects.create(
        household=household,
        created_by=user,
        file_path=f"documents/{name.lower()}.jpg",
        name=name,
        mime_type="image/jpeg",
        type="photo",
    )


def _doc_link(project, document) -> DocumentLink | None:
    ct = ContentType.objects.get_for_model(Project)
    return DocumentLink.objects.filter(
        content_type=ct, object_id=project.id, document=document
    ).first()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def owner(db):
    return UserFactory(email="phase-owner@example.com")


@pytest.fixture
def household(db, owner):
    hh = _household("Phase House")
    _membership(owner, hh, role=HouseholdMember.Role.OWNER)
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def project(household, owner):
    return _project(household, owner)


@pytest.fixture
def photo(household, owner):
    return _photo(household, owner)


# ---------------------------------------------------------------------------
# TestLinkDocumentPhaseService — unit tests for services.link_document phase
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLinkDocumentPhaseService:
    """link_document() persists the phase kwarg on the DocumentLink."""

    def test_link_document_with_before_phase_persists_phase(self, owner, project, photo):
        link, created = link_document(entity=project, document=photo, user=owner, phase="before")
        assert created is True
        assert link.phase == "before"
        # Verify DB state directly
        db_link = _doc_link(project, photo)
        assert db_link is not None
        assert db_link.phase == "before"

    def test_link_document_with_after_phase_persists_phase(self, owner, project, photo):
        link, created = link_document(entity=project, document=photo, user=owner, phase="after")
        assert created is True
        assert link.phase == "after"
        db_link = _doc_link(project, photo)
        assert db_link.phase == "after"

    def test_link_document_with_during_phase_persists_phase(self, owner, project, photo):
        link, _ = link_document(entity=project, document=photo, user=owner, phase="during")
        assert link.phase == "during"

    def test_link_document_without_phase_defaults_to_empty_string(self, owner, project, photo):
        link, _ = link_document(entity=project, document=photo, user=owner)
        assert link.phase == ""
        db_link = _doc_link(project, photo)
        assert db_link.phase == ""


# ---------------------------------------------------------------------------
# TestSetDocumentPhaseService — unit tests for services.set_document_phase
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSetDocumentPhaseService:
    """set_document_phase() updates phase, returns 1; returns 0 when not linked; raises ValueError on bad phase."""

    def test_updates_phase_and_returns_one(self, owner, project, photo):
        link_document(entity=project, document=photo, user=owner, phase="before")
        result = set_document_phase(entity=project, document_id=photo.id, phase="after")
        assert result == 1
        # Verify DB state
        db_link = _doc_link(project, photo)
        assert db_link.phase == "after"

    def test_returns_zero_when_link_does_not_exist(self, owner, project, photo):
        result = set_document_phase(entity=project, document_id=photo.id, phase="after")
        assert result == 0

    def test_raises_value_error_on_invalid_phase(self, owner, project, photo):
        link_document(entity=project, document=photo, user=owner)
        with pytest.raises(ValueError):
            set_document_phase(entity=project, document_id=photo.id, phase="invalid-phase")

    def test_clears_phase_with_empty_string(self, owner, project, photo):
        link_document(entity=project, document=photo, user=owner, phase="before")
        result = set_document_phase(entity=project, document_id=photo.id, phase="")
        assert result == 1
        db_link = _doc_link(project, photo)
        assert db_link.phase == ""

    def test_db_phase_unchanged_when_link_not_found(self, owner, project, photo):
        """No DB mutation should occur when the link is absent."""
        link_document(entity=project, document=photo, user=owner, phase="before")
        other_photo = _photo(project.household, owner, name="OtherPhoto")
        set_document_phase(entity=project, document_id=other_photo.id, phase="after")
        # The original link is unchanged
        db_link = _doc_link(project, photo)
        assert db_link.phase == "before"


# ---------------------------------------------------------------------------
# TestAttachDocumentWithPhaseAPI — POST attach_document with phase
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAttachDocumentWithPhaseAPI:
    """ProjectViewSet.attach_document persists phase on the DocumentLink."""

    def test_attach_photo_with_before_phase(self, owner_client, owner, project, photo):
        url = reverse("project-attach-document", kwargs={"pk": project.id})
        response = owner_client.post(
            url, {"document_id": str(photo.id), "phase": "before"}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["phase"] == "before"
        # Verify DB state
        db_link = _doc_link(project, photo)
        assert db_link is not None
        assert db_link.phase == "before"

    def test_attach_document_with_invalid_phase_returns_400(self, owner_client, project, photo):
        url = reverse("project-attach-document", kwargs={"pk": project.id})
        response = owner_client.post(
            url, {"document_id": str(photo.id), "phase": "unknown"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "phase" in response.data

    def test_attach_document_without_phase_creates_link_with_empty_phase(
        self, owner_client, project, photo
    ):
        url = reverse("project-attach-document", kwargs={"pk": project.id})
        response = owner_client.post(
            url, {"document_id": str(photo.id)}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["phase"] == ""
        db_link = _doc_link(project, photo)
        assert db_link.phase == ""

    def test_anonymous_cannot_attach_document(self, project, photo):
        client = APIClient()
        url = reverse("project-attach-document", kwargs={"pk": project.id})
        response = client.post(
            url, {"document_id": str(photo.id), "phase": "before"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_photo_returns_404(self, owner_client, owner, household, project):
        """A photo from another household cannot be attached to this project."""
        other_hh = _household("Other Photo House")
        _membership(owner, other_hh)
        foreign_photo = Document.objects.create(
            household=other_hh,
            created_by=owner,
            file_path="documents/foreign.jpg",
            name="ForeignPhoto",
            mime_type="image/jpeg",
            type="photo",
        )
        url = reverse("project-attach-document", kwargs={"pk": project.id})
        response = owner_client.post(
            url, {"document_id": str(foreign_photo.id), "phase": "before"}, format="json"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert _doc_link(project, foreign_photo) is None


# ---------------------------------------------------------------------------
# TestSetDocumentPhaseAPI — POST set_document_phase via ProjectViewSet
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSetDocumentPhaseAPI:
    """ProjectViewSet.set_document_phase updates phase on an existing link."""

    def test_set_phase_happy_path(self, owner_client, owner, project, photo):
        link_document(entity=project, document=photo, user=owner, phase="before")
        url = reverse("project-set-document-phase", kwargs={"pk": project.id})
        response = owner_client.post(
            url, {"document_id": str(photo.id), "phase": "after"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["phase"] == "after"
        assert str(response.data["document"]) == str(photo.id)
        # Verify DB state
        db_link = _doc_link(project, photo)
        assert db_link.phase == "after"

    def test_set_phase_during(self, owner_client, owner, project, photo):
        link_document(entity=project, document=photo, user=owner, phase="before")
        url = reverse("project-set-document-phase", kwargs={"pk": project.id})
        response = owner_client.post(
            url, {"document_id": str(photo.id), "phase": "during"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        db_link = _doc_link(project, photo)
        assert db_link.phase == "during"

    def test_invalid_phase_returns_400(self, owner_client, owner, project, photo):
        link_document(entity=project, document=photo, user=owner, phase="before")
        url = reverse("project-set-document-phase", kwargs={"pk": project.id})
        response = owner_client.post(
            url, {"document_id": str(photo.id), "phase": "bogus"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "phase" in response.data
        # DB unchanged
        db_link = _doc_link(project, photo)
        assert db_link.phase == "before"

    def test_document_not_linked_returns_404(self, owner_client, project, photo):
        url = reverse("project-set-document-phase", kwargs={"pk": project.id})
        response = owner_client.post(
            url, {"document_id": str(photo.id), "phase": "after"}, format="json"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_missing_document_id_returns_400(self, owner_client, project):
        url = reverse("project-set-document-phase", kwargs={"pk": project.id})
        response = owner_client.post(url, {"phase": "after"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "document_id" in response.data

    def test_anonymous_gets_401(self, project, photo):
        link_document(entity=project, document=photo, phase="before")
        client = APIClient()
        url = reverse("project-set-document-phase", kwargs={"pk": project.id})
        response = client.post(
            url, {"document_id": str(photo.id), "phase": "after"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_user_cannot_set_phase(self, owner, household, project, photo):
        """A user from a different household must not be able to mutate this project's photo phases."""
        link_document(entity=project, document=photo, user=owner, phase="before")

        other_user = UserFactory(email="phase-other@example.com")
        other_hh = _household("Other Phase House")
        _membership(other_user, other_hh)
        other_user.active_household = other_hh
        other_user.save(update_fields=["active_household"])
        other_client = _client_for(other_user)

        url = reverse("project-set-document-phase", kwargs={"pk": project.id})
        response = other_client.post(
            url, {"document_id": str(photo.id), "phase": "after"}, format="json"
        )
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        # Phase must be unchanged in DB
        db_link = _doc_link(project, photo)
        assert db_link.phase == "before"


# ---------------------------------------------------------------------------
# TestDocumentListPhaseField — GET /api/documents/documents/?project=<id>
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDocumentListPhaseField:
    """DocumentSerializer exposes `phase` when the list is scoped to one entity."""

    def test_phase_exposed_when_scoped_to_project(self, owner_client, owner, project, photo):
        link_document(entity=project, document=photo, user=owner, phase="after")
        url = reverse("document-list")
        response = owner_client.get(url, {"project": str(project.id), "type": "photo"})
        assert response.status_code == status.HTTP_200_OK
        results = response.data if isinstance(response.data, list) else response.data.get("results", response.data)
        assert len(results) >= 1
        # The photo linked to this project should have phase=after
        matching = [r for r in results if str(r["id"]) == str(photo.id)]
        assert len(matching) == 1
        assert matching[0]["phase"] == "after"

    def test_phase_is_none_when_unscoped(self, owner_client, owner, project, photo):
        link_document(entity=project, document=photo, user=owner, phase="before")
        url = reverse("document-list")
        response = owner_client.get(url, {"type": "photo"})
        assert response.status_code == status.HTTP_200_OK
        results = response.data if isinstance(response.data, list) else response.data.get("results", response.data)
        matching = [r for r in results if str(r["id"]) == str(photo.id)]
        assert len(matching) == 1
        assert matching[0]["phase"] is None

    def test_phase_before_correctly_reflected(self, owner_client, owner, project, photo):
        link_document(entity=project, document=photo, user=owner, phase="before")
        url = reverse("document-list")
        response = owner_client.get(url, {"project": str(project.id)})
        assert response.status_code == status.HTTP_200_OK
        results = response.data if isinstance(response.data, list) else response.data.get("results", response.data)
        matching = [r for r in results if str(r["id"]) == str(photo.id)]
        assert len(matching) == 1
        assert matching[0]["phase"] == "before"

    def test_empty_phase_exposed_as_empty_string_when_scoped(self, owner_client, owner, project, photo):
        link_document(entity=project, document=photo, user=owner, phase="")
        url = reverse("document-list")
        response = owner_client.get(url, {"project": str(project.id)})
        assert response.status_code == status.HTTP_200_OK
        results = response.data if isinstance(response.data, list) else response.data.get("results", response.data)
        matching = [r for r in results if str(r["id"]) == str(photo.id)]
        assert len(matching) == 1
        assert matching[0]["phase"] == ""

    def test_anonymous_gets_401_on_document_list(self, project, photo):
        link_document(entity=project, document=photo, phase="before")
        client = APIClient()
        url = reverse("document-list")
        response = client.get(url, {"project": str(project.id), "type": "photo"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_photos_not_visible(self, owner, household, project, photo):
        """Photos from another household's project must not appear in this user's list."""
        link_document(entity=project, document=photo, user=owner, phase="after")

        other_user = UserFactory(email="phase-listother@example.com")
        other_hh = _household("Other List House")
        _membership(other_user, other_hh)
        other_user.active_household = other_hh
        other_user.save(update_fields=["active_household"])
        other_client = _client_for(other_user)

        url = reverse("document-list")
        response = other_client.get(url, {"project": str(project.id), "type": "photo"})
        assert response.status_code == status.HTTP_200_OK
        results = response.data if isinstance(response.data, list) else response.data.get("results", response.data)
        ids = [str(r["id"]) for r in results]
        assert str(photo.id) not in ids
