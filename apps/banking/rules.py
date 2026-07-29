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


#: Payment plumbing that precedes the merchant in a statement label. Removed word
#: by word from the front, so ``PAIEMENT CB DECATHLON`` and ``CB DECATHLON`` land
#: on the same answer without needing an entry each.
PAYMENT_NOISE_WORDS = frozenset({
    "ACHAT",
    "ACHATS",
    "BANCAIRE",
    "CARTE",
    "CB",
    "DEBIT",
    "FACTURE",
    "PAIEMENT",
    "PAIEMENTS",
    "PRELEVEMENT",
    "PRLV",
    "SEPA",
    "VIR",
    "VIREMENT",
})


def guess_supplier(label_norm: str) -> str:
    """Best guess at the merchant a statement line paid. ``""`` when unsure.

    A **starting value**, like everything else in this module: the client shows it
    in the allocation dialog, where it is read and corrected before anything is
    saved. Nothing here writes it — see
    ``banking.services.set_allocations``, which stores exactly what the client
    sent and leaves ``supplier`` empty when the client sent nothing.

    Why derive it at all: the label already names the merchant (``CB LEROY MERLIN
    12/07``), so asking the user to retype it is asking for information House can
    compute. Why derive it only as a suggestion: a supplier applied silently would
    end up in the filter chips and in ``by_supplier`` as a fact nobody checked,
    and ``matching`` compares it as a substring of the very label it came from —
    a wrong guess would look self-confirming.

    Deliberately dumb, for the reason the module docstring gives: a clever
    pattern list mislabels the one line a year that matters. It strips the payment
    plumbing, drops references and dates, and keeps what is left. The real
    normalisation happens elsewhere and for free — the client prefers a spelling
    the household already uses whenever one matches, so choosing beats typing and
    the values converge on their own.
    """
    label = (label_norm or "").upper()

    # An ATM withdrawal or an internal transfer has no merchant at all: the money
    # has not been spent yet. Proposing "Retrait Dab" would be a wrong entry
    # dressed up as a service.
    if any(p in label for p in INTERNAL_OUTFLOW_PATTERNS + INTERNAL_INFLOW_PATTERNS):
        return ""

    words = [w for w in label.split() if w]
    # Only from the front: a word that looks like plumbing *inside* a name
    # (``CARTE BLANCHE SARL``) is part of the name.
    while words and words[0] in PAYMENT_NOISE_WORDS:
        words.pop(0)

    kept = [
        word
        for word in words
        # A reference (``123456``) or a date (``12/07``) tells two lines apart —
        # it says nothing about who was paid.
        if not word.isdigit() and "/" not in word
    ][:5]

    if not kept or len("".join(kept)) < 2:
        return ""

    # A three- or four-letter word is nearly always an acronym, and ``Edf`` is a
    # word nobody writes. Longer words get title case, because a supplier lives in
    # sentences ("dépense chez Leroy Merlin"), not in a bank's upper-case export.
    return " ".join(word if len(word) <= 4 else word.title() for word in kept)
