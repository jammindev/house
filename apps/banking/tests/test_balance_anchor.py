# banking/tests/test_balance_anchor.py
"""Retrouver le solde d'ouverture (parcours 26, lot 8).

Le problème réel : le solde dérivé exige un solde à une date **passée**, alors
qu'une appli bancaire ne montre que celui d'**aujourd'hui**, et que l'export
Crédit Agricole ne porte aucune colonne solde. L'utilisateur ne peut donc pas
fournir la seule information que le modèle réclame — d'où des comptes ouverts
« aujourd'hui », fenêtre de conformité vide, contrôle muet.

Ce que ces tests verrouillent :

- **la voie sûre d'abord** : si le relevé porte le solde, personne n'atteste rien ;
- **ce que House peut réfuter, il le réfute** : un solde lu avant des lignes qu'on
  détient déjà, une période jamais importée dans l'intervalle ;
- **ce que seul l'utilisateur peut attester est conservé**, et re-vérifié pour
  toujours : le jour où une semaine oubliée est importée au milieu de
  l'intervalle, l'arithmétique ne ferme plus et le détecteur le dit — au lieu de
  laisser tous les soldes du compte faux d'une constante que rien ne rattraperait
  sur un fichier sans colonne solde.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from banking.anchoring import (
    FROM_ATTESTATION,
    FROM_STATEMENT,
    NO_SOURCE,
    AnchorError,
    anchor_context,
    attestation_drift,
    opening_from_attestation,
)
from banking.balances import compute_balance
from banking.compliance import get_detector, open_findings, summary
from banking.dedup import compute_dedup_hash
from banking.detectors import ACCOUNT_ANCHOR_STALE
from banking.models import (
    BankTransaction,
    ImportStatus,
    StatementImport,
    TransactionDirection,
)
from banking.services import apply_statement_opening_balance, set_balance_anchor

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()

TODAY = date(2026, 7, 26)


def make_txn(account, *, booked_on, amount, label="CB TEST", balance_after=None):
    value = Decimal(amount)
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=booked_on,
        label_raw=label,
        label_norm=label.upper(),
        amount=value,
        direction=TransactionDirection.OUT if value < 0 else TransactionDirection.IN,
        balance_after=Decimal(balance_after) if balance_after is not None else None,
        dedup_hash=compute_dedup_hash(
            account_id=account.id,
            booked_on=booked_on,
            label_norm=label.upper(),
            amount=value,
            currency="EUR",
            discriminant=f"#{next(_counter)}",
        ),
    )


def make_import(account, *, start, end):
    return StatementImport.objects.create(
        household=account.household,
        account=account,
        provider="generic_csv",
        filename="releve.csv",
        status=ImportStatus.COMPLETED,
        period_start=start,
        period_end=end,
    )


@pytest.fixture
def ctx(db):
    """Un compte façon Crédit Agricole : des lignes, aucune colonne solde."""
    household = HouseholdFactory()
    account = BankAccountFactory(household=household, name="Compte joint")
    make_txn(account, booked_on=date(2026, 6, 1), amount="-100.00", label="PICARD")
    make_txn(account, booked_on=date(2026, 6, 15), amount="+2000.00", label="SALAIRE")
    make_txn(account, booked_on=date(2026, 7, 25), amount="-30.00", label="GRAND FRAIS")
    return household, UserFactory(), account


@pytest.mark.django_db
class TestStatementPath:
    """Quand la banque exporte le solde, on ne demande rien à personne."""

    def test_the_opening_balance_is_read_off_the_statement(self, db):
        account = BankAccountFactory(household=HouseholdFactory())
        # Après la ligne de -100, la banque imprime 900 → il y avait 1000 avant.
        make_txn(account, booked_on=date(2026, 6, 1), amount="-100.00", balance_after="900.00")
        make_txn(account, booked_on=date(2026, 6, 2), amount="-50.00", balance_after="850.00")

        context = anchor_context(account)

        assert context.source == FROM_STATEMENT
        assert context.proposed_opening_balance == Decimal("1000.00")
        assert context.proposed_opening_date == date(2026, 6, 1)

    def test_it_undoes_every_line_up_to_the_first_anchored_one(self, db):
        """Le premier solde imprimé peut arriver après quelques lignes muettes."""
        account = BankAccountFactory(household=HouseholdFactory())
        make_txn(account, booked_on=date(2026, 6, 1), amount="-100.00")
        make_txn(account, booked_on=date(2026, 6, 2), amount="-50.00", balance_after="850.00")

        assert anchor_context(account).proposed_opening_balance == Decimal("1000.00")

    def test_applying_it_makes_the_computed_balance_match_the_bank(self, db):
        household = HouseholdFactory()
        account = BankAccountFactory(household=household)
        make_txn(account, booked_on=date(2026, 6, 1), amount="-100.00", balance_after="900.00")
        make_txn(account, booked_on=date(2026, 6, 2), amount="-50.00", balance_after="850.00")

        apply_statement_opening_balance(account=account, user=UserFactory())

        account.refresh_from_db()
        assert account.opening_balance == Decimal("1000.00")
        assert account.opening_balance_date == date(2026, 6, 1)
        # Et rien n'est attesté : il n'y avait rien à croire sur parole.
        assert account.attested_balance is None
        assert account.attested_on is None

    def test_a_file_without_balances_offers_the_attestation_path(self, ctx):
        _, _, account = ctx
        context = anchor_context(account)

        assert context.source == FROM_ATTESTATION
        assert context.proposed_opening_balance is None
        assert context.last_operation.booked_on == date(2026, 7, 25)
        assert context.last_operation.label == "GRAND FRAIS"

    def test_an_empty_account_has_nothing_to_reconstruct_from(self, db):
        account = BankAccountFactory(household=HouseholdFactory())
        context = anchor_context(account)

        assert context.source == NO_SOURCE
        assert context.transaction_count == 0
        assert context.last_operation is None


@pytest.mark.django_db
class TestAttestationPath:
    """Le solde du jour, moins les mouvements, donne le solde d'ouverture."""

    def test_it_walks_the_movements_back(self, ctx):
        _, _, account = ctx
        # Net des trois lignes : -100 + 2000 - 30 = +1870.
        opening, movements = opening_from_attestation(
            account,
            balance=Decimal("3000.00"),
            as_of=TODAY,
            from_date=date(2026, 6, 1),
            today=TODAY,
        )

        assert movements == Decimal("1870.00")
        assert opening == Decimal("1130.00")

    def test_the_computed_balance_then_matches_what_was_attested(self, ctx):
        _, user, account = ctx
        set_balance_anchor(
            account=account,
            user=user,
            balance=Decimal("3000.00"),
            as_of=TODAY,
            from_date=date(2026, 6, 1),
            today=TODAY,
        )

        account.refresh_from_db()
        result = compute_balance(account=account, as_of=TODAY)
        assert result.amount == Decimal("3000.00")
        assert result.is_reliable is True

    def test_it_fixes_the_window_that_was_hiding_everything(self, ctx):
        """Le vrai symptôme : une date d'ouverture postérieure aux lignes.

        C'est ce qui a produit un contrôle entièrement muet en prod. Reconstruire
        recule la date jusqu'à la plus ancienne ligne — la fenêtre redevient
        évaluable.
        """
        from banking.coverage import OPENING_DATE_AFTER_DATA, WINDOW_OK, window_status

        _, user, account = ctx
        account.opening_balance_date = TODAY
        account.save(update_fields=["opening_balance_date"])
        assert window_status(account)[0] == OPENING_DATE_AFTER_DATA

        set_balance_anchor(
            account=account,
            user=user,
            balance=Decimal("3000.00"),
            as_of=TODAY,
            from_date=date(2026, 6, 1),
            today=TODAY,
        )

        account.refresh_from_db()
        reason, window = window_status(account)
        assert reason == WINDOW_OK
        assert window.start == date(2026, 6, 1)

    def test_an_overdraft_is_a_balance_like_any_other(self, ctx):
        _, _, account = ctx
        opening, _ = opening_from_attestation(
            account,
            balance=Decimal("-200.00"),
            as_of=TODAY,
            from_date=date(2026, 6, 1),
            today=TODAY,
        )
        assert opening == Decimal("-2070.00")

    def test_a_later_start_date_only_counts_the_movements_after_it(self, ctx):
        """Ne contrôler qu'à partir de juillet reste arithmétiquement exact."""
        _, _, account = ctx
        opening, movements = opening_from_attestation(
            account,
            balance=Decimal("3000.00"),
            as_of=TODAY,
            from_date=date(2026, 7, 1),
            today=TODAY,
        )

        assert movements == Decimal("-30.00")
        assert opening == Decimal("3030.00")


@pytest.mark.django_db
class TestWhatHouseRefuses:
    """Ce qu'on peut réfuter, on le réfute — le reste, on le fait attester."""

    def test_a_balance_read_before_lines_we_hold(self, ctx):
        """Sinon les opérations postérieures seraient comptées deux fois."""
        _, _, account = ctx
        with pytest.raises(AnchorError) as excinfo:
            opening_from_attestation(
                account,
                balance=Decimal("3000.00"),
                as_of=date(2026, 7, 1),
                from_date=date(2026, 6, 1),
                today=TODAY,
            )
        assert excinfo.value.code == "as_of_before_last_line"
        assert excinfo.value.detail["latest_line"] == "2026-07-25"

    def test_a_balance_read_in_the_future(self, ctx):
        _, _, account = ctx
        with pytest.raises(AnchorError) as excinfo:
            opening_from_attestation(
                account,
                balance=Decimal("3000.00"),
                as_of=date(2026, 8, 1),
                from_date=date(2026, 6, 1),
                today=TODAY,
            )
        assert excinfo.value.code == "as_of_in_future"

    def test_a_period_nobody_imported_inside_the_interval(self, ctx):
        """La soustraction serait courte d'un montant inconnu, à jamais invisible."""
        _, _, account = ctx
        make_import(account, start=date(2026, 6, 1), end=date(2026, 6, 30))
        make_import(account, start=date(2026, 7, 20), end=date(2026, 7, 25))

        with pytest.raises(AnchorError) as excinfo:
            opening_from_attestation(
                account,
                balance=Decimal("3000.00"),
                as_of=TODAY,
                from_date=date(2026, 6, 1),
                today=TODAY,
            )
        assert excinfo.value.code == "period_gap"
        assert excinfo.value.detail["gaps"][0]["gap_start"] == "2026-07-01"

    def test_but_a_hole_outside_the_interval_does_not_block(self, ctx):
        """Un février manquant ne dit rien d'un solde reconstruit sur juin–juillet.

        Refuser pour lui, ce serait l'écart irrésoluble que la fenêtre de
        conformité existe pour éviter.
        """
        _, _, account = ctx
        make_import(account, start=date(2026, 1, 1), end=date(2026, 1, 31))
        make_import(account, start=date(2026, 6, 1), end=date(2026, 7, 25))

        opening, _ = opening_from_attestation(
            account,
            balance=Decimal("3000.00"),
            as_of=TODAY,
            from_date=date(2026, 6, 1),
            today=TODAY,
        )
        assert opening == Decimal("1130.00")

    def test_an_account_without_a_line(self, db):
        account = BankAccountFactory(household=HouseholdFactory())
        with pytest.raises(AnchorError) as excinfo:
            opening_from_attestation(
                account,
                balance=Decimal("10.00"),
                as_of=TODAY,
                from_date=date(2026, 6, 1),
                today=TODAY,
            )
        assert excinfo.value.code == "no_transactions"

    def test_the_service_turns_a_refusal_into_a_400_carrying_its_code(self, ctx):
        _, user, account = ctx
        with pytest.raises(ValidationError) as excinfo:
            set_balance_anchor(
                account=account,
                user=user,
                balance=Decimal("3000.00"),
                as_of=date(2026, 8, 1),
                from_date=date(2026, 6, 1),
                today=TODAY,
            )
        assert excinfo.value.detail["code"] == "as_of_in_future"

    def test_a_statement_without_balances_cannot_use_the_sure_path(self, ctx):
        _, user, account = ctx
        with pytest.raises(ValidationError) as excinfo:
            apply_statement_opening_balance(account=account, user=user)
        assert excinfo.value.detail["code"] == "no_statement_balance"


@pytest.mark.django_db
class TestTheAttestationStaysVerified:
    """La raison d'être du stockage : re-vérifier, pas faire confiance."""

    def _anchor(self, account, user):
        return set_balance_anchor(
            account=account,
            user=user,
            balance=Decimal("3000.00"),
            as_of=TODAY,
            from_date=date(2026, 6, 1),
            today=TODAY,
        )

    def test_no_drift_the_moment_it_is_recorded(self, ctx):
        _, user, account = ctx
        self._anchor(account, user)
        account.refresh_from_db()

        assert attestation_drift(account) == Decimal("0.00")

    def test_a_forgotten_week_imported_later_makes_it_drift(self, ctx):
        household, user, account = ctx
        self._anchor(account, user)
        account.refresh_from_db()

        make_txn(account, booked_on=date(2026, 7, 10), amount="-500.00", label="OUBLI")

        assert attestation_drift(account) == Decimal("-500.00")
        assert get_detector(ACCOUNT_ANCHOR_STALE).count(household) == 1

    def test_the_finding_shows_both_figures(self, ctx):
        household, user, account = ctx
        self._anchor(account, user)
        account.refresh_from_db()
        make_txn(account, booked_on=date(2026, 7, 10), amount="-500.00", label="OUBLI")

        finding = open_findings(household, get_detector(ACCOUNT_ANCHOR_STALE))[0]

        assert finding.detail["attested_balance"] == "3000.00"
        assert finding.detail["computed_balance"] == "2500.00"
        assert finding.detail["drift"] == "-500.00"

    def test_re_attesting_resolves_it(self, ctx):
        household, user, account = ctx
        self._anchor(account, user)
        account.refresh_from_db()
        make_txn(account, booked_on=date(2026, 7, 10), amount="-500.00", label="OUBLI")
        assert get_detector(ACCOUNT_ANCHOR_STALE).count(household) == 1

        # L'utilisateur relit son solde : la ligne oubliée y était déjà.
        set_balance_anchor(
            account=account,
            user=user,
            balance=Decimal("2500.00"),
            as_of=TODAY,
            from_date=date(2026, 6, 1),
            today=TODAY,
        )

        assert get_detector(ACCOUNT_ANCHOR_STALE).count(household) == 0

    def test_a_statement_with_balances_supersedes_the_attestation(self, ctx):
        """Sinon la vieille lecture produirait un écart non arbitrable à vie."""
        household, user, account = ctx
        self._anchor(account, user)
        make_txn(
            account,
            booked_on=date(2026, 7, 25),
            amount="-40.00",
            label="AVEC SOLDE",
            balance_after="2460.00",
        )

        apply_statement_opening_balance(account=account, user=user)

        account.refresh_from_db()
        assert account.attested_on is None
        assert get_detector(ACCOUNT_ANCHOR_STALE).count(household) == 0

    def test_an_account_that_never_attested_is_never_flagged(self, ctx):
        household, _, account = ctx
        account.opening_balance_date = date(2026, 6, 1)
        account.save(update_fields=["opening_balance_date"])

        assert get_detector(ACCOUNT_ANCHOR_STALE).count(household) == 0

    def test_the_contradiction_cannot_be_waived(self, ctx):
        """Un solde attesté que l'arithmétique contredit n'est pas un choix.

        Il manque un relevé, ou la lecture était fausse. Accepter la contradiction
        laisserait tous les soldes du compte faux de la dérive.
        """
        household, user, account = ctx
        self._anchor(account, user)
        account.refresh_from_db()
        make_txn(account, booked_on=date(2026, 7, 10), amount="-500.00", label="OUBLI")

        group = next(g for g in summary(household) if g.spec.kind == ACCOUNT_ANCHOR_STALE)
        assert group.spec.waivable is False
