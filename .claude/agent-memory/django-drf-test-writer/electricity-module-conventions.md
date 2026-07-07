---
name: electricity-module-conventions
description: Factories, URL router names, auth/household pattern, UUID comparison, and permission rules for the electricity module tests
metadata:
  type: reference
---

## Auth & Household Pattern

All electricity API tests use this pattern (from `test_views_consumption.py`):

```python
def _make_owner(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user

def _make_member(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user
```

The `active_household` field on the user is what the `ActiveHouseholdMiddleware` uses to set `request.household`. Without it, the viewsets see no household and refuse writes.

## Router Basenames (electricity app)

- `electricity-meter-list` / `electricity-meter-detail` → ElectricityMeterViewSet
- `electricity-meter-reading-list` / `electricity-meter-reading-detail` → MeterReadingViewSet
- `electricity-meter-tariff-list` / `electricity-meter-tariff-detail` → MeterTariffViewSet
- `electricity-consumption-import-list` → ConsumptionImportViewSet

## Permission Rules

`IsElectricityOwnerWriteMemberRead`: owner → full CRUD; member → GET only (403 on POST/PUT/PATCH/DELETE); anonymous → 401.

## Factories

Location: `apps/electricity/tests/factories.py`

- `UserFactory`, `HouseholdFactory`, `HouseholdMemberFactory`, `ZoneFactory`
- `ElectricityMeterFactory(household, tariff_type=BASE, timezone="Europe/Paris")`
- `MeterReadingFactory(meter, register=BASE, index_kwh=sequenced from 1000)`
- `ConsumptionRecordFactory(meter, register=BASE, interval_minutes=30, energy_wh=250, source=IMPORT)`
- **No `MeterTariffFactory`** — use `MeterTariff.objects.create(...)` directly (created_by/updated_by are nullable, so they can be omitted).

## UUID Comparison Gotcha

`response.data` fields that are UUID ForeignKeys come back as `uuid.UUID` objects (not strings) even when the model field is a UUIDField. Always cast both sides:

```python
# Wrong: response.data["meter"] == str(meter.id)  → fails if response returns UUID object
# Correct:
assert str(response.data["meter"]) == str(meter.id)
assert str(response.data["household"]) == str(hh.id)
```

## UniqueTogetherValidator vs Custom Serializer Check

DRF's `UniqueTogetherValidator` runs BEFORE the serializer's custom `validate()`. For `MeterTariff(meter, valid_from)` uniqueness, the 400 error can land on either `valid_from` (custom check) or `non_field_errors` (DRF validator). Test for both:

```python
assert "valid_from" in response.data or "non_field_errors" in response.data
```

## HouseholdScopedModel Requirements

- `created_by` and `updated_by` are nullable FKs → can be omitted in `objects.create()` calls in tests.
- `household` is mandatory — raise `ValueError` if missing.

## Consumption Record Creation for Service Tests

For service-layer costing tests, create `ConsumptionRecord` objects directly (not via readings) using `source=ConsumptionSource.IMPORT` and `interval_minutes=1440` (full day). This bypasses the `rebuild_reading_records` path and gives clean isolated test data.
