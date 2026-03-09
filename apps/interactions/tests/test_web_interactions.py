import pytest
from django.urls import reverse

from accounts.models import User
from documents.models import Document
from households.models import Household, HouseholdMember


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
    }
    assert props['linkedDocumentIds'] == [str(document.id)]
    assert props['redirectAfterSuccessUrl'] == reverse('app_documents_detail', kwargs={'document_id': document.id})


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