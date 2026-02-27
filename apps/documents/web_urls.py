from django.urls import path

from .views_web import app_documents_view

urlpatterns = [
    path('', app_documents_view, name='app_documents'),
]
