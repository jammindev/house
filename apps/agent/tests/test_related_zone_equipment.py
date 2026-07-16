"""Tests for the zone and equipment ``related`` callables (get_related tool).

Until now only ``project`` declared a ``related`` on its SearchableSpec — asking
``get_related`` on a zone or an equipment answered "no related items". These
tests cover the two new neighbourhoods end-to-end through the tool.
"""
from __future__ import annotations

import pytest
from django.utils import timezone

from accounts.tests.factories import UserFactory
from agent import tools
from documents.models import Document
from equipment.models import Equipment, EquipmentInteraction
from interactions.models import Interaction, InteractionZone
from tasks.models import Task, TaskZone
from zones.models import Zone, ZoneDocument


@pytest.fixture
def owner(db):
    return UserFactory(email="agent-related-owner@example.com")


@pytest.fixture
def zone(household, owner):
    return Zone.objects.create(household=household, name="Salon", created_by=owner)


def _related(household, entity_type, obj):
    return tools.dispatch(
        "get_related",
        {"entity_type": entity_type, "id": str(obj.pk)},
        household=household,
    )


class TestZoneRelated:
    def test_returns_child_zones(self, household, owner, zone):
        child = Zone.objects.create(
            household=household, name="Coin lecture", parent=zone, created_by=owner
        )
        result = _related(household, "zone", zone)
        assert f"id=zone:{child.pk}" in result.rendered

    def test_returns_equipment_of_the_zone(self, household, owner, zone):
        equipment = Equipment.objects.create(
            household=household, name="Poêle à bois", zone=zone, created_by=owner
        )
        result = _related(household, "zone", zone)
        assert f"id=equipment:{equipment.pk}" in result.rendered

    def test_returns_tasks_and_interactions_of_the_zone(self, household, owner, zone):
        task = Task.objects.create(
            household=household, created_by=owner, subject="Repeindre le mur"
        )
        TaskZone.objects.create(task=task, zone=zone)
        interaction = Interaction.objects.create(
            household=household, created_by=owner, subject="Fuite réparée",
            type="repair", occurred_at=timezone.now(),
        )
        InteractionZone.objects.create(interaction=interaction, zone=zone)

        result = _related(household, "zone", zone)
        assert f"id=task:{task.pk}" in result.rendered
        assert f"id=interaction:{interaction.pk}" in result.rendered

    def test_returns_photo_documents_of_the_zone(self, household, owner, zone):
        document = Document.objects.create(
            household=household, created_by=owner, file_path="documents/salon.jpg",
            name="Photo salon", mime_type="image/jpeg", type="photo",
        )
        ZoneDocument.objects.create(zone=zone, document=document, created_by=owner)
        result = _related(household, "zone", zone)
        assert f"id=document:{document.pk}" in result.rendered

    def test_related_hits_feed_the_citation_pool(self, household, owner, zone):
        equipment = Equipment.objects.create(
            household=household, name="Climatiseur", zone=zone, created_by=owner
        )
        result = _related(household, "zone", zone)
        assert equipment.pk in {h.id for h in result.hits}

    def test_zone_without_neighbours_says_so(self, household, owner, zone):
        result = _related(household, "zone", zone)
        assert "no items linked" in result.rendered


class TestEquipmentRelated:
    def test_returns_zone_and_interaction_history(self, household, owner, zone):
        equipment = Equipment.objects.create(
            household=household, name="Chaudière", zone=zone, created_by=owner
        )
        interaction = Interaction.objects.create(
            household=household, created_by=owner, subject="Entretien annuel",
            type="maintenance", occurred_at=timezone.now(),
        )
        EquipmentInteraction.objects.create(equipment=equipment, interaction=interaction)

        result = _related(household, "equipment", equipment)
        assert f"id=zone:{zone.pk}" in result.rendered
        assert f"id=interaction:{interaction.pk}" in result.rendered

    def test_equipment_without_zone_still_lists_interactions(self, household, owner):
        equipment = Equipment.objects.create(
            household=household, name="Aspirateur", created_by=owner
        )
        interaction = Interaction.objects.create(
            household=household, created_by=owner, subject="Achat",
            type="expense", occurred_at=timezone.now(),
        )
        EquipmentInteraction.objects.create(equipment=equipment, interaction=interaction)

        result = _related(household, "equipment", equipment)
        assert f"id=interaction:{interaction.pk}" in result.rendered
        assert "id=zone:" not in result.rendered

    def test_returns_linked_documents(self, household, owner):
        from equipment.models import EquipmentDocument

        equipment = Equipment.objects.create(
            household=household, name="Chaudière", created_by=owner
        )
        document = Document.objects.create(
            household=household, created_by=owner, file_path="documents/facture.pdf",
            name="Facture chaudière", mime_type="application/pdf", type="invoice",
        )
        EquipmentDocument.objects.create(equipment=equipment, document=document, created_by=owner)

        result = _related(household, "equipment", equipment)
        assert f"id=document:{document.pk}" in result.rendered

    def test_equipment_without_neighbours_says_so(self, household, owner):
        equipment = Equipment.objects.create(
            household=household, name="Grille-pain", created_by=owner
        )
        result = _related(household, "equipment", equipment)
        assert "no items linked" in result.rendered
