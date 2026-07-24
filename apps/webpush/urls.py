from django.urls import path

from .views import SubscribeView, TestPushView, UnsubscribeView, VapidPublicKeyView

urlpatterns = [
    path("vapid-public-key/", VapidPublicKeyView.as_view(), name="webpush-vapid-public-key"),
    path("subscribe/", SubscribeView.as_view(), name="webpush-subscribe"),
    path("unsubscribe/", UnsubscribeView.as_view(), name="webpush-unsubscribe"),
    path("test/", TestPushView.as_view(), name="webpush-test"),
]
