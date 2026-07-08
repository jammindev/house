"""
Step 2/2 of dropping `Interaction.project` (see #131): remove the FK + index
now that 0016 copied the data into the polymorphic source columns.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('interactions', '0016_drop_interaction_project_fk'),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name='interaction',
            name='idx_int_project',
        ),
        migrations.RemoveField(
            model_name='interaction',
            name='project',
        ),
    ]
