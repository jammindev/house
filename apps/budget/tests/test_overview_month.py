"""Le panneau Budgets se relit mois par mois (issue #516).

L'aperçu était figé sur le mois en cours : `compute_budget_overview` appelait
`current_month_range` sans paramètre, et rien dans l'API ne permettait de
demander autre chose. Or la question qu'on pose devant un plafond mensuel est
« et le mois dernier, on en était où ? ».

Ce que ces tests tiennent :

- un mois demandé borne **tout** l'aperçu, et pas seulement une ligne ;
- il est borné **chez le foyer**, comme le mois courant — sinon relire juillet
  depuis le sélecteur et depuis le résumé des dépenses donnerait deux totaux ;
- un mois illisible est un **400**, jamais un repli silencieux sur le mois en
  cours : afficher juillet à qui a demandé « 2026-13 » est le genre d'écart qui
  se lit comme un chiffre juste.
"""
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from budget.aggregations import compute_budget_overview
from budget.models import Budget
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from zones.models import Zone

PARIS = ZoneInfo("Europe/Paris")


@pytest.fixture
def paris_household(db):
    household = Household.objects.create(name="Maison", timezone="Europe/Paris")
    user = UserFactory()
    HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )
    Zone.objects.create(household=household, name="Maison", created_by=user)
    return household, user


def _client(user, household) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    client.cookies["household_id"] = str(household.id)
    return client


def _expense(household, user, *, amount, occurred_at, budget=None):
    return Interaction.objects.create(
        household=household,
        created_by=user,
        subject="Dépense",
        type="expense",
        kind="manual",
        amount=Decimal(amount),
        budget=budget,
        occurred_at=occurred_at,
    )


@pytest.fixture
def three_months(paris_household):
    """Trois mois, trois montants distincts — un total ne peut pas se confondre."""
    household, user = paris_household
    budget = Budget.objects.create(
        household=household,
        name="Courses",
        monthly_amount=Decimal("400.00"),
        created_by=user,
    )
    _expense(
        household, user, amount="120.00",
        occurred_at=datetime(2026, 5, 12, 10, 0, tzinfo=PARIS), budget=budget,
    )
    _expense(
        household, user, amount="250.00",
        occurred_at=datetime(2026, 6, 12, 10, 0, tzinfo=PARIS), budget=budget,
    )
    _expense(
        household, user, amount="30.00",
        occurred_at=datetime(2026, 7, 12, 10, 0, tzinfo=PARIS), budget=budget,
    )
    # Hors budget, en juin seulement : le « unbudgeted » doit suivre le mois lui
    # aussi, pas rester collé au mois courant.
    _expense(
        household, user, amount="17.00",
        occurred_at=datetime(2026, 6, 20, 10, 0, tzinfo=PARIS),
    )
    return household, user, budget


@pytest.mark.django_db
class TestAPastMonthCanBeRead:
    def test_the_month_asked_for_is_the_month_reported(self, three_months):
        household, _user, budget = three_months

        overview = compute_budget_overview(household=household, month="2026-06")

        assert overview["month"] == "2026-06"
        row = next(b for b in overview["budgets"] if b["id"] == str(budget.id))
        assert row["spent"] == "250.00"

    def test_every_total_follows_the_month_not_just_the_rows(self, three_months):
        """Un aperçu qui ne décalerait que ses lignes serait pire que pas de
        sélecteur : les lignes diraient juin, les totaux diraient juillet."""
        household, _user, _budget = three_months

        overview = compute_budget_overview(household=household, month="2026-06")

        assert overview["total_spent"] == "267.00"
        assert overview["unbudgeted"] == "17.00"

    def test_omitting_the_month_still_means_the_current_one(self, three_months):
        """Les fiches budget/catégorie appellent l'aperçu sans mois — le défaut
        ne bouge pas."""
        household, _user, _budget = three_months

        assert (
            compute_budget_overview(household=household)["month"]
            == compute_budget_overview(household=household, month=None)["month"]
        )

    def test_a_month_the_household_never_spent_in_is_empty_not_broken(self, three_months):
        household, _user, budget = three_months

        overview = compute_budget_overview(household=household, month="2026-01")

        row = next(b for b in overview["budgets"] if b["id"] == str(budget.id))
        assert overview["month"] == "2026-01"
        assert row["spent"] == "0.00"
        # Le plafond, lui, reste celui du budget : une enveloppe non consommée
        # n'est pas une enveloppe sans plafond.
        assert row["amount"] == "400.00"
        assert row["state"] == "ok"


@pytest.mark.django_db
class TestTheMonthIsBoundedAtTheHousehold:
    def test_the_first_and_last_hours_belong_to_the_local_month(self, paris_household):
        """00 h 30 le 1er juin à Paris, c'est 22 h 30 le 31 mai en UTC.

        Même règle que le mois courant (`core.timezones`) : borner un mois passé
        en UTC ferait glisser les dépenses de bord d'un mois à l'autre, et le
        sélecteur donnerait un autre total que le résumé des dépenses sur la
        même période.
        """
        household, user = paris_household
        budget = Budget.objects.create(
            household=household, name="Courses",
            monthly_amount=Decimal("400.00"), created_by=user,
        )
        _expense(
            household, user, amount="40.00",
            occurred_at=datetime(2026, 6, 1, 0, 30, tzinfo=PARIS), budget=budget,
        )
        _expense(
            household, user, amount="60.00",
            occurred_at=datetime(2026, 6, 30, 23, 30, tzinfo=PARIS), budget=budget,
        )

        overview = compute_budget_overview(household=household, month="2026-06")

        row = next(b for b in overview["budgets"] if b["id"] == str(budget.id))
        assert row["spent"] == "100.00"

    def test_december_does_not_leak_into_the_next_year(self, paris_household):
        household, user = paris_household
        budget = Budget.objects.create(
            household=household, name="Courses",
            monthly_amount=Decimal("400.00"), created_by=user,
        )
        _expense(
            household, user, amount="80.00",
            occurred_at=datetime(2026, 12, 15, 10, 0, tzinfo=PARIS), budget=budget,
        )
        _expense(
            household, user, amount="90.00",
            occurred_at=datetime(2027, 1, 3, 10, 0, tzinfo=PARIS), budget=budget,
        )

        december = compute_budget_overview(household=household, month="2026-12")
        january = compute_budget_overview(household=household, month="2027-01")

        row = next(b for b in december["budgets"] if b["id"] == str(budget.id))
        assert row["spent"] == "80.00"
        assert next(b for b in january["budgets"] if b["id"] == str(budget.id))["spent"] == "90.00"


@pytest.mark.django_db
class TestTheEndpointRefusesWhatItCannotRead:
    """Un mois illisible se dit, il ne se remplace pas.

    Le repli silencieux sur le mois en cours est le défaut classique : l'écran
    affiche des chiffres parfaitement valides pour un mois que personne n'a
    demandé, et rien ne le signale.
    """

    @pytest.mark.parametrize("value", ["2026-13", "juillet", "2026-7", "2026", "2026-00", ""])
    def test_a_malformed_month_is_a_400(self, paris_household, value):
        household, user = paris_household

        response = _client(user, household).get(
            reverse("budget-overview"), {"month": value}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_well_formed_month_goes_through(self, three_months):
        household, user, budget = three_months

        response = _client(user, household).get(
            reverse("budget-overview"), {"month": "2026-06"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["month"] == "2026-06"
        row = next(b for b in response.data["budgets"] if b["id"] == str(budget.id))
        assert row["spent"] == "250.00"

    def test_no_month_at_all_is_the_current_one(self, three_months):
        household, user, _budget = three_months

        response = _client(user, household).get(reverse("budget-overview"))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["month"] == compute_budget_overview(household=household)["month"]


@pytest.mark.django_db
class TestAFreeWindowIsReadToo:
    """« 30 derniers jours », « cette année », « du 3 au 9 février ».

    Le sélecteur du panneau est celui des dépenses, entier : ces fenêtres-là
    doivent répondre, et répondre sur la période demandée.
    """

    def test_a_free_window_sums_what_it_covers(self, three_months):
        household, _user, budget = three_months

        overview = compute_budget_overview(
            household=household, date_from=date(2026, 5, 1), date_to=date(2026, 6, 30)
        )

        row = next(b for b in overview["budgets"] if b["id"] == str(budget.id))
        assert row["spent"] == "370.00"  # 120 (mai) + 250 (juin)

    def test_a_window_narrower_than_a_month_is_honoured(self, three_months):
        household, _user, budget = three_months

        overview = compute_budget_overview(
            household=household, date_from=date(2026, 6, 1), date_to=date(2026, 6, 11)
        )

        row = next(b for b in overview["budgets"] if b["id"] == str(budget.id))
        assert row["spent"] == "0.00"  # la dépense de juin est le 12

    def test_the_last_day_of_the_window_is_included(self, paris_household):
        """Une date nue en fin d'intervalle vaut **fin** de journée.

        Bornée à minuit, la fenêtre exclut tout ce que son dernier jour contient —
        et le total recule d'un jour entier sans rien dire.
        """
        household, user = paris_household
        budget = Budget.objects.create(
            household=household, name="Courses",
            monthly_amount=Decimal("400.00"), created_by=user,
        )
        _expense(
            household, user, amount="50.00",
            occurred_at=datetime(2026, 6, 9, 23, 45, tzinfo=PARIS), budget=budget,
        )

        overview = compute_budget_overview(
            household=household, date_from=date(2026, 6, 3), date_to=date(2026, 6, 9)
        )

        row = next(b for b in overview["budgets"] if b["id"] == str(budget.id))
        assert row["spent"] == "50.00"


@pytest.mark.django_db
class TestACeilingNeedsAWholeMonthInFrontOfIt:
    """⚠️ Un plafond **mensuel** n'a pas d'échelle en face d'une année.

    Comparé à un total annuel, « 400 € / mois » afficherait « 4 200 € / 400 € »
    et une barre rouge saturée sur une enveloppe parfaitement tenue — un
    dépassement qui n'existe pas. Hors mois entier, l'aperçu repasse donc en
    `uncapped`, l'état que le module réserve déjà à « suivi, non plafonné ».
    """

    def test_a_free_window_reports_no_ceiling(self, three_months):
        household, _user, budget = three_months

        overview = compute_budget_overview(
            household=household, date_from=date(2026, 1, 1), date_to=date(2026, 12, 31)
        )

        row = next(b for b in overview["budgets"] if b["id"] == str(budget.id))
        assert overview["month"] is None
        assert row["amount"] is None
        assert row["state"] == "uncapped"
        assert row["ratio"] == 0.0
        # …mais le dépensé, lui, se lit toujours : c'est la question posée.
        assert row["spent"] == "400.00"

    def test_a_window_that_is_exactly_a_month_keeps_its_ceiling(self, three_months):
        """Du 1er au 30 juin, c'est juin — le plafond a bien une échelle."""
        household, _user, budget = three_months

        overview = compute_budget_overview(
            household=household, date_from=date(2026, 6, 1), date_to=date(2026, 6, 30)
        )

        row = next(b for b in overview["budgets"] if b["id"] == str(budget.id))
        assert overview["month"] == "2026-06"
        assert row["amount"] == "400.00"
        assert row["state"] != "uncapped"

    def test_a_month_missing_one_day_is_not_a_month(self, three_months):
        """Du 1er au 29 juin : presque juin, donc pas juin.

        Accepter « à peu près un mois » rouvrirait la comparaison faussée par la
        petite porte, et un plafond à peu près respecté ne veut rien dire.
        """
        household, _user, budget = three_months

        overview = compute_budget_overview(
            household=household, date_from=date(2026, 6, 1), date_to=date(2026, 6, 29)
        )

        row = next(b for b in overview["budgets"] if b["id"] == str(budget.id))
        assert overview["month"] is None
        assert row["amount"] is None

    def test_the_stored_ceiling_survives_so_editing_cannot_wipe_it(self, three_months):
        """⚠️ `amount` disparaît hors mois entier — `monthly_amount`, jamais.

        Le dialogue d'édition se pré-remplit depuis la ligne de l'aperçu. S'il
        lisait `amount`, ouvrir « Courses » depuis « cette année » afficherait un
        plafond vide, et le premier enregistrement l'effacerait en base sans un
        mot.
        """
        household, _user, budget = three_months

        overview = compute_budget_overview(
            household=household, date_from=date(2026, 1, 1), date_to=date(2026, 12, 31)
        )

        row = next(b for b in overview["budgets"] if b["id"] == str(budget.id))
        assert row["amount"] is None
        assert row["monthly_amount"] == "400.00"

    def test_the_global_warning_stays_quiet_on_a_free_window(self, paris_household):
        """« Les enveloppes dépassent le plafond global » compare deux plafonds.

        Sur une fenêtre sans plafond, il n'y a rien à comparer — et le crier
        quand même serait un reproche sur une question qu'on n'a pas posée.
        """
        household, user = paris_household
        Budget.objects.create(
            household=household, name="Global", monthly_amount=Decimal("100.00"),
            is_global=True, created_by=user,
        )
        Budget.objects.create(
            household=household, name="Courses", monthly_amount=Decimal("400.00"),
            created_by=user,
        )

        month = compute_budget_overview(household=household, month="2026-06")
        free = compute_budget_overview(
            household=household, date_from=date(2026, 1, 1), date_to=date(2026, 12, 31)
        )

        assert month["named_exceeds_global"] is True
        assert free["named_exceeds_global"] is False
        assert free["named_total_amount"] == "0.00"
        assert free["global"]["amount"] is None


@pytest.mark.django_db
class TestTheEndpointTakesAFreeWindow:
    def test_from_and_to_go_through(self, three_months):
        household, user, budget = three_months

        response = _client(user, household).get(
            reverse("budget-overview"), {"from": "2026-05-01", "to": "2026-06-30"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["month"] is None
        row = next(b for b in response.data["budgets"] if b["id"] == str(budget.id))
        assert row["spent"] == "370.00"

    @pytest.mark.parametrize(
        "params",
        [
            {"from": "2026-05-01"},                        # une seule borne
            {"to": "2026-06-30"},
            {"from": "lundi", "to": "2026-06-30"},          # date illisible
            {"from": "2026-05-01", "to": "2026-13-40"},
            {"from": "2026-06-30", "to": "2026-06-01"},     # à l'envers
            {"month": "2026-06", "from": "2026-05-01", "to": "2026-05-31"},  # les deux
        ],
    )
    def test_an_incoherent_window_is_a_400(self, three_months, params):
        household, user, _budget = three_months

        response = _client(user, household).get(reverse("budget-overview"), params)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
