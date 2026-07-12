"""
Scheduler tick for proactive pings.

One-shot by default (cron-friendly); ``--loop`` keeps the process alive and
ticks every ``--interval`` seconds — that's how the ``scheduler`` container of
``docker-compose.prod.yml`` runs it. The command holds zero logic: everything
(due-time, dedup, module gating, delivery) lives in ``pings.services``.
"""
from __future__ import annotations

import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from pings.services import send_due_pings


class Command(BaseCommand):
    help = "Send every proactive ping that is due (idempotent tick)."

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
        self.stdout.write(f"pings scheduler: ticking every {interval}s")
        while True:
            self._tick()
            time.sleep(interval)

    def _tick(self):
        close_old_connections()
        summary = send_due_pings()
        self.stdout.write(
            "tick: sent={sent} skipped={skipped} errors={errors}".format(**summary)
        )
