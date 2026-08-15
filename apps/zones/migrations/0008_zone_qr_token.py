"""Ancrage physique d'une zone — le jeton imprimé sur son étiquette QR (parcours 31).

⚠️ **Trois opérations, et pas une seule `AddField`.** Django n'évalue le `default`
d'une `AddField` qu'**une fois** : il pose la même valeur sur toutes les lignes
existantes par un unique ``ALTER TABLE ... SET DEFAULT``. Avec un `default`
appelable et une contrainte d'unicité, ça donne soit une violation d'unicité, soit
— si l'unicité arrivait plus tard — **le même jeton pour toutes les zones du
foyer**, c'est-à-dire une maison entière réduite à une seule pièce aux yeux du jeu.
Le seul remplissage correct **boucle sur les lignes**.

Régression : ``apps/zones/tests/test_qr_anchor.py::TestTheBackfillGivesEachZoneItsOwnToken``.
"""
from django.db import migrations, models

import zones.models


def assign_tokens(apps, schema_editor):
    """Give every existing zone its own token, one row at a time."""
    Zone = apps.get_model('zones', 'Zone')
    for zone in Zone.objects.filter(qr_token__isnull=True).iterator():
        zone.qr_token = zones.models.generate_zone_token()
        zone.save(update_fields=['qr_token'])


def drop_tokens(apps, schema_editor):
    """Reverse: the column goes away with the AddField, nothing to undo here."""


class Migration(migrations.Migration):

    dependencies = [
        ('zones', '0007_alter_zone_options_zone_position_and_more'),
    ]

    operations = [
        # 1. La colonne arrive permissive : ni unique, ni obligatoire.
        migrations.AddField(
            model_name='zone',
            name='qr_token',
            field=models.CharField(
                max_length=64,
                null=True,
                editable=False,
                help_text="Opaque token encoded in the zone's printed QR label",
            ),
        ),
        # 2. Un jeton distinct par ligne.
        migrations.RunPython(assign_tokens, drop_tokens),
        # 3. Et seulement maintenant, les garanties.
        migrations.AlterField(
            model_name='zone',
            name='qr_token',
            field=models.CharField(
                max_length=64,
                unique=True,
                editable=False,
                default=zones.models.generate_zone_token,
                help_text="Opaque token encoded in the zone's printed QR label",
            ),
        ),
    ]
