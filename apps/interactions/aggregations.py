"""
Expense summary aggregations.

Builds totals + breakdowns over `Interaction(type='expense')` for a given
period. Reads the ``amount`` / ``kind`` / ``supplier`` columns directly via the
shared ``interactions.queries`` helpers — no more JSON cast.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from django.db.models import Count, Sum
from django.db.models.functions import Coalesce, TruncMonth

from .queries import expenses


#: Valeur de ``budget`` qui désigne le seau « hors budget ». Une chaîne plutôt
#: qu'un ``None`` : dans une query string, l'absence de paramètre et « aucun
#: budget » doivent rester deux demandes différentes.
UNBUDGETED = 'none'


def expense_qs(household_id, from_dt: datetime | None, to_dt: datetime | None,
               supplier: str | None = None, kind: str | None = None,
               budget: str | None = None, category: str | None = None):
    """Les dépenses d'une période, filtrées comme le résumé les filtre.

    Public — et pas seulement parce qu'un second module s'en sert. La fiche d'un
    budget affiche le total du résumé **et** sa décomposition par jour et par
    fournisseur : si les deux ne partaient pas du même queryset, le graphique
    finirait par ne plus recomposer le chiffre écrit juste au-dessus de lui, et
    aucun des deux ne dirait lequel se trompe.

    ``category`` élargit le scope d'une enveloppe à **toutes celles rangées sous
    une même catégorie**. Une catégorie ne porte aucune dépense — c'est ce qui
    permet à « dépensé » de garder une seule définition — donc la seule façon de
    lire son total est de lire les dépenses de ses budgets. Un filtre de scope,
    jamais un compteur de plus.
    """
    qs = expenses(household_id=household_id)
    if from_dt is not None:
        qs = qs.filter(occurred_at__gte=from_dt)
    if to_dt is not None:
        qs = qs.filter(occurred_at__lte=to_dt)
    if supplier is not None:
        qs = qs.filter(supplier=supplier)
    if kind is not None:
        qs = qs.filter(kind=kind)
    if budget is not None:
        qs = qs.filter(budget__isnull=True) if budget == UNBUDGETED else qs.filter(budget_id=budget)
    if category is not None:
        qs = qs.filter(budget__category_id=category)
    return qs


def _zero() -> Decimal:
    return Decimal('0.00')


def _str(amount: Decimal | None) -> str:
    return str(amount if amount is not None else _zero())


def compute_expense_summary(
    *,
    household_id,
    from_dt: datetime | None,
    to_dt: datetime | None,
    supplier: str | None = None,
    kind: str | None = None,
    budget: str | None = None,
    category: str | None = None,
) -> dict[str, Any]:
    """Return totals + breakdowns for expense interactions in the period.

    ``budget`` restreint le calcul à une enveloppe, ou au seau « hors budget »
    avec la valeur ``'none'`` — c'est ce qui permet d'ouvrir un compteur pour
    voir de quelles dépenses il est fait, sans charger le journal entier côté
    client pour le refiltrer. ``category`` fait la même chose pour **toutes** les
    enveloppes d'une catégorie.

    Shape:
        {
          "period": {"from": ISO|null, "to": ISO|null},
          "total": "1247.83",
          "count": 18,
          "by_kind": [{"kind": "stock_purchase", "total": "342.00", "count": 5}, ...],
          "by_supplier": [{"supplier": "Engie", "total": "142.67", "count": 1}, ...],
          "by_month": [{"month": "2026-05", "total": "1247.83", "count": 18}, ...],
        }
    """
    qs = expense_qs(
        household_id, from_dt, to_dt, supplier=supplier, kind=kind, budget=budget,
        category=category,
    )

    overall = qs.aggregate(
        total=Coalesce(Sum('amount'), _zero()),
        count=Count('id'),
    )

    by_kind_rows = (
        qs.values('kind')
        .annotate(total=Coalesce(Sum('amount'), _zero()), count=Count('id'))
        .order_by('-total')
    )
    by_kind = [
        {
            'kind': row['kind'] or '',
            'total': _str(row['total']),
            'count': row['count'],
        }
        for row in by_kind_rows
    ]

    by_supplier_rows = (
        qs.values('supplier')
        .annotate(total=Coalesce(Sum('amount'), _zero()), count=Count('id'))
        .order_by('-total')
    )
    by_supplier = [
        {
            'supplier': row['supplier'] or '',
            'total': _str(row['total']),
            'count': row['count'],
        }
        for row in by_supplier_rows
    ]

    by_month_rows = (
        qs.annotate(month_start=TruncMonth('occurred_at'))
        .values('month_start')
        .annotate(total=Coalesce(Sum('amount'), _zero()), count=Count('id'))
        .order_by('month_start')
    )
    by_month = [
        {
            'month': row['month_start'].strftime('%Y-%m') if row['month_start'] else '',
            'total': _str(row['total']),
            'count': row['count'],
        }
        for row in by_month_rows
    ]

    refunded = _refunded_total(household_id, from_dt, to_dt, budget=budget, category=category)

    return {
        'period': {
            'from': from_dt.isoformat() if from_dt else None,
            'to': to_dt.isoformat() if to_dt else None,
        },
        'total': _str(overall['total']),
        'count': overall['count'],
        # Ce que la période a **rendu**, et le net qui en découle. ``total`` reste
        # le brut : c'est lui que décomposent ``by_kind`` / ``by_supplier`` /
        # ``by_month``, et un total qui ne se recompose pas ne se lit pas.
        'refunded': _str(refunded),
        'net_total': _str(overall['total'] - refunded),
        'by_kind': by_kind,
        'by_supplier': by_supplier,
        'by_month': by_month,
    }


def _refunded_total(
    household_id, from_dt, to_dt, *, budget: str | None, category: str | None = None
) -> Decimal:
    """Somme des remboursements de la période, cadrée sur le même filtre budget.

    Trois lectures, cohérentes avec le filtre demandé : une enveloppe précise
    donne ce qui lui est revenu, ``'none'`` donne les remboursements qui ne
    créditent personne, et l'absence de filtre donne tout ce qui est revenu sur
    la période. Renvoyer zéro quand on ne sait pas serait le silence que le
    module refuse.

    ``category`` suit exactement le scope des dépenses : un avoir attribué à une
    enveloppe d'une **autre** catégorie ne recrédite pas celle-ci, sinon le net
    de la fiche ne serait plus le brut moins ses propres rendus.

    Le remboursement est daté par ``booked_on`` (la banque), la dépense par
    ``occurred_at`` (le foyer) : deux dates différentes pour deux faits
    différents, bornées par le même intervalle.
    """
    from banking.models import InflowNature, RefundAllocation, TransactionDirection

    # ⚠️ On somme les **parts attribuées**, pas les montants des lignes. Depuis
    # que 70 € peuvent se répartir en 40 € + 30 €, sommer la ligne annoncerait
    # 70 € à une enveloppe qui n'a récupéré que 40 € — et la page d'un budget
    # dirait alors autre chose que son aperçu.
    qs = RefundAllocation.objects.filter(
        household_id=household_id,
        transaction__direction=TransactionDirection.IN,
        transaction__inflow_nature=InflowNature.REFUND,
    )
    if budget == UNBUDGETED:
        # Un remboursement non attribué ne crédite aucune enveloppe : par
        # construction il n'a pas de ligne de ventilation, donc rien à sommer ici.
        return Decimal('0.00')
    if budget:
        qs = qs.filter(budget_id=budget)
    if category is not None:
        qs = qs.filter(budget__category_id=category)

    if from_dt is not None:
        qs = qs.filter(transaction__booked_on__gte=from_dt.date())
    if to_dt is not None:
        qs = qs.filter(transaction__booked_on__lte=to_dt.date())

    return qs.aggregate(total=Coalesce(Sum('amount'), _zero()))['total'] or Decimal('0.00')
