import json
import re
from datetime import timedelta

import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone

from app_settings.tests.factories import HouseholdFactory, HouseholdMemberFactory
from documents.models import Document
from interactions.models import Interaction
from projects.models import Project, UserPinnedProject

from .factories import UserFactory

User = get_user_model()


def _dashboard_props(response):
    match = re.search(
        r'<script id="dashboard-props" type="application/json">(.*?)</script>',
        response.content.decode(),
        re.S,
    )
    assert match is not None
    return json.loads(match.group(1))


@pytest.mark.django_db
class TestLoginView:
    """Test login view functionality."""
    
    def test_login_view_get(self, client):
        """Test GET request to login page."""
        url = reverse("login")
        response = client.get(url)
        
        assert response.status_code == 200
        assert "login.html" in [t.name for t in response.templates]
    
    def test_login_with_valid_credentials(self, client):
        """Test login with valid email and password."""
        user = UserFactory(email="test@example.com", password="testpass123")
        url = reverse("login")
        
        response = client.post(url, {
            "username": "test@example.com",
            "password": "testpass123",
        })
        
        assert response.status_code == 302
        assert response.url == reverse("app_dashboard")
    
    def test_login_with_invalid_credentials(self, client):
        """Test login with invalid credentials."""
        url = reverse("login")
        
        response = client.post(url, {
            "username": "wrong@example.com",
            "password": "wrongpass",
        })
        
        assert response.status_code == 200
        assert "Email ou mot de passe incorrect" in str(response.content)
    
    def test_authenticated_user_redirects_to_dashboard(self, client):
        """Test that authenticated users are redirected from login."""
        user = UserFactory()
        client.force_login(user)
        
        url = reverse("login")
        response = client.get(url)
        
        assert response.status_code == 302
        assert response.url == reverse("app_dashboard")
    
    def test_login_with_next_parameter(self, client):
        """Test login redirects to next parameter."""
        user = UserFactory(email="test@example.com", password="testpass123")
        url = reverse("login")
        
        response = client.post(f"{url}?next=/admin/", {
            "username": "test@example.com",
            "password": "testpass123",
        })
        
        assert response.status_code == 302


@pytest.mark.django_db
class TestDashboardView:
    """Test legacy dashboard redirect."""

    def test_dashboard_requires_authentication(self, client):
        """Test that unauthenticated users are redirected to login."""
        url = reverse("dashboard")
        response = client.get(url)

        assert response.status_code == 302
        assert reverse("login") in response.url

    def test_authenticated_user_is_redirected_to_app(self, client):
        """Test that authenticated users are redirected to app_dashboard."""
        user = UserFactory()
        client.force_login(user)

        url = reverse("dashboard")
        response = client.get(url)

        assert response.status_code == 302
        assert response.url == reverse("app_dashboard")


@pytest.mark.django_db
class TestAppDashboardView:
    def test_app_dashboard_requires_authentication(self, client):
        response = client.get(reverse('app_dashboard'))

        assert response.status_code == 302
        assert reverse('login') in response.url

    def test_app_dashboard_renders_react_payload(self, client):
        user = UserFactory()
        household = HouseholdFactory(name='Maison principale')
        membership = HouseholdMemberFactory(household=household, user=user)
        user.active_household = household
        user.save(update_fields=['active_household'])

        project = Project.objects.create(
            household=household,
            created_by=user,
            updated_by=user,
            title='Kitchen refresh',
            description='Refresh cabinets and lighting.',
            status='active',
            type='renovation',
        )
        UserPinnedProject.objects.create(household_member=membership, project=project)

        upcoming = Interaction.objects.create(
            household=household,
            created_by=user,
            updated_by=user,
            project=project,
            subject='Boiler inspection',
            content='Annual contractor visit.',
            type='maintenance',
            occurred_at=timezone.now() + timedelta(days=2),
        )
        Interaction.objects.create(
            household=household,
            created_by=user,
            updated_by=user,
            project=project,
            subject='Finish cabinet punch list',
            type='todo',
            status='pending',
            occurred_at=timezone.now() + timedelta(days=1),
        )
        Document.objects.create(
            household=household,
            created_by=user,
            updated_by=user,
            interaction=upcoming,
            file_path='household/manual.pdf',
            name='Boiler manual',
            type='manual',
        )

        client.force_login(user)
        response = client.get(reverse('app_dashboard'))

        assert response.status_code == 200
        assert 'app/dashboard.html' in [template.name for template in response.templates]
        assert response.context['react_root_id'] == 'dashboard-root'
        assert response.context['props_script_id'] == 'dashboard-props'
        assert response.context['page_vite_asset'] == 'src/pages/dashboard/index.tsx'

        props = _dashboard_props(response)

        assert props['header']['title'] == 'Maison principale'
        assert {section['id'] for section in props['sections']} == {
            'upcoming',
            'pinned-projects',
            'tasks',
            'activity',
            'documents',
        }
        assert 'Boiler inspection' in {item['title'] for item in props['sections'][0]['items']}
        assert 'Kitchen refresh' in {item['title'] for item in props['sections'][1]['items']}

    def test_app_dashboard_scopes_payload_to_active_household(self, client):
        user = UserFactory()
        selected_household = HouseholdFactory(name='Maison active')
        other_household = HouseholdFactory(name='Maison secondaire')

        selected_membership = HouseholdMemberFactory(household=selected_household, user=user)
        HouseholdMemberFactory(household=other_household, user=user)
        user.active_household = selected_household
        user.save(update_fields=['active_household'])

        selected_project = Project.objects.create(
            household=selected_household,
            created_by=user,
            updated_by=user,
            title='Selected project',
            status='active',
            type='renovation',
        )
        other_project = Project.objects.create(
            household=other_household,
            created_by=user,
            updated_by=user,
            title='Other project',
            status='active',
            type='maintenance',
        )

        UserPinnedProject.objects.create(household_member=selected_membership, project=selected_project)
        Interaction.objects.create(
            household=selected_household,
            created_by=user,
            updated_by=user,
            subject='Selected interaction',
            type='maintenance',
            occurred_at=timezone.now() + timedelta(days=1),
        )
        Interaction.objects.create(
            household=other_household,
            created_by=user,
            updated_by=user,
            subject='Other interaction',
            type='maintenance',
            occurred_at=timezone.now() + timedelta(days=1),
        )
        Document.objects.create(
            household=selected_household,
            created_by=user,
            updated_by=user,
            file_path='selected/file.pdf',
            name='Selected document',
            type='document',
        )
        Document.objects.create(
            household=other_household,
            created_by=user,
            updated_by=user,
            file_path='other/file.pdf',
            name='Other document',
            type='document',
        )

        client.force_login(user)
        response = client.get(reverse('app_dashboard'))
        props = _dashboard_props(response)

        visible_titles = {
            item['title']
            for section in props['sections']
            for item in section['items']
        }

        assert props['header']['title'] == 'Maison active'
        assert 'Selected project' in visible_titles
        assert 'Selected interaction' in visible_titles
        assert 'Selected document' in visible_titles
        assert 'Other project' not in visible_titles
        assert 'Other interaction' not in visible_titles
        assert 'Other document' not in visible_titles

    def test_app_dashboard_hides_private_interactions_from_other_members(self, client):
        owner = UserFactory()
        other_member = UserFactory()
        household = HouseholdFactory(name='Maison partagée')

        HouseholdMemberFactory(household=household, user=owner)
        HouseholdMemberFactory(household=household, user=other_member)
        owner.active_household = household
        owner.save(update_fields=['active_household'])

        Interaction.objects.create(
            household=household,
            created_by=other_member,
            updated_by=other_member,
            subject='Private note',
            type='note',
            is_private=True,
            occurred_at=timezone.now() - timedelta(hours=2),
        )
        Interaction.objects.create(
            household=household,
            created_by=other_member,
            updated_by=other_member,
            subject='Public note',
            type='note',
            is_private=False,
            occurred_at=timezone.now() - timedelta(hours=1),
        )

        client.force_login(owner)
        response = client.get(reverse('app_dashboard'))
        props = _dashboard_props(response)
        visible_titles = {
            item['title']
            for section in props['sections']
            for item in section['items']
        }

        assert 'Public note' in visible_titles
        assert 'Private note' not in visible_titles


@pytest.mark.django_db
class TestLogoutView:
    """Test logout view functionality."""
    
    def test_logout_redirects_to_login(self, client):
        """Test logout redirects to login page."""
        user = UserFactory()
        client.force_login(user)
        
        url = reverse("logout")
        response = client.get(url)
        
        assert response.status_code == 302
        assert response.url == reverse("login")
    
    def test_logout_clears_session(self, client):
        """Test that logout clears user session."""
        user = UserFactory()
        client.force_login(user)
        
        # Verify user is logged in
        dashboard_url = reverse("dashboard")
        response = client.get(dashboard_url)
        assert response.status_code == 302
        assert response.url == reverse("app_dashboard")
        
        # Logout
        logout_url = reverse("logout")
        client.get(logout_url)
        
        # Verify user is logged out
        response = client.get(dashboard_url)
        assert response.status_code == 302
        assert reverse("login") in response.url
