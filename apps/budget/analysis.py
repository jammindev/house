"""
Analyse fine des dépenses par budget — la vue « d'où ça part, et depuis quand ».

Le panneau Budgets répond à une seule question : « est-ce que ce mois-ci tient
dans l'enveloppe ? ». Utile, mais aveugle à tout le reste — une catégorie qui
dérive de 15 % par mois passe inaperçue tant qu'elle ne franchit pas son plafond,
et une catégorie sans plafond (le cas le plus courant depuis que le plafond est
optionnel) n'a *aucun* signal du tout. Ce module fournit la lecture longue.

Trois principes, tous hérités de règles déjà écrites ailleurs :

- **On lit les ``Interaction`` et rien d'autre.** Les totaux bancaires vivent
  dans ``banking.aggregations`` et ne s'additionnent jamais avec ceux-ci — le
  pont entre les deux mondes est le taux de couverture, jamais une somme.
- **Un montant sort en string décimale**, jamais en float : arrondir pour
  l'affichage est le travail du front, pas celui de l'agrégat.
- **Le libellé « hors budget » n'est pas produit ici.** Le backend renvoie
  ``budget_id: null`` ; c'est le namespace i18n du front qui le nomme, sinon
  ajouter une langue imposerait un passage par les ``.po``.

Coût : quatre requêtes groupées, quel que soit le nombre de mois ou de budgets.
Jamais une requête par mois — c'est la première chose qui dégénère sur un
historique de deux ans.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from django.db.models import Count, Sum
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone

from interactions.queries import expenses

from .models import Budget
from .report.stats import _tz, month_bounds

#: Combien de mois la vue couvre par défaut. Douze = une saisonnalité complète
#: (chauffage, vacances, rentrée) sans écraser les barres du dernier trimestre.
DEFAULT_MONTHS = 12
MAX_MONTHS = 36

#: Au-delà, un classement cesse d'être un classement.
TOP_SUPPLIERS = 8
TOP_EXPENSES = 5

ZERO = Decimal("0.00")


def _months_back(end: date, count: int) -> list[str]:
    """Les ``count`` derniers mois en ``YYYY-MM``, du plus ancien au plus récent."""
    year, month = end.year, end.month
    out: list[str] = []
    for _ in range(count):
        out.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(out))


def _decimal_str(value: Decimal | None) -> str:
    return str(value if value is not None else ZERO)


def compute_budget_analysis(
    *, household, months: int = DEFAULT_MONTHS, budget_id=None, today: date | None = None
) -> dict[str, Any]:
    """Séries mensuelles, répartition, fournisseurs et plus grosses dépenses.

    ``budget_id`` restreint **tout** le calcul à une enveloppe : la série, les
    fournisseurs et le classement. La répartition n'a alors plus qu'une ligne —
    le front masque le camembert plutôt que d'afficher un disque plein à 100 %.

    Shape::

        {
          "months": ["2025-08", …, "2026-07"],
          "series": [{budget_id, name, monthly_amount, values: [...], total}, …],
          "breakdown": [{budget_id, name, total, share}, …],
          "suppliers": [{supplier, total, count}, …],
          "biggest": [{id, subject, amount, occurred_at, budget_id, budget_name}, …],
          "total": "…", "monthly_average": "…",
        }
    """
    months = max(1, min(int(months or DEFAULT_MONTHS), MAX_MONTHS))
    tz = _tz(household)
    if today is None:
        today = timezone.now().astimezone(tz).date()

    labels = _months_back(today, months)
    start, _ = month_bounds(household, labels[0])
    _, end = month_bounds(household, labels[-1])

    qs = expenses(household_id=household.id).filter(
        occurred_at__gte=start, occurred_at__lt=end
    )
    if budget_id is not None:
        qs = qs.filter(budget_id=budget_id)

    grid = _monthly_grid(qs, labels, tz)
    budgets = {
        str(b.id): b for b in Budget.objects.filter(household_id=household.id, is_global=False)
    }

    series = _build_series(grid, labels, budgets)
    total = sum((row["_total"] for row in series), ZERO)

    return {
        "months": labels,
        "series": [
            {
                "budget_id": row["budget_id"],
                "name": row["name"],
                "monthly_amount": row["monthly_amount"],
                "values": [_decimal_str(v) for v in row["values"]],
                "total": _decimal_str(row["_total"]),
            }
            for row in series
        ],
        "breakdown": [
            {
                "budget_id": row["budget_id"],
                "name": row["name"],
                "total": _decimal_str(row["_total"]),
                # Une part sur un total nul serait une division par zéro déguisée
                # en « 0 % » : sans dépense il n'y a pas de répartition du tout.
                "share": round(float(row["_total"] / total), 4) if total > 0 else 0.0,
            }
            for row in sorted(series, key=lambda r: r["_total"], reverse=True)
            if row["_total"] > 0
        ],
        "suppliers": _top_suppliers(qs),
        "biggest": _biggest(qs, budgets),
        "total": _decimal_str(total),
        # Moyenne sur la fenêtre demandée, pas sur les mois non vides : un mois à
        # zéro est une information, l'écarter gonflerait la moyenne.
        "monthly_average": _decimal_str(
            (total / months).quantize(Decimal("0.01")) if months else ZERO
        ),
    }


def _monthly_grid(qs, labels: list[str], tz) -> dict[tuple[str | None, str], Decimal]:
    """``{(budget_id, 'YYYY-MM'): total}`` en **une** requête groupée."""
    rows = (
        qs.annotate(bucket=TruncMonth("occurred_at", tzinfo=tz))
        .values("bucket", "budget_id")
        .annotate(total=Coalesce(Sum("amount"), Decimal("0.00")))
    )
    known = set(labels)
    grid: dict[tuple[str | None, str], Decimal] = {}
    for row in rows:
        bucket = row["bucket"]
        if bucket is None:
            continue
        label = f"{bucket.year:04d}-{bucket.month:02d}"
        if label not in known:  # pragma: no cover - the filter already bounds it
            continue
        key = (str(row["budget_id"]) if row["budget_id"] else None, label)
        grid[key] = (grid.get(key) or ZERO) + (row["total"] or ZERO)
    return grid


def _build_series(grid, labels: list[str], budgets: dict[str, Budget]) -> list[dict[str, Any]]:
    """Une ligne par budget **qui a dépensé**, plus « hors budget » s'il existe.

    Un budget sans une seule dépense sur la fenêtre n'entre pas dans la légende :
    douze entrées mortes rendraient le graphique illisible pour cacher
    l'information qu'aucune n'a servi — que le panneau Budgets dit déjà.
    """
    seen: list[str | None] = []
    for bid, _label in grid:
        if bid not in seen:
            seen.append(bid)

    def sort_key(bid: str | None) -> tuple[int, str]:
        # « Hors budget » ferme la marche : c'est un reste, pas une catégorie.
        if bid is None:
            return (1, "")
        return (0, (budgets[bid].name if bid in budgets else "").lower())

    series = []
    for bid in sorted(seen, key=sort_key):
        budget = budgets.get(bid) if bid else None
        values = [grid.get((bid, label), ZERO) for label in labels]
        series.append(
            {
                "budget_id": bid,
                # ``None`` = hors budget ; le front le nomme, pas nous. Un budget
                # supprimé laisse ses dépenses derrière (``SET_NULL``) : elles
                # retombent naturellement dans ce même seau.
                "name": budget.name if budget else None,
                "monthly_amount": (
                    None
                    if budget is None or budget.monthly_amount is None
                    else str(budget.monthly_amount)
                ),
                "values": values,
                "_total": sum(values, ZERO),
            }
        )
    return series


def _top_suppliers(qs) -> list[dict[str, Any]]:
    """Chez qui l'argent part, tous budgets confondus (ou dans celui filtré).

    Un fournisseur vide n'est pas « inconnu à classer » — c'est une dépense qui
    n'en a pas (une note, une régularisation). L'exclure évite une barre géante
    « (vide) » en tête de classement, qui ne dit rien et masque les vraies.
    """
    rows = (
        qs.exclude(supplier="")
        .values("supplier")
        .annotate(total=Coalesce(Sum("amount"), Decimal("0.00")), count=Count("id"))
        .order_by("-total")[:TOP_SUPPLIERS]
    )
    return [
        {
            "supplier": row["supplier"],
            "total": _decimal_str(row["total"]),
            "count": row["count"],
        }
        for row in rows
    ]


def _biggest(qs, budgets: dict[str, Budget]) -> list[dict[str, Any]]:
    """Les plus grosses dépenses de la fenêtre.

    ``amount__isnull=False`` n'est pas défensif : sous PostgreSQL un NULL trie
    en tête d'un ``-amount`` et volerait la première place avec un montant vide.
    Le bilan mensuel a exactement la même clause, pour la même raison.
    """
    rows = qs.filter(amount__isnull=False).order_by("-amount")[:TOP_EXPENSES]
    return [
        {
            "id": str(item.id),
            "subject": item.subject,
            "amount": _decimal_str(item.amount),
            "occurred_at": item.occurred_at.isoformat() if item.occurred_at else None,
            "budget_id": str(item.budget_id) if item.budget_id else None,
            "budget_name": (
                budgets[str(item.budget_id)].name
                if item.budget_id and str(item.budget_id) in budgets
                else None
            ),
        }
        for item in rows
    ]
