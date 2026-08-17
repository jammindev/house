"""Un membre crée une tâche : le foyer l'apprend, et le clic mène à la tâche.

Ce que ce fichier tient, et pourquoi chaque garantie est là :

- **le lien** — une notification qui annonce sans mener fait refaire au lecteur
  la recherche qu'elle venait de faire pour lui (règle ``url`` per-row de
  ``CLAUDE.md``) ;
- **le privé** — le titre *est* le sujet. ``TaskViewSet.get_queryset`` vient de
  fermer la fuite en liste ; la rouvrir par la cloche serait pire, puisque la
  notification va chercher le lecteur au lieu d'attendre qu'il regarde ;
- **la langue de chacun** — la même erreur qu'a vécue ``stock`` en prod, et elle
  ne se voit pas : le texte produit est parfaitement valide, simplement pas dans
  la bonne langue ;
- **l'automatique ne notifie pas** — ``tasks.services.create_task`` est aussi la
  porte de ``chickens`` (qui a déjà ``chicken_chore_due``) et d'``orchard``. Une
  émission posée dans le service ferait doublon chez l'un et bavardage chez
  l'autre, et ``seed_demo_data`` posterait trois ans de démo dans la cloche.
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from notifications.models import MUTABLE_TYPES, Notification
from tasks.models import Task
from zones.models import Zone

CREATED = Notification.Type.TASK_CREATED


@pytest.fixture
def author(db):
    return UserFactory(email="task-author@example.com", display_name="Claire")


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
    user = UserFactory(email="task-bob@example.com", display_name="Bob")
    HouseholdMember.objects.create(household=household, user=user)
    return user


@pytest.fixture
def zone(household, author):
    return Zone.objects.create(household=household, name="Jardin", created_by=author)


@pytest.fixture
def client_for_author(author):
    client = APIClient()
    client.force_authenticate(user=author)
    return client


def _payload(zone, **overrides):
    payload = {
        "subject": "Tondre la pelouse",
        "content": "Avant la pluie.",
        "zone_ids": [str(zone.id)],
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# Qui l'apprend, et ce qu'il lit
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestTheHouseholdHearsAboutANewTask:
    def test_the_other_members_are_told(self, client_for_author, zone, bob):
        response = client_for_author.post(
            reverse("task-list"), _payload(zone), format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert Notification.objects.filter(user=bob, type=CREATED).count() == 1

    def test_the_author_is_not_told(self, client_for_author, zone, author, bob):
        client_for_author.post(reverse("task-list"), _payload(zone), format="json")

        assert not Notification.objects.filter(user=author).exists()

    def test_the_title_is_the_subject_and_the_body_names_the_author(
        self, client_for_author, zone, bob
    ):
        """Ce qu'on lit en premier est l'objet, pas le protocole — et le sujet
        survit à la troncature d'une notification push sur mobile."""
        client_for_author.post(reverse("task-list"), _payload(zone), format="json")

        notif = Notification.objects.get(user=bob)
        assert notif.title == "Tondre la pelouse"
        assert "Claire" in notif.body

    def test_the_notification_leads_to_the_task(self, client_for_author, zone, bob):
        response = client_for_author.post(
            reverse("task-list"), _payload(zone), format="json"
        )

        notif = Notification.objects.get(user=bob)
        assert notif.url == f"/app/tasks/{response.data['id']}"

    def test_the_payload_carries_the_task(self, client_for_author, zone, bob):
        response = client_for_author.post(
            reverse("task-list"), _payload(zone), format="json"
        )

        notif = Notification.objects.get(user=bob)
        assert notif.payload["task_id"] == str(response.data["id"])
        assert notif.payload["actor_name"] == "Claire"


@pytest.mark.django_db
class TestASubjectLongerThanTheTitleColumn:
    """``Task.subject`` accepte 500 caractères, ``Notification.title`` 255.

    Sans troncature, Postgres refuse l'insertion et **la création de la tâche
    part en 500** : un effet de bord qui casse l'action principale est le pire
    des deux mondes, puisqu'il fait perdre le travail de l'utilisateur pour une
    notification dont il se moquait.
    """

    def test_a_very_long_subject_still_creates_the_task_and_the_notification(
        self, client_for_author, zone, bob
    ):
        # Dans la fenêtre de risque : accepté par ``Task.subject`` (500), refusé
        # par ``Notification.title`` (255) sans troncature.
        subject = ("Ranger le garage " * 24).strip()  # 407 caractères

        response = client_for_author.post(
            reverse("task-list"), _payload(zone, subject=subject), format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        notif = Notification.objects.get(user=bob)
        assert len(notif.title) <= 255
        assert notif.title.startswith("Ranger le garage")
        # Le sujet entier reste lisible dans le payload — tronquer l'affichage
        # ne doit pas perdre l'information.
        assert notif.payload["task_subject"] == subject.strip()


# ---------------------------------------------------------------------------
# Ce qui ne se dit pas
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAPrivateTaskTellsNobody:
    """Le titre *est* le sujet : notifier une tâche privée la publierait mot pour
    mot à tout le foyer, en allant chercher le lecteur au lieu d'attendre qu'il
    regarde. Le drapeau existait, avec son badge et sa contrainte DB, et il était
    décoratif partout où il comptait."""

    def test_no_notification_at_all(self, client_for_author, zone, bob):
        response = client_for_author.post(
            reverse("task-list"), _payload(zone, is_private=True), format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert Task.objects.get(id=response.data["id"]).is_private is True
        assert not Notification.objects.exists()


@pytest.mark.django_db
class TestAnAutomatedTaskTellsNobody:
    """``create_task`` est le service partagé, pas le geste d'un membre.

    ``chickens`` s'en sert pour la corvée du poulailler — qui a **déjà** son
    ``chicken_chore_due`` — et ``orchard`` pour ses travaux saisonniers. Une
    émission posée là ferait doublon chez l'un et bavardage chez l'autre.
    """

    def test_the_shared_service_stays_silent(self, household, author, zone, bob):
        from tasks.services import create_task

        create_task(
            household, author, subject="Nettoyer le poulailler", zone_ids=[zone.id]
        )

        assert not Notification.objects.exists()


# ---------------------------------------------------------------------------
# Les autres portes d'entrée
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestTheAssistantIsAMemberActingToo:
    """L'agent ne crée que sur demande explicite : c'est le geste d'un membre,
    pas de l'app. Le laisser muet ferait dépendre la notification du bouton
    utilisé, ce que personne ne peut deviner."""

    def test_creating_through_the_agent_tells_the_household(
        self, household, author, zone, bob
    ):
        from tasks.apps import _create_task_from_agent

        task = _create_task_from_agent(
            household, author, {"subject": "Tailler la haie", "zone_ids": [str(zone.id)]}
        )

        notif = Notification.objects.get(user=bob, type=CREATED)
        assert notif.url == f"/app/tasks/{task.id}"


# ---------------------------------------------------------------------------
# La langue, et le droit de faire taire
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestEachMemberReadsItInTheirOwnLanguage:
    """Le texte est rendu une fois **par destinataire**, jamais une fois pour
    tous. Un appelant qui compose sa phrase avant la boucle poste à tout le foyer
    la langue de celui qui a agi — le bug qu'a vécu ``stock`` en prod, invisible
    parce que la phrase produite était parfaitement valide."""

    def test_two_locales_get_two_bodies(self, client_for_author, zone, household, bob):
        bob.locale = "fr"
        bob.save(update_fields=["locale"])
        english = UserFactory(email="task-eve@example.com", display_name="Eve", locale="en")
        HouseholdMember.objects.create(household=household, user=english)

        client_for_author.post(reverse("task-list"), _payload(zone), format="json")

        assert (
            Notification.objects.get(user=bob).body
            != Notification.objects.get(user=english).body
        )


def test_the_type_can_be_silenced():
    """« Untel a créé une tâche » est fréquent et purement informatif : c'est
    exactement la famille pour laquelle ``MUTABLE_TYPES`` a été créé, et une
    cloche devenue bruit perd l'invitation qui comptait avec le reste."""
    assert CREATED in MUTABLE_TYPES
