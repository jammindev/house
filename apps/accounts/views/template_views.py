"""Template-based views for accounts app."""
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.forms import AuthenticationForm
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.generic import RedirectView, TemplateView, View


class HomeView(View):
    """Landing page publique."""

    def get(self, request):
        if request.user.is_authenticated:
            return redirect('app_dashboard')
        return render(request, 'home.html')


class LoginView(View):
    """Login view using Django template."""

    def get(self, request):
        if request.user.is_authenticated:
            return redirect('app_dashboard')
        form = AuthenticationForm()
        return render(request, 'login.html', {'form': form, 'next': request.GET.get('next', '')})

    def post(self, request):
        if request.user.is_authenticated:
            return redirect('app_dashboard')
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
        return render(request, 'login.html', {'form': form, 'next': request.POST.get('next', '')})


class DashboardView(LoginRequiredMixin, RedirectView):
    """Legacy redirect — dashboard maintenant sous /app/dashboard/."""
    pattern_name = 'app_dashboard'


class AppDashboardView(LoginRequiredMixin, TemplateView):
    """Dashboard principal de l'application."""
    template_name = 'app/dashboard.html'


class LogoutView(View):
    """Logout view."""

    def get(self, request):
        auth_logout(request)
        messages.info(request, "Vous avez été déconnecté.")
        return redirect('login')
