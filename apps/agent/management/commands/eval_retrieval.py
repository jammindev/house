"""Evaluate retrieval quality across modes (parcours 21 lot 4).

Runs a golden set of questions through the lexical, semantic and hybrid legs and
reports recall@k + MRR per mode, so the hybrid gain (and any regression on
exact-keyword queries) is measured on the real corpus rather than guessed. The
arbiter for turning `AGENT_HYBRID_RETRIEVAL_ENABLED` on by default.

Two ways to supply the golden set:

- **`--queries golden.json`** — a hand-written JSON list of
  ``{"question": str, "expected": ["entity_type:id", ...]}``.
- **`--auto N`** — build it automatically: sample N real entities, have the LLM
  write a natural question each answers (expected = that entity). No manual
  labelling; a "self-retrieval" proxy, fair because the three modes run on the
  exact same questions. Save it with ``--auto-out`` to inspect/reuse.

    python manage.py eval_retrieval --household <uuid> --queries golden.json --mode all
    python manage.py eval_retrieval --household <uuid> --auto 15 --auto-out golden.json
"""
from __future__ import annotations

import json
import random

from django.core.management.base import BaseCommand, CommandError
from django.test import override_settings

from agent import retrieval
from agent.eval.metrics import evaluate

_MODES = ("fulltext", "vector", "hybrid")

_QUESTION_SYSTEM = (
    "Tu génères UNE question courte et naturelle, en français, qu'un membre du "
    "foyer pourrait poser à son assistant et à laquelle le document fourni répond. "
    "Écris comme une vraie personne (tu peux reformuler, ne recopie pas le texte "
    "mot pour mot). Réponds UNIQUEMENT par la question, sans guillemets ni préambule."
)


class Command(BaseCommand):
    help = "Evaluate retrieval (recall@k, MRR) for fulltext / vector / hybrid."

    def add_arguments(self, parser):
        parser.add_argument("--household", required=True, help="Household id to evaluate against.")
        parser.add_argument(
            "--queries", default=None, help='JSON [{"question": ..., "expected": [...]}].'
        )
        parser.add_argument(
            "--auto", type=int, default=None, help="Auto-build the golden from N sampled entities."
        )
        parser.add_argument("--auto-out", default=None, help="Save the auto-built golden to this path.")
        parser.add_argument("--mode", choices=(*_MODES, "all"), default="all")
        parser.add_argument("--k", type=int, default=10)

    def handle(self, *args, **options):
        household_id = options["household"]
        k = options["k"]
        modes = _MODES if options["mode"] == "all" else (options["mode"],)

        if bool(options["queries"]) == bool(options["auto"]):
            raise CommandError("Provide exactly one of --queries <path> or --auto <N>.")

        if options["auto"]:
            golden = self._build_auto_golden(household_id, options["auto"])
            if options["auto_out"]:
                with open(options["auto_out"], "w", encoding="utf-8") as fh:
                    json.dump(golden, fh, ensure_ascii=False, indent=2)
                self.stdout.write(f"Auto-golden ({len(golden)}) saved to {options['auto_out']}")
        else:
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

    def _build_auto_golden(self, household_id, n) -> list[dict]:
        """Sample N entities and let the LLM write a question each answers."""
        from agent.llm import LLMError, get_llm_client
        from agent.searchables import REGISTRY

        candidates = []
        for spec in REGISTRY:
            if not spec.embed:
                continue
            for instance in spec.model.objects.filter(household_id=household_id):
                text = retrieval._full_content(instance, spec.search_fields).strip()
                if text:
                    candidates.append((spec, instance, text))
        if not candidates:
            raise CommandError("No embeddable entities with text in this household — index some first.")

        random.shuffle(candidates)
        client = get_llm_client()
        golden: list[dict] = []
        last_error: Exception | None = None
        for spec, instance, text in candidates[:n]:
            try:
                resp = client.complete(
                    system=_QUESTION_SYSTEM,
                    user=text[:800],
                    feature="eval_autogolden",
                    household_id=household_id,
                    max_tokens=60,
                )
            except LLMError as exc:
                last_error = exc
                continue
            question = resp.text.strip().strip('"').strip()
            if question:
                golden.append(
                    {"question": question, "expected": [f"{spec.entity_type}:{instance.pk}"]}
                )
        if not golden:
            raise CommandError(
                "Could not generate any question via the LLM — check the LLM provider "
                f"(ANTHROPIC_API_KEY / LLM_PROVIDER). Last error: {last_error}"
            )
        return golden

    def _retrieve(self, mode, household_id, question, k) -> list[str]:
        if mode == "vector":
            hits = retrieval._vector_search(household_id, question, k)
        else:
            with override_settings(AGENT_HYBRID_RETRIEVAL_ENABLED=(mode == "hybrid")):
                hits = retrieval.search(household_id, question, limit=k)
        return [f"{h.entity_type}:{h.id}" for h in hits]
