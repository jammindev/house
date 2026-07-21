"""Root pytest fixtures.

The suite runs with ``--nomigrations`` (see pytest.ini): migrations never run, so
the schema is synced directly from the models and our migration that enables the
pgvector ``vector`` extension (agent/0008) is skipped. ``agent.EmbeddingChunk``
has a ``vector`` column, so the type must exist *before* the test-database schema
is built.

We ensure it from ``django_db_modify_db_settings`` (pytest-django runs it *before*
``django_db_setup`` builds the schema) by creating the extension in two places,
covering both DB-provisioning paths:

- **``template1``** — locally, ``--create-db`` creates a fresh test DB by cloning
  ``template1``, so the clone inherits the extension.
- **the target test DB itself** — in CI the DB already exists (the postgres image
  provisions ``POSTGRES_DB``), so it is *not* re-cloned; we add the extension
  directly. Missing-DB errors are ignored (the template1 path covers that case).

This is the ``--nomigrations`` counterpart of agent/0008 (and mirrors what
apps/agent/tests/conftest.py does post-setup for ``unaccent``).
"""
import pytest


def _create_vector_extension(host, port, user, password, dbname):
    import psycopg

    params = {
        "host": host or "localhost",
        "port": str(port or "5432"),
        "user": user,
        "password": password,
        "dbname": dbname,
    }
    conninfo = " ".join(f"{k}={v}" for k, v in params.items() if v)
    try:
        with psycopg.connect(conninfo, autocommit=True) as conn:
            conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
    except psycopg.OperationalError:
        # DB doesn't exist yet (it will be cloned from template1) — fine.
        pass


@pytest.fixture(scope="session")
def django_db_modify_db_settings(django_db_modify_db_settings):
    from django.conf import settings

    default = settings.DATABASES.get("default", {})
    if "postgresql" not in default.get("ENGINE", ""):
        return django_db_modify_db_settings

    host = default.get("HOST")
    port = default.get("PORT")
    user = default.get("USER")
    password = default.get("PASSWORD")
    test_name = (default.get("TEST") or {}).get("NAME") or f"test_{default.get('NAME')}"

    for dbname in ("template1", test_name):
        _create_vector_extension(host, port, user, password, dbname)

    return django_db_modify_db_settings
