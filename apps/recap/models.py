"""
Household monthly recap — the frozen snapshot (parcours 27 lot 1).

Deliberate decalque of ``budget.models.BudgetReport``: one immutable snapshot per
(household, month). The concept is explained in ``docs/fiches/SNAPSHOT_ET_RECIT.md``
— what is *true* is frozen once at month close, what is *said* is derived at read
time in the reader's language.
"""
from __future__ import annotations

import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class HouseholdRecap(HouseholdScopedModel):
    """A frozen, language-agnostic snapshot of one closed month for a household.

    ``stats`` holds numbers, ``str(Decimal)`` amounts, technical keys and
    user-authored proper nouns — **never a word of language**. The prose is
    rendered from it at read time (``recap.render``), optionally rewritten by the
    LLM and memoized per language under ``stats['_polished']``.

    Two consequences that must survive every future change:

    - the snapshot is **never recomputed** — a later edit to an expense or a task
      does not rewrite a closed month;
    - ``stats`` is a **public format**: keys are added, never renamed, and the
      renderer tolerates an unknown chapter or card kind forever.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    month = models.CharField(max_length=7, help_text="Reported period, 'YYYY-MM'.")
    stats = models.JSONField(default=dict, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "household_recaps"
        verbose_name = _("household recap")
        verbose_name_plural = _("household recaps")
        ordering = ["-month"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "month"],
                name="unique_recap_per_month",
            ),
        ]

    def __str__(self):
        return f"Recap {self.month}"

    @property
    def card_count(self) -> int:
        """Number of cards in the frozen snapshot (0 on a legacy/empty payload)."""
        return int((self.stats or {}).get("card_count") or 0)
