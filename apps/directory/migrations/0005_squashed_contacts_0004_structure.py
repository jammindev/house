# Squashed migration to handle app rename from contacts to directory
# This migration replaces all contacts migrations and ensures Django knows about it

import django.contrib.postgres.fields
from django.conf import settings
import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    replaces = [
        ('contacts', '0001_initial'),
        ('contacts', '0002_initial'),
        ('contacts', '0003_alter_contact_options'),
        ('contacts', '0004_structure'),
    ]

    dependencies = [
        ('households', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Contact',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('first_name', models.TextField(default='')),
                ('last_name', models.TextField(default='')),
                ('position', models.TextField(blank=True, default='')),
                ('notes', models.TextField(blank=True, default='')),
                ('created_by', models.ForeignKey(blank=True, db_column='created_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('household', models.ForeignKey(db_column='household_id', on_delete=django.db.models.deletion.CASCADE, related_name='%(class)s_set', to='households.household')),
                ('updated_by', models.ForeignKey(blank=True, db_column='updated_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'contacts',
                'verbose_name': 'contact',
                'verbose_name_plural': 'contacts',
                'ordering': ['last_name', 'first_name', 'created_at'],
                'indexes': [models.Index(fields=['household', 'last_name'], name='idx_contacts_hh_last'), models.Index(fields=['structure'], name='idx_contacts_structure')],
            },
        ),
        migrations.CreateModel(
            name='Structure',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.TextField(default='')),
                ('type', models.TextField(blank=True, default='')),
                ('description', models.TextField(blank=True, default='')),
                ('website', models.TextField(blank=True, default='')),
                ('tags', django.contrib.postgres.fields.ArrayField(base_field=models.TextField(), blank=True, default=list, size=None)),
                ('created_by', models.ForeignKey(blank=True, db_column='created_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('household', models.ForeignKey(db_column='household_id', on_delete=django.db.models.deletion.CASCADE, related_name='%(class)s_set', to='households.household')),
                ('updated_by', models.ForeignKey(blank=True, db_column='updated_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'structures',
                'ordering': ['name', 'created_at'],
                'indexes': [models.Index(fields=['household', 'name'], name='idx_struct_hh_name')],
            },
        ),
        migrations.CreateModel(
            name='Address',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('address_1', models.TextField(default='')),
                ('address_2', models.TextField(blank=True, default='')),
                ('zipcode', models.TextField(blank=True, default='')),
                ('city', models.TextField(blank=True, default='')),
                ('country', models.TextField(blank=True, default='')),
                ('label', models.TextField(blank=True, default='')),
                ('is_primary', models.BooleanField(default=False)),
                ('contact', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='addresses', to='directory.contact')),
                ('created_by', models.ForeignKey(blank=True, db_column='created_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('household', models.ForeignKey(db_column='household_id', on_delete=django.db.models.deletion.CASCADE, related_name='%(class)s_set', to='households.household')),
                ('structure', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='addresses', to='directory.structure')),
                ('updated_by', models.ForeignKey(blank=True, db_column='updated_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'addresses',
                'ordering': ['-is_primary', 'created_at'],
                'indexes': [models.Index(fields=['household', 'contact'], name='idx_addr_hh_contact'), models.Index(fields=['household', 'structure'], name='idx_addr_hh_structure')],
            },
        ),
        migrations.CreateModel(
            name='Email',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('email', models.EmailField(max_length=254)),
                ('label', models.TextField(blank=True, default='')),
                ('is_primary', models.BooleanField(default=False)),
                ('contact', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='emails', to='directory.contact')),
                ('created_by', models.ForeignKey(blank=True, db_column='created_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('household', models.ForeignKey(db_column='household_id', on_delete=django.db.models.deletion.CASCADE, related_name='%(class)s_set', to='households.household')),
                ('structure', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='emails', to='directory.structure')),
                ('updated_by', models.ForeignKey(blank=True, db_column='updated_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'emails',
                'ordering': ['-is_primary', 'created_at'],
                'indexes': [models.Index(fields=['household', 'email'], name='idx_email_hh_email')],
            },
        ),
        migrations.CreateModel(
            name='Phone',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('phone', models.TextField()),
                ('label', models.TextField(blank=True, default='')),
                ('is_primary', models.BooleanField(default=False)),
                ('contact', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='phones', to='directory.contact')),
                ('created_by', models.ForeignKey(blank=True, db_column='created_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('household', models.ForeignKey(db_column='household_id', on_delete=django.db.models.deletion.CASCADE, related_name='%(class)s_set', to='households.household')),
                ('structure', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='phones', to='directory.structure')),
                ('updated_by', models.ForeignKey(blank=True, db_column='updated_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'phones',
                'ordering': ['-is_primary', 'created_at'],
                'indexes': [models.Index(fields=['household', 'phone'], name='idx_phone_hh_phone')],
            },
        ),
        migrations.AddField(
            model_name='contact',
            name='structure',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='contacts', to='directory.structure'),
        ),
    ]
