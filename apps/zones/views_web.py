from django.http import Http404
from django.utils.translation import gettext_lazy as _

from core.permissions import resolve_request_household
from core.views import ReactPageView

from .models import Zone


def _resolve_selected_household(request):
    selected_household = resolve_request_household(request, required=False)
    if selected_household:
        return selected_household
    membership = (
        request.user.householdmember_set
        .select_related('household')
        .order_by('household__name')
        .first()
    )
    return membership.household if membership else None


class AppZonesView(ReactPageView):
    page_title = _("Zones")
    page_actions_template = "zones/partials/_zones_actions.html"
    react_root_id = "zones-root"
    props_script_id = "zones-page-props"
    page_vite_asset = "src/pages/zones/list.tsx"

    def get_props(self):
        selected_household = _resolve_selected_household(self.request)
        queryset = Zone.objects.for_user_households(self.request.user).select_related('parent')
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        zones = list(queryset.order_by('name')[:80])
        return {
            'initialZones': [
                {
                    'id': str(zone.id),
                    'name': zone.name,
                    'fullPath': zone.full_path,
                    'color': zone.color,
                    'parentId': str(zone.parent_id) if zone.parent_id else None,
                }
                for zone in zones
            ],
        }


class AppZoneDetailView(ReactPageView):
    template_name = 'zones/app/zone_detail.html'
    react_root_id = "zone-detail-root"
    props_script_id = "zone-detail-page-props"
    page_vite_asset = "src/pages/zones/detail.tsx"

    def _fetch_zone(self):
        if not hasattr(self, '_zone_cache'):
            selected_household = _resolve_selected_household(self.request)
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
        zone, children_count, photos_count = self._fetch_zone()
        return {
            'zoneId': str(zone.id),
            'initialZone': {
                'id': str(zone.id),
                'name': zone.name,
                'parentId': str(zone.parent_id) if zone.parent_id else None,
                'parentName': zone.parent.name if zone.parent else None,
                'note': zone.note,
                'surface': float(zone.surface) if zone.surface is not None else None,
                'color': zone.color,
                'updatedAt': zone.updated_at.isoformat() if zone.updated_at else None,
            },
            'initialStats': {
                'childrenCount': children_count,
                'photosCount': photos_count,
            },
            'initialPhotos': [],
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

