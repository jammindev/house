# chickens/tests/test_document_links.py
"""
Document/photo linking on the chicken detail (harmonisation onglets docs/photos).

Coverage:
  1. chicken_tab_counts() — events/documents/photos split by document type.
  2. ChickenSerializer.tab_counts — populated on retrieve, null on list.
  3. DocumentLinkActionsMixin on ChickenViewSet — attach/detach/set_phase.
  4. GET /api/documents/documents/?chicken=<id> filters via DocumentLink.
"""
from __future__ import annotations

import pytest
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from chickens.models import Chicken, ChickenEvent
from chickens.services import chicken_tab_counts
from documents.models import Document, DocumentLink
from households.models import HouseholdMember

from .factories import (
    ChickenEventFactory,
    ChickenFactory,
    HouseholdFactory,
    HouseholdMemberFactory,
    UserFactory,
)


def _owner(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _document(household, user, *, name="Doc", doc_type="invoice") -> Document:
    return Document.objects.create(
        household=household,
        created_by=user,
        file_path=f"documents/{name.lower()}.bin",
        name=name,
        mime_type="application/octet-stream",
        type=doc_type,
    )


@pytest.fixture
def household():
    return HouseholdFactory()


@pytest.fixture
def owner(household):
    return _owner(household)


@pytest.fixture
def chicken(household, owner):
    return ChickenFactory(household=household, created_by=owner)


# ---------------------------------------------------------------------------
# 1. chicken_tab_counts
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_tab_counts_splits_documents_photos_and_events(household, owner, chicken):
    ChickenEventFactory(chicken=chicken, household=household, created_by=owner)
    ChickenEventFactory(chicken=chicken, household=household, created_by=owner)

    doc = _document(household, owner, name="Vet", doc_type="invoice")
    photo = _document(household, owner, name="Hen", doc_type="photo")
    ct = ContentType.objects.get_for_model(Chicken)
    DocumentLink.objects.create(content_type=ct, object_id=chicken.id, document=doc)
    DocumentLink.objects.create(content_type=ct, object_id=chicken.id, document=photo)

    counts = chicken_tab_counts(chicken)
    assert counts == {"events": 2, "documents": 1, "photos": 1}


# ---------------------------------------------------------------------------
# 2. Serializer tab_counts — retrieve vs list
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_retrieve_exposes_tab_counts(owner, chicken):
    resp = _client_for(owner).get(reverse("chicken-detail", args=[chicken.id]))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["tab_counts"] == {"events": 0, "documents": 0, "photos": 0}


@pytest.mark.django_db
def test_list_does_not_compute_tab_counts(owner, chicken):
    resp = _client_for(owner).get(reverse("chicken-list"))
    assert resp.status_code == status.HTTP_200_OK
    row = next(r for r in resp.data if str(r["id"]) == str(chicken.id))
    assert row["tab_counts"] is None


# ---------------------------------------------------------------------------
# 3. attach / detach / set_phase actions
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_attach_detach_document(household, owner, chicken):
    client = _client_for(owner)
    photo = _document(household, owner, name="Hen", doc_type="photo")

    attach = client.post(
        reverse("chicken-attach-document", args=[chicken.id]),
        {"document_id": str(photo.id), "phase": "before"},
        format="json",
    )
    assert attach.status_code == status.HTTP_201_CREATED
    ct = ContentType.objects.get_for_model(Chicken)
    link = DocumentLink.objects.get(content_type=ct, object_id=chicken.id, document=photo)
    assert link.phase == "before"

    set_phase = client.post(
        reverse("chicken-set-document-phase", args=[chicken.id]),
        {"document_id": str(photo.id), "phase": "after"},
        format="json",
    )
    assert set_phase.status_code == status.HTTP_200_OK
    link.refresh_from_db()
    assert link.phase == "after"

    detach = client.post(
        reverse("chicken-detach-document", args=[chicken.id]),
        {"document_id": str(photo.id)},
        format="json",
    )
    assert detach.status_code == status.HTTP_204_NO_CONTENT
    assert not DocumentLink.objects.filter(
        content_type=ct, object_id=chicken.id, document=photo
    ).exists()


# ---------------------------------------------------------------------------
# 4. document list filter ?chicken=<id>
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_documents_filtered_by_chicken(household, owner, chicken):
    client = _client_for(owner)
    linked = _document(household, owner, name="Linked", doc_type="invoice")
    _document(household, owner, name="Unrelated", doc_type="invoice")
    ct = ContentType.objects.get_for_model(Chicken)
    DocumentLink.objects.create(content_type=ct, object_id=chicken.id, document=linked)

    resp = client.get("/api/documents/documents/", {"chicken": str(chicken.id)})
    assert resp.status_code == status.HTTP_200_OK
    rows = resp.data["results"] if isinstance(resp.data, dict) else resp.data
    names = {r["name"] for r in rows}
    assert names == {"Linked"}
