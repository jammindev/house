"""
Project override of Django's ``makemessages``.

The virtualenv (``venv/``) and JS deps (``node_modules/``) live inside the repo,
so the stock command scans them and pollutes our ``.po`` files with hundreds of
``#:`` references to third-party source (Django, DRF…). Those strings are
already translated by their own packages — we never want them in ours.

Rather than rely on everyone remembering ``--ignore=venv --ignore=node_modules``
on every run (forgetting it once is what filled the files with noise), we bake
those defaults in here. Explicit ``--ignore`` flags still add to the list.
"""
from __future__ import annotations

from django.core.management.commands import makemessages

# Directories that live in the repo but must never be scanned for strings.
DEFAULT_IGNORE_PATTERNS = ["venv", "node_modules", "htmlcov", ".venv"]


class Command(makemessages.Command):
    def handle(self, *args, **options):
        for pattern in DEFAULT_IGNORE_PATTERNS:
            if pattern not in options["ignore_patterns"]:
                options["ignore_patterns"].append(pattern)
        super().handle(*args, **options)
