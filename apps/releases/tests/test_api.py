"""Tests de l'API changelog — lecture seule, authentifiée, non scopée foyer."""
import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from releases.models import ChangelogEntry, ChangelogState


@pytest.fixture
def user(db):
    return UserFactory(email="changelog-reader@example.com")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def entries(db):
    now = timezone.now()
    ChangelogEntry.objects.create(
        commit_sha="sha1", module="projects", change_type="feat",
        summary="Nouvelle feature", raw_subject="feat(projects): x", committed_at=now,
    )
    ChangelogEntry.objects.create(
        commit_sha="sha2", module="tasks", change_type="fix",
        summary="Correction", raw_subject="fix(tasks): y",
        committed_at=now - timezone.timedelta(days=1),
    )


class TestChangelogApi:
    def test_requires_authentication(self, db):
        resp = APIClient().get("/api/releases/changelog/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_lists_entries_newest_first(self, client, entries):
        resp = client.get("/api/releases/changelog/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.data["results"] if "results" in resp.data else resp.data
        assert [e["commit_sha"] for e in results] == ["sha1", "sha2"]

    def test_filters_by_module(self, client, entries):
        resp = client.get("/api/releases/changelog/", {"module": "tasks"})
        results = resp.data["results"] if "results" in resp.data else resp.data
        assert len(results) == 1
        assert results[0]["module"] == "tasks"

    def test_is_read_only(self, client, entries):
        resp = client.post("/api/releases/changelog/", {"module": "hack"})
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_state_returns_null_when_absent(self, client, db):
        resp = client.get("/api/releases/changelog/state/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data is None

    def test_state_returns_live_head(self, client, db):
        ChangelogState.objects.create(
            head_sha="deadbeef", head_committed_at=timezone.now(),
        )
        resp = client.get("/api/releases/changelog/state/")
        assert resp.data["head_sha"] == "deadbeef"
