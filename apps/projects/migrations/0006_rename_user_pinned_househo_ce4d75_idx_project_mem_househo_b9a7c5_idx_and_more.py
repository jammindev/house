from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0005_rename_user_pinned_househo_ce4d75_idx_project_mem_househo_b9a7c5_idx_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RenameIndex(
                    model_name='userpinnedproject',
                    new_name='project_mem_househo_b9a7c5_idx',
                    old_name='user_pinned_househo_ce4d75_idx',
                ),
                migrations.RenameIndex(
                    model_name='userpinnedproject',
                    new_name='project_mem_project_8c58d8_idx',
                    old_name='user_pinned_project_b643ce_idx',
                ),
            ],
        ),
    ]