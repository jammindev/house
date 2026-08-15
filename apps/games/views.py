"""API des jeux du foyer (parcours 31, lots 2 et 3)."""
import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from app_settings import capabilities
from core.permissions import IsHouseholdMember

from .models import Hunt
from .riddles import generate_riddles
from .serializers import HuntPlaySerializer, HuntSerializer, RiddleRequestSerializer
from .services import HuntError, abandon_hunt, active_hunt, replay_hunt, start_hunt
from .throttles import HuntRiddlesThrottle

logger = logging.getLogger(__name__)


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

    def get_throttles(self):
        """Écrire des énigmes achète un appel au modèle : cap à part.

        Le plancher global compte des requêtes, pas des euros — c'est la règle du
        `CLAUDE.md`, la même qui a produit `document_upload` et `ocr_reprocess`.
        """
        if self.action == 'generate_riddles':
            return [HuntRiddlesThrottle()]
        return super().get_throttles()

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

    @action(detail=True, methods=['post'])
    def replay(self, request, pk=None):
        """Ressort une chasse jouée dans un ordre mélangé, en brouillon.

        Rend la **nouvelle** chasse, jamais l'ancienne — et l'ancienne n'est pas
        touchée : la partie de l'an dernier reste dans l'historique du foyer.
        """
        try:
            copy = replay_hunt(self.get_object(), created_by=request.user)
        except HuntError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            HuntSerializer(copy, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

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

    @action(detail=False, methods=['post'], url_path='generate-riddles')
    def generate_riddles(self, request):
        """Propose une énigme par pièce — et n'écrit **rien**.

        Volontairement une action de **liste** et non de détail : le geste a lieu
        pendant la composition, le plus souvent sur une chasse qui n'existe pas
        encore en base. Une route `{id}/generate-riddles/` obligerait à
        enregistrer une chasse vide avant de pouvoir demander de l'aide à
        l'écrire — et le premier critère du lot est justement qu'aucune énigme ne
        soit écrite sans être passée sous les yeux du parent. Ici, la question ne
        se pose même pas : l'endpoint ne sait pas où écrire.

        ⚠️ `url_path` est explicite parce que DRF **ne dérive pas** le chemin du
        nom de la méthode de la même façon que le nom de route : `url_name`
        remplace les underscores par des tirets, `url_path` non. Sans cette ligne
        le front appellerait `/generate-riddles/` pendant que le serveur servirait
        `/generate_riddles/`, et tout test passant par `reverse()` resterait vert.
        """
        # Avant tout effet de bord — et surtout avant l'appel qui coûte : un 200
        # inventé ou un 500 diraient tous deux « le produit est cassé », alors
        # qu'il manque une clé et que quelqu'un peut la poser.
        capabilities.require('hunt_riddles')

        household = getattr(request, 'household', None)
        if household is None:
            raise ValidationError({'household_id': 'A valid household_id is required.'})

        serializer = RiddleRequestSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        zones = serializer.validated_data['zones']

        try:
            riddles = generate_riddles(
                household,
                zones,
                age=serializer.validated_data['age'],
                user=request.user,
            )
        except ValueError as exc:
            # Forme inattendue : rien n'est écrit, et le front affiche « les
            # énigmes n'ont pas pu être écrites, réessayez ou saisissez-les ».
            # Un demi-résultat serait pire — le parent lancerait une chasse dont
            # deux étapes ne disent rien.
            logger.warning("games: riddle generation refused (%s)", exc)
            return Response(
                {'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY
            )
        except Exception as exc:  # noqa: BLE001 — panne fournisseur, pas un bug d'ici
            logger.warning("games: riddle generation failed (%s)", exc)
            return Response(
                {'detail': 'The riddles could not be written right now.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Le rang, pas la zone, est la clé de recollement : deux étapes ont le
        # droit de désigner la même pièce (un aller-retour dans une chasse), et
        # une réponse indexée par zone en perdrait une en silence.
        return Response({
            'riddles': [
                {'index': index, 'zone': str(zone.id), 'riddle': riddle}
                for index, (zone, riddle) in enumerate(zip(zones, riddles))
            ]
        })

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
