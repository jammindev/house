import json

from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views.generic import View

from accounts.serializers import UserSerializer
from core.views import ReactPageView
from households.serializers import HouseholdDetailSerializer, HouseholdInvitationSerializer
from households.models import Household, HouseholdMember, HouseholdInvitation


class AppSettingsView(ReactPageView):
    page_title = _("Settings")
    page_description = _("Manage your profile, households, and preferences.")
    react_root_id = "settings-root"
    props_script_id = "settings-props"
    page_vite_asset = "src/pages/settings/index.tsx"

    def get_props(self):
        user_data = UserSerializer(self.request.user).data
        households_qs = Household.objects.filter(
            householdmember__user=self.request.user,
            archived_at__isnull=True,
        ).distinct()
        households_data = HouseholdDetailSerializer(households_qs, many=True).data

        active_household_id = (
            str(self.request.user.active_household_id)
            if self.request.user.active_household_id
            else None
        )

        pending_invitations_qs = HouseholdInvitation.objects.filter(
            invited_user=self.request.user,
            status=HouseholdInvitation.Status.PENDING,
        ).select_related('household', 'invited_by').order_by('-created_at')
        pending_invitations_data = HouseholdInvitationSerializer(pending_invitations_qs, many=True).data

        return {
            'initialUser': user_data,
            'initialHouseholds': households_data,
            'activeHouseholdId': active_household_id,
            'switchHouseholdUrl': reverse('app_settings_switch_household'),
            'initialPendingInvitations': pending_invitations_data,
            'acceptInvitationUrlTemplate': '/api/households/invitations/{id}/accept/',
            'declineInvitationUrlTemplate': '/api/households/invitations/{id}/decline/',
        }


class SidebarUserFragmentView(LoginRequiredMixin, View):
    """Returns just the sidebar user info fragment (for HTMX refresh)."""

    def get(self, request):
        return render(request, 'components/_sidebar_user_fragment.html')


class SwitchHouseholdView(LoginRequiredMixin, View):
    """Store the chosen household in the session so all web views read it by default."""

    def post(self, request):
        try:
            body = json.loads(request.body)
            household_id = str(body.get('household_id', '')).strip()
        except (json.JSONDecodeError, AttributeError):
            return JsonResponse({'error': _('Invalid JSON')}, status=400)

        if not household_id:
            return JsonResponse({'error': _('household_id required')}, status=400)

        is_member = HouseholdMember.objects.filter(
            household_id=household_id, user_id=request.user.id
        ).exists()
        if not is_member:
            return JsonResponse({'error': _('Forbidden')}, status=403)

        request.user.active_household_id = household_id
        request.user.save(update_fields=['active_household_id'])
        return JsonResponse({'ok': True, 'activeHouseholdId': household_id})
