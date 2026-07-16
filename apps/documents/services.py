"""Document linking services — read helpers + through-table → DocumentLink sync.

During the phased migration to the polymorphic ``DocumentLink`` (see
``migrations/0006_backfill_document_links``), the 5 legacy per-model through
tables remain the **write model**. Signals (``documents/signals.py``) mirror
every write into ``DocumentLink``, which is the single **read model** consumed
by the documents queryset filter, the detail serializer (``entity_links``) and
the agent's centralized document visibility. This keeps PR1 fully reversible:
dropping the sync + ``DocumentLink`` leaves the through tables authoritative.
"""
from __future__ import annotations

import uuid

from django.contrib.contenttypes.models import ContentType

from .models import Document, DocumentLink


def _parent_content_type(through_instance, parent_attr: str) -> ContentType:
    """ContentType of the parent entity, without loading the parent instance."""
    parent_model = type(through_instance)._meta.get_field(parent_attr).related_model
    return ContentType.objects.get_for_model(parent_model)


# --- through-table → DocumentLink sync (called from signals) --------------------

def sync_document_link(through_instance, parent_attr: str) -> None:
    """Upsert the DocumentLink mirroring a legacy through-table row."""
    ct = _parent_content_type(through_instance, parent_attr)
    object_id = getattr(through_instance, f"{parent_attr}_id")
    DocumentLink.objects.update_or_create(
        content_type=ct,
        object_id=object_id,
        document_id=through_instance.document_id,
        defaults={
            "role": getattr(through_instance, "role", None) or "document",
            "note": getattr(through_instance, "note", "") or "",
            "created_by_id": getattr(through_instance, "created_by_id", None),
        },
    )


def unsync_document_link(through_instance, parent_attr: str) -> None:
    """Delete the DocumentLink mirroring a removed through-table row."""
    ct = _parent_content_type(through_instance, parent_attr)
    object_id = getattr(through_instance, f"{parent_attr}_id")
    DocumentLink.objects.filter(
        content_type=ct,
        object_id=object_id,
        document_id=through_instance.document_id,
    ).delete()


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
