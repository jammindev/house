# banking/tests/test_services_account.py
"""Service-level tests — the single write path shared by REST and future callers."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from banking.models import BankAccount
from banking.services import archive_account, create_account, update_account

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

#: Requis depuis le parcours 26 lot 7. Injecté par défaut ici pour que chaque test
#: n'énonce que ce qu'il teste ; ``TestOpeningBalanceRequired`` couvre la règle
#: elle-même.
DEFAULT_OPENING_DATE = date(2026, 1, 1)


def make_account(household, user, **fields):
    fields.setdefault("opening_balance_date", DEFAULT_OPENING_DATE)
    return create_account(household=household, user=user, **fields)


@pytest.mark.django_db
class TestCreateAccount:
    def test_creates_scoped_to_household(self):
        household, user = HouseholdFactory(), UserFactory()
        account = make_account(
            household, user, name="Compte joint", bank_label="LCL"
        )
        assert account.household_id == household.id
        assert account.created_by_id == user.id
        assert account.name == "Compte joint"

    def test_strips_and_rejects_blank_name(self):
        household, user = HouseholdFactory(), UserFactory()
        account = make_account(household, user, name="  Livret  ")
        assert account.name == "Livret"

        with pytest.raises(ValidationError) as exc:
            make_account(household, user, name="   ")
        assert "name" in exc.value.detail

    def test_duplicate_name_is_a_400_not_a_500(self):
        household, user = HouseholdFactory(), UserFactory()
        make_account(household, user, name="Compte joint")
        with pytest.raises(ValidationError) as exc:
            make_account(household, user, name="Compte joint")
        assert "name" in exc.value.detail

    def test_cash_account_needs_no_bank_fields(self):
        household, user = HouseholdFactory(), UserFactory()
        account = make_account(
            household, user, name="Espèces", kind=BankAccount.Kind.CASH
        )
        assert account.kind == BankAccount.Kind.CASH
        assert account.bank_label == ""
        assert account.iban_last4 == ""

    def test_cash_account_discards_bank_fields_if_provided(self):
        household, user = HouseholdFactory(), UserFactory()
        account = make_account(
            household,
            user,
            name="Espèces",
            kind=BankAccount.Kind.CASH,
            bank_label="LCL",
            iban_last4="1234",
        )
        assert account.bank_label == ""
        assert account.iban_last4 == ""

    def test_currency_is_normalised_and_validated(self):
        household, user = HouseholdFactory(), UserFactory()
        account = make_account(household, user, name="A", currency="eur")
        assert account.currency == "EUR"

        with pytest.raises(ValidationError) as exc:
            make_account(household, user, name="B", currency="EURO")
        assert "currency" in exc.value.detail

    def test_full_iban_is_rejected(self):
        """The "never store a full IBAN" rule is enforced at the API boundary."""
        household, user = HouseholdFactory(), UserFactory()
        with pytest.raises(ValidationError) as exc:
            make_account(
                household,
                user,
                name="Compte joint",
                iban_last4="FR7630006000011234567890189",
            )
        assert "iban_last4" in exc.value.detail

    def test_opening_balance_accepts_negative(self):
        household, user = HouseholdFactory(), UserFactory()
        account = create_account(
            household=household,
            user=user,
            name="Découvert",
            opening_balance=Decimal("-120.00"),
            opening_balance_date=date(2026, 3, 1),
        )
        assert account.opening_balance == Decimal("-120.00")
        assert account.opening_balance_date == date(2026, 3, 1)

    def test_import_options_are_not_client_writable(self):
        """Lot 2 owns the mapping; a client must not be able to forge one."""
        household, user = HouseholdFactory(), UserFactory()
        account = make_account(
            household,
            user,
            name="Compte joint",
            import_options={"date_column": "hacked"},
            default_provider="hacked",
        )
        assert account.import_options == {}
        assert account.default_provider == ""


@pytest.mark.django_db
class TestUpdateAccount:
    def test_updates_allowed_fields(self):
        account = BankAccountFactory(name="Old")
        user = UserFactory()
        updated = update_account(
            account=account, user=user, fields={"name": "New", "bank_label": "BNP"}
        )
        assert updated.name == "New"
        assert updated.bank_label == "BNP"
        assert updated.updated_by_id == user.id

    def test_ignores_fields_outside_the_allowlist(self):
        account = BankAccountFactory()
        update_account(
            account=account,
            user=UserFactory(),
            fields={"import_options": {"x": 1}, "default_provider": "generic_csv"},
        )
        account.refresh_from_db()
        assert account.import_options == {}
        assert account.default_provider == ""

    def test_duplicate_name_on_update_is_a_400(self):
        household = HouseholdFactory()
        BankAccountFactory(household=household, name="Compte joint")
        other = BankAccountFactory(household=household, name="Livret")
        with pytest.raises(ValidationError):
            update_account(account=other, user=UserFactory(), fields={"name": "Compte joint"})


@pytest.mark.django_db
class TestArchiveAccount:
    def test_archives_without_deleting(self):
        account = BankAccountFactory()
        archive_account(account=account, user=UserFactory())
        account.refresh_from_db()
        assert account.archived is True
        assert BankAccount.objects.filter(pk=account.pk).exists()

    def test_archived_account_still_holds_its_name(self):
        """Documented consequence: the unique constraint ignores ``archived``.

        Reusing a closed account's name is refused. Deliberate — the name is how
        the user tells two accounts apart in the import history, and recycling it
        would make an old statement ambiguous. Renaming the archived account is
        the escape hatch.
        """
        household = HouseholdFactory()
        account = BankAccountFactory(household=household, name="Compte joint")
        archive_account(account=account, user=UserFactory())
        with pytest.raises(ValidationError):
            make_account(household, UserFactory(), name="Compte joint")


@pytest.mark.django_db
class TestOpeningBalanceDateRequired:
    """Parcours 26, lot 7 — la porte fermée à l'entrée.

    Sans date de solde d'ouverture un compte n'a **pas de fenêtre de conformité** :
    son solde est une supposition, et aucun autre contrôle ne peut rien affirmer à
    son sujet. Le détecteur du lot 1 le signale comme prérequis bloquant sur
    l'existant ; ici on empêche d'en créer de nouveaux.
    """

    def test_creation_without_a_date_is_refused(self):
        household, user = HouseholdFactory(), UserFactory()
        with pytest.raises(ValidationError) as exc:
            create_account(household=household, user=user, name="Sans date")
        assert "opening_balance_date" in exc.value.detail

    def test_creation_with_a_date_is_accepted(self):
        household, user = HouseholdFactory(), UserFactory()
        account = create_account(
            household=household,
            user=user,
            name="Avec date",
            opening_balance_date=date(2026, 1, 1),
        )
        assert account.opening_balance_date == date(2026, 1, 1)

    def test_a_cash_account_needs_one_too(self):
        """Un compte espèces a une fenêtre comme les autres — sinon la détection du
        solde négatif ne porterait sur rien."""
        household, user = HouseholdFactory(), UserFactory()
        with pytest.raises(ValidationError):
            create_account(
                household=household, user=user, name="Espèces", kind=BankAccount.Kind.CASH
            )

    def test_updating_an_account_without_one_stays_possible(self):
        """Sinon un simple renommage serait bloqué jusqu'à ce que l'utilisateur
        remplisse un champ sans rapport — le détecteur est là pour ça."""
        household = HouseholdFactory()
        account = BankAccountFactory(household=household, opening_balance_date=None)

        updated = update_account(
            account=account, user=UserFactory(), fields={"name": "Renommé"}
        )
        assert updated.name == "Renommé"
        assert updated.opening_balance_date is None
