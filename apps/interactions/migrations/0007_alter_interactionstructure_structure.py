# Generated manually for merging structures app into contacts app

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('interactions', '0006_alter_interaction_options'),
        ('directory', '0005_squashed_contacts_0004_structure'),
    ]

    operations = [
        migrations.AlterField(
            model_name='interactionstructure',
            name='structure',
            field=models.ForeignKey(db_column='structure_id', on_delete=django.db.models.deletion.CASCADE, related_name='interaction_structures', to='directory.structure'),
        ),
    ]
