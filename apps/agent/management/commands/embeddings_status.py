"""Report vector-index coverage per searchable entity (parcours 21 lot 4).

Shows, for each embeddable entity type, how many source entities exist, how many
are indexed, and how many are stale (embedded by a model other than the current
``EMBEDDING_MODEL`` — a signal that a `backfill_embeddings --force` is due after a
model/provider switch).

    python manage.py embeddings_status [--household <uuid>]
"""
from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand

from agent.models import EmbeddingChunk
from agent.searchables import REGISTRY


class Command(BaseCommand):
    help = "Report EmbeddingChunk index coverage per searchable entity type."

    def add_arguments(self, parser):
        parser.add_argument("--household", default=None, help="Restrict to one household id.")

    def handle(self, *args, **options):
        household = options["household"]
        current_model = getattr(settings, "EMBEDDING_MODEL", "")
        self.stdout.write(f"Current embedding model: {current_model or '(unset)'}")
        self.stdout.write(f"{'entity_type':<20} {'total':>7} {'indexed':>8} {'stale':>7}")
        self.stdout.write("-" * 46)

        totals = {"total": 0, "indexed": 0, "stale": 0}
        for spec in REGISTRY:
            if not spec.embed:
                continue
            source_qs = spec.model.objects.all()
            chunk_qs = EmbeddingChunk.objects.filter(entity_type=spec.entity_type)
            if household:
                source_qs = source_qs.filter(household_id=household)
                chunk_qs = chunk_qs.filter(household_id=household)

            total = source_qs.count()
            indexed = chunk_qs.values("object_id").distinct().count()
            stale = (
                chunk_qs.exclude(model=current_model).values("object_id").distinct().count()
            )
            totals["total"] += total
            totals["indexed"] += indexed
            totals["stale"] += stale
            self.stdout.write(f"{spec.entity_type:<20} {total:>7} {indexed:>8} {stale:>7}")

        self.stdout.write("-" * 46)
        self.stdout.write(
            f"{'TOTAL':<20} {totals['total']:>7} {totals['indexed']:>8} {totals['stale']:>7}"
        )
