from django.apps import AppConfig


class DirectoryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "directory"

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from .models import Contact, Structure

        register(SearchableSpec(
            entity_type='contact',
            model=Contact,
            search_fields=('first_name', 'last_name', 'notes'),
            label_attr=lambda c: f"{c.first_name} {c.last_name}".strip() or str(c.id),
            url_template='/app/directory/{id}',
        ))

        register(SearchableSpec(
            entity_type='structure',
            model=Structure,
            search_fields=('name', 'description'),
            label_attr='name',
            url_template='/app/directory/structures/{id}',
        ))
