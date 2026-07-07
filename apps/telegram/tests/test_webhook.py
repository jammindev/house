"""Webhook authentication + dedup."""
from __future__ import annotations

from unittest import mock

import pytest
from rest_framework import status

from .conftest import WEBHOOK_SECRET, text_update, webhook_post

pytestmark = pytest.mark.django_db


class TestWebhookAuth:
    def test_missing_header_is_rejected(self):
        assert webhook_post({"update_id": 1}, secret=None).status_code == status.HTTP_403_FORBIDDEN

    def test_wrong_secret_is_rejected(self):
        assert webhook_post({"update_id": 1}, secret="nope").status_code == status.HTTP_403_FORBIDDEN

    def test_unconfigured_secret_rejects_everything(self, settings):
        settings.TELEGRAM_WEBHOOK_SECRET = ""
        # Even an empty header must not match an empty configured secret.
        assert webhook_post({"update_id": 1}, secret="").status_code == status.HTTP_403_FORBIDDEN

    def test_valid_secret_returns_200(self, bot):
        resp = webhook_post(text_update(1, "/help"))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json() == {"ok": True}

    def test_non_dict_payload_is_tolerated(self, bot):
        resp = webhook_post([1, 2, 3])
        assert resp.status_code == status.HTTP_200_OK


class TestWebhookDedup:
    def test_duplicate_update_id_is_processed_once(self, monkeypatch, bot):
        handler = mock.Mock()
        monkeypatch.setattr("telegram.service._handle_message", handler)
        update = text_update(1, "hello", update_id=42)
        assert webhook_post(update).status_code == status.HTTP_200_OK
        assert webhook_post(update).status_code == status.HTTP_200_OK
        assert handler.call_count == 1

    def test_distinct_update_ids_are_both_processed(self, monkeypatch, bot):
        handler = mock.Mock()
        monkeypatch.setattr("telegram.service._handle_message", handler)
        webhook_post(text_update(1, "a", update_id=1))
        webhook_post(text_update(1, "b", update_id=2))
        assert handler.call_count == 2

    def test_handler_crash_still_returns_200(self, monkeypatch, bot):
        monkeypatch.setattr(
            "telegram.service._handle_message", mock.Mock(side_effect=RuntimeError("boom"))
        )
        assert webhook_post(text_update(1, "x")).status_code == status.HTTP_200_OK


def test_secret_constant_shape():
    # Guard against a fixture typo silently weakening the auth tests above.
    assert WEBHOOK_SECRET
