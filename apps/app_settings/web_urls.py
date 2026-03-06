from django.urls import path

from .views_web import AppSettingsView, SidebarUserFragmentView, SwitchHouseholdView

urlpatterns = [
    path('', AppSettingsView.as_view(), name='app_settings'),
    path('switch-household/', SwitchHouseholdView.as_view(), name='app_settings_switch_household'),
    path('sidebar-user/', SidebarUserFragmentView.as_view(), name='sidebar_user_fragment'),
]
