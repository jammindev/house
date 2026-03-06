from django.urls import path

from .views_web import AppDocumentsView

urlpatterns = [
    path('', AppDocumentsView.as_view(), name='app_documents'),
]
