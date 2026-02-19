"""Template-based views for accounts app."""
import time
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.forms import AuthenticationForm
from django.utils.http import url_has_allowed_host_and_scheme


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


def logout_view(request):
    """Logout view."""
    auth_logout(request)
    messages.info(request, "Vous avez été déconnecté.")
    return redirect('login')
