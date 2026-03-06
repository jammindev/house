from django.urls import path

from .views_web import AppPhotosView

urlpatterns = [
    path('', AppPhotosView.as_view(), name='app_photos'),
]
