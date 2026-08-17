"""Un membre écrit une note : le foyer l'apprend, et le clic mène à la note.

Jumeau de ``tasks/tests/test_creation_notification.py`` — mêmes garanties, plus
deux qui n'appartiennent qu'ici :

- **une dépense n'est pas une note.** ``InteractionViewSet`` sert les onze types
  du journal. Notifier sur le type entier transformerait chaque achat de stock,
  chaque ligne de relevé ventilée, chaque entrée de carnet de rénovation en
  sonnerie — soit précisément le bruit qui fait couper la cloche.
- **supprimer une note retire l'annonce.** Contrairement à une tâche, qu'on
  *archive* (la page répond toujours), une note se supprime pour de bon : la
  notification pointerait alors sur un écran mort. Un lien qui promet mène
  quelque part, ou il ne se pose pas.
"""
import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from notifications.models import MUTABLE_TYPES, Notification
from zones.models import Zone

CREATED = Notification.Type.NOTE_CREATED


@pytest.fixture
def author(db):
    return UserFactory(email="note-author@example.com", display_name="Claire")


@pytest.fixture
def household(db, author):
    hh = Household.objects.create(name="Maison Test")
    HouseholdMember.objects.create(
        household=hh, user=author, role=HouseholdMember.Role.OWNER
    )
    author.active_household = hh
    author.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def bob(db, household):
    user = UserFactory(email="note-bob@example.com", display_name="Bob")
    HouseholdMember.objects.create(household=household, user=user)
    return user


@pytest.fixture
def zone(household, author):
    return Zone.objects.create(household=household, name="Cuisine", created_by=author)


@pytest.fixture
def client_for_author(author):
    client = APIClient()
    client.force_authenticate(user=author)
    return client


def _payload(zone, **overrides):
    payload = {
        "subject": "Le mitigeur fuit",
        "content": "Goutte à goutte sous l'évier.",
        "type": "note",
        "occurred_at": timezone.now().isoformat(),
        "zone_ids": [str(zone.id)],
        "is_private": False,
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# Qui l'apprend, et ce qu'il lit
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestTheHouseholdHearsAboutANewNote:
    def test_the_other_members_are_told(self, client_for_author, zone, bob):
        response = client_for_author.post(
            reverse("interaction-list"), _payload(zone), format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert Notification.objects.filter(user=bob, type=CREATED).count() == 1

    def test_the_author_is_not_told(self, client_for_author, zone, author, bob):
        client_for_author.post(
            reverse("interaction-list"), _payload(zone), format="json"
        )

        assert not Notification.objects.filter(user=author).exists()

    def test_the_title_is_the_subject_and_the_body_names_the_author(
        self, client_for_author, zone, bob
    ):
        client_for_author.post(
            reverse("interaction-list"), _payload(zone), format="json"
        )

        notif = Notification.objects.get(user=bob)
        assert notif.title == "Le mitigeur fuit"
        assert "Claire" in notif.body

    def test_the_notification_leads_to_the_note(self, client_for_author, zone, bob):
        response = client_for_author.post(
            reverse("interaction-list"), _payload(zone), format="json"
        )

        notif = Notification.objects.get(user=bob)
        assert notif.url == f"/app/interactions/{response.data['id']}"

    def test_a_subject_longer_than_the_title_column_is_truncated(
        self, client_for_author, zone, bob
    ):
        """``Interaction.subject`` accepte 500 caractères, ``Notification.title``
        255 : sans troncature, Postgres refuse et **l'écriture de la note part en
        500**."""
        # Dans la fenêtre de risque : accepté par ``Interaction.subject`` (500),
        # refusé par ``Notification.title`` (255) sans troncature.
        subject = ("Rappeler le plombier " * 20).strip()  # 399 caractères

        response = client_for_author.post(
            reverse("interaction-list"), _payload(zone, subject=subject), format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        notif = Notification.objects.get(user=bob)
        assert len(notif.title) <= 255
        assert notif.payload["note_subject"] == subject.strip()


# ---------------------------------------------------------------------------
# Ce qui ne se dit pas
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestOnlyANoteIsANote:
    """Le journal porte onze types. Notifier sur l'endpoint entier ferait sonner
    chaque achat de stock, chaque ligne de relevé ventilée et chaque entrée de
    carnet de rénovation — le bruit exact qui fait couper la cloche."""

    @pytest.mark.parametrize("kind", ["expense", "maintenance", "repair"])
    def test_the_other_journal_types_stay_silent(
        self, client_for_author, zone, bob, kind
    ):
        response = client_for_author.post(
            reverse("interaction-list"), _payload(zone, type=kind), format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert not Notification.objects.exists()


@pytest.mark.django_db
class TestAPrivateNoteTellsNobody:
    def test_no_notification_at_all(self, client_for_author, zone, bob):
        response = client_for_author.post(
            reverse("interaction-list"), _payload(zone, is_private=True), format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert Interaction.objects.get(id=response.data["id"]).is_private is True
        assert not Notification.objects.exists()


@pytest.mark.django_db
class TestAnAutomatedNoteTellsNobody:
    """``create_note_interaction`` est aussi la porte de ``seed_demo_data``, qui
    écrit trois ans de journal : le service reste muet, seuls les points d'entrée
    « un membre a agi » parlent."""

    def test_the_shared_service_stays_silent(self, household, author, zone, bob):
        from interactions.services import create_note_interaction

        create_note_interaction(
            household=household,
            user=author,
            subject="Note de démo",
            zone_ids=[zone.id],
        )

        assert not Notification.objects.exists()


# ---------------------------------------------------------------------------
# Les autres portes d'entrée
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestTheAssistantIsAMemberActingToo:
    def test_creating_through_the_agent_tells_the_household(
        self, household, author, zone, bob
    ):
        from interactions.apps import _create_note_from_agent

        note = _create_note_from_agent(
            household, author, {"subject": "Acheter un joint", "zone_ids": [str(zone.id)]}
        )

        notif = Notification.objects.get(user=bob, type=CREATED)
        assert notif.url == f"/app/interactions/{note.id}"


# ---------------------------------------------------------------------------
# Un lien qui promet mène quelque part
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDeletingTheNoteRetractsTheAnnouncement:
    """Une note se supprime pour de bon (une tâche, elle, s'archive : sa page
    répond toujours). Laisser l'annonce derrière donne une cloche qui mène à un
    écran mort — et le lecteur ne peut pas savoir si c'est l'app ou lui qui se
    trompe."""

    def test_the_rest_delete_takes_the_notification_with_it(
        self, client_for_author, zone, bob
    ):
        response = client_for_author.post(
            reverse("interaction-list"), _payload(zone), format="json"
        )
        note_id = response.data["id"]
        assert Notification.objects.filter(user=bob, deleted_at__isnull=True).exists()

        client_for_author.delete(reverse("interaction-detail", args=[note_id]))

        assert not Notification.objects.filter(
            user=bob, deleted_at__isnull=True
        ).exists()

    def test_the_agent_undo_takes_it_too(self, household, author, zone, bob):
        from interactions.apps import _create_note_from_agent, _delete_note_from_agent

        note = _create_note_from_agent(
            household, author, {"subject": "Erreur de dictée", "zone_ids": [str(zone.id)]}
        )
        assert Notification.objects.filter(user=bob, deleted_at__isnull=True).exists()

        _delete_note_from_agent(household, author, note.id)

        assert not Notification.objects.filter(
            user=bob, deleted_at__isnull=True
        ).exists()


def test_the_type_can_be_silenced():
    assert CREATED in MUTABLE_TYPES
