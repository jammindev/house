"""Ce que l'instance sait faire — lu par le front avant d'afficher une promesse."""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .capabilities import snapshot


class CapabilitiesView(APIView):
    """``GET /api/capabilities/`` — l'état des capacités optionnelles.

    **Pas household-scopé, et c'est structurant** : les clés se configurent par
    instance (le ``.env`` *est* le BYOK du self-hoster), jamais par foyer. Une
    saisie de clé par foyer ferait de ``get_llm_client()`` une décision
    d'appelant — ce que ``apps/agent/llm.py`` interdit explicitement — et n'aurait
    de sens que le jour où quelqu'un héberge des foyers tiers.

    Authentifié quand même : la liste dit quels réglages manquent, ce qui est une
    cartographie utile à qui cherche une porte. Elle n'expose **jamais** la
    valeur d'une clé, seulement son nom et le fait qu'elle soit posée.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"capabilities": snapshot()}, status=status.HTTP_200_OK)
