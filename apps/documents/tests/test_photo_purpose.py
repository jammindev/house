"""L'intention d'une photo — `Document.purpose`, son filtre et son lot.

Une photo porte déjà trois axes : la zone dit *où*, le lien d'entité dit *sur quoi*,
`DocumentLink.phase` dit *quand dans le chantier*. Aucun ne dit **pourquoi elle
existe** — et c'est la question qui sépare une preuve technique d'un souvenir.

Les deux invariants tenus ici, et qui ne se voient dans aucune relecture de diff :

1. **le vide n'est pas `memory`** — vide dit que personne n'a regardé (un écart),
   `memory` dit qu'on a choisi. Les confondre rend la file « À trier » aveugle et
   l'utilisateur croit avoir rangé ;
2. **un lot n'écrase jamais un choix déjà posé** — une grappe dont quelques photos
   sont déjà rangées est le cas normal, pas l'exception.
"""
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from documents.models import Document
from households.models import Household, HouseholdMember

LIST_URL = "/api/documents/documents/"
SET_PURPOSE_URL = "/api/documents/documents/set_purpose/"
COUNTS_URL = "/api/documents/documents/purpose_counts/"


def _photo(household, user, name="Photo", purpose="", doc_type="photo") -> Document:
    return Document.objects.create(
        household=household,
        created_by=user,
        file_path=f"documents/{name.lower()}.jpg",
        name=name,
        mime_type="image/jpeg",
        type=doc_type,
        purpose=purpose,
    )


@pytest.fixture
def owner(db):
    return UserFactory(email="purpose@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Purpose House")
    HouseholdMember.objects.create(
        user=owner, household=hh, role=HouseholdMember.Role.OWNER
    )
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def client(owner, household):
    api = APIClient()
    api.force_authenticate(user=owner)
    api.credentials(HTTP_X_HOUSEHOLD_ID=str(household.id))
    return api


def _names(response) -> set[str]:
    payload = response.json()
    rows = payload["results"] if isinstance(payload, dict) else payload
    return {row["name"] for row in rows}


@pytest.mark.django_db
class TestEmptyIsNotAMemory:
    """Le test de régression du parcours 29 : deux états, jamais un seul.

    C'est la déclinaison photo de `inflow_nature == ""` qui n'est pas `"other"`. Le
    défaut qu'il attrape est silencieux des deux côtés : une file qui se croit vide, et
    un souvenir qu'on redemande de trier.
    """

    def test_an_untriaged_photo_is_not_returned_as_a_memory(
        self, client, household, owner
    ):
        _photo(household, owner, name="Pas triee")
        _photo(household, owner, name="Anniversaire", purpose="memory")

        response = client.get(LIST_URL, {"purpose": "memory"})

        assert response.status_code == status.HTTP_200_OK
        assert _names(response) == {"Anniversaire"}

    def test_a_memory_is_not_returned_as_untriaged(self, client, household, owner):
        _photo(household, owner, name="Pas triee")
        _photo(household, owner, name="Anniversaire", purpose="memory")

        response = client.get(LIST_URL, {"purpose": "untriaged"})

        assert _names(response) == {"Pas triee"}

    def test_the_counter_tells_them_apart(self, client, household, owner):
        _photo(household, owner, name="Chaudiere", purpose="technical")
        _photo(household, owner, name="Anniversaire", purpose="memory")
        _photo(household, owner, name="Pas triee")
        _photo(household, owner, name="Pas triee non plus")

        counts = client.get(COUNTS_URL).json()

        assert counts["memory"] == 1
        assert counts["technical"] == 1
        assert counts["observation"] == 0
        assert counts["untriaged"] == 2

    def test_the_triage_queue_only_holds_what_nobody_sorted(
        self, client, household, owner
    ):
        _photo(household, owner, name="Anniversaire", purpose="memory")
        _photo(household, owner, name="Pas triee")

        payload = client.get("/api/documents/documents/triage/").json()

        assert payload["total"] == 1
        assert [photo["name"] for cluster in payload["clusters"] for photo in cluster["photos"]] == [
            "Pas triee"
        ]

    def test_an_empty_parameter_never_means_all(self, client, household, owner):
        """`?purpose=` vide est refusé, jamais dégradé en « toutes ».

        Dégrader ferait afficher la galerie entière sous une pastille « À trier », et
        le compteur d'à côté dirait autre chose que la liste.
        """
        _photo(household, owner, name="Anniversaire", purpose="memory")

        response = client.get(LIST_URL, {"purpose": ""})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_an_unknown_purpose_is_refused(self, client, household, owner):
        response = client.get(LIST_URL, {"purpose": "souvenir"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestABatchNeverOverwritesAChoice:
    """Trier une grappe ne défait pas le travail déjà fait.

    Même règle que l'éditeur de ventilation, qui ne détache jamais par effet de bord :
    ce qu'on n'a pas regardé une par une ne se réécrit pas en silence.
    """

    def test_it_sorts_a_whole_cluster_in_one_call(self, client, household, owner):
        photos = [_photo(household, owner, f"P{index}") for index in range(3)]

        response = client.post(
            SET_PURPOSE_URL,
            {"document_ids": [p.id for p in photos], "purpose": "memory"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {"updated": 3, "skipped": 0}
        for photo in photos:
            photo.refresh_from_db()
            assert photo.purpose == "memory"

    def test_it_leaves_an_already_sorted_photo_alone_and_says_so(
        self, client, household, owner
    ):
        already = _photo(household, owner, "Chaudiere", purpose="technical")
        untouched = _photo(household, owner, "Gateau")

        response = client.post(
            SET_PURPOSE_URL,
            {"document_ids": [already.id, untouched.id], "purpose": "memory"},
            format="json",
        )

        assert response.json() == {"updated": 1, "skipped": 1}
        already.refresh_from_db()
        untouched.refresh_from_db()
        assert already.purpose == "technical"
        assert untouched.purpose == "memory"

    def test_overwriting_is_possible_but_asked_for(self, client, household, owner):
        already = _photo(household, owner, "Chaudiere", purpose="technical")

        response = client.post(
            SET_PURPOSE_URL,
            {"document_ids": [already.id], "purpose": "memory", "overwrite": True},
            format="json",
        )

        assert response.json() == {"updated": 1, "skipped": 0}
        already.refresh_from_db()
        assert already.purpose == "memory"

    def test_reapplying_the_same_purpose_is_not_a_conflict(
        self, client, household, owner
    ):
        """Un lot idempotent ne doit pas se dire à moitié appliqué."""
        photo = _photo(household, owner, "Chaudiere", purpose="technical")

        response = client.post(
            SET_PURPOSE_URL,
            {"document_ids": [photo.id], "purpose": "technical"},
            format="json",
        )

        assert response.json() == {"updated": 1, "skipped": 0}

    def test_an_empty_purpose_is_refused(self, client, household, owner):
        """« Détrier » un lot serait une destruction de masse déguisée en raccourci."""
        photo = _photo(household, owner, "Chaudiere", purpose="technical")

        response = client.post(
            SET_PURPOSE_URL,
            {"document_ids": [photo.id], "purpose": ""},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        photo.refresh_from_db()
        assert photo.purpose == "technical"

    def test_a_photo_from_another_household_refuses_the_whole_batch(
        self, client, household, owner
    ):
        mine = _photo(household, owner, "Chez moi")
        stranger = UserFactory(email="stranger-purpose@example.com")
        other_household = Household.objects.create(name="Ailleurs")
        HouseholdMember.objects.create(
            user=stranger, household=other_household, role=HouseholdMember.Role.OWNER
        )
        theirs = _photo(other_household, stranger, "Chez eux")

        response = client.post(
            SET_PURPOSE_URL,
            {"document_ids": [mine.id, theirs.id], "purpose": "memory"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        mine.refresh_from_db()
        theirs.refresh_from_db()
        assert mine.purpose == ""
        assert theirs.purpose == ""


@pytest.mark.django_db
class TestOnlyAPhotoCarriesAPurpose:
    """L'intention est propre aux photos — une facture n'a pas à peupler la file."""

    def test_the_batch_refuses_a_non_photo(self, client, household, owner):
        invoice = _photo(household, owner, "Facture", doc_type="invoice")

        response = client.post(
            SET_PURPOSE_URL,
            {"document_ids": [invoice.id], "purpose": "technical"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_patch_refuses_a_non_photo(self, client, household, owner):
        invoice = _photo(household, owner, "Facture", doc_type="invoice")

        response = client.patch(
            f"{LIST_URL}{invoice.id}/", {"purpose": "technical"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_patch_sorts_a_single_photo(self, client, household, owner):
        photo = _photo(household, owner, "Chaudiere")

        response = client.patch(
            f"{LIST_URL}{photo.id}/", {"purpose": "technical"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        photo.refresh_from_db()
        assert photo.purpose == "technical"

    def test_untriaged_ignores_documents_that_are_not_photos(
        self, client, household, owner
    ):
        _photo(household, owner, "Facture", doc_type="invoice")

        payload = client.get("/api/documents/documents/triage/").json()

        assert payload["total"] == 0
