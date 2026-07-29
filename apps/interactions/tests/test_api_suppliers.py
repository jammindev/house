"""Le catalogue des fournisseurs — la table, et ce qui l'alimente.

`Interaction.supplier` était un champ libre : rien n'empêchait « Leroy Merlin »,
« leroy merlin » et « LEROY MERLIN » de coexister comme trois fournisseurs. Les
chips de filtre en montraient trois, `by_supplier` répartissait la dépense sur
trois lignes, et le rapprochement n'en reconnaissait qu'une. Une valeur libre ne
peut pas porter cette contrainte — c'est le critère du CLAUDE.md pour sortir
d'`Interaction` : *contrainte DB (unicité) sur les données métier*.

Deux propriétés à tenir, et la seconde est celle qui se casse en silence :

1. la table se remplit **toute seule**, à chaque écriture de dépense — aucun écran
   de gestion, aucune déclaration préalable ;
2. `register_supplier` renvoie **l'orthographe déjà connue**, et les appelants
   stockent son retour. C'est ce qui fait converger la colonne au lieu de la
   multiplier ; un appelant qui stockerait sa propre saisie annulerait le
   catalogue sans qu'aucun test d'unicité ne rougisse.
"""
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from interactions.models import Interaction, Supplier
from interactions.services import (
    create_manual_expense_interaction,
    normalize_supplier_name,
    register_supplier,
)

URL = '/api/interactions/interactions/suppliers/'


def _expense(household, user, *, supplier, subject='Dépense'):
    return Interaction.objects.create(
        household=household,
        created_by=user,
        subject=subject,
        type='expense',
        occurred_at=timezone.now(),
        amount=Decimal('10.00'),
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


class TestTheCatalogueFillsItself:
    def test_a_new_name_enters_the_table(self, context):
        # Aucune étape préalable : la dépense qui fait connaître le fournisseur
        # l'inscrit. Demander de le déclarer d'abord serait le formulaire en trop
        # que ce chantier supprime.
        create_manual_expense_interaction(
            household=context['household'],
            user=context['user'],
            subject='Peinture',
            amount=Decimal('42.00'),
            supplier='Leroy Merlin',
        )

        assert Supplier.objects.filter(
            household=context['household'], name='Leroy Merlin'
        ).exists()

    def test_a_variant_of_spelling_reuses_the_known_one(self, context):
        # Le cœur du sujet. Sans ce retour, la table serait unique et la colonne
        # resterait fragmentée : trois chips, trois lignes de `by_supplier`.
        register_supplier(household_id=context['household'].id, name='Leroy Merlin')

        interaction = create_manual_expense_interaction(
            household=context['household'],
            user=context['user'],
            subject='Visserie',
            amount=Decimal('12.00'),
            supplier='LEROY  merlin',
        )

        assert interaction.supplier == 'Leroy Merlin'
        assert Supplier.objects.filter(household=context['household']).count() == 1

    def test_accents_do_not_split_a_supplier_in_two(self, context):
        register_supplier(household_id=context['household'].id, name='Boulangerie Épi Doré')

        assert (
            register_supplier(
                household_id=context['household'].id, name='boulangerie epi dore'
            )
            == 'Boulangerie Épi Doré'
        )
        assert Supplier.objects.filter(household=context['household']).count() == 1

    def test_an_empty_supplier_registers_nothing(self, context):
        # L'absence de fournisseur est une absence de saisie, pas un fournisseur
        # nommé « rien » — et une ligne vide en tête d'un select est un piège.
        assert register_supplier(household_id=context['household'].id, name='   ') == ''
        assert Supplier.objects.count() == 0

    def test_two_households_may_each_know_the_same_supplier(self, context):
        # L'unicité est **par foyer** : deux foyers ont le droit d'aller au même
        # magasin, et une unicité globale ferait dépendre le catalogue de l'un des
        # données de l'autre.
        other = Household.objects.create(name='Voisins')
        register_supplier(household_id=context['household'].id, name='Leroy Merlin')
        register_supplier(household_id=other.id, name='Leroy Merlin')

        assert Supplier.objects.filter(name='Leroy Merlin').count() == 2

    def test_editing_an_expense_registers_the_corrected_name(self, context):
        # Corriger un fournisseur sur une dépense est le geste le plus courant
        # pour en nommer un nouveau. S'il n'entrait pas au catalogue, le select ne
        # connaîtrait que ceux tapés juste du premier coup.
        interaction = _expense(context['household'], context['user'], supplier='')

        response = context['client'].patch(
            f'/api/interactions/interactions/{interaction.id}/',
            {'supplier': 'Brico Dépôt'},
            format='json',
        )

        assert response.status_code == 200
        assert Supplier.objects.filter(
            household=context['household'], name='Brico Dépôt'
        ).exists()

    def test_the_normalized_key_is_never_the_displayed_name(self, context):
        # La clé sert à l'unicité, pas à l'affichage : c'est cette séparation qui
        # garde l'orthographe du foyer tout en ignorant la casse.
        register_supplier(household_id=context['household'].id, name='Leroy Merlin')

        row = Supplier.objects.get(household=context['household'])
        assert row.name == 'Leroy Merlin'
        assert row.normalized_name == normalize_supplier_name('LEROY MERLIN')


class TestTheListIsOrderedByUse:
    def test_the_most_used_comes_first(self, context):
        # L'ordre est le service : un tri alphabétique remet le magasin des
        # courses derrière un achat unique d'il y a deux ans, et rend le select
        # aussi lent à parcourir que le champ libre qu'il remplace.
        for name in ['Leroy Merlin', 'Leroy Merlin', 'Leroy Merlin', 'Decathlon']:
            register_supplier(household_id=context['household'].id, name=name)
            _expense(context['household'], context['user'], supplier=name)

        response = context['client'].get(URL)

        assert response.status_code == 200
        assert [row['name'] for row in response.data['results']] == [
            'Leroy Merlin',
            'Decathlon',
        ]
        assert response.data['results'][0]['count'] == 3

    def test_a_supplier_never_used_stays_proposed_at_the_end(self, context):
        # Il a été tapé une fois, donc il le sera encore. Le retirer du select
        # obligerait à le retaper à la main — exactement le geste supprimé.
        register_supplier(household_id=context['household'].id, name='Garage Dupont')
        register_supplier(household_id=context['household'].id, name='Decathlon')
        _expense(context['household'], context['user'], supplier='Decathlon')

        response = context['client'].get(URL)

        rows = response.data['results']
        assert [row['name'] for row in rows] == ['Decathlon', 'Garage Dupont']
        assert rows[1]['count'] == 0

    def test_it_stops_at_the_household_boundary(self, context):
        other = Household.objects.create(name='Voisins')
        HouseholdMember.objects.create(
            user=context['user'], household=other, role=HouseholdMember.Role.OWNER
        )
        register_supplier(household_id=other.id, name='Fournisseur du voisin')
        register_supplier(household_id=context['household'].id, name='Decathlon')

        response = context['client'].get(URL)

        assert [row['name'] for row in response.data['results']] == ['Decathlon']

    def test_no_selected_household_is_an_empty_list_not_a_crash(self, context):
        client = APIClient()
        client.force_authenticate(user=UserFactory())

        response = client.get(URL)

        assert response.status_code == 200
        assert response.data['results'] == []
