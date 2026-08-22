"""Qui a le droit de voir quoi — une seule définition, partagée.

``is_private`` veut dire la même chose partout où le champ existe : seul le
déposant voit sa pièce. Cette règle vivait en deux exemplaires — le queryset de
l'API documents et la permission objet ``core.permissions.CanViewPrivateContent``
— et manquait entièrement à la couche de retrieval de l'agent, qui ne connaissait
que le **foyer**, jamais le **lecteur**.

Deux définitions d'une même visibilité ne divergent pas symétriquement : c'est
toujours la plus permissive qui l'emporte, et elle le fait en silence. D'où une
fonction unique, que les specs de recherche déclarent et que le retrieval
applique sans savoir quel modèle porte un drapeau de confidentialité.
"""
from __future__ import annotations

from django.db.models import Q


def visible_to_creator(queryset, viewer, *, never_hidden: Q | None = None):
    """Restreindre ``queryset`` à ce que ``viewer`` a le droit de lire.

    Tout ce qui est public, plus les lignes privées dont il est l'auteur.

    ``viewer=None`` — un appel sans utilisateur : évaluation hors ligne, commande
    de fond, test bas niveau — ne voit **que** le public. Le défaut est fermé
    exprès : un chemin qui oublierait de passer le lecteur montre alors moins que
    prévu, jamais plus. Un manque se remarque et se corrige ; une fuite, non.

    Le filtre porte sur ``created_by``, jamais sur le rôle : un owner de foyer
    n'est pas un lecteur privilégié du privé des autres.

    ``never_hidden`` — un sous-ensemble que la confidentialité ne fait jamais
    **disparaître**, déclaré par l'app propriétaire du modèle. Un seul cas existe,
    et il est du métier : une dépense alimente sept agrégations d'argent, donc la
    retirer d'une liste sans la retirer des totaux donnerait deux définitions au
    même compteur. Son secret porte sur le **contenu**, pas sur l'existence.

    Le paramètre est ici, et pas dans un ``Q`` écrit chez l'appelant, pour que la
    règle du lecteur — celle qui ne doit jamais diverger — garde **une** seule
    implémentation. Ce que chaque app décide, c'est son exception ; pas la façon
    de reconnaître un lecteur.
    """
    allowed = Q(is_private=False)
    if viewer is not None and getattr(viewer, "is_authenticated", True):
        allowed |= Q(created_by=viewer)
    if never_hidden is not None:
        allowed |= never_hidden
    return queryset.filter(allowed)
