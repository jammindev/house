# recap/tests/test_ping.py
"""
Tests for the monthly recap appointment (parcours 27 lot 6).

What matters here: the ping fires **on the day the month closes** — the 5th business
day, not the 1st (issue #541) — stays silent when the month has too little to tell,
is a **teaser plus a link** rather than the recap itself, and escapes everything a
user could have typed.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.test import override_settings
from django.utils import translation

from interactions.services import create_manual_expense_interaction
from recap.models import HouseholdRecap
from recap.ping import build_monthly_recap_message
from recap.service import last_closed_month

from .factories import HouseholdFactory, UserFactory, make_owner


def _closing_day(household) -> date:
    """The day, this month, on which the month just gone closes."""
    from core.month_close import nth_business_day
    from core.timezones import household_today

    today = household_today(household)
    return nth_business_day(today.year, today.month)


def _closed_month(household) -> str:
    """The month that ``_closing_day`` closes — independent of the real clock."""
    return last_closed_month(household, today=_closing_day(household))


def _first_of_this_month(household) -> date:
    from core.timezones import household_today

    return household_today(household).replace(day=1)


def _fill(household, user, *, subject="Plombier"):
    """Two expenses + a budget = three money cards, enough to clear the threshold."""
    from budget.services import create_budget

    month = _closed_month(household)
    tz = ZoneInfo(getattr(household, "timezone", None) or "UTC")
    year, mon = (int(p) for p in month.split("-"))
    for label, amount in ((subject, "180.00"), ("Cinéma", "24.00")):
        create_manual_expense_interaction(
            household=household,
            user=user,
            subject=label,
            amount=Decimal(amount),
            occurred_at=datetime(year, mon, 15, 12, tzinfo=tz),
        )
    create_budget(household, user, name="Courses", monthly_amount=Decimal("400"))
    return month


@pytest.mark.django_db
class TestItFiresOnTheDayTheMonthCloses:
    def test_the_closing_day_speaks(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill(hh, owner)

        message = build_monthly_recap_message(hh, owner, today=_closing_day(hh))

        assert message is not None

    def test_the_day_after_is_silent(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill(hh, owner)

        message = build_monthly_recap_message(
            hh, owner, today=_closing_day(hh) + timedelta(days=1)
        )

        assert message is None

    def test_the_first_of_the_month_is_silent_now(self):
        """It used to be the appointment; it is now the middle of the grace period,
        when the household is still recording the month's last receipts."""
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill(hh, owner)

        message = build_monthly_recap_message(hh, owner, today=_first_of_this_month(hh))

        assert message is None

    def test_the_first_of_the_month_freezes_nothing(self):
        """The tick runs every day; only the closing day may have side effects, or
        the grace period would buy nothing — a snapshot is never recomputed."""
        hh = HouseholdFactory()
        owner = make_owner(hh)
        month = _fill(hh, owner)

        build_monthly_recap_message(hh, owner, today=_first_of_this_month(hh))

        assert not HouseholdRecap.objects.filter(household=hh, month=month).exists()

    def test_a_silent_day_does_not_freeze_a_snapshot(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill(hh, owner)

        build_monthly_recap_message(
            hh, owner, today=_closing_day(hh) + timedelta(days=3)
        )

        assert not HouseholdRecap.objects.filter(household=hh).exists()


@pytest.mark.django_db
class TestAThinMonthDoesNotKnock:
    def test_nothing_to_tell_means_no_message(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)

        message = build_monthly_recap_message(hh, owner, today=_closing_day(hh))

        assert message is None

    def test_the_snapshot_still_exists_and_stays_browsable(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)

        build_monthly_recap_message(hh, owner, today=_closing_day(hh))

        assert HouseholdRecap.objects.filter(
            household=hh, month=_closed_month(hh)
        ).exists()

    def test_the_threshold_is_configurable(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill(hh, owner)

        with override_settings(RECAP_MIN_CARDS=99):
            message = build_monthly_recap_message(hh, owner, today=_closing_day(hh))

        assert message is None

    def test_a_user_who_muted_every_chapter_gets_nothing(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill(hh, owner)
        owner.recap_disabled_chapters = ["money", "achievements", "home", "memories"]
        owner.save(update_fields=["recap_disabled_chapters"])

        message = build_monthly_recap_message(hh, owner, today=_closing_day(hh))

        assert message is None


@pytest.mark.django_db
class TestItIsATeaserNotTheRecap:
    def test_it_carries_the_link_into_the_app(self):
        """A story is looked at; flattened into a chat thread it becomes the grey
        paragraph this parcours exists to replace."""
        hh = HouseholdFactory()
        owner = make_owner(hh)
        month = _fill(hh, owner)

        message = build_monthly_recap_message(hh, owner, today=_closing_day(hh))

        assert f"/app/recap/{month}" in message

    def test_it_shows_at_most_two_cards(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill(hh, owner)

        message = build_monthly_recap_message(hh, owner, today=_closing_day(hh))

        assert message.count("•") == 2

    def test_a_user_typed_subject_is_escaped(self):
        """A project or supplier called ``Cuisine <2026>`` must not break the markup."""
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill(hh, owner, subject="Cuisine <2026> & co")

        message = build_monthly_recap_message(hh, owner, today=_closing_day(hh))

        # The only unescaped markup is the header's own bold tag.
        assert message.count("<b>") == 1
        assert "<2026>" not in message

    def test_it_is_composed_in_the_recipient_language(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill(hh, owner)

        with translation.override("fr"):
            fr = build_monthly_recap_message(hh, owner, today=_closing_day(hh))
        with translation.override("en"):
            en = build_monthly_recap_message(hh, owner, today=_closing_day(hh))

        assert fr != en


@pytest.mark.django_db
class TestItIsRegisteredAndOffByDefault:
    def test_the_spec_is_in_the_registry(self):
        from pings.registry import find_spec

        spec = find_spec("monthly_recap")

        assert spec is not None
        assert spec.default_send_at == time(9, 0)
        assert spec.module is None  # core: the recap is not a switchable module

    def test_it_is_not_enabled_without_an_explicit_opt_in(self):
        """A user who also enabled the budget report would otherwise get two messages
        on the 1st — so this one ships off."""
        from pings.models import PingPreference

        hh = HouseholdFactory()
        owner = make_owner(hh)

        assert not PingPreference.objects.filter(
            user=owner, ping_type="monthly_recap", enabled=True
        ).exists()


@pytest.mark.django_db
class TestTheChapterPreferenceIsValidated:
    def test_a_known_chapter_is_accepted(self):
        from accounts.serializers import UserSerializer

        user = UserFactory()
        serializer = UserSerializer(
            user, data={"recap_disabled_chapters": ["home"]}, partial=True
        )

        assert serializer.is_valid(), serializer.errors

    def test_a_typo_is_refused_rather_than_muting_nothing(self):
        from accounts.serializers import UserSerializer

        user = UserFactory()
        serializer = UserSerializer(
            user, data={"recap_disabled_chapters": ["hoem"]}, partial=True
        )

        assert not serializer.is_valid()
        assert "recap_disabled_chapters" in serializer.errors

    def test_duplicates_are_collapsed(self):
        from accounts.serializers import UserSerializer

        user = UserFactory()
        serializer = UserSerializer(
            user, data={"recap_disabled_chapters": ["home", "home"]}, partial=True
        )

        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["recap_disabled_chapters"] == ["home"]
