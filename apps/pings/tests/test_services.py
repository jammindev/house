"""Scheduler-tick semantics: due time, idempotence, gating, delivery failures."""
from __future__ import annotations

from datetime import datetime, time, timezone as dt_timezone
from unittest import mock

import pytest

from pings import registry
from pings.models import PingLog, PingPreference
from pings.services import available_pings, send_due_pings, upsert_preference

from .conftest import PING_TYPE

pytestmark = pytest.mark.django_db


def _utc(hour: int, minute: int = 0) -> datetime:
    """A fixed summer date — Europe/Paris is UTC+2, so 17:05 UTC = 19:05 local."""
    return datetime(2026, 7, 12, hour, minute, tzinfo=dt_timezone.utc)


class TestTick:
    def test_sends_when_due_and_logs(self, preference, linked_account, outbound_client):
        summary = send_due_pings(now=_utc(17, 5))

        assert summary == {"sent": 1, "skipped": 0, "errors": 0}
        outbound_client.send_message.assert_called_once()
        assert outbound_client.send_message.call_args.args[0] == linked_account.chat_id
        log = PingLog.objects.get()
        assert log.ping_type == PING_TYPE
        # sent_on is the household-local date, not the UTC one
        assert log.sent_on.isoformat() == "2026-07-12"

    def test_second_tick_same_day_skips(self, preference, linked_account, outbound_client):
        send_due_pings(now=_utc(17, 5))
        summary = send_due_pings(now=_utc(17, 10))

        assert summary["sent"] == 0
        assert outbound_client.send_message.call_count == 1
        assert PingLog.objects.count() == 1

    def test_not_due_yet_in_household_timezone(self, preference, linked_account, outbound_client):
        # 16:30 UTC = 18:30 Paris < 19:00 send_at
        summary = send_due_pings(now=_utc(16, 30))

        assert summary["sent"] == 0
        outbound_client.send_message.assert_not_called()
        assert not PingLog.objects.exists()

    def test_due_in_local_time_even_if_utc_earlier(self, preference, linked_account, outbound_client):
        # 17:30 UTC = 19:30 Paris — due locally although UTC is before 19:00
        assert send_due_pings(now=_utc(17, 30))["sent"] == 1

    def test_disabled_preference_never_sends(self, household, user, ping_spec,
                                              linked_account, outbound_client):
        upsert_preference(household, user, ping_type=PING_TYPE, enabled=False)
        assert send_due_pings(now=_utc(17, 5))["sent"] == 0
        outbound_client.send_message.assert_not_called()

    def test_build_message_none_skips_without_log(self, preference, linked_account,
                                                  outbound_client, spec_message):
        spec_message["text"] = None
        summary = send_due_pings(now=_utc(17, 5))

        assert summary["sent"] == 0
        assert not PingLog.objects.exists()  # re-evaluated on the next tick

    def test_no_telegram_account_skips(self, preference, outbound_client):
        assert send_due_pings(now=_utc(17, 5))["sent"] == 0
        outbound_client.send_message.assert_not_called()


class TestChannelFanout:
    """A due ping fans out to Telegram + Web Push; one success = delivered."""

    def test_delivers_via_web_push_without_telegram(self, preference, outbound_client):
        with mock.patch("webpush.service.send_web_push", return_value=1) as push:
            summary = send_due_pings(now=_utc(17, 5))

        assert summary["sent"] == 1
        push.assert_called_once()
        assert push.call_args.args[0] == preference.user
        assert push.call_args.kwargs["url"] == "/app/dashboard"
        assert PingLog.objects.count() == 1
        outbound_client.send_message.assert_not_called()

    def test_fans_out_to_both_channels(self, preference, linked_account, outbound_client):
        with mock.patch("webpush.service.send_web_push", return_value=1) as push:
            assert send_due_pings(now=_utc(17, 5))["sent"] == 1

        outbound_client.send_message.assert_called_once()
        push.assert_called_once()
        assert PingLog.objects.count() == 1

    def test_no_channel_delivers_releases_log(self, preference, outbound_client):
        # No Telegram account and web push delivers to nobody → nothing sent,
        # log released so a later tick retries.
        with mock.patch("webpush.service.send_web_push", return_value=0):
            assert send_due_pings(now=_utc(17, 5))["sent"] == 0
        assert not PingLog.objects.exists()

    def test_telegram_success_counts_even_if_push_empty(
        self, preference, linked_account, outbound_client
    ):
        with mock.patch("webpush.service.send_web_push", return_value=0):
            assert send_due_pings(now=_utc(17, 5))["sent"] == 1
        assert PingLog.objects.count() == 1

    def test_module_disabled_since_optin_skips(self, household, user,
                                                linked_account, outbound_client):
        from pings.registry import PingSpec

        spec = PingSpec(
            ping_type="gated_ping",
            build_message=lambda h, u, *, today: "Q?",
            default_send_at=time(19, 0),
            module="chickens",
        )
        registry.register(spec)
        try:
            upsert_preference(household, user, ping_type="gated_ping", enabled=True)
            household.disabled_modules = ["chickens"]
            household.save(update_fields=["disabled_modules"])

            assert send_due_pings(now=_utc(17, 5))["sent"] == 0
            outbound_client.send_message.assert_not_called()
        finally:
            registry.REGISTRY.pop("gated_ping", None)

    def test_delivery_failure_releases_the_claim(self, preference, linked_account,
                                                 outbound_client):
        outbound_client.send_message.return_value = None  # Telegram rejected
        summary = send_due_pings(now=_utc(17, 5))

        assert summary["sent"] == 0
        assert not PingLog.objects.exists()  # next tick retries

        outbound_client.send_message.return_value = {"message_id": 2}
        assert send_due_pings(now=_utc(17, 10))["sent"] == 1

    def test_one_failing_preference_does_not_block_others(self, household, user, preference,
                                                          linked_account, outbound_client):
        from pings.registry import PingSpec

        def boom(h, u, *, today):
            raise RuntimeError("boom")

        registry.register(PingSpec(
            ping_type="broken_ping",
            build_message=boom,
            default_send_at=time(19, 0),
        ))
        try:
            upsert_preference(household, user, ping_type="broken_ping", enabled=True)
            summary = send_due_pings(now=_utc(17, 5))
            assert summary["errors"] == 1
            assert summary["sent"] == 1  # the healthy PING_TYPE still went out
        finally:
            registry.REGISTRY.pop("broken_ping", None)

    def test_stale_ping_type_row_is_skipped(self, household, user, preference,
                                            linked_account, outbound_client):
        # The preference row survives, but the spec is gone (module removed).
        registry.REGISTRY.pop(PING_TYPE)
        assert send_due_pings(now=_utc(17, 5))["sent"] == 0
        outbound_client.send_message.assert_not_called()


class TestPreferences:
    def test_upsert_unknown_type_raises(self, household, user):
        with pytest.raises(LookupError):
            upsert_preference(household, user, ping_type="nope", enabled=True)

    def test_upsert_defaults_send_at_from_spec(self, household, user, ping_spec):
        pref = upsert_preference(household, user, ping_type=PING_TYPE, enabled=True)
        assert pref.send_at == time(19, 0)
        assert pref.enabled is True

    def test_upsert_toggle_keeps_time(self, household, user, ping_spec):
        upsert_preference(household, user, ping_type=PING_TYPE, enabled=True,
                          send_at=time(8, 30))
        pref = upsert_preference(household, user, ping_type=PING_TYPE, enabled=False)
        assert pref.send_at == time(8, 30)
        assert pref.enabled is False
        assert PingPreference.objects.count() == 1

    def test_available_pings_merges_preferences(self, household, user, ping_spec):
        rows = available_pings(household, user)
        row = next(r for r in rows if r["ping_type"] == PING_TYPE)
        assert row["enabled"] is False
        assert row["send_at"] == time(19, 0)

        upsert_preference(household, user, ping_type=PING_TYPE, enabled=True,
                          send_at=time(20, 15))
        rows = available_pings(household, user)
        row = next(r for r in rows if r["ping_type"] == PING_TYPE)
        assert row["enabled"] is True
        assert row["send_at"] == time(20, 15)
