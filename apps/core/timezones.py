"""Le fuseau du foyer — une seule définition, pour tout le projet.

Ce module existe à cause d'un bug qu'aucune de ses six copies ne pouvait
attraper seule. « Ce mois-ci » était calculé dans le fuseau du foyer par
``budget.aggregations`` et en UTC par ``interactions.views`` : le panneau Budgets
et la page qui s'ouvre en cliquant dessus affichaient deux totaux différents pour
la même enveloppe, et les deux étaient « justes » selon leur propre borne.

La règle du projet dit qu'un écart ne se dit jamais deux fois avec deux voix.
Elle vaut aussi pour un montant : **un compteur ne peut pas avoir deux
définitions**. Une borne de période est ce qui décide de quel mois relève un
euro, donc de quel budget — c'est du métier, pas de la plomberie.

Trois fonctions suffisent, et tout ce qui borne une période dans le projet passe
par elles :

- :func:`household_tz` — le fuseau, jamais relu depuis ``household.timezone``
  ailleurs ;
- :func:`household_today` — la date **locale du foyer**, jamais ``date.today()``
  (qui lit l'horloge du serveur : en conteneur elle est en UTC, donc fausse de
  deux heures huit mois par an) ;
- :func:`start_of_day` / :func:`end_of_day` / :func:`month_range` — les bornes,
  toujours *aware*.

Une date nue en fin d'intervalle vaut **fin de journée**. Un ``__lte`` la lisant
à minuit exclut silencieusement la journée entière qu'on croyait inclure : c'est
le second bug que ce module ferme, cette fois pour de bon, puisqu'il n'y a plus
qu'un endroit où l'oublier.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone

logger = logging.getLogger(__name__)

UTC = ZoneInfo("UTC")


def household_tz(household) -> ZoneInfo:
    """Le fuseau IANA du foyer, UTC par défaut.

    Tolérant sur l'entrée (``None``, chaîne vide, fuseau inconnu) parce qu'un
    fuseau invalide ne doit jamais faire tomber une agrégation — mais il est
    logué, sinon un foyer entier lirait ses mois de travers sans trace.
    """
    name = getattr(household, "timezone", "") or "UTC"
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        logger.warning("invalid household timezone %r, falling back to UTC", name)
        return UTC


def household_today(household) -> date:
    """La date du calendrier **chez le foyer**.

    À préférer systématiquement à ``date.today()`` et à
    ``timezone.localdate()`` : le premier lit l'horloge du serveur, le second le
    ``TIME_ZONE`` du projet (UTC ici). Pour un foyer à Paris, les deux se
    trompent de jour entre minuit et 2 h du matin — soit exactement le moment où
    une échéance « en retard » bascule.
    """
    return timezone.now().astimezone(household_tz(household)).date()


def start_of_day(day: date, household) -> datetime:
    """Minuit local, *aware*. Borne basse inclusive d'une période."""
    return datetime.combine(day, time.min, tzinfo=household_tz(household))


def end_of_day(day: date, household) -> datetime:
    """Dernier instant de la journée locale, *aware*.

    Borne haute d'un ``__lte``. Sans elle, ``to=2026-07-31`` exclut le 31.
    """
    return datetime.combine(day, time.max, tzinfo=household_tz(household))


def month_range(household, *, year: int, month: int) -> tuple[datetime, datetime]:
    """``(début, fin_exclusive)`` du mois, en instants *aware* locaux.

    Fin **exclusive** : c'est la forme sûre pour un ``__lt``, qui ne peut pas
    rater une microseconde de fin de mois comme le ferait un ``__lte`` sur une
    borne arrondie.
    """
    tz = household_tz(household)
    start = datetime(year, month, 1, tzinfo=tz)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=tz)
    else:
        end = datetime(year, month + 1, 1, tzinfo=tz)
    return start, end


def current_month_range(household) -> tuple[datetime, datetime, str]:
    """``(début, fin_exclusive, 'YYYY-MM')`` du mois en cours chez le foyer."""
    today = household_today(household)
    start, end = month_range(household, year=today.year, month=today.month)
    return start, end, f"{today.year:04d}-{today.month:02d}"
