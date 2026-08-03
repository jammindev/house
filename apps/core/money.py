"""Un montant écrit par le serveur — une seule définition.

Pendant backend de ``formatAmount`` (``ui/src/lib/format.ts``), et **réservé à la
prose**. Partout où le serveur peut laisser le client formater, il le fait : le
récap-histoire émet des décimales brutes avec ``value_type: "money"`` et c'est le
bon réflexe, parce que le navigateur connaît la locale mieux que nous.

Le bilan mensuel, lui, n'a pas ce luxe : c'est un **bloc de texte**, rendu une
fois dans la langue du lecteur et envoyé aussi sur Telegram, où aucun client ne
formatera quoi que ce soit. Il formatait donc en ``f"{Decimal:.2f} €"`` — un
formatage C, insensible à la locale, qui affichait ``1240.50 €`` à un lecteur
français. C'est la dette ② de ``docs/fiches/CARTOGRAPHIE_DEPENSES.md``, celle que
``formatAmount`` a fermée côté front, restée ouverte côté serveur.

**Le formatage se fait au rendu, jamais dans le snapshot.** ``report.stats`` reste
une donnée numérique agnostique : un bilan figé se relit dans n'importe quelle
langue, et c'est ce qui permet aux quatre langues de partager un seul snapshot.

**Une valeur aberrante dégrade, elle ne lève pas.** Un bilan gelé il y a six mois
peut porter n'importe quoi ; perdre le rendu du mois entier pour un champ douteux
coûterait plus que d'afficher ce champ tel quel.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.utils import formats

#: Le projet est mono-devise (EUR). Le jour où ça change, c'est ici que ça se voit.
CURRENCY_SUFFIX = "€"


def format_money(value, *, decimals: int = 2) -> str:
    """``'1240.50'`` → ``'1 240,50 €'`` en français, ``'1,240.50 €'`` en anglais.

    La locale lue est la **langue active** — les appelants rendent déjà leur texte
    dans un ``translation.override`` (bilan mensuel, pings), donc il n'y a rien à
    passer et rien à oublier de passer.
    """
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return f"{value} {CURRENCY_SUFFIX}"

    rendered = formats.number_format(amount, decimal_pos=decimals, force_grouping=True)
    return f"{rendered} {CURRENCY_SUFFIX}"
