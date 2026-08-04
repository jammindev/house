"""Le tri se fait par grappe de session, jamais photo par photo.

Trente photos rapportées d'un week-end forment **une** décision. Ce n'est pas un
confort : une file qui demande trente gestes ne se vide jamais, et une file qu'on ne
vide jamais cesse d'être lue au bout d'une semaine.

La grappe se calcule sur `effective_date` (`COALESCE(taken_at, created_at)`), et non
sur la date d'ajout : quinze photos envoyées d'un coup depuis la feuille de partage du
téléphone contiennent aussi bien la chaudière de mardi que l'anniversaire de samedi.
Les grouper par envoi reformerait exactement le mélange qu'on défait.
"""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from documents.models import Document
from documents.queries import SESSION_GAP, cluster_sessions
from households.models import Household, HouseholdMember

TRIAGE_URL = "/api/documents/documents/triage/"


@pytest.fixture
def owner(db):
    return UserFactory(email="clusters@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Clusters House")
    HouseholdMember.objects.create(
        user=owner, household=hh, role=HouseholdMember.Role.OWNER
    )
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def client(owner, household):
    api = APIClient()
    api.force_authenticate(user=owner)
    api.credentials(HTTP_X_HOUSEHOLD_ID=str(household.id))
    return api


def _photo(household, user, name, taken_at=None) -> Document:
    return Document.objects.create(
        household=household,
        created_by=user,
        file_path=f"documents/{name.lower()}.jpg",
        name=name,
        mime_type="image/jpeg",
        type="photo",
        taken_at=taken_at,
    )


class _FakePhoto:
    """Un porteur de date — `cluster_sessions` ne demande rien d'autre."""

    def __init__(self, effective_date):
        self.effective_date = effective_date
        self.taken_at = effective_date
        self.created_at = effective_date


def _at(hours_ago):
    return timezone.now() - timedelta(hours=hours_ago)


class TestClusterSessions:
    def test_photos_taken_close_together_form_one_cluster(self):
        photos = [_FakePhoto(_at(hours)) for hours in (0, 0.5, 1)]

        clusters = cluster_sessions(photos)

        assert len(clusters) == 1
        assert len(clusters[0]["photos"]) == 3

    def test_a_silence_longer_than_the_gap_opens_a_new_session(self):
        photos = [_FakePhoto(_at(hours)) for hours in (0, 1, 30, 31)]

        clusters = cluster_sessions(photos)

        assert [len(cluster["photos"]) for cluster in clusters] == [2, 2]

    def test_the_gap_is_measured_between_neighbours_not_from_the_start(self):
        """Une journée de photos toutes les heures reste **une** session.

        Mesurer depuis la première photo découperait un après-midi continu en tranches
        de deux heures, et rendrait la file plus longue que ce qu'elle range.
        """
        photos = [_FakePhoto(_at(hours)) for hours in range(0, 8)]

        clusters = cluster_sessions(photos)

        assert len(clusters) == 1

    def test_a_burst_sharing_one_second_stays_one_session(self):
        moment = timezone.now()
        photos = [_FakePhoto(moment) for _ in range(5)]

        assert len(cluster_sessions(photos)) == 1

    def test_it_returns_at_most_the_asked_number_of_clusters(self):
        photos = [_FakePhoto(_at(hours * 24)) for hours in range(10)]

        clusters = cluster_sessions(photos, limit=3)

        assert len(clusters) == 3

    def test_a_full_window_drops_its_tail_cluster(self):
        """La dernière grappe d'une fenêtre pleine est peut-être coupée.

        L'annoncer avec son compte dirait « 3 photos » là où il y en a peut-être
        trente — un compte faux vaut moins que rien.
        """
        photos = [_FakePhoto(_at(hours * 24)) for hours in range(4)]

        clusters = cluster_sessions(photos, window_was_full=True)

        assert len(clusters) == 3

    def test_a_full_window_of_one_cluster_keeps_it(self):
        """Sinon un foyer dont tout tient dans une session verrait une file vide."""
        photos = [_FakePhoto(_at(minutes / 60)) for minutes in range(5)]

        clusters = cluster_sessions(photos, window_was_full=True)

        assert len(clusters) == 1

    def test_the_default_gap_is_the_one_the_module_declares(self):
        photos = [
            _FakePhoto(timezone.now()),
            _FakePhoto(timezone.now() - SESSION_GAP - timedelta(minutes=1)),
        ]

        assert len(cluster_sessions(photos)) == 2


@pytest.mark.django_db
class TestTheTriageEndpointGroupsByCapture:
    def test_photos_uploaded_together_but_taken_apart_are_two_sessions(
        self, client, household, owner
    ):
        """Le cas de la feuille de partage : un envoi, deux moments.

        C'est exactement le mélange dont se plaint l'utilisateur — la chaudière et
        l'anniversaire dans le même lot. Grouper par date d'ajout le reformerait.
        """
        _photo(household, owner, "Chaudiere", taken_at=_at(72))
        _photo(household, owner, "Gateau", taken_at=_at(2))
        _photo(household, owner, "Bougies", taken_at=_at(1.5))

        payload = client.get(TRIAGE_URL).json()

        assert payload["total"] == 3
        assert [cluster["count"] for cluster in payload["clusters"]] == [2, 1]

    def test_a_photo_without_capture_date_falls_back_to_its_upload(
        self, client, household, owner
    ):
        """`taken_at` est `NULL` pour une capture d'écran ou un EXIF strippé.

        Le repli se fait à la lecture, jamais en base — la photo doit quand même
        apparaître dans la file, sinon elle n'en sortirait plus jamais.
        """
        _photo(household, owner, "Capture", taken_at=None)

        payload = client.get(TRIAGE_URL).json()

        assert payload["total"] == 1
        assert payload["clusters"][0]["photos"][0]["name"] == "Capture"

    def test_the_newest_session_comes_first(self, client, household, owner):
        _photo(household, owner, "Vieille", taken_at=_at(72))
        _photo(household, owner, "Recente", taken_at=_at(1))

        payload = client.get(TRIAGE_URL).json()

        assert payload["clusters"][0]["photos"][0]["name"] == "Recente"

    def test_a_cluster_carries_a_stable_key(self, client, household, owner):
        _photo(household, owner, "Gateau", taken_at=_at(2))

        first = client.get(TRIAGE_URL).json()["clusters"][0]["key"]
        second = client.get(TRIAGE_URL).json()["clusters"][0]["key"]

        assert first == second

    def test_a_photo_from_another_household_never_shows_up(
        self, client, household, owner
    ):
        stranger = UserFactory(email="stranger-clusters@example.com")
        other = Household.objects.create(name="Ailleurs")
        HouseholdMember.objects.create(
            user=stranger, household=other, role=HouseholdMember.Role.OWNER
        )
        _photo(other, stranger, "Chez eux", taken_at=_at(1))

        payload = client.get(TRIAGE_URL).json()

        assert payload["total"] == 0
        assert payload["clusters"] == []
