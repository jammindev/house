"""Tests for POST /projects/{id}/register-purchase/."""
from decimal import Decimal

import pytest
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse

from accounts.models import User
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from projects.models import Project


@pytest.fixture
def user(db):
    return User.objects.create_user(email="proj-purchase@test.dev", password="secret")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email="proj-other@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Project home")


@pytest.fixture
def second_household(db):
    return Household.objects.create(name="Other project home")


@pytest.fixture
def membership(user, household):
    HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )


@pytest.fixture
def project(household, user):
    return Project.objects.create(
        household=household,
        title="Kitchen reno",
        planned_budget=Decimal("5000.00"),
        actual_cost_cached=Decimal("0.00"),
        created_by=user,
    )


def _purchase_url(project):
    return reverse("project-register-purchase", kwargs={"pk": project.id})


@pytest.mark.django_db
def test_register_purchase_increments_actual_cost_and_creates_expense(
    client, user, household, project, membership
):
    client.force_login(user)

    response = client.post(
        _purchase_url(project),
        data={
            "amount": "450.00",
            "supplier": "Leroy Merlin",
            "occurred_at": "2026-04-15T10:00:00Z",
            "notes": "Tiles for the floor",
        },
        content_type="application/json",
    )

    assert response.status_code == 201, response.content
    payload = response.json()
    assert payload["actual_cost_cached"] == "450.00"
    assert "interaction_id" in payload

    interaction = Interaction.objects.get(id=payload["interaction_id"])
    assert interaction.type == "expense"
    assert interaction.source == project
    assert interaction.source_content_type == ContentType.objects.get_for_model(Project)
    assert interaction.source_object_id == project.id
    assert interaction.household_id == household.id
    assert interaction.subject == "Purchase — Kitchen reno"
    assert interaction.metadata["kind"] == "project_purchase"
    assert interaction.metadata["amount"] == "450.00"
    assert interaction.metadata["supplier"] == "Leroy Merlin"
    assert interaction.metadata["project_title"] == "Kitchen reno"

    project.refresh_from_db()
    assert project.actual_cost_cached == Decimal("450.00")


@pytest.mark.django_db
def test_register_purchase_accumulates_actual_cost(client, user, project, membership):
    client.force_login(user)
    project.actual_cost_cached = Decimal("100.00")
    project.save(update_fields=["actual_cost_cached"])

    response = client.post(
        _purchase_url(project),
        data={"amount": "50.50"},
        content_type="application/json",
    )
    assert response.status_code == 201, response.content
    project.refresh_from_db()
    assert project.actual_cost_cached == Decimal("150.50")


@pytest.mark.django_db
def test_register_purchase_without_amount_does_not_touch_cost(client, user, project, membership):
    client.force_login(user)
    project.actual_cost_cached = Decimal("100.00")
    project.save(update_fields=["actual_cost_cached"])

    response = client.post(
        _purchase_url(project),
        data={"notes": "Free donation, only logging it"},
        content_type="application/json",
    )
    assert response.status_code == 201, response.content
    payload = response.json()
    assert "interaction_id" in payload
    project.refresh_from_db()
    assert project.actual_cost_cached == Decimal("100.00")
    interaction = Interaction.objects.get(id=payload["interaction_id"])
    assert interaction.metadata["amount"] is None


@pytest.mark.django_db
def test_register_purchase_isolates_between_households(
    client, other_user, second_household, project
):
    HouseholdMember.objects.create(
        user=other_user, household=second_household, role=HouseholdMember.Role.OWNER
    )
    client.force_login(other_user)

    response = client.post(
        _purchase_url(project),
        data={"amount": "10"},
        content_type="application/json",
    )
    assert response.status_code in (403, 404)
    assert Interaction.objects.filter(source_object_id=project.id).count() == 0


@pytest.mark.django_db
def test_register_purchase_requires_authentication(client, project):
    response = client.post(
        _purchase_url(project),
        data={"amount": "10"},
        content_type="application/json",
    )
    assert response.status_code in (401, 403)
    assert Interaction.objects.filter(source_object_id=project.id).count() == 0


@pytest.mark.django_db
def test_register_purchase_rejects_invalid_amount(client, user, project, membership):
    client.force_login(user)
    response = client.post(
        _purchase_url(project),
        data={"amount": "-50"},
        content_type="application/json",
    )
    assert response.status_code == 400
