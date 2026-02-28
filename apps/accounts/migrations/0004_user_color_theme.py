from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_user_theme_avatar"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="color_theme",
            field=models.CharField(
                max_length=30,
                choices=[
                    ("theme-house", "House"),
                    ("theme-blue", "Blue"),
                    ("theme-sass", "Sass"),
                    ("theme-sass2", "Sass 2"),
                    ("theme-sass3", "Sass 3"),
                    ("theme-purple", "Purple"),
                    ("theme-green", "Green"),
                    ("theme-crimson", "Crimson"),
                    ("theme-teal", "Teal"),
                    ("theme-amber", "Amber"),
                    ("theme-indigo", "Indigo"),
                    ("theme-rose", "Rose"),
                    ("theme-cyan", "Cyan"),
                    ("theme-slate", "Slate"),
                    ("theme-emerald", "Emerald"),
                    ("theme-lavender", "Lavender"),
                    ("theme-midnight", "Midnight"),
                ],
                default="theme-house",
                blank=True,
                help_text="User's preferred color palette",
            ),
        ),
    ]
