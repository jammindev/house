"""Reusable DRF actions to attach/detach documents to any household entity.

Mount on a ModelViewSet whose objects are ``HouseholdScopedModel`` instances;
provides ``POST {detail}/attach_document/`` and ``POST {detail}/detach_document/``
backed by the polymorphic ``DocumentLink`` (via ``documents.services``).
"""
from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Document
from .services import link_document, unlink_document


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

        link, created = link_document(
            entity=entity,
            document=document,
            user=request.user,
            role=request.data.get("role") or self.document_link_role,
            note=request.data.get("note") or "",
        )
        return Response(
            {
                "id": link.id,
                "document": str(document.id),
                "role": link.role,
                "note": link.note,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

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
