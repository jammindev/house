"""Lot 18.1/18.3 — StockLevelReading, recalibration, inventory, consumption curve."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from accounts.models import User
from households.models import Household, HouseholdMember
from stock.models import StockCategory, StockItem, StockLevelReading
from stock.services import record_inventory


@pytest.fixture
def user(db):
    return User.objects.create_user(email="conso@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Main home")


@pytest.fixture
def membership(user, household):
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)


@pytest.fixture
def category(household, user):
    return StockCategory.objects.create(household=household, name="Animals", created_by=user)


@pytest.fixture
def feed(household, category, user):
    return StockItem.objects.create(
        household=household,
        category=category,
        name="Chicken feed",
        quantity=Decimal("2.000"),
        unit="kg",
        status="low_stock",
        min_quantity=Decimal("5"),
        created_by=user,
    )


def _purchase_url(item):
    return reverse("stock-item-purchase", kwargs={"pk": item.id})


def _inventory_url(item):
    return reverse("stock-item-inventory", kwargs={"pk": item.id})


def _consumption_url(item):
    return reverse("stock-item-consumption", kwargs={"pk": item.id})


def _readings(item):
    return list(StockLevelReading.objects.filter(stock_item=item).order_by("reading_at", "created_at"))


@pytest.mark.django_db
def test_purchase_without_remaining_records_single_purchase_reading(client, user, feed, membership):
    client.force_login(user)

    response = client.post(
        _purchase_url(feed),
        data={"delta": "20", "amount": "30", "brand": "Gasco"},
        content_type="application/json",
    )

    assert response.status_code == 201, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("22.000")  # 2 + 20, no recalibration

    readings = _readings(feed)
    assert len(readings) == 1
    assert readings[0].kind == StockLevelReading.Kind.PURCHASE
    assert readings[0].quantity == Decimal("22.000")
    # Invariant: last reading coincides with the item quantity.
    assert readings[-1].quantity == feed.quantity

    from interactions.models import Interaction

    interaction = Interaction.objects.get(id=response.json()["interaction_id"])
    assert interaction.metadata["brand"] == "Gasco"
    assert readings[0].source_interaction_id == interaction.id


@pytest.mark.django_db
def test_purchase_with_remaining_recalibrates_and_records_two_readings(client, user, feed, membership):
    client.force_login(user)

    # The item thinks it has 2 kg, but the user counted 0.5 kg left before buying.
    response = client.post(
        _purchase_url(feed),
        data={"delta": "20", "amount": "30", "remaining_before": "0.5"},
        content_type="application/json",
    )

    assert response.status_code == 201, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("20.500")  # 0.5 (measured) + 20 (bought)

    readings = _readings(feed)
    assert len(readings) == 2
    assert readings[0].kind == StockLevelReading.Kind.INVENTORY
    assert readings[0].quantity == Decimal("0.500")
    assert readings[1].kind == StockLevelReading.Kind.PURCHASE
    assert readings[1].quantity == Decimal("20.500")
    assert readings[-1].quantity == feed.quantity


@pytest.mark.django_db
def test_purchase_rejects_negative_remaining(client, user, feed, membership):
    client.force_login(user)

    response = client.post(
        _purchase_url(feed),
        data={"delta": "5", "remaining_before": "-1"},
        content_type="application/json",
    )

    assert response.status_code == 400
    feed.refresh_from_db()
    assert feed.quantity == Decimal("2.000")
    assert _readings(feed) == []


@pytest.mark.django_db
def test_inventory_sets_absolute_quantity_and_records_reading(client, user, feed, membership):
    client.force_login(user)

    response = client.post(
        _inventory_url(feed),
        data={"quantity": "8.5"},
        content_type="application/json",
    )

    assert response.status_code == 200, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("8.500")
    assert feed.status == "in_stock"  # promoted above min_quantity=5

    readings = _readings(feed)
    assert len(readings) == 1
    assert readings[0].kind == StockLevelReading.Kind.INVENTORY
    assert readings[0].quantity == Decimal("8.500")
    assert readings[-1].quantity == feed.quantity


@pytest.mark.django_db
def test_inventory_to_zero_marks_out_of_stock(client, user, feed, membership):
    client.force_login(user)

    response = client.post(
        _inventory_url(feed),
        data={"quantity": "0"},
        content_type="application/json",
    )

    assert response.status_code == 200
    feed.refresh_from_db()
    assert feed.quantity == Decimal("0.000")
    assert feed.status == "out_of_stock"


@pytest.mark.django_db
def test_inventory_rejects_negative(client, user, feed, membership):
    client.force_login(user)

    response = client.post(
        _inventory_url(feed),
        data={"quantity": "-3"},
        content_type="application/json",
    )

    assert response.status_code == 400
    feed.refresh_from_db()
    assert feed.quantity == Decimal("2.000")
    assert _readings(feed) == []


@pytest.mark.django_db
def test_inventory_requires_authentication(client, feed):
    response = client.post(
        _inventory_url(feed),
        data={"quantity": "5"},
        content_type="application/json",
    )
    assert response.status_code in (401, 403)
    assert _readings(feed) == []


@pytest.mark.django_db
def test_consumption_needs_two_points(client, user, feed, membership):
    client.force_login(user)
    record_inventory(item=feed, user=user, quantity=Decimal("10"))

    response = client.get(_consumption_url(feed))
    assert response.status_code == 200, response.content
    data = response.json()
    assert data["points_count"] == 1
    assert data["rate_per_day"] is None
    assert data["projected_depletion_date"] is None
    assert data["last_level"] == 10.0


@pytest.mark.django_db
def test_consumption_derives_rate_and_depletion(client, user, feed, membership):
    client.force_login(user)
    now = timezone.now()
    # 10 kg ten days ago, 2 kg now → 8 kg over 10 days = 0.8 kg/day.
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=10))
    record_inventory(item=feed, user=user, quantity=Decimal("2"), occurred_at=now)

    response = client.get(_consumption_url(feed))
    assert response.status_code == 200
    data = response.json()
    assert data["points_count"] == 2
    assert data["rate_per_day"] == pytest.approx(0.8, abs=0.01)
    assert data["last_level"] == 2.0
    # 2 kg / 0.8 kg/day ≈ 2.5 days of runway → a future date.
    assert data["projected_depletion_date"] is not None
    assert data["projected_depletion_date"] > now.date().isoformat()


@pytest.mark.django_db
def test_consumption_ignores_restock_jumps(client, user, feed, membership):
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=10))
    record_inventory(item=feed, user=user, quantity=Decimal("2"), occurred_at=now - timedelta(days=5))
    # A restock jump upward must not count as (negative) consumption.
    record_inventory(item=feed, user=user, quantity=Decimal("12"), occurred_at=now - timedelta(days=4))
    record_inventory(item=feed, user=user, quantity=Decimal("4"), occurred_at=now)

    response = client.get(_consumption_url(feed))
    data = response.json()
    # Consumed: 8 (day0→5) + 8 (day6→10) = 16 over 10 days = 1.6 kg/day.
    assert data["rate_per_day"] == pytest.approx(1.6, abs=0.01)
    assert data["points_count"] == 4


# --- CRUD writes must go through the inventory path (regression #325) ---------


@pytest.mark.django_db
def test_create_item_with_quantity_records_initial_inventory_reading(client, user, category, membership):
    """Creating an item with an initial quantity writes the origin level reading.

    Without it the consumption curve has no starting point and the documented
    invariant (last reading == item.quantity) is broken from creation.
    """
    client.force_login(user)
    response = client.post(
        reverse("stock-item-list"),
        data={
            "category": str(category.id),
            "name": "Sugar",
            "quantity": "10.000",
            "unit": "kg",
            "status": "in_stock",
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    item = StockItem.objects.get(id=response.json()["id"])
    readings = _readings(item)
    assert len(readings) == 1
    assert readings[0].kind == StockLevelReading.Kind.INVENTORY
    assert readings[0].quantity == Decimal("10.000")
    assert readings[-1].quantity == item.quantity


@pytest.mark.django_db
def test_create_item_with_zero_quantity_records_no_reading(client, user, category, membership):
    """An item created empty has nothing to plot yet — no spurious reading."""
    client.force_login(user)
    response = client.post(
        reverse("stock-item-list"),
        data={
            "category": str(category.id),
            "name": "Flour",
            "quantity": "0",
            "unit": "kg",
            "status": "out_of_stock",
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    item = StockItem.objects.get(id=response.json()["id"])
    assert _readings(item) == []


@pytest.mark.django_db
def test_edit_quantity_records_inventory_and_recomputes_status(client, user, category, membership, household):
    """Editing the quantity via the form is a de-facto inventory count.

    It must persist a reading, recompute the status from the new level, and keep
    the invariant (last reading == item.quantity).
    """
    item = StockItem.objects.create(
        household=household,
        category=category,
        name="Beans",
        quantity=Decimal("5.000"),
        min_quantity=Decimal("2"),
        unit="kg",
        status="in_stock",
        created_by=user,
    )

    client.force_login(user)
    response = client.patch(
        reverse("stock-item-detail", kwargs={"pk": item.id}),
        data={"quantity": "1.000"},
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["quantity"] == "1.000"
    assert payload["status"] == "low_stock"

    item.refresh_from_db()
    readings = _readings(item)
    assert len(readings) == 1
    assert readings[0].kind == StockLevelReading.Kind.INVENTORY
    assert readings[0].quantity == Decimal("1.000")
    assert readings[-1].quantity == item.quantity


@pytest.mark.django_db
def test_edit_without_quantity_change_records_no_reading(client, user, category, membership, household):
    """Editing another field (not the quantity) must not fabricate a reading."""
    item = StockItem.objects.create(
        household=household,
        category=category,
        name="Rice",
        quantity=Decimal("3.000"),
        unit="kg",
        status="in_stock",
        created_by=user,
    )

    client.force_login(user)
    response = client.patch(
        reverse("stock-item-detail", kwargs={"pk": item.id}),
        data={"name": "Basmati rice"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert _readings(item) == []


# --- Dater soi-même un comptage (#575) ---------------------------------------


@pytest.mark.django_db
def test_inventory_accepts_a_chosen_date(client, user, feed, membership):
    """Un comptage se date au jour où on a compté, pas au jour où on le saisit.

    Le serveur l'acceptait déjà ; rien ne le tenait. Un relevé importé antidate
    la dépense, et l'inventaire qui l'accompagne doit pouvoir suivre.
    """
    client.force_login(user)
    counted_on = timezone.now() - timedelta(days=9)

    response = client.post(
        _inventory_url(feed),
        data={"quantity": "8.5", "occurred_at": counted_on.isoformat()},
        content_type="application/json",
    )

    assert response.status_code == 200, response.content
    readings = _readings(feed)
    assert len(readings) == 1
    assert abs((readings[0].reading_at - counted_on).total_seconds()) < 1


@pytest.mark.django_db
def test_purchase_dates_the_remaining_count_on_its_own_day(client, user, feed, membership):
    """La quantité restante se compte un jour, l'achat se fait un autre.

    Sans `remaining_at`, la lecture `inventory` héritait de la date de la
    dépense : la courbe racontait la date de saisie, pas celle du comptage.
    """
    client.force_login(user)
    bought_on = timezone.now() - timedelta(days=2)
    counted_on = timezone.now() - timedelta(days=5)

    response = client.post(
        _purchase_url(feed),
        data={
            "delta": "20",
            "amount": "30",
            "remaining_before": "0.5",
            "occurred_at": bought_on.isoformat(),
            "remaining_at": counted_on.isoformat(),
        },
        content_type="application/json",
    )

    assert response.status_code == 201, response.content
    readings = _readings(feed)
    assert len(readings) == 2
    assert readings[0].kind == StockLevelReading.Kind.INVENTORY
    assert abs((readings[0].reading_at - counted_on).total_seconds()) < 1
    assert readings[1].kind == StockLevelReading.Kind.PURCHASE
    assert abs((readings[1].reading_at - bought_on).total_seconds()) < 1


@pytest.mark.django_db
def test_purchase_refuses_a_remaining_count_after_the_purchase(client, user, feed, membership):
    """« Restant avant » veut dire avant : un comptage postérieur est un refus.

    L'accepter écrirait la dernière lecture *sous* la quantité de l'article et
    casserait l'invariant (dernière lecture == quantité). Le geste existe : un
    inventaire à part, avec sa propre date.
    """
    client.force_login(user)
    bought_on = timezone.now() - timedelta(days=5)

    response = client.post(
        _purchase_url(feed),
        data={
            "delta": "20",
            "remaining_before": "0.5",
            "occurred_at": bought_on.isoformat(),
            "remaining_at": (bought_on + timedelta(days=1)).isoformat(),
        },
        content_type="application/json",
    )

    assert response.status_code == 400, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("2.000")
    assert _readings(feed) == []


# --- La consommation se lit en courbe de niveau (#622) ------------------------


def _levels(data):
    return [point["quantity"] for point in data["levels"]]


@pytest.mark.django_db
def test_the_level_curve_joins_the_readings_day_by_day(client, user, feed, membership):
    """Entre deux comptages, la droite qui les joint est la seule lecture honnête.

    Un relevé dit *combien il reste*, jamais *quand ça a été mangé* : les barres
    quotidiennes d'avant (#575) affirmaient une mesure par jour là où il n'y
    avait qu'une division. La courbe, elle, dit exactement ce que l'arithmétique
    du « rythme de consommation » affirme déjà — et les deux ne peuvent donc pas
    se contredire à l'écran.
    """
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=10))
    record_inventory(item=feed, user=user, quantity=Decimal("2"), occurred_at=now)

    data = client.get(_consumption_url(feed)).json()

    levels = _levels(data)
    # Un point par jour couvert, des deux relevés inclus.
    assert len(levels) == 11
    assert levels[0] == pytest.approx(10.0)
    assert levels[-1] == pytest.approx(2.0)
    # 8 kg sur 10 jours = 0,8/jour, et la descente est régulière.
    assert levels[1] == pytest.approx(9.2)
    assert all(b < a for a, b in zip(levels, levels[1:]))


@pytest.mark.django_db
def test_a_purchase_shows_as_a_jump_in_the_curve(client, user, feed, membership):
    """Un achat fait remonter le niveau — c'est ce que les barres cachaient.

    Le calcul des barres passait les hausses par un simple ``continue`` : le
    réapprovisionnement, qui est pourtant l'événement le plus visible de la vie
    d'un article, n'apparaissait nulle part sur le graphique.
    """
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=20))
    record_inventory(item=feed, user=user, quantity=Decimal("2"), occurred_at=now - timedelta(days=10))
    record_inventory(item=feed, user=user, quantity=Decimal("12"), occurred_at=now)

    levels = _levels(client.get(_consumption_url(feed)).json())

    assert levels[0] == pytest.approx(10.0)
    assert min(levels) == pytest.approx(2.0)
    assert levels[-1] == pytest.approx(12.0)


@pytest.mark.django_db
def test_nothing_is_drawn_before_the_first_reading(client, user, feed, membership):
    """Avant le premier relevé, on ne sait pas — et « on ne sait pas » ≠ zéro.

    Les barres remplissaient la fenêtre de zéros jusqu'au premier comptage : un
    article acheté la semaine dernière s'affichait comme n'ayant rien consommé
    pendant les 80 jours d'avant, alors qu'il n'existait pas encore.
    """
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=5))
    record_inventory(item=feed, user=user, quantity=Decimal("5"), occurred_at=now)

    data = client.get(_consumption_url(feed), {"period": "90d"}).json()

    # La courbe commence au premier relevé, pas au bord de la fenêtre.
    assert len(_levels(data)) == 6
    first = data["levels"][0]["ts"][:10]
    assert first == (now - timedelta(days=5)).date().isoformat()


@pytest.mark.django_db
def test_the_curve_stops_at_the_last_reading(client, user, feed, membership):
    """Après le dernier comptage, plus rien n'est connu — la projection prend le relais.

    Prolonger le trait plein jusqu'à aujourd'hui affirmerait un niveau que
    personne n'a relevé ; c'est au pointillé de la projection de le dire.
    """
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=20))
    record_inventory(item=feed, user=user, quantity=Decimal("4"), occurred_at=now - timedelta(days=8))

    data = client.get(_consumption_url(feed)).json()

    last = data["levels"][-1]
    assert last["ts"][:10] == (now - timedelta(days=8)).date().isoformat()
    assert last["quantity"] == pytest.approx(4.0)


@pytest.mark.django_db
def test_the_level_curve_anchors_on_the_last_reading_before_the_window(
    client, user, feed, membership
):
    """Une fenêtre courte sur un article lent n'a rien à montrer sans ancre.

    Le dernier relevé *avant* la fenêtre est ce qui rend la descente lisible sur
    30 jours ; sans lui l'écran annonce « pas assez de données » alors que
    l'article se vide sous les yeux de son propriétaire.
    """
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("12"), occurred_at=now - timedelta(days=60))
    record_inventory(item=feed, user=user, quantity=Decimal("0"), occurred_at=now)

    data = client.get(_consumption_url(feed), {"period": "30d"}).json()

    # Un seul relevé dans la fenêtre — le contrat de `points` ne bouge pas.
    assert data["points_count"] == 1
    levels = _levels(data)
    # 12 kg sur 60 jours = 0,2/jour : au bord de la fenêtre il en reste ~6.
    assert levels[0] == pytest.approx(6.0, abs=0.25)
    assert levels[-1] == pytest.approx(0.0)
    assert data["rate_per_day"] == pytest.approx(0.2, abs=0.01)


@pytest.mark.django_db
def test_a_single_reading_draws_no_curve(client, user, feed, membership):
    """Un seul relevé ne fait pas une consommation — pas de trait à plat."""
    client.force_login(user)
    record_inventory(item=feed, user=user, quantity=Decimal("10"))

    data = client.get(_consumption_url(feed)).json()
    assert data["levels"] == []
