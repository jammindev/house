"""DocumentLink polymorphic model: write helpers + read helpers over DocumentLink."""
import pytest
from django.contrib.contenttypes.models import ContentType

from accounts.models import User
from documents.models import Document, DocumentLink
from documents import services
from equipment.models import Equipment
from households.models import Household, HouseholdMember
from projects.models import Project
from zones.models import Zone


@pytest.fixture
def user(db):
    return User.objects.create_user(email="doclink@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="DocLink home")


@pytest.fixture
def membership(user, household):
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)


@pytest.fixture
def doc(household, user):
    return Document.objects.create(
        household=household, created_by=user, file_path="documents/f.pdf",
        name="Facture", mime_type="application/pdf", type="invoice",
    )


@pytest.mark.django_db
def test_link_document_creates_and_is_idempotent(household, user, doc):
    equipment = Equipment.objects.create(household=household, name="Chaudière", created_by=user)

    link, created = services.link_document(entity=equipment, document=doc, user=user, role="document")
    assert created is True
    assert link.role == "document"
    assert link.created_by_id == user.pk

    # Re-linking is an upsert, not a duplicate.
    _, created2 = services.link_document(entity=equipment, document=doc, user=user)
    assert created2 is False
    ct = ContentType.objects.get_for_model(Equipment)
    assert DocumentLink.objects.filter(content_type=ct, object_id=equipment.id, document=doc).count() == 1


@pytest.mark.django_db
def test_unlink_document_removes_link(household, user, doc):
    zone = Zone.objects.create(household=household, name="Salon", created_by=user)
    services.link_document(entity=zone, document=doc, user=user)
    assert services.unlink_document(entity=zone, document_id=doc.id) == 1

    ct = ContentType.objects.get_for_model(Zone)
    assert not DocumentLink.objects.filter(content_type=ct, object_id=zone.id, document=doc).exists()
    assert services.unlink_document(entity=zone, document_id=doc.id) == 0


@pytest.mark.django_db
def test_link_document_defaults_role_to_document(household, user, doc):
    zone = Zone.objects.create(household=household, name="Cave", created_by=user)
    link, _ = services.link_document(entity=zone, document=doc)  # no role, no user
    assert link.role == "document"
    assert link.created_by_id is None


@pytest.mark.django_db
def test_documents_for_entity_and_get_linked_documents(household, user, doc):
    project = Project.objects.create(household=household, created_by=user, title="Cuisine")
    services.link_document(entity=project, document=doc, user=user)

    assert list(services.documents_for_entity(project)) == [doc]
    assert services.get_linked_documents(project) == [doc]


@pytest.mark.django_db
def test_entity_links_for_document_resolves_via_searchables(household, user, doc):
    equipment = Equipment.objects.create(household=household, name="Pompe", created_by=user)
    services.link_document(entity=equipment, document=doc, user=user)

    links = services.entity_links_for_document(doc)
    assert {"entity_type": "equipment", "id": str(equipment.id),
            "label": "Pompe", "url_path": f"/app/equipment/{equipment.id}"} in links


@pytest.mark.django_db
def test_document_detail_api_exposes_entity_links(client, household, user, doc, membership):
    equipment = Equipment.objects.create(household=household, name="Ballon d'eau", created_by=user)
    services.link_document(entity=equipment, document=doc, user=user)
    client.force_login(user)

    response = client.get(f"/api/documents/documents/{doc.id}/")
    assert response.status_code == 200, response.content
    entity_links = response.json()["entity_links"]
    assert {"entity_type": "equipment", "id": str(equipment.id),
            "label": "Ballon d'eau", "url_path": f"/app/equipment/{equipment.id}"} in entity_links
