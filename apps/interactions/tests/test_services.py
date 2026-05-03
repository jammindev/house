from decimal import Decimal

import pytest
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from accounts.models import User
from equipment.models import Equipment
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from interactions.services import create_expense_interaction
from stock.models import StockCategory, StockItem
from zones.models import Zone


@pytest.fixture
def user(db):
    return User.objects.create_user(email="svc@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Service test home")


@pytest.fixture
def membership(user, household):
    HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )


@pytest.fixture
def zone(household, user):
    return Zone.objects.create(household=household, name="Garage", created_by=user)


@pytest.fixture
def stock_item(household, user, zone):
    category = StockCategory.objects.create(
        household=household, name="Heating", created_by=user
    )
    return StockItem.objects.create(
        household=household,
        category=category,
        zone=zone,
        name="Pellets",
        quantity=Decimal("0"),
        unit="bag",
        status="out_of_stock",
        created_by=user,
    )


@pytest.fixture
def equipment(household, user, zone):
    return Equipment.objects.create(
        household=household,
        zone=zone,
        name="Drill",
        created_by=user,
    )


@pytest.mark.django_db
def test_creates_interaction_linked_to_stock_item(user, household, stock_item, membership):
    interaction = create_expense_interaction(
        source=stock_item,
        user=user,
        amount=Decimal("25.00"),
        supplier="HardwareCo",
        notes="Bought a bag",
    )

    assert interaction.type == "expense"
    assert interaction.household_id == household.id
    assert interaction.created_by_id == user.id
    assert interaction.source == stock_item
    assert interaction.source_content_type == ContentType.objects.get_for_model(StockItem)
    assert interaction.source_object_id == stock_item.id
    assert interaction.subject == "Purchase — Pellets"
    assert interaction.metadata["kind"] == "stock_purchase"
    assert interaction.metadata["source_name"] == "Pellets"
    assert interaction.metadata["amount"] == "25.00"
    assert interaction.metadata["supplier"] == "HardwareCo"
    # zone of the source is attached
    assert interaction.zones.count() == 1
    assert interaction.zones.first().id == stock_item.zone_id


@pytest.mark.django_db
def test_creates_interaction_linked_to_equipment(user, household, equipment, membership):
    interaction = create_expense_interaction(
        source=equipment,
        user=user,
        amount=Decimal("199.00"),
    )

    assert interaction.source == equipment
    assert interaction.source_content_type == ContentType.objects.get_for_model(Equipment)
    assert interaction.subject == "Purchase — Drill"
    assert interaction.metadata["kind"] == "equipment_purchase"


@pytest.mark.django_db
def test_kind_override_takes_precedence(user, household, stock_item, membership):
    interaction = create_expense_interaction(
        source=stock_item,
        user=user,
        kind="custom_kind",
    )
    assert interaction.metadata["kind"] == "custom_kind"


@pytest.mark.django_db
def test_extra_metadata_is_merged(user, stock_item, membership):
    interaction = create_expense_interaction(
        source=stock_item,
        user=user,
        amount=Decimal("10"),
        extra_metadata={"delta": "2.5", "unit": "bag", "amount": "OVERRIDDEN"},
    )
    # extra_metadata can override standard keys (intentional escape hatch)
    assert interaction.metadata["amount"] == "OVERRIDDEN"
    assert interaction.metadata["delta"] == "2.5"
    assert interaction.metadata["unit"] == "bag"


@pytest.mark.django_db
def test_uses_provided_occurred_at_else_now(user, stock_item, membership):
    when = timezone.now().replace(year=2025, microsecond=0)
    interaction = create_expense_interaction(
        source=stock_item, user=user, occurred_at=when
    )
    assert interaction.occurred_at.replace(microsecond=0) == when


@pytest.mark.django_db
def test_rejects_source_without_household(user, db):
    class FakeSource:
        pk = "abc"

    with pytest.raises(ValueError, match="HouseholdScopedModel"):
        create_expense_interaction(source=FakeSource(), user=user)


# ──────────────────────────────────────────────────────────────────────
# create_manual_expense_interaction — Lot 1.2
# ──────────────────────────────────────────────────────────────────────

from interactions.services import create_manual_expense_interaction


@pytest.mark.django_db
def test_manual_creates_expense_with_user_subject(user, household, membership):
    interaction = create_manual_expense_interaction(
        household=household,
        user=user,
        subject="Restaurant Le Bistrot",
        amount=Decimal("32.00"),
        supplier="Le Bistrot",
    )
    assert interaction.type == "expense"
    assert interaction.subject == "Restaurant Le Bistrot"
    assert interaction.household_id == household.id
    assert interaction.created_by == user
    assert interaction.source_content_type_id is None
    assert interaction.source_object_id is None
    assert interaction.metadata["kind"] == "manual"
    assert interaction.metadata["source_name"] is None
    assert interaction.metadata["amount"] == "32.00"
    assert interaction.metadata["unit_price"] is None
    assert interaction.metadata["supplier"] == "Le Bistrot"


@pytest.mark.django_db
def test_manual_strips_whitespace_from_subject(user, household, membership):
    interaction = create_manual_expense_interaction(
        household=household, user=user, subject="  Cinema  "
    )
    assert interaction.subject == "Cinema"


@pytest.mark.django_db
def test_manual_rejects_blank_subject(user, household, membership):
    with pytest.raises(ValueError, match="subject"):
        create_manual_expense_interaction(
            household=household, user=user, subject="   "
        )


@pytest.mark.django_db
def test_manual_attaches_zones(user, household, zone, membership):
    interaction = create_manual_expense_interaction(
        household=household,
        user=user,
        subject="Garage tools",
        zone_ids=[zone.id],
    )
    assert list(interaction.zones.values_list("id", flat=True)) == [zone.id]


@pytest.mark.django_db
def test_manual_rejects_zone_outside_household(user, household, membership):
    other_household = Household.objects.create(name="Other house")
    other_zone = Zone.objects.create(
        household=other_household, name="Foreign zone", created_by=user
    )
    with pytest.raises(ValueError, match="zones"):
        create_manual_expense_interaction(
            household=household,
            user=user,
            subject="Bad zone",
            zone_ids=[other_zone.id],
        )


@pytest.mark.django_db
def test_manual_amount_none_kept_as_null(user, household, membership):
    interaction = create_manual_expense_interaction(
        household=household,
        user=user,
        subject="Free lunch",
    )
    assert interaction.metadata["amount"] is None


@pytest.mark.django_db
def test_manual_extra_metadata_is_merged(user, household, membership):
    interaction = create_manual_expense_interaction(
        household=household,
        user=user,
        subject="Cinema",
        amount=Decimal("12"),
        extra_metadata={"category": "leisure"},
    )
    assert interaction.metadata["category"] == "leisure"
    assert interaction.metadata["amount"] == "12"
