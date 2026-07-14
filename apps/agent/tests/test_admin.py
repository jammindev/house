"""AgentConversation admin: the origin-type label + filter buckets."""
from __future__ import annotations

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model

from agent.admin import AgentConversationAdmin, ConversationKindFilter
from agent.models import AgentConversation

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(
        email="admin-test@example.com", password="x"
    )


def _conv(household, user, entity_type="", object_id=""):
    return AgentConversation.objects.create(
        household=household,
        created_by=user,
        context_entity_type=entity_type,
        context_object_id=object_id,
    )


def test_kind_label_per_origin(household, user):
    admin = AgentConversationAdmin(AgentConversation, AdminSite())
    web = _conv(household, user)
    telegram = _conv(household, user, "channel", "telegram")
    anchored = _conv(household, user, "project", "abc-123")

    assert admin.kind(web) == "Web"
    assert admin.kind(telegram) == "Canal · telegram"
    assert admin.kind(anchored) == "Ancrée · project"


@pytest.mark.parametrize(
    "value,expected",
    [
        ("web", {"web"}),
        ("channel", {"channel"}),
        ("anchored", {"anchored"}),
        (None, {"web", "channel", "anchored"}),
    ],
)
def test_kind_filter_buckets(household, user, value, expected):
    convs = {
        "web": _conv(household, user),
        "channel": _conv(household, user, "channel", "telegram"),
        "anchored": _conv(household, user, "project", "abc-123"),
    }
    filt = ConversationKindFilter.__new__(ConversationKindFilter)
    filt.parameter_name = "kind"
    filt.used_parameters = {"kind": value} if value else {}

    result = set(filt.queryset(None, AgentConversation.objects.all()))
    assert result == {convs[k] for k in expected}
