"""Tests for protected media serving view."""
import pytest
from django.test import override_settings
from django.urls import reverse

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember


def media_url(path):
    return f'/media/{path}'


@pytest.fixture
def household(db):
    return Household.objects.create(name='Test House')


@pytest.fixture
def member_user(db, household):
    user = UserFactory()
    HouseholdMember.objects.create(household=household, user=user, role=HouseholdMember.Role.OWNER)
    return user


@pytest.fixture
def other_user(db):
    return UserFactory()


@pytest.mark.django_db
class TestServeProtectedMedia:

    # ── Authentication ────────────────────────────────────────────────────────

    def test_anonymous_gets_401_for_avatar(self, client):
        response = client.get(media_url('avatars/photo.jpg'))
        assert response.status_code == 401

    def test_anonymous_gets_401_for_document(self, client, household):
        response = client.get(media_url(f'documents/{household.id}/2025/01/abc-file.pdf'))
        assert response.status_code == 401

    # ── Avatars : auth suffisante ─────────────────────────────────────────────

    @override_settings(DEBUG=False)
    def test_authenticated_user_can_access_avatar(self, client, member_user):
        client.force_login(member_user)
        response = client.get(media_url('avatars/photo.jpg'))
        assert response.status_code == 200
        assert response.get('X-Accel-Redirect') == '/_protected_media/avatars/photo.jpg'

    # ── Documents : vérification du foyer ────────────────────────────────────

    @override_settings(DEBUG=False)
    def test_member_can_access_household_document(self, client, member_user, household):
        client.force_login(member_user)
        path = f'documents/{household.id}/2025/01/abc-invoice.pdf'
        response = client.get(media_url(path))
        assert response.status_code == 200
        assert response.get('X-Accel-Redirect') == f'/_protected_media/{path}'

    @override_settings(DEBUG=False)
    def test_non_member_cannot_access_household_document(self, client, other_user, household):
        client.force_login(other_user)
        path = f'documents/{household.id}/2025/01/secret.pdf'
        response = client.get(media_url(path))
        assert response.status_code == 403

    @override_settings(DEBUG=False)
    def test_malformed_document_path_raises_404(self, client, member_user):
        client.force_login(member_user)
        response = client.get(media_url('documents/'))
        # No household_id in path
        assert response.status_code == 404

    @override_settings(DEBUG=False)
    def test_invalid_household_uuid_in_path_raises_404(self, client, member_user):
        client.force_login(member_user)
        response = client.get(media_url('documents/not-a-uuid/file.pdf'))
        assert response.status_code == 404

    # ── X-Accel-Redirect header ───────────────────────────────────────────────

    @override_settings(DEBUG=False)
    def test_x_accel_redirect_points_to_protected_location(self, client, member_user, household):
        client.force_login(member_user)
        path = f'documents/{household.id}/2025/03/file.pdf'
        response = client.get(media_url(path))
        assert response['X-Accel-Redirect'] == f'/_protected_media/{path}'
        assert response['Content-Type'] == ''
