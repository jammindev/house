"""L'intention d'une photo — le champ seul, **sans backfill**.

Il serait tentant de marquer `technical` toute photo déjà liée à un projet ou à un
équipement. Ce serait écrire une devinette en base, où elle deviendrait
indistinguable d'un choix de l'utilisateur — exactement ce que `banking.rules`
interdit (« des valeurs de départ, jamais des vérités »).

Tout l'existant part donc dans « À trier ». La contrepartie est assumée, et rendue
tenable par le tri **par grappe** : quelques centaines de photos représentent
quelques dizaines de gestes, pas quelques centaines.
"""

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0008_document_taken_at'),
        ('households', '0012_invitation_shareable_link'),
        ('interactions', '0030_backfill_suppliers'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='purpose',
            field=models.CharField(blank=True, choices=[('technical', 'Technical'), ('observation', 'Observation'), ('memory', 'Memory')], default='', help_text='Why this photo exists. Empty = nobody sorted it yet, never a fallback.', max_length=16),
        ),
        migrations.AddIndex(
            model_name='document',
            index=models.Index(fields=['household', 'purpose'], name='idx_docs_hh_purpose'),
        ),
    ]
