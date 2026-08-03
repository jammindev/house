"""Les notifications push du navigateur — sans VAPID, l'abonnement ne peut pas
même être créé.

Cas particulier à ne pas rater : ``VapidPublicKeyView`` renvoie aujourd'hui une
clé **vide** avec un 200. Le navigateur accepte la réponse, puis
``pushManager.subscribe()`` échoue sur un ``InvalidAccessError`` illisible. La
capacité doit donc se dire *avant* le clic, pas après.
"""
from __future__ import annotations

from django.conf import settings


def push_available() -> bool:
    """Les deux moitiés de la paire, jamais une seule.

    La publique part au navigateur, la privée signe l'envoi : avec l'une sans
    l'autre l'abonnement se crée et aucun message n'arrive — la panne la plus
    silencieuse de la famille.
    """
    return bool(
        (getattr(settings, "VAPID_PUBLIC_KEY", "") or "")
        and (getattr(settings, "VAPID_PRIVATE_KEY", "") or "")
    )
