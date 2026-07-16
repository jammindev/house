"""Reusable DRF actions to attach/detach documents to any household entity.

Mount on a ModelViewSet whose objects are ``HouseholdScopedModel`` instances;
provides ``POST {detail}/attach_document/``, ``POST {detail}/detach_document/`` and
``POST {detail}/set_document_phase/`` backed by the polymorphic ``DocumentLink``
(via ``documents.services``).
"""
from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Document, DocumentLink
from .services import link_document, set_document_phase, unlink_document


class DocumentLinkActionsMixin:
    #: Default role stored on the link for this entity type.
    document_link_role = "document"

    @action(detail=True, methods=["post"], url_path="attach_document")
    def attach_document(self, request, pk=None):
        entity = self.get_object()
        document_id = request.data.get("document_id")
        if not document_id:
            raise ValidationError({"document_id": _("document_id is required.")})

        document = Document.objects.filter(
            id=document_id, household_id=entity.household_id
        ).first()
        if not document:
            return Response(
                {"detail": _("Document not found in this household.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            phase = self._validated_phase(request.data.get("phase"))
        except ValueError:
            raise ValidationError({"phase": _("Invalid phase.")})

        link, created = link_document(
            entity=entity,
            document=document,
            user=request.user,
            role=request.data.get("role") or self.document_link_role,
            note=request.data.get("note") or "",
            phase=phase,
        )
        return Response(
            {
                "id": link.id,
                "document": str(document.id),
                "role": link.role,
                "note": link.note,
                "phase": link.phase,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @staticmethod
    def _validated_phase(value):
        phase = (value or "").strip()
        if phase and phase not in DocumentLink.Phase.values:
            raise ValueError(phase)
        return phase

    @action(detail=True, methods=["post"], url_path="set_document_phase")
    def set_document_phase(self, request, pk=None):
        entity = self.get_object()
        document_id = request.data.get("document_id")
        if not document_id:
            raise ValidationError({"document_id": _("document_id is required.")})

        try:
            phase = self._validated_phase(request.data.get("phase"))
        except ValueError:
            raise ValidationError({"phase": _("Invalid phase.")})

        if set_document_phase(entity=entity, document_id=document_id, phase=phase) == 0:
            return Response(
                {"detail": _("Document is not linked to this entity.")},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"document": str(document_id), "phase": phase})

    @action(detail=True, methods=["post"], url_path="detach_document")
    def detach_document(self, request, pk=None):
        entity = self.get_object()
        document_id = request.data.get("document_id")
        if not document_id:
            raise ValidationError({"document_id": _("document_id is required.")})

        if unlink_document(entity=entity, document_id=document_id) == 0:
            return Response(
                {"detail": _("Document is not linked to this entity.")},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
