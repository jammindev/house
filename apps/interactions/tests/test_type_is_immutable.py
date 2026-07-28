"""Le type d'une entrée du journal se choisit à la création, et jamais plus.

`interactions.queries.expenses()` et les sept agrégations qui la suivent filtrent
`type='expense'` : le type n'est pas une étiquette d'affichage, c'est **ce qui
décide si un euro existe**. Le laisser modifiable par le PATCH générique donnait
deux façons de faire disparaître de l'argent sans un mot :

- `expense` → `note` : le montant sort des budgets, du coût du projet et du bilan
  mensuel. Sur une dépense rapprochée, le lien de ventilation survit à la sortie —
  `banking.validators.assert_allocation_fits` n'est même pas consulté, puisque
  `amount` n'a pas bougé ;
- `note` → `expense` : une dépense sans montant ni budget, orpheline pour la
  conformité à la seconde suivante.

Le type reste **écrit à la création**, et le journal de rénovation garde son
propre chemin (`update_renovation_interaction`), borné à `RENOVATION_TYPES` : là,
le type est la nature du geste, l'ensemble est fermé, et l'entrée reste une entrée
de rénovation.
"""
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from zones.models import Zone


@pytest.fixture
def owner(db):
    return UserFactory(email="type-immutable@example.com")


@pytest.fixture
def household(db, owner):
    instance = Household.objects.create(name="Immutable House")
    HouseholdMember.objects.create(user=owner, household=instance, role=HouseholdMember.Role.OWNER)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def zone(household, owner):
    return Zone.objects.create(household=household, name="Kitchen", created_by=owner)


@pytest.fixture
def client(owner):
    api = APIClient()
    api.force_authenticate(user=owner)
    return api


def _expense(household, owner, zone) -> Interaction:
    interaction = Interaction.objects.create(
        household=household,
        created_by=owner,
        subject="Courses",
        type="expense",
        amount=Decimal("42.00"),
        kind="manual",
        occurred_at=timezone.now(),
    )
    interaction.zones.add(zone)
    return interaction


@pytest.mark.django_db
class TestTheTypeIsChosenOnceAndForAll:
    def test_creating_still_writes_the_requested_type(self, client, zone):
        """Fermer l'édition ne doit pas fermer la création : c'est là qu'on choisit."""
        response = client.post(
            reverse("interaction-list"),
            {
                "subject": "Remplacement du filtre",
                "type": "maintenance",
                "occurred_at": timezone.now().isoformat(),
                "zone_ids": [str(zone.id)],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["type"] == "maintenance"

    def test_patching_the_type_leaves_it_untouched(self, client, household, owner, zone):
        """Le geste est sans effet, et le reste du PATCH passe quand même.

        Un 400 ferait échouer une correction de libellé légitime au motif que le
        client a renvoyé le champ qu'il venait de lire.
        """
        expense = _expense(household, owner, zone)

        response = client.patch(
            reverse("interaction-detail", kwargs={"pk": expense.id}),
            {"type": "note", "subject": "Courses de juillet"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        expense.refresh_from_db()
        assert expense.type == "expense"
        assert expense.subject == "Courses de juillet"

    def test_an_expense_never_leaves_the_money_aggregations(self, client, household, owner, zone):
        """La raison d'être de la règle, dite dans les termes du métier."""
        from interactions.queries import expenses

        expense = _expense(household, owner, zone)

        client.patch(
            reverse("interaction-detail", kwargs={"pk": expense.id}),
            {"type": "note"},
            format="json",
        )

        assert expenses(household_id=household.id).filter(pk=expense.pk).exists()

    def test_a_full_put_cannot_smuggle_a_new_type(self, client, household, owner, zone):
        """Le champ est retiré de l'écriture, pas seulement du PATCH partiel."""
        expense = _expense(household, owner, zone)

        response = client.put(
            reverse("interaction-detail", kwargs={"pk": expense.id}),
            {
                "subject": "Courses",
                "type": "note",
                "occurred_at": timezone.now().isoformat(),
                "zone_ids": [str(zone.id)],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        expense.refresh_from_db()
        assert expense.type == "expense"


@pytest.mark.django_db
class TestTheRenovationJournalKeepsItsOwnDoor:
    def test_a_renovation_entry_can_still_change_its_nature(self, client, household, owner, zone):
        """« Installation » devenue « réparation » reste une entrée de rénovation.

        Ce chemin est borné à ``RENOVATION_TYPES`` et passe par un service qui
        vérifie ``metadata.kind`` : il ne peut pas faire sortir un euro d'un total.
        """
        created = client.post(
            reverse("interaction-renovation-create"),
            {
                "element": "floor",
                "interaction_type": "installation",
                "zone_ids": [str(zone.id)],
            },
            format="json",
        )
        assert created.status_code == status.HTTP_201_CREATED
        entry_id = created.data["id"]

        response = client.patch(
            reverse("interaction-renovation-update", kwargs={"pk": entry_id}),
            {"interaction_type": "repair"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert Interaction.objects.get(pk=entry_id).type == "repair"
