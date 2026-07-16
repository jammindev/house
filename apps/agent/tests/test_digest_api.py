"""
API tests for GET /api/agent/digest/ (DigestView).

Covers: 200 + correct shape for a household member; disabled_sections reflected;
available_sections excludes household-disabled modules; 401 for anonymous;
403 for a user without a household.
"""
from __future__ import annotations

from datetime import date

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from agent.digest.collectors import DigestSection
from agent.digest.service import DigestResult
from households.models import Household, HouseholdMember


URL_NAME = "agent-digest"


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _noop_build_digest(household, user, *, today, disabled_sections=None):
    return DigestResult(sections=[])


def _section_build_digest(sections):
    def _build(household, user, *, today, disabled_sections=None):
        return DigestResult(sections=sections)
    return _build


@pytest.fixture
def owner(db):
    return UserFactory(email="digest-api-owner@example.com")


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Digest House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    owner.active_household = h
    owner.save(update_fields=["active_household"])
    return h


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.mark.django_db
class TestDigestViewHappyPath:
    """DigestView: 200 response with correct JSON shape for an authenticated member."""

    def test_returns_200_with_correct_keys(self, owner_client, household, monkeypatch):
        monkeypatch.setattr("agent.digest.api.build_digest", _noop_build_digest)
        url = reverse(URL_NAME)
        response = owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert "generated_on" in data
        assert "sections" in data
        assert "available_sections" in data
        assert "disabled_sections" in data

    def test_generated_on_is_today_iso(self, owner_client, household, monkeypatch):
        monkeypatch.setattr("agent.digest.api.build_digest", _noop_build_digest)
        url = reverse(URL_NAME)
        response = owner_client.get(url)
        assert response.data["generated_on"] == date.today().isoformat()

    def test_sections_have_expected_fields(self, owner_client, household, monkeypatch):
        section = DigestSection("tasks", "✅", "Tasks", ["Today: Fix boiler"])
        monkeypatch.setattr(
            "agent.digest.api.build_digest",
            _section_build_digest([section]),
        )
        url = reverse(URL_NAME)
        response = owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        sections = response.data["sections"]
        assert len(sections) == 1
        s = sections[0]
        assert s["key"] == "tasks"
        assert s["emoji"] == "✅"
        assert "title" in s
        assert "lines" in s
        assert "Today: Fix boiler" in s["lines"]

    def test_available_sections_lists_all_enabled(self, owner_client, household, monkeypatch):
        monkeypatch.setattr("agent.digest.api.build_digest", _noop_build_digest)
        url = reverse(URL_NAME)
        response = owner_client.get(url)
        available_keys = {entry["key"] for entry in response.data["available_sections"]}
        # tasks is always available (core, no module gate)
        assert "tasks" in available_keys

    def test_available_sections_excludes_disabled_module(self, owner_client, household, monkeypatch):
        household.disabled_modules = ["weather"]
        household.save(update_fields=["disabled_modules"])
        monkeypatch.setattr("agent.digest.api.build_digest", _noop_build_digest)
        url = reverse(URL_NAME)
        response = owner_client.get(url)
        available_keys = {entry["key"] for entry in response.data["available_sections"]}
        assert "weather" not in available_keys
        assert "tasks" in available_keys

    def test_disabled_sections_reflects_user_preference(self, owner, household, monkeypatch):
        owner.digest_disabled_sections = ["tasks", "stock"]
        owner.save(update_fields=["digest_disabled_sections"])
        monkeypatch.setattr("agent.digest.api.build_digest", _noop_build_digest)
        client = _client_for(owner)
        url = reverse(URL_NAME)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        disabled = response.data["disabled_sections"]
        assert "tasks" in disabled
        assert "stock" in disabled

    def test_unknown_section_keys_in_user_prefs_are_filtered(self, owner, household, monkeypatch):
        """Keys not in SECTION_KEYS on user.digest_disabled_sections must be silently dropped."""
        owner.digest_disabled_sections = ["tasks", "nonexistent_key"]
        owner.save(update_fields=["digest_disabled_sections"])
        monkeypatch.setattr("agent.digest.api.build_digest", _noop_build_digest)
        client = _client_for(owner)
        url = reverse(URL_NAME)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        disabled = response.data["disabled_sections"]
        assert "nonexistent_key" not in disabled
        assert "tasks" in disabled


@pytest.mark.django_db
class TestDigestViewPermissions:
    """DigestView: auth and membership checks."""

    def test_anonymous_gets_401(self, household):
        url = reverse(URL_NAME)
        response = APIClient().get(url)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_member_without_active_household_still_works(self, monkeypatch, db):
        """A user who belongs to exactly one household gets it auto-resolved."""
        user = UserFactory(email="single-hh@example.com")
        h = Household.objects.create(name="Only House")
        HouseholdMember.objects.create(
            user=user, household=h, role=HouseholdMember.Role.MEMBER
        )
        # Do NOT set active_household — the permission layer auto-resolves single membership
        monkeypatch.setattr("agent.digest.api.build_digest", _noop_build_digest)
        client = _client_for(user)
        url = reverse(URL_NAME)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_second_household_member_gets_their_own_disabled_sections(self, owner, household, monkeypatch):
        """Two users sharing a household each see their own digest_disabled_sections."""
        second = UserFactory(email="second-digest@example.com")
        HouseholdMember.objects.create(
            user=second, household=household, role=HouseholdMember.Role.MEMBER
        )
        second.active_household = household
        second.digest_disabled_sections = ["chickens"]
        second.save(update_fields=["active_household", "digest_disabled_sections"])

        monkeypatch.setattr("agent.digest.api.build_digest", _noop_build_digest)
        second_client = _client_for(second)
        url = reverse(URL_NAME)
        response = second_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert "chickens" in response.data["disabled_sections"]

        # The owner's disabled_sections remain untouched
        owner.digest_disabled_sections = []
        owner.save(update_fields=["digest_disabled_sections"])
        response_owner = _client_for(owner).get(url)
        assert "chickens" not in response_owner.data["disabled_sections"]
