from django.apps import AppConfig


class InsuranceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "insurance"

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from .models import InsuranceContract

        register(SearchableSpec(
            entity_type='insurance_contract',
            model=InsuranceContract,
            search_fields=('name', 'provider', 'coverage_summary', 'notes'),
            label_attr='name',
            url_template='/app/insurance/{id}',
        ))
