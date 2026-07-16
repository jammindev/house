"""Central gathering of an entity's related items for the agent.

Combines the spec's declared ``related`` relations with the entity's linked
documents. Document visibility is therefore **structural**: any entity that has
documents attached (via the polymorphic DocumentLink) surfaces them to the agent
automatically, without each app re-implementing document gathering in its own
``related`` callable.
"""
from __future__ import annotations


def gather_related(spec, obj) -> list:
    """All related instances for ``obj``: declared relations + linked documents."""
    items: list = []
    if spec.related is not None:
        items.extend(spec.related(obj))

    # Centralized document visibility — deduped against already-gathered items.
    from documents.services import get_linked_documents

    seen = {(type(i), getattr(i, "pk", None)) for i in items}
    for doc in get_linked_documents(obj):
        key = (type(doc), doc.pk)
        if key not in seen:
            items.append(doc)
            seen.add(key)
    return items
