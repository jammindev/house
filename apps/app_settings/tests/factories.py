# app_settings/tests/factories.py
import factory
import uuid
from django.contrib.auth import get_user_model

from households.models import Household, HouseholdMember


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = get_user_model()

    email = factory.LazyFunction(lambda: f"user-{uuid.uuid4()}@example.com")
    password = "pass1234"

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", "pass1234")
        return model_class.objects.create_user(password=password, *args, **kwargs)


class HouseholdFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Household

    name = factory.Sequence(lambda n: f"Maison {n}")


class HouseholdMemberFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = HouseholdMember

    household = factory.SubFactory(HouseholdFactory)
    user = factory.SubFactory(UserFactory)
    role = HouseholdMember.Role.MEMBER
