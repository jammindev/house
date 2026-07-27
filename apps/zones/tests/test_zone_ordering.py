"""
Tests de l'ordre manuel des zones — apps/zones/services.py + les actions
`move` / `reorder` du viewset + le backfill de la migration 0007.

L'invariant central, vérifié sous plusieurs angles : **les rangs d'une fratrie
sont 0..n-1, sans trou ni doublon**. S'il tombe, l'ordre affiché devient
dépendant du plan d'exécution PostgreSQL et deux écrans peuvent se contredire.

Style et fixtures calqués sur test_api_zones_extra.py.
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from zones.models import Zone
from zones.services import (
    move_zone,
    normalize_positions,
    place_at_end,
    reorder_siblings,
    shift_positions_after_removal,
)


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _household(name: str) -> Household:
    return Household.objects.create(name=name)


def _membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


@pytest.fixture
def owner(db):
    return UserFactory(email="zones-order-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _household("Zones Order House")
    _membership(owner, instance)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


def _root(household):
    """La racine créée par le signal post_save du household."""
    return Zone.objects.get(household=household, parent__isnull=True)


def _make_zone(household, name, owner, parent=None, position=0):
    """Crée une zone SANS passer par le service (pour contrôler `position`).

    Rappel : `Zone.save()` rattache à la racine toute zone sans parent.
    """
    zone = Zone.objects.create(
        household=household, name=name, parent=parent, created_by=owner
    )
    if zone.position != position:
        Zone.objects.filter(pk=zone.pk).update(position=position)
        zone.refresh_from_db()
    return zone


def _names_in_order(household, parent):
    """Les noms de la fratrie dans l'ordre que sert le modèle (Meta.ordering)."""
    return list(
        Zone.objects.filter(household=household, parent=parent).values_list("name", flat=True)
    )


def _positions(household, parent):
    return sorted(
        Zone.objects.filter(household=household, parent=parent).values_list("position", flat=True)
    )


# ── Le service ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestReorderSiblings:
    def test_applies_the_requested_order_and_normalizes_ranks(self, household, owner):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        b = _make_zone(household, "Bureau", owner, parent=root, position=1)
        c = _make_zone(household, "Cave", owner, parent=root, position=2)

        reorder_siblings(household, root.id, [c.id, a.id, b.id])

        assert _names_in_order(household, root) == ["Cave", "Atelier", "Bureau"]
        assert _positions(household, root) == [0, 1, 2]

    def test_rejects_a_partial_sibling_group(self, household, owner):
        """Un sous-ensemble signe une vue périmée — on refuse plutôt que compléter."""
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        _make_zone(household, "Bureau", owner, parent=root, position=1)

        with pytest.raises(ValueError, match="whole sibling group"):
            reorder_siblings(household, root.id, [a.id])

    def test_rejects_a_zone_from_another_sibling_group(self, household, owner):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        b = _make_zone(household, "Bureau", owner, parent=root, position=1)
        nephew = _make_zone(household, "Établi", owner, parent=a, position=0)

        with pytest.raises(ValueError, match="whole sibling group"):
            reorder_siblings(household, root.id, [a.id, b.id, nephew.id])

    def test_rejects_duplicate_ids(self, household, owner):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        _make_zone(household, "Bureau", owner, parent=root, position=1)

        with pytest.raises(ValueError, match="Duplicate"):
            reorder_siblings(household, root.id, [a.id, a.id])

    def test_leaves_other_sibling_groups_untouched(self, household, owner):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        b = _make_zone(household, "Bureau", owner, parent=root, position=1)
        x = _make_zone(household, "Établi", owner, parent=a, position=0)
        y = _make_zone(household, "Fraiseuse", owner, parent=a, position=1)

        reorder_siblings(household, root.id, [b.id, a.id])

        assert _names_in_order(household, a) == ["Établi", "Fraiseuse"]
        x.refresh_from_db()
        y.refresh_from_db()
        assert (x.position, y.position) == (0, 1)


@pytest.mark.django_db
class TestMoveZone:
    def test_moves_up_and_down(self, household, owner):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        b = _make_zone(household, "Bureau", owner, parent=root, position=1)
        _make_zone(household, "Cave", owner, parent=root, position=2)

        assert move_zone(b, "up") is True
        assert _names_in_order(household, root) == ["Bureau", "Atelier", "Cave"]

        a.refresh_from_db()
        assert move_zone(a, "down") is True
        assert _names_in_order(household, root) == ["Bureau", "Cave", "Atelier"]

    def test_at_the_edge_it_is_a_no_op_not_an_error(self, household, owner):
        """Être en butée n'est pas une erreur : l'utilisateur n'a rien à deviner."""
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        b = _make_zone(household, "Bureau", owner, parent=root, position=1)

        assert move_zone(a, "up") is False
        assert move_zone(b, "down") is False
        assert _names_in_order(household, root) == ["Atelier", "Bureau"]

    def test_works_on_legacy_rows_where_every_rank_is_zero(self, household, owner):
        """Régression : sans normalisation préalable, échanger deux rangs à 0 ne
        déplace rien — c'est l'état de toute fratrie créée avant la migration."""
        root = _root(household)
        _make_zone(household, "Atelier", owner, parent=root, position=0)
        b = _make_zone(household, "Bureau", owner, parent=root, position=0)
        _make_zone(household, "Cave", owner, parent=root, position=0)

        assert move_zone(b, "up") is True
        assert _names_in_order(household, root) == ["Bureau", "Atelier", "Cave"]
        assert _positions(household, root) == [0, 1, 2]

    def test_rejects_an_unknown_direction(self, household, owner):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)

        with pytest.raises(ValueError, match="direction"):
            move_zone(a, "sideways")


@pytest.mark.django_db
class TestPositionHousekeeping:
    def test_normalize_closes_gaps_and_is_idempotent(self, household, owner):
        root = _root(household)
        _make_zone(household, "Atelier", owner, parent=root, position=3)
        _make_zone(household, "Bureau", owner, parent=root, position=17)

        normalize_positions(household.id, root.id)
        assert _positions(household, root) == [0, 1]

        normalize_positions(household.id, root.id)
        assert _positions(household, root) == [0, 1]

    def test_place_at_end_appends_rather_than_prepending(self, household, owner):
        root = _root(household)
        _make_zone(household, "Atelier", owner, parent=root, position=0)
        _make_zone(household, "Bureau", owner, parent=root, position=1)
        newcomer = _make_zone(household, "Cave", owner, parent=root, position=0)

        place_at_end(newcomer)
        newcomer.refresh_from_db()

        assert newcomer.position == 2
        assert _names_in_order(household, root) == ["Atelier", "Bureau", "Cave"]

    def test_shift_after_removal_closes_the_hole(self, household, owner):
        root = _root(household)
        _make_zone(household, "Atelier", owner, parent=root, position=0)
        b = _make_zone(household, "Bureau", owner, parent=root, position=1)
        _make_zone(household, "Cave", owner, parent=root, position=2)

        removed_position = b.position
        b.delete()
        shift_positions_after_removal(household.id, root.id, removed_position)

        assert _positions(household, root) == [0, 1]
        assert _names_in_order(household, root) == ["Atelier", "Cave"]


# ── Meta.ordering : un seul ordre partout ─────────────────────────────────────


@pytest.mark.django_db
class TestOrderingAppliesEverywhere:
    def test_default_queryset_follows_position_not_the_alphabet(self, household, owner):
        root = _root(household)
        _make_zone(household, "Atelier", owner, parent=root, position=2)
        _make_zone(household, "Bureau", owner, parent=root, position=0)
        _make_zone(household, "Cave", owner, parent=root, position=1)

        assert _names_in_order(household, root) == ["Bureau", "Cave", "Atelier"]

    def test_children_relation_follows_position(self, household, owner):
        """L'agent (`_zone_related`) et l'onglet Infos lisent `zone.children`."""
        root = _root(household)
        _make_zone(household, "Atelier", owner, parent=root, position=2)
        _make_zone(household, "Bureau", owner, parent=root, position=0)

        assert [z.name for z in root.children.all()] == ["Bureau", "Atelier"]

    def test_equal_ranks_fall_back_to_name_for_a_stable_order(self, household, owner):
        root = _root(household)
        _make_zone(household, "Bureau", owner, parent=root, position=5)
        _make_zone(household, "Atelier", owner, parent=root, position=5)

        assert _names_in_order(household, root) == ["Atelier", "Bureau"]


# ── L'API ─────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestMoveEndpoint:
    def test_move_up_reorders_and_reports_the_new_rank(self, owner_client, household, owner):
        root = _root(household)
        _make_zone(household, "Atelier", owner, parent=root, position=0)
        b = _make_zone(household, "Bureau", owner, parent=root, position=1)

        url = reverse("zone-move", kwargs={"pk": b.id})
        response = owner_client.post(url, {"direction": "up"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"moved": True, "position": 0}
        assert _names_in_order(household, root) == ["Bureau", "Atelier"]

    def test_move_at_the_edge_returns_200_with_moved_false(self, owner_client, household, owner):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        _make_zone(household, "Bureau", owner, parent=root, position=1)

        url = reverse("zone-move", kwargs={"pk": a.id})
        response = owner_client.post(url, {"direction": "up"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["moved"] is False

    def test_move_rejects_a_bad_direction(self, owner_client, household, owner):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)

        url = reverse("zone-move", kwargs={"pk": a.id})
        response = owner_client.post(url, {"direction": "left"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_move_cannot_touch_another_household(self, owner_client, owner):
        """Le queryset est scopé foyer : une zone étrangère est introuvable."""
        stranger_household = _household("Stranger Order House")
        stranger = UserFactory(email="zones-order-stranger@example.com")
        _membership(stranger, stranger_household)
        foreign_root = _root(stranger_household)
        foreign = _make_zone(stranger_household, "Atelier", stranger, parent=foreign_root)

        url = reverse("zone-move", kwargs={"pk": foreign.id})
        response = owner_client.post(url, {"direction": "up"}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestReorderEndpoint:
    def test_reorder_applies_the_order_and_returns_the_group(self, owner_client, household, owner):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        b = _make_zone(household, "Bureau", owner, parent=root, position=1)
        c = _make_zone(household, "Cave", owner, parent=root, position=2)

        url = reverse("zone-reorder")
        response = owner_client.post(
            url,
            {"parent": str(root.id), "zone_ids": [str(c.id), str(b.id), str(a.id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert [item["name"] for item in response.data] == ["Cave", "Bureau", "Atelier"]
        assert [item["position"] for item in response.data] == [0, 1, 2]

    def test_reorder_rejects_a_partial_group_with_400(self, owner_client, household, owner):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        _make_zone(household, "Bureau", owner, parent=root, position=1)

        url = reverse("zone-reorder")
        response = owner_client.post(
            url, {"parent": str(root.id), "zone_ids": [str(a.id)]}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reorder_rejects_an_empty_list(self, owner_client, household):
        root = _root(household)
        url = reverse("zone-reorder")
        response = owner_client.post(
            url, {"parent": str(root.id), "zone_ids": []}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reorder_rejects_a_malformed_parent_id_with_400_not_500(
        self, owner_client, household, owner
    ):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)

        url = reverse("zone-reorder")
        response = owner_client.post(
            url, {"parent": "not-a-uuid", "zone_ids": [str(a.id)]}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reorder_rejects_a_parent_from_another_household(self, owner_client, household, owner):
        stranger_household = _household("Stranger Reorder House")
        stranger = UserFactory(email="zones-reorder-stranger@example.com")
        _membership(stranger, stranger_household)
        foreign_root = _root(stranger_household)
        foreign = _make_zone(stranger_household, "Atelier", stranger, parent=foreign_root)

        url = reverse("zone-reorder")
        response = owner_client.post(
            url,
            {"parent": str(foreign_root.id), "zone_ids": [str(foreign.id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestPositionIsReadOnlyOverTheApi:
    def test_patch_cannot_write_position(self, owner_client, household, owner):
        """L'ordre s'écrit par le service, jamais par un PATCH libre : deux frères
        au même rang rendraient l'ordre dépendant du plan d'exécution."""
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        _make_zone(household, "Bureau", owner, parent=root, position=1)

        url = reverse("zone-detail", args=[a.id])
        response = owner_client.patch(url, {"position": 5}, format="json")

        assert response.status_code == status.HTTP_200_OK
        a.refresh_from_db()
        assert a.position == 0


@pytest.mark.django_db
class TestCreateAndReparentKeepRanksSane:
    def test_a_new_zone_lands_at_the_end_of_its_sibling_group(
        self, owner_client, household, owner
    ):
        root = _root(household)
        _make_zone(household, "Atelier", owner, parent=root, position=0)
        _make_zone(household, "Bureau", owner, parent=root, position=1)

        url = reverse("zone-list")
        response = owner_client.post(
            url, {"name": "Cave", "parent": str(root.id)}, format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert _names_in_order(household, root) == ["Atelier", "Bureau", "Cave"]
        assert _positions(household, root) == [0, 1, 2]

    def test_reparenting_appends_to_the_new_group_and_closes_the_old_hole(
        self, owner_client, household, owner
    ):
        root = _root(household)
        a = _make_zone(household, "Atelier", owner, parent=root, position=0)
        mover = _make_zone(household, "Bureau", owner, parent=root, position=1)
        _make_zone(household, "Cave", owner, parent=root, position=2)
        _make_zone(household, "Établi", owner, parent=a, position=0)

        url = reverse("zone-detail", args=[mover.id])
        response = owner_client.patch(url, {"parent": str(a.id)}, format="json")

        assert response.status_code == status.HTTP_200_OK
        # Arrivée en fin de sa nouvelle fratrie, pas devant l'existant.
        assert _names_in_order(household, a) == ["Établi", "Bureau"]
        # L'ancienne fratrie n'a pas gardé de trou.
        assert _positions(household, root) == [0, 1]

    def test_deleting_a_zone_closes_the_hole_it_leaves(self, owner_client, household, owner):
        root = _root(household)
        _make_zone(household, "Atelier", owner, parent=root, position=0)
        b = _make_zone(household, "Bureau", owner, parent=root, position=1)
        _make_zone(household, "Cave", owner, parent=root, position=2)

        response = owner_client.delete(reverse("zone-detail", args=[b.id]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert _positions(household, root) == [0, 1]


# ── Le backfill de la migration 0007 ──────────────────────────────────────────


@pytest.mark.django_db
class TestMigrationBackfill:
    def test_it_freezes_the_alphabetical_order_users_see_today(self, household, owner):
        """La suite tourne en `--nomigrations` : on exerce donc la fonction du
        module de migration directement, sinon le backfill n'est jamais testé.

        L'enjeu : aucun foyer ne doit voir ses zones se réorganiser au déploiement.
        """
        from django.apps import apps as global_apps

        root = _root(household)
        # Tous les rangs à 0 = l'état de la prod avant migration.
        for name in ("Cave", "atelier", "Bureau", "Établi"):
            _make_zone(household, name, owner, parent=root, position=0)

        module = __import__(
            "zones.migrations.0007_alter_zone_options_zone_position_and_more",
            fromlist=["seed_positions"],
        )
        module.seed_positions(global_apps, None)

        # Insensible à la casse, comme le `localeCompare` du front.
        assert _names_in_order(household, root) == ["atelier", "Bureau", "Cave", "Établi"]
        assert _positions(household, root) == [0, 1, 2, 3]
