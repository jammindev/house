from django.apps import AppConfig


class InsuranceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "insurance"

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from .models import InsuranceContract

        register(SearchableSpec(
            entity_type='insurance_contract',
            module='insurance',
            model=InsuranceContract,
            search_fields=('name', 'provider', 'coverage_summary', 'notes'),
            label_attr='name',
            # No `/app/insurance/:id` route exists — contracts are cards plus a
            # dialog. `/{id}` sent every citation to the app's 404.
            url_template='/app/insurance?contract={id}',
        ))
