"""La clôture d'un mois — une seule date, pour tout le projet.

Un récap (``recap``) comme un bilan budget (``budget.report``) sont des snapshots
**gelés une fois et jamais recalculés** : corriger une dépense en août ne réécrit
pas juin, et c'est voulu — un bilan qui bouge n'est pas un bilan.

Le corollaire avait été manqué : si le gel est irréversible, la **date** du gel
est du métier. Le mois se clôturait le 1er à minuit, et le premier membre qui
ouvrait le dashboard ce matin-là le figeait pour toujours (``/latest/`` génère).
Le ticket saisi le 3, le relevé arrivé le 4, la facture pointée le 5 n'entraient
jamais dans le récap — sans un mot, puisqu'un snapshot ne se recalcule pas.

D'où le **délai de grâce** : un mois n'est clos qu'au :data:`CLOSING_BUSINESS_DAY`
jour ouvré du mois suivant. Le 1er août ne clôt plus juillet ; le 7 août le clôt
(le 1er tombe un samedi en 2026, le premier jour ouvré est donc le lundi 3).

Et il n'y a qu'**une** définition, partagée par les quatre appelants — les deux
pings et les deux endpoints ``latest``. Décaler le seul garde-jour des pings
n'aurait rien réglé, puisque c'est ``latest`` qui gèle en premier : c'est la règle
« un compteur ne peut pas avoir deux définitions » (voir :mod:`core.timezones`)
appliquée à une date.

**Jour ouvré = lundi-vendredi, les fériés ne comptent pas.** Un foyer déclare un
fuseau, pas un pays : le calendrier des fériés serait une devinette, et une
devinette appliquée à une date de clôture déplacerait le rendez-vous d'un jour
sans que personne puisse dire pourquoi.
"""
from __future__ import annotations

from datetime import date, timedelta

from .timezones import household_today

#: Le mois est clos au 5e jour ouvré du suivant — de quoi enregistrer les
#: derniers tickets, relevés et factures avant que le récap ne se fige.
CLOSING_BUSINESS_DAY = 5


def previous_month(month: str) -> str:
    """``'2026-01'`` → ``'2025-12'``."""
    year, mon = (int(p) for p in month.split("-"))
    if mon == 1:
        return f"{year - 1:04d}-12"
    return f"{year:04d}-{mon - 1:02d}"


def next_month(month: str) -> str:
    """``'2026-12'`` → ``'2027-01'``."""
    year, mon = (int(p) for p in month.split("-"))
    if mon == 12:
        return f"{year + 1:04d}-01"
    return f"{year:04d}-{mon + 1:02d}"


def nth_business_day(year: int, month: int, n: int = CLOSING_BUSINESS_DAY) -> date:
    """Le ``n``-ième jour ouvré (lundi-vendredi) du mois.

    Lève ``ValueError`` si le mois en compte moins — impossible pour ``n <= 20``,
    mais un ``CLOSING_BUSINESS_DAY`` relevé à 25 doit exploser à la configuration
    plutôt que de rendre une date du mois d'après.
    """
    if n < 1:
        raise ValueError(f"n must be >= 1, got {n}")

    day = date(year, month, 1)
    seen = 0
    while day.month == month:
        if day.weekday() < 5:
            seen += 1
            if seen == n:
                return day
        day += timedelta(days=1)
    raise ValueError(f"{year:04d}-{month:02d} has fewer than {n} business days")


def closing_date(month: str) -> date:
    """Le jour où ``month`` (``'YYYY-MM'``) devient clos, donc gelable et racontable."""
    year, mon = (int(p) for p in next_month(month).split("-"))
    return nth_business_day(year, mon)


def last_closed_month(household, *, today: date | None = None) -> str:
    """Le dernier mois clos (``'YYYY-MM'``) chez ``household``.

    Pendant le délai de grâce, c'est encore l'avant-dernier : un récap déjà lu,
    pas un récap à moitié gelé. ``today`` est la date **locale du foyer** — les
    pings la reçoivent du tick et la repassent ici, pour que le garde-jour et le
    mois qu'il annonce ne puissent pas diverger.
    """
    today = today or household_today(household)
    candidate = previous_month(f"{today.year:04d}-{today.month:02d}")
    if today >= closing_date(candidate):
        return candidate
    return previous_month(candidate)
