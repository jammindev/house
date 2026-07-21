"""Root pytest fixtures.

The suite runs with ``--nomigrations`` (see pytest.ini): migrations never run, so
the schema is synced directly from the models and our migration that enables the
pgvector ``vector`` extension (agent/0008) is skipped. ``agent.EmbeddingChunk``
has a ``vector`` column, so the type must exist *before* the test-database schema
is built.

We ensure it by creating the extension in ``template1`` — new databases (the
test DB included) clone ``template1`` — from ``django_db_modify_db_settings``,
which pytest-django runs *before* ``django_db_setup`` builds the schema. This is
the ``--nomigrations`` counterpart of what agent/0008 does for real migrations
(and what apps/agent/tests/conftest.py already does post-setup for ``unaccent``).
"""
import pytest


@pytest.fixture(scope="session")
def django_db_modify_db_settings(django_db_modify_db_settings):
    from django.conf import settings

    default = settings.DATABASES.get("default", {})
    if "postgresql" not in default.get("ENGINE", ""):
        return django_db_modify_db_settings

    import psycopg

    params = {
        "host": default.get("HOST") or "localhost",
        "port": str(default.get("PORT") or "5432"),
        "user": default.get("USER"),
        "password": default.get("PASSWORD"),
        "dbname": "template1",
    }
    conninfo = " ".join(f"{k}={v}" for k, v in params.items() if v)
    with psycopg.connect(conninfo, autocommit=True) as conn:
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
    return django_db_modify_db_settings
