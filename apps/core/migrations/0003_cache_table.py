"""Crée la table de cache lue par `CACHES['default']`.

Elle est posée par une **migration**, pas par une commande à lancer à la main :
sans elle, `django.core.cache` lève à la première requête throttlée, donc l'API
entière tombe. Faire dépendre le démarrage d'une étape manuelle transformerait le
durcissement du débit en panne au premier deploy — et chez un auto-hébergeur, en
panne dès le premier `docker compose up`.

`createcachetable` est idempotent (il vérifie l'existence avant de créer) et
connaît le dialecte de chaque base, ce qu'un `RunSQL` écrit à la main ne ferait
que pour Postgres.

⚠️ **Le nom de la table est passé explicitement.** Sans argument, la commande lit
`settings.CACHES` et ne crée que les tables des caches *actuellement* configurés
en base — donc rien du tout sous les réglages de test, qui utilisent
`LocMemCache`. La migration devenait alors muette selon l'environnement où on la
jouait : verte partout, sans table nulle part. Une migration décrit un schéma,
elle ne lit pas un réglage.
"""
from django.core.management import call_command
from django.db import migrations

CACHE_TABLE = "django_cache"


def create_cache_table(apps, schema_editor):
    call_command(
        "createcachetable",
        CACHE_TABLE,
        database=schema_editor.connection.alias,
        verbosity=0,
    )


def drop_cache_table(apps, schema_editor):
    # Le cache est reconstructible par nature : rien à sauver au retour arrière.
    schema_editor.execute(f"DROP TABLE IF EXISTS {CACHE_TABLE}")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_delete_systemadmin"),
    ]

    operations = [
        migrations.RunPython(create_cache_table, drop_cache_table),
    ]
