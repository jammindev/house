import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from .factories import UserFactory, StaffUserFactory


@pytest.mark.django_db
class TestAuthViewSet:
    """Test authentication API endpoints."""
    
    def test_login_with_valid_credentials(self, api_client):
        """Test session login with valid credentials."""
        UserFactory(email="api@example.com", password="testpass123")
        url = reverse("auth-login")
        
        response = api_client.post(url, {
            "email": "api@example.com",
            "password": "testpass123",
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["detail"] == "Login successful."
        assert response.data["user"]["email"] == "api@example.com"
    
    def test_login_with_invalid_credentials(self, api_client):
        """Test session login with invalid credentials."""
        url = reverse("auth-login")
        
        response = api_client.post(url, {
            "email": "wrong@example.com",
            "password": "wrongpass",
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_requires_authentication(self, api_client):
        """Test logout endpoint requires authentication."""
        url = reverse("auth-logout")
        response = api_client.post(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_authenticated_user(self, api_client):
        """Test authenticated user can logout."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        url = reverse("auth-logout")
        response = api_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["detail"] == "Logout successful."


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


@pytest.mark.django_db
class TestMeEndpoint:
    """Test GET + PATCH /api/accounts/users/me/ — US1, US5."""

    def test_me_get_returns_current_user(self, authenticated_client, user):
        """GET /me/ returns the authenticated user's data."""
        url = reverse("user-me")
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == user.email
        assert "theme" in response.data
        assert "avatar" in response.data

    def test_me_get_requires_auth(self, api_client):
        """GET /me/ without auth returns 401."""
        url = reverse("user-me")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_patch_updates_display_name(self, authenticated_client, user):
        """PATCH /me/ updates display_name."""
        url = reverse("user-me")
        response = authenticated_client.patch(url, {"display_name": "Alice"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["display_name"] == "Alice"
        user.refresh_from_db()
        assert user.display_name == "Alice"

    def test_me_patch_updates_locale(self, authenticated_client, user):
        """PATCH /me/ updates locale."""
        url = reverse("user-me")
        response = authenticated_client.patch(url, {"locale": "fr"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["locale"] == "fr"
        user.refresh_from_db()
        assert user.locale == "fr"

    def test_me_patch_updates_theme(self, authenticated_client, user):
        """PATCH /me/ updates theme — US5."""
        url = reverse("user-me")
        response = authenticated_client.patch(url, {"theme": "dark"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["theme"] == "dark"
        user.refresh_from_db()
        assert user.theme == "dark"

    def test_me_get_returns_color_theme(self, authenticated_client, user):
        """GET /me/ includes color_theme field with default value."""
        url = reverse("user-me")
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert "color_theme" in response.data
        assert response.data["color_theme"] == "theme-house"

    def test_me_patch_updates_color_theme(self, authenticated_client, user):
        """PATCH /me/ updates color_theme."""
        url = reverse("user-me")
        response = authenticated_client.patch(url, {"color_theme": "theme-blue"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["color_theme"] == "theme-blue"
        user.refresh_from_db()
        assert user.color_theme == "theme-blue"

    def test_me_patch_rejects_invalid_color_theme(self, authenticated_client):
        """PATCH /me/ with unknown color_theme value returns 400."""
        url = reverse("user-me")
        response = authenticated_client.patch(url, {"color_theme": "theme-nonexistent"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_me_patch_ignores_is_staff(self, authenticated_client, user):
        """PATCH /me/ cannot elevate to staff via allowed_fields filter."""
        url = reverse("user-me")
        response = authenticated_client.patch(url, {"is_staff": True}, format="json")
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.is_staff is False

    def test_me_patch_rejects_invalid_locale(self, authenticated_client):
        """PATCH /me/ with invalid locale returns 400."""
        url = reverse("user-me")
        response = authenticated_client.patch(url, {"locale": "xx"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_me_patch_ignores_email(self, authenticated_client, user):
        """PATCH /me/ cannot change email (read-only)."""
        original_email = user.email
        url = reverse("user-me")
        response = authenticated_client.patch(url, {"email": "hacked@evil.com"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.email == original_email


@pytest.mark.django_db
class TestChangePassword:
    """Test POST /api/accounts/users/me/change-password/ — US3."""

    def test_change_password_success(self, authenticated_client, user):
        """Successful password change returns 200."""
        url = reverse("user-change-password")
        response = authenticated_client.post(
            url,
            {"new_password": "NewS3curePass!", "confirm_password": "NewS3curePass!"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password("NewS3curePass!")

    def test_change_password_mismatch(self, authenticated_client):
        """Mismatched passwords return 400."""
        url = reverse("user-change-password")
        response = authenticated_client.post(
            url,
            {"new_password": "Password1!", "confirm_password": "Different1!"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_too_short(self, authenticated_client):
        """Password under 8 chars returns 400."""
        url = reverse("user-change-password")
        response = authenticated_client.post(
            url,
            {"new_password": "short", "confirm_password": "short"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_requires_auth(self, api_client):
        """Unauthenticated request returns 401."""
        url = reverse("user-change-password")
        response = api_client.post(
            url,
            {"new_password": "irrelevant", "confirm_password": "irrelevant"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestAvatarEndpoints:
    """Test POST/DELETE /api/accounts/users/me/avatar/ — US4."""

    def _make_image(self, name="test.png"):
        """Create a minimal valid PNG file in memory."""
        import io
        from PIL import Image as PilImage
        img = PilImage.new("RGB", (10, 10), color="red")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        from django.core.files.uploadedfile import SimpleUploadedFile
        return SimpleUploadedFile(name, buf.read(), content_type="image/png")

    def test_upload_avatar_success(self, authenticated_client, user):
        """POST /me/avatar/ with valid image returns 200 with avatar_url."""
        url = reverse("user-avatar")
        img = self._make_image()
        response = authenticated_client.post(url, {"avatar": img}, format="multipart")
        assert response.status_code == status.HTTP_200_OK
        assert "avatar_url" in response.data
        user.refresh_from_db()
        assert user.avatar

    def test_delete_avatar_success(self, authenticated_client, user):
        """DELETE /me/avatar/ removes the avatar."""
        # First upload
        url = reverse("user-avatar")
        img = self._make_image("avatar2.png")
        authenticated_client.post(url, {"avatar": img}, format="multipart")

        response = authenticated_client.delete(url)
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert not user.avatar

    def test_delete_avatar_no_avatar(self, authenticated_client, user):
        """DELETE /me/avatar/ when no avatar returns 400."""
        user.avatar = None
        user.save()
        url = reverse("user-avatar")
        response = authenticated_client.delete(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_avatar_no_file(self, authenticated_client):
        """POST /me/avatar/ without a file returns 400."""
        url = reverse("user-avatar")
        response = authenticated_client.post(url, {}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "avatar" in response.data

    def test_upload_avatar_too_large(self, authenticated_client):
        """POST /me/avatar/ with file > 2 MB returns 400."""
        import io
        from django.core.files.uploadedfile import SimpleUploadedFile

        large_content = b"a" * (2 * 1024 * 1024 + 1)
        large_file = SimpleUploadedFile("big.png", large_content, content_type="image/png")
        url = reverse("user-avatar")
        response = authenticated_client.post(url, {"avatar": large_file}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "avatar" in response.data

    def test_upload_avatar_replaces_existing(self, authenticated_client, user):
        """POST /me/avatar/ when user already has an avatar replaces it."""
        url = reverse("user-avatar")

        # First upload
        img1 = self._make_image("first.png")
        authenticated_client.post(url, {"avatar": img1}, format="multipart")
        user.refresh_from_db()
        first_name = user.avatar.name

        # Second upload
        img2 = self._make_image("second.png")
        response = authenticated_client.post(url, {"avatar": img2}, format="multipart")
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        # Avatar must have changed
        assert user.avatar.name != first_name
        assert "avatar_url" in response.data

    def test_upload_avatar_requires_auth(self, api_client):
        """POST /me/avatar/ without authentication returns 401."""
        url = reverse("user-avatar")
        img = self._make_image()
        response = api_client.post(url, {"avatar": img}, format="multipart")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_delete_avatar_requires_auth(self, api_client):
        """DELETE /me/avatar/ without authentication returns 401."""
        url = reverse("user-avatar")
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestLoginThrottling:
    """Test rate-limiting on the login endpoint."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Isolate throttle state between tests."""
        cache.clear()
        yield
        cache.clear()

    def _set_low_rates(self, monkeypatch, ip_rate="3/min", email_rate="3/min"):
        """Patch throttle classes to use low limits so tests run fast."""
        from accounts.throttles import LoginIPRateThrottle, LoginEmailRateThrottle
        monkeypatch.setattr(LoginIPRateThrottle, "get_rate", lambda self: ip_rate)
        monkeypatch.setattr(LoginEmailRateThrottle, "get_rate", lambda self: email_rate)

    def test_ip_throttle_blocks_after_limit(self, api_client, monkeypatch):
        """After N attempts from the same IP the endpoint returns 429."""
        self._set_low_rates(monkeypatch, ip_rate="3/min", email_rate="100/min")
        url = reverse("auth-login")

        for _ in range(3):
            api_client.post(url, {"email": "attacker@example.com", "password": "wrong"})

        response = api_client.post(url, {"email": "attacker@example.com", "password": "wrong"})
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    def test_email_throttle_blocks_targeted_attack(self, api_client, monkeypatch):
        """Repeated attempts against the same email are blocked even within IP limit."""
        self._set_low_rates(monkeypatch, ip_rate="100/min", email_rate="3/min")
        url = reverse("auth-login")

        for _ in range(3):
            api_client.post(url, {"email": "victim@example.com", "password": "wrong"})

        response = api_client.post(url, {"email": "victim@example.com", "password": "wrong"})
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    def test_email_throttle_is_per_address(self, api_client, monkeypatch):
        """Throttle on one email does not block a different email."""
        self._set_low_rates(monkeypatch, ip_rate="100/min", email_rate="3/min")
        url = reverse("auth-login")

        for _ in range(3):
            api_client.post(url, {"email": "victim@example.com", "password": "wrong"})

        # A completely different email should still get a normal response (401, not 429)
        response = api_client.post(url, {"email": "innocent@example.com", "password": "wrong"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_throttle_not_applied_to_logout(self, api_client, monkeypatch):
        """Logout endpoint has no throttle; many calls should not return 429."""
        self._set_low_rates(monkeypatch, ip_rate="3/min", email_rate="3/min")
        user = UserFactory()
        api_client.force_authenticate(user=user)
        url = reverse("auth-logout")

        for _ in range(10):
            response = api_client.post(url)

        assert response.status_code == status.HTTP_200_OK
