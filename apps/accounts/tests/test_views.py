import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from .factories import UserFactory

User = get_user_model()


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
        assert response.status_code == 200
        
        # Logout
        logout_url = reverse("logout")
        client.get(logout_url)
        
        # Verify user is logged out
        response = client.get(dashboard_url)
        assert response.status_code == 302
        assert reverse("login") in response.url
