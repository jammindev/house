from django.http import Http404
from django.urls import reverse

from core.views import ReactPageView

from .models import Zone


class AppZonesView(ReactPageView):
    react_root_id = "zones-root"
    props_script_id = "zones-page-props"
    page_vite_asset = "src/pages/zones/list.tsx"

    def get_props(self):
        return {}


class AppZoneDetailView(ReactPageView):
    template_name = 'zones/app/zone_detail.html'
    react_root_id = "zone-detail-root"
    props_script_id = "zone-detail-page-props"
    page_vite_asset = "src/pages/zones/detail.tsx"

    def _fetch_zone(self):
        if not hasattr(self, '_zone_cache'):
            selected_household = self.request.household
            zone_id = self.kwargs['zone_id']
            queryset = Zone.objects.for_user_households(self.request.user).select_related('parent')
            if selected_household:
                queryset = queryset.filter(household=selected_household)
            zone = queryset.filter(id=zone_id).first()
            if not zone:
                raise Http404('Zone not found')
            photos_count = zone.zonedocument_set.filter(role='photo').count()
            children_count = zone.children.count()
            self._zone_cache = (zone, children_count, photos_count)
        return self._zone_cache

    def get_props(self):
        zone, _children_count, _photos_count = self._fetch_zone()
        interaction_new_url = reverse('app_interaction_new')
        zone_id_str = str(zone.id)
        return {
            'zoneId': zone_id_str,
            'createActivityUrl': f"{interaction_new_url}?zone_ids={zone_id_str}",
            'createTaskUrl': f"{interaction_new_url}?type=todo&zone_ids={zone_id_str}",
        }

    def get_context_data(self, **kwargs):
        zone, children_count, photos_count = self._fetch_zone()
        ctx = super().get_context_data(**kwargs)
        ctx.update({
            'zone': zone,
            'children_count': children_count,
            'photos_count': photos_count,
        })
        return ctx
