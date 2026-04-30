from django.apps import AppConfig


class DocumentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'documents'

    def ready(self):
        import documents.signals  # noqa: F401

        from agent.searchables import SearchableSpec, register
        from .models import Document

        register(SearchableSpec(
            entity_type='document',
            model=Document,
            search_fields=('name', 'notes', 'ocr_text'),
            label_attr='name',
            url_template='/app/documents/{id}',
        ))
