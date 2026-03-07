# electricity/tests/test_template_us1_context.py
import pytest
from django.urls import reverse

from households.models import HouseholdMember

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory


@pytest.mark.django_db
def test_app_electricity_template_renders_context(client):
    owner = UserFactory()
    household = HouseholdFactory(name="Maison F")
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)

    client.force_login(owner)
    response = client.get(reverse("app_electricity"), HTTP_X_HOUSEHOLD_ID=str(household.id))

    assert response.status_code == 200
    assert "electricity/app/electricity.html" in [template.name for template in response.templates]

    assert "react_props" in response.context
    assert "server_sections" in response.context

    props = response.context["react_props"]
    assert props["householdId"] == str(household.id)
    assert props["isOwner"] is True
    assert "summary" in props
    assert "circuitsCount" in props["summary"]
    assert "initialData" in props
    assert set(props["initialData"].keys()) == {"breakers", "circuits", "usagePoints", "activeLinks"}

    sections = response.context["server_sections"]
    assert set(sections.keys()) == {
        "circuits",
        "breakers",
        "rcds",
        "usage_points",
        "active_links",
        "inactive_links",
        "recent_changes",
    }
