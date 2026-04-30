from django.apps import AppConfig


class StockConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "stock"

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from .models import StockItem

        register(SearchableSpec(
            entity_type='stock_item',
            model=StockItem,
            search_fields=('name', 'description', 'notes', 'supplier'),
            label_attr='name',
            url_template='/app/stock/{id}',
        ))
