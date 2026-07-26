# banking/tests/test_api_imports.py
"""
REST API tests for StatementImportViewSet (/api/banking/imports/).

The contract worth locking down: a **business** failure (unreadable file, wrong
mapping) is a **201** carrying ``status='failed'``, not a 4xx. Only malformed
*requests* are 4xx. And ``DELETE`` never exists.
"""
from __future__ import annotations

import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from banking.models import BankTransaction, ImportStatus
from households.models import HouseholdMember

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

LIST_URL = "/api/banking/imports/"
PREVIEW_URL = "/api/banking/imports/preview/"

MAPPING = {"date_column": "Date", "label_column": "Libelle", "amount_column": "Montant"}

JULY = """Date;Libelle;Montant
12/07/2026;CB LECLERC;-32,50
14/07/2026;VIR SALAIRE;2100,00
"""


def _make_member(household, role=HouseholdMember.Role.MEMBER):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=role)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _upload(body: str = JULY, name: str = "releve.csv") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, body.encode("utf-8"), content_type="text/csv")


def _results(response) -> list:
    body = response.json()
    return body["results"] if isinstance(body, dict) else body


def _post_import(client, account, body: str = JULY, options: dict | None = None, **extra):
    payload = {
        "account": str(account.id),
        "provider": "generic_csv",
        "file": _upload(body),
        "options": json.dumps(options if options is not None else MAPPING),
    }
    payload.update(extra)
    return client.post(LIST_URL, payload, format="multipart")


@pytest.fixture
def context(db):
    household = HouseholdFactory()
    user = _make_member(household)
    account = BankAccountFactory(household=household)
    return household, user, account, _client_for(user)


@pytest.mark.django_db
class TestImportCreate:
    def test_happy_path_returns_201_with_counts(self, context):
        _, _, account, client = context
        response = _post_import(client, account)

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["status"] == ImportStatus.COMPLETED
        assert body["created_count"] == 2
        assert body["skipped_count"] == 0
        assert BankTransaction.objects.filter(account=account).count() == 2

    def test_reimport_returns_201_with_zero_created(self, context):
        _, _, account, client = context
        _post_import(client, account)
        response = _post_import(client, account)

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["created_count"] == 0
        assert response.json()["skipped_count"] == 2

    def test_business_failure_is_a_201_not_a_400(self, context):
        """An unreadable file is a readable outcome, not an HTTP error."""
        _, _, account, client = context
        response = _post_import(client, account, body="Date;Libelle;Montant\n12/07/2026;X;abc\n")

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["status"] == ImportStatus.FAILED
        assert body["created_count"] == 0
        assert "line 2" in body["error"]
        assert BankTransaction.objects.filter(account=account).count() == 0

    def test_missing_file_is_a_400(self, context):
        _, _, account, client = context
        response = client.post(
            LIST_URL,
            {"account": str(account.id), "provider": "generic_csv"},
            format="multipart",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "file" in response.json()

    def test_missing_account_is_a_400(self, context):
        _, _, _, client = context
        response = client.post(
            LIST_URL,
            {"provider": "generic_csv", "file": _upload(), "options": json.dumps(MAPPING)},
            format="multipart",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "account" in response.json()

    def test_account_of_another_household_is_a_400(self, context):
        _, _, _, client = context
        foreign = BankAccountFactory(household=HouseholdFactory())
        response = _post_import(client, foreign)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert BankTransaction.objects.filter(account=foreign).count() == 0

    def test_unknown_provider_is_a_400(self, context):
        _, _, account, client = context
        response = _post_import(client, account, provider="nope")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "provider" in response.json()

    def test_malformed_options_json_is_a_400(self, context):
        _, _, account, client = context
        response = client.post(
            LIST_URL,
            {
                "account": str(account.id),
                "provider": "generic_csv",
                "file": _upload(),
                "options": "{not json",
            },
            format="multipart",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "options" in response.json()

    def test_anonymous_cannot_import(self, db):
        account = BankAccountFactory()
        response = _post_import(APIClient(), account)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


@pytest.mark.django_db
class TestImportHistory:
    def test_lists_own_household_imports(self, context):
        _, _, account, client = context
        _post_import(client, account)

        response = client.get(LIST_URL)

        assert response.status_code == status.HTTP_200_OK
        rows = _results(response)
        assert len(rows) == 1
        assert rows[0]["account_name"] == account.name

    def test_filters_by_account(self, context):
        household, _, account, client = context
        other = BankAccountFactory(household=household, name="Second compte")
        _post_import(client, account)

        assert len(_results(client.get(f"{LIST_URL}?account={account.id}"))) == 1
        assert len(_results(client.get(f"{LIST_URL}?account={other.id}"))) == 0

    def test_does_not_leak_another_household(self, context):
        _, _, account, client = context
        _post_import(client, account)

        stranger = _make_member(HouseholdFactory())
        assert _results(_client_for(stranger).get(LIST_URL)) == []


@pytest.mark.django_db
class TestImportIsAppendOnly:
    def test_delete_is_not_allowed(self, context):
        """Deleting an import then re-importing would drop every allocation."""
        _, _, account, client = context
        import_id = _post_import(client, account).json()["id"]

        response = client.delete(f"{LIST_URL}{import_id}/")

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_patch_is_not_allowed(self, context):
        _, _, account, client = context
        import_id = _post_import(client, account).json()["id"]

        response = client.patch(
            f"{LIST_URL}{import_id}/", {"status": "completed"}, format="multipart"
        )

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.django_db
class TestPreview:
    def test_returns_columns_and_sample_lines(self, context):
        _, _, _, client = context
        response = client.post(PREVIEW_URL, {"file": _upload()}, format="multipart")

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["columns"] == ["Date", "Libelle", "Montant"]
        assert body["detected_provider"] == "generic_csv"
        assert body["sample_lines"][0].startswith("Date")

    def test_does_not_raise_on_a_junk_file(self, context):
        """The dialog must always be able to show what the user dropped."""
        _, _, _, client = context
        response = client.post(
            PREVIEW_URL, {"file": _upload(body="\x00\x01garbage")}, format="multipart"
        )
        assert response.status_code == status.HTTP_200_OK

    def test_requires_a_file(self, context):
        _, _, _, client = context
        response = client.post(PREVIEW_URL, {}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
