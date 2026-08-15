"""API des jeux du foyer (parcours 31, lot 2)."""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsHouseholdMember

from .models import Hunt
from .serializers import HuntPlaySerializer, HuntSerializer
from .services import HuntError, abandon_hunt, active_hunt, start_hunt


class HuntViewSet(viewsets.ModelViewSet):
    """CRUD de composition + les deux gestes de partie (lancer, abandonner).

    L'**avancement**, lui, n'est pas ici : il passe par
    ``POST /api/zones/scan/``, la porte unique du scan. Deux endpoints de scan
    finiraient par se contredire sur ce qu'est un scan valide.
    """

    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = HuntSerializer

    def get_queryset(self):
        return (
            Hunt.objects.for_user_households(self.request.user)
            .prefetch_related('steps__zone')
            .select_related('created_by')
        )

    def perform_create(self, serializer):
        household = getattr(self.request, 'household', None)
        if household is None:
            raise ValidationError({'household_id': 'A valid household_id is required.'})
        serializer.save(household=household, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        try:
            hunt = start_hunt(self.get_object())
        except HuntError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(HuntPlaySerializer(hunt).data)

    @action(detail=True, methods=['post'])
    def abandon(self, request, pk=None):
        try:
            hunt = abandon_hunt(self.get_object())
        except HuntError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(HuntPlaySerializer(hunt).data)

    @action(detail=True, methods=['get'])
    def play(self, request, pk=None):
        """La vue de partie d'une chasse **désignée**.

        Elle existe parce que `active/` ne peut pas servir l'écran de victoire :
        la dernière étape fait passer la chasse en `done`, donc « la chasse
        active » devient `None` à l'instant précis où il faut révéler le trésor.
        Le front garde l'identifiant (`?hunt=`) et demande celle-là.

        Ce n'est pas un contournement de la règle du secret : c'est le **même**
        `HuntPlaySerializer`, qui ne dévoile le trésor que sur une chasse
        terminée. Une seule définition de ce qui est révélable.
        """
        return Response({'hunt': HuntPlaySerializer(self.get_object()).data})

    @action(detail=False, methods=['get'])
    def active(self, request):
        """La chasse en cours du foyer — l'écran de jeu s'y raccroche au chargement.

        C'est ce qui fait qu'une partie survit à un rechargement et au passage sur
        un autre téléphone : l'état est en base, pas dans l'onglet.
        """
        household = getattr(request, 'household', None)
        if household is None:
            raise ValidationError({'household_id': 'A valid household_id is required.'})
        hunt = active_hunt(household)
        if hunt is None:
            return Response({'hunt': None})
        return Response({'hunt': HuntPlaySerializer(hunt).data})
