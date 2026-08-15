from django.apps import AppConfig


class DirectoryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "directory"

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from .models import Contact, Structure

        # `?contact=` / `?structure=` and not `/{id}`: the directory has **no
        # detail route** — contacts and structures are cards plus dialogs. Both
        # templates pointed at pages that have never existed, so every citation
        # and every palette result landed on the app's 404. A query param on the
        # page that does exist is the shape used everywhere else for an entity
        # without a page of its own.
        register(SearchableSpec(
            entity_type='contact',
            module='directory',
            model=Contact,
            search_fields=('first_name', 'last_name', 'notes'),
            label_attr=lambda c: f"{c.first_name} {c.last_name}".strip() or str(c.id),
            url_template='/app/directory?contact={id}',
        ))

        register(SearchableSpec(
            entity_type='structure',
            module='directory',
            model=Structure,
            search_fields=('name', 'description'),
            label_attr='name',
            url_template='/app/directory?structure={id}',
        ))
