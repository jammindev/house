"""
Tests des compteurs de contenu de zone (children_count, equipment_count,
open_task_count, active_project_count) — apps/zones/queries.py + serializers.py
+ views.py.

Style et fixtures calqués sur test_api_zones_extra.py.
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from equipment.models import Equipment
from households.models import Household, HouseholdMember
from projects.models import Project, ProjectZone
from tasks.models import Task, TaskZone
from tasks.tests.factories import TaskFactory
from zones.models import Zone


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
    return UserFactory(email="zones-counts-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _household("Zones Counts House")
    _membership(owner, instance)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


def _root(household):
    return Zone.objects.get(household=household, parent__isnull=True)


def _make_zone(household, name, owner, **kwargs):
    return Zone.objects.create(household=household, name=name, created_by=owner, **kwargs)


def _make_equipment(household, zone, owner, **kwargs):
    kwargs.setdefault("name", "Equipment")
    return Equipment.objects.create(household=household, zone=zone, created_by=owner, **kwargs)


def _make_task(household, zone, owner, **kwargs):
    task = TaskFactory(household=household, created_by=owner, **kwargs)
    TaskZone.objects.create(task=task, zone=zone)
    return task


def _make_project(household, zone, owner, **kwargs):
    kwargs.setdefault("title", "Project")
    project = Project.objects.create(household=household, created_by=owner, **kwargs)
    ProjectZone.objects.create(project=project, zone=zone, created_by=owner)
    return project


def _zone_data(response, zone_id):
    return next(item for item in response.data if item["id"] == str(zone_id))


# Ces tests couvrent apps/zones/queries.py::with_content_counts, le
# SerializerMethodField de comptage dans ZoneSerializer, et le branchement
# dans ZoneViewSet.get_queryset().
@pytest.mark.django_db
class TestZoneContentCounts:
    def test_empty_zone_returns_zero_not_null(self, owner_client, household, owner):
        zone = _make_zone(household, "Empty room", owner)

        url = reverse("zone-list")
        response = owner_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = _zone_data(response, zone.id)
        assert data["children_count"] == 0
        assert data["equipment_count"] == 0
        assert data["open_task_count"] == 0
        assert data["active_project_count"] == 0

    def test_equipment_count_includes_all_statuses(self, owner_client, household, owner):
        zone = _make_zone(household, "Garage", owner)
        _make_equipment(household, zone, owner, name="Drill", status=Equipment.Status.ACTIVE)
        _make_equipment(household, zone, owner, name="Old mower", status=Equipment.Status.RETIRED)
        _make_equipment(household, zone, owner, name="Spare parts", status=Equipment.Status.STORAGE)

        url = reverse("zone-list")
        response = owner_client.get(url)

        data = _zone_data(response, zone.id)
        assert data["equipment_count"] == 3

    def test_open_task_count_excludes_done_and_archived(self, owner_client, household, owner):
        zone = _make_zone(household, "Living room", owner)
        _make_task(household, zone, owner, status=Task.Status.BACKLOG)
        _make_task(household, zone, owner, status=Task.Status.PENDING)
        _make_task(household, zone, owner, status=Task.Status.IN_PROGRESS)
        _make_task(household, zone, owner, status=Task.Status.DONE)
        _make_task(household, zone, owner, status=Task.Status.ARCHIVED)

        url = reverse("zone-list")
        response = owner_client.get(url)

        data = _zone_data(response, zone.id)
        assert data["open_task_count"] == 3

    def test_active_project_count_only_counts_active_status(self, owner_client, household, owner):
        zone = _make_zone(household, "Attic", owner)
        _make_project(household, zone, owner, title="Insulation", status=Project.Status.ACTIVE)
        _make_project(household, zone, owner, title="Someday", status=Project.Status.DRAFT)
        _make_project(household, zone, owner, title="Done last year", status=Project.Status.COMPLETED)
        _make_project(household, zone, owner, title="Paused", status=Project.Status.ON_HOLD)
        _make_project(household, zone, owner, title="Cancelled", status=Project.Status.CANCELLED)

        url = reverse("zone-list")
        response = owner_client.get(url)

        data = _zone_data(response, zone.id)
        assert data["active_project_count"] == 1

    def test_children_count_only_direct_children(self, owner_client, household, owner):
        parent = _make_zone(household, "Ground floor", owner)
        _make_zone(household, "Kitchen", owner, parent=parent)
        _make_zone(household, "Living room", owner, parent=parent)
        grandchild_parent = _make_zone(household, "Kitchen nook", owner, parent=parent)
        # Petit-enfant : ne doit pas remonter dans le compteur de `parent`.
        _make_zone(household, "Pantry", owner, parent=grandchild_parent)

        url = reverse("zone-list")
        response = owner_client.get(url)

        data = _zone_data(response, parent.id)
        # 2 enfants directs + le "Kitchen nook" lui-même compte comme 3e enfant direct.
        assert data["children_count"] == 3
        nook_data = _zone_data(response, grandchild_parent.id)
        assert nook_data["children_count"] == 1

    def test_counts_do_not_leak_across_households(self, owner_client, household, owner):
        zone = _make_zone(household, "My room", owner)

        other_household = _household("Other Counts House")
        _membership(owner, other_household)
        other_zone = _make_zone(other_household, "Other room", owner)
        _make_equipment(other_household, other_zone, owner, name="Foreign drill")
        _make_task(other_household, other_zone, owner, status=Task.Status.PENDING)
        _make_project(other_household, other_zone, owner, status=Project.Status.ACTIVE)

        url = reverse("zone-list")
        response = owner_client.get(url)

        data = _zone_data(response, zone.id)
        assert data["equipment_count"] == 0
        assert data["open_task_count"] == 0
        assert data["active_project_count"] == 0
        # La racine du foyer principal ne doit pas non plus voir le contenu étranger.
        root = _root(household)
        root_data = _zone_data(response, root.id)
        assert root_data["equipment_count"] == 0


# Validation de `surface` (DecimalField min_value=0) sur create/update.
@pytest.mark.django_db
class TestZoneSurfaceValidation:
    def _zone_payload(self, **overrides):
        payload = {"name": "Bedroom", "surface": "18.50", "note": "Chambre parentale"}
        payload.update(overrides)
        return payload

    def test_create_rejects_negative_surface(self, owner_client):
        url = reverse("zone-list")
        response = owner_client.post(url, self._zone_payload(surface="-5.00"), format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "surface" in response.data

    def test_create_persists_valid_surface_and_note(self, owner_client, household):
        url = reverse("zone-list")
        payload = self._zone_payload()
        response = owner_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["surface"] == "18.50"
        assert response.data["note"] == "Chambre parentale"

        zone = Zone.objects.get(id=response.data["id"])
        assert zone.surface == pytest.approx(18.50)
        assert zone.note == "Chambre parentale"
        assert zone.household_id == household.id

    def test_patch_rejects_negative_surface(self, owner_client, household, owner):
        zone = _make_zone(household, "Office", owner, surface=12)

        url = reverse("zone-detail", args=[zone.id])
        response = owner_client.patch(url, {"surface": "-1.00"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "surface" in response.data
        zone.refresh_from_db()
        assert zone.surface == 12

    def test_patch_persists_valid_surface(self, owner_client, household, owner):
        zone = _make_zone(household, "Office", owner, surface=12)

        url = reverse("zone-detail", args=[zone.id])
        response = owner_client.patch(url, {"surface": "24.75"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["surface"] == "24.75"
        zone.refresh_from_db()
        assert zone.surface == pytest.approx(24.75)

    def test_patch_is_really_partial(self, owner_client, household, owner):
        """Un PATCH n'exige que les champs qu'il envoie.

        Non-régression : `partial_update` route vers `update()` pour la garde
        anti-écrasement (`last_known_updated_at`) et doit réinjecter
        `kwargs['partial'] = True`. Sans lui, `UpdateModelMixin.update` retombe
        sur `partial=False` et un PATCH d'un seul champ repart en 400 pour `name`
        manquant — un vrai PATCH d'API (agent, script, client mobile) devenait
        impossible.
        """
        zone = _make_zone(household, "Office", owner, surface=12)

        url = reverse("zone-detail", args=[zone.id])
        response = owner_client.patch(url, {"surface": "24.75"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        zone.refresh_from_db()
        assert zone.surface == pytest.approx(24.75)
        # Le champ absent du PATCH est préservé.
        assert zone.name == "Office"


# Non-régression de perf : la liste des zones ne doit pas faire un nombre de
# requêtes proportionnel au nombre de zones (sous-requêtes corrélées, pas de
# Count/distinct en N+1).
@pytest.mark.django_db
class TestZoneListQueryCount:
    def _build_dense_tree(self, household, owner):
        root = _root(household)
        zones = [root]
        for i in range(11):
            zone = _make_zone(household, f"Zone {i}", owner, parent=root)
            _make_equipment(household, zone, owner, name=f"Gadget {i}")
            _make_task(household, zone, owner, status=Task.Status.PENDING)
            _make_project(household, zone, owner, title=f"Project {i}", status=Project.Status.ACTIVE)
            zones.append(zone)
        return zones

    def test_list_query_count_is_bounded(self, owner_client, household, owner, django_assert_max_num_queries):
        self._build_dense_tree(household, owner)

        url = reverse("zone-list")
        # Mesuré empiriquement (CaptureQueriesContext) sur 12 zones (racine + 11),
        # chacune avec un équipement, une tâche ouverte et un projet actif : exactement
        # 2 requêtes — le lookup du household actif de l'utilisateur, puis la liste des
        # zones elle-même (les 4 compteurs sont des Subquery corrélées dans le SELECT,
        # pas des requêtes séparées ; `select_related('parent', ...)` évite tout accès
        # supplémentaire pour `full_path`/`depth`, qui ne recursent que d'un niveau ici).
        # Borne fixée à 4 (marge de 2) : elle protège contre la régression la plus
        # probable — un `.count()` par zone (repli non annoté du serializer) ou un
        # `Count` multiple qui remplacerait un `Subquery`, l'un et l'autre feraient
        # croître le nombre de requêtes avec le nombre de zones.
        with django_assert_max_num_queries(4):
            response = owner_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 12
