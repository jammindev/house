# budget/tests/factories.py
"""Factory-boy factories for the budget app tests."""

import uuid

import factory
from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory

from budget.models import Budget
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

    name = factory.Sequence(lambda n: f"Budget House {n}")


class HouseholdMemberFactory(DjangoModelFactory):
    class Meta:
        model = HouseholdMember

    household = factory.SubFactory(HouseholdFactory)
    user = factory.SubFactory(UserFactory)
    role = HouseholdMember.Role.MEMBER


class BudgetFactory(DjangoModelFactory):
    class Meta:
        model = Budget
        skip_postgeneration_save = True

    name = factory.Sequence(lambda n: f"Budget {n}")
    monthly_amount = factory.Faker(
        "pydecimal", left_digits=4, right_digits=2, positive=True
    )
    is_global = False
    # household and created_by must be provided by each test


from budget.models import RecurringExpense  # noqa: E402


class RecurringExpenseFactory(DjangoModelFactory):
    class Meta:
        model = RecurringExpense
        skip_postgeneration_save = True

    label = factory.Sequence(lambda n: f"Recurring {n}")
    amount = factory.Faker("pydecimal", left_digits=3, right_digits=2, positive=True)
    cadence = RecurringExpense.Cadence.MONTHLY
    next_due_date = factory.Faker("date_object")
    supplier = ""
    notes = ""
    budget = None
    # household and created_by must be provided by each test
