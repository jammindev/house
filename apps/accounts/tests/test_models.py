import pytest
from django.contrib.auth import get_user_model
from .factories import UserFactory, StaffUserFactory, SuperUserFactory

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    """Test User model functionality."""
    
    def test_create_user(self):
        """Test creating a regular user."""
        user = UserFactory()
        assert user.email
        assert user.is_active
        assert not user.is_staff
        assert not user.is_superuser
        assert user.check_password("defaultpass123")
    
    def test_create_user_with_email(self):
        """Test creating a user with specific email."""
        user = UserFactory(email="custom@example.com")
        assert user.email == "custom@example.com"
    
    def test_create_staff_user(self):
        """Test creating a staff user."""
        user = StaffUserFactory()
        assert user.is_staff
        assert not user.is_superuser
    
    def test_create_superuser(self):
        """Test creating a superuser."""
        user = SuperUserFactory()
        assert user.is_staff
        assert user.is_superuser
    
    def test_user_str_representation(self):
        """Test user string representation returns email."""
        user = UserFactory(email="test@example.com")
        assert str(user) == "test@example.com"
    
    def test_user_email_is_unique(self):
        """Test that user email must be unique."""
        from django.db import IntegrityError
        
        email = "duplicate@example.com"
        User.objects.create_user(email=email, password="pass123")
        
        with pytest.raises(IntegrityError):
            User.objects.create_user(email=email, password="pass456")
    
    def test_user_manager_create_user(self):
        """Test UserManager create_user method."""
        user = User.objects.create_user(
            email="manager@example.com",
            password="pass123"
        )
        assert user.email == "manager@example.com"
        assert user.check_password("pass123")
        assert not user.is_staff
        assert not user.is_superuser
    
    def test_user_manager_create_superuser(self):
        """Test UserManager create_superuser method."""
        user = User.objects.create_superuser(
            email="admin@example.com",
            password="admin123"
        )
        assert user.email == "admin@example.com"
        assert user.check_password("admin123")
        assert user.is_staff
        assert user.is_superuser
    
    def test_user_manager_requires_email(self):
        """Test that creating user without email raises error."""
        with pytest.raises(ValueError, match="The email must be set"):
            User.objects.create_user(email="", password="pass123")
    
    def test_password_hashing(self):
        """Test that passwords are properly hashed."""
        password = "securepass123"
        user = UserFactory(password=password)
        
        assert user.password != password
        assert user.check_password(password)
        assert not user.check_password("wrongpassword")
