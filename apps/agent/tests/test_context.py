"""Tests for agent.context.build_entity_context (the anchored-conversation preamble).

No LLM involved: the builder only walks the searchables registry + retrieval,
exactly like the get_entity/get_related tools it reuses.
"""
from __future__ import annotations

import uuid

import pytest

from accounts.tests.factories import UserFactory
from agent import context
from documents.models import Document
from households.models import Household, HouseholdMember


@pytest.fixture
def owner(db):
    return UserFactory(email="agent-context-owner@example.com")


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Context House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def make_document(household, owner):
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
def make_project(household, owner):
    from projects.models import Project

    def _make(**overrides):
        payload = dict(household=household, created_by=owner, title="generic project")
        payload.update(overrides)
        return Project.objects.create(**payload)

    return _make


class TestBuildEntityContext:
    def test_anchor_and_related_are_rendered_and_citable(
        self, household, owner, make_project, make_document
    ):
        from django.utils import timezone
        from interactions.models import Interaction
        from projects.models import ProjectDocument
        from tasks.models import Task

        project = make_project(title="Rénovation PAC", description="devis en cours")
        doc = make_document(name="devis PAC", ocr_text="montant 12000")
        ProjectDocument.objects.create(project=project, document=doc)
        interaction = Interaction.objects.create(
            household=household, created_by=owner, subject="Dépense PAC",
            occurred_at=timezone.now(), project=project,
        )
        task = Task.objects.create(
            household=household, created_by=owner, subject="Commander la PAC", project=project
        )

        ctx = context.build_entity_context("project", str(project.pk), household)

        assert ctx is not None
        assert ctx.label == "Rénovation PAC"
        # The anchor itself leads the hits, then its linked items.
        found = {(h.entity_type, h.id) for h in ctx.hits}
        assert ("project", project.pk) in found
        assert ("document", doc.id) in found
        assert ("interaction", interaction.id) in found
        assert ("task", task.id) in found
        # Rendered block is citable (ids the model can cite without searching).
        assert f"id=project:{project.pk}" in ctx.rendered
        assert f"id=document:{doc.id}" in ctx.rendered

    def test_anchor_without_related_returns_just_the_anchor(
        self, household, make_project
    ):
        project = make_project(title="Solo", description="rien de lié")
        ctx = context.build_entity_context("project", str(project.pk), household)

        assert ctx is not None
        assert [(h.entity_type, h.id) for h in ctx.hits] == [("project", project.pk)]
        assert "Solo" in ctx.rendered

    def test_orphaned_anchor_returns_none(self, household):
        ctx = context.build_entity_context("project", str(uuid.uuid4()), household)
        assert ctx is None

    def test_unknown_entity_type_returns_none(self, household):
        ctx = context.build_entity_context("dragon", "x", household)
        assert ctx is None

    def test_malformed_id_returns_none(self, household):
        ctx = context.build_entity_context("project", "not-a-uuid", household)
        assert ctx is None

    def test_scoped_to_household(self, household, owner, make_project, db):
        other = Household.objects.create(name="Other Context House")
        HouseholdMember.objects.create(
            user=owner, household=other, role=HouseholdMember.Role.OWNER
        )
        project = make_project(title="Scoped")  # in `household`
        # Resolving from the other household must not find it.
        assert context.build_entity_context("project", str(project.pk), other) is None
