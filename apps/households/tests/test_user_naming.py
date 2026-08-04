"""Nommer un membre du foyer — une seule règle, `User.full_name`.

Suite de #546. Le header retombait sur l'email parce qu'il avait recomposé la
règle au lieu de la lire ; le tour de la zone en a trouvé huit autres copies,
dont sept amputées de la branche prénom+nom.

Le cas qui les fait diverger est banal : un compte créé depuis l'admin Django,
qui expose `first_name`/`last_name` mais où `display_name` n'est pas requis.
`full_name` répond « Jean Dupont » ; toute copie amputée répond l'adresse mail.
Et là où la copie oublie *aussi* le repli sur l'email, elle répond une chaîne
vide — une option sans libellé dans un menu.
"""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from households.models import Household, HouseholdMember, HouseholdInvitation
from households.serializers import (
    HouseholdInvitationSerializer,
    HouseholdMemberSerializer,
)

User = get_user_model()


@pytest.fixture
def named_user(db):
    """Un compte tel que l'admin Django permet d'en créer : nom, sans `display_name`."""
    return User.objects.create_user(
        email="jean.dupont@example.com",
        password="x",
        first_name="Jean",
        last_name="Dupont",
    )


@pytest.mark.django_db
class TestEverySurfaceNamesAMemberTheSameWay:
    def test_the_model_is_the_reference(self, named_user):
        assert named_user.full_name == "Jean Dupont"

    def test_the_member_list_agrees(self, named_user):
        """Sert le sélecteur d'assignation des tâches (`/households/active-members/`)."""
        household = Household.objects.create(name="Maison")
        member = HouseholdMember.objects.create(
            household=household, user=named_user, role="owner"
        )

        payload = HouseholdMemberSerializer(member).data

        assert payload["user_display_name"] == named_user.full_name

    def test_the_member_list_never_serves_a_nameless_member(self, db):
        """Sans nom du tout, on sert l'email — jamais la chaîne vide.

        `ui/src/lib/api/tasks.ts` mappe ce champ sur `name` sans repli : une
        chaîne vide y devient une option de menu sans libellé.
        """
        household = Household.objects.create(name="Maison")
        nameless = User.objects.create_user(email="sans.nom@example.com", password="x")
        member = HouseholdMember.objects.create(
            household=household, user=nameless, role="member"
        )

        payload = HouseholdMemberSerializer(member).data

        assert payload["user_display_name"] == nameless.email

    def test_the_invitation_agrees(self, named_user):
        """Ce que lit l'invité — dans l'app et sur la page publique du lien."""
        household = Household.objects.create(name="Maison")
        invitation = HouseholdInvitation.objects.create(
            household=household,
            email="invite@example.com",
            invited_by=named_user,
            role="member",
        )

        payload = HouseholdInvitationSerializer(invitation).data

        assert payload["invited_by_name"] == named_user.full_name

    def test_every_household_notification_names_its_actor_the_same_way(self, named_user):
        """`notify_household` est *le* chemin pour prévenir un foyer.

        `actor_name` y nomme donc l'auteur de **toutes** les notifications du
        foyer — la copie la plus large de la règle, et la dernière trouvée.
        """
        from notifications.models import Notification
        from notifications.service import notify_household

        household = Household.objects.create(name="Maison")
        reader = User.objects.create_user(email="lecteur@example.com", password="x")
        HouseholdMember.objects.create(household=household, user=reader, role="member")
        HouseholdMember.objects.create(
            household=household, user=named_user, role="owner"
        )

        created = notify_household(
            household,
            Notification.Type.HOUSEHOLD_MEMBER_JOINED,
            actor=named_user,
            text=lambda: ("titre", "corps"),
        )

        assert created, "le lecteur aurait dû être notifié"
        assert created[0].payload["actor_name"] == named_user.full_name

    def test_the_member_joined_notification_agrees(self, named_user):
        """« X a rejoint le foyer » — le nom que lit tout le monde."""
        from households.notifications import notify_member_joined

        household = Household.objects.create(name="Maison")
        reader = User.objects.create_user(email="lecteur2@example.com", password="x")
        HouseholdMember.objects.create(household=household, user=reader, role="owner")
        HouseholdMember.objects.create(
            household=household, user=named_user, role="member"
        )

        notify_member_joined(household, named_user)

        from notifications.models import Notification

        notif = Notification.objects.filter(user=reader).first()
        assert notif is not None
        assert notif.payload["member_name"] == named_user.full_name
        assert named_user.full_name in notif.title

    def test_the_auth_context_agrees(self, named_user):
        """`/accounts/me/`, d'où le shell tire le nom du header."""
        client = APIClient()
        client.force_authenticate(user=named_user)

        payload = client.get(reverse("accounts-me")).json()

        assert payload["full_name"] == named_user.full_name
