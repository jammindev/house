"""Evaluate retrieval quality across modes (parcours 21 lot 4).

Runs a golden set of questions through the lexical, semantic and hybrid legs and
reports recall@k + MRR per mode, so the hybrid gain (and any regression on
exact-keyword queries) is measured on the real corpus rather than guessed. Also
the arbiter for turning `AGENT_HYBRID_RETRIEVAL_ENABLED` on by default.

Golden file: JSON list of ``{"question": str, "expected": ["entity_type:id", ...]}``.

    python manage.py eval_retrieval --household <uuid> --queries golden.json --mode all
"""
from __future__ import annotations

import json

from django.core.management.base import BaseCommand, CommandError
from django.test import override_settings

from agent import retrieval
from agent.eval.metrics import evaluate

_MODES = ("fulltext", "vector", "hybrid")


class Command(BaseCommand):
    help = "Evaluate retrieval (recall@k, MRR) for fulltext / vector / hybrid."

    def add_arguments(self, parser):
        parser.add_argument("--household", required=True, help="Household id to evaluate against.")
        parser.add_argument(
            "--queries", required=True, help='JSON [{"question": ..., "expected": [...]}].'
        )
        parser.add_argument("--mode", choices=(*_MODES, "all"), default="all")
        parser.add_argument("--k", type=int, default=10)

    def handle(self, *args, **options):
        household_id = options["household"]
        k = options["k"]
        modes = _MODES if options["mode"] == "all" else (options["mode"],)

        try:
            with open(options["queries"], encoding="utf-8") as fh:
                golden = json.load(fh)
        except (OSError, ValueError) as exc:
            raise CommandError(f"Could not read --queries: {exc}") from exc
        if not isinstance(golden, list) or not golden:
            raise CommandError("--queries must be a non-empty JSON list.")

        self.stdout.write(f"Evaluating {len(golden)} question(s), k={k}\n")
        self.stdout.write(f"{'mode':<10} {'queries':>8} {'recall@k':>10} {'mrr':>8}")
        self.stdout.write("-" * 40)
        for mode in modes:
            runs = [
                (self._retrieve(mode, household_id, entry.get("question", ""), k),
                 entry.get("expected", []))
                for entry in golden
            ]
            m = evaluate(runs, k)
            self.stdout.write(
                f"{mode:<10} {m['queries']:>8} {m['recall_at_k']:>10.3f} {m['mrr']:>8.3f}"
            )

    def _retrieve(self, mode, household_id, question, k) -> list[str]:
        if mode == "vector":
            hits = retrieval._vector_search(household_id, question, k)
        else:
            with override_settings(AGENT_HYBRID_RETRIEVAL_ENABLED=(mode == "hybrid")):
                hits = retrieval.search(household_id, question, limit=k)
        return [f"{h.entity_type}:{h.id}" for h in hits]
