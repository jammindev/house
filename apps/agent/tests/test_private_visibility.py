"""La confidentialité d'un document vaut aussi pour l'assistant.

Un document `is_private=True` n'est visible que de son déposant : l'API documents
l'applique depuis toujours (`documents.views.get_documents_queryset_for_request`).
La couche de retrieval de l'agent, elle, ne connaissait que le **foyer** — pas le
**lecteur**. L'OCR d'un document privé était donc cherchable et citable par
n'importe quel autre membre, par trois portes qui ne le disaient nulle part : la
palette du haut, le tool `search_household`, et `get_entity`.

C'est la règle « un écart ne se dit jamais deux fois avec deux voix » appliquée à
la visibilité : deux définitions de ce qu'un utilisateur a le droit de voir, et
c'est la plus permissive qui gagnait en silence.

Le test qui compte est le dernier — celui qui compare les deux ensembles plutôt
que d'énumérer des cas. Les autres nomment chaque porte pour que l'échec dise
laquelle a cédé.
"""
from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from agent import tools
from agent.context import build_entity_context
from documents.models import Document
from households.models import Household, HouseholdMember

SEARCH_URL = "/api/search/"
DOCUMENTS_URL = "/api/documents/documents/"

# Un mot qui n'apparaît nulle part ailleurs dans les fixtures du foyer : ce qui
# est cherché doit être trouvable, sinon le test passerait pour une mauvaise
# raison (rien trouvé = rien fuité).
NEEDLE = "myrtille"


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def shared_household(db):
    return Household.objects.create(name="Foyer partagé")


def _member(household, email, role=HouseholdMember.Role.MEMBER):
    user = UserFactory(email=email)
    HouseholdMember.objects.create(user=user, household=household, role=role)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


@pytest.fixture
def alice(shared_household):
    """Déposante du document privé. Membre simple — le rôle ne doit rien changer."""
    return _member(shared_household, "alice-private@example.com")


@pytest.fixture
def bob(shared_household):
    """Owner du foyer : s'il voyait le privé d'Alice, ce serait par son rôle.

    Le filtre porte sur `created_by`, pas sur le rôle — un owner n'est pas un
    lecteur privilégié du privé des autres.
    """
    return _member(shared_household, "bob-owner@example.com", role=HouseholdMember.Role.OWNER)


@pytest.fixture
def private_doc(shared_household, alice):
    return Document.objects.create(
        household=shared_household,
        created_by=alice,
        file_path="documents/bail.pdf",
        name="Contrat confidentiel",
        mime_type="application/pdf",
        type="document",
        ocr_text=f"Clause de confidentialité concernant la {NEEDLE}.",
        notes="",
        is_private=True,
    )


@pytest.fixture
def public_doc(shared_household, alice):
    """Témoin : même mot-clé, mais partagé. Il doit rester trouvable par tous."""
    return Document.objects.create(
        household=shared_household,
        created_by=alice,
        file_path="documents/notice.pdf",
        name="Notice partagée",
        mime_type="application/pdf",
        type="document",
        # Le mot doit apparaître **tel quel** : la config de recherche est
        # `simple_unaccent`, sans stemming — « myrtillier » ne matche pas
        # « myrtille », et le témoin passerait pour caché alors qu'il n'a
        # simplement jamais été trouvé.
        ocr_text=f"Entretien de la {NEEDLE} en hiver.",
        notes="",
        is_private=False,
    )


def _palette_ids(user) -> set[str]:
    resp = _client_for(user).get(SEARCH_URL, {"q": NEEDLE})
    assert resp.status_code == 200
    return {
        r["object_id"]
        for r in resp.json()["results"]
        if r["entity_type"] == "document"
    }


def _documents_api_ids(user) -> set[str]:
    resp = _client_for(user).get(DOCUMENTS_URL)
    assert resp.status_code == 200
    payload = resp.json()
    rows = payload["results"] if isinstance(payload, dict) else payload
    return {str(row["id"]) for row in rows}


def _tool_search_text(user, household) -> str:
    return tools.dispatch(
        "search_household",
        {"query": NEEDLE},
        household=household,
        user=user,
        client=_NoExpansionClient(),
    ).rendered


class _NoExpansionClient:
    """L'expansion de requête appelle le LLM ; ici on veut juste le retrieval.

    Renvoyer une réponse vide fait retomber `query_expansion.expand` sur le terme
    d'origine — donc la recherche porte exactement sur `NEEDLE`.
    """

    def run(self, *args, **kwargs):  # pragma: no cover - trivial
        return type("R", (), {"text": "", "blocks": [], "stop_reason": "end_turn"})()

    def run_stream(self, *args, **kwargs):  # pragma: no cover - trivial
        yield from ()


@pytest.mark.django_db
class TestTheAssistantHonoursDocumentPrivacy:
    def test_the_palette_does_not_return_another_members_private_document(
        self, bob, private_doc, public_doc
    ):
        found = _palette_ids(bob)
        assert str(private_doc.id) not in found
        assert str(public_doc.id) in found, "le témoin partagé doit rester trouvable"

    def test_the_search_tool_does_not_surface_another_members_private_document(
        self, bob, shared_household, private_doc, public_doc
    ):
        rendered = _tool_search_text(bob, shared_household)
        assert "Contrat confidentiel" not in rendered
        assert "Notice partagée" in rendered, "le témoin partagé doit rester cité"

    def test_get_entity_refuses_another_members_private_document(
        self, bob, shared_household, private_doc
    ):
        result = tools.dispatch(
            "get_entity",
            {"entity_type": "document", "id": str(private_doc.id)},
            household=shared_household,
            user=bob,
        )
        assert "Contrat confidentiel" not in result.rendered
        assert not result.hits

    def test_the_context_picker_does_not_offer_another_members_private_document(
        self, bob, private_doc, public_doc
    ):
        resp = _client_for(bob).get(
            "/api/agent/conversations/search_context/", {"q": NEEDLE}
        )
        assert resp.status_code == 200
        offered = {row["object_id"] for row in resp.json() if row["entity_type"] == "document"}
        assert str(private_doc.id) not in offered
        assert str(public_doc.id) in offered

    def test_a_private_document_does_not_ride_into_a_shared_projects_context(
        self, bob, alice, shared_household, private_doc
    ):
        """La porte la plus discrète : le contexte ancré d'un projet partagé.

        `gather_related` remonte les documents liés. Une facture privée attachée à
        un chantier que tout le foyer consulte serait injectée dans la conversation
        de n'importe qui ouvre ce chantier — sans passer par aucune recherche.
        """
        from documents.services import link_document
        from projects.models import Project

        project = Project.objects.create(
            household=shared_household, created_by=alice, title="Chantier partagé"
        )
        link_document(entity=project, document=private_doc, user=alice)

        for viewer, expected in ((bob, False), (alice, True)):
            ctx = build_entity_context(
                "project", str(project.id), shared_household, viewer
            )
            assert ctx is not None
            labels = {hit.label for hit in ctx.hits}
            assert ("Contrat confidentiel" in labels) is expected, (
                f"contexte du projet pour {viewer.email} : {labels}"
            )

    def test_the_depositor_still_finds_her_own_private_document(
        self, alice, shared_household, private_doc
    ):
        assert str(private_doc.id) in _palette_ids(alice)
        assert "Contrat confidentiel" in _tool_search_text(alice, shared_household)

        result = tools.dispatch(
            "get_entity",
            {"entity_type": "document", "id": str(private_doc.id)},
            household=shared_household,
            user=alice,
        )
        assert result.hits, "sa propre pièce privée reste lisible et citable"


@pytest.mark.django_db
class TestTheTwoDoorsAgree:
    """Le garde-fou de forme : deux définitions de la visibilité finissent par diverger.

    Plutôt que d'énumérer les portes une à une — la prochaine ne serait pas
    couverte — on compare l'ensemble que l'assistant peut trouver à l'ensemble que
    la liste documents affiche, pour le même lecteur.
    """

    @pytest.mark.parametrize("who", ["alice", "bob"])
    def test_the_search_never_returns_a_document_the_list_hides(
        self, who, request, private_doc, public_doc
    ):
        user = request.getfixturevalue(who)
        visible_in_app = _documents_api_ids(user)
        found_by_the_assistant = _palette_ids(user)

        leaked = found_by_the_assistant - visible_in_app
        assert not leaked, (
            f"l'assistant renvoie à {who} des documents que la liste lui cache : {leaked}"
        )
