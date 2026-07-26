# banking/tests/test_dedup.py
"""Deduplication — the guarantee that re-importing a statement is free.

The hard case a bank CSV gives us: two rigorously identical lines on the same
day. They must both be created on first import, and neither must be duplicated
on the second. See ``docs/fiches/IMPORT_ET_RAPPROCHEMENT.md`` §3.2.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from banking.dedup import assign_discriminants, compute_dedup_hash
from banking.importers.base import NormalizedTransaction


def txn(**overrides) -> NormalizedTransaction:
    defaults = {
        "booked_on": date(2026, 7, 12),
        "label_raw": "CB LECLERC",
        "amount": Decimal("-32.50"),
        "currency": "EUR",
    }
    defaults.update(overrides)
    return NormalizedTransaction(**defaults)


class TestAssignDiscriminants:
    def test_identical_lines_get_distinct_indexes(self):
        assert assign_discriminants([txn(), txn(), txn()]) == ["#0", "#1", "#2"]

    def test_different_lines_all_start_at_zero(self):
        rows = [txn(), txn(amount=Decimal("-10.00")), txn(label_raw="AUTRE")]
        assert assign_discriminants(rows) == ["#0", "#0", "#0"]

    def test_balance_wins_over_the_index(self):
        """Two identical operations necessarily leave different balances."""
        rows = [
            txn(balance_after=Decimal("100.00")),
            txn(balance_after=Decimal("67.50")),
        ]
        assert assign_discriminants(rows) == ["bal:100.00", "bal:67.50"]

    def test_external_id_wins_over_everything(self):
        rows = [txn(external_id="OP123", balance_after=Decimal("100.00"))]
        assert assign_discriminants(rows) == ["id:OP123"]

    def test_mixed_rows_fall_back_independently(self):
        rows = [txn(balance_after=Decimal("100.00")), txn(), txn()]
        assert assign_discriminants(rows) == ["bal:100.00", "#0", "#1"]

    def test_is_deterministic_across_runs(self):
        """Same file in, same discriminants out — the basis of idempotence."""
        rows = [txn(), txn(), txn(label_raw="AUTRE")]
        assert assign_discriminants(rows) == assign_discriminants(rows)

    def test_label_normalisation_groups_cosmetic_variants(self):
        """`CB Leclerc` and `CB  LECLERC ` are the same line to the counter."""
        rows = [txn(label_raw="CB Leclerc"), txn(label_raw="CB  LECLERC ")]
        assert assign_discriminants(rows) == ["#0", "#1"]


class TestComputeDedupHash:
    def _hash(self, **overrides):
        payload = {
            "account_id": uuid.UUID(int=1),
            "booked_on": date(2026, 7, 12),
            "label_norm": "CB LECLERC",
            "amount": Decimal("-32.50"),
            "currency": "EUR",
            "discriminant": "#0",
        }
        payload.update(overrides)
        return compute_dedup_hash(**payload)

    def test_is_stable(self):
        assert self._hash() == self._hash()

    def test_is_a_sha256_hexdigest(self):
        digest = self._hash()
        assert len(digest) == 64
        assert all(c in "0123456789abcdef" for c in digest)

    def test_account_is_part_of_the_key(self):
        """The same statement on two accounts must not collide."""
        assert self._hash() != self._hash(account_id=uuid.UUID(int=2))

    def test_every_component_changes_the_hash(self):
        base = self._hash()
        assert base != self._hash(booked_on=date(2026, 7, 13))
        assert base != self._hash(label_norm="AUTRE")
        assert base != self._hash(amount=Decimal("-32.51"))
        assert base != self._hash(currency="USD")
        assert base != self._hash(discriminant="#1")

    def test_amount_is_normalised_to_two_decimals(self):
        """`-32.5` and `-32.50` are the same amount, hence the same line."""
        assert self._hash(amount=Decimal("-32.5")) == self._hash(amount=Decimal("-32.50"))
