from django.urls import path

from .views_web import app_photos_view

urlpatterns = [
    path('', app_photos_view, name='app_photos'),
]
