"""Label heuristics — **defaults the user can change, never truths**.

The distinction matters more than the patterns. An imported line's
``is_internal`` flag decides whether the money is counted as spending, so getting
it wrong silently doubles or hides a real amount. That is why nothing here is
applied as a fact:

- the guess is written at import time as a **starting value**;
- the user can flip it from the journal (``qualify``), and their choice is never
  re-guessed on a later import — the line already exists, and imports are
  idempotent;
- an internal movement without a counterpart is an écart the control reports, so a
  wrong guess surfaces instead of hiding.

Deliberately small. A pattern list that tries to be clever ends up mislabelling
the one line a year that matters, and there is no way for the user to know it
happened. Matching is done on ``label_norm`` (upper-cased, accent-stripped by
``importers.parsing.normalize_label``), so the patterns are written that way too.
"""
from __future__ import annotations

#: An ATM withdrawal is the archetype: money leaves the account but is not spent —
#: it is spent later, as cash. Counting it as spending would double it.
INTERNAL_OUTFLOW_PATTERNS = (
    "RETRAIT DAB",
    "RETRAIT ESPECES",
    "RETRAIT AU DISTRIBUTEUR",
    "VIREMENT INTERNE",
    "VIR INTERNE",
    "VERS COMPTE",
)

#: On the inflow side the household's own transfer arriving back.
INTERNAL_INFLOW_PATTERNS = (
    "VIREMENT INTERNE",
    "VIR INTERNE",
    "DE COMPTE",
)


def guess_internal(label_norm: str, *, amount) -> bool:
    """Best guess at whether a line is money changing pocket rather than spending.

    Never authoritative — see the module docstring. Returns ``False`` on anything
    it does not recognise, which is the safe default: an unflagged internal
    movement shows up as an unallocated outflow the user is asked about, whereas a
    wrongly flagged real expense would silently vanish from the spending totals.
    """
    label = (label_norm or "").upper()
    patterns = INTERNAL_OUTFLOW_PATTERNS if amount < 0 else INTERNAL_INFLOW_PATTERNS
    return any(pattern in label for pattern in patterns)


#: Receipt patterns → nature. Same rule: a starting value, not a verdict.
INFLOW_NATURE_PATTERNS = (
    ("salary", ("SALAIRE", "PAIE", "TRAITEMENT", "REMUNERATION")),
    ("refund", ("REMBOURSEMENT", "RBT", "REMB ", "AVOIR")),
    ("transfer", ("VIREMENT INTERNE", "VIR INTERNE", "DE COMPTE")),
)


def guess_inflow_nature(label_norm: str) -> str:
    """Best guess at what a receipt is. ``""`` when unrecognised.

    Returning empty rather than ``other`` is deliberate: ``other`` is a **choice**
    the user made ("this receipt has no category that matters"), while empty means
    "nobody has looked at this yet" — which is exactly the écart the control
    reports. Collapsing the two would make the unclassified-receipt detector blind.
    """
    label = (label_norm or "").upper()
    for nature, patterns in INFLOW_NATURE_PATTERNS:
        if any(pattern in label for pattern in patterns):
            return nature
    return ""
