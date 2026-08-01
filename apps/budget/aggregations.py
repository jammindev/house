"""
Budget overview aggregation.

Computes, for the current calendar month (in the household's timezone), how much
each budget has spent versus its ceiling, plus the "hors budget" total and the
optional global cap. Spending is read live from the interactions journal
(``Interaction(type='expense')``, ``amount`` column), never denormalized —
via the shared ``interactions.queries`` helpers.
"""
from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce

from core.timezones import current_month_range as _current_month_range
from core.timezones import household_today, month_range, start_of_day
from interactions.queries import expenses

from .models import Budget, BudgetCategory, RecurringExpense

# Ratio at which a budget flips to the "attention" state (below the 100% overrun).
WARNING_RATIO = getattr(settings, "BUDGET_WARNING_RATIO", 0.8)


def _zero() -> Decimal:
    return Decimal("0.00")


def _str(amount: Decimal | None) -> str:
    return str(amount if amount is not None else _zero())


def _dec(amount: str | None) -> Decimal:
    """Re-read a serialized amount. Used to total category rows from budget rows
    rather than from a second query, so both say « dépensé » the same way."""
    return Decimal(amount) if amount else _zero()


def current_month_range(household) -> tuple[datetime, datetime, str]:
    """``(début, fin_exclusive, 'YYYY-MM')`` du mois en cours chez le foyer.

    Alias de ``core.timezones.current_month_range``, conservé parce que c'est le
    nom sous lequel le module est importé ailleurs. La définition, elle, est
    unique : le résumé des dépenses la lit aussi, et c'est ce qui garantit que le
    compteur d'une enveloppe et la page qui l'ouvre bornent le même mois.
    """
    return _current_month_range(household)


def parse_month(value: str) -> tuple[int, int]:
    """``'2026-06'`` → ``(2026, 6)``. Lève ``ValueError`` sur tout le reste.

    Un mois illisible **se dit**, il ne se remplace pas : replier silencieusement
    sur le mois en cours afficherait des chiffres parfaitement valides pour un
    mois que personne n'a demandé, et rien à l'écran ne le signalerait. C'est la
    même règle qu'un compteur à zéro qui distingue « rien à signaler » de « rien
    d'évaluable » — un aperçu juste sur la mauvaise fenêtre est un aperçu faux.
    """
    year_str, _, month_str = str(value).partition("-")
    if len(year_str) != 4 or len(month_str) != 2 or not (year_str + month_str).isdigit():
        raise ValueError(f"Mois attendu au format YYYY-MM, reçu : {value!r}")
    year, month = int(year_str), int(month_str)
    if not 1 <= month <= 12:
        raise ValueError(f"Mois hors de l'année : {value!r}")
    return year, month


def month_window(household, month: str | None) -> tuple[datetime, datetime, str]:
    """``(début, fin_exclusive, 'YYYY-MM')`` du mois demandé, ou du mois en cours.

    Un mois passé se borne **chez le foyer**, exactement comme le mois courant :
    borner en UTC ferait glisser les dépenses des premières et dernières heures
    d'un mois à l'autre, et relire juin depuis le sélecteur donnerait un autre
    total que le résumé des dépenses sur la même période — le « deux voix pour un
    même fait » que le module argent paie cher.
    """
    if month is None:
        return current_month_range(household)
    year, index = parse_month(month)
    start, end = month_range(household, year=year, month=index)
    return start, end, f"{year:04d}-{index:02d}"


def resolve_window(
    household,
    *,
    month: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[datetime, datetime, str | None]:
    """La fenêtre de l'aperçu — un mois, ou une période libre.

    Renvoie ``(début, fin_exclusive, mois)``. Le troisième terme est le
    ``'YYYY-MM'`` **quand la fenêtre est exactement un mois calendaire**, et
    ``None`` sinon. C'est lui qui décide si les plafonds s'appliquent.

    ⚠️ **Un plafond mensuel n'a de sens qu'en face d'un mois.** Comparer les
    dépenses de l'année à « 400 € / mois » afficherait « 4 200 € / 400 € » et une
    barre rouge saturée sur une enveloppe parfaitement tenue — un dépassement qui
    n'existe pas. Hors mois entier, l'aperçu répond donc ``amount: null`` et
    l'état ``uncapped``, qui est déjà le vocabulaire du module pour « suivi, non
    plafonné » : le montant dépensé se lit, la barre disparaît. C'est la règle que
    les fiches budget et catégorie appliquent depuis toujours (`showCeiling`) ;
    elle vaut ici pour la même raison.

    La borne haute est **exclusive** : une date nue en fin d'intervalle vaut fin
    de journée, donc le lendemain à minuit. Un ``__lt`` sur la date elle-même
    exclurait le dernier jour de la période.
    """
    if date_from is None and date_to is None:
        return month_window(household, month)
    if date_from is None or date_to is None:
        raise ValueError("Une période libre demande ses deux bornes (`from` et `to`).")
    if date_to < date_from:
        raise ValueError("La fin de la période précède son début.")

    start = start_of_day(date_from, household)
    end = start_of_day(date_to + timedelta(days=1), household)

    # La fenêtre est-elle *pile* un mois ? Le 1er au dernier jour, et rien de
    # plus. C'est la seule forme où un plafond mensuel a une échelle en face.
    last_day = calendar.monthrange(date_from.year, date_from.month)[1]
    whole_month = (
        date_from.day == 1
        and date_to.day == last_day
        and (date_from.year, date_from.month) == (date_to.year, date_to.month)
    )
    return start, end, f"{date_from.year:04d}-{date_from.month:02d}" if whole_month else None


def _spent_by_budget(household_id, start, end) -> tuple[dict, dict]:
    """``(total, attesté)`` par ``budget_id`` (``None`` = hors budget).

    Deux chiffres, **une** requête : le total du mois, et la part que le relevé
    a vue (``bank_transaction`` non nul). Le premier ne change pas — c'est lui
    que le plafond mesure, et il est lu par sept agrégations qu'on ne réécrit
    pas. Le second dit seulement *ce qu'on peut prouver*.

    Pourquoi pas un filtre dur sur les rapprochées : une dépense saisie
    aujourd'hui, avant l'import du relevé de fin de mois, est parfaitement réelle.
    L'exclure ferait baisser le compteur au fil du mois puis remonter à l'import —
    un plafond qui recule est pire qu'un plafond incertain. On affiche donc le
    même total, et **à côté** ce qui reste à attester.
    """
    rows = (
        expenses(household_id=household_id)
        .filter(occurred_at__gte=start, occurred_at__lt=end)
        .values("budget_id")
        .annotate(
            total=Coalesce(Sum("amount"), _zero()),
            attested=Coalesce(
                Sum("amount", filter=Q(bank_transaction__isnull=False)), _zero()
            ),
        )
    )
    spent, attested = {}, {}
    for row in rows:
        spent[row["budget_id"]] = row["total"] or _zero()
        attested[row["budget_id"]] = row["attested"] or _zero()
    return spent, attested


def _refunded_by_budget(household_id, start, end) -> dict:
    """Ce que le mois a **rendu** à chaque enveloppe, par ``budget_id``.

    Un article retourné, une cotisation bancaire remboursée : l'enveloppe n'a pas
    consommé cet argent. Sans ce chiffre, « 150 € / 400 € » reste faux pour
    toujours sur un achat dont 40 € sont revenus.

    ⚠️ **C'est la seule soustraction entre le monde bancaire et le journal**, et
    elle est étroite par construction : pas un total « banque » retranché d'un
    total « interactions » — ce que la règle du projet interdit, parce que les
    deux ne couvrent pas le même périmètre — mais la somme de lignes que
    l'utilisateur a **désignées une par une** comme créditant cette enveloppe.
    Une ligne sans ``refund_budget`` ne retire rien à personne.

    Le remboursement compte dans **son** mois, jamais dans celui de l'achat :
    l'imputer rétroactivement réécrirait un bilan mensuel déjà figé, que le rendu
    et le digest relisent. Conséquence assumée : un mois peut être net négatif si
    on s'est fait rembourser plus qu'on n'a dépensé. C'est un fait, pas un bug.
    """
    from banking.models import InflowNature, RefundAllocation, TransactionDirection

    rows = (
        RefundAllocation.objects.filter(
            household_id=household_id,
            transaction__direction=TransactionDirection.IN,
            transaction__inflow_nature=InflowNature.REFUND,
            transaction__booked_on__gte=start.date(),
            transaction__booked_on__lt=end.date(),
        )
        .values("budget_id")
        .annotate(total=Coalesce(Sum("amount"), _zero()))
    )
    # On somme le **montant attribué**, pas celui de la ligne : un virement de
    # 70 € dont 40 € couvrent le resto ne rend 40 € qu'à cette enveloppe. Compter
    # la ligne entière était juste tant qu'une recette ne créditait qu'un budget ;
    # ça ne l'est plus, et l'écart aurait été silencieux.
    return {row["budget_id"]: row["total"] or _zero() for row in rows}


def _committed_by_budget(household_id, start, end) -> dict:
    """Sum of recurring-expense amounts DUE this month, grouped by ``budget_id``.

    'Engagé à venir' — occurrences scheduled for the current month that have not
    been confirmed yet (confirming advances ``next_due_date`` out of the month).
    ``None`` key = recurrences not attached to any budget.
    """
    rows = (
        RecurringExpense.objects.filter(
            household_id=household_id,
            next_due_date__gte=start.date(),
            next_due_date__lt=end.date(),
        )
        .values("budget_id")
        .annotate(total=Coalesce(Sum("amount"), _zero()))
    )
    return {row["budget_id"]: row["total"] or _zero() for row in rows}


def _state(spent: Decimal, ceiling: Decimal | None) -> tuple[float, str]:
    """Return (ratio, state) — 'uncapped' | 'ok' | 'warning' | 'over'.

    ``uncapped`` is its own state, never 'ok': a category with no ceiling cannot
    be respected or exceeded, and rendering it as 'ok' would put a green bar at
    0 % on something that has no scale. Same reasoning as the conformity window —
    « rien à signaler » et « rien à mesurer » ne sont pas le même zéro.
    """
    if ceiling is None:
        return 0.0, "uncapped"
    if ceiling <= 0:
        return 0.0, "ok"
    ratio = float(spent / ceiling)
    if ratio >= 1.0:
        return ratio, "over"
    if ratio >= WARNING_RATIO:
        return ratio, "warning"
    return ratio, "ok"


def _budget_row(
    budget: Budget,
    spent: Decimal,
    committed: Decimal | None = None,
    attested: Decimal | None = None,
    refunded: Decimal | None = None,
    *,
    capped: bool = True,
) -> dict[str, Any]:
    seen = attested if attested is not None else _zero()
    given_back = refunded if refunded is not None else _zero()
    net = spent - given_back
    # ``capped=False`` sur une fenêtre qui n'est pas un mois entier : le plafond
    # est **mensuel**, il n'a pas d'échelle en face de trente jours ou d'une
    # année. La ligne retombe alors sur ``uncapped``, l'état que le module
    # réserve depuis toujours à « suivi, non plafonné ».
    ceiling = budget.monthly_amount if capped else None
    # C'est le **net** que le plafond mesure : de l'argent rendu n'a pas été
    # dépensé. Mesurer le brut laisserait « 150 € / 400 € » sur un achat dont
    # 40 € sont revenus, c'est-à-dire un plafond qu'on atteint plus vite que la
    # réalité — l'inverse du service rendu.
    ratio, state = _state(net, ceiling)
    return {
        "id": str(budget.id),
        "name": budget.name,
        # ``None``, never "0.00": stringified, a missing ceiling and a ceiling of
        # zero read the same — and the second one is permanently over budget.
        "amount": None if ceiling is None else _str(ceiling),
        # ⚠️ Le plafond **écrit en base**, indépendant de la fenêtre. ``amount``
        # est le plafond *comparable* et vaut ``null`` hors mois entier ; le
        # dialogue d'édition doit lire celui-ci, sinon enregistrer un budget
        # depuis « cette année » effacerait son plafond sans un mot.
        "monthly_amount": (
            None if budget.monthly_amount is None else _str(budget.monthly_amount)
        ),
        # ``spent`` reste le **brut** : sept agrégations le lisent, et le
        # décomposer en attesté/en attente n'aurait plus de sens s'il changeait de
        # définition. Le net est un chiffre de plus, pas une redéfinition.
        "spent": _str(spent),
        # Deux chiffres **additionnels** : ``spent_attested`` est ce qu'une ligne
        # de relevé justifie, ``spent_pending`` le reste. Leur somme vaut
        # ``spent``, toujours.
        "spent_attested": _str(seen),
        "spent_pending": _str(spent - seen),
        "refunded": _str(given_back),
        "net_spent": _str(net),
        "committed": _str(committed if committed is not None else _zero()),
        "ratio": round(ratio, 4),
        "state": state,
        # La catégorie sous laquelle ce budget est rangé, pour le regroupement à
        # l'affichage. Une ligne de budget reste **son propre** dépensé : c'est la
        # catégorie qui totalise, jamais le budget qui absorbe ses voisins.
        "category_id": str(budget.category_id) if budget.category_id else None,
    }


def _category_row(
    category: BudgetCategory,
    budgets: list[Budget],
    rows: list[dict[str, Any]],
    *,
    capped: bool = True,
) -> dict[str, Any]:
    """Le sous-total d'une catégorie, dérivé des lignes de ses budgets.

    Deux points qui tiennent le reste :

    - **Rien n'est relu en base.** Les chiffres sont resommés depuis les lignes
      déjà calculées, donc « dépensé » y a exactement la même définition que dans
      le panneau, l'analyse et le Contrôle. Un total qui repart d'une requête à
      lui finit toujours par répondre autre chose que celle d'à côté.
    - **Le plafond de la catégorie remplace la somme de ceux qu'elle contient**,
      il ne s'y ajoute pas. « Maison 500 € » par-dessus « Bricolage 200 € » et
      « Énergie 250 € » vaut 500 €, jamais 950 € : additionner les deux
      compterait deux fois le même engagement.
    """
    spent = sum((_dec(r["spent"]) for r in rows), _zero())
    attested = sum((_dec(r["spent_attested"]) for r in rows), _zero())
    refunded = sum((_dec(r["refunded"]) for r in rows), _zero())
    committed = sum((_dec(r["committed"]) for r in rows), _zero())

    ceiling = category.monthly_amount
    if ceiling is None:
        # Une catégorie sans plafond propre vaut la somme de ceux qu'elle range —
        # et ``None`` si aucun de ses budgets n'en a, parce qu'un sous-total de
        # rien du tout n'est pas un plafond de 0 € (perpétuellement dépassé).
        inherited = [b.monthly_amount for b in budgets if b.monthly_amount is not None]
        ceiling = sum(inherited, _zero()) if inherited else None

    # Hors mois entier, plus rien à mesurer — voir ``resolve_window``.
    shown = ceiling if capped else None
    net = spent - refunded
    ratio, state = _state(net, shown)
    return {
        "id": str(category.id),
        "name": category.name,
        "amount": None if shown is None else _str(shown),
        # ⚠️ Le plafond **écrit en base**, indépendant de la fenêtre — ce que le
        # dialogue d'édition doit ré-afficher. ``amount`` est le plafond
        # *comparable* et disparaît hors mois entier ; s'en servir pour
        # pré-remplir le formulaire viderait le plafond au premier enregistrement
        # fait depuis « cette année ».
        "monthly_amount": (
            None if category.monthly_amount is None else _str(category.monthly_amount)
        ),
        # Vrai quand le plafond affiché est celui de la catégorie elle-même, et
        # non la somme de ses budgets. Le front en a besoin pour ne pas proposer
        # d'éditer un chiffre qui n'est écrit nulle part.
        "has_own_amount": category.monthly_amount is not None,
        "spent": _str(spent),
        "spent_attested": _str(attested),
        "spent_pending": _str(spent - attested),
        "refunded": _str(refunded),
        "net_spent": _str(net),
        "committed": _str(committed),
        "ratio": round(ratio, 4),
        "state": state,
        "budget_count": len(rows),
    }


def compute_budget_overview(
    *,
    household,
    month: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict[str, Any]:
    """Return the budget overview for a household, over a month or a free window.

    ``month`` (``'YYYY-MM'``) relit un mois passé ; ``date_from``/``date_to``
    ouvrent une fenêtre libre (trente jours, une année, du 3 au 9 février) ; rien
    du tout — le défaut — garde le mois en cours. Toute la fenêtre suit : lignes,
    sous-totaux de catégorie, hors budget, engagé. Un aperçu qui ne décalerait
    que ses lignes serait pire que pas de sélecteur du tout, les lignes disant
    juin pendant que les totaux disent juillet.

    ⚠️ **Hors mois entier, il n'y a pas de plafond** : ``month`` vaut ``null``,
    et chaque ligne repasse en ``amount: null`` / ``state: "uncapped"``. Un
    plafond mensuel n'a pas d'échelle en face d'une année — voir
    ``resolve_window``. Le montant dépensé, lui, se lit toujours.

    Shape::

        {
          "month": "2026-07",              # null hors mois entier
          "global": {id, name, amount, spent, ratio, state} | null,
          "budgets": [{id, name, amount, monthly_amount, spent, spent_attested,
                       spent_pending, refunded, net_spent, committed, ratio,
                       state, category_id}, ...],
          "categories": [{id, name, amount, monthly_amount, has_own_amount,
                          spent, ..., budget_count}, ...],
          "unbudgeted": "700.00",
          "total_spent": "1850.00",
          "total_attested": "1600.00",
          "total_pending": "250.00",
          "total_refunded": "40.00",
          "total_net_spent": "1810.00",
          "named_total_amount": "1400.00",
          "named_exceeds_global": false
        }

    ``spent_attested + spent_pending == spent``, par construction : le second est
    calculé par différence. Deux sommes indépendantes finiraient par se contredire
    d'un centime d'arrondi, et un total qui ne se recompose pas ne se lit pas.

    ``net_spent == spent - refunded``, et c'est **le net que ``ratio``/``state``
    mesurent** : de l'argent rendu n'a pas été dépensé. ``spent`` garde sa
    définition brute — sept agrégations le lisent, et sa décomposition
    attesté/en attente perdrait son sens s'il changeait.
    """
    start, end, month = resolve_window(
        household, month=month, date_from=date_from, date_to=date_to
    )
    # Un mois entier a une échelle en face de ses plafonds ; une fenêtre libre
    # n'en a pas. Le booléen traverse toutes les lignes plutôt que d'être
    # re-déduit trois fois — c'est le même verdict pour l'aperçu, les catégories
    # et le plafond global.
    capped = month is not None
    spent_map, attested_map = _spent_by_budget(household.id, start, end)
    committed_map = _committed_by_budget(household.id, start, end)
    refunded_map = _refunded_by_budget(household.id, start, end)

    budgets = list(Budget.objects.filter(household_id=household.id))
    named = [b for b in budgets if not b.is_global]
    global_budget = next((b for b in budgets if b.is_global), None)
    categories = list(BudgetCategory.objects.filter(household_id=household.id))

    total_spent = sum(spent_map.values(), _zero())
    total_attested = sum(attested_map.values(), _zero())
    total_committed = sum(committed_map.values(), _zero())
    total_refunded = sum(refunded_map.values(), _zero())
    unbudgeted = spent_map.get(None, _zero())

    # Une ligne de budget porte **son propre** dépensé, toujours. La catégorie
    # totalise par-dessus, à côté ; elle n'absorbe pas ses budgets et ne les
    # remplace pas dans ``budgets``, sinon le même euro serait lu deux fois par
    # quiconque somme la liste.
    named_rows = [
        _budget_row(
            b,
            spent_map.get(b.id, _zero()),
            committed_map.get(b.id, _zero()),
            attested_map.get(b.id, _zero()),
            refunded_map.get(b.id, _zero()),
            capped=capped,
        )
        for b in named
    ]

    rows_by_id = {row["id"]: row for row in named_rows}
    budgets_by_category: dict[Any, list[Budget]] = {}
    for b in named:
        if b.category_id:
            budgets_by_category.setdefault(b.category_id, []).append(b)

    category_rows = [
        _category_row(
            c,
            budgets_by_category.get(c.id, []),
            [rows_by_id[str(b.id)] for b in budgets_by_category.get(c.id, [])],
            capped=capped,
        )
        for c in categories
    ]

    # Only the capped ones: an uncapped category promises nothing, so it cannot
    # make the envelopes overshoot the global ceiling on paper.
    #
    # ⚠️ On somme les **catégories** plus les budgets qu'aucune ne range. Compter
    # « Maison 500 € » *et* ses « Bricolage 200 € / Énergie 250 € » compterait
    # deux fois le même engagement, et ferait crier « les enveloppes dépassent le
    # plafond global » à un foyer parfaitement cohérent. Le plafond d'une
    # catégorie remplace la somme de ses budgets ; sans plafond propre, elle vaut
    # cette somme — c'est ``_category_row`` qui a déjà tranché, et on relit son
    # verdict plutôt que de le refaire ici avec une deuxième règle.
    #
    # Hors mois entier il n'y a pas de plafond à comparer : le total des
    # enveloppes vaut zéro et l'avertissement « les enveloppes dépassent le
    # plafond global » se tait. Le lire sur ``monthly_amount`` plutôt que sur
    # ``amount`` le ferait ressortir sur une fenêtre où il ne veut rien dire.
    named_total_amount = sum(
        (_dec(r["amount"]) for r in category_rows if r["amount"] is not None), _zero()
    ) + sum(
        (
            b.monthly_amount
            for b in named
            if capped and b.category_id is None and b.monthly_amount is not None
        ),
        _zero(),
    )

    global_row = None
    named_exceeds_global = False
    if global_budget is not None:
        global_row = _budget_row(
            global_budget,
            total_spent,
            total_committed,
            total_attested,
            total_refunded,
            capped=capped,
        )
        named_exceeds_global = (
            capped
            and global_budget.monthly_amount is not None
            and named_total_amount > global_budget.monthly_amount
        )

    return {
        "month": month,
        "global": global_row,
        "budgets": named_rows,
        "categories": category_rows,
        "unbudgeted": _str(unbudgeted),
        "total_spent": _str(total_spent),
        "total_attested": _str(total_attested),
        "total_pending": _str(total_spent - total_attested),
        "total_refunded": _str(total_refunded),
        "total_net_spent": _str(total_spent - total_refunded),
        "total_committed": _str(total_committed),
        "named_total_amount": _str(named_total_amount),
        "named_exceeds_global": named_exceeds_global,
    }


def compute_cashflow_projection(*, household, today=None, horizons=(30, 90)) -> dict[str, Any]:
    """Project upcoming recurring outflows over the next N days.

    For each horizon, sums every recurring occurrence whose date falls in
    ``[today, today + N days]`` — stepping each recurrence by its cadence so a
    monthly bill counts ~3× over 90 days. Read-only; no state advanced.

    Shape::

        {
          "today": "2026-07-23",
          "horizons": [{"days": 30, "total": "142.00", "count": 3},
                       {"days": 90, "total": "426.00", "count": 7}],
        }
    """
    from datetime import timedelta

    from .services import advance_due_date

    if today is None:
        today = household_today(household)

    recurrences = list(RecurringExpense.objects.filter(household_id=household.id))
    max_horizon = max(horizons) if horizons else 0
    far_end = today + timedelta(days=max_horizon)

    # Pre-expand each recurrence's occurrences up to the farthest horizon once.
    occurrences: list[tuple] = []  # (date, amount)
    for rec in recurrences:
        due = rec.next_due_date
        # skip occurrences already in the past relative to today
        while due < today:
            due = advance_due_date(due, rec.cadence)
        while due <= far_end:
            occurrences.append((due, rec.amount))
            due = advance_due_date(due, rec.cadence)

    horizon_rows = []
    for days in horizons:
        limit = today + timedelta(days=days)
        due_in_window = [amount for (d, amount) in occurrences if d <= limit]
        horizon_rows.append(
            {
                "days": days,
                "total": _str(sum(due_in_window, _zero())),
                "count": len(due_in_window),
            }
        )

    return {"today": today.isoformat(), "horizons": horizon_rows}
