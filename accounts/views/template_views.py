"""Template-based views for accounts app."""
import time
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.forms import AuthenticationForm
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme

from core.permissions import resolve_request_household
from interactions.models import Interaction
from zones.models import Zone


def home_view(request):
    """Landing page publique."""
    if request.user.is_authenticated:
        return redirect('app_dashboard')
    return render(request, 'home.html')


def login_view(request):
    """Login view using Django template."""
    if request.user.is_authenticated:
        return redirect('app_dashboard')

    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                auth_login(request, user)
                messages.success(request, f"Bienvenue, {user.email}!")
                next_url = request.POST.get('next') or request.GET.get('next')
                if next_url and url_has_allowed_host_and_scheme(
                    url=next_url,
                    allowed_hosts={request.get_host()},
                    require_https=request.is_secure()
                ):
                    return redirect(next_url)
                return redirect('app_dashboard')
        else:
            messages.error(request, "Email ou mot de passe incorrect.")
    else:
        form = AuthenticationForm()

    return render(request, 'login.html', {'form': form, 'next': request.GET.get('next', '')})


@login_required
def dashboard_view(request):
    """Legacy redirect — dashboard maintenant sous /app/dashboard/."""
    return redirect('app_dashboard')


@login_required
def app_dashboard_view(request):
    """Dashboard principal de l'application."""
    return render(request, 'app/dashboard.html')


@login_required
def app_zones_view(request):
    """Vue Zones — TODO: remplacer le sleep par les vraies requêtes SQL."""
    time.sleep(2)  # TODO: retirer — simulation requête lente pour tester la barre HTMX
    return render(request, 'app/placeholder.html', {'section': 'zones', 'title': 'Zones'})


@login_required
def app_placeholder_view(request, section: str = ""):
    """Vue générique placeholder pour les sections en cours de migration."""
    title = section.replace('-', ' ').title()
    return render(request, 'app/placeholder.html', {'section': section, 'title': title})


@login_required
def app_components_view(request):
    """Showcase des composants UI atomiques React exposés en Web Components."""
    return render(request, 'app/components_demo.html')


@login_required
def app_interactions_view(request):
    """Interactions page with server-side initial data for first render."""
    selected_type = (request.GET.get('type') or '').strip()
    selected_status = (request.GET.get('status') or '').strip()
    force_reload_on_mount = bool((request.GET.get('refresh') or '').strip())

    selected_household = resolve_request_household(request, required=False)
    if not selected_household:
        membership = (
            request.user.householdmember_set
            .select_related('household')
            .order_by('household__name')
            .first()
        )
        selected_household = membership.household if membership else None

    queryset = Interaction.objects.for_user_households(request.user).select_related('created_by').prefetch_related('zones', 'documents')
    if selected_household:
        queryset = queryset.filter(household=selected_household)
    if selected_type:
        queryset = queryset.filter(type=selected_type)
    if selected_status:
        queryset = queryset.filter(status=selected_status)

    total_count = queryset.count()
    interactions = list(queryset.order_by('-occurred_at')[:8])
    initial_items = [
        {
            'id': str(item.id),
            'subject': item.subject,
            'content': item.content,
            'type': item.type,
            'status': item.status,
            'occurred_at': item.occurred_at.isoformat(),
            'tags': item.tags or [],
            'zone_names': [zone.name for zone in item.zones.all()],
            'document_count': item.documents.count(),
            'created_by_name': item.created_by.get_full_name() if item.created_by else '',
        }
        for item in interactions
    ]

    interactions_list_props = {
        'title': 'Latest interactions',
        'type': selected_type,
        'status': selected_status,
        'limit': 8,
        'emptyMessage': 'No interactions available yet.',
        'householdId': str(selected_household.id) if selected_household else None,
        'initialItems': initial_items,
        'initialCount': total_count,
        'initialLoaded': not force_reload_on_mount,
        'forceReloadOnMount': force_reload_on_mount,
    }

    return render(request, 'app/interactions.html', {'interactions_list_props': interactions_list_props})


@login_required
def app_interaction_new_view(request):
    """Interaction creation page (Lot B form-first) with server-side initial data."""
    selected_household = resolve_request_household(request, required=False)
    if not selected_household:
        membership = (
            request.user.householdmember_set
            .select_related('household')
            .order_by('household__name')
            .first()
        )
        selected_household = membership.household if membership else None

    zones_queryset = Zone.objects.for_user_households(request.user).select_related('parent')
    if selected_household:
        zones_queryset = zones_queryset.filter(household=selected_household)

    zones_payload = [
        {
            'id': str(zone.id),
            'name': zone.name,
            'full_path': zone.full_path,
            'color': zone.color,
        }
        for zone in zones_queryset.order_by('name')
    ]

    interaction_create_props = {
        'title': 'Create interaction',
        'submitLabel': 'Create',
        'successMessage': 'Interaction created successfully.',
        'defaultType': request.GET.get('type', 'note'),
        'householdId': str(selected_household.id) if selected_household else None,
        'initialZones': zones_payload,
        'initialZonesLoaded': True,
        'redirectToListUrl': f"{reverse('app_interactions')}?refresh=1",
    }

    return render(
        request,
        'app/interaction_new.html',
        {
            'interaction_create_props': interaction_create_props,
        }
    )


def logout_view(request):
    """Logout view."""
    auth_logout(request)
    messages.info(request, "Vous avez été déconnecté.")
    return redirect('login')
