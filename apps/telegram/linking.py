"""
Account linking: signed deep-link tokens, no server-side storage.

The web app hands the user a `t.me/<bot>?start=<token>` link; Telegram sends
the token back in a `/start` message. The token is a salted HMAC over
`<user_pk>_<timestamp>` — nothing to store, nothing to clean up, and a stolen
token dies on its own after `TELEGRAM_LINK_TOKEN_MAX_AGE_SECONDS`.

Telegram constrains the start payload to 64 chars of `[A-Za-z0-9_-]`, which
rules out `django.core.signing.dumps` (`:` separators, longer output) — hence
the compact hand-rolled format: body + fixed-length (43 chars) urlsafe digest.
"""
from __future__ import annotations

import base64
import time

from django.conf import settings
from django.utils.crypto import constant_time_compare, salted_hmac

from .models import TelegramAccount

TOKEN_SALT = "telegram.linking"
_SIGNATURE_LEN = 43  # base64url(sha256 digest) without padding


def make_link_token(user) -> str:
    """Return a signed, expiring token identifying ``user`` for `/start`."""
    body = f"{user.pk}_{int(time.time())}"
    return body + _signature(body)


def consume_link_token(token: str):
    """Return the User a valid token points to, or None (invalid/expired/gone)."""
    from django.contrib.auth import get_user_model

    token = (token or "").strip()
    if len(token) <= _SIGNATURE_LEN:
        return None
    body, signature = token[:-_SIGNATURE_LEN], token[-_SIGNATURE_LEN:]
    if not constant_time_compare(signature, _signature(body)):
        return None
    user_pk, _, issued_at = body.partition("_")
    if not user_pk.isdigit() or not issued_at.isdigit():
        return None
    max_age = settings.TELEGRAM_LINK_TOKEN_MAX_AGE_SECONDS
    if time.time() - int(issued_at) > max_age:
        return None
    return get_user_model().objects.filter(pk=int(user_pk), is_active=True).first()


def link_account(user, chat_id: int, username: str = "") -> TelegramAccount:
    """Point ``chat_id`` at ``user``, stealing it from a previous owner if any.

    Re-linking is a legitimate flow (new phone, re-run of the deep-link), so the
    unique `chat_id` is reassigned rather than rejected.
    """
    from django.utils import timezone

    TelegramAccount.objects.filter(chat_id=chat_id).exclude(user=user).delete()
    account, _created = TelegramAccount.objects.update_or_create(
        user=user,
        defaults={
            "chat_id": chat_id,
            "username": username or "",
            "linked_at": timezone.now(),
        },
    )
    return account


def _signature(body: str) -> str:
    digest = salted_hmac(TOKEN_SALT, body, algorithm="sha256").digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")
