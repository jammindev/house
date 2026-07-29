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
    *,
    household,
    budget: str | None,
    start: date,
    end: date,
    today: date | None = None,
    category: str | None = None,
) -> dict[str, Any]:
    """Ce qu'une enveloppe a dépensé sur ``[start, end]``, et ce que ça vaut.

    ``budget`` est un id d'enveloppe, ``'none'`` pour le seau « hors budget », ou
    ``None`` pour toutes les dépenses confondues. ``category`` ouvre la même
    fiche sur **toutes les enveloppes d'une catégorie** ; les deux scopes sont
    exclusifs — un budget *et* sa catégorie n'est pas une fenêtre, c'est une
    ambiguïté, et en trancher une en silence donnerait un total juste sous un
    titre faux.

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
          "kinds": [{"kind", "total", "count"}, …],
          "budgets": [{"budget_id", "name", "total", "count", "share"}, …],
        }

    ``budgets`` ne se remplit que sur un scope de catégorie : une enveloppe ne se
    répartit pas entre elle-même.
    """
    if budget is not None and category is not None:
        raise ValueError("Pass a budget or a category, never both — the scope must be one window.")
    if today is None:
        today = household_today(household)
    prev_start, prev_end = previous_period(start, end, today=today)

    current = _totals(household, budget, start, end, category=category)
    previous = _totals(household, budget, prev_start, prev_end, category=category)

    qs = expense_qs(
        household.id,
        start_of_day(start, household),
        end_of_day(end, household),
        budget=budget,
        category=category,
    )
    granularity = "day" if (end - start).days < DAILY_MAX_DAYS else "month"
    total = Decimal(current["total"])
    spent_rows, returned_rows, ring_total = (
        _budgets(qs, _refunded_by_budget(household, start, end, category))
        if category is not None
        else ([], [], ZERO)
    )

    return {
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "previous_period": {"from": prev_start.isoformat(), "to": prev_end.isoformat()},
        "current": current,
        "previous": previous,
        "delta": _delta(current["net_total"], previous["net_total"]),
        "granularity": granularity,
        "buckets": _buckets(qs, household, start, end, granularity),
        "suppliers": _suppliers(qs, total),
        # Les natures présentes dans la fenêtre. Ce ne sont pas des parts (voir
        # `_kinds`) : c'est ce sur quoi la fiche propose de filtrer sa liste.
        "kinds": _kinds(qs),
        "budgets": spent_rows,
        "budgets_returned": returned_rows,
        # Ce que l'anneau décompose. Égal au net de la carte du haut, **sauf**
        # quand une enveloppe a rendu plus qu'elle n'a dépensé : l'écart vaut
        # alors exactement la somme des ``budgets_returned``, que le front nomme.
        "budgets_net_total": str(ring_total),
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


def _totals(
    household, budget: str | None, start: date, end: date, *, category: str | None = None
) -> dict[str, Any]:
    """Les quatre chiffres d'une période, tels que la carte du haut les affiche."""
    summary = compute_expense_summary(
        household_id=household.id,
        from_dt=start_of_day(start, household),
        to_dt=end_of_day(end, household),
        budget=budget,
        category=category,
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


def _kinds(qs) -> list[dict[str, Any]]:
    """Les natures de dépense présentes dans la fenêtre — de quoi filtrer la liste.

    Pas de ``share`` ici, et ce n'est pas un oubli : ceci n'est **pas** une
    répartition mais la liste des valeurs sur lesquelles la fiche propose de
    filtrer. Une part par nature ferait un second anneau qui décomposerait le
    même total que celui des fournisseurs, sans que rien ne dise lequel lire.

    Les options viennent du serveur, et de la **fenêtre entière** — jamais des
    lignes de la page affichée : une pastille qui apparaît et disparaît en
    tournant les pages fait douter de ce qu'on filtre. Une nature vide n'existe
    pas côté dépense (le créateur la renseigne toujours), mais on la refuse
    explicitement plutôt que de produire une pastille sans libellé.
    """
    rows = (
        qs.exclude(kind="")
        .values("kind")
        .annotate(total=Coalesce(Sum("amount"), ZERO), count=Count("id"))
        .order_by("-total")
    )
    return [
        {
            "kind": row["kind"],
            "total": str(row["total"] or ZERO),
            "count": row["count"],
        }
        for row in rows
    ]


def _refunded_by_budget(
    household, start: date, end: date, category: str
) -> dict[Any, tuple[str, Decimal]]:
    """Ce que la fenêtre a rendu à chaque enveloppe de la catégorie.

    Renvoie le **nom** avec le montant : une enveloppe peut n'avoir aucune
    dépense sur la fenêtre et n'exister ici que par son remboursement, et il faut
    pouvoir la nommer sans une requête de plus.

    ⚠️ **La borne de fin est inclusive**, contrairement à
    ``budget.aggregations._refunded_by_budget`` à qui l'aperçu passe le 1er du
    mois suivant. Emprunter la borne de l'un à l'autre perdrait sans un mot tout
    remboursement daté du **dernier jour** de la fenêtre — le 31, jour où tombent
    les régularisations.
    """
    from banking.models import InflowNature, RefundAllocation, TransactionDirection

    # On somme le montant **attribué** à l'enveloppe, pas celui de la ligne : un
    # virement de 70 € dont 40 € couvrent une enveloppe ne lui rend que 40 €.
    rows = (
        RefundAllocation.objects.filter(
            household_id=household.id,
            transaction__direction=TransactionDirection.IN,
            transaction__inflow_nature=InflowNature.REFUND,
            transaction__booked_on__gte=start,
            transaction__booked_on__lte=end,
            budget__category_id=category,
        )
        .values("budget_id", "budget__name")
        .annotate(total=Coalesce(Sum("amount"), ZERO))
    )
    return {
        row["budget_id"]: (row["budget__name"] or "", row["total"] or ZERO) for row in rows
    }


def _budgets(
    qs, refunds: dict[Any, tuple[str, Decimal]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], Decimal]:
    """Laquelle des enveloppes de la catégorie a coûté quoi — et pour quelle part.

    C'est la question propre à une catégorie : sur une enveloppe on demande *chez
    qui* l'argent est parti, sur une catégorie *laquelle de mes enveloppes*.

    **Une part se mesure sur le net.** Une enveloppe remboursée de 488 € sur 762 €
    a coûté 275 € au foyer ; la dessiner à 762 € la fait paraître trois fois plus
    lourde, et l'anneau annonce alors un total que la carte du dessus — le net —
    contredit. Rien à voir avec la courbe, qui reste sur le brut : là, déduire un
    remboursement le daterait au jour de l'achat. **Une part n'a pas de date.**

    Renvoie ``(parts, rendues, total_de_l_anneau)`` :

    - ``parts`` — les enveloppes net **positives**, la plus grosse d'abord ;
    - ``rendues`` — celles qui ont rendu au moins autant qu'elles ont dépensé. Un
      remboursement compte dans **son** mois, jamais dans celui de l'achat :
      dépenser en juin et se faire rembourser en juillet est le cas normal, et un
      camembert ne sait pas dessiner une part négative. Elles sortent de l'anneau
      mais **ne disparaissent pas** — les omettre en silence ferait croire
      qu'aucun argent n'est revenu ;
    - le total que l'anneau décompose, qui vaut le net de la carte du haut **sauf**
      quand la troisième liste n'est pas vide, l'écart valant alors exactement sa
      somme.

    Une enveloppe sans **aucun** mouvement sur la fenêtre n'apparaît nulle part :
    une part à 0 % est un filet illisible qui prend une couleur pour rien. C'est
    la liste des enveloppes, sous l'anneau, qui montre celles qui dorment.
    """
    gross = (
        qs.values("budget_id", "budget__name")
        .annotate(total=Coalesce(Sum("amount"), ZERO), count=Count("id"))
    )
    seen: dict[Any, dict[str, Any]] = {}
    for row in gross:
        seen[row["budget_id"]] = {
            "budget_id": str(row["budget_id"]),
            "name": row["budget__name"] or "",
            "total": row["total"] or ZERO,
            "count": row["count"],
            "refunded": ZERO,
        }
    for budget_id, (name, refunded) in refunds.items():
        entry = seen.setdefault(
            budget_id,
            {"budget_id": str(budget_id), "name": name, "total": ZERO, "count": 0},
        )
        entry["refunded"] = refunded

    for entry in seen.values():
        entry["net"] = entry["total"] - entry["refunded"]

    spent = sorted(
        (e for e in seen.values() if e["net"] > 0), key=lambda e: e["net"], reverse=True
    )
    returned = sorted(
        (e for e in seen.values() if e["net"] <= 0 and e["refunded"] > 0),
        key=lambda e: e["net"],
    )
    ring_total = sum((e["net"] for e in spent), ZERO)

    return (
        [_budget_share(e, ring_total) for e in spent],
        [_budget_share(e, ZERO) for e in returned],
        ring_total,
    )


def _budget_share(entry: dict[str, Any], ring_total: Decimal) -> dict[str, Any]:
    return {
        "budget_id": entry["budget_id"],
        "name": entry["name"],
        "total": str(entry["total"]),
        "refunded": str(entry["refunded"]),
        "net_total": str(entry["net"]),
        "count": entry["count"],
        # Une part sur un total nul serait le même mensonge qu'un « +∞ % » : il
        # n'y a pas de répartition de rien.
        "share": round(float(entry["net"] / ring_total), 4) if ring_total > 0 else 0.0,
    }
