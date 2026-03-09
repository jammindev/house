from django.urls import path

from .views_web import AppDocumentCreateView, AppDocumentDetailView, AppDocumentsView

urlpatterns = [
    path('', AppDocumentsView.as_view(), name='app_documents'),
    path('new/', AppDocumentCreateView.as_view(), name='app_documents_new'),
    path('<int:document_id>/', AppDocumentDetailView.as_view(), name='app_documents_detail'),
]
