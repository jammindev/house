# config/urls.py
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from . import admin_ordering as _admin_ordering
from accounts.views import TokenObtainPairWithSessionView
from core.views_media import serve_protected_media

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairWithSessionView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("api/accounts/", include("accounts.urls")),
    path("api/households/", include("households.urls")),
    path("api/zones/", include("zones.urls")),
    path("api/documents/", include("documents.urls")),
    path("api/interactions/", include("interactions.urls")),
    path("api/contacts/", include("directory.urls")),
    path("api/structures/", include("directory.structures_urls")),
    path("api/tags/", include("tags.urls")),
    path("api/equipment/", include("equipment.urls")),
    path("api/stock/", include("stock.urls")),
    path("api/insurance/", include("insurance.urls")),
    path("api/electricity/", include("electricity.urls")),
    path("api/projects/", include("projects.urls")),
    path("api/tasks/", include("tasks.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/alerts/", include("alerts.urls")),
    path("i18n/", include("django.conf.urls.i18n")),
]

if settings.ENABLE_API_SCHEMA:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
        path("api/schema/swagger/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="api-swagger"),
        path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="api-schema"), name="api-redoc"),
    ]

# Media files — always served via Django for permission checks.
# In production, Django returns X-Accel-Redirect and Nginx serves the file.
# In development, Django serves the file directly.
urlpatterns += [
    re_path(r'^media/(?P<path>.+)$', serve_protected_media, name='serve_protected_media'),
]

urlpatterns += [
    path("manifest.json", TemplateView.as_view(
        template_name="manifest.json",
        content_type="application/manifest+json",
    ), name="manifest"),
    re_path(r"^(?!api/|admin/|static/|media/|i18n/).*$",
            TemplateView.as_view(template_name="index.html"),
            name="spa_catchall"),
]
