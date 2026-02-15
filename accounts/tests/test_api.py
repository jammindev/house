import pytest
from django.urls import reverse
from rest_framework import status
from .factories import UserFactory, StaffUserFactory


@pytest.mark.django_db
class TestAuthViewSet:
    """Test authentication API endpoints."""
    
    def test_login_with_valid_credentials(self, api_client):
        """Test JWT login with valid credentials."""
        user = UserFactory(email="api@example.com", password="testpass123")
        url = reverse("auth-login")
        
        response = api_client.post(url, {
            "email": "api@example.com",
            "password": "testpass123",
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data
    
    def test_login_with_invalid_credentials(self, api_client):
        """Test JWT login with invalid credentials."""
        url = reverse("auth-login")
        
        response = api_client.post(url, {
            "email": "wrong@example.com",
            "password": "wrongpass",
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_refresh_token(self, api_client):
        """Test JWT token refresh."""
        user = UserFactory(email="refresh@example.com", password="testpass123")
        
        # Get initial tokens
        login_url = reverse("auth-login")
        login_response = api_client.post(login_url, {
            "email": "refresh@example.com",
            "password": "testpass123",
        })
        refresh_token = login_response.data["refresh"]
        
        # Refresh token
        refresh_url = reverse("auth-refresh")
        response = api_client.post(refresh_url, {
            "refresh": refresh_token,
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data


@pytest.mark.django_db
class TestUserViewSet:
    """Test user API endpoints."""
    
    def test_list_users_requires_authentication(self, api_client):
        """Test listing users requires authentication."""
        url = reverse("user-list")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_authenticated_user_can_list_own_user(self, authenticated_client, user):
        """Test authenticated user can only see themselves."""
        UserFactory.create_batch(3)  # Create other users
        
        url = reverse("user-list")
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["email"] == user.email
    
    def test_staff_user_can_list_all_users(self, api_client):
        """Test staff users can see all users."""
        staff = StaffUserFactory()
        api_client.force_authenticate(user=staff)
        
        UserFactory.create_batch(3)
        
        url = reverse("user-list")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 4  # 3 created + staff
    
    def test_create_user_no_auth(self, api_client):
        """Test creating user without authentication (registration)."""
        url = reverse("user-list")
        
        response = api_client.post(url, {
            "email": "newuser@example.com",
            "password": "newpass123",
            "first_name": "New",
            "last_name": "User",
        })
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["email"] == "newuser@example.com"
        assert "password" not in response.data
    
    def test_retrieve_user_detail(self, authenticated_client, user):
        """Test retrieving user detail."""
        url = reverse("user-detail", kwargs={"pk": user.id})
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == user.email
    
    def test_update_own_user(self, authenticated_client, user):
        """Test user can update their own data."""
        url = reverse("user-detail", kwargs={"pk": user.id})
        
        response = authenticated_client.patch(url, {
            "first_name": "Updated",
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["first_name"] == "Updated"
    
    def test_user_cannot_access_other_user(self, authenticated_client):
        """Test user cannot access other user's data."""
        other_user = UserFactory()
        url = reverse("user-detail", kwargs={"pk": other_user.id})
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_delete_user(self, authenticated_client, user):
        """Test user can delete their own account."""
        url = reverse("user-detail", kwargs={"pk": user.id})
        
        response = authenticated_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestUserSerializer:
    """Test user serializer functionality."""
    
    def test_password_is_write_only(self, authenticated_client, user):
        """Test that password is not returned in responses."""
        url = reverse("user-detail", kwargs={"pk": user.id})
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "password" not in response.data
    
    def test_password_is_hashed_on_create(self, api_client):
        """Test that password is properly hashed when creating user."""
        from django.contrib.auth import get_user_model
        
        url = reverse("user-list")
        response = api_client.post(url, {
            "email": "hash@example.com",
            "password": "plainpass123",
        })
        
        assert response.status_code == status.HTTP_201_CREATED
        
        User = get_user_model()
        user = User.objects.get(email="hash@example.com")
        assert user.check_password("plainpass123")
        assert user.password != "plainpass123"
