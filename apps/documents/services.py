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


# --- zones d'un document --------------------------------------------------------
#
# Ranger un document a deux chemins — un document à la fois (remplacement) et un lot
# (addition). Ils partagent la résolution des zones et la règle « ne relie que ce qui
# manque » : deux copies de cette règle, et l'une des deux finirait par réécrire un
# lien existant, donc par effacer sa `note` et sa `phase` en silence.


def zone_content_type():
    """ContentType de `Zone` — import local, `zones` déclare une GenericRelation ici."""
    from zones.models import Zone

    return ContentType.objects.get_for_model(Zone)


def parse_zone_ids(raw) -> list[uuid.UUID]:
    """Valide et dédoublonne des ids de zone. Lève `ValueError` sur du malformé.

    Un id malformé est une erreur du client, pas un 500 : passé tel quel à `id__in`
    sur un UUIDField, il ferait lever Django au fond de l'ORM.
    """
    if isinstance(raw, str) or not isinstance(raw, (list, tuple)):
        raise ValueError("zone_ids must be a list.")
    parsed: list[uuid.UUID] = []
    for value in raw:
        text = str(value).strip()
        if not text:
            continue
        try:
            parsed.append(uuid.UUID(text))
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"Invalid zone id: {text}")
    return list(dict.fromkeys(parsed))


def zones_of_household(*, household_id, zone_ids):
    """Les `Zone` demandées, **toutes** dans ce foyer. `ValueError` sinon.

    Refuser en bloc plutôt qu'ignorer les inconnues : sans ça un client gonflerait
    silencieusement le rangement d'un foyer qu'il ne peut pas voir.
    """
    from zones.models import Zone

    zones = list(Zone.objects.filter(id__in=zone_ids, household_id=household_id))
    if len(zones) != len(zone_ids):
        raise ValueError("Invalid zone or access denied.")
    return zones


def _existing_zone_object_ids(documents, zone_ct) -> set:
    return set(
        DocumentLink.objects.filter(
            document__in=documents, content_type=zone_ct
        ).values_list("document_id", "object_id")
    )


def set_document_zones(*, document, zones, user=None) -> None:
    """Remplace les zones de `document` par `zones` (liste vide = efface).

    Ne relie que ce qui manque : `link_document` est un upsert qui remet
    `role`/`note`/`phase` à leur défaut, donc ré-enregistrer une zone déjà liée
    effacerait le contexte porté par son lien.
    """
    zone_ct = zone_content_type()
    keep = [zone.id for zone in zones]
    existing = {
        object_id
        for _, object_id in _existing_zone_object_ids([document], zone_ct)
    }
    DocumentLink.objects.filter(document=document, content_type=zone_ct).exclude(
        object_id__in=keep
    ).delete()
    for zone in zones:
        if zone.id not in existing:
            link_document(entity=zone, document=document, user=user)


def add_documents_zones(*, documents, zones, user=None) -> int:
    """Ajoute `zones` à chaque document — **sans rien retirer**. Renvoie le nombre
    de documents traités.

    C'est la sémantique du lot, et elle diffère volontairement de
    `set_document_zones` : un lot qui remplacerait effacerait le rangement de
    documents qu'on n'a pas regardés un par un, et cet effacement ne se verrait
    nulle part. Contrepartie assumée — le lot ne sait pas *retirer* une zone.

    Les liens déjà présents ne sont pas réécrits, et le coût ne suit pas le nombre
    de documents : une seule requête établit ce qui existe déjà.
    """
    documents = list(documents)
    zone_ct = zone_content_type()
    existing = _existing_zone_object_ids(documents, zone_ct)
    to_create = [
        DocumentLink(
            document=document,
            content_type=zone_ct,
            object_id=zone.id,
            role="document",
            created_by=user,
        )
        for document in documents
        for zone in zones
        if (document.id, zone.id) not in existing
    ]
    if to_create:
        DocumentLink.objects.bulk_create(to_create)
    return len(documents)


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


def photos_added_between(household, *, start, end, limit: int = 12) -> dict:
    """Photos added to the household between ``start`` and ``end`` (end exclusive).

    Feeds the monthly recap's memories chapter. Returns **ids**, never URLs: a
    signed or generated URL expires, and a frozen snapshot is meant to outlive it.
    The caller resolves the ids at read time and degrades when one is gone.
    """
    qs = Document.objects.filter(
        household_id=household.id,
        type="photo",
        created_at__gte=start,
        created_at__lt=end,
    ).order_by("-created_at")
    return {
        "count": qs.count(),
        "ids": [str(pk) for pk in qs.values_list("id", flat=True)[:limit]],
    }
