from django.apps import AppConfig


def _project_related(project):
    """Every household item linked to a project, for the `get_related` agent tool.

    Walks the reverse relations to gather the project's documents, expenses /
    interactions, tasks and zones. Each returned instance is turned into a
    citable Hit through its own registered spec (unregistered types are skipped).
    """
    items = []
    items.extend(
        pd.document for pd in project.project_documents.select_related("document")
    )
    items.extend(project.interactions.all())
    items.extend(project.tasks.all())
    items.extend(pz.zone for pz in project.project_zones.select_related("zone"))
    return items


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
            related=_project_related,
        ))
