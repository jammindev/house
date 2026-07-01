"""Delete agent conversations that are past the retention window.

Conversations (and their messages, via cascade) untouched for longer than the
retention window are removed. Retention defaults to
``settings.AGENT_CONVERSATION_RETENTION_DAYS`` and can be overridden per run.

Usage:

    python manage.py cleanup_agent_conversations                 # use the settings default
    python manage.py cleanup_agent_conversations --days 90       # override the window
    python manage.py cleanup_agent_conversations --dry-run       # report only, delete nothing
"""
from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from agent.retention import delete_stale_conversations


class Command(BaseCommand):
    help = "Delete agent conversations older than the retention window."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="Retention window in days (defaults to AGENT_CONVERSATION_RETENTION_DAYS).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report how many conversations would be deleted, change nothing.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        if days is None:
            days = getattr(settings, "AGENT_CONVERSATION_RETENTION_DAYS", 0)
        if days < 0:
            raise CommandError("--days must be zero or positive.")

        if days == 0:
            self.stdout.write("Retention disabled (days=0) — nothing to do.")
            return

        dry_run = options["dry_run"]
        count = delete_stale_conversations(days, dry_run=dry_run)

        if dry_run:
            self.stdout.write(
                f"[dry-run] {count} conversation(s) older than {days} day(s) would be deleted."
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Deleted {count} conversation(s) older than {days} day(s)."
                )
            )
