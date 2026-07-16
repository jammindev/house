"""DocumentLink polymorphic model: signal sync from legacy through tables + read helpers."""
import pytest
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from accounts.models import User
from documents.models import Document, DocumentLink
from documents import services
from equipment.models import Equipment, EquipmentDocument
from households.models import Household, HouseholdMember
from interactions.models import Interaction, InteractionDocument
from projects.models import Project, ProjectDocument
from tasks.models import Task, TaskDocument
from zones.models import Zone, ZoneDocument


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
def test_through_save_syncs_document_link(household, user, doc):
    equipment = Equipment.objects.create(household=household, name="Chaudière", created_by=user)
    EquipmentDocument.objects.create(equipment=equipment, document=doc, created_by=user, role="document")

    ct = ContentType.objects.get_for_model(Equipment)
    link = DocumentLink.objects.get(content_type=ct, object_id=equipment.id, document=doc)
    assert link.role == "document"
    assert link.created_by_id == user.pk


@pytest.mark.django_db
def test_through_delete_removes_document_link(household, user, doc):
    zone = Zone.objects.create(household=household, name="Salon", created_by=user)
    zd = ZoneDocument.objects.create(zone=zone, document=doc, created_by=user)
    ct = ContentType.objects.get_for_model(Zone)
    assert DocumentLink.objects.filter(content_type=ct, object_id=zone.id, document=doc).exists()

    zd.delete()
    assert not DocumentLink.objects.filter(content_type=ct, object_id=zone.id, document=doc).exists()


@pytest.mark.django_db
def test_task_document_without_role_defaults_to_document(household, user, doc):
    task = Task.objects.create(household=household, created_by=user, subject="Ranger")
    TaskDocument.objects.create(task=task, document=doc, created_by=user)
    ct = ContentType.objects.get_for_model(Task)
    link = DocumentLink.objects.get(content_type=ct, object_id=task.id, document=doc)
    assert link.role == "document"


@pytest.mark.django_db
def test_documents_for_entity_and_get_linked_documents(household, user, doc):
    project = Project.objects.create(household=household, created_by=user, title="Cuisine")
    ProjectDocument.objects.create(project=project, document=doc, created_by=user)

    assert list(services.documents_for_entity(project)) == [doc]
    assert services.get_linked_documents(project) == [doc]


@pytest.mark.django_db
def test_entity_links_for_document_resolves_via_searchables(household, user, doc):
    equipment = Equipment.objects.create(household=household, name="Pompe", created_by=user)
    EquipmentDocument.objects.create(equipment=equipment, document=doc, created_by=user)

    links = services.entity_links_for_document(doc)
    assert {"entity_type": "equipment", "id": str(equipment.id),
            "label": "Pompe", "url_path": f"/app/equipment/{equipment.id}"} in links


@pytest.mark.django_db
def test_document_detail_api_exposes_entity_links(client, household, user, doc, membership):
    equipment = Equipment.objects.create(household=household, name="Ballon d'eau", created_by=user)
    EquipmentDocument.objects.create(equipment=equipment, document=doc, created_by=user)
    client.force_login(user)

    response = client.get(f"/api/documents/documents/{doc.id}/")
    assert response.status_code == 200, response.content
    entity_links = response.json()["entity_links"]
    assert {"entity_type": "equipment", "id": str(equipment.id),
            "label": "Ballon d'eau", "url_path": f"/app/equipment/{equipment.id}"} in entity_links


@pytest.mark.django_db
def test_interaction_document_without_created_by_syncs(household, user, doc):
    interaction = Interaction.objects.create(
        household=household, created_by=user, subject="Note", type="note",
        occurred_at=timezone.now(),
    )
    InteractionDocument.objects.create(interaction=interaction, document=doc)  # no created_by field
    ct = ContentType.objects.get_for_model(Interaction)
    link = DocumentLink.objects.get(content_type=ct, object_id=interaction.id, document=doc)
    assert link.created_by_id is None


@pytest.mark.django_db
def test_backfill_migration_cold_run_preserves_metadata(household, user, doc):
    """The 0006 backfill recreates DocumentLink from pre-existing through rows,
    preserving created_at / role / created_by (cold: links cleared first)."""
    import importlib
    from django.apps import apps as django_apps

    zone = Zone.objects.create(household=household, name="Cave", created_by=user)
    zd = ZoneDocument.objects.create(zone=zone, document=doc, created_by=user, role="photo")

    # Simulate a fresh DB where the through rows exist but DocumentLink does not yet.
    DocumentLink.objects.all().delete()

    migration = importlib.import_module("documents.migrations.0006_backfill_document_links")
    migration.backfill(django_apps, None)

    ct = ContentType.objects.get_for_model(Zone)
    link = DocumentLink.objects.get(content_type=ct, object_id=zone.id, document=doc)
    assert link.role == "photo"
    assert link.created_by_id == user.pk
    assert link.created_at == zd.created_at
