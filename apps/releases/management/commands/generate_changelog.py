"""Génère le changelog depuis le git log.

Exemples :
    python manage.py generate_changelog                # incrémental (nouveaux commits)
    python manage.py generate_changelog --all          # backfill tout l'historique
    python manage.py generate_changelog --no-llm       # sans repolissage IA
    python manage.py generate_changelog --dry-run      # parse + affiche, n'écrit rien
    python manage.py generate_changelog --rebuild      # purge puis reconstruit tout
"""
from django.core.management.base import BaseCommand

from releases.models import ChangelogEntry
from releases.services import (
    generate_changelog,
    parse_git_log,
    read_git_log,
)


class Command(BaseCommand):
    help = "Génère les entrées de changelog depuis le git log conventional-commit."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all",
            action="store_true",
            help="Traiter tout l'historique (au lieu de l'incrémental).",
        )
        parser.add_argument(
            "--rebuild",
            action="store_true",
            help="Purger toutes les entrées existantes avant de reconstruire.",
        )
        parser.add_argument(
            "--no-llm",
            action="store_true",
            help="Ne pas repolir via l'IA — garder les descriptions brutes.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parser et afficher sans rien écrire ni appeler l'IA.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Limiter au N commits les plus récents.",
        )

    def handle(self, *args, **options):
        if options["dry_run"]:
            raw = read_git_log(limit=options["limit"])
            commits = parse_git_log(raw)
            self.stdout.write(f"{len(commits)} commit(s) retenu(s) :")
            for c in commits:
                pr = f" (#{c.pr_number})" if c.pr_number else ""
                self.stdout.write(
                    f"  [{c.change_type}] {c.module}: {c.description}{pr}"
                )
            return

        if options["rebuild"]:
            deleted, _ = ChangelogEntry.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"{deleted} entrée(s) supprimée(s)."))

        since = None if (options["all"] or options["rebuild"]) else "auto"
        created = generate_changelog(
            since_sha=since,
            limit=options["limit"],
            use_llm=not options["no_llm"],
        )
        self.stdout.write(
            self.style.SUCCESS(f"{len(created)} nouvelle(s) entrée(s) de changelog.")
        )
