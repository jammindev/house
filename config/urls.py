# config/urls.py
from django.contrib import admin
from django.conf import settings
from django.urls import include, path
from django.conf.urls.i18n import i18n_patterns
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from accounts.views import (
    home_view, login_view, dashboard_view, logout_view,
    app_dashboard_view,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/accounts/", include("accounts.urls")),
    path("api/households/", include("households.urls")),
    path("api/zones/", include("zones.urls")),
    path("api/documents/", include("documents.urls")),
    path("api/interactions/", include("interactions.urls")),
    path("api/contacts/", include("contacts.urls")),
    path("api/structures/", include("structures.urls")),
    path("api/tags/", include("tags.urls")),
    path("api/equipment/", include("equipment.urls")),
    path("api/electricity/", include("electricity.urls")),
    path("api/projects/", include("projects.urls")),
    path("api/incoming/", include("incoming_emails.urls")),
    path("i18n/", include("django.conf.urls.i18n")),
]

if settings.ENABLE_API_SCHEMA:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
        path("api/schema/swagger/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="api-swagger"),
        path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="api-schema"), name="api-redoc"),
    ]

# Internationalized URLs - Django templates with optional React components
urlpatterns += i18n_patterns(
    # Public
    path("", home_view, name="home"),
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),

    # Legacy redirect
    path("dashboard/", dashboard_view, name="dashboard"),

    # ── App (sidebar layout) ─────────────────────────────────────────────────
    path("app/dashboard/", app_dashboard_view, name="app_dashboard"),

    # Sections implémentées (placeholder pour l'instant, vues dédiées à créer)
    path("app/interactions/", include("interactions.web_urls")),
    path("app/zones/", include("zones.web_urls")),
    path("app/electricity/", include("electricity.web_urls")),
    path("app/contacts/", include("contacts.web_urls")),
    path("app/documents/", include("documents.web_urls")),
    path("app/equipment/", include("equipment.web_urls")),

    # Sections à migrer
    path("app/tasks/", include("tasks.web_urls")),
    path("app/projects/", include("projects.web_urls")),
    path("app/photos/", include("photos.web_urls")),
    path("app/settings/", include("app_settings.web_urls")),

    prefix_default_language=False,
)
