"""Tests for the agent retrieval layer."""
from __future__ import annotations

import pytest

from agent.retrieval import Hit, search


@pytest.fixture
def owner(db):
    from accounts.tests.factories import UserFactory

    return UserFactory(email="retrieval-owner@example.com")


@pytest.fixture
def household(db, owner):
    from households.models import Household, HouseholdMember

    h = Household.objects.create(name="Retrieval House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def other_household(db, owner):
    from households.models import Household, HouseholdMember

    h = Household.objects.create(name="Other House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def make_document(household, owner):
    from documents.models import Document

    def _make(**overrides):
        payload = dict(
            household=household,
            created_by=owner,
            file_path="documents/x.pdf",
            name="generic",
            mime_type="application/pdf",
            type="document",
            ocr_text="",
            notes="",
        )
        payload.update(overrides)
        return Document.objects.create(**payload)

    return _make


@pytest.fixture
def make_equipment(household, owner):
    from equipment.models import Equipment

    def _make(**overrides):
        payload = dict(
            household=household,
            created_by=owner,
            name="generic equipment",
        )
        payload.update(overrides)
        return Equipment.objects.create(**payload)

    return _make


@pytest.fixture
def make_task(household, owner):
    from tasks.models import Task

    def _make(**overrides):
        payload = dict(household=household, created_by=owner, subject="generic task")
        payload.update(overrides)
        return Task.objects.create(**payload)

    return _make


@pytest.fixture
def make_interaction(household, owner):
    from django.utils import timezone
    from interactions.models import Interaction

    def _make(**overrides):
        payload = dict(
            household=household,
            created_by=owner,
            subject="generic interaction",
            occurred_at=timezone.now(),
        )
        payload.update(overrides)
        return Interaction.objects.create(**payload)

    return _make


@pytest.fixture
def make_project(household, owner):
    from projects.models import Project

    def _make(**overrides):
        payload = dict(household=household, created_by=owner, title="generic project")
        payload.update(overrides)
        return Project.objects.create(**payload)

    return _make


@pytest.fixture
def make_zone(household, owner):
    from zones.models import Zone

    def _make(**overrides):
        payload = dict(household=household, created_by=owner, name="generic zone")
        payload.update(overrides)
        return Zone.objects.create(**payload)

    return _make


@pytest.fixture
def stock_category(household, owner):
    from stock.models import StockCategory

    return StockCategory.objects.create(
        household=household, created_by=owner, name="general"
    )


@pytest.fixture
def make_stock_item(household, owner, stock_category):
    from stock.models import StockItem

    def _make(**overrides):
        payload = dict(
            household=household,
            created_by=owner,
            category=stock_category,
            name="generic stock",
        )
        payload.update(overrides)
        return StockItem.objects.create(**payload)

    return _make


@pytest.fixture
def make_insurance(household, owner):
    from insurance.models import InsuranceContract

    def _make(**overrides):
        payload = dict(household=household, created_by=owner, name="generic insurance")
        payload.update(overrides)
        return InsuranceContract.objects.create(**payload)

    return _make


@pytest.fixture
def make_contact(household, owner):
    from directory.models import Contact

    def _make(**overrides):
        payload = dict(
            household=household,
            created_by=owner,
            first_name="Jane",
            last_name="Doe",
            notes="",
        )
        payload.update(overrides)
        return Contact.objects.create(**payload)

    return _make


@pytest.fixture
def make_structure(household, owner):
    from directory.models import Structure

    def _make(**overrides):
        payload = dict(household=household, created_by=owner, name="generic structure")
        payload.update(overrides)
        return Structure.objects.create(**payload)

    return _make


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestEmptyAndScope:
    def test_empty_query_returns_empty_list(self, household):
        assert search(household.id, "") == []
        assert search(household.id, "   ") == []

    def test_no_data_returns_empty_list(self, household):
        assert search(household.id, "engie") == []

    def test_household_scope_isolated(self, household, other_household, owner, make_document):
        from documents.models import Document

        make_document(name="Engie facture mars")
        Document.objects.create(
            household=other_household,
            created_by=owner,
            file_path="documents/y.pdf",
            name="Engie facture autre",
            mime_type="application/pdf",
            type="document",
        )
        my_hits = search(household.id, "engie")
        their_hits = search(other_household.id, "engie")
        my_labels = {h.label for h in my_hits}
        their_labels = {h.label for h in their_hits}
        assert "Engie facture mars" in my_labels
        assert "Engie facture autre" not in my_labels
        assert "Engie facture autre" in their_labels


class TestPerEntityHits:
    def test_document_hit(self, household, make_document):
        make_document(name="Facture Engie", ocr_text="total 142,67 EUR")
        hits = search(household.id, "engie")
        assert any(h.entity_type == "document" and h.label == "Facture Engie" for h in hits)

    def test_interaction_hit(self, household, make_interaction):
        make_interaction(subject="Visite chaudière", content="Technicien Engie")
        hits = search(household.id, "chaudière")
        assert any(h.entity_type == "interaction" for h in hits)

    def test_equipment_hit(self, household, make_equipment):
        make_equipment(name="Chaudière Bosch", manufacturer="Bosch", model="Condens 5000")
        hits = search(household.id, "chaudière")
        assert any(h.entity_type == "equipment" for h in hits)

    def test_task_hit(self, household, make_task):
        make_task(subject="Réviser la chaudière")
        hits = search(household.id, "chaudière")
        assert any(h.entity_type == "task" for h in hits)

    def test_project_hit(self, household, make_project):
        make_project(title="Rénovation chaudière 2026")
        hits = search(household.id, "chaudière")
        assert any(h.entity_type == "project" for h in hits)

    def test_zone_hit(self, household, make_zone):
        make_zone(name="Local chaudière", note="contient la chaudière à gaz")
        hits = search(household.id, "chaudière")
        assert any(h.entity_type == "zone" for h in hits)

    def test_stock_item_hit(self, household, make_stock_item):
        make_stock_item(name="Filtre chaudière")
        hits = search(household.id, "chaudière")
        assert any(h.entity_type == "stock_item" for h in hits)

    def test_insurance_contract_hit(self, household, make_insurance):
        make_insurance(name="Habitation", coverage_summary="couvre la chaudière")
        hits = search(household.id, "chaudière")
        assert any(h.entity_type == "insurance_contract" for h in hits)

    def test_contact_hit(self, household, make_contact):
        make_contact(first_name="Jean", last_name="Plombier", notes="installateur chaudière")
        hits = search(household.id, "chaudière")
        assert any(h.entity_type == "contact" for h in hits)

    def test_structure_hit(self, household, make_structure):
        make_structure(name="Chaudière Sav", description="atelier de maintenance chaudière")
        hits = search(household.id, "chaudière")
        assert any(h.entity_type == "structure" for h in hits)


class TestRanking:
    def test_ranking_descending(self, household, make_document):
        make_document(name="Engie facture", ocr_text="total 142,67")
        make_document(name="autre", ocr_text="reference engie en passant ailleurs")
        hits = search(household.id, "engie")
        assert len(hits) >= 2
        ranks = [h.rank for h in hits]
        assert ranks == sorted(ranks, reverse=True)

    def test_match_in_name_outranks_match_lost_in_ocr(self, household, make_document):
        title_match = make_document(name="Engie facture mars", ocr_text="x" * 200)
        ocr_match = make_document(
            name="Document divers",
            ocr_text="lorem ipsum " * 200 + " engie en passant " + "dolor sit " * 200,
        )
        hits = search(household.id, "engie")
        labels_in_order = [h.label for h in hits]
        assert title_match.name in labels_in_order
        assert ocr_match.name in labels_in_order
        assert labels_in_order.index(title_match.name) < labels_in_order.index(ocr_match.name)


class TestCaseAndAccentInsensitive:
    def test_case_insensitive(self, household, make_document):
        make_document(name="Engie facture")
        assert search(household.id, "ENGIE")
        assert search(household.id, "engie")
        assert search(household.id, "Engie")

    def test_accent_insensitive_query_no_accent(self, household, make_document):
        make_document(name="Facture café Engie")
        hits = search(household.id, "cafe")
        assert any("café" in h.label.lower() or "cafe" in h.label.lower() for h in hits)

    def test_accent_insensitive_data_no_accent(self, household, make_document):
        make_document(name="Facture cafe Engie")
        hits = search(household.id, "café")
        assert hits


class TestHitContract:
    def test_hit_shape(self, household, make_document):
        make_document(name="Engie facture mars", ocr_text="total 142,67 EUR à payer")
        hits = search(household.id, "engie")
        assert hits
        h = hits[0]
        assert isinstance(h, Hit)
        assert h.entity_type == "document"
        assert h.id is not None
        assert h.label == "Engie facture mars"
        assert h.url_path == f"/app/documents/{h.id}"
        assert h.rank > 0
        # Snippet may or may not contain highlight markers depending on the
        # field that matched, but it should be a non-empty string.
        assert isinstance(h.snippet, str)

    def test_limit_respected(self, household, make_document):
        for i in range(5):
            make_document(name=f"Engie doc {i}")
        assert len(search(household.id, "engie", limit=3)) == 3

    def test_multi_entity_query(
        self,
        household,
        make_document,
        make_equipment,
        make_task,
        make_interaction,
    ):
        make_document(name="Manuel chaudière Bosch")
        make_equipment(name="Chaudière Bosch")
        make_task(subject="Entretien chaudière")
        make_interaction(subject="Panne chaudière")
        hits = search(household.id, "chaudière", limit=20)
        types = {h.entity_type for h in hits}
        assert {"document", "equipment", "task", "interaction"}.issubset(types)
