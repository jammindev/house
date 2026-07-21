"""Backfill the vector index (``EmbeddingChunk``) for existing searchable entities.

Write-time indexing (parcours 21 lot 1) only covers entities saved *after* it was
enabled. This command indexes the **existing** corpus, and re-indexes everything
after an embedding model/provider switch (``--force``). Mirror of
``documents.extract_documents_text`` (the OCR backfill).

Usage:

    python manage.py backfill_embeddings --dry-run              # count + cost, write nothing
    python manage.py backfill_embeddings --limit 50             # first 50 entities
    python manage.py backfill_embeddings --household <uuid>     # one household
    python manage.py backfill_embeddings --entity-type document # one entity type
    python manage.py backfill_embeddings --force                # re-embed all (model switch)
"""
from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from agent import indexing
from agent.embeddings import get_embedding_client
from agent.searchables import REGISTRY, find_spec

# Rough estimate only: ~4 chars/token, Voyage voyage-3 input ≈ $0.06 / 1M tokens.
# Used solely for the --dry-run cost hint, never for billing.
_CHARS_PER_TOKEN = 4
_USD_PER_1M_TOKENS = {"voyage": 0.06, "openai": 0.02}


class Command(BaseCommand):
    help = "Backfill the EmbeddingChunk vector index for existing searchable entities."

    def add_arguments(self, parser):
        parser.add_argument("--household", type=str, default=None, help="Restrict to one household id.")
        parser.add_argument(
            "--entity-type", type=str, default=None, help="Restrict to one registry entity_type."
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-embed even when content is unchanged (use after a model/provider switch).",
        )
        parser.add_argument("--limit", type=int, default=None, help="Max number of entities to process.")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Count entities and estimate cost; embed nothing, write nothing.",
        )

    def handle(self, *args, **options):
        entity_type = options["entity_type"]
        household = options["household"]
        force = options["force"]
        limit = options["limit"]
        dry_run = options["dry_run"]

        specs = [spec for spec in REGISTRY if spec.embed]
        if entity_type:
            spec = find_spec(entity_type)
            if spec is None:
                raise CommandError(f"Unknown entity_type: {entity_type!r}")
            if not spec.embed:
                raise CommandError(f"entity_type {entity_type!r} is not embeddable (embed=False).")
            specs = [spec]

        total = sum(self._queryset(spec, household).count() for spec in specs)
        if total == 0:
            self.stdout.write("Nothing to index.")
            return

        client = None if dry_run else get_embedding_client()
        processed = indexed = skipped = failed = 0
        total_chunks = total_chars = 0

        for spec in specs:
            for instance in self._queryset(spec, household).iterator():
                if limit is not None and processed >= limit:
                    break
                processed += 1

                text = indexing._full_content(instance, spec.search_fields)
                chunks = indexing.chunk_text(text)
                total_chunks += len(chunks)
                total_chars += sum(len(c) for c in chunks)

                if dry_run:
                    continue

                try:
                    written = indexing.reindex_instance(instance, client=client, force=force)
                    if written:
                        indexed += 1
                    else:
                        skipped += 1
                except Exception as exc:  # one bad entity must not abort the batch
                    failed += 1
                    self.stderr.write(f"  ! {spec.entity_type}:{instance.pk} failed: {exc}")

                if processed % 25 == 0 or processed == total:
                    self.stdout.write(f"  [{processed}/{total}] processed")
            if limit is not None and processed >= limit:
                break

        self._report(dry_run, processed, indexed, skipped, failed, total_chunks, total_chars)

    def _queryset(self, spec, household):
        qs = spec.model.objects.all()
        if household:
            qs = qs.filter(household_id=household)
        return qs

    def _report(self, dry_run, processed, indexed, skipped, failed, total_chunks, total_chars):
        est_tokens = total_chars // _CHARS_PER_TOKEN
        provider = getattr(settings, "EMBEDDING_PROVIDER", "voyage")
        rate = _USD_PER_1M_TOKENS.get(provider)
        if rate is None:
            cost = "0 $ (local)"
        else:
            cost = f"~${est_tokens / 1_000_000 * rate:.4f} ({provider})"

        if dry_run:
            self.stdout.write(
                f"[dry-run] {processed} entit(ies) → ~{total_chunks} chunk(s), "
                f"~{est_tokens} tokens, estimated cost {cost}. Nothing written."
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Done: {processed} processed — {indexed} indexed, {skipped} skipped, "
                f"{failed} failed. {total_chunks} chunk(s), estimated cost {cost}."
            )
        )
