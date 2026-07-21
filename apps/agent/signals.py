"""Keep the vector index in sync on entity writes (parcours 21 lot 1).

A single global receiver (no ``sender`` filter) rather than one per model: it
consults the ``searchables`` registry per save via ``find_spec_for_instance``, so
it is robust to registry-population order (no need for ``agent.ready()`` to run
after every feature app). Cheap early rejects (settings flag, HouseholdScoped
check) keep the per-save cost negligible.

Gated by ``settings.EMBEDDING_INDEXING_ENABLED`` (default off): the whole test
suite and any provider-less environment incur **zero** side effect. Best-effort:
an embedding provider outage never breaks the underlying save/delete — the vector
index is observability-grade, not business-critical.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.models import HouseholdScopedModel

from .indexing import reindex_instance, remove_instance
from .searchables import find_spec_for_instance

logger = logging.getLogger(__name__)


def _indexing_enabled() -> bool:
    return bool(getattr(settings, "EMBEDDING_INDEXING_ENABLED", False))


@receiver(post_save, dispatch_uid="agent_embeddings_reindex_on_save")
def reindex_on_save(sender, instance, **kwargs):
    if not _indexing_enabled() or not isinstance(instance, HouseholdScopedModel):
        return
    if find_spec_for_instance(instance) is None:
        return
    try:
        reindex_instance(instance)
    except Exception:  # best-effort: never break the save on an embedding failure
        logger.warning("embeddings: reindex on save failed for %r", instance, exc_info=True)


@receiver(post_delete, dispatch_uid="agent_embeddings_remove_on_delete")
def remove_on_delete(sender, instance, **kwargs):
    if not _indexing_enabled() or not isinstance(instance, HouseholdScopedModel):
        return
    if find_spec_for_instance(instance) is None:
        return
    try:
        remove_instance(instance)
    except Exception:
        logger.warning("embeddings: remove on delete failed for %r", instance, exc_info=True)
