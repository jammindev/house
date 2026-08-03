"""Le canal Telegram — pings proactifs, digest quotidien, conversation.

Deux réglages, deux rôles : le **token** parle à l'API de Telegram, le
**username** construit le lien ``t.me`` que l'utilisateur ouvre pour lier son
compte. Sans le second, l'écran de liaison affiche un bouton qui ne mène nulle
part : une capacité à moitié configurée est une capacité indisponible.
"""
from __future__ import annotations

from django.conf import settings


def telegram_available() -> bool:
    return bool(
        (getattr(settings, "TELEGRAM_BOT_TOKEN", "") or "")
        and (getattr(settings, "TELEGRAM_BOT_USERNAME", "") or "")
    )
