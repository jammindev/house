"""
Migration: Add theme and avatar fields to User model.
Generated for: 001-settings-migration
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_user_avatar_url_user_display_name_user_locale_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='theme',
            field=models.CharField(
                max_length=20,
                choices=[('light', 'Light'), ('dark', 'Dark'), ('system', 'System')],
                default='system',
                blank=True,
                help_text="User's preferred theme",
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='avatar',
            field=models.ImageField(
                upload_to='avatars/',
                null=True,
                blank=True,
                help_text="User's avatar image file",
            ),
        ),
    ]
