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

    def test_without_a_password_it_creates_nothing_and_says_where_to_go(self, capsys):
        """Le renversement du parcours : plus aucun secret dans les logs.

        Cette commande générait un mot de passe et l'imprimait dans un cadre —
        que les logs de gunicorn faisaient défiler en une quinzaine de secondes.
        Elle nommait elle-même le risque : un mot de passe perdu se répare, chez
        l'utilisateur, par un ``docker compose down -v``, c'est-à-dire en
        détruisant son volume.

        Elle ne crée donc plus rien sans ``MAISONNEE_ADMIN_PASSWORD``, et
        l'instance reste ouverte à l'assistant de premier démarrage (#591). Le
        test tient les deux moitiés : rien n'est créé, **et** la sortie le dit —
        une commande qui ne fait rien en silence se lit comme une commande
        cassée.
        """
        call_command("create_admin", email="pilote@exemple.fr", password="")

        assert User.objects.count() == 0
        assert Household.objects.count() == 0
        assert "interface" in capsys.readouterr().out

    def test_with_a_password_it_announces_without_printing_it(self, capsys):
        """L'installation non surveillée : celui qui l'a lancée connaît déjà le mot
        de passe, puisqu'il l'a écrit. Le réimprimer ne l'aiderait pas et
        laisserait un secret dans les journaux du conteneur."""
        call_command(
            "create_admin", email="pilote@exemple.fr", password="un-mot-de-passe-solide-42"
        )

        out = capsys.readouterr().out
        assert "pilote@exemple.fr" in out
        assert "un-mot-de-passe-solide-42" not in out

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

        # Avec un mot de passe : sans lui, la commande sortirait de toute façon,
        # et le test passerait sans rien prouver de la garde qu'il vise.
        call_command("create_admin", password="x")

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
        """Toutes les recettes de la mutuelle, pas seulement la dernière.

        L'historique en sème une par trimestre, et une recette classée `refund` à
        laquelle aucune enveloppe n'est rendue est l'écart `refund_without_budget` :
        n'en créditer qu'une en laisserait autant derrière elle que de trimestres.
        """
        from banking.models import RefundAllocation

        allocations = list(RefundAllocation.objects.all())
        assert len(allocations) > 1
        assert {a.budget.name for a in allocations} == {"Santé"}
        assert all(a.amount > 0 for a in allocations)

    def test_the_control_could_actually_run(self):
        """Un compteur à zéro a deux sens ; celui-ci doit être « rien à signaler ».

        Le test au-dessus vérifie que le solde d'ouverture précède le relevé ;
        celui-ci vérifie que chaque compte en tire une fenêtre **exploitable**, ce
        qui n'est pas la même chose — et sans elle les détecteurs renvoient zéro
        sans avoir rien vérifié.
        """
        from banking import coverage
        from banking.models import BankAccount

        household = Household.objects.get(name="Famille Mercier")
        for account in BankAccount.objects.filter(household=household):
            reason, window = coverage.window_status(account)
            assert reason == "", f"{account.name} : {reason}"
            assert window is not None

    def test_every_savings_transfer_found_its_other_leg(self):
        """Trois ans de virements vers le livret, tous liés par le vrai service.

        Les lier par une FK écrite à la main aurait donné une vitrine impeccable
        illustrant un geste qu'aucun visiteur n'aurait pu reproduire.
        """
        from banking.models import BankAccount

        savings = BankAccount.objects.get(name="Livret A")
        transfers = savings.transactions.filter(direction="in")
        assert transfers.count() > 0
        assert not transfers.filter(transfer_counterpart__isnull=True).exists()

    def test_the_stock_purchase_is_justified_by_a_statement_line(self):
        """Une dépense née dans un autre module, retrouvée par la banque.

        Elle vivait **hors** de la fenêtre de conformité, ce qui la dispensait de
        justificatif. Depuis que la fenêtre remonte à trois ans, plus rien n'est
        « avant » : tout ce qui devient évaluable doit être résolu ou assumé.
        """
        from interactions.models import Interaction

        purchase = Interaction.objects.get(kind="stock_purchase", supplier="Gamm vert")
        assert purchase.budget_id is not None
        assert purchase.bank_transaction_id is not None

    def test_the_statement_confirms_the_recurrences_it_covers(self):
        """Deux échéances sont calées sur une ligne du relevé, au centime près.

        C'est l'import qui les confirme, pas la seed : une récurrence semée à
        côté de son prélèvement laisserait « échéance passée non confirmée » sur
        une ligne déjà au relevé — l'app fabriquerait son propre écart.
        """
        from budget.models import RecurringExpense
        from core.timezones import household_today
        from interactions.models import Interaction

        household = Household.objects.get(name="Famille Mercier")
        confirmed = Interaction.objects.filter(kind="recurring", recurring_expense__isnull=False)
        assert confirmed.count() == 2

        # Et toute échéance repart dans le futur : une récurrence qui naît en
        # retard est un écart que le foyer n'a aucun moyen de résoudre.
        today = household_today(household)
        assert all(r.next_due_date >= today for r in RecurringExpense.objects.all())

    def test_every_module_of_the_sidebar_has_something_to_show(self):
        """Un module vide est un module qu'on juge sans l'avoir vu.

        La liste est celle des modules que la seed alimente ; un module ajouté
        au produit et oublié ici arrive vide chez le visiteur.
        """
        from chickens.models import Chicken, EggLog
        from directory.models import Contact, Structure
        from equipment.models import Equipment
        from insurance.models import InsuranceContract
        from shopping.models import ShoppingListItem
        from stock.models import StockItem, StockLevelReading
        from trackers.models import Tracker, TrackerEntry
        from water.models import WaterReading

        for model in (
            Equipment, StockItem, StockLevelReading, ShoppingListItem,
            Chicken, EggLog, WaterReading, InsuranceContract,
            Tracker, TrackerEntry, Structure, Contact,
        ):
            assert model.objects.exists(), f"{model.__name__} : aucun objet semé"

    def test_a_stock_item_carries_a_curve_and_not_a_single_point(self):
        """Une quantité posée à plat ne se trace pas.

        L'écran de consommation dérive une pente et une date d'épuisement des
        relevés successifs : un article créé à sa quantité du jour n'a qu'un
        point, et l'écran n'a rien à montrer.
        """
        from stock.models import StockItem
        from stock.services import compute_consumption

        item = StockItem.objects.get(name="Granulés pour poules")
        consumption = compute_consumption(item, period="all")
        assert consumption["points_count"] >= 4
        assert consumption["rate_per_day"] > 0
        # Le rachat est daté hors de la fenêtre de conformité : une dépense sans
        # ligne de relevé *dans* la fenêtre serait un écart fabriqué par la seed.
        assert any(p["kind"] == "purchase" for p in consumption["points"])

    def test_the_control_only_reports_the_gaps_that_were_left_on_purpose(self):
        """La démo n'est pas en règle, mais elle n'est en tort que là où on l'a voulu.

        Tout écart supplémentaire est un défaut de la seed elle-même : le
        visiteur ne peut pas distinguer « laissé exprès » de « cassé ».
        """
        from banking import compliance

        household = Household.objects.get(name="Famille Mercier")
        detected = {g.spec.kind: g.detected for g in compliance.summary(household) if g.detected}
        assert set(detected) <= {"transaction_unallocated", "internal_without_counterpart"}

    def test_a_given_password_replaces_the_published_one_even_on_existing_accounts(self):
        """Le mot de passe par défaut est publié — dans le dépôt, qui est public.

        Sans cette option, semer la démonstration sur une instance joignable
        depuis Internet y ouvre trois comptes dont tout le monde a la clé. Et
        l'appliquer **aussi** aux comptes existants est ce qui rend la correction
        possible : une commande qui ne fait rien en silence laisse croire que la
        porte est refermée.
        """
        claire = User.objects.get(email="claire.mercier@demo.local")
        assert claire.check_password("demo1234")

        call_command("seed_demo_data", password="jamais-dans-le-depot")

        claire.refresh_from_db()
        assert claire.check_password("jamais-dans-le-depot")
        assert not claire.check_password("demo1234")

    def test_running_it_twice_creates_nothing_new(self):
        """L'idempotence n'est pas une politesse : le conteneur ``init`` la
        rejoue à chaque démarrage.

        Le compte porte sur **toutes** les tables que la seed écrit, et pas sur
        deux d'entre elles : les zones se reposaient à chaque relance — neuf
        doublons, dont une « Cuisine » bis à laquelle plus rien n'était
        rattaché — et deux compteurs bancaires stables ne le voyaient pas.
        """
        from banking.models import BankTransaction
        from budget.models import RecurringExpense
        from chickens.models import Chicken, ChickenChore, ChickenEvent, EggLog
        from directory.models import Contact, Phone, Structure
        from equipment.models import Equipment
        from insurance.models import InsuranceContract
        from interactions.models import Interaction
        from shopping.models import ShoppingListItem
        from stock.models import StockCategory, StockItem, StockLevelReading
        from tags.models import Tag, TagLink
        from tasks.models import Task
        from trackers.models import Tracker, TrackerEntry
        from water.models import WaterReading
        from zones.models import Zone

        models = (
            Zone, Task, Equipment, StockCategory, StockItem, StockLevelReading,
            ShoppingListItem, Chicken, EggLog, ChickenChore, ChickenEvent,
            WaterReading, InsuranceContract, Tracker, TrackerEntry,
            Structure, Contact, Phone, Tag, TagLink,
            BankTransaction, Interaction, RecurringExpense,
        )
        before = {m.__name__: m.objects.count() for m in models}

        call_command("seed_demo_data")

        assert {m.__name__: m.objects.count() for m in models} == before
