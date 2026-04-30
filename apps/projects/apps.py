from django.apps import AppConfig


class ProjectsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "projects"

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from .models import Project

        register(SearchableSpec(
            entity_type='project',
            model=Project,
            search_fields=('title', 'description'),
            label_attr='title',
            url_template='/app/projects/{id}',
        ))
