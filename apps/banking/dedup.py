"""Deduplication of statement lines — the guarantee that re-importing is free.

A bank CSV has no primary key. Two coffees at 3.50 € on the same day at the same
place produce two rigorously identical lines, and yet we must tell "the same line
re-imported" (skip) from "two real identical operations" (create both).

The answer is a **stable natural key** hashed into ``BankTransaction.dedup_hash``,
paired with ``UniqueConstraint(account, dedup_hash)``. Full rationale and the
alternatives considered: ``docs/fiches/IMPORT_ET_RAPPROCHEMENT.md`` §3.2.
"""
from __future__ import annotations

import hashlib
from collections import defaultdict
from decimal import Decimal

from .importers.base import NormalizedTransaction
from .importers.parsing import normalize_label

#: Bumping this invalidates every stored hash on purpose — it must be paired with
#: an explicit recompute command, never with a silent data migration.
HASH_RECIPE_VERSION = "v1"


def _natural_key(row: NormalizedTransaction) -> tuple:
    return (
        row.booked_on.isoformat(),
        normalize_label(row.label_raw),
        f"{row.amount:.2f}",
        row.currency,
    )


def assign_discriminants(rows: list[NormalizedTransaction]) -> list[str]:
    """One discriminant per row, disambiguating identical natural keys.

    By decreasing quality:

    1. ``external_id`` — a bank-provided reference is a perfect discriminant.
    2. ``balance_after`` — two identical operations on the same day necessarily
       leave *different* running balances. This is the trick that solves the
       hard case, and most French exports carry the column.
    3. The **in-file occurrence index** as a last resort.

    That last one must be counted *within the file*, never against the database.
    Counting rows already stored would shift the index on a re-import (``#2``,
    ``#3``…), producing new hashes and duplicating everything — destroying the
    very property this module exists for.

    Known limitation, documented rather than hidden: a later *partial* export
    containing only the 3rd occurrence of an identical line would give it index
    ``#0`` and be skipped as a duplicate. It disappears as soon as the file
    carries a balance or a reference, and ``StatementImport.skipped_count`` is
    what makes the anomaly visible.
    """
    occurrences: dict[tuple, int] = defaultdict(int)
    discriminants: list[str] = []

    for row in rows:
        if row.external_id:
            discriminants.append(f"id:{row.external_id}")
            continue
        if row.balance_after is not None:
            discriminants.append(f"bal:{row.balance_after:.2f}")
            continue
        key = _natural_key(row)
        discriminants.append(f"#{occurrences[key]}")
        occurrences[key] += 1

    return discriminants


def compute_dedup_hash(
    *,
    account_id,
    booked_on,
    label_norm: str,
    amount: Decimal,
    currency: str,
    discriminant: str,
) -> str:
    """Hash the natural key. Computed by the service — never by an adapter.

    An adapter doesn't know the account, and the account is part of the key: the
    same statement imported onto two different accounts must yield two different
    hashes.
    """
    payload = "|".join(
        [
            HASH_RECIPE_VERSION,
            str(account_id),
            booked_on.isoformat(),
            label_norm,
            f"{amount:.2f}",
            currency,
            discriminant,
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
