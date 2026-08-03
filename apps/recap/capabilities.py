"""Le récap mensuel se lit-il avec des phrases écrites par un modèle ?

Sans clé, le récap **existe toujours** : les gabarits de ``report/render.py``
donnent des légendes justes, simplement plus sèches. C'est une capacité de
confort, et c'est exactement pour ça qu'elle doit se déclarer plutôt que se
deviner — un écran qui ne promet rien ne déçoit pas.
"""
from __future__ import annotations

from django.conf import settings


def recap_polish_available() -> bool:
    """L'interrupteur **et** la clé, parce que ``polish_captions`` exige les deux.

    Renvoyer ``True`` sur la seule présence de la clé ferait afficher « activé »
    à un récap qui rend ses gabarits — le compteur vert d'un contrôle qui n'a
    rien vérifié.
    """
    if not getattr(settings, "RECAP_AI_POLISH_ENABLED", False):
        return False
    return bool(getattr(settings, "ANTHROPIC_API_KEY", "") or "")
