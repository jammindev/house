"""
Thin wrapper over the Telegram Bot API — 5 methods, no third-party SDK.

Every call is fire-and-forget from the caller's point of view: network or API
errors are logged and swallowed (`None` returned), never raised — a Telegram
hiccup must not crash the webhook or the processing thread. With an empty
`TELEGRAM_BOT_TOKEN` the client is disabled and no outbound call is ever made.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

API_BASE = "https://api.telegram.org"
REQUEST_TIMEOUT_SECONDS = 10.0


class TelegramClient:
    def __init__(self, token: str | None = None):
        self.token = token if token is not None else settings.TELEGRAM_BOT_TOKEN

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    def send_message(
        self,
        chat_id: int,
        text: str,
        *,
        reply_markup: dict | None = None,
    ) -> dict | None:
        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        if reply_markup is not None:
            payload["reply_markup"] = reply_markup
        return self._call("sendMessage", payload)

    def send_chat_action(self, chat_id: int, action: str = "typing") -> dict | None:
        return self._call("sendChatAction", {"chat_id": chat_id, "action": action})

    def answer_callback_query(self, callback_query_id: str, text: str = "") -> dict | None:
        payload: dict[str, Any] = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text
        return self._call("answerCallbackQuery", payload)

    def edit_message_reply_markup(
        self,
        chat_id: int,
        message_id: int,
        reply_markup: dict | None = None,
    ) -> dict | None:
        return self._call(
            "editMessageReplyMarkup",
            {
                "chat_id": chat_id,
                "message_id": message_id,
                "reply_markup": reply_markup or {"inline_keyboard": []},
            },
        )

    def set_webhook(self, url: str, secret_token: str) -> dict | None:
        return self._call(
            "setWebhook",
            {
                "url": url,
                "secret_token": secret_token,
                "allowed_updates": ["message", "callback_query"],
            },
        )

    def _call(self, method: str, payload: dict) -> dict | None:
        if not self.enabled:
            logger.debug("telegram.%s skipped: channel disabled", method)
            return None
        try:
            response = httpx.post(
                f"{API_BASE}/bot{self.token}/{method}",
                json=payload,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except httpx.HTTPError as exc:
            logger.warning("telegram.%s failed: %s", method, exc)
            return None
        try:
            data = response.json()
        except ValueError:
            data = {}
        if response.status_code != 200 or not data.get("ok"):
            logger.warning(
                "telegram.%s rejected (%s): %s",
                method,
                response.status_code,
                str(data.get("description", ""))[:200],
            )
            return None
        return data.get("result")


def get_client() -> TelegramClient:
    return TelegramClient()
