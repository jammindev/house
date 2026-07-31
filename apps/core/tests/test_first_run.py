"""Le premier démarrage d'une instance auto-hébergée, vérifié de bout en bout.

Ces tests couvrent ce qu'un inconnu voit dans les cinq premières minutes, et
c'est le seul endroit du dépôt où ce chemin est exercé : il ne passe par aucune
vue, aucun serializer, aucune URL. Il tient dans deux commandes de gestion
lancées par un conteneur ``init``, et un défaut y ressemble à « le produit ne
marche pas » plutôt qu'à une erreur.

Le foyer de démonstration est ici aussi parce qu'il **est** la première
impression du profil ``demo`` — et parce qu'il emprunte le vrai chemin d'import
de relevé : cassé, il l'est le jour où l'import l'est.
"""
import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from households.models import Household, HouseholdMember

User = get_user_model()


@pytest.mark.django_db
class TestTheFirstAccountOpensAUsableApp:
    """Un compte sans foyer se connecte et n'a rien — un demi-succès qui se lit
    exactement comme un échec."""

    def test_it_creates_an_account_a_household_and_the_membership(self, capsys):
        call_command("create_admin", email="pilote@exemple.fr", password="s3cret-de-test")

        user = User.objects.get(email="pilote@exemple.fr")
        assert user.is_superuser
        household = Household.objects.get()
        assert HouseholdMember.objects.filter(
            user=user, household=household, role=HouseholdMember.Role.OWNER
        ).exists()
        assert user.active_household_id == household.id

    def test_a_generated_password_is_printed_where_it_cannot_be_missed(self, capsys):
        """Un mot de passe généré qui défile entre deux migrations est perdu.

        Et un mot de passe perdu se répare, chez l'utilisateur, par un
        ``docker compose down -v`` — c'est-à-dire en détruisant son volume.
        """
        call_command("create_admin", email="pilote@exemple.fr")

        out = capsys.readouterr().out
        assert "pilote@exemple.fr" in out
        assert "Mot de passe" in out

    def test_running_it_again_changes_nothing(self):
        call_command("create_admin", email="pilote@exemple.fr", password="s3cret-de-test")
        call_command("create_admin", email="autre@exemple.fr", password="autre")

        assert User.objects.count() == 1
        assert Household.objects.count() == 1

    def test_it_stays_quiet_once_the_default_admin_has_been_deleted(self):
        """La condition porte sur « un compte existe », pas « ce compte existe ».

        Quelqu'un qui crée son vrai compte puis supprime l'admin par défaut ne
        doit pas le voir revenir à chaque redémarrage du conteneur, avec un mot
        de passe qu'il ne connaît pas.
        """
        call_command("create_admin", email="admin@maisonnee.local", password="x")
        User.objects.filter(email="admin@maisonnee.local").delete()
        vrai = User.objects.create_user(email="claire@exemple.fr", password="y")

        call_command("create_admin")

        assert list(User.objects.values_list("email", flat=True)) == [vrai.email]


@pytest.mark.django_db
class TestTheDemoHouseholdIsWorthVisiting:
    """Le profil ``demo`` existe pour qu'on clique dans un produit rempli.

    Un produit vide ne se juge pas : il se referme.
    """

    @pytest.fixture(autouse=True)
    def seeded(self):
        call_command("seed_demo_data")

    def test_the_statement_went_through_the_real_import_path(self):
        from banking.models import BankAccount, BankTransaction, StatementImport

        account = BankAccount.objects.get(name="Compte courant")
        trace = StatementImport.objects.get(account=account)
        assert trace.status == "completed"
        assert trace.created_count > 0
        # Preuve que ce n'est pas un `objects.create` déguisé : l'import calcule
        # un hash de déduplication, personne d'autre ne le fait.
        assert all(t.dedup_hash for t in BankTransaction.objects.all())

    def test_the_opening_balance_predates_the_statement(self):
        """Sans ça la fenêtre de conformité est vide et le Contrôle se tait.

        C'est le bug de production du parcours 26 : une coche verte qui veut
        dire « rien d'évaluable » et se lit « tout est en règle ».
        """
        from banking.models import BankAccount, BankTransaction

        account = BankAccount.objects.get(name="Compte courant")
        first_line = BankTransaction.objects.order_by("booked_on").first()
        assert account.opening_balance_date is not None
        assert account.opening_balance_date < first_line.booked_on

    def test_money_is_split_across_two_axes_at_once(self):
        """La ligne Leroy Merlin : 90 € sur le chantier ET sur l'enveloppe.

        C'est l'exemple qui montre qu'un budget et un projet répondent à deux
        questions différentes — « de quelle nature » et « sur quoi ».
        """
        from interactions.models import Interaction

        split = Interaction.objects.filter(supplier="Leroy Merlin")
        assert split.count() == 2
        assert {str(i.amount) for i in split} == {"90.00", "60.00"}
        assert all(i.budget_id for i in split)
        assert split.filter(source_object_id__isnull=False).exists()

    def test_it_shows_a_household_that_is_not_perfectly_tidy(self):
        """Deux opérations restent sans budget, exprès.

        Une démo entièrement verte ne montre jamais le Contrôle — l'écran qui
        fait le sel du module — et laisse croire qu'un vrai foyer termine un
        mois sans une seule ligne en suspens.
        """
        from banking.models import BankTransaction

        pending = BankTransaction.objects.filter(
            direction="out", is_internal=False, interactions__isnull=True
        )
        assert pending.count() >= 2

    def test_an_envelope_without_a_ceiling_exists(self):
        """`uncapped` est un état à part, ni « ok » ni « dépassé »."""
        from budget.models import Budget

        assert Budget.objects.filter(name="Loisirs", monthly_amount__isnull=True).exists()

    def test_a_refund_credits_an_envelope_rather_than_being_a_negative_expense(self):
        from banking.models import RefundAllocation

        allocation = RefundAllocation.objects.get()
        assert allocation.budget.name == "Santé"
        assert allocation.amount > 0

    def test_running_it_twice_creates_nothing_new(self):
        """L'idempotence n'est pas une politesse : le conteneur ``init`` la
        rejoue à chaque démarrage."""
        from banking.models import BankTransaction
        from interactions.models import Interaction

        before = (BankTransaction.objects.count(), Interaction.objects.count())
        call_command("seed_demo_data")
        assert (BankTransaction.objects.count(), Interaction.objects.count()) == before
