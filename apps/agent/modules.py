"""
Module gating for the agent registries (parcours 15).

Households can disable optional modules (``Household.disabled_modules``). Specs
declare which module they belong to (``spec.module``, None = core); these
helpers are the single place where "is this spec visible for this household?"
is answered. Retrieval and the generic tools call them — the per-app code only
declares the key.
"""
from __future__ import annotations

from uuid import UUID


def disabled_modules_for(household_id: UUID) -> frozenset[str]:
    """The household's disabled module keys (empty set = everything active)."""
    from households.models import Household

    row = (
        Household.objects.filter(pk=household_id)
        .values_list('disabled_modules', flat=True)
        .first()
    )
    return frozenset(row or [])


def spec_disabled(spec, disabled: frozenset[str]) -> bool:
    """True when the spec belongs to a module the household disabled."""
    module = getattr(spec, 'module', None)
    return bool(module) and module in disabled
