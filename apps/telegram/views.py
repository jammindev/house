"""API views for the Telegram channel."""
from __future__ import annotations

import logging

from django.conf import settings
from django.utils.crypto import constant_time_compare
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import service
from .linking import make_link_token
from .models import TelegramAccount

logger = logging.getLogger(__name__)


@extend_schema(exclude=True)
class TelegramWebhookView(APIView):
    """``POST /api/telegram/webhook/`` — updates pushed by Telegram.

    Unauthenticated by design: the caller is Telegram, not a user. Trust is the
    ``X-Telegram-Bot-Api-Secret-Token`` header, set when registering the webhook
    (``manage.py telegram_set_webhook``) and compared in constant time. An empty
    configured secret rejects everything — the channel is simply off.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        secret = settings.TELEGRAM_WEBHOOK_SECRET
        provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not secret or not constant_time_compare(provided, secret):
            return Response(status=status.HTTP_403_FORBIDDEN)

        update = request.data if isinstance(request.data, dict) else {}
        service.handle_update(update)
        # Always 200 once authenticated: a non-200 makes Telegram retry the same
        # update in a loop, which can't fix a payload we already logged about.
        return Response({"ok": True})


class LinkTokenView(APIView):
    """``POST /api/telegram/link-token/`` — mint a deep-link for account linking."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_BOT_USERNAME:
            return Response(
                {"detail": "Telegram channel is not enabled."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        token = make_link_token(request.user)
        return Response(
            {
                "deep_link": f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={token}",
                "expires_in": settings.TELEGRAM_LINK_TOKEN_MAX_AGE_SECONDS,
            }
        )


class TelegramAccountView(APIView):
    """``GET``/``DELETE /api/telegram/account/`` — link status + unlink.

    ``enabled`` tells the frontend whether to show the Telegram card at all
    (the channel is server-side opt-in via env vars).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        account = TelegramAccount.objects.filter(user=request.user).first()
        return Response(
            {
                "enabled": bool(
                    settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_BOT_USERNAME
                ),
                "linked": account is not None,
                "username": account.username if account else "",
                "linked_at": account.linked_at if account else None,
            }
        )

    def delete(self, request):
        TelegramAccount.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
