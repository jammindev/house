"""Expense discriminators — the one place the ``kind`` strings are named.

``Interaction.kind`` is stringly-typed by design (see CLAUDE.md « Interaction vs
modèle dédié »): it carries no DB constraint, so a typo silently creates a new
category nobody ever queries. This module is the cheap mitigation the
cartography asked for (dette ⑤): import the constant instead of retyping the
literal, and a rename becomes one edit plus the type checker.

Adding a kind here does **not** make it valid on its own — a source-linked
purchase also needs its subject template in
``interactions.services.AUTO_SUBJECT_TEMPLATES``.
"""
from __future__ import annotations

#: Purchases attached to a domain object through the polymorphic source FK.
KIND_STOCK_PURCHASE = "stock_purchase"
KIND_EQUIPMENT_PURCHASE = "equipment_purchase"
KIND_PROJECT_PURCHASE = "project_purchase"
KIND_CHICKENS_PURCHASE = "chickens_purchase"

#: Ad-hoc expense typed by the user, with no source object.
KIND_MANUAL = "manual"

#: Materialized occurrence of a ``budget.RecurringExpense``.
KIND_RECURRING = "recurring"

#: Expense born from a bank statement line (parcours 25 lot 5). Carries no
#: source object: the bank line is its justification, not its subject.
KIND_BANK = "bank"

EXPENSE_KINDS = frozenset(
    {
        KIND_STOCK_PURCHASE,
        KIND_EQUIPMENT_PURCHASE,
        KIND_PROJECT_PURCHASE,
        KIND_CHICKENS_PURCHASE,
        KIND_MANUAL,
        KIND_RECURRING,
        KIND_BANK,
    }
)

#: Kinds whose rows the allocation editor may delete outright, because it is
#: what created them. Everything else is merely detached from its bank line —
#: an expense that predates the statement is a fact of its own and survives.
OWNED_BY_ALLOCATION_EDITOR = frozenset({KIND_BANK})
