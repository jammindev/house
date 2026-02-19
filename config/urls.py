from django.contrib import admin
from django.urls import include, path
from django.conf.urls.i18n import i18n_patterns

from accounts.views import (
    home_view, login_view, dashboard_view, logout_view,
    app_dashboard_view, app_placeholder_view, app_zones_view,
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
    path("api/projects/", include("projects.urls")),
    path("api/incoming/", include("incoming_emails.urls")),
    path("api/core/", include("core.urls")),
    path("i18n/", include("django.conf.urls.i18n")),
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
    path("app/interactions/", app_placeholder_view, {"section": "interactions"}, name="app_interactions"),
    path("app/zones/", app_zones_view, name="app_zones"),
    path("app/contacts/", app_placeholder_view, {"section": "contacts"}, name="app_contacts"),
    path("app/documents/", app_placeholder_view, {"section": "documents"}, name="app_documents"),
    path("app/equipment/", app_placeholder_view, {"section": "equipment"}, name="app_equipment"),

    # Sections à migrer
    path("app/tasks/", app_placeholder_view, {"section": "tasks"}, name="app_tasks"),
    path("app/projects/", app_placeholder_view, {"section": "projects"}, name="app_projects"),
    path("app/photos/", app_placeholder_view, {"section": "photos"}, name="app_photos"),
    path("app/settings/", app_placeholder_view, {"section": "settings"}, name="app_settings"),

    prefix_default_language=False,
)
