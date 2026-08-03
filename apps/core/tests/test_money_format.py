# core/tests/test_money_format.py
"""
Un montant se lit dans la convention de son lecteur (issue #544).

``core.money.format_money`` est le pendant backend de ``formatAmount`` du front.
Il n'existe que pour la **prose** — un bilan mensuel est un bloc de texte, envoyé
aussi sur Telegram où aucun client ne peut formater. Partout où le serveur peut
laisser le client décider, il le fait : le récap-histoire émet des décimales
brutes avec ``value_type: "money"``, et c'est le bon réflexe.

Coverage:
  1. TestItFollowsTheActiveLanguage — séparateurs décimaux et de milliers
  2. TestItIsRobust                 — entrées limites, jamais d'exception
  3. TestTheReportUsesIt            — le bilan mensuel s'en sert vraiment
"""
from __future__ import annotations

from decimal import Decimal

import pytest
from django.utils import translation

from core.money import format_money


class TestItFollowsTheActiveLanguage:
    def test_french_uses_a_comma_and_groups_thousands(self):
        with translation.override("fr"):
            out = format_money("1240.50")
        assert "1" in out and "240,50" in out
        assert "." not in out  # le point décimal anglais n'a rien à faire ici
        assert out.endswith("€")

    def test_german_groups_with_a_dot_and_decimals_with_a_comma(self):
        with translation.override("de"):
            assert format_money("1240.50") == "1.240,50 €"

    def test_english_keeps_the_anglo_convention(self):
        with translation.override("en"):
            assert format_money("1240.50") == "1,240.50 €"

    def test_two_decimals_are_always_shown(self):
        """« 400 € » et « 400,00 € » dans le même paragraphe se liraient comme
        deux précisions différentes."""
        with translation.override("fr"):
            assert format_money("400") == format_money("400.00")
            assert format_money("400").startswith("400,00")

    def test_the_separator_is_the_one_the_language_uses(self):
        """Le français groupe par espace insécable, pas par point — sans quoi
        « 1.240,50 € » se lirait comme un montant allemand."""
        with translation.override("fr"):
            assert "." not in format_money("1240.50")
        with translation.override("de"):
            assert "." in format_money("1240.50")


class TestItIsRobust:
    def test_zero_is_rendered_not_skipped(self):
        with translation.override("fr"):
            assert format_money("0") == "0,00 €"

    def test_a_negative_amount_keeps_its_sign(self):
        with translation.override("fr"):
            assert format_money("-12.50").startswith("-12,50")

    def test_it_accepts_a_decimal_as_well_as_a_string(self):
        with translation.override("en"):
            assert format_money(Decimal("12.50")) == format_money("12.50")

    def test_garbage_degrades_instead_of_raising(self):
        """Un bilan figé ne doit jamais devenir illisible à cause d'une valeur
        aberrante — le rendu d'un mois entier vaut mieux qu'une exception."""
        assert "?" not in format_money("n/a")  # pas de masquage
        assert "n/a" in format_money("n/a")


@pytest.mark.django_db
class TestTheReportUsesIt:
    """Le défaut se voyait dans le bilan, pas dans le helper : c'est là qu'il
    faut le tenir."""

    def test_the_monthly_report_reads_in_french_numbers(self):
        from budget.report.render import render_text

        stats = {
            "month": "2026-07",
            "total_spent": "1240.50",
            "expense_count": 24,
            "budgets": [],
            "unbudgeted": "0.00",
            "top_expenses": [],
        }
        with translation.override("fr"):
            text = render_text(stats)

        assert "1240.50" not in text
        assert "240,50" in text

    def test_the_trend_percentage_follows_too(self):
        """« 1 240,50 € » et « 13.8% » côte à côte, c'est corrigé à moitié."""
        from budget.report.render import render_text

        stats = {
            "month": "2026-07",
            "total_spent": "1240.50",
            "expense_count": 24,
            "prev_month": "2026-06",
            "prev_total": "1090.00",
            "trend_pct": 13.83,
            "budgets": [],
            "unbudgeted": "0.00",
            "top_expenses": [],
        }
        with translation.override("fr"):
            text = render_text(stats)

        assert "13,8" in text
        assert "13.8" not in text
