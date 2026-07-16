import pytest
from django.urls import reverse

from accounts.models import User
from documents.models import Document
from equipment.models import Equipment, EquipmentDocument
from households.models import Household, HouseholdMember


@pytest.fixture
def user(db):
    return User.objects.create_user(email="eq-docs@test.dev", password="secret")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email="eq-docs-other@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Eq docs home")


@pytest.fixture
def membership(user, household):
    HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )


@pytest.fixture
def drill(household, user):
    return Equipment.objects.create(household=household, name="Cordless drill", created_by=user)


@pytest.fixture
def invoice(household, user):
    return Document.objects.create(
        household=household,
        created_by=user,
        file_path="docs/invoice.pdf",
        name="Invoice",
        mime_type="application/pdf",
        type="invoice",
    )


def _attach_url(equipment):
    return reverse("equipment-attach-document", kwargs={"pk": equipment.id})


def _detach_url(equipment):
    return reverse("equipment-detach-document", kwargs={"pk": equipment.id})


@pytest.mark.django_db
def test_attach_document_links_and_is_idempotent(client, user, drill, invoice, membership):
    client.force_login(user)

    response = client.post(
        _attach_url(drill), data={"document_id": str(invoice.id)}, content_type="application/json"
    )
    assert response.status_code == 201, response.content
    assert EquipmentDocument.objects.filter(equipment=drill, document=invoice).count() == 1

    # Re-attaching the same document is a no-op (200, no duplicate).
    response = client.post(
        _attach_url(drill), data={"document_id": str(invoice.id)}, content_type="application/json"
    )
    assert response.status_code == 200, response.content
    assert EquipmentDocument.objects.filter(equipment=drill, document=invoice).count() == 1


@pytest.mark.django_db
def test_attached_document_surfaces_via_equipment_filter(client, user, drill, invoice, membership):
    client.force_login(user)
    EquipmentDocument.objects.create(equipment=drill, document=invoice, created_by=user)

    response = client.get("/api/documents/documents/", data={"equipment": str(drill.id)})
    assert response.status_code == 200, response.content
    data = response.json()
    results = data["results"] if isinstance(data, dict) else data
    assert [str(d["id"]) for d in results] == [str(invoice.id)]


@pytest.mark.django_db
def test_detach_document_removes_link(client, user, drill, invoice, membership):
    client.force_login(user)
    EquipmentDocument.objects.create(equipment=drill, document=invoice, created_by=user)

    response = client.post(
        _detach_url(drill), data={"document_id": str(invoice.id)}, content_type="application/json"
    )
    assert response.status_code == 204, response.content
    assert not EquipmentDocument.objects.filter(equipment=drill, document=invoice).exists()

    # Detaching an unlinked document returns 404.
    response = client.post(
        _detach_url(drill), data={"document_id": str(invoice.id)}, content_type="application/json"
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_attach_document_isolated_between_households(client, other_user, drill, invoice):
    second = Household.objects.create(name="Foreign home")
    HouseholdMember.objects.create(
        user=other_user, household=second, role=HouseholdMember.Role.OWNER
    )
    client.force_login(other_user)

    response = client.post(
        _attach_url(drill), data={"document_id": str(invoice.id)}, content_type="application/json"
    )
    assert response.status_code in (403, 404)
    assert EquipmentDocument.objects.count() == 0
