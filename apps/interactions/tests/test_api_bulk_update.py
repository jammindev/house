"""POST /api/interactions/interactions/bulk-update/ — corriger un lot de dépenses.

Le geste manquant. Renommer une orthographe fautive sur douze lignes demandait
douze allers-retours par la fiche, et vider la liste du détecteur
`expense_without_budget` — qui réclame un budget sur chaque dépense de la fenêtre —
était le travail le plus répétitif du module alors que la réponse est toujours la
même.

Deux invariants, et le premier est celui qui rend l'action utilisable :

1. **le lot est atomique**. Un id qui n'est pas une dépense du foyer fait échouer
   le lot entier. Écrire les huit ids valides et taire les quatre autres laisserait
   celui qui a lancé le lot sans moyen de savoir ce qui a été fait — il n'existe
   aucun écran pour rattraper une écriture partielle ;
2. **les mêmes règles qu'une écriture unitaire**. Le fournisseur passe par
   `register_supplier` (donc le catalogue s'alimente, et c'est l'orthographe
   canonique qui est écrite), le budget par la résolution qui refuse le budget
   global et celui d'un autre foyer. Un chemin de masse qui contourne les règles du
   chemin unitaire est une porte ouverte sur des données que rien n'a validées.
"""
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from budget.models import Budget
from households.models import Household, HouseholdMember
from interactions.models import Interaction, Supplier
from interactions.services import register_supplier

URL = '/api/interactions/interactions/bulk-update/'


def _expense(household, user, *, supplier='', subject='Dépense', budget=None):
    return Interaction.objects.create(
        household=household,
        created_by=user,
        subject=subject,
        type='expense',
        occurred_at=timezone.now(),
        amount=Decimal('10.00'),
        kind='manual',
        supplier=supplier,
        budget=budget,
    )


@pytest.fixture
def context(db):
    household = Household.objects.create(name='Foyer')
    user = UserFactory()
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)
    client = APIClient()
    client.force_authenticate(user=user)
    client.defaults['HTTP_X_HOUSEHOLD_ID'] = str(household.id)
    return {'household': household, 'user': user, 'client': client}


class TestChangingTheSupplierOfManyAtOnce:
    def test_it_rewrites_every_selected_expense(self, context):
        rows = [
            _expense(context['household'], context['user'], supplier='Leclerc'),
            _expense(context['household'], context['user'], supplier='leclerc'),
            _expense(context['household'], context['user'], supplier=''),
        ]

        response = context['client'].post(
            URL,
            {'ids': [str(row.id) for row in rows], 'supplier': 'E.Leclerc'},
            format='json',
        )

        assert response.status_code == 200
        assert response.data['updated'] == 3
        for row in rows:
            row.refresh_from_db()
            assert row.supplier == 'E.Leclerc'

    def test_it_leaves_untouched_what_was_not_selected(self, context):
        picked = _expense(context['household'], context['user'], supplier='Leclerc')
        other = _expense(context['household'], context['user'], supplier='Decathlon')

        context['client'].post(
            URL, {'ids': [str(picked.id)], 'supplier': 'E.Leclerc'}, format='json'
        )

        other.refresh_from_db()
        assert other.supplier == 'Decathlon'

    def test_the_catalogue_is_fed_like_any_other_write(self, context):
        # Un chemin de masse qui contournerait `register_supplier` ferait entrer
        # une orthographe hors catalogue par la petite porte, et le select
        # ignorerait un fournisseur pourtant posé sur douze dépenses.
        row = _expense(context['household'], context['user'])

        context['client'].post(
            URL, {'ids': [str(row.id)], 'supplier': 'Brico Dépôt'}, format='json'
        )

        assert Supplier.objects.filter(
            household=context['household'], name='Brico Dépôt'
        ).exists()

    def test_a_known_spelling_wins_over_the_typed_one(self, context):
        register_supplier(household_id=context['household'].id, name='Leroy Merlin')
        row = _expense(context['household'], context['user'])

        response = context['client'].post(
            URL, {'ids': [str(row.id)], 'supplier': 'LEROY merlin'}, format='json'
        )

        assert response.data['supplier'] == 'Leroy Merlin'
        row.refresh_from_db()
        assert row.supplier == 'Leroy Merlin'
        assert Supplier.objects.filter(household=context['household']).count() == 1


class TestChangingTheBudgetOfManyAtOnce:
    def test_it_assigns_the_budget_to_every_selected_expense(self, context):
        budget = Budget.objects.create(
            household=context['household'], name='Bricolage', monthly_amount=Decimal('400.00')
        )
        rows = [_expense(context['household'], context['user']) for _ in range(3)]

        response = context['client'].post(
            URL,
            {'ids': [str(row.id) for row in rows], 'budget_id': str(budget.id)},
            format='json',
        )

        assert response.status_code == 200
        for row in rows:
            row.refresh_from_db()
            assert row.budget_id == budget.id

    def test_clearing_the_budget_is_an_explicit_value(self, context):
        # `null` est un choix (« retirer l'enveloppe »), l'absence de clé est
        # « ne touche pas au budget ». Les confondre rendrait impossible l'un des
        # deux gestes.
        budget = Budget.objects.create(
            household=context['household'], name='Bricolage', monthly_amount=Decimal('400.00')
        )
        row = _expense(context['household'], context['user'], budget=budget)

        response = context['client'].post(
            URL, {'ids': [str(row.id)], 'budget_id': None}, format='json'
        )

        assert response.status_code == 200
        row.refresh_from_db()
        assert row.budget_id is None

    def test_omitting_the_key_leaves_the_budget_alone(self, context):
        budget = Budget.objects.create(
            household=context['household'], name='Bricolage', monthly_amount=Decimal('400.00')
        )
        row = _expense(context['household'], context['user'], budget=budget)

        context['client'].post(
            URL, {'ids': [str(row.id)], 'supplier': 'Decathlon'}, format='json'
        )

        row.refresh_from_db()
        assert row.budget_id == budget.id

    def test_the_global_budget_is_refused(self, context):
        # Même règle que sur une écriture unitaire : le plafond global couvre tout
        # et n'est jamais une cible d'affectation.
        glob = Budget.objects.create(
            household=context['household'],
            name='Global',
            monthly_amount=Decimal('2000.00'),
            is_global=True,
        )
        row = _expense(context['household'], context['user'])

        response = context['client'].post(
            URL, {'ids': [str(row.id)], 'budget_id': str(glob.id)}, format='json'
        )

        assert response.status_code == 400
        row.refresh_from_db()
        assert row.budget_id is None

    def test_a_budget_of_another_household_is_refused(self, context):
        other = Household.objects.create(name='Voisins')
        foreign = Budget.objects.create(
            household=other, name='Chez eux', monthly_amount=Decimal('100.00')
        )
        row = _expense(context['household'], context['user'])

        response = context['client'].post(
            URL, {'ids': [str(row.id)], 'budget_id': str(foreign.id)}, format='json'
        )

        assert response.status_code == 400


class TestTheBatchIsAllOrNothing:
    def test_an_expense_of_another_household_fails_the_whole_batch(self, context):
        # L'invariant central. Écrire les ids valides et taire les autres
        # laisserait celui qui a lancé le lot sans moyen de savoir ce qui a été
        # fait, et aucun écran ne rattrape une écriture partielle.
        other = Household.objects.create(name='Voisins')
        mine = _expense(context['household'], context['user'], supplier='Leclerc')
        theirs = _expense(other, context['user'], supplier='Leclerc')

        response = context['client'].post(
            URL,
            {'ids': [str(mine.id), str(theirs.id)], 'supplier': 'E.Leclerc'},
            format='json',
        )

        assert response.status_code == 400
        mine.refresh_from_db()
        theirs.refresh_from_db()
        assert mine.supplier == 'Leclerc'
        assert theirs.supplier == 'Leclerc'

    def test_an_unknown_id_fails_the_whole_batch(self, context):
        mine = _expense(context['household'], context['user'], supplier='Leclerc')

        response = context['client'].post(
            URL,
            {
                'ids': [str(mine.id), '00000000-0000-0000-0000-000000000000'],
                'supplier': 'E.Leclerc',
            },
            format='json',
        )

        assert response.status_code == 400
        mine.refresh_from_db()
        assert mine.supplier == 'Leclerc'

    def test_a_non_expense_fails_the_whole_batch(self, context):
        # Un fournisseur ou un budget sur une note ne veut rien dire : la colonne
        # est propre aux dépenses.
        note = Interaction.objects.create(
            household=context['household'],
            created_by=context['user'],
            subject='Note',
            type='note',
            occurred_at=timezone.now(),
        )

        response = context['client'].post(
            URL, {'ids': [str(note.id)], 'supplier': 'Decathlon'}, format='json'
        )

        assert response.status_code == 400

    def test_a_malformed_id_is_a_400_not_a_500(self, context):
        response = context['client'].post(
            URL, {'ids': ['pas-un-uuid'], 'supplier': 'Decathlon'}, format='json'
        )

        assert response.status_code == 400

    def test_an_empty_selection_is_refused(self, context):
        response = context['client'].post(URL, {'ids': [], 'supplier': 'X'}, format='json')

        assert response.status_code == 400

    def test_a_batch_that_changes_nothing_is_refused(self, context):
        # Ni fournisseur ni budget : la requête n'exprime aucune intention, et
        # répondre « 12 mises à jour » à un lot qui n'a rien écrit serait un
        # mensonge tranquille.
        row = _expense(context['household'], context['user'])

        response = context['client'].post(URL, {'ids': [str(row.id)]}, format='json')

        assert response.status_code == 400

    def test_it_records_who_changed_them(self, context):
        # `.update()` contourne `save()`, donc `updated_at` et `updated_by` ne se
        # rempliraient pas tout seuls — et une écriture de masse sans trace est
        # exactement ce qu'on veut pouvoir relire.
        row = _expense(context['household'], context['user'])

        context['client'].post(
            URL, {'ids': [str(row.id)], 'supplier': 'Decathlon'}, format='json'
        )

        row.refresh_from_db()
        assert row.updated_by_id == context['user'].id
