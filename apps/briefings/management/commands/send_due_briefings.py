"""
Scheduler tick for briefings (parcours 23 lot 3).

One-shot by default (cron-friendly); ``--loop`` keeps the process alive and ticks
every ``--interval`` seconds — that's how the ``scheduler-briefings`` container of
``docker-compose.prod.yml`` runs it. All logic lives in ``briefings.scheduler``.
Mirrors ``pings.management.commands.send_scheduled_pings``.
"""
from __future__ import annotations

import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from briefings.scheduler import send_due_briefings


class Command(BaseCommand):
    help = "Send every briefing whose scheduled slot is due (idempotent tick)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--loop",
            action="store_true",
            help="Run forever, ticking every --interval seconds.",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=300,
            help="Seconds between ticks in --loop mode (default: 300).",
        )

    def handle(self, *args, **options):
        if not options["loop"]:
            self._tick()
            return
        interval = max(30, options["interval"])
        self.stdout.write(f"briefings scheduler: ticking every {interval}s")
        while True:
            self._tick()
            time.sleep(interval)

    def _tick(self):
        close_old_connections()
        summary = send_due_briefings()
        self.stdout.write(
            "tick: sent={sent} skipped_no_telegram={skipped_no_telegram} "
            "errors={errors}".format(**summary)
        )
