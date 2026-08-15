# core/tests/test_seed_demo_coherence.py
"""Le foyer de démonstration ne montre que les écarts qu'on a décidés.

La seed alimente une vitrine publique : c'est le premier — et souvent le seul —
produit qu'un inconnu verra. Un écart qui s'y glisse sans avoir été voulu ne
casse rien, ne lève rien, et s'affiche en rouge dans l'écran dont l'argument est
justement que les chiffres se tiennent.

D'où ce test, qui **épingle le catalogue** plutôt que de le décrire. Il applique
à la démonstration la règle du parcours 26 : toute entité est soit résolue, soit
flaggée avec un motif ; rien ne reste dans un entre-deux silencieux. Ajouter un
écart à la vitrine est une décision légitime — la prendre sans s'en apercevoir ne
l'est pas, et c'est la seule chose que ce test refuse.

Il tient aussi l'arithmétique que trois ans d'historique généré rendent facile à
casser sans le voir : la chaîne des soldes, et le fait que le Contrôle ait
réellement pu s'exécuter — un compteur à zéro veut dire « rien à signaler » *ou*
« rien d'évaluable », et confondre les deux a déjà produit un silence complet en
production.
"""
from __future__ import annotations

import pytest
from django.core.management import call_command

from banking import compliance, coverage
from banking.models import BankAccount
from households.models import Household

#: Ce que la vitrine montre au Contrôle, et **rien d'autre**. Chaque ligne est un
#: choix, avec sa raison — c'est le pendant, côté démonstration, du « motif requis »
#: d'un ``ComplianceWaiver``.
EXPECTED_FINDINGS = {
    # Un restaurant que personne n'a rangé : l'écart le plus banal d'un vrai foyer,
    # et celui par lequel on comprend à quoi sert la file « À ranger ».
    # Un virement d'épargne dont le libellé n'annonce pas qu'il est interne : il
    # montre que House propose et que l'utilisateur trancher.
    "transaction_unallocated": 2,
    # Un retrait au distributeur dont les espèces n'ont pas encore été déclarées.
    # Il donne à voir le compte espèces, que rien d'autre n'introduit.
    "internal_without_counterpart": 1,
    # Un achat de stock saisi hors relevé : la preuve qu'une dépense existe avant
    # que la banque ne la confirme, et que l'app ne l'invente pas pour autant.
    "expense_unreconciled": 1,
    "expense_without_budget": 1,
}


@pytest.fixture
def seeded(db):
    """La seed, rejouée **dans** la transaction du test.

    Volontairement de portée fonction, malgré les trois secondes que ça coûte à
    chaque cas. Une fixture de portée classe doit écrire via
    ``django_db_blocker.unblock()``, donc **hors** de la transaction que
    pytest-django annule après chaque test : les données commitent pour de bon et
    restent dans la base pour toute la suite. Essayé — 491 erreurs dans les autres
    apps. Un test qui contamine ses voisins coûte infiniment plus cher que le
    temps qu'il économise.
    """
    call_command("seed_demo_data", "--flush")
    return Household.objects.get(name="Famille Mercier")


@pytest.mark.slow
@pytest.mark.django_db
class TestTheDemoOnlyShowsChosenGaps:
    def test_the_control_could_actually_run(self, seeded):
        """Un compteur à zéro a deux sens ; celui-ci doit être « rien à signaler ».

        Sans fenêtre de conformité, les quatorze détecteurs renvoient zéro sans
        avoir rien vérifié, et la démonstration afficherait une coche verte qui ne
        veut rien dire. C'est le défaut qui a produit un silence total en prod.
        """
        for account in BankAccount.objects.filter(household=seeded):
            reason, window = coverage.window_status(account)
            assert reason == "", f"{account.name} : {reason}"
            assert window is not None

    def test_the_catalogue_of_gaps_is_exactly_what_was_decided(self, seeded):
        found = {
            group.spec.kind: compliance.serialize_group(group)["detected"]
            for group in compliance.summary(seeded)
        }
        actual = {kind: count for kind, count in found.items() if count}
        assert actual == EXPECTED_FINDINGS

    def test_the_balance_chain_closes_over_three_years(self, seeded):
        """Six cents opérations générées, et l'arithmétique des soldes imprimés doit
        se refermer de bout en bout — sinon la démonstration se contredit dans
        l'écran qui prétend justement qu'elle ne le fait jamais."""
        group = next(
            g for g in compliance.summary(seeded) if g.spec.kind == "account_chain_broken"
        )
        assert compliance.serialize_group(group)["detected"] == 0

    def test_every_savings_transfer_found_its_other_leg(self, seeded):
        """Trois ans de virements vers le livret, tous liés par le vrai service.

        Un seul reste sans contrepartie, et c'est un choix : celui du mois en
        cours, sur lequel un visiteur peut encore agir.
        """
        savings = BankAccount.objects.get(household=seeded, name="Livret A")
        transfers = savings.transactions.filter(direction="in")
        assert transfers.count() > 0
        assert not transfers.filter(transfer_counterpart__isnull=True).exists()
