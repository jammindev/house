"""Le filtre « sans fournisseur » — liste et résumé, un seul filtre.

Corriger le fournisseur d'un lot ne sert qu'à moitié si rien ne dit **lesquelles**
en manquent : il fallait parcourir la liste à l'œil pour composer la sélection.

Reprend le couple déjà livré pour les photos sans zone (`without_zone=1`), à
l'identique et pour deux raisons :

- **un paramètre à part, pas une sentinelle dans `supplier=`** — un fournisseur
  pourrait légitimement s'appeler « none », et `supplier=` (vide) est déjà lu comme
  « filtre sur la chaîne vide » par le endpoint générique, ce qui rend la valeur
  impossible à distinguer de l'absence de filtre côté client ;
- **le même filtre pour la liste et pour le résumé.** Les cartes de total sont
  au-dessus de la liste : si le filtre ne s'appliquait qu'à l'une des deux, le
  compteur contredirait ce qu'on lit en dessous, et aucun des deux ne dirait lequel
  se trompe. C'est la règle « un compteur ne peut pas avoir deux définitions ».
"""
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from interactions.models import Interaction

LIST_URL = '/api/interactions/interactions/'
SUMMARY_URL = '/api/interactions/interactions/expenses/summary/'


def _expense(household, user, *, supplier='', subject='Dépense', amount='10.00'):
    return Interaction.objects.create(
        household=household,
        created_by=user,
        subject=subject,
        type='expense',
        occurred_at=timezone.now(),
        amount=Decimal(amount),
        kind='manual',
        supplier=supplier,
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


class TestTheListCanShowOnlyWhatMissesASupplier:
    def test_it_keeps_the_ones_without_and_drops_the_others(self, context):
        naked = _expense(context['household'], context['user'], subject='À nommer')
        _expense(context['household'], context['user'], supplier='Decathlon', subject='Nommée')

        response = context['client'].get(f'{LIST_URL}?type=expense&without_supplier=1')

        assert response.status_code == 200
        assert [row['id'] for row in response.data['results']] == [str(naked.id)]

    def test_it_is_absent_by_default(self, context):
        _expense(context['household'], context['user'])
        _expense(context['household'], context['user'], supplier='Decathlon')

        response = context['client'].get(f'{LIST_URL}?type=expense')

        assert len(response.data['results']) == 2

    def test_a_falsy_value_does_not_filter(self, context):
        # `without_supplier=0` doit se lire « non », pas « paramètre présent donc
        # filtre actif » : un front qui envoie toujours la clé ne doit pas filtrer
        # à son insu.
        _expense(context['household'], context['user'])
        _expense(context['household'], context['user'], supplier='Decathlon')

        response = context['client'].get(f'{LIST_URL}?type=expense&without_supplier=0')

        assert len(response.data['results']) == 2

    def test_it_does_not_treat_whitespace_as_a_supplier(self, context):
        # Un espace n'est pas un nom. `register_supplier` n'en écrirait jamais,
        # mais un import historique a pu en laisser, et une dépense « nommée » d'un
        # espace serait invisible au filtre comme au rangement.
        blank = _expense(context['household'], context['user'], supplier='   ')

        response = context['client'].get(f'{LIST_URL}?type=expense&without_supplier=1')

        assert [row['id'] for row in response.data['results']] == [str(blank.id)]


class TestTheSummaryAgreesWithTheList:
    def test_the_total_only_counts_what_misses_a_supplier(self, context):
        # Le compteur est affiché **au-dessus** de la liste. Un total qui compte
        # des lignes que la liste ne montre pas fait perdre leur crédit aux deux.
        _expense(context['household'], context['user'], amount='40.00')
        _expense(context['household'], context['user'], amount='60.00')
        _expense(context['household'], context['user'], supplier='Decathlon', amount='500.00')

        response = context['client'].get(f'{SUMMARY_URL}?without_supplier=1')

        assert response.status_code == 200
        assert response.data['total'] == '100.00'
        assert response.data['count'] == 2

    def test_it_is_absent_by_default(self, context):
        _expense(context['household'], context['user'], amount='40.00')
        _expense(context['household'], context['user'], supplier='Decathlon', amount='60.00')

        response = context['client'].get(SUMMARY_URL)

        assert response.data['total'] == '100.00'


class TestItStaysScopedToTheHousehold:
    def test_another_household_is_never_listed(self, context):
        other = Household.objects.create(name='Voisins')
        HouseholdMember.objects.create(
            user=context['user'], household=other, role=HouseholdMember.Role.OWNER
        )
        _expense(other, context['user'], subject='Chez eux')
        mine = _expense(context['household'], context['user'], subject='Chez moi')

        response = context['client'].get(f'{LIST_URL}?type=expense&without_supplier=1')

        assert [row['id'] for row in response.data['results']] == [str(mine.id)]
