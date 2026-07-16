"""Document linking services — the single write + read layer over ``DocumentLink``.

``DocumentLink`` is the sole store for document↔entity links (the legacy per-model
through tables were dropped in each app's ``delete_*document`` migration, after the
``documents.0006`` backfill). Every attach/detach flows through ``link_document`` /
``unlink_document`` here; the caller is responsible for the household-consistency
check (document.household == entity.household).
"""
from __future__ import annotations

import uuid

from django.contrib.contenttypes.models import ContentType

from .models import Document, DocumentLink


# --- write helpers --------------------------------------------------------------

def link_document(*, entity, document, user=None, role="document", note="", phase=""):
    """Attach ``document`` to any household ``entity``. Idempotent (upsert).

    ``phase`` is the optional renovation phase of a photo relative to the entity
    (``before``/``during``/``after`` or empty). Returns ``(link, created)``.
    Household consistency is the caller's concern.
    """
    ct = ContentType.objects.get_for_model(type(entity))
    return DocumentLink.objects.update_or_create(
        content_type=ct,
        object_id=entity.pk,
        document=document,
        defaults={
            "role": role or "document",
            "note": note or "",
            "phase": phase or "",
            "created_by": user,
        },
    )


def set_document_phase(*, entity, document_id, phase) -> int:
    """Set the renovation phase of the ``(entity, document)`` link.

    ``phase`` must be a valid ``DocumentLink.Phase`` value or empty (unclassified).
    Returns the number of links updated (0 if the link doesn't exist).
    """
    valid = {"", *DocumentLink.Phase.values}
    phase = phase or ""
    if phase not in valid:
        raise ValueError(f"Invalid phase: {phase!r}")
    ct = ContentType.objects.get_for_model(type(entity))
    return DocumentLink.objects.filter(
        content_type=ct, object_id=entity.pk, document_id=document_id
    ).update(phase=phase)


def unlink_document(*, entity, document_id) -> int:
    """Detach a document from ``entity``. Returns the number of links removed."""
    ct = ContentType.objects.get_for_model(type(entity))
    deleted, _ = DocumentLink.objects.filter(
        content_type=ct, object_id=entity.pk, document_id=document_id
    ).delete()
    return deleted


# --- read helpers ---------------------------------------------------------------

def documents_for_entity(entity):
    """Documents linked to ``entity`` via DocumentLink (any linkable type)."""
    ct = ContentType.objects.get_for_model(type(entity))
    return Document.objects.filter(
        links__content_type=ct, links__object_id=entity.pk
    ).distinct()


def get_linked_documents(instance):
    """List of Documents linked to ``instance`` — used by the agent.

    Central point that makes an entity's documents visible to the agent for ANY
    linkable type. Linkable entities all have a UUID pk (DocumentLink.object_id is
    a UUIDField); anything else (e.g. Document itself, int pk) has no links.
    """
    if not isinstance(getattr(instance, "pk", None), uuid.UUID):
        return []
    return list(documents_for_entity(instance))


def entity_links_for_document(document):
    """``[{entity_type, id, label, url_path}]`` for every entity a document links to.

    Resolves each ``DocumentLink`` back to its entity via the ``agent.searchables``
    registry, so any registered linkable type surfaces automatically — no
    per-type code to maintain.
    """
    from agent import searchables

    links = getattr(document, "prefetched_links", None)
    if links is None:
        links = list(document.links.select_related("content_type").all())

    results = []
    for link in links:
        entity = link.entity  # GenericForeignKey resolution
        if entity is None:
            continue
        spec = searchables.find_spec_for_instance(entity)
        if spec is None:
            continue
        results.append(
            {
                "entity_type": spec.entity_type,
                "id": str(entity.pk),
                "label": searchables.resolve_label(spec, entity),
                "url_path": spec.url_template.format(id=entity.pk),
            }
        )
    return results
