import factory
from factory.django import DjangoModelFactory
from django.contrib.auth import get_user_model

User = get_user_model()


class UserFactory(DjangoModelFactory):
    """Factory for creating User instances."""
    
    class Meta:
        model = User
        django_get_or_create = ("email",)
        skip_postgeneration_save = True
    
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    is_active = True
    is_staff = False
    is_superuser = False
    
    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        """Set password after user creation."""
        if not create:
            return
        
        if extracted:
            obj.set_password(extracted)
        else:
            obj.set_password("defaultpass123")
        obj.save()


class StaffUserFactory(UserFactory):
    """Factory for creating staff users."""
    
    is_staff = True
    email = factory.Sequence(lambda n: f"staff{n}@example.com")


class SuperUserFactory(UserFactory):
    """Factory for creating superusers."""
    
    is_staff = True
    is_superuser = True
    email = factory.Sequence(lambda n: f"admin{n}@example.com")
