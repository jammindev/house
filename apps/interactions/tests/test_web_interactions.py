import pytest
from django.urls import reverse

from accounts.models import User
from documents.models import Document
from households.models import Household, HouseholdMember
from projects.models import Project


@pytest.fixture
def user(db):
    return User.objects.create_user(email='interactions-web@test.dev', password='secret')


@pytest.fixture
def household(db):
    return Household.objects.create(name='Home')


@pytest.fixture
def membership(user, household):
    user.active_household = household
    user.save(update_fields=['active_household'])
    return HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)


@pytest.mark.django_db
def test_interaction_new_page_accepts_source_document_props(client, user, household, membership):
    document = Document.objects.create(
        household=household,
        created_by=user,
        file_path='docs/source.pdf',
        name='Source document',
        mime_type='application/pdf',
        type='document',
        notes='Existing context from the document.',
        ocr_text='OCR content that should not override explicit notes.',
    )
    client.force_login(user)

    response = client.get(
        f"{reverse('app_interaction_new')}?source_document_id={document.id}",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 200
    props = response.context['react_props']
    assert props['sourceDocument'] == {
        'id': str(document.id),
        'name': 'Source document',
        'type': 'document',
        'notes': 'Existing context from the document.',
        'ocrExcerpt': 'OCR content that should not override explicit notes.',
        'suggestedSubject': 'Source document',
        'suggestedContent': 'Existing context from the document.',
    }
    assert props['linkedDocumentIds'] == [str(document.id)]
    assert props['redirectAfterSuccessUrl'] == reverse('app_documents_detail', kwargs={'document_id': document.id})
    assert props['initialSubject'] == 'Source document'
    assert props['initialContent'] == 'Existing context from the document.'


@pytest.mark.django_db
def test_interaction_new_page_uses_ocr_excerpt_when_document_has_no_notes(client, user, household, membership):
    document = Document.objects.create(
        household=household,
        created_by=user,
        file_path='docs/ocr-source.pdf',
        name='OCR source',
        mime_type='application/pdf',
        type='document',
        ocr_text='A' * 300,
    )
    client.force_login(user)

    response = client.get(
        f"{reverse('app_interaction_new')}?source_document_id={document.id}",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 200
    props = response.context['react_props']
    assert props['initialSubject'] == 'OCR source'
    assert props['initialContent'] == f"{'A' * 280}..."
    assert props['sourceDocument']['ocrExcerpt'] == f"{'A' * 280}..."


@pytest.mark.django_db
def test_interaction_new_page_rejects_inaccessible_source_document(client, user, household, membership):
    other_user = User.objects.create_user(email='other-interactions-web@test.dev', password='secret')
    other_household = Household.objects.create(name='Other home')
    HouseholdMember.objects.create(user=other_user, household=other_household, role=HouseholdMember.Role.OWNER)
    document = Document.objects.create(
        household=other_household,
        created_by=other_user,
        file_path='docs/private-source.pdf',
        name='Private source',
        mime_type='application/pdf',
        type='document',
    )
    client.force_login(user)

    response = client.get(
        f"{reverse('app_interaction_new')}?source_document_id={document.id}",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_interaction_new_page_with_source_interaction_id(client, user, household, membership):
    from interactions.models import Interaction
    from zones.models import Zone

    zone = Zone.objects.create(household=household, name='Living room')
    source = Interaction.objects.create(
        household=household,
        created_by=user,
        subject='Water leak in kitchen',
        type='issue',
        occurred_at='2026-03-01T10:00:00Z',
    )
    source.zones.add(zone)
    client.force_login(user)

    response = client.get(
        f"{reverse('app_interaction_new')}?type=todo&source_interaction_id={source.id}",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 200
    props = response.context['react_props']
    assert props['sourceInteraction'] == {
        'id': str(source.id),
        'subject': 'Water leak in kitchen',
        'type': 'issue',
    }
    assert props['initialSubject'] == 'Water leak in kitchen'
    assert str(zone.id) in props['initialZoneIds']
    assert props['defaultType'] == 'todo'


@pytest.mark.django_db
def test_interaction_new_page_with_type_todo_and_source_document(client, user, household, membership):
    document = Document.objects.create(
        household=household,
        created_by=user,
        file_path='docs/invoice.pdf',
        name='Maintenance invoice',
        mime_type='application/pdf',
        type='document',
    )
    client.force_login(user)

    response = client.get(
        f"{reverse('app_interaction_new')}?type=todo&source_document_id={document.id}",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 200
    props = response.context['react_props']
    assert props['defaultType'] == 'todo'
    assert props['linkedDocumentIds'] == [str(document.id)]


@pytest.mark.django_db
def test_interaction_new_page_with_project_id(client, user, household, membership):
    from zones.models import Zone

    zone = Zone.objects.create(household=household, name='Salle de bain')
    project = Project.objects.create(
        household=household,
        created_by=user,
        title='Rénovation salle de bain',
        type='renovation',
        status='active',
    )
    project.project_zones.create(zone=zone, created_by=user)
    client.force_login(user)

    response = client.get(
        f"{reverse('app_interaction_new')}?type=todo&project_id={project.id}",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 200
    props = response.context['react_props']
    assert props['initialProjectId'] == str(project.id)
    assert props['initialProjectTitle'] == 'Rénovation salle de bain'
    assert str(zone.id) in props['initialZoneIds']
    assert props['defaultType'] == 'todo'
    assert props['redirectAfterSuccessUrl'] == reverse('app_projects_detail', kwargs={'project_id': project.id}) + '?tab=tasks'


@pytest.mark.django_db
def test_interaction_new_page_ignores_project_from_other_household(client, user, household, membership):
    other_user = User.objects.create_user(email='other-proj@test.dev', password='secret')
    other_household = Household.objects.create(name='Other home')
    HouseholdMember.objects.create(user=other_user, household=other_household, role=HouseholdMember.Role.OWNER)
    project = Project.objects.create(
        household=other_household,
        created_by=other_user,
        title='Projet privé',
        type='other',
        status='active',
    )
    client.force_login(user)

    response = client.get(
        f"{reverse('app_interaction_new')}?project_id={project.id}",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 200
    props = response.context['react_props']
    assert props['initialProjectId'] is None
    assert props['initialProjectTitle'] is None