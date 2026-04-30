"""Shared fixtures for agent tests.

`pytest --nomigrations` skips our 0001_initial migration that bootstraps the
`unaccent` extension and `simple_unaccent` text-search configuration, so we
recreate them at session start when running the agent tests.
"""
import pytest
from django.db import connection


@pytest.fixture(scope="session", autouse=True)
def _agent_text_search_config(django_db_setup, django_db_blocker):
    if connection.vendor != "postgresql":
        return
    with django_db_blocker.unblock():
        with connection.cursor() as cursor:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS unaccent;")
            cursor.execute(
                """
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
            )


@pytest.fixture
def household(db):
    from households.models import Household
    return Household.objects.create(name="Test household")


@pytest.fixture
def other_household(db):
    from households.models import Household
    return Household.objects.create(name="Other household")
