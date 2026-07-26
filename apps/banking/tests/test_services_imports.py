# banking/tests/test_services_imports.py
"""The import service — where idempotence is actually guaranteed.

Two properties matter more than anything else here:

1. **All or nothing.** A bad line writes zero transactions, not a half statement.
2. **Re-importing is free.** Same file twice, or overlapping periods, creates
   only what is genuinely new.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from banking.models import BankTransaction, ImportStatus, TransactionDirection
from banking.services import import_statement_file

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

MAPPING = {
    "date_column": "Date",
    "label_column": "Libelle",
    "amount_column": "Montant",
}
MAPPING_WITH_BALANCE = {**MAPPING, "balance_column": "Solde"}

JULY = """Date;Libelle;Montant
12/07/2026;CB LECLERC;-32,50
14/07/2026;VIR SALAIRE;2100,00
"""

JULY_AUGUST = """Date;Libelle;Montant
12/07/2026;CB LECLERC;-32,50
14/07/2026;VIR SALAIRE;2100,00
03/08/2026;CB BRICO;-89,90
"""

TWIN_LINES = """Date;Libelle;Montant
12/07/2026;CAFE DU COIN;-3,50
12/07/2026;CAFE DU COIN;-3,50
"""

TWIN_LINES_WITH_BALANCE = """Date;Libelle;Montant;Solde
12/07/2026;CAFE DU COIN;-3,50;100,00
12/07/2026;CAFE DU COIN;-3,50;96,50
"""

BAD_LINE = """Date;Libelle;Montant
12/07/2026;CB LECLERC;-32,50
14/07/2026;CASSE;pas-un-montant
"""


def upload(body: str, name: str = "releve.csv") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, body.encode("utf-8"), content_type="text/csv")


@pytest.fixture
def context(db):
    household = HouseholdFactory()
    return household, UserFactory(), BankAccountFactory(household=household)


def run_import(context, body, *, options=None, name="releve.csv"):
    household, user, account = context
    return import_statement_file(
        household,
        user,
        account=account,
        uploaded_file=upload(body, name),
        provider="generic_csv",
        options=options or MAPPING,
    )


@pytest.mark.django_db
class TestHappyPath:
    def test_creates_transactions_with_the_right_signs(self, context):
        _, _, account = context
        imported = run_import(context, JULY)

        assert imported.status == ImportStatus.COMPLETED
        assert imported.created_count == 2
        assert imported.skipped_count == 0

        out = BankTransaction.objects.get(account=account, amount=Decimal("-32.50"))
        assert out.direction == TransactionDirection.OUT
        assert out.label_raw == "CB LECLERC"
        assert out.label_norm == "CB LECLERC"
        assert out.source_import_id == imported.id

        income = BankTransaction.objects.get(account=account, amount=Decimal("2100.00"))
        assert income.direction == TransactionDirection.IN

    def test_records_the_covered_period(self, context):
        imported = run_import(context, JULY)
        assert imported.period_start == date(2026, 7, 12)
        assert imported.period_end == date(2026, 7, 14)

    def test_remembers_the_mapping_on_the_account(self, context):
        """This is what makes the second import a drag-and-drop."""
        _, _, account = context
        run_import(context, TWIN_LINES_WITH_BALANCE, options=MAPPING_WITH_BALANCE)
        account.refresh_from_db()
        assert account.default_provider == "generic_csv"
        assert account.import_options == MAPPING_WITH_BALANCE

    def test_a_mapped_but_absent_optional_column_is_an_error(self, context):
        """Silently ignoring it would drop the balance without telling anyone."""
        imported = run_import(context, JULY, options=MAPPING_WITH_BALANCE)
        assert imported.status == ImportStatus.FAILED
        assert "Solde" in imported.error

    def test_stores_the_filename(self, context):
        assert run_import(context, JULY, name="ca-juillet.csv").filename == "ca-juillet.csv"


@pytest.mark.django_db
class TestIdempotence:
    def test_reimporting_the_same_file_creates_nothing(self, context):
        _, _, account = context
        run_import(context, JULY)
        second = run_import(context, JULY)

        assert second.status == ImportStatus.COMPLETED
        assert second.created_count == 0
        assert second.skipped_count == 2
        assert BankTransaction.objects.filter(account=account).count() == 2

    def test_overlapping_files_only_create_what_is_new(self, context):
        _, _, account = context
        run_import(context, JULY)
        second = run_import(context, JULY_AUGUST)

        assert second.created_count == 1
        assert second.skipped_count == 2
        assert BankTransaction.objects.filter(account=account).count() == 3

    def test_two_identical_lines_are_both_created(self, context):
        """Two coffees at 3.50 € the same day are two real operations."""
        _, _, account = context
        imported = run_import(context, TWIN_LINES)
        assert imported.created_count == 2
        assert BankTransaction.objects.filter(account=account).count() == 2

    def test_but_reimporting_them_creates_nothing(self, context):
        _, _, account = context
        run_import(context, TWIN_LINES)
        second = run_import(context, TWIN_LINES)

        assert second.created_count == 0
        assert second.skipped_count == 2
        assert BankTransaction.objects.filter(account=account).count() == 2

    def test_balance_column_disambiguates_twins(self, context):
        _, _, account = context
        first = run_import(context, TWIN_LINES_WITH_BALANCE, options=MAPPING_WITH_BALANCE)
        second = run_import(context, TWIN_LINES_WITH_BALANCE, options=MAPPING_WITH_BALANCE)

        assert first.created_count == 2
        assert second.created_count == 0
        assert BankTransaction.objects.filter(account=account).count() == 2

    def test_the_same_file_on_two_accounts_does_not_collide(self, context):
        household, user, account = context
        other = BankAccountFactory(household=household, name="Second compte")

        run_import(context, JULY)
        second = import_statement_file(
            household,
            user,
            account=other,
            uploaded_file=upload(JULY),
            provider="generic_csv",
            options=MAPPING,
        )

        assert second.created_count == 2
        assert BankTransaction.objects.filter(account=account).count() == 2
        assert BankTransaction.objects.filter(account=other).count() == 2


@pytest.mark.django_db
class TestFailuresWriteNothing:
    def test_a_bad_line_fails_loudly_and_writes_nothing(self, context):
        _, _, account = context
        imported = run_import(context, BAD_LINE)

        assert imported.status == ImportStatus.FAILED
        assert imported.created_count == 0
        assert "line 3" in imported.error
        assert BankTransaction.objects.filter(account=account).count() == 0

    def test_a_wrong_mapping_fails_without_writing(self, context):
        _, _, account = context
        imported = run_import(context, JULY, options={**MAPPING, "amount_column": "Nope"})

        assert imported.status == ImportStatus.FAILED
        assert "Nope" in imported.error
        assert BankTransaction.objects.filter(account=account).count() == 0

    def test_a_failed_import_does_not_overwrite_a_working_mapping(self, context):
        """A user experimenting with the mapping must not lose the good one."""
        _, _, account = context
        run_import(context, JULY, options=MAPPING)
        run_import(context, JULY, options={**MAPPING, "amount_column": "Nope"})

        account.refresh_from_db()
        assert account.import_options == MAPPING

    def test_an_unparseable_file_fails_cleanly(self, context):
        imported = run_import(context, "n'importe quoi\nsans colonnes\n")
        assert imported.status == ImportStatus.FAILED
        assert imported.created_count == 0

    def test_unrecognized_format_without_provider(self, context):
        household, user, account = context
        imported = import_statement_file(
            household,
            user,
            account=account,
            uploaded_file=upload(JULY),
            provider=None,
            options=MAPPING,
        )
        assert imported.status == ImportStatus.FAILED
        assert "not recognized" in imported.error

# --- Heuristiques appliquées à l'import (parcours 26, lot 5) -------------------


@pytest.mark.django_db
class TestImportAppliesHeuristics:
    """Les devinettes de ``rules.py`` sont écrites comme **valeurs de départ**.

    C'est la nuance qui compte : ``is_internal`` décide si l'argent compte comme
    dépense, donc une devinette appliquée comme vérité fait disparaître une vraie
    dépense des totaux, en silence. Ici elle est modifiable, et une erreur remonte
    par le détecteur « mouvement interne sans contrepartie ».
    """

    def test_an_atm_withdrawal_arrives_flagged_internal(self, context):
        run_import(
            context,
            "Date;Libelle;Montant\n"
            "10/03/2026;RETRAIT DAB RUE DES LILAS;-60,00\n"
            "11/03/2026;CB LECLERC;-42,00\n",
        )

        withdrawal = BankTransaction.objects.get(label_raw__startswith="RETRAIT DAB")
        purchase = BankTransaction.objects.get(label_raw="CB LECLERC")
        assert withdrawal.is_internal is True
        # Le défaut sûr sur tout ce qui n'est pas reconnu.
        assert purchase.is_internal is False

    def test_a_salary_arrives_classified(self, context):
        run_import(
            context,
            "Date;Libelle;Montant\n"
            "01/03/2026;VIREMENT SALAIRE MARS;2100,00\n"
            "02/03/2026;VIR M DUPONT;30,00\n",
        )

        salary = BankTransaction.objects.get(label_raw="VIREMENT SALAIRE MARS")
        unknown = BankTransaction.objects.get(label_raw="VIR M DUPONT")
        assert salary.inflow_nature == "salary"
        # Vide, pas ``other`` : personne n'a encore regardé — c'est l'écart que le
        # contrôle signale.
        assert unknown.inflow_nature == ""

    def test_an_outflow_never_gets_a_nature(self, context):
        run_import(context, "Date;Libelle;Montant\n11/03/2026;REMBOURSEMENT PRET;-350,00\n")
        assert BankTransaction.objects.get(label_raw="REMBOURSEMENT PRET").inflow_nature == ""

    def test_a_user_correction_survives_a_re_import(self, context):
        """L'idempotence protège le choix de l'utilisateur : la ligne existe déjà,
        donc le ré-import n'écrit rien et ne re-devine rien."""
        body = "Date;Libelle;Montant\n10/03/2026;RETRAIT DAB;-60,00\n"
        run_import(context, body)

        line = BankTransaction.objects.get(label_raw="RETRAIT DAB")
        line.is_internal = False
        line.save(update_fields=["is_internal"])

        again = run_import(context, body)
        assert again.created_count == 0
        line.refresh_from_db()
        assert line.is_internal is False
