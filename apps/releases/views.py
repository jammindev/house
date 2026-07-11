"""Changelog REST API — lecture seule, global (non household-scoped).

Tout utilisateur authentifié voit le même changelog : c'est de l'infra
applicative, pas de la donnée foyer. Aucune écriture via l'API — les entrées
sont générées par la command ``generate_changelog`` au déploiement.
"""
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import ChangelogEntry, ChangelogState
from .serializers import ChangelogEntrySerializer, ChangelogStateSerializer


class ChangelogViewSet(viewsets.ReadOnlyModelViewSet):
    """Liste des changements livrés en prod + état de la dernière génération."""

    queryset = ChangelogEntry.objects.all()
    serializer_class = ChangelogEntrySerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["module", "change_type"]
    ordering_fields = ["committed_at"]
    ordering = ["-committed_at"]

    class Pagination(LimitOffsetPagination):
        default_limit = 200
        max_limit = 1000

    pagination_class = Pagination

    @action(detail=False, methods=["get"])
    def state(self, request):
        """État live : SHA + date du tip de main à la dernière génération."""
        state = ChangelogState.load()
        if state is None:
            return Response(None)
        return Response(ChangelogStateSerializer(state).data)
