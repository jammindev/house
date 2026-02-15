from django.contrib import admin
from django.urls import include, path
from django.conf.urls.i18n import i18n_patterns
from django.views.generic import TemplateView
from rest_framework.routers import DefaultRouter

from accounts.views import AuthViewSet, UserViewSet, login_view, dashboard_view, logout_view

# API Router
router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("auth", AuthViewSet, basename="auth")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/households/", include("households.urls")),
    path("api/zones/", include("zones.urls")),
    path("api/documents/", include("documents.urls")),
    path("api/interactions/", include("interactions.urls")),
    path("i18n/", include("django.conf.urls.i18n")),
]

# Internationalized URLs - Django templates with optional React components
urlpatterns += i18n_patterns(
    path("", login_view, name="home"),
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
    path("dashboard/", dashboard_view, name="dashboard"),
    path("test-components/", TemplateView.as_view(template_name="test_components.html"), name="test_components"),
    prefix_default_language=False,
)
