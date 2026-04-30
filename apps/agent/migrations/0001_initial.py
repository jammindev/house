"""Bootstrap the Postgres text search configuration used by the agent retrieval.

We use a `simple_unaccent` configuration — a copy of `simple` (no stemming, no
stopwords, multi-tenant safe) augmented with `unaccent` so that café/cafe and
Engie/ENGIE compare equal. Stemming per language can be layered on top later
via `Household.preferred_language` without breaking existing queries.
"""
from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


CREATE_CONFIG_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'simple_unaccent'
    ) THEN
        CREATE TEXT SEARCH CONFIGURATION simple_unaccent (COPY = simple);
        ALTER TEXT SEARCH CONFIGURATION simple_unaccent
            ALTER MAPPING FOR hword, hword_part, word
            WITH unaccent, simple;
    END IF;
END
$$;
"""

DROP_CONFIG_SQL = "DROP TEXT SEARCH CONFIGURATION IF EXISTS simple_unaccent;"


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        UnaccentExtension(),
        migrations.RunSQL(sql=CREATE_CONFIG_SQL, reverse_sql=DROP_CONFIG_SQL),
    ]
