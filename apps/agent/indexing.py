"""
Write-time indexing of searchable entities into the vector index (parcours 21).

Turns a searchable household entity into ``EmbeddingChunk`` rows: concatenate its
searchable fields (reusing ``retrieval._full_content`` — same text the full-text
side sees), split into chunks, embed each chunk via the configured
``EmbeddingClient``, and upsert. Driven by ``post_save`` / ``post_delete`` signals
wired in ``apps.py`` for every model of the ``searchables`` registry, and by the
backfill command (lot 2).

Idempotence is the load-bearing invariant: ``reindex_instance`` skips all work
(no embedding call, no writes) when the source text hash **and** the embedding
model are both unchanged — otherwise a plain ``save()`` would re-embed on every
edit and blow up latency/cost.
"""
from __future__ import annotations

import hashlib

from django.conf import settings
from django.db import transaction
from django.db.models import Model

from .embeddings import EmbeddingClient, get_embedding_client
from .models import EmbeddingChunk
from .retrieval import _full_content
from .searchables import find_spec_for_instance

# Chunk sizing. We approximate the ~300-token target of the fiche in characters
# (~4 chars/token) to avoid pulling a tokenizer dependency; word-boundary aware
# with a small overlap so a match spanning a boundary still lands in a chunk.
CHUNK_SIZE_CHARS = 1200
CHUNK_OVERLAP_CHARS = 200

# AIUsageLog feature tag for indexing embeddings (distinct from query-time).
INDEX_FEATURE = "embed_index"


def content_hash(text: str) -> str:
    """Stable hash of a source's full searchable text (shared by all its chunks)."""
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def chunk_text(
    text: str,
    *,
    size: int = CHUNK_SIZE_CHARS,
    overlap: int = CHUNK_OVERLAP_CHARS,
) -> list[str]:
    """Split ``text`` into word-boundary chunks of ~``size`` chars with ``overlap``.

    Pure function (no I/O) so it is trivially testable. A text shorter than
    ``size`` yields a single chunk; empty text yields no chunks.
    """
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for word in text.split():
        added = len(word) + (1 if current else 0)
        if current and current_len + added > size:
            chunks.append(" ".join(current))
            # Seed the next chunk with the trailing words of this one (overlap).
            tail: list[str] = []
            tail_len = 0
            for w in reversed(current):
                if tail_len + len(w) + 1 > overlap:
                    break
                tail.insert(0, w)
                tail_len += len(w) + 1
            current = tail
            current_len = sum(len(w) + 1 for w in current)
        current.append(word)
        current_len += added
    if current:
        chunks.append(" ".join(current))
    return chunks


def _delete_chunks(entity_type: str, object_id: str) -> int:
    deleted, _ = EmbeddingChunk.objects.filter(
        entity_type=entity_type, object_id=object_id
    ).delete()
    return deleted


def reindex_instance(
    instance: Model, *, client: EmbeddingClient | None = None, force: bool = False
) -> int:
    """(Re)build the vector index for one searchable instance. Returns #chunks written.

    Idempotent: returns 0 without embedding when the content hash and model are
    unchanged, unless ``force`` (used by the backfill after a model/provider
    switch, where the vectors must be recomputed even though the text is the same).
    Unregistered / non-embeddable / empty-text instances are cleaned of any stale
    chunks and return 0.
    """
    spec = find_spec_for_instance(instance)
    if spec is None:
        return 0

    entity_type = spec.entity_type
    object_id = str(instance.pk)

    if not spec.embed:
        _delete_chunks(entity_type, object_id)
        return 0

    text = _full_content(instance, spec.search_fields)
    if not text.strip():
        _delete_chunks(entity_type, object_id)
        return 0

    # Resolve the client up front so idempotence compares against the *actual*
    # model that would produce the vectors (client construction is network-free).
    client = client or get_embedding_client()
    model_name = getattr(client, "model", "") or getattr(settings, "EMBEDDING_MODEL", "")

    new_hash = content_hash(text)
    existing = list(
        EmbeddingChunk.objects.filter(entity_type=entity_type, object_id=object_id)[:1]
    )
    if (
        not force
        and existing
        and existing[0].content_hash == new_hash
        and existing[0].model == model_name
    ):
        return 0  # nothing changed — skip the embedding call entirely

    chunks = chunk_text(text)
    if not chunks:
        _delete_chunks(entity_type, object_id)
        return 0

    response = client.embed(
        chunks,
        household_id=instance.household_id,
        feature=INDEX_FEATURE,
        metadata={"entity_type": entity_type, "object_id": object_id},
    )
    resolved_model = response.model or model_name
    rows = [
        EmbeddingChunk(
            household_id=instance.household_id,
            entity_type=entity_type,
            object_id=object_id,
            chunk_index=index,
            content=chunk,
            embedding=vector,
            model=resolved_model,
            content_hash=new_hash,
        )
        for index, (chunk, vector) in enumerate(zip(chunks, response.vectors))
    ]
    with transaction.atomic():
        EmbeddingChunk.objects.filter(entity_type=entity_type, object_id=object_id).delete()
        EmbeddingChunk.objects.bulk_create(rows)
    return len(rows)


def remove_instance(instance: Model) -> int:
    """Purge the vector index of a (deleted) instance. Returns #chunks removed."""
    spec = find_spec_for_instance(instance)
    if spec is None:
        return 0
    return _delete_chunks(spec.entity_type, str(instance.pk))
