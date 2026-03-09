import pytest
from django.urls import reverse

from accounts.models import User
from documents.models import Document
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from zones.models import Zone


@pytest.fixture
def user(db):
    return User.objects.create_user(email='documents-web@test.dev', password='secret')


@pytest.fixture
def household(db):
    return Household.objects.create(name='Home')


@pytest.fixture
def membership(user, household):
    user.active_household = household
    user.save(update_fields=['active_household'])
    return HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)


@pytest.mark.django_db
def test_documents_list_page_renders_with_ssr_props(client, user, household, membership):
    Document.objects.create(
        household=household,
        created_by=user,
        file_path='docs/manual.pdf',
        name='Manual',
        mime_type='application/pdf',
        type='manual',
    )
    client.force_login(user)

    response = client.get(reverse('app_documents'), HTTP_X_HOUSEHOLD_ID=str(household.id))

    assert response.status_code == 200
    assert 'core/react_page.html' in [template.name for template in response.templates]
    props = response.context['react_props']
    assert props['createUrl'] == reverse('app_documents_new')
    assert props['initialLoaded'] is True
    assert props['initialCounts']['total'] == 1
    assert props['initialCounts']['withoutActivity'] == 1


@pytest.mark.django_db
def test_documents_new_page_renders_upload_props(client, user, household, membership):
    client.force_login(user)

    response = client.get(reverse('app_documents_new'), HTTP_X_HOUSEHOLD_ID=str(household.id))

    assert response.status_code == 200
    assert 'core/react_page.html' in [template.name for template in response.templates]
    props = response.context['react_props']
    assert props['cancelUrl'] == reverse('app_documents')
    assert props['uploadApiUrl'] == '/api/documents/documents/upload/'
    assert any(option['value'] == 'invoice' for option in props['allowedTypes'])


@pytest.mark.django_db
def test_documents_pages_require_authentication(client, household):
    list_response = client.get(reverse('app_documents'), HTTP_X_HOUSEHOLD_ID=str(household.id))
    new_response = client.get(reverse('app_documents_new'), HTTP_X_HOUSEHOLD_ID=str(household.id))
    detail_response = client.get(reverse('app_documents_detail', kwargs={'document_id': 1}), HTTP_X_HOUSEHOLD_ID=str(household.id))

    assert list_response.status_code == 302
    assert reverse('login') in list_response.url
    assert new_response.status_code == 302
    assert reverse('login') in new_response.url
    assert detail_response.status_code == 302
    assert reverse('login') in detail_response.url


@pytest.mark.django_db
def test_documents_detail_page_renders_ssr_props(client, user, household, membership):
    zone = Zone.objects.create(household=household, name='Kitchen', created_by=user)
    interaction = Interaction.objects.create(
        household=household,
        created_by=user,
        subject='Kitchen receipt',
        type='expense',
        occurred_at='2026-03-08T08:00:00Z',
    )
    interaction.zones.add(zone)
    document = Document.objects.create(
        household=household,
        created_by=user,
        file_path='docs/receipt.pdf',
        name='Receipt',
        mime_type='application/pdf',
        type='receipt',
    )
    interaction.interaction_documents.create(document=document)
    client.force_login(user)

    response = client.get(
        reverse('app_documents_detail', kwargs={'document_id': document.id}),
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 200
    assert 'core/react_page.html' in [template.name for template in response.templates]
    props = response.context['react_props']
    assert props['documentId'] == str(document.id)
    assert props['listUrl'] == reverse('app_documents')
    assert props['attachInteractionApiUrl'] == reverse('interaction-document-list')
    assert props['createInteractionUrl'] == f"{reverse('app_interaction_new')}?source_document_id={document.id}"
    assert props['initialDocument']['qualification']['qualification_state'] == 'activity_linked'
    assert props['initialRecentInteractionCandidates'] == []


@pytest.mark.django_db
def test_documents_detail_page_returns_404_for_inaccessible_document(client, user, household, membership):
    other_user = User.objects.create_user(email='other-documents-web@test.dev', password='secret')
    other_household = Household.objects.create(name='Other home')
    HouseholdMember.objects.create(user=other_user, household=other_household, role=HouseholdMember.Role.OWNER)
    document = Document.objects.create(
        household=other_household,
        created_by=other_user,
        file_path='docs/private.pdf',
        name='Private',
        mime_type='application/pdf',
        type='document',
    )
    client.force_login(user)

    response = client.get(
        reverse('app_documents_detail', kwargs={'document_id': document.id}),
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_documents_detail_refresh_excludes_already_linked_recent_candidates(client, user, household, membership):
    zone = Zone.objects.create(household=household, name='Laundry', created_by=user)
    first_interaction = Interaction.objects.create(
        household=household,
        created_by=user,
        subject='Recent linked activity',
        type='maintenance',
        occurred_at='2026-03-09T10:00:00Z',
    )
    second_interaction = Interaction.objects.create(
        household=household,
        created_by=user,
        subject='Still attachable',
        type='note',
        occurred_at='2026-03-08T10:00:00Z',
    )
    first_interaction.zones.add(zone)
    second_interaction.zones.add(zone)
    document = Document.objects.create(
        household=household,
        created_by=user,
        file_path='docs/laundry.pdf',
        name='Laundry guide',
        mime_type='application/pdf',
        type='manual',
    )
    client.force_login(user)

    initial_response = client.get(
        reverse('app_documents_detail', kwargs={'document_id': document.id}),
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    initial_candidates = initial_response.context['react_props']['initialRecentInteractionCandidates']
    assert [item['subject'] for item in initial_candidates] == ['Recent linked activity', 'Still attachable']

    first_interaction.interaction_documents.create(document=document)

    refreshed_response = client.get(
        reverse('app_documents_detail', kwargs={'document_id': document.id}),
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    refreshed_props = refreshed_response.context['react_props']
    refreshed_candidates = refreshed_props['initialRecentInteractionCandidates']
    assert refreshed_props['initialDocument']['qualification']['qualification_state'] == 'activity_linked'
    assert [item['subject'] for item in refreshed_candidates] == ['Still attachable']