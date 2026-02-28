from django.urls import path

from .views_web import app_settings_view, sidebar_user_fragment_view, switch_household_view

urlpatterns = [
    path('', app_settings_view, name='app_settings'),
    path('switch-household/', switch_household_view, name='app_settings_switch_household'),
    path('sidebar-user/', sidebar_user_fragment_view, name='sidebar_user_fragment'),
]
