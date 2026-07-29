"""La fiche d'un budget — le chiffre, son mois d'avant, sa forme, ses destinataires.

La page d'une enveloppe savait dire « 340 € ce mois-ci » et rien de plus. Ce
chiffre seul ne répond à aucune des trois questions qu'on se pose devant lui :
est-ce beaucoup, où est-ce parti, est-ce que ça monte. Il fallait ouvrir la page
Analyse, refaire le filtre à la main, et espérer retomber sur le même total.

Trois principes, tous hérités de règles déjà écrites ailleurs :

- **Les totaux ne sont pas recalculés ici.** ``compute_expense_summary`` est déjà
  la définition du « dépensé » d'une enveloppe sur une période — la carte du haut
  de la page la lit. En redériver une seconde donnerait au même compteur deux
  définitions, la faute que le module argent passe son temps à réparer.
- **Ce qui se décompose, c'est le brut.** ``total`` est ce que les barres et les
  parts recomposent ; ``net_total`` (remboursements déduits) est le chiffre de
  tête. Un remboursement est daté par la banque, la dépense par le foyer : le
  retrancher d'un jour du graphique daterait le rendu au jour de l'achat.
- **On n'invente jamais une comparaison.** Une part sur un total nul et un
  pourcentage sur une période précédente à zéro sont le même mensonge : le
  premier vaut « pas de répartition », le second ``None``. C'est au front de
  dire « pas de comparaison possible », pas à nous de choisir un nombre.

Coût : quatre requêtes groupées par période, quelle que soit sa longueur. Jamais
une requête par jour — c'est la première chose qui dégénère sur une année.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Count, Sum
from django.db.models.functions import Coalesce, TruncDate, TruncMonth

from core.timezones import end_of_day, household_today, household_tz, start_of_day
from interactions.aggregations import compute_expense_summary, expense_qs

ZERO = Decimal("0.00")

#: Au-delà de cette durée, une barre par jour devient un peigne : on passe au
#: mois. Deux mois, c'est la plus longue fenêtre où chaque jour reste visible —
#: et « les 30 derniers jours » y tient largement.
DAILY_MAX_DAYS = 62


def compute_budget_insights(
    *, household, budget: str | None, start: date, end: date, today: date | None = None
) -> dict[str, Any]:
    """Ce qu'une enveloppe a dépensé sur ``[start, end]``, et ce que ça vaut.

    ``budget`` est un id d'enveloppe, ``'none'`` pour le seau « hors budget », ou
    ``None`` pour toutes les dépenses confondues.

    Shape::

        {
          "period": {"from": "2026-07-01", "to": "2026-07-31"},
          "previous_period": {"from": "2026-06-01", "to": "2026-06-30"},
          "current":  {"total", "refunded", "net_total", "count"},
          "previous": {"total", "refunded", "net_total", "count"},
          "delta": {"amount": "50.00", "ratio": 0.5 | None},
          "granularity": "day" | "month",
          "buckets": [{"label": "2026-07-01", "total": "0.00"}, …],
          "suppliers": [{"supplier", "total", "count", "share"}, …],
        }
    """
    if today is None:
        today = household_today(household)
    prev_start, prev_end = previous_period(start, end, today=today)

    current = _totals(household, budget, start, end)
    previous = _totals(household, budget, prev_start, prev_end)

    qs = expense_qs(
        household.id,
        start_of_day(start, household),
        end_of_day(end, household),
        budget=budget,
    )
    granularity = "day" if (end - start).days < DAILY_MAX_DAYS else "month"

    return {
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "previous_period": {"from": prev_start.isoformat(), "to": prev_end.isoformat()},
        "current": current,
        "previous": previous,
        "delta": _delta(current["net_total"], previous["net_total"]),
        "granularity": granularity,
        "buckets": _buckets(qs, household, start, end, granularity),
        "suppliers": _suppliers(qs, Decimal(current["total"])),
    }


def previous_period(start: date, end: date, *, today: date | None = None) -> tuple[date, date]:
    """La période d'avant — de la **même forme**, et **aussi avancée**.

    Deux règles, et chacune répare un mensonge différent.

    *La même forme.* Décaler juillet (31 jours) de sa propre durée donnerait le
    31 mai → 30 juin : un intervalle qui coupe deux mois, chevauche un loyer et
    en rate un autre. Un mois plein se compare donc au mois plein d'avant, une
    année à l'année d'avant ; une fenêtre libre, elle, n'a pas de forme — on lui
    donne la même durée juste avant, sans trou entre les deux.

    *Aussi avancée.* Le 5 juillet, « ce mois-ci » ne vaut pas un mois : c'est
    cinq jours. Le comparer aux trente de juin annoncerait « −87 % » à un foyer
    qui dépense exactement comme d'habitude, et ce chiffre serait faux tous les
    mois, du 1er au 30. Une période **en cours** se compare donc aux mêmes jours
    du mois d'avant, et l'écran affiche la fenêtre retenue (« 1 – 5 juin »)
    plutôt que de laisser croire qu'il compare des mois entiers.
    """
    prev_start, prev_end = _same_shape_before(start, end)
    if today is None or end <= today:
        return prev_start, prev_end
    # Fenêtre en cours : on ne retient d'avant que ce qui est déjà écoulé ici.
    elapsed = max((min(end, today) - start).days + 1, 1)
    return prev_start, min(prev_end, prev_start + timedelta(days=elapsed - 1))


def _same_shape_before(start: date, end: date) -> tuple[date, date]:
    if _is_full_year(start, end):
        return date(start.year - 1, 1, 1), date(start.year - 1, 12, 31)
    if _is_full_month(start, end):
        prev_end = start - timedelta(days=1)
        return prev_end.replace(day=1), prev_end
    span = (end - start).days + 1
    return start - timedelta(days=span), start - timedelta(days=1)


def _is_full_month(start: date, end: date) -> bool:
    return (
        start.day == 1
        and (start.year, start.month) == (end.year, end.month)
        and (end + timedelta(days=1)).month != end.month
    )


def _is_full_year(start: date, end: date) -> bool:
    return (start.month, start.day) == (1, 1) and (end.month, end.day) == (12, 31)


def _totals(household, budget: str | None, start: date, end: date) -> dict[str, Any]:
    """Les quatre chiffres d'une période, tels que la carte du haut les affiche."""
    summary = compute_expense_summary(
        household_id=household.id,
        from_dt=start_of_day(start, household),
        to_dt=end_of_day(end, household),
        budget=budget,
    )
    return {
        "total": summary["total"],
        "refunded": summary["refunded"],
        "net_total": summary["net_total"],
        "count": summary["count"],
    }


def _delta(current_net: str, previous_net: str) -> dict[str, Any]:
    """L'écart en euros, et en part **quand elle existe**.

    Passer de 0 € à 150 € n'est pas « +∞ % » : c'est un premier mois. Renvoyer
    ``None`` laisse le front le dire avec des mots ; renvoyer un nombre l'oblige
    à en afficher un faux.
    """
    current = Decimal(current_net)
    previous = Decimal(previous_net)
    amount = current - previous
    ratio = round(float(amount / previous), 4) if previous > 0 else None
    return {"amount": str(amount), "ratio": ratio}


def _buckets(qs, household, start: date, end: date, granularity: str) -> list[dict[str, str]]:
    """La série de la période, **trous compris**.

    Un jour sans dépense est une information — l'omettre collerait le 3 juillet
    au 9 et ferait d'une accalmie une pente. La grille est donc construite en
    Python, et la requête ne fait que la remplir.
    """
    tz = household_tz(household)
    trunc = TruncDate("occurred_at", tzinfo=tz) if granularity == "day" else TruncMonth(
        "occurred_at", tzinfo=tz
    )
    rows = (
        qs.annotate(bucket=trunc)
        .values("bucket")
        .annotate(total=Coalesce(Sum("amount"), ZERO))
    )
    found: dict[str, Decimal] = {}
    for row in rows:
        bucket = row["bucket"]
        if bucket is None:  # pragma: no cover - occurred_at is never null on an expense
            continue
        label = _label(bucket, granularity)
        found[label] = (found.get(label) or ZERO) + (row["total"] or ZERO)

    return [
        {"label": label, "total": str(found.get(label, ZERO))}
        for label in _grid(start, end, granularity)
    ]


def _label(bucket, granularity: str) -> str:
    if granularity == "day":
        return bucket.isoformat()
    return f"{bucket.year:04d}-{bucket.month:02d}"


def _grid(start: date, end: date, granularity: str) -> list[str]:
    """Toutes les étiquettes de la fenêtre, de la plus ancienne à la plus récente."""
    if granularity == "day":
        return [
            (start + timedelta(days=offset)).isoformat()
            for offset in range((end - start).days + 1)
        ]
    labels: list[str] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        labels.append(f"{year:04d}-{month:02d}")
        month += 1
        if month == 13:
            year, month = year + 1, 1
    return labels


def _suppliers(qs, total: Decimal) -> list[dict[str, Any]]:
    """Chez qui l'argent de l'enveloppe est parti, et pour quelle part.

    Les dépenses **sans** fournisseur restent dans la liste, avec une chaîne
    vide : le palmarès de la page Analyse peut les écarter — c'est un classement
    — mais une *répartition* ne le peut pas. La part manquante n'irait nulle
    part, et l'anneau annoncerait un tout qui ne fait pas cent.
    """
    if total <= 0:
        return []
    rows = (
        qs.values("supplier")
        .annotate(total=Coalesce(Sum("amount"), ZERO), count=Count("id"))
        .order_by("-total")
    )
    return [
        {
            "supplier": row["supplier"] or "",
            "total": str(row["total"] or ZERO),
            "count": row["count"],
            "share": round(float((row["total"] or ZERO) / total), 4),
        }
        for row in rows
    ]
