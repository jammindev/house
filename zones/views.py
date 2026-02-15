"""
Zones views - REST API for zone management.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from .models import Zone, ZoneDocument
from .serializers import ZoneSerializer, ZoneTreeSerializer, ZoneDocumentSerializer
from core.permissions import IsHouseholdMember


class ZoneViewSet(viewsets.ModelViewSet):
    """
    ViewSet for zone CRUD operations.
    
    List: Returns zones for user's households (flat or tree)
    Create: Creates new zone
    Retrieve: Gets zone details
    Update: Updates zone
    Delete: Deletes zone (cascades to children)
    """
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = ZoneSerializer

    def get_queryset(self):
        """Return zones from user's households."""
        return Zone.objects.for_user_households(self.request.user).select_related(
            'parent', 'household', 'created_by', 'updated_by'
        ).prefetch_related('children')

    def get_serializer_class(self):
        """Use tree serializer for tree action."""
        if self.action == 'tree':
            return ZoneTreeSerializer
        return ZoneSerializer

    def perform_create(self, serializer):
        """Set household and created_by from request."""
        household_id = self.request.data.get('household_id') or self.request.query_params.get('household_id')
        serializer.save(
            household_id=household_id,
            created_by=self.request.user
        )

    def perform_update(self, serializer):
        """Set updated_by from request."""
        serializer.save(updated_by=self.request.user)

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """
        Get zones as hierarchical tree.
        Returns only root zones with nested children.
        """
        household_id = request.query_params.get('household_id')
        if not household_id:
            return Response(
                {"detail": "household_id query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get root zones (no parent) for household
        root_zones = self.get_queryset().filter(
            household_id=household_id,
            parent__isnull=True
        )

        serializer = ZoneTreeSerializer(root_zones, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def children(self, request, pk=None):
        """Get direct children of a zone."""
        zone = self.get_object()
        children = zone.children.all()
        serializer = self.get_serializer(children, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def photos(self, request, pk=None):
        """Get photos linked to this zone."""
        zone = self.get_object()
        zone_documents = ZoneDocument.objects.filter(zone=zone).select_related('document')
        serializer = ZoneDocumentSerializer(zone_documents, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def attach_photo(self, request, pk=None):
        """Attach a photo document to this zone."""
        zone = self.get_object()
        
        document_id = request.data.get('document_id')
        note = request.data.get('note', '')
        
        if not document_id:
            return Response(
                {"detail": "document_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create zone document link
        zone_doc = ZoneDocument.objects.create(
            zone=zone,
            document_id=document_id,
            role='photo',
            note=note,
            created_by=request.user
        )

        serializer = ZoneDocumentSerializer(zone_doc)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
