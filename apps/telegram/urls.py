from django.urls import path

from .views import LinkTokenView, TelegramWebhookView

urlpatterns = [
    path("webhook/", TelegramWebhookView.as_view(), name="telegram-webhook"),
    path("link-token/", LinkTokenView.as_view(), name="telegram-link-token"),
]
