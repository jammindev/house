"""The compliance registry — every écart the app knows how to detect.

The structuring rule of parcours 26::

    Toute entité est soit résolue, soit flaggée avec un motif.
    Rien ne reste dans un entre-deux silencieux.

This module is what makes that rule *measurable*. It holds no detection logic of
its own: each app registers its detectors from ``apps.py::ready()``, exactly like
``agent.searchables``. Adding a mechanism to the app therefore means adding its
detector here — which is the review rule that keeps the catalogue from falling
behind the code.

Three design points worth keeping:

1. **``count`` is separate from ``findings``.** The shell's badge is refreshed on
   every navigation; it must cost one indexed ``COUNT(*)`` per detector, never a
   full scan materialised into Python. ``findings`` is paginated and only runs for
   the group the user actually opened.

2. **Waivers can expire.** A waiver stores the ``fingerprint`` of what it
   arbitrated. When the underlying figures change the fingerprint no longer
   matches, and the écart comes back marked stale. Without this, "le reste de
   cette ligne ne m'intéresse pas" followed by a re-split would leave money
   covered by a motive that no longer describes anything — the flag would become
   the best place to hide an orphan, the exact opposite of the point.

3. **Some écarts are not waivable at all.** A missing opening balance, a negative
   cash balance, a double confirmation: these are inconsistencies, not
   arbitrations. ``waivable=False`` makes the catalogue's "aucun flag légitime"
   column an enforced 400 rather than a comment.
"""
from __future__ import annotations

import hashlib
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Callable

from django.db.models import Model, QuerySet

#: Severity ladder. ``blocker`` is not "worse", it is *first*: it gates the
#: meaning of other controls (an account with no opening balance has no window,
#: so nothing else about it can be asserted).
BLOCKER = "blocker"
ERROR = "error"
WARNING = "warning"


@dataclass(frozen=True)
class Finding:
    """One écart, on one object.

    ``fingerprint`` is the hash of whatever *founds* the écart — the amount left
    to allocate, the missing balance, … — and it is what lets a waiver expire.
    Anything that would make the user want to re-arbitrate belongs in it; anything
    merely cosmetic must stay out, or every edit would invalidate every waiver.
    """

    kind: str
    object_id: str
    label: str
    fingerprint: str
    detail: dict = field(default_factory=dict)
    #: Filled by the registry, not by detectors: a waived écart whose fingerprint
    #: moved comes back as open, with the original motive shown for context.
    is_stale: bool = False
    waiver_id: str | None = None
    waiver_reason: str = ""


@dataclass(frozen=True)
class DetectorSpec:
    """Declarative description of one detectable écart."""

    kind: str
    """Stable key of the catalogue entry. Also the i18n key on the frontend."""

    severity: str
    """``blocker`` | ``error`` | ``warning``."""

    label: str
    """Short English description — admin and debugging. User-facing wording lives
    in the frontend ``money`` namespace, keyed by ``kind``, so adding a detector
    does not mean touching four ``.po`` files."""

    target: str
    """Entity family the findings point at (``transaction``, ``expense``,
    ``account``, ``recurring``, ``import``) — the UI groups by it."""

    model: type[Model]
    """Model the findings point at. Used to resolve the waiver's ContentType."""

    count: Callable[..., int]
    """``(household) -> int``: how many objects are in écart, waivers ignored.
    Must stay a ``COUNT(*)`` wherever the écart is expressible in SQL."""

    findings: Callable[..., list[Finding]]
    """``(household, *, pks=None, exclude_pks=None, limit=None, offset=None)``.
    ``pks`` restricts to specific objects (used to re-fingerprint the waived ones,
    a bounded set); ``exclude_pks`` drops them before ``LIMIT`` so pagination
    stays honest."""

    waivable: bool = True
    """False when the catalogue says "aucun flag légitime" — the écart must be
    fixed, not arbitrated."""

    blocked_by: str = ""
    """Kind of a prerequisite écart. Purely informative: detectors already skip
    the objects they cannot assert anything about. The UI uses it to explain *why*
    a control does not cover everything yet."""


REGISTRY: list[DetectorSpec] = []


def register(spec: DetectorSpec) -> None:
    """Add a detector. Raises if the kind is already taken."""
    for existing in REGISTRY:
        if existing.kind == spec.kind:
            raise ValueError(f"Compliance detector already registered: {spec.kind}")
    REGISTRY.append(spec)


def get_detector(kind: str) -> DetectorSpec | None:
    for spec in REGISTRY:
        if spec.kind == kind:
            return spec
    return None


def clear_registry() -> None:
    """Test helper — never called by application code."""
    REGISTRY.clear()


def fingerprint_of(*parts: object) -> str:
    """Stable hash of the values that found an écart.

    ``sha256`` rather than ``hash()``: the value is persisted on the waiver and
    compared across processes, where Python's salted hash would differ.
    """
    joined = "|".join("" if p is None else str(p) for p in parts)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def apply_window(qs: QuerySet, *, pks=None, exclude_pks=None, limit=None, offset=None):
    """Shared plumbing for queryset-backed detectors.

    Slicing happens **after** the exclusions so a page of 20 open écarts really
    holds 20 of them, instead of 20-minus-the-waived-ones.
    """
    if pks is not None:
        qs = qs.filter(pk__in=list(pks))
    if exclude_pks:
        qs = qs.exclude(pk__in=list(exclude_pks))
    if offset or limit:
        start = offset or 0
        qs = qs[start : start + limit] if limit else qs[start:]
    return qs


# --- Waiver resolution -------------------------------------------------------


@dataclass(frozen=True)
class GroupResult:
    """One detector's outcome for a household."""

    spec: DetectorSpec
    detected: int
    waived: int
    stale: int

    @property
    def open(self) -> int:
        """Actionable écarts — **including** the stale ones, which are back on the
        user's plate. ``open + waived == detected`` holds by construction."""
        return self.detected - self.waived


def _waivers_by_object(household, spec: DetectorSpec) -> dict[str, object]:
    from django.contrib.contenttypes.models import ContentType

    from .models import ComplianceWaiver

    content_type = ContentType.objects.get_for_model(spec.model)
    return {
        str(w.object_id): w
        for w in ComplianceWaiver.objects.filter(
            household=household, finding_kind=spec.kind, content_type=content_type
        )
    }


def _split_waived(household, spec: DetectorSpec) -> tuple[dict[str, object], dict[str, object]]:
    """Waivers that still cover their écart, split into fresh and stale.

    Only the waived objects are re-fingerprinted — a bounded set (a household has
    dozens of waivers, not thousands), which is what keeps ``summary`` cheap.

    A waiver whose object is no longer in écart appears in neither dict: it covers
    nothing right now. It is kept in the database rather than deleted, so that the
    same situation coming back does not have to be arbitrated twice.
    """
    waivers = _waivers_by_object(household, spec)
    if not waivers:
        return {}, {}

    fresh: dict[str, object] = {}
    stale: dict[str, object] = {}
    for finding in spec.findings(household, pks=list(waivers.keys())):
        waiver = waivers.get(finding.object_id)
        if waiver is None:
            continue
        if waiver.fingerprint == finding.fingerprint:
            fresh[finding.object_id] = waiver
        else:
            stale[finding.object_id] = waiver
    return fresh, stale


def summary(household) -> list[GroupResult]:
    """Counts for every registered detector — what the shell badge reads."""
    results = []
    for spec in REGISTRY:
        fresh, stale = _split_waived(household, spec)
        results.append(
            GroupResult(
                spec=spec,
                detected=spec.count(household),
                waived=len(fresh),
                stale=len(stale),
            )
        )
    return results


def open_findings(household, spec: DetectorSpec, *, limit=None, offset=None) -> list[Finding]:
    """Actionable écarts of one detector, waived ones removed, stale ones marked."""
    fresh, stale = _split_waived(household, spec)
    found = spec.findings(
        household, exclude_pks=list(fresh.keys()), limit=limit, offset=offset
    )
    return [_mark_stale(finding, stale) for finding in found]


def waived_findings(household, spec: DetectorSpec, *, limit=None, offset=None) -> list[Finding]:
    """Arbitrated écarts, for the audit list — each with its motive."""
    fresh, _ = _split_waived(household, spec)
    if not fresh:
        return []
    found = spec.findings(household, pks=list(fresh.keys()), limit=limit, offset=offset)
    return [
        Finding(
            kind=f.kind,
            object_id=f.object_id,
            label=f.label,
            fingerprint=f.fingerprint,
            detail=f.detail,
            waiver_id=str(fresh[f.object_id].id),
            waiver_reason=fresh[f.object_id].reason,
        )
        for f in found
        if f.object_id in fresh
    ]


def _mark_stale(finding: Finding, stale: dict[str, object]) -> Finding:
    waiver = stale.get(finding.object_id)
    if waiver is None:
        return finding
    return Finding(
        kind=finding.kind,
        object_id=finding.object_id,
        label=finding.label,
        fingerprint=finding.fingerprint,
        detail=finding.detail,
        is_stale=True,
        waiver_id=str(waiver.id),
        waiver_reason=waiver.reason,
    )


def serialize_finding(finding: Finding) -> dict:
    return {
        "kind": finding.kind,
        "object_id": finding.object_id,
        "label": finding.label,
        "fingerprint": finding.fingerprint,
        "detail": finding.detail,
        "is_stale": finding.is_stale,
        "waiver_id": finding.waiver_id,
        "waiver_reason": finding.waiver_reason,
    }


def serialize_group(result: GroupResult) -> dict:
    return {
        "kind": result.spec.kind,
        "severity": result.spec.severity,
        "label": result.spec.label,
        "target": result.spec.target,
        "waivable": result.spec.waivable,
        "blocked_by": result.spec.blocked_by,
        "detected": result.detected,
        "open": result.open,
        "waived": result.waived,
        "stale": result.stale,
    }


def serialize_summary(results: Iterable[GroupResult]) -> dict:
    groups = [serialize_group(r) for r in results]
    return {
        "groups": groups,
        "open_total": sum(g["open"] for g in groups),
        "waived_total": sum(g["waived"] for g in groups),
        "stale_total": sum(g["stale"] for g in groups),
    }
