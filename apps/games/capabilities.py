"""Ce que les jeux savent faire sur cette instance — et ce qui leur manque.

Une seule capacité, et elle porte **l'aide à l'écriture**, pas le jeu. C'est la
distinction qui décide de tout l'écran : une instance sans clé Anthropic doit
composer, lancer, jouer et gagner exactement comme une autre ; seul le bouton
« Proposer des énigmes » disparaît.

Elle est distincte de ``assistant`` bien qu'elle lise la même clé, et il faut
résister à l'envie de les fondre. Deux raisons :

- **elles ne se coupent pas ensemble.** Le jour où l'assistant conversationnel
  se désactive par foyer (module ``agent``), la génération d'énigmes n'a aucune
  raison de tomber avec lui — elle n'est pas une conversation, c'est un appel
  unique et sans mémoire ;
- **le texte n'est pas le même.** « L'assistant ne peut pas répondre » et « les
  énigmes s'écrivent à la main » disent des choses différentes à qui lit
  l'écran, et c'est exactement le malentendu que le registre existe pour
  supprimer.

Le prédicat, lui, est délibérément le même que celui de l'assistant : le
fournisseur inconnu vaut **indisponible**, jamais disponible — ``get_llm_client``
lève sur ce qu'il ne connaît pas, et une devinette optimiste ferait promettre à
l'écran ce que le premier clic démentirait.
"""
from __future__ import annotations

from django.conf import settings


def riddles_available() -> bool:
    """Un modèle peut-il écrire des énigmes sur cette instance ?"""
    provider = (getattr(settings, "LLM_PROVIDER", "anthropic") or "").lower()
    if provider == "anthropic":
        return bool(getattr(settings, "ANTHROPIC_API_KEY", "") or "")
    return False
