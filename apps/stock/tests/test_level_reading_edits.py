"""Corriger un relevé de niveau (#584).

Un relevé était une écriture sans retour : refaire un inventaire *ajoutait* une
lecture, ça n'en corrigeait aucune, et une descente fausse restait comptée comme
de la vraie consommation dans le rythme et dans la date de rupture.

Ce que ces tests tiennent, c'est l'invariant du module — la quantité d'un article
coïncide **toujours** avec sa dernière lecture. Corriger un relevé sans réaligner
l'article fabriquerait exactement le désaccord que la courbe est censée montrer.
"""
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
    return User.objects.create_user(email="readings@test.dev", password="secret")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email="stranger@test.dev", password="secret")


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


def _list_url():
    return reverse("stock-reading-list")


def _detail_url(reading):
    return reverse("stock-reading-detail", kwargs={"pk": reading.id})


def _readings(item):
    return list(StockLevelReading.objects.filter(stock_item=item).order_by("reading_at", "created_at"))


def _rows(response):
    payload = response.json()
    return payload["results"] if isinstance(payload, dict) else payload


@pytest.mark.django_db
def test_readings_are_listed_newest_first_for_one_item(client, user, feed, membership):
    """Un relevé qu'on ne voit pas est un relevé qu'on ne corrige pas."""
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=5))
    record_inventory(item=feed, user=user, quantity=Decimal("4"), occurred_at=now)

    response = client.get(_list_url(), {"stock_item": str(feed.id)})

    assert response.status_code == 200, response.content
    rows = _rows(response)
    assert [r["quantity"] for r in rows] == ["4.000", "10.000"]
    assert rows[0]["kind"] == "inventory"


@pytest.mark.django_db
def test_revising_the_latest_reading_moves_the_item_quantity(client, user, feed, membership):
    """Corriger la dernière lecture corrige l'article — sinon les deux divergent."""
    client.force_login(user)
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=timezone.now() - timedelta(days=5))
    latest = record_inventory(item=feed, user=user, quantity=Decimal("4")) and _readings(feed)[-1]

    response = client.patch(
        _detail_url(latest),
        data={"quantity": "6.5"},
        content_type="application/json",
    )

    assert response.status_code == 200, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("6.500")
    assert feed.status == "in_stock"  # 6.5 repasse au-dessus du minimum de 5
    assert _readings(feed)[-1].quantity == feed.quantity


@pytest.mark.django_db
def test_revising_an_older_reading_leaves_the_item_alone(client, user, feed, membership):
    """Corriger le passé ne touche pas au présent : la dernière lecture décide."""
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=5))
    record_inventory(item=feed, user=user, quantity=Decimal("4"), occurred_at=now)
    oldest = _readings(feed)[0]

    response = client.patch(
        _detail_url(oldest),
        data={"quantity": "12"},
        content_type="application/json",
    )

    assert response.status_code == 200, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("4.000")
    assert _readings(feed)[0].quantity == Decimal("12.000")


@pytest.mark.django_db
def test_moving_a_reading_in_time_can_make_it_the_latest(client, user, feed, membership):
    """La date décide de qui est la dernière — la réaligner n'est pas optionnel."""
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=5))
    record_inventory(item=feed, user=user, quantity=Decimal("4"), occurred_at=now - timedelta(days=1))
    oldest = _readings(feed)[0]

    response = client.patch(
        _detail_url(oldest),
        data={"reading_at": now.isoformat()},
        content_type="application/json",
    )

    assert response.status_code == 200, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("10.000")  # le relevé déplacé est devenu le dernier


@pytest.mark.django_db
def test_deleting_a_reading_falls_back_on_the_previous_one(client, user, feed, membership):
    """Supprimer le dernier relevé fait redescendre l'article sur celui d'avant."""
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=5))
    record_inventory(item=feed, user=user, quantity=Decimal("0"), occurred_at=now)
    latest = _readings(feed)[-1]

    response = client.delete(_detail_url(latest))

    assert response.status_code == 204, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("10.000")
    assert feed.status == "in_stock"
    assert len(_readings(feed)) == 1


@pytest.mark.django_db
def test_deleting_the_last_remaining_reading_empties_the_item(client, user, feed, membership):
    """Plus aucune mesure : la quantité tombe à 0, elle ne se devine pas.

    Garder 10 kg sans une seule lecture pour l'attester, ce serait exactement la
    valeur inventée que le projet refuse ailleurs (`guess_internal`, le vide qui
    n'est pas un choix). L'article redevient ce qu'est un article créé vide.
    """
    client.force_login(user)
    record_inventory(item=feed, user=user, quantity=Decimal("10"))
    only = _readings(feed)[0]

    response = client.delete(_detail_url(only))

    assert response.status_code == 204, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("0.000")
    assert feed.status == "out_of_stock"
    assert _readings(feed) == []


@pytest.mark.django_db
def test_a_reading_of_another_household_is_invisible(client, other_user, feed, membership, household):
    """Le scope foyer vaut pour un relevé comme pour tout le reste."""
    HouseholdMember.objects.create(
        user=other_user,
        household=Household.objects.create(name="Elsewhere"),
        role=HouseholdMember.Role.OWNER,
    )
    record_inventory(item=feed, user=other_user, quantity=Decimal("10"))
    only = _readings(feed)[0]

    client.force_login(other_user)
    assert _rows(client.get(_list_url(), {"stock_item": str(feed.id)})) == []
    assert client.delete(_detail_url(only)).status_code == 404
    assert len(_readings(feed)) == 1


@pytest.mark.django_db
def test_a_reading_cannot_go_negative(client, user, feed, membership):
    client.force_login(user)
    record_inventory(item=feed, user=user, quantity=Decimal("10"))
    only = _readings(feed)[0]

    response = client.patch(
        _detail_url(only),
        data={"quantity": "-1"},
        content_type="application/json",
    )

    assert response.status_code == 400
    feed.refresh_from_db()
    assert feed.quantity == Decimal("10.000")


@pytest.mark.django_db
def test_correcting_a_wrong_count_removes_its_phantom_consumption(client, user, feed, membership):
    """Le bug d'origine : une descente fausse restait dans le rythme pour toujours.

    Un relevé saisi à 0 par erreur fabrique 10 kg de consommation ; le corriger
    doit les retirer du calcul, pas s'empiler par-dessus.
    """
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=10))
    record_inventory(item=feed, user=user, quantity=Decimal("0"), occurred_at=now)
    wrong = _readings(feed)[-1]

    before = client.get(reverse("stock-item-consumption", kwargs={"pk": feed.id})).json()
    assert before["rate_per_day"] == pytest.approx(1.0, abs=0.01)

    client.patch(_detail_url(wrong), data={"quantity": "8"}, content_type="application/json")

    after = client.get(reverse("stock-item-consumption", kwargs={"pk": feed.id})).json()
    assert after["rate_per_day"] == pytest.approx(0.2, abs=0.01)
    assert sum(b["consumed"] for b in after["buckets"]) == pytest.approx(2.0, abs=0.05)
