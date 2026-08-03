"""Ce que l'agent sait faire sur cette instance — et ce qui lui manque.

Deux capacités distinctes, et il faut résister à l'envie de les fondre : elles
tiennent à des fournisseurs différents et l'une marche très bien sans l'autre.
L'assistant répond sans embeddings (recherche lexicale seule) ; la recherche
sémantique est un **second étage** de la barre du haut, qui n'a pas besoin de
l'assistant. Les afficher ensemble ferait dire à un écran qu'il manque une clé
qu'il n'utilise pas.
"""
from __future__ import annotations

from django.conf import settings


def assistant_available() -> bool:
    """L'agent conversationnel peut-il appeler un modèle ?

    Le fournisseur inconnu vaut **indisponible**, pas disponible : c'est
    ``get_llm_client`` qui décide, et il lève ``LLMError`` sur tout ce qu'il ne
    connaît pas. Même défaut sûr que ``banking.rules.guess_internal`` — une
    devinette optimiste ferait promettre à l'écran ce que le premier message
    démentirait.
    """
    provider = (getattr(settings, "LLM_PROVIDER", "anthropic") or "").lower()
    if provider == "anthropic":
        return bool(getattr(settings, "ANTHROPIC_API_KEY", "") or "")
    return False


def semantic_search_available() -> bool:
    """La deuxième jambe de la recherche peut-elle tourner ?

    Deux conditions, et les deux comptent. L'interrupteur
    ``AGENT_HYBRID_RETRIEVAL_ENABLED`` est délibérément séparé de la clé : il ne
    s'allume qu'une fois l'index peuplé (``backfill_embeddings``), parce qu'un
    index à moitié rempli rend la recherche silencieusement fausse — elle ne
    trouve pas, sans jamais dire qu'elle n'a pas cherché.
    """
    if not getattr(settings, "AGENT_HYBRID_RETRIEVAL_ENABLED", False):
        return False
    provider = (getattr(settings, "EMBEDDING_PROVIDER", "voyage") or "").lower()
    if provider == "voyage":
        return bool(getattr(settings, "VOYAGE_API_KEY", "") or "")
    if provider == "openai":
        return bool(getattr(settings, "OPENAI_API_KEY", "") or "")
    if provider == "ollama":
        # Pas de clé : un endpoint local suffit, et il a un défaut.
        return bool(getattr(settings, "EMBEDDING_BASE_URL", "") or "")
    return False
