# banking/tests/factories.py
"""Factory-boy factories for the banking app tests."""

import uuid

import factory
from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory

from banking.models import BankAccount
from households.models import Household, HouseholdMember


class UserFactory(DjangoModelFactory):
    class Meta:
        model = get_user_model()

    email = factory.LazyFunction(lambda: f"user-{uuid.uuid4()}@example.com")
    password = "pass1234"

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", "pass1234")
        return model_class.objects.create_user(password=password, *args, **kwargs)


class HouseholdFactory(DjangoModelFactory):
    class Meta:
        model = Household

    name = factory.Sequence(lambda n: f"Banking House {n}")


class HouseholdMemberFactory(DjangoModelFactory):
    class Meta:
        model = HouseholdMember

    household = factory.SubFactory(HouseholdFactory)
    user = factory.SubFactory(UserFactory)
    role = HouseholdMember.Role.MEMBER


class BankAccountFactory(DjangoModelFactory):
    class Meta:
        model = BankAccount

    household = factory.SubFactory(HouseholdFactory)
    name = factory.Sequence(lambda n: f"Account {n}")
    bank_label = "Crédit Agricole"
    kind = BankAccount.Kind.BANK
    currency = "EUR"
