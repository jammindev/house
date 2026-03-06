import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from households.models import Household, HouseholdMember
from zones.models import Zone

User = get_user_model()


def _create_user(email: str | None = None):
	suffix = uuid.uuid4()
	return User.objects.create_user(email=email or f'user-{suffix}@example.com', password='pass1234')


def _create_household_with_owner(name: str = 'Maison Zones'):
	owner = _create_user()
	household = Household.objects.create(name=name)
	HouseholdMember.objects.create(household=household, user=owner, role=HouseholdMember.Role.OWNER)
	return owner, household


@pytest.mark.django_db
def test_delete_parent_zone_with_children_returns_conflict():
	owner, household = _create_household_with_owner('Maison Zones Delete Conflict')
	parent = Zone.objects.create(household=household, name='Rez-de-chaussée', created_by=owner)
	Zone.objects.create(household=household, name='Cuisine', parent=parent, created_by=owner)

	client = APIClient()
	client.force_authenticate(user=owner)

	response = client.delete(f'/api/zones/{parent.id}/', format='json', HTTP_X_HOUSEHOLD_ID=str(household.id))

	assert response.status_code == status.HTTP_409_CONFLICT
	assert 'children' in str(response.data.get('detail', '')).lower()


@pytest.mark.django_db
def test_stale_update_returns_conflict():
	owner, household = _create_household_with_owner('Maison Zones Stale Update')
	zone = Zone.objects.create(household=household, name='Salon', created_by=owner)

	client = APIClient()
	client.force_authenticate(user=owner)

	first_update = client.patch(
		f'/api/zones/{zone.id}/',
		{
			'name': 'Salon principal',
			'parent': None,
			'note': '',
			'surface': None,
			'last_known_updated_at': zone.updated_at.isoformat(),
		},
		format='json',
		HTTP_X_HOUSEHOLD_ID=str(household.id),
	)
	assert first_update.status_code == status.HTTP_200_OK

	stale_update = client.patch(
		f'/api/zones/{zone.id}/',
		{
			'name': 'Salon obsolète',
			'last_known_updated_at': zone.updated_at.isoformat(),
		},
		format='json',
		HTTP_X_HOUSEHOLD_ID=str(household.id),
	)

	assert stale_update.status_code == status.HTTP_409_CONFLICT
	assert 'reload' in str(stale_update.data.get('detail', '')).lower()


@pytest.mark.django_db
def test_zones_web_view_includes_initial_props(client):
	owner, household = _create_household_with_owner('Maison Zones Web')
	parent = Zone.objects.create(household=household, name='Maison', created_by=owner)
	child = Zone.objects.create(household=household, name='Garage', parent=parent, created_by=owner)

	owner.active_household = household
	owner.save(update_fields=['active_household'])

	client.force_login(owner)
	response = client.get('/app/zones/')

	assert response.status_code == status.HTTP_200_OK
	props = response.context['zones_page_props']
	assert len(props['initialZones']) >= 2
	ids = {entry['id'] for entry in props['initialZones']}
	assert str(parent.id) in ids
	assert str(child.id) in ids


@pytest.mark.django_db
def test_zone_detail_web_view_includes_initial_props(client):
	owner, household = _create_household_with_owner('Maison Zone Detail Web')
	zone = Zone.objects.create(household=household, name='Chambre', created_by=owner)

	owner.active_household = household
	owner.save(update_fields=['active_household'])

	client.force_login(owner)
	response = client.get(f'/app/zones/{zone.id}/')

	assert response.status_code == status.HTTP_200_OK
	props = response.context['zone_detail_page_props']
	assert props['zoneId'] == str(zone.id)
	assert props['initialZone']['id'] == str(zone.id)
	assert 'initialStats' in props
