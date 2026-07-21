"""Enable the pgvector extension used by the hybrid semantic retrieval (parcours 21).

`CREATE EXTENSION vector` — the vector column type + k-NN operators. Mirrors the
`UnaccentExtension` bootstrap in 0001_initial.py. Requires the extension to be
available on the Postgres server (image `pgvector/pgvector:pg16` in CI/prod; built
from source for local Homebrew — see docs/parcours/PARCOURS_21_BACKLOG_TECHNIQUE.md).
"""
from pgvector.django import VectorExtension

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("agent", "0007_agentconversation_web_search_enabled"),
    ]

    operations = [
        VectorExtension(),
    ]
