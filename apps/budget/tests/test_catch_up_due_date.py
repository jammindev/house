# budget/tests/test_catch_up_due_date.py
"""Une échéance ne reste pas dans le passé — vérifié tous les jours du mois.

Le défaut que ce fichier garde n'existait **que la moitié du mois**, et c'est tout
son intérêt. Les échéances de la démonstration sont calées sur une ligne du relevé,
puis avancées d'un cran par l'import qui les confirme : un prélèvement du 15 du
mois dernier retombe le 15 de ce mois-ci. Avant le 15, tout est vert ; après, le
Contrôle affiche `recurring_overdue`.

Le test d'intégration qui l'attrape existait déjà et était déjà juste. Il n'a rien
dit pendant des semaines parce qu'il ne se déclenche que passé le 15 — et la CI
passait le 14. Même famille que `toISOString()` et que le fuseau du foyer : une
date qui n'est fausse qu'à certaines heures atteint la production parce que la
fenêtre où elle se voit est étroite.

D'où la forme de ces tests : la fonction est **pure**, donc on balaye les 28 jours
d'un mois et plusieurs mois de l'année sans base et sans horloge gelée. Un
invariant de date se vérifie sur toutes les dates, pas sur celle du jour où on
l'écrit.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from budget.models import RecurringExpense
from budget.services import advance_due_date, catch_up_due_date

CADENCES = [
    RecurringExpense.Cadence.MONTHLY,
    RecurringExpense.Cadence.QUARTERLY,
    RecurringExpense.Cadence.YEARLY,
]


class TestItNeverLeavesADueDateBehind:
    @pytest.mark.parametrize("cadence", CADENCES)
    @pytest.mark.parametrize("day", range(1, 29))
    def test_whatever_the_day_of_the_month_the_result_is_in_the_future(self, cadence, day):
        """Le balayage qui aurait parlé le 1er du mois au lieu du 16."""
        today = date(2026, 8, day)
        # Une échéance née d'une ligne de relevé du mois précédent, avancée d'un
        # cran par l'import : exactement ce que produit la seed.
        due = advance_due_date(date(2026, 7, 15), cadence)

        result = catch_up_due_date(due, cadence, today)

        assert result >= today

    @pytest.mark.parametrize("cadence", CADENCES)
    @pytest.mark.parametrize("month", range(1, 13))
    def test_it_holds_in_every_month_of_the_year(self, cadence, month):
        today = date(2026, month, 17)
        due = date(2023, 1, 31)

        assert catch_up_due_date(due, cadence, today) >= today

    @pytest.mark.parametrize("cadence", CADENCES)
    def test_a_future_date_is_left_untouched(self, cadence):
        """Idempotente : l'appelant n'a pas à savoir s'il doit appeler."""
        today = date(2026, 8, 17)
        due = date(2026, 12, 1)

        assert catch_up_due_date(due, cadence, today) == due

    @pytest.mark.parametrize("cadence", CADENCES)
    def test_today_itself_is_not_overdue(self, cadence):
        """La borne est `>=`, pas `>` : une échéance du jour n'est pas en retard."""
        today = date(2026, 8, 17)

        assert catch_up_due_date(today, cadence, today) == today

    def test_it_lands_on_a_real_occurrence_and_not_just_any_future_date(self):
        """Rattraper n'est pas décaler : le résultat reste sur la grille d'origine.

        Sans quoi la démonstration afficherait une échéance plausible tombant un
        jour que le prélèvement n'a jamais eu — et la projection de trésorerie
        annoncerait une date que le relevé démentira.
        """
        due = date(2026, 2, 10)
        today = date(2026, 8, 17)

        result = catch_up_due_date(due, RecurringExpense.Cadence.MONTHLY, today)

        assert result == date(2026, 9, 10)

    def test_a_quarterly_keeps_its_quarter(self):
        due = date(2026, 2, 10)
        today = date(2026, 8, 17)

        result = catch_up_due_date(due, RecurringExpense.Cadence.QUARTERLY, today)

        assert result == date(2026, 11, 10)

    def test_the_end_of_month_survives_february(self):
        """`_add_months` ramène au dernier jour valide ; le rattrapage l'hérite."""
        due = date(2025, 12, 31)
        today = date(2026, 3, 1)

        result = catch_up_due_date(due, RecurringExpense.Cadence.MONTHLY, today)

        assert result >= today
        assert result.day in (28, 29, 30, 31)

    def test_an_unknown_cadence_raises_rather_than_looping_forever(self):
        """Le garde-fou est avant la boucle : sans lui, `while` ne finit jamais."""
        with pytest.raises(ValueError, match="unknown cadence"):
            catch_up_due_date(date(2020, 1, 1), "fortnightly", date(2026, 8, 17))

    def test_a_very_old_date_still_terminates(self):
        """Six ans de retard, en une passe bornée."""
        result = catch_up_due_date(
            date(2020, 1, 15), RecurringExpense.Cadence.MONTHLY, date(2026, 8, 17)
        )

        assert result == date(2026, 9, 15)


class TestItAgreesWithTheSingleDefinitionOfNextTime:
    @pytest.mark.parametrize("cadence", CADENCES)
    def test_one_step_behind_is_exactly_one_advance(self, cadence):
        """Rattraper depuis un cran en arrière == avancer d'un cran.

        Le rattrapage ne doit pas être une seconde définition de « la prochaine
        fois » : il empile des `advance_due_date`, et rien d'autre.
        """
        today = date(2026, 8, 17)
        due = today - timedelta(days=1)

        assert catch_up_due_date(due, cadence, today) == advance_due_date(due, cadence)
