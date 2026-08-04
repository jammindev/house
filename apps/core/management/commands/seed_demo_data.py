"""
Management command to seed demo data for testing.

Usage:
    python manage.py seed_demo_data           # crée les données (idempotent)
    python manage.py seed_demo_data --flush   # supprime puis recrée tout
    python manage.py seed_demo_data --password '…'   # obligatoire sur une
                                              # instance joignable depuis
                                              # Internet : le mot de passe par
                                              # défaut est publié (voir
                                              # DEFAULT_PASSWORD)

Idempotence :
    La commande utilise get_or_create partout — la relancer sans --flush
    ne crée pas de doublons. En revanche, modifier un champ existant (ex.
    changer un status ou un assigned_to) ne mettra PAS à jour la ligne
    déjà en base : seuls les champs dans `defaults` sont ignorés si l'objet
    existe déjà. Pour forcer une mise à jour, utiliser --flush.

    Exception : l'unicité des tâches repose sur (household, subject).
    Si tu renommes un subject, une nouvelle tâche sera créée (l'ancienne
    reste en base). Préférer --flush dans ce cas.

Comment modifier cette seed :
    - Ajouter une tâche     → appeler task(...) dans _create_tasks()
    - Ajouter une zone      → appeler zone(...) dans _create_zones(), puis
                              ajouter la clé au dict retourné
    - Ajouter un projet     → appeler Project.objects.get_or_create(...)
                              dans _create_projects()
    - Changer un utilisateur → modifier _create_users() et _get_or_create_user()
                              (champs : email, first_name, last_name, display_name, locale)

Paramètres de task() :
    subject       : str   — titre de la tâche (clé d'unicité, obligatoire)
    status        : Task.Status.{BACKLOG,PENDING,IN_PROGRESS,DONE,ARCHIVED}
    priority      : Task.Priority.{HIGH=1, NORMAL=2, LOW=3}
    created_by    : User  — obligatoire (champ HouseholdScopedModel)
    updated_by    : User  — optionnel, prend created_by par défaut
    assigned_to   : User  — optionnel (None si non assignée)
    project       : Project — optionnel
    zone_keys     : list[str] — clés du dict zones retourné par _create_zones()
    due_date      : date  — optionnel
    content       : str   — description longue, optionnelle
    completed_by  : User  — obligatoire si status=DONE (contrainte DB)
    completed_at  : datetime — obligatoire si completed_by est renseigné

Creates:
- 1 household: Famille Mercier
- 3 users: Claire (owner), Antoine (member), Léa (member)
- 3 HouseholdMembers
- 9 zones (salon, cuisine, sdb, chambres, bureau, garage, jardin, cave)
- 2 projects: rénovation salle de bain, aménagement jardin
- 23 tasks avec statuts, priorités, assignations et zones variés
- 1 installation électrique complète (tableau, circuits, points d'usage)
- 1 compte bancaire + un relevé de deux mois importé par le vrai chemin
  d'import, 10 enveloppes de budget, des ventilations, un remboursement,
  4 récurrences dont deux confirmées par le relevé lui-même,
  et deux opérations laissées « à ranger » exprès
- 7 équipements (garanties en cours, révisions dues, une machine à l'atelier)
- 5 catégories de stock et 9 articles, avec courbes de consommation et un achat
- 1 liste de courses, alimentée en partie depuis le stock bas
- 1 poulailler : 5 poules, 45 jours de ponte, 3 soins récurrents, un journal
- 18 relevés du compteur d'eau, 4 contrats d'assurance, 3 suivis chiffrés
- 5 structures de l'annuaire et leurs contacts
- 12 entrées de journal (notes, entretiens, carnet de rénovation) et leurs tags

Ce que la seed ne crée pas, et pourquoi : les documents et les photos
demandent des **fichiers**, donc des binaires générés à l'exécution ou commités
dans un dépôt qui tient en 9,7 Mio ; la météo vient d'une API tierce ; les
récaps, bilans et alertes sont **dérivés** — les semer les figerait à une valeur
que plus rien ne recalcule, ce qui est exactement le défaut que la règle « un
compteur ne peut pas avoir deux définitions » interdit.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from chickens.models import Chicken, ChickenChore, ChickenEvent, ChickenSettings, EggLog
from core.timezones import household_today
from directory.models import Address, Contact, Email, Phone, Structure
from electricity.models import (
    CircuitUsagePointLink,
    ElectricCircuit,
    ElectricityBoard,
    ProtectiveDevice,
    UsagePoint,
)
from equipment.models import Equipment, EquipmentInteraction
from households.models import Household, HouseholdMember
from insurance.models import InsuranceContract
from banking.models import (
    BankAccount,
    BankTransaction,
    ComplianceWaiver,
    RefundAllocation,
    StatementImport,
)
from budget.models import Budget, BudgetCategory, RecurringExpense
from interactions.models import Interaction, InteractionZone
from projects.models import Project
from shopping.models import ShoppingListItem, ShoppingSuggestionDismissal
from stock.models import StockCategory, StockItem
from tags.models import Tag, TagLink
from tasks.models import Task, TaskZone
from trackers.models import Tracker, TrackerEntry
from water.models import WaterReading
from zones.models import Zone

User = get_user_model()


class Command(BaseCommand):
    help = "Seed demo data focused on tasks (household, users, zones, projects, tasks)"

    #: Mot de passe des trois comptes de démonstration. Il est **publié** — dans
    #: ce fichier, dans ``AGENTS.md`` et dans le skill ``/dev``, tous suivis par un
    #: dépôt public. C'est sans conséquence sur la machine de celui qui évalue le
    #: produit (``docker compose --profile demo``), et c'est une porte ouverte sur
    #: toute instance joignable depuis Internet. D'où ``--password``.
    DEFAULT_PASSWORD = "demo1234"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete previously created demo data before seeding",
        )
        parser.add_argument(
            "--password",
            default=None,
            help=(
                "Password of the three demo accounts. Defaults to the published "
                "one — pass a strong value on any instance reachable from the "
                "internet. Given explicitly, it is also applied to accounts that "
                "already exist."
            ),
        )

    def handle(self, *args, **options):
        if options["flush"]:
            self._flush()

        with transaction.atomic():
            household = self._create_household()
            claire, antoine, lea = self._create_users(household, options["password"])
            zones = self._create_zones(household, claire)
            projects = self._create_projects(household, claire, antoine, zones)
            self._create_tasks(household, claire, antoine, lea, zones, projects)
            self._create_electricity(household, claire, zones)
            self._create_money(household, claire, projects)
            equipment = self._create_equipment(household, antoine, zones)
            stock = self._create_stock(household, claire, zones)
            self._create_shopping(household, lea, stock)
            self._create_chickens(household, lea, zones, stock)
            self._create_water(household, claire)
            self._create_insurance(household, claire)
            self._create_trackers(household, antoine)
            self._create_directory(household, claire)
            self._create_journal(household, claire, antoine, zones, equipment, projects)

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))

    # ------------------------------------------------------------------
    # Flush
    # ------------------------------------------------------------------

    def _flush(self):
        email_list = ["claire.mercier@demo.local", "antoine.mercier@demo.local", "lea.martin@demo.local"]
        users = User.objects.filter(email__in=email_list)
        household_ids = list(Household.objects.filter(name="Famille Mercier").values_list("id", flat=True))
        if household_ids:
            CircuitUsagePointLink.objects.filter(circuit__board__household_id__in=household_ids).delete()
            UsagePoint.objects.filter(household_id__in=household_ids).delete()
            ElectricCircuit.objects.filter(board__household_id__in=household_ids).delete()
            ProtectiveDevice.objects.filter(board__household_id__in=household_ids).delete()
            ElectricityBoard.objects.filter(household_id__in=household_ids).delete()
            # Les modules ajoutés au foyer de démonstration. L'ordre suit les FK
            # protectrices, comme le bloc bancaire juste en dessous : ce qui pointe
            # vers un stock (liste de courses, réglages du poulailler) part avant
            # l'article, et l'article avant sa catégorie (PROTECT).
            ShoppingSuggestionDismissal.objects.filter(household_id__in=household_ids).delete()
            ShoppingListItem.objects.filter(household_id__in=household_ids).delete()
            ChickenSettings.objects.filter(household_id__in=household_ids).delete()
            ChickenEvent.objects.filter(household_id__in=household_ids).delete()
            ChickenChore.objects.filter(household_id__in=household_ids).delete()
            EggLog.objects.filter(household_id__in=household_ids).delete()
            Chicken.objects.filter(household_id__in=household_ids).delete()
            TrackerEntry.objects.filter(household_id__in=household_ids).delete()
            Tracker.objects.filter(household_id__in=household_ids).delete()
            WaterReading.objects.filter(household_id__in=household_ids).delete()
            InsuranceContract.objects.filter(household_id__in=household_ids).delete()
            Phone.objects.filter(household_id__in=household_ids).delete()
            Email.objects.filter(household_id__in=household_ids).delete()
            Address.objects.filter(household_id__in=household_ids).delete()
            Contact.objects.filter(household_id__in=household_ids).delete()
            Structure.objects.filter(household_id__in=household_ids).delete()
            TagLink.objects.filter(household_id__in=household_ids).delete()
            Tag.objects.filter(household_id__in=household_ids).delete()
            # EquipmentInteraction cascade des deux côtés — l'équipement suffit.
            Equipment.objects.filter(household_id__in=household_ids).delete()
            RecurringExpense.objects.filter(household_id__in=household_ids).delete()
            Interaction.objects.filter(household_id__in=household_ids).delete()
            # Refund allocations point at both a transaction and a budget: they go
            # before either, or the FK protecting them refuses the delete.
            RefundAllocation.objects.filter(household_id__in=household_ids).delete()
            # Banking must go before the household: ``BankTransaction.account`` is
            # PROTECT (an account holding history is archived, never deleted), so a
            # household carrying a single statement line — or a cash expense typed
            # from the UI — could not be deleted at all. A flush command that cannot
            # flush is worse than no flush command.
            BankTransaction.objects.filter(household_id__in=household_ids).delete()
            ComplianceWaiver.objects.filter(household_id__in=household_ids).delete()
            StatementImport.objects.filter(household_id__in=household_ids).delete()
            BankAccount.objects.filter(household_id__in=household_ids).delete()
            Budget.objects.filter(household_id__in=household_ids).delete()
            BudgetCategory.objects.filter(household_id__in=household_ids).delete()
            StockItem.objects.filter(household_id__in=household_ids).delete()
            StockCategory.objects.filter(household_id__in=household_ids).delete()
            Zone.objects.filter(household_id__in=household_ids).delete()
            Household.objects.filter(id__in=household_ids).delete()
        users.delete()
        self.stdout.write("Previous demo data deleted.")

    # ------------------------------------------------------------------
    # Household
    # ------------------------------------------------------------------

    def _create_household(self):
        household, created = Household.objects.get_or_create(
            name="Famille Mercier",
            defaults={
                "address": "14 rue des Lilas",
                "city": "Lyon",
                "postal_code": "69003",
                "country": "FR",
                "timezone": "Europe/Paris",
                "context_notes": "Maison individuelle avec jardin, construite en 1978, rénovée partiellement en 2015.",
            },
        )
        if created:
            self.stdout.write(f"  Household created: {household.name}")
        else:
            self.stdout.write(f"  Household already exists: {household.name}")
        return household

    # ------------------------------------------------------------------
    # Users & Members
    # ------------------------------------------------------------------

    def _create_users(self, household, password=None):
        claire = self._get_or_create_user(
            email="claire.mercier@demo.local",
            first_name="Claire",
            last_name="Mercier",
            display_name="Claire",
            locale="fr",
            household=household,
            password=password,
        )
        antoine = self._get_or_create_user(
            email="antoine.mercier@demo.local",
            first_name="Antoine",
            last_name="Mercier",
            display_name="Antoine",
            locale="fr",
            household=household,
            password=password,
        )
        lea = self._get_or_create_user(
            email="lea.martin@demo.local",
            first_name="Léa",
            last_name="Martin",
            display_name="Léa",
            locale="fr",
            household=household,
            password=password,
        )

        HouseholdMember.objects.get_or_create(
            household=household, user=claire, defaults={"role": HouseholdMember.Role.OWNER}
        )
        HouseholdMember.objects.get_or_create(
            household=household, user=antoine, defaults={"role": HouseholdMember.Role.MEMBER}
        )
        HouseholdMember.objects.get_or_create(
            household=household, user=lea, defaults={"role": HouseholdMember.Role.MEMBER}
        )
        self.stdout.write(f"  Members: {claire.first_name}, {antoine.first_name}, {lea.first_name}")
        return claire, antoine, lea

    def _get_or_create_user(
        self, email, first_name, last_name, display_name, locale, household, password=None
    ):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "display_name": display_name,
                "locale": locale,
                "active_household": household,
                "is_active": True,
            },
        )
        # Un ``--password`` explicite s'applique **aussi** à un compte déjà là :
        # sinon relancer la commande pour corriger un mot de passe ne ferait rien,
        # sans un mot — et on croirait la porte refermée alors qu'elle est ouverte.
        if created or password is not None:
            user.set_password(password or self.DEFAULT_PASSWORD)
            user.save()
        return user

    # ------------------------------------------------------------------
    # Zones (hiérarchiques)
    # ------------------------------------------------------------------

    def _create_zones(self, household, created_by):
        def zone(name, parent=None, color="#f4f4f5", note=""):
            # La recherche ignore le parent **volontairement** : ``Zone.save()``
            # rattache une zone sans parent à la racine du foyer, donc un
            # ``get_or_create(parent=None)`` ne retrouve jamais ce qu'il vient de
            # créer et repose les neuf zones à chaque relance. Le foyer de
            # démonstration se retrouvait avec deux « Cuisine », deux « Garage »…
            # et les tâches accrochées à la première copie.
            existing = Zone.objects.filter(household=household, name=name).first()
            if existing is not None:
                return existing
            return Zone.objects.create(
                household=household,
                name=name,
                parent=parent,
                color=color,
                note=note,
                created_by=created_by,
                updated_by=created_by,
            )

        # Niveau 1 — zones principales
        salon = zone("Salon", color="#fef9c3", note="Pièce de vie principale, parquet chêne")
        cuisine = zone("Cuisine", color="#dcfce7", note="Cuisine équipée ouverte sur salle à manger")
        sdb = zone("Salle de bain", color="#dbeafe", note="Salle de bain du RDC, douche + baignoire")
        chambre_parents = zone("Chambre parentale", color="#f3e8ff", note="Suite parentale 18 m²")
        chambre_ado = zone("Chambre ado", color="#ffe4e6", note="Chambre de 12 m², côté nord")
        bureau = zone("Bureau", color="#e0f2fe", note="Pièce de travail, double vitrage récent")
        garage = zone("Garage", color="#f1f5f9", note="Garage double, portail automatique")
        jardin = zone("Jardin", color="#bbf7d0", note="350 m², exposé sud, terrasse en bois")
        cave = zone("Cave", color="#e5e7eb", note="Cave de stockage 25 m²")

        self.stdout.write(f"  Zones: {Zone.objects.filter(household=household).count()} créées")

        return {
            "salon": salon,
            "cuisine": cuisine,
            "sdb": sdb,
            "chambre_parents": chambre_parents,
            "chambre_ado": chambre_ado,
            "bureau": bureau,
            "garage": garage,
            "jardin": jardin,
            "cave": cave,
        }

    # ------------------------------------------------------------------
    # Projects
    # ------------------------------------------------------------------

    def _create_projects(self, household, claire, antoine, zones):
        today = date.today()

        proj_sdb, _ = Project.objects.get_or_create(
            household=household,
            title="Rénovation salle de bain",
            defaults={
                "description": (
                    "Remplacement complet de la salle de bain du RDC : "
                    "douche à l'italienne, nouveau carrelage, meuble vasque suspendu, "
                    "sèche-serviette électrique."
                ),
                "status": Project.Status.ACTIVE,
                "type": Project.Type.RENOVATION,
                "priority": 2,
                "start_date": today - timedelta(days=30),
                "due_date": today + timedelta(days=60),
                "planned_budget": 8500,
                "tags": ["rénovation", "salle de bain", "plomberie"],
                "created_by": claire,
                "updated_by": claire,
            },
        )

        proj_jardin, _ = Project.objects.get_or_create(
            household=household,
            title="Aménagement jardin printemps",
            defaults={
                "description": (
                    "Plantation de haies, installation d'un système d'arrosage automatique, "
                    "réfection de la terrasse en bois et achat d'un salon de jardin."
                ),
                "status": Project.Status.ACTIVE,
                "type": Project.Type.OTHER,
                "priority": 3,
                "start_date": today,
                "due_date": today + timedelta(days=90),
                "planned_budget": 3200,
                "tags": ["jardin", "extérieur", "printemps"],
                "created_by": antoine,
                "updated_by": antoine,
            },
        )

        self.stdout.write(f"  Projects: {proj_sdb.title}, {proj_jardin.title}")
        return {"sdb": proj_sdb, "jardin": proj_jardin}

    # ------------------------------------------------------------------
    # Tasks
    # ------------------------------------------------------------------

    def _create_tasks(self, household, claire, antoine, lea, zones, projects):
        today = date.today()
        now = timezone.now()

        def task(subject, status, priority, created_by, updated_by=None, assigned_to=None,
                 project=None, zone_keys=None, due_date=None, content="",
                 completed_by=None, completed_at=None):
            obj, created = Task.objects.get_or_create(
                household=household,
                subject=subject,
                defaults={
                    "content": content,
                    "status": status,
                    "priority": priority,
                    "due_date": due_date,
                    "is_private": False,
                    "assigned_to": assigned_to,
                    "completed_by": completed_by,
                    "completed_at": completed_at,
                    "project": project,
                    "created_by": created_by,
                    "updated_by": updated_by or created_by,
                },
            )
            if created and zone_keys:
                for key in zone_keys:
                    TaskZone.objects.get_or_create(task=obj, zone=zones[key])
            return obj

        # --- Projet Rénovation SDB ---
        task(
            subject="Demander 3 devis à des plombiers",
            status=Task.Status.DONE,
            priority=Task.Priority.HIGH,
            created_by=claire,
            updated_by=claire,
            assigned_to=claire,
            project=projects["sdb"],
            zone_keys=["sdb"],
            due_date=today - timedelta(days=20),
            content="Contacter au moins 3 artisans via Houzz ou le bouche-à-oreille. Comparer délais et garanties.",
            completed_by=claire,
            completed_at=now - timedelta(days=22),
        )
        task(
            subject="Choisir le carrelage (sol + murs)",
            status=Task.Status.DONE,
            priority=Task.Priority.HIGH,
            created_by=claire,
            updated_by=antoine,
            assigned_to=claire,
            project=projects["sdb"],
            zone_keys=["sdb"],
            due_date=today - timedelta(days=15),
            content="Référence retenue : Imitation béton ciré 60x60 gris clair (Leroy Merlin réf. 4821). Prévoir 10% de chutes.",
            completed_by=claire,
            completed_at=now - timedelta(days=16),
        )
        task(
            subject="Commander la douche à l'italienne",
            status=Task.Status.IN_PROGRESS,
            priority=Task.Priority.HIGH,
            created_by=claire,
            updated_by=claire,
            assigned_to=antoine,
            project=projects["sdb"],
            zone_keys=["sdb"],
            due_date=today + timedelta(days=5),
            content="Modèle : receveur extra-plat 120x80 + paroi fixe 8 mm. Vérifier compatibilité évacuation existante.",
        )
        task(
            subject="Vider complètement la salle de bain avant les travaux",
            status=Task.Status.PENDING,
            priority=Task.Priority.NORMAL,
            created_by=claire,
            assigned_to=antoine,
            project=projects["sdb"],
            zone_keys=["sdb", "cave"],
            due_date=today + timedelta(days=10),
            content="Déposer miroir, meubles, petits appareils. Stocker en cave.",
        )
        task(
            subject="Réserver un plombier pour la dépose",
            status=Task.Status.PENDING,
            priority=Task.Priority.HIGH,
            created_by=claire,
            assigned_to=claire,
            project=projects["sdb"],
            zone_keys=["sdb"],
            due_date=today + timedelta(days=8),
        )
        task(
            subject="Acheter le meuble vasque suspendu",
            status=Task.Status.BACKLOG,
            priority=Task.Priority.NORMAL,
            created_by=claire,
            project=projects["sdb"],
            zone_keys=["sdb"],
            content="Budget max 650 €. Préférence blanc mat avec tiroir intégré. Vérifier hauteur standard (85 cm).",
        )
        task(
            subject="Prévoir protection des sols pendant les travaux",
            status=Task.Status.BACKLOG,
            priority=Task.Priority.LOW,
            created_by=antoine,
            project=projects["sdb"],
            zone_keys=["sdb"],
        )
        task(
            subject="Valider devis final plombier-carreleur",
            status=Task.Status.IN_PROGRESS,
            priority=Task.Priority.HIGH,
            created_by=claire,
            updated_by=claire,
            assigned_to=claire,
            project=projects["sdb"],
            due_date=today + timedelta(days=3),
            content="Devis reçu de Plomberie Renaud (4 800 €) et Atelier Sol & Mur (5 100 €). En attente du 3e.",
        )

        # --- Projet Jardin ---
        task(
            subject="Mesurer la superficie des zones à planter",
            status=Task.Status.DONE,
            priority=Task.Priority.NORMAL,
            created_by=antoine,
            updated_by=antoine,
            assigned_to=antoine,
            project=projects["jardin"],
            zone_keys=["jardin"],
            due_date=today - timedelta(days=5),
            completed_by=antoine,
            completed_at=now - timedelta(days=4),
        )
        task(
            subject="Choisir les essences de haies (laurier, photinia…)",
            status=Task.Status.IN_PROGRESS,
            priority=Task.Priority.NORMAL,
            created_by=antoine,
            assigned_to=lea,
            project=projects["jardin"],
            zone_keys=["jardin"],
            due_date=today + timedelta(days=7),
            content="Privilégier des espèces persistantes et résistantes à la sécheresse. Budget plants : 400 €.",
        )
        task(
            subject="Commander le système d'arrosage automatique",
            status=Task.Status.BACKLOG,
            priority=Task.Priority.NORMAL,
            created_by=antoine,
            project=projects["jardin"],
            zone_keys=["jardin"],
            content="Système goutte-à-goutte + asperseurs pour pelouse. Marque Hunter ou Rain Bird. Budget 600 €.",
        )
        task(
            subject="Poncer et huiler la terrasse en bois",
            status=Task.Status.PENDING,
            priority=Task.Priority.NORMAL,
            created_by=antoine,
            assigned_to=antoine,
            project=projects["jardin"],
            zone_keys=["jardin"],
            due_date=today + timedelta(days=21),
            content="Bois exotique IPE. Utiliser huile de teck. Prévoir 2 couches espacées de 24h.",
        )
        task(
            subject="Acheter salon de jardin",
            status=Task.Status.BACKLOG,
            priority=Task.Priority.LOW,
            created_by=lea,
            project=projects["jardin"],
            zone_keys=["jardin"],
            content="Table + 6 chaises résine tressée ou aluminium. Budget max 900 €.",
        )

        # --- Tâches générales (sans projet) ---
        task(
            subject="Remplacer l'ampoule du couloir entrée",
            status=Task.Status.DONE,
            priority=Task.Priority.LOW,
            created_by=lea,
            updated_by=lea,
            assigned_to=lea,
            due_date=today - timedelta(days=3),
            completed_by=lea,
            completed_at=now - timedelta(days=2),
        )
        task(
            subject="Nettoyer les gouttières avant les pluies de printemps",
            status=Task.Status.PENDING,
            priority=Task.Priority.NORMAL,
            created_by=claire,
            assigned_to=antoine,
            zone_keys=["garage"],
            due_date=today + timedelta(days=14),
        )
        task(
            subject="Appeler le ramoneur pour le poêle à bois",
            status=Task.Status.PENDING,
            priority=Task.Priority.HIGH,
            created_by=claire,
            assigned_to=claire,
            zone_keys=["salon"],
            due_date=today + timedelta(days=7),
            content="Obligation annuelle. Garder le certificat pour l'assurance.",
        )
        task(
            subject="Vérifier contrat assurance habitation (renouvellement)",
            status=Task.Status.IN_PROGRESS,
            priority=Task.Priority.HIGH,
            created_by=claire,
            assigned_to=claire,
            due_date=today + timedelta(days=12),
            content="Échéance le 1er avril. Comparer avec devis MAIF et AXA. Attention clause vétusté.",
        )
        task(
            subject="Dégivrer le congélateur du garage",
            status=Task.Status.BACKLOG,
            priority=Task.Priority.LOW,
            created_by=antoine,
            zone_keys=["garage"],
        )
        task(
            subject="Réparer la serrure de la porte de cave",
            status=Task.Status.PENDING,
            priority=Task.Priority.NORMAL,
            created_by=antoine,
            assigned_to=antoine,
            zone_keys=["cave"],
            due_date=today + timedelta(days=30),
        )
        task(
            subject="Trier et désencombrer la cave",
            status=Task.Status.BACKLOG,
            priority=Task.Priority.LOW,
            created_by=claire,
            zone_keys=["cave"],
            content="Regrouper cartons, outils, déco de Noël. Donner ce qui ne sert plus.",
        )
        task(
            subject="Changer les piles du détecteur de fumée",
            status=Task.Status.DONE,
            priority=Task.Priority.HIGH,
            created_by=lea,
            updated_by=lea,
            assigned_to=lea,
            zone_keys=["chambre_parents"],
            due_date=today - timedelta(days=10),
            completed_by=lea,
            completed_at=now - timedelta(days=9),
        )
        task(
            subject="Installer une tringle à rideau dans le bureau",
            status=Task.Status.BACKLOG,
            priority=Task.Priority.LOW,
            created_by=lea,
            zone_keys=["bureau"],
        )
        task(
            subject="Planifier révision chaudière (contrat annuel)",
            status=Task.Status.PENDING,
            priority=Task.Priority.HIGH,
            created_by=claire,
            assigned_to=claire,
            due_date=today + timedelta(days=45),
            content="Prestataire : Dalkia. Prendre RDV en ligne ou appeler le 04 72 XX XX XX.",
        )

        count = Task.objects.filter(household=household).count()
        self.stdout.write(f"  Tasks: {count} créées")

    # ------------------------------------------------------------------
    # Electricity
    # ------------------------------------------------------------------

    def _create_electricity(self, household, user, zones):
        """
        Installation électrique fictive d'une maison individuelle 1978,
        rénovée partiellement en 2015 — monophasé 230V, NF C 15-100 partiel.

        Tableau principal → 3 rangées × 13 modules
          Rangée 1 : DG + DD1 (type A 30mA 4P) + circuits cuisine
          Rangée 2 : DD2 (type AC 30mA 2P) + circuits séjour/chambres/bureau
          Rangée 3 : DD3 (type A 30mA 2P) + circuits SDB/CE/garage/extérieur + réserves
        """
        kw = {"created_by": user, "updated_by": user}

        # ── Tableau principal ──────────────────────────────────────────────
        board, _ = ElectricityBoard.objects.get_or_create(
            household=household,
            name="Tableau principal",
            defaults={
                "label": "TB-PRINC",
                "zone": zones["cave"],
                "supply_type": "single_phase",
                "rows": 3,
                "slots_per_row": 13,
                "location": "Cave, coffret encastré mur nord",
                "nf_c_15100_compliant": "partial",
                "last_inspection_date": date(2022, 9, 14),
                "main_notes": (
                    "Tableau Hager — 3 rangées 13 modules. "
                    "Mise en conformité partielle lors de la rénovation SDB en 2015. "
                    "DD3 ajouté à cette occasion."
                ),
                "is_active": True,
                **kw,
            },
        )

        # ── Helper local ───────────────────────────────────────────────────
        def device(label, device_type, row, position, position_end=None,
                   role=None, rating_amps=None, pole_count=None,
                   curve_type="", sensitivity_ma=None, type_code="",
                   is_spare=False, notes=""):
            obj, _ = ProtectiveDevice.objects.get_or_create(
                household=household,
                board=board,
                label=label,
                defaults={
                    "device_type": device_type,
                    "role": role,
                    "row": row,
                    "position": position,
                    "position_end": position_end,
                    "rating_amps": rating_amps,
                    "pole_count": pole_count,
                    "curve_type": curve_type,
                    "sensitivity_ma": sensitivity_ma,
                    "type_code": type_code,
                    "is_spare": is_spare,
                    "is_active": True,
                    "notes": notes,
                    **kw,
                },
            )
            return obj

        def circuit(label, name, protective_device, notes=""):
            obj, _ = ElectricCircuit.objects.get_or_create(
                household=household,
                label=label,
                defaults={
                    "board": board,
                    "protective_device": protective_device,
                    "name": name,
                    "is_active": True,
                    "notes": notes,
                    **kw,
                },
            )
            return obj

        def up(label, name, kind, zone_key, notes=""):
            obj, _ = UsagePoint.objects.get_or_create(
                household=household,
                label=label,
                defaults={
                    "name": name,
                    "kind": kind,
                    "zone": zones[zone_key],
                    "notes": notes,
                    **kw,
                },
            )
            return obj

        def link(cir, usage_point):
            CircuitUsagePointLink.objects.get_or_create(
                household=household,
                circuit=cir,
                usage_point=usage_point,
                defaults={"is_active": True, **kw},
            )

        # ── Rangée 1 — Général + Cuisine ──────────────────────────────────
        dg    = device("DG",   "main",     row=1, position=1,  position_end=2,
                       role="main", rating_amps=60, pole_count=2,
                       notes="Disjoncteur de branchement EDF 60A")
        dd1   = device("DD1",  "rcd",      row=1, position=3,  position_end=6,
                       rating_amps=40, pole_count=4, sensitivity_ma=30, type_code="a",
                       notes="Protège circuits cuisine (B01–B04)")
        b01   = device("B01",  "breaker",  row=1, position=7,
                       role="divisionary", rating_amps=20, pole_count=1, curve_type="c",
                       notes="Prises cuisine (4 prises plan de travail)")
        b02   = device("B02",  "breaker",  row=1, position=8,
                       role="divisionary", rating_amps=20, pole_count=1, curve_type="c",
                       notes="Lave-vaisselle")
        b03   = device("B03",  "breaker",  row=1, position=9,  position_end=10,
                       role="divisionary", rating_amps=32, pole_count=2, curve_type="c",
                       notes="Four / cuisinière (circuit dédié 32A)"),
        b04   = device("B04",  "breaker",  row=1, position=11,
                       role="divisionary", rating_amps=10, pole_count=1, curve_type="b",
                       notes="Éclairage cuisine")

        # Rangée 1 : positions 12–13 libres (pas de device)

        # ── Rangée 2 — Séjour / Chambres / Bureau ─────────────────────────
        dd2   = device("DD2",  "rcd",      row=2, position=1,  position_end=2,
                       rating_amps=40, pole_count=2, sensitivity_ma=30, type_code="ac",
                       notes="Protège circuits séjour/chambres/bureau (B05–B09)")
        b05   = device("B05",  "breaker",  row=2, position=3,
                       role="divisionary", rating_amps=16, pole_count=1, curve_type="c",
                       notes="Prises salon")
        b06   = device("B06",  "breaker",  row=2, position=4,
                       role="divisionary", rating_amps=10, pole_count=1, curve_type="b",
                       notes="Éclairage salon / entrée")
        b07   = device("B07",  "breaker",  row=2, position=5,
                       role="divisionary", rating_amps=16, pole_count=1, curve_type="c",
                       notes="Chambre parentale (prises + éclairage)")
        b08   = device("B08",  "breaker",  row=2, position=6,
                       role="divisionary", rating_amps=16, pole_count=1, curve_type="c",
                       notes="Chambre ado (prises + éclairage)")
        b09   = device("B09",  "breaker",  row=2, position=7,
                       role="divisionary", rating_amps=16, pole_count=1, curve_type="c",
                       notes="Bureau (prises + éclairage)")

        # Rangée 2 : positions 8–13 libres

        # ── Rangée 3 — SDB / Chauffe-eau / Garage / Extérieur ────────────
        dd3   = device("DD3",  "rcd",      row=3, position=1,  position_end=2,
                       rating_amps=40, pole_count=2, sensitivity_ma=30, type_code="a",
                       notes="Ajouté lors rénovation SDB 2015. Protège B10–B14.")
        b10   = device("B10",  "breaker",  row=3, position=3,
                       role="divisionary", rating_amps=10, pole_count=1, curve_type="b",
                       notes="Éclairage salle de bain")
        b11   = device("B11",  "breaker",  row=3, position=4,
                       role="divisionary", rating_amps=16, pole_count=1, curve_type="c",
                       notes="Prises salle de bain (rasoir, sèche-cheveux)")
        b12   = device("B12",  "breaker",  row=3, position=5,  position_end=6,
                       role="divisionary", rating_amps=20, pole_count=2, curve_type="c",
                       notes="Chauffe-eau électrique 200L (circuit dédié)")
        b13   = device("B13",  "breaker",  row=3, position=7,
                       role="divisionary", rating_amps=20, pole_count=1, curve_type="c",
                       notes="Garage (prises + éclairage + portail)")
        b14   = device("B14",  "breaker",  row=3, position=8,
                       role="divisionary", rating_amps=16, pole_count=1, curve_type="c",
                       notes="Prises extérieures / jardin")
        b15   = device("B15",  "breaker",  row=3, position=9,
                       role="divisionary", rating_amps=16, pole_count=1, curve_type="c",
                       is_spare=True, notes="Emplacement réserve")
        b16   = device("B16",  "breaker",  row=3, position=10,
                       role="divisionary", rating_amps=16, pole_count=1, curve_type="c",
                       is_spare=True, notes="Emplacement réserve")

        # b03 est retourné comme tuple à cause de la virgule parasite — correction
        if isinstance(b03, tuple):
            b03 = b03[0]

        # ── Circuits ───────────────────────────────────────────────────────
        cir01 = circuit("CIR-01", "Prises cuisine",        b01)
        cir02 = circuit("CIR-02", "Lave-vaisselle",        b02, notes="Circuit dédié VM")
        cir03 = circuit("CIR-03", "Four / cuisinière",     b03, notes="Circuit dédié 32A")
        cir04 = circuit("CIR-04", "Éclairage cuisine",     b04)
        cir05 = circuit("CIR-05", "Prises salon",          b05)
        cir06 = circuit("CIR-06", "Éclairage salon",       b06)
        cir07 = circuit("CIR-07", "Chambre parentale",     b07)
        cir08 = circuit("CIR-08", "Chambre ado",           b08)
        cir09 = circuit("CIR-09", "Bureau",                b09)
        cir10 = circuit("CIR-10", "Éclairage salle de bain", b10)
        cir11 = circuit("CIR-11", "Prises salle de bain",  b11)
        cir12 = circuit("CIR-12", "Chauffe-eau",           b12, notes="Hors heures pleines")
        cir13 = circuit("CIR-13", "Garage",                b13)
        cir14 = circuit("CIR-14", "Extérieur / jardin",    b14)

        # ── Points d'usage ─────────────────────────────────────────────────
        # Cuisine
        up_pcu1  = up("PRI-CUI-01", "Prise cuisine plan de travail gauche", "socket", "cuisine")
        up_pcu2  = up("PRI-CUI-02", "Prise cuisine plan de travail droite", "socket", "cuisine")
        up_pcu3  = up("PRI-CUI-03", "Prise cuisine îlot",                   "socket", "cuisine")
        up_pcu4  = up("PRI-CUI-04", "Prise réfrigérateur",                  "socket", "cuisine")
        up_lv    = up("PRI-LV-01",  "Prise lave-vaisselle",                 "socket", "cuisine",
                      notes="Sous l'évier, circuit dédié DD1/B02")
        up_four  = up("PRI-FOR-01", "Prise four encastré",                  "socket", "cuisine",
                      notes="32A, circuit dédié DD1/B03")
        up_ecl_cui = up("LUM-CUI-01", "Plafonnier cuisine",                 "light",  "cuisine")

        # Salon
        up_psal1 = up("PRI-SAL-01", "Prise salon mur nord",                 "socket", "salon")
        up_psal2 = up("PRI-SAL-02", "Prise salon mur est",                  "socket", "salon")
        up_psal3 = up("PRI-SAL-03", "Prise salon mur sud (TV)",             "socket", "salon")
        up_psal4 = up("PRI-SAL-04", "Prise salon mur ouest",                "socket", "salon")
        up_lsal1 = up("LUM-SAL-01", "Plafonnier salon",                     "light",  "salon")
        up_lsal2 = up("LUM-SAL-02", "Applique salon",                       "light",  "salon")
        up_lsal3 = up("LUM-ENT-01", "Plafonnier entrée",                    "light",  "salon",
                      notes="Couloir entrée, même circuit que salon")

        # Chambre parentale
        up_ppar1 = up("PRI-PAR-01", "Prise chambre parentale chevet gauche", "socket", "chambre_parents")
        up_ppar2 = up("PRI-PAR-02", "Prise chambre parentale chevet droit",  "socket", "chambre_parents")
        up_ppar3 = up("PRI-PAR-03", "Prise chambre parentale bureau",        "socket", "chambre_parents")
        up_lpar1 = up("LUM-PAR-01", "Plafonnier chambre parentale",          "light",  "chambre_parents")
        up_lpar2 = up("LUM-PAR-02", "Applique chevet",                       "light",  "chambre_parents")

        # Chambre ado
        up_pado1 = up("PRI-ADO-01", "Prise chambre ado bureau",              "socket", "chambre_ado")
        up_pado2 = up("PRI-ADO-02", "Prise chambre ado chevet",              "socket", "chambre_ado")
        up_lado1 = up("LUM-ADO-01", "Plafonnier chambre ado",                "light",  "chambre_ado")

        # Bureau
        up_pbur1 = up("PRI-BUR-01", "Prise bureau informatique",             "socket", "bureau")
        up_pbur2 = up("PRI-BUR-02", "Prise bureau multi-prises",             "socket", "bureau")
        up_pbur3 = up("PRI-BUR-03", "Prise bureau imprimante",               "socket", "bureau")
        up_lbur1 = up("LUM-BUR-01", "Plafonnier bureau",                     "light",  "bureau")

        # Salle de bain
        up_lsdb1 = up("LUM-SDB-01", "Plafonnier salle de bain",              "light",  "sdb")
        up_psdb1 = up("PRI-SDB-01", "Prise salle de bain vasque",            "socket", "sdb",
                      notes="Prise rasoir/sèche-cheveux, circuit DD3/B11")
        up_psdb2 = up("PRI-SDB-02", "Prise sèche-serviette électrique",      "socket", "sdb")

        # Garage
        up_pgar1 = up("PRI-GAR-01", "Prise garage atelier",                  "socket", "garage")
        up_pgar2 = up("PRI-GAR-02", "Prise garage portail automatique",      "socket", "garage")
        up_lgar1 = up("LUM-GAR-01", "Plafonnier garage",                     "light",  "garage")

        # Extérieur / jardin
        up_pext1 = up("PRI-EXT-01", "Prise extérieure terrasse",             "socket", "jardin")
        up_pext2 = up("PRI-EXT-02", "Prise extérieure jardin",               "socket", "jardin",
                      notes="IP44, à proximité du robinet arrosage")

        # ── Liens circuit → points d'usage ────────────────────────────────
        for u in [up_pcu1, up_pcu2, up_pcu3, up_pcu4]:
            link(cir01, u)
        link(cir02, up_lv)
        link(cir03, up_four)
        link(cir04, up_ecl_cui)
        for u in [up_psal1, up_psal2, up_psal3, up_psal4]:
            link(cir05, u)
        for u in [up_lsal1, up_lsal2, up_lsal3]:
            link(cir06, u)
        for u in [up_ppar1, up_ppar2, up_ppar3, up_lpar1, up_lpar2]:
            link(cir07, u)
        for u in [up_pado1, up_pado2, up_lado1]:
            link(cir08, u)
        for u in [up_pbur1, up_pbur2, up_pbur3, up_lbur1]:
            link(cir09, u)
        link(cir10, up_lsdb1)
        for u in [up_psdb1, up_psdb2]:
            link(cir11, u)
        # cir12 (chauffe-eau) : pas de point d'usage (équipement fixe)
        for u in [up_pgar1, up_pgar2, up_lgar1]:
            link(cir13, u)
        for u in [up_pext1, up_pext2]:
            link(cir14, u)

        dev_count = ProtectiveDevice.objects.filter(board=board).count()
        cir_count = ElectricCircuit.objects.filter(board=board).count()
        up_count  = UsagePoint.objects.filter(household=household).count()
        self.stdout.write(
            f"  Electricity: {dev_count} appareils, {cir_count} circuits, {up_count} points d'usage"
        )

    # ------------------------------------------------------------------
    # Argent — comptes, relevé importé, budgets, ventilations
    # ------------------------------------------------------------------

    def _create_money(self, household, user, projects):
        """Le module Argent rempli comme il le serait après un vrai mois d'usage.

        **Le relevé passe par le vrai chemin d'import** (``import_statement_file``
        sur un CSV construit ici), jamais par des ``BankTransaction.objects.create``.
        Trois raisons, dans l'ordre d'importance :

        1. une seed qui écrit en base directement contourne exactement ce que la
           démonstration doit montrer — le rapprochement, la déduplication, la
           devinette de fournisseur, la chaîne des soldes ;
        2. l'idempotence est gratuite : la contrainte ``unique(account, dedup_hash)``
           fait que ré-importer le même relevé ne crée rien ;
        3. une seed qui emprunte un chemin à elle est une seed qui vieillit sans
           que rien ne le signale. Celle-ci casse le jour où l'import casse, ce qui
           est précisément le jour où on veut le savoir.

        Le foyer de démonstration n'est **pas** en règle, et c'est délibéré : deux
        opérations restent sans budget. Une démo entièrement verte ne montre pas
        l'écran qui fait le sel du module — le Contrôle — et laisse croire qu'un
        foyer réel finit un mois sans une seule ligne en suspens.
        """
        from django.core.files.uploadedfile import SimpleUploadedFile

        from banking.services import (
            create_account,
            credit_budget_from_refund,
            import_statement_file,
            set_allocations,
        )

        today = household_today(household)
        # Le relevé couvre le mois précédent et le mois courant : l'aperçu des
        # budgets a donc quelque chose à montrer quel que soit le jour du mois
        # où la démonstration est lancée.
        first_of_month = today.replace(day=1)
        period_start = (first_of_month - timedelta(days=1)).replace(day=1)

        def d(offset_days: int) -> date:
            return period_start + timedelta(days=offset_days)

        account = BankAccount.objects.filter(household=household, name="Compte courant").first()
        if account is None:
            account = create_account(
                household=household,
                user=user,
                name="Compte courant",
                bank_label="Crédit Mutuel",
                kind=BankAccount.Kind.BANK,
                iban_last4="4417",
                opening_balance="2480.00",
                # Le solde d'ouverture précède la première ligne du relevé : sans
                # ça la fenêtre de conformité est vide et le Contrôle se tait —
                # la coche verte qui ne veut rien dire (CLAUDE.md, parcours 26).
                opening_balance_date=(period_start - timedelta(days=1)).isoformat(),
            )

        # ── Les enveloppes ────────────────────────────────────────────────────
        maison = self._budget_category(household, "Maison", None)
        quotidien = self._budget_category(household, "Quotidien", None)

        budgets = {
            "courses": self._budget(household, "Courses", "450.00", quotidien),
            "maison": self._budget(household, "Maison", "200.00", maison),
            "bricolage": self._budget(household, "Bricolage", "150.00", maison),
            "energie": self._budget(household, "Énergie", "180.00", maison),
            "transport": self._budget(household, "Transport", "120.00", quotidien),
            "sante": self._budget(household, "Santé", "80.00", quotidien),
            # Sans plafond : « catégorie suivie, non plafonnée ». Elle existe pour
            # montrer l'état `uncapped`, qui n'est ni « ok » ni « dépassé ».
            "loisirs": self._budget(household, "Loisirs", None, quotidien),
            "assurances": self._budget(household, "Assurances", "95.00", None),
            "abonnements": self._budget(household, "Abonnements", "60.00", None),
        }
        self._global_budget(household, "1800.00")

        # ── Le relevé ─────────────────────────────────────────────────────────
        #
        # (jour depuis le début de la période, libellé, montant signé)
        lines = [
            (1, "VIR SEPA RECU SALAIRE MERCIER C", "2410.00"),
            (2, "PRLV CREDIT IMMOBILIER CM", "-892.40"),
            (3, "PRLV EDF ENERGIE", "-134.20"),
            (4, "CB CARREFOUR MARKET LYON", "-96.35"),
            (6, "PRLV ORANGE FIXE ET INTERNET", "-42.99"),
            (8, "CB LEROY MERLIN VENISSIEUX", "-150.00"),
            (10, "CB TOTALENERGIES STATION", "-68.10"),
            (12, "CB CARREFOUR MARKET LYON", "-112.80"),
            (14, "PRLV MAIF ASSURANCE HABITATION", "-58.30"),
            (16, "RETRAIT DAB CM PART DIEU", "-60.00"),
            (18, "CB LE BISTROT DE LYON", "-74.50"),
            (20, "VIR SEPA EMIS EPARGNE LIVRET A", "-300.00"),
            (22, "CB CARREFOUR MARKET LYON", "-88.15"),
            (24, "VIR SEPA RECU MUTUELLE REMB SOINS", "47.60"),
            (32, "VIR SEPA RECU SALAIRE MERCIER C", "2410.00"),
            (33, "PRLV CREDIT IMMOBILIER CM", "-892.40"),
            (34, "PRLV EDF ENERGIE", "-141.75"),
            (36, "CB CARREFOUR MARKET LYON", "-103.60"),
            (38, "PRLV ORANGE FIXE ET INTERNET", "-42.99"),
            (40, "CB CASTORAMA LYON EST", "-64.90"),
        ]
        # On ne sème que ce qui est déjà arrivé : un relevé qui contient des
        # opérations futures n'existe pas, et fausserait tous les compteurs du
        # mois en cours.
        lines = [line for line in lines if d(line[0]) <= today]

        # ── Les récurrences, AVANT l'import ───────────────────────────────────
        #
        # L'ordre n'est pas cosmétique : c'est l'import qui confirme les échéances
        # qu'il couvre (``banking.matching.match_recurrences``). Les créer après
        # laisserait quatre échéances « à confirmer » sur des prélèvements déjà au
        # relevé — l'écart que le foyer n'a aucun moyen de comprendre, et l'inverse
        # exact de ce que la démonstration doit montrer.
        self._create_recurring(household, budgets, lines, d, today)

        rows = ["Date;Libelle;Montant;Solde"]
        balance = Decimal("2480.00")
        for offset, label, amount in lines:
            balance += Decimal(amount)
            rows.append(f"{d(offset).strftime('%d/%m/%Y')};{label};{amount};{balance:.2f}")

        trace = import_statement_file(
            household,
            user,
            account=account,
            uploaded_file=SimpleUploadedFile(
                "releve-demo.csv", "\n".join(rows).encode("utf-8"), content_type="text/csv"
            ),
            provider="generic_csv",
            options={
                "date_column": "Date",
                "label_column": "Libelle",
                "amount_column": "Montant",
                "balance_column": "Solde",
                "date_format": "%d/%m/%Y",
                "decimal_separator": ".",
                "delimiter": ";",
            },
        )
        if trace.status != "completed":
            raise CommandError(f"Import du relevé de démonstration échoué : {trace.error}")

        # ── Les ventilations ──────────────────────────────────────────────────
        #
        # Chaque motif de libellé donne l'enveloppe. Deux libellés n'y sont pas
        # (« LE BISTROT », « RETRAIT DAB ») : ce sont les écarts assumés.
        by_pattern = {
            "CARREFOUR": ("courses", "Carrefour Market"),
            "EDF": ("energie", "EDF"),
            "ORANGE": ("abonnements", "Orange"),
            "TOTALENERGIES": ("transport", "TotalEnergies"),
            "MAIF": ("assurances", "MAIF"),
            "CREDIT IMMOBILIER": ("maison", "Crédit Mutuel"),
            "CASTORAMA": ("bricolage", "Castorama"),
        }

        renovation = projects.get("sdb") if isinstance(projects, dict) else None
        allocated = 0
        for transaction in BankTransaction.objects.filter(account=account, direction="out"):
            if transaction.is_internal or transaction.interactions.exists():
                continue

            label = transaction.label_raw.upper()

            # La ligne Leroy Merlin est ventilée en deux, sur deux axes : 90 €
            # sur le chantier salle de bain (donc dans son coût réel) et 60 € sur
            # l'enveloppe Maison. C'est l'exemple qui montre qu'un budget et un
            # projet ne sont pas la même question.
            if "LEROY MERLIN" in label:
                split = [
                    {
                        "subject": "Robinetterie et joints",
                        "amount": "90.00",
                        "budget_id": str(budgets["bricolage"].id),
                        "supplier": "Leroy Merlin",
                    },
                    {
                        "subject": "Ampoules et petit outillage",
                        "amount": "60.00",
                        "budget_id": str(budgets["maison"].id),
                        "supplier": "Leroy Merlin",
                    },
                ]
                if renovation is not None:
                    split[0]["source_type"] = "projects.project"
                    split[0]["source_id"] = str(renovation.id)
                set_allocations(
                    household=household, user=user, transaction=transaction, lines=split
                )
                allocated += 2
                continue

            match = next((v for k, v in by_pattern.items() if k in label), None)
            if match is None:
                continue
            budget_key, supplier = match
            set_allocations(
                household=household,
                user=user,
                transaction=transaction,
                lines=[
                    {
                        "subject": supplier,
                        "amount": f"{transaction.outflow:.2f}",
                        "budget_id": str(budgets[budget_key].id),
                        "supplier": supplier,
                    }
                ],
            )
            allocated += 1

        # ── Le remboursement ──────────────────────────────────────────────────
        #
        # Une recette qui recrédite une enveloppe, plutôt qu'une dépense négative :
        # 47,60 € rendus par la mutuelle veulent dire que Santé a consommé
        # d'autant moins, pas que le foyer a gagné de l'argent.
        refund = (
            BankTransaction.objects.filter(account=account, direction="in")
            .filter(label_raw__icontains="MUTUELLE")
            .first()
        )
        if refund is not None and not RefundAllocation.objects.filter(transaction=refund).exists():
            credit_budget_from_refund(
                household=household,
                user=user,
                transaction=refund,
                budget_id=str(budgets["sante"].id),
                amount=refund.inflow,
            )

        pending = (
            BankTransaction.objects.filter(account=account, direction="out", is_internal=False)
            .filter(interactions__isnull=True)
            .count()
        )
        self.stdout.write(
            f"  Argent : {len(lines)} opérations importées, {allocated} dépenses ventilées, "
            f"{pending} à ranger, {len(budgets)} enveloppes"
        )

    def _budget_category(self, household, name, monthly_amount):
        category, _ = BudgetCategory.objects.get_or_create(
            household=household,
            name=name,
            defaults={"monthly_amount": monthly_amount},
        )
        return category

    def _budget(self, household, name, monthly_amount, category):
        budget, _ = Budget.objects.get_or_create(
            household=household,
            name=name,
            defaults={"monthly_amount": monthly_amount, "category": category},
        )
        return budget

    def _global_budget(self, household, monthly_amount):
        budget = Budget.objects.filter(household=household, is_global=True).first()
        if budget is None:
            budget = Budget.objects.create(
                household=household,
                name="Budget global",
                monthly_amount=monthly_amount,
                is_global=True,
            )
        return budget

    def _create_recurring(self, household, budgets, lines, d, today):
        """Les échéances régulières du foyer — deux que le relevé confirmera seul.

        Les deux premières sont **calées sur une ligne du relevé** (même montant au
        centime, même jour) : c'est la condition d'auto-confirmation, et la seule
        façon de montrer que l'app ne redemande pas de saisir ce qu'elle voit déjà.
        Les deux autres n'ont aucune ligne en face et restent « à venir » — c'est
        la projection de trésorerie.
        """

        def anchor_on(needle, fallback_days):
            """Le jour de la dernière ligne portant ``needle``, sinon une date future.

            Le relevé est tronqué à aujourd'hui : un mois qui commence n'a pas
            encore vu passer son prélèvement Orange. Sans ce repli, la récurrence
            naîtrait avec une échéance déjà dépassée et rien pour la justifier —
            un écart fabriqué par la seed elle-même.
            """
            days = [offset for offset, label, _amount in lines if needle in label]
            return d(days[-1]) if days else today + timedelta(days=fallback_days)

        def recurring(label, amount, *, supplier, budget, next_due, cadence, notes=""):
            obj, _created = RecurringExpense.objects.get_or_create(
                household=household,
                label=label,
                defaults={
                    "amount": Decimal(amount),
                    "supplier": supplier,
                    "budget": budget,
                    "next_due_date": next_due,
                    "cadence": cadence,
                    "notes": notes,
                },
            )
            return obj

        recurring(
            "Fibre Orange",
            "42.99",
            supplier="Orange",
            budget=budgets["abonnements"],
            next_due=anchor_on("ORANGE", 6),
            cadence=RecurringExpense.Cadence.MONTHLY,
        )
        recurring(
            "Assurance habitation",
            "58.30",
            supplier="MAIF",
            budget=budgets["assurances"],
            next_due=anchor_on("MAIF", 11),
            cadence=RecurringExpense.Cadence.MONTHLY,
            notes="Contrat H-4419028, prélevé le 14.",
        )
        recurring(
            "Abonnement Netflix",
            "13.49",
            supplier="Netflix",
            budget=budgets["loisirs"],
            next_due=today + timedelta(days=6),
            cadence=RecurringExpense.Cadence.MONTHLY,
        )
        taxe_year = today.year if today < date(today.year, 10, 15) else today.year + 1
        recurring(
            "Taxe foncière",
            "1240.00",
            supplier="DGFiP",
            budget=budgets["maison"],
            next_due=date(taxe_year, 10, 15),
            cadence=RecurringExpense.Cadence.YEARLY,
            notes="Payée en une fois, prélèvement à l'échéance.",
        )

    # ------------------------------------------------------------------
    # Équipements
    # ------------------------------------------------------------------

    def _create_equipment(self, household, user, zones):
        """Le parc matériel — avec ce qui fait l'intérêt de l'écran : une garantie
        qui court encore, une révision due, une autre en retard, et une machine
        partie à l'atelier. Un parc entièrement vert ne montre rien.
        """
        today = household_today(household)

        def equip(name, *, zone_key=None, category="general", **fields):
            defaults = {
                "zone": zones[zone_key] if zone_key else None,
                "category": category,
                "created_by": user,
                "updated_by": user,
                **fields,
            }
            obj, _created = Equipment.objects.get_or_create(
                household=household, name=name, defaults=defaults
            )
            return obj

        chaudiere = equip(
            "Chaudière gaz Vitodens 100-W",
            zone_key="cave",
            category="heating",
            manufacturer="Viessmann",
            model="Vitodens 100-W B1HF",
            serial_number="7519-448210",
            purchase_date=date(2015, 10, 12),
            purchase_price=Decimal("3450.00"),
            purchase_vendor="Chauffage Rhône Services",
            warranty_expires_on=date(2020, 10, 12),
            warranty_provider="Viessmann France",
            maintenance_interval_months=12,
            # Onze mois : la révision annuelle tombe le mois prochain.
            last_service_at=today - timedelta(days=335),
            notes="Contrat d'entretien annuel chez Berthier. Pression à vérifier entre 1,2 et 1,5 bar.",
            tags=["chauffage", "contrat d'entretien"],
        )
        equip(
            "Lave-linge Serie 6",
            zone_key="sdb",
            category="appliance",
            manufacturer="Bosch",
            model="WAN28270FF",
            serial_number="FD9812-004417",
            purchase_date=today - timedelta(days=730),
            purchase_price=Decimal("549.00"),
            purchase_vendor="Boulanger",
            warranty_expires_on=today + timedelta(days=365),
            warranty_provider="Boulanger — extension 5 ans",
            notes="Bruit de roulement à l'essorage depuis quelques semaines.",
            tags=["électroménager", "garantie"],
        )
        equip(
            "Réfrigérateur combiné CNef 4315",
            zone_key="cuisine",
            category="appliance",
            manufacturer="Liebherr",
            model="CNef 4315-20",
            purchase_date=today - timedelta(days=1490),
            purchase_price=Decimal("799.00"),
            purchase_vendor="Darty",
            warranty_expires_on=today - timedelta(days=760),
            tags=["électroménager"],
        )
        tondeuse = equip(
            "Tondeuse thermique IZY HRG 416",
            zone_key="garage",
            category="garden",
            manufacturer="Honda",
            model="HRG 416 SK",
            serial_number="MZCG-1904722",
            purchase_date=today - timedelta(days=1820),
            purchase_price=Decimal("429.00"),
            purchase_vendor="Gamm vert",
            maintenance_interval_months=12,
            # Quatorze mois : la vidange est en retard, et l'écran le dit.
            last_service_at=today - timedelta(days=425),
            notes="Vidange + bougie + filtre à air une fois par an, avant la première tonte.",
            tags=["jardin", "entretien annuel"],
        )
        equip(
            "VMC double flux InspirAIR Home",
            zone_key="cave",
            category="hvac",
            manufacturer="Aldes",
            model="InspirAIR Home SC240",
            purchase_date=date(2015, 11, 20),
            purchase_price=Decimal("2180.00"),
            maintenance_interval_months=6,
            last_service_at=today - timedelta(days=200),
            notes="Filtres G4/F7 à changer deux fois par an.",
            tags=["ventilation"],
        )
        equip(
            "Vélo électrique Riverside 500 E",
            zone_key="garage",
            category="mobility",
            manufacturer="Decathlon",
            model="Riverside 500 E",
            serial_number="DKT-2211-88431",
            purchase_date=today - timedelta(days=400),
            purchase_price=Decimal("1299.00"),
            purchase_vendor="Decathlon Vénissieux",
            warranty_expires_on=today + timedelta(days=330),
            status=Equipment.Status.MAINTENANCE,
            notes="À l'atelier : capteur de pédalier à remplacer, pièce commandée.",
            tags=["mobilité", "garantie"],
        )
        equip(
            "Perceuse-visseuse GSR 18V-55",
            zone_key="garage",
            category="tool",
            manufacturer="Bosch Professional",
            model="GSR 18V-55",
            purchase_date=today - timedelta(days=210),
            purchase_price=Decimal("189.90"),
            purchase_vendor="Leroy Merlin",
            warranty_expires_on=today + timedelta(days=885),
            tags=["outillage", "chantier sdb"],
        )

        self.stdout.write(
            f"  Équipements : {Equipment.objects.filter(household=household).count()} au parc"
        )
        return {"chaudiere": chaudiere, "tondeuse": tondeuse}

    # ------------------------------------------------------------------
    # Stock
    # ------------------------------------------------------------------

    def _create_stock(self, household, user, zones):
        """Le garde-manger et l'atelier, avec une histoire derrière chaque article.

        Les quantités **ne sont pas posées à plat** : chaque article est créé à son
        niveau d'il y a trois mois, puis descendu par des inventaires datés. C'est
        ce qui donne une courbe de consommation à afficher — un article créé à sa
        quantité du jour n'a qu'un point, et l'écran qui en fait un graphique
        n'aurait rien à montrer.

        Les statuts (`in_stock` / `low_stock` / `out_of_stock`) ne sont jamais
        écrits : ils se recalculent depuis la quantité et le seuil, comme partout
        ailleurs dans l'app.
        """
        from interactions.services import household_noon
        from stock.services import (
            create_stock_item,
            purchase_stock_item,
            recompute_status,
            record_initial_level,
            record_inventory,
        )

        now = timezone.now()
        today = household_today(household)

        def category(name, emoji, color, sort_order):
            obj, _created = StockCategory.objects.get_or_create(
                household=household,
                name=name,
                defaults={
                    "emoji": emoji,
                    "color": color,
                    "sort_order": sort_order,
                    "created_by": user,
                    "updated_by": user,
                },
            )
            return obj

        categories = {
            "food": category("Alimentaire", "🥫", "#f59e0b", 1),
            "cleaning": category("Entretien", "🧴", "#38bdf8", 2),
            "diy": category("Bricolage", "🔩", "#94a3b8", 3),
            "animals": category("Animaux", "🐔", "#22c55e", 4),
            "heating": category("Chauffage", "🔥", "#ef4444", 5),
        }

        def item(name, *, cat, zone_key, unit, levels, min_quantity, unit_price=None, supplier="", notes=""):
            """``levels`` = [(jours avant aujourd'hui, quantité)], du plus ancien au plus récent."""
            existing = StockItem.objects.filter(household=household, name=name).first()
            if existing is not None:
                return existing

            first_days, first_qty = levels[0]
            obj = create_stock_item(
                household,
                user,
                category=categories[cat],
                name=name,
                unit=unit,
                quantity=str(first_qty),
                min_quantity=str(min_quantity),
                zone=str(zones[zone_key].id),
                unit_price=str(unit_price) if unit_price is not None else None,
                supplier=supplier,
                notes=notes,
            )
            recompute_status(obj)
            obj.save(update_fields=["status", "updated_at"])
            record_initial_level(item=obj, user=user, occurred_at=now - timedelta(days=first_days))
            for days, quantity in levels[1:]:
                record_inventory(
                    item=obj,
                    user=user,
                    quantity=Decimal(str(quantity)),
                    occurred_at=now - timedelta(days=days),
                )
            return obj

        cafe = item(
            "Café en grains",
            cat="food",
            zone_key="cuisine",
            unit="kg",
            levels=[(62, 2), (31, 1.4), (4, 0.7)],
            min_quantity=0.8,
            unit_price="18.90",
            supplier="Torréfaction Mokxa",
        )
        pastilles = item(
            "Pastilles lave-vaisselle",
            cat="cleaning",
            zone_key="cuisine",
            unit="unit",
            levels=[(55, 60), (21, 22), (2, 0)],
            min_quantity=10,
            unit_price="0.27",
            supplier="Carrefour Market",
        )
        item(
            "Lessive liquide",
            cat="cleaning",
            zone_key="sdb",
            unit="L",
            levels=[(70, 5), (26, 2.5)],
            min_quantity=1,
            unit_price="4.10",
        )
        item(
            "Papier toilette",
            cat="cleaning",
            zone_key="cave",
            unit="unit",
            levels=[(45, 24), (9, 9)],
            min_quantity=6,
            unit_price="0.52",
        )
        item(
            "Sel pour adoucisseur",
            cat="cleaning",
            zone_key="cave",
            unit="kg",
            levels=[(48, 50), (12, 25)],
            min_quantity=15,
            unit_price="0.65",
        )
        item(
            "Vis 4×40",
            cat="diy",
            zone_key="garage",
            unit="unit",
            levels=[(90, 300), (18, 210)],
            min_quantity=50,
            unit_price="0.06",
            supplier="Leroy Merlin",
        )
        ampoules = item(
            "Ampoules LED E27",
            cat="diy",
            zone_key="garage",
            unit="unit",
            levels=[(80, 8), (13, 3)],
            min_quantity=4,
            unit_price="3.40",
            supplier="Leroy Merlin",
        )
        item(
            "Bois de chauffage",
            cat="heating",
            zone_key="cave",
            unit="stère",
            levels=[(120, 6), (60, 4.6), (14, 3.8)],
            min_quantity=2,
            unit_price="82.00",
            supplier="Bois du Pilat",
            notes="Chêne sec, livré fendu en 33 cm.",
        )

        # ── Les granulés : le seul article qui a été racheté ───────────────────
        #
        # L'achat est daté **avant la fenêtre de conformité** (le solde d'ouverture
        # du compte est au dernier jour de l'avant-dernier mois). Une dépense sans
        # ligne de relevé *dans* la fenêtre est un écart légitime que le Contrôle
        # signalerait — vrai dans un vrai foyer, mais ici ce serait un écart
        # fabriqué par la seed, sur un achat qu'aucun relevé de démonstration ne
        # couvrira jamais.
        purchase_day = today.replace(day=1) - timedelta(days=1)
        purchase_day = purchase_day.replace(day=1) - timedelta(days=5)
        purchase_at = household_noon(household, purchase_day)
        granules = item(
            "Granulés pour poules",
            cat="animals",
            zone_key="jardin",
            unit="kg",
            levels=[((today - purchase_day).days + 40, 30), ((today - purchase_day).days + 2, 16)],
            min_quantity=5,
            unit_price="1.05",
            supplier="Gamm vert",
            notes="Ponte bio, sac de 25 kg.",
        )
        if not Interaction.objects.filter(
            household=household, kind="stock_purchase", source_object_id=granules.id
        ).exists():
            purchase_stock_item(
                item=granules,
                user=user,
                delta=Decimal("25"),
                amount=Decimal("26.25"),
                supplier="Gamm vert",
                brand="Ponte bio",
                remaining_before=Decimal("16"),
                occurred_at=purchase_at,
                notes="Sac de 25 kg, ramené du magasin.",
            )
            record_inventory(
                item=granules, user=user, quantity=Decimal("30"), occurred_at=now - timedelta(days=20)
            )
            record_inventory(
                item=granules, user=user, quantity=Decimal("19"), occurred_at=now - timedelta(days=5)
            )

        self.stdout.write(
            f"  Stock : {StockItem.objects.filter(household=household).count()} articles dans "
            f"{len(categories)} catégories, "
            f"{StockItem.objects.filter(household=household).exclude(status='in_stock').count()} à racheter"
        )
        return {
            "cafe": cafe,
            "pastilles": pastilles,
            "ampoules": ampoules,
            "granules": granules,
        }

    # ------------------------------------------------------------------
    # Liste de courses
    # ------------------------------------------------------------------

    def _create_shopping(self, household, user, stock):
        """La liste partagée : ce qui vient du stock bas, et ce qu'on y jette à la main."""
        from shopping.services import add_stock_item_to_list, create_list_item

        # Depuis l'inventaire : le lien vers l'article survit à la course, et
        # ``add_stock_item_to_list`` est déjà idempotent sur une ligne non cochée.
        for key, quantity in (("pastilles", 60), ("cafe", 1), ("ampoules", 4)):
            add_stock_item_to_list(household, user, stock[key], quantity=quantity)

        def line(label, *, quantity=None, unit="", note="", checked_days_ago=None):
            existing = ShoppingListItem.objects.filter(household=household, label=label).first()
            if existing is not None:
                return existing
            obj = create_list_item(
                household, user, label=label, quantity=quantity, unit=unit, note=note
            )
            if checked_days_ago is not None:
                obj.checked_at = timezone.now() - timedelta(days=checked_days_ago)
                obj.save(update_fields=["checked_at", "updated_at"])
            return obj

        line("Pain de campagne", quantity=1, unit="unit")
        line("Fromage de chèvre", note="Le petit rond de la fromagerie, pas celui du rayon.")
        line("Piles AA", quantity=4, unit="unit", note="Pour la télécommande du portail.")
        line("Terreau", quantity=40, unit="L", note="Pour les jardinières de la terrasse.")
        line("Yaourts nature", quantity=8, unit="unit", checked_days_ago=2)
        line("Pommes", quantity=2, unit="kg", checked_days_ago=2)

        self.stdout.write(
            "  Courses : "
            f"{ShoppingListItem.objects.filter(household=household, checked_at__isnull=True).count()} à prendre, "
            f"{ShoppingListItem.objects.filter(household=household, checked_at__isnull=False).count()} cochées"
        )

    # ------------------------------------------------------------------
    # Poulailler
    # ------------------------------------------------------------------

    def _create_chickens(self, household, user, zones, stock):
        """Cinq poules, quarante-cinq jours de ponte, et un journal qui explique les trous.

        La ponte n'est pas régulière et ne doit pas l'être : une couvaison, une
        maladie et une attaque de fouine se lisent dans la courbe, et c'est le
        journal qui les explique. Une série plate ne prouve rien.
        """
        from chickens.services import (
            complete_chore,
            create_chicken,
            create_chore,
            create_event,
            log_eggs,
        )

        today = household_today(household)
        jardin = str(zones["jardin"].id)

        def hen(name, *, breed, color, status, acquired_days_ago, notes=""):
            existing = Chicken.objects.filter(household=household, name=name).first()
            if existing is not None:
                return existing
            return create_chicken(
                household,
                user,
                name=name,
                breed=breed,
                color=color,
                status=status,
                acquired_on=today - timedelta(days=acquired_days_ago),
                notes=notes,
                zone_id=jardin,
            )

        roussette = hen(
            "Roussette", breed="Poule rousse", color="Rousse",
            status=Chicken.Status.ACTIVE, acquired_days_ago=430,
        )
        hen(
            "Marguerite", breed="Sussex", color="Blanche mouchetée",
            status=Chicken.Status.ACTIVE, acquired_days_ago=430,
        )
        plumette = hen(
            "Plumette", breed="Marans", color="Noir cuivré",
            status=Chicken.Status.BROODY, acquired_days_ago=430,
            notes="Couve tout ce qu'elle trouve dès qu'il fait chaud.",
        )
        coquette = hen(
            "Coquette", breed="Leghorn", color="Blanche",
            status=Chicken.Status.SICK, acquired_days_ago=180,
            notes="Sous traitement, isolée dans le petit enclos.",
        )
        bijou = hen(
            "Bijou", breed="Poule rousse", color="Rousse",
            status=Chicken.Status.DECEASED, acquired_days_ago=430,
        )

        def event(type_, title, days_ago, *, chicken=None, notes=""):
            if ChickenEvent.objects.filter(household=household, title=title).exists():
                return
            create_event(
                household,
                user,
                type=type_,
                title=title,
                occurred_on=today - timedelta(days=days_ago),
                chicken=chicken,
                notes=notes,
            )

        event(
            ChickenEvent.Type.ARRIVAL, "Arrivée des quatre premières poules", 430,
            notes="Récupérées chez un éleveur de Saint-Priest, à six mois.",
        )
        event(
            ChickenEvent.Type.ARRIVAL, "Arrivée de Coquette", 180, chicken=coquette,
            notes="Remplace une poule perdue l'automne dernier.",
        )
        event(
            ChickenEvent.Type.PREDATOR, "Fouine dans le poulailler", 58,
            notes="Passage par le grillage côté nord, réparé le lendemain. Bijou n'a pas survécu.",
        )
        event(
            ChickenEvent.Type.DEATH, "Bijou n'a pas survécu à l'attaque", 58, chicken=bijou,
        )
        event(
            ChickenEvent.Type.MOLT, "Mue de Roussette", 34, chicken=roussette,
            notes="Ponte arrêtée pendant trois semaines, plumage refait depuis.",
        )
        event(
            ChickenEvent.Type.ILLNESS, "Coryza chez Coquette", 9, chicken=coquette,
            notes="Écoulement et éternuements. Traitement vétérinaire sur 8 jours, isolement.",
        )
        event(
            ChickenEvent.Type.BROODY, "Plumette se met à couver", 6, chicken=plumette,
            notes="Retirée du nid deux fois par jour, sans grand succès.",
        )

        def chore(name, emoji, interval_days, *, starts_days_ago, done_days_ago=(), notes=""):
            existing = ChickenChore.objects.filter(household=household, name=name).first()
            if existing is not None:
                return existing
            obj = create_chore(
                household,
                user,
                name=name,
                emoji=emoji,
                interval_days=interval_days,
                starts_on=today - timedelta(days=starts_days_ago),
                notes=notes,
            )
            for days in done_days_ago:
                complete_chore(household, user, obj, occurred_on=today - timedelta(days=days))
            return obj

        chore(
            "Nettoyer le poulailler", "🧹", 14,
            starts_days_ago=40, done_days_ago=(38, 22, 8),
        )
        # Volontairement en retard de trois jours : un écran de soins tous verts
        # ne dit pas à quoi sert le rappel.
        chore(
            "Changer la litière", "🪵", 30,
            starts_days_ago=70, done_days_ago=(65, 33),
            notes="Copeaux de peuplier, un sac par changement.",
        )
        chore(
            "Vermifuger le troupeau", "💊", 180,
            starts_days_ago=200, done_days_ago=(120,),
            notes="Traitement sur 3 jours dans l'eau de boisson.",
        )

        # La ponte : quatre poules pondeuses, moins pendant la mue et la couvaison,
        # rien les jours où personne n'est passé ramasser.
        pattern = [4, 3, 4, 5, 3, 4, 2]
        for offset in range(45):
            day = today - timedelta(days=offset)
            count = pattern[offset % len(pattern)]
            if 30 <= offset <= 45:      # mue de Roussette
                count = max(count - 1, 0)
            if offset <= 8:             # Plumette couve, Coquette est malade
                count = max(count - 2, 0)
            if offset in (12, 27):      # personne n'est passé ramasser
                continue
            log_eggs(household, user, date=day, count=count)

        ChickenSettings.objects.get_or_create(
            household=household,
            defaults={"feed_stock_item": stock["granules"], "created_by": user},
        )

        self.stdout.write(
            f"  Poulailler : {Chicken.objects.filter(household=household).count()} poules, "
            f"{EggLog.objects.filter(household=household).count()} jours de ponte, "
            f"{ChickenChore.objects.filter(household=household).count()} soins récurrents"
        )

    # ------------------------------------------------------------------
    # Eau
    # ------------------------------------------------------------------

    def _create_water(self, household, user):
        """Dix-huit mois de relevés — assez pour que l'écran compare un mois à celui
        de l'an dernier, ce qu'une poignée de points ne permet pas.

        La consommation suit la saison : arrosage l'été, quasi rien l'hiver.
        """
        from water.services import create_water_reading

        today = household_today(household)
        # m³ consommés par mois, de janvier à décembre (potager + jardin l'été).
        by_month = [7, 7, 8, 10, 13, 18, 22, 21, 14, 9, 7, 7]

        first = date(today.year, today.month, 1)
        months = []
        cursor = first
        for _ in range(18):
            months.append(cursor)
            cursor = (cursor - timedelta(days=1)).replace(day=1)
        months.reverse()

        index = Decimal("1042.500")
        created = 0
        for month_start in months:
            if not WaterReading.objects.filter(
                household=household, reading_date=month_start
            ).exists():
                create_water_reading(
                    household, user, reading_date=month_start, index_m3=index
                )
                created += 1
            index += Decimal(by_month[month_start.month - 1]) + Decimal("0.400")

        self.stdout.write(f"  Eau : {created} relevés de compteur ajoutés")

    # ------------------------------------------------------------------
    # Assurances
    # ------------------------------------------------------------------

    def _create_insurance(self, household, user):
        today = household_today(household)

        def contract(name, **fields):
            obj, _created = InsuranceContract.objects.get_or_create(
                household=household,
                name=name,
                defaults={"created_by": user, "updated_by": user, **fields},
            )
            return obj

        contract(
            "Habitation — 14 rue des Lilas",
            provider="MAIF",
            contract_number="H-4419028",
            type=InsuranceContract.InsuranceType.HOME,
            insured_item="Maison individuelle 128 m², dépendances et jardin",
            start_date=date(2015, 9, 1),
            renewal_date=date(today.year + (0 if today.month < 9 else 1), 9, 1),
            payment_frequency=InsuranceContract.PaymentFrequency.MONTHLY,
            monthly_cost=Decimal("58.30"),
            yearly_cost=Decimal("699.60"),
            coverage_summary="Multirisque habitation, bris de glace, dégâts des eaux, "
                             "responsabilité civile familiale. Franchise 150 €.",
            notes="Le prélèvement du 14 apparaît au relevé.",
        )
        contract(
            "Auto — Peugeot 308",
            provider="MAIF",
            contract_number="A-2280714",
            type=InsuranceContract.InsuranceType.CAR,
            insured_item="Peugeot 308 SW 1.5 BlueHDi — AB-442-CD",
            start_date=date(2019, 4, 15),
            renewal_date=date(today.year + (0 if today.month < 4 else 1), 4, 15),
            payment_frequency=InsuranceContract.PaymentFrequency.QUARTERLY,
            monthly_cost=Decimal("62.00"),
            yearly_cost=Decimal("744.00"),
            coverage_summary="Tous risques, bonus 0,50, prêt de volant. Assistance 0 km.",
        )
        contract(
            "Mutuelle santé famille",
            provider="Harmonie Mutuelle",
            contract_number="M-77120945",
            type=InsuranceContract.InsuranceType.HEALTH,
            insured_item="Claire, Antoine et Léa",
            start_date=date(2021, 1, 1),
            renewal_date=date(today.year + 1, 1, 1),
            payment_frequency=InsuranceContract.PaymentFrequency.MONTHLY,
            monthly_cost=Decimal("148.90"),
            yearly_cost=Decimal("1786.80"),
            coverage_summary="Formule 3 : optique et dentaire renforcés, hospitalisation 200 %.",
            notes="C'est elle qui a remboursé les 47,60 € du relevé.",
        )
        contract(
            "Garantie accidents de la vie",
            provider="MAIF",
            contract_number="G-9041220",
            type=InsuranceContract.InsuranceType.LIABILITY,
            start_date=date(2018, 6, 1),
            renewal_date=date(today.year + (0 if today.month < 6 else 1), 6, 1),
            payment_frequency=InsuranceContract.PaymentFrequency.YEARLY,
            monthly_cost=Decimal("12.40"),
            yearly_cost=Decimal("148.80"),
            coverage_summary="Accidents de la vie privée pour les trois membres du foyer.",
        )

        self.stdout.write(
            f"  Assurances : {InsuranceContract.objects.filter(household=household).count()} contrats"
        )

    # ------------------------------------------------------------------
    # Suivis chiffrés
    # ------------------------------------------------------------------

    def _create_trackers(self, household, user):
        """Trois séries que rien d'autre ne mesure dans l'app.

        Aucune ne double un compteur existant : ni l'eau (module dédié), ni
        l'électricité, ni le coût d'un chantier — qui est une somme de dépenses et
        n'a donc pas le droit d'avoir une seconde définition ici.
        """
        from trackers.services import add_entry, create_tracker

        now = timezone.now()

        def tracker(name, *, unit, emoji, description, entries):
            existing = Tracker.objects.filter(household=household, name=name).first()
            if existing is not None:
                return existing
            obj = create_tracker(
                household, user, name=name, unit=unit, emoji=emoji, description=description
            )
            for days_ago, value, note in entries:
                add_entry(
                    household,
                    user,
                    obj,
                    value=Decimal(str(value)),
                    occurred_at=now - timedelta(days=days_ago),
                    note=note,
                )
            return obj

        tracker(
            "Récupérateur d'eau de pluie",
            unit="L",
            emoji="💧",
            description="Cuve de 1000 L au fond du jardin, relevée à la jauge.",
            entries=[
                (150, 940, "Plein après les pluies de mars."),
                (120, 780, ""),
                (90, 520, "Premiers arrosages du potager."),
                (60, 310, ""),
                (30, 120, "Presque vide, arrosage au tuyau depuis."),
                (5, 640, "Remontée après l'orage de la semaine dernière."),
            ],
        )
        tracker(
            "Heures moteur tondeuse",
            unit="h",
            emoji="🚜",
            description="Compteur horaire de la Honda IZY — sert à caler la vidange annuelle.",
            entries=[
                (365, 118.5, "Relevé au moment de la dernière vidange."),
                (200, 131.0, ""),
                (120, 142.5, ""),
                (60, 151.0, ""),
                (14, 158.5, "Vidange à prévoir, on dépasse les 40 h depuis la dernière."),
            ],
        )
        tracker(
            "Température de la cave",
            unit="°C",
            emoji="🌡️",
            description="Relevée sur le thermomètre du fond, près des bouteilles.",
            entries=[
                (180, 11.5, ""),
                (150, 12.0, ""),
                (120, 13.5, ""),
                (90, 15.0, ""),
                (60, 16.5, "Un peu haut, on ferme le soupirail la journée."),
                (20, 15.5, ""),
                (3, 15.0, ""),
            ],
        )

        self.stdout.write(
            f"  Suivis : {Tracker.objects.filter(household=household).count()} séries, "
            f"{TrackerEntry.objects.filter(household=household).count()} relevés"
        )

    # ------------------------------------------------------------------
    # Annuaire
    # ------------------------------------------------------------------

    def _create_directory(self, household, user):
        """Les gens qu'on rappelle : l'artisan du chantier, le vétérinaire, l'assureur.

        Les coordonnées sont **fictives par construction** — numéros en 06 99 xx et
        domaines `.demo`, qui n'appartiennent à personne. Un jeu de démonstration
        publié dans un dépôt public n'a pas le droit de faire sonner un vrai
        téléphone.
        """

        def structure(name, *, type_, description="", website="", tags=None, phone=None,
                      email=None, address=None):
            obj, created = Structure.objects.get_or_create(
                household=household,
                name=name,
                defaults={
                    "type": type_,
                    "description": description,
                    "website": website,
                    "tags": tags or [],
                    "created_by": user,
                    "updated_by": user,
                },
            )
            if created:
                if phone:
                    Phone.objects.create(
                        household=household, structure=obj, phone=phone,
                        label="Standard", is_primary=True, created_by=user,
                    )
                if email:
                    Email.objects.create(
                        household=household, structure=obj, email=email,
                        label="Contact", is_primary=True, created_by=user,
                    )
                if address:
                    Address.objects.create(
                        household=household, structure=obj, is_primary=True,
                        created_by=user, **address,
                    )
            return obj

        def contact(first_name, last_name, *, structure_obj=None, position="", notes="",
                    phone=None, email=None):
            obj, created = Contact.objects.get_or_create(
                household=household,
                first_name=first_name,
                last_name=last_name,
                defaults={
                    "structure": structure_obj,
                    "position": position,
                    "notes": notes,
                    "created_by": user,
                    "updated_by": user,
                },
            )
            if created:
                if phone:
                    Phone.objects.create(
                        household=household, contact=obj, phone=phone,
                        label="Mobile", is_primary=True, created_by=user,
                    )
                if email:
                    Email.objects.create(
                        household=household, contact=obj, email=email,
                        label="Pro", is_primary=True, created_by=user,
                    )
            return obj

        plomberie = structure(
            "Plomberie Berthier",
            type_="Artisan",
            description="Plombier chauffagiste — chantier de la salle de bain et entretien de la chaudière.",
            tags=["plomberie", "chantier sdb", "chaudière"],
            phone="06 99 41 22 08",
            email="contact@plomberie-berthier.demo",
            address={
                "address_1": "8 rue Villon",
                "zipcode": "69008",
                "city": "Lyon",
                "country": "FR",
                "label": "Atelier",
            },
        )
        contact(
            "Julien", "Berthier",
            structure_obj=plomberie,
            position="Gérant",
            notes="Répond mieux par SMS. Devis n° 2024-118 accepté pour la salle de bain.",
            phone="06 99 41 22 08",
            email="j.berthier@plomberie-berthier.demo",
        )

        veto = structure(
            "Clinique vétérinaire des Lilas",
            type_="Santé animale",
            description="Suit le poulailler — vaccination et traitement du coryza.",
            tags=["poules", "urgence"],
            phone="06 99 30 55 71",
            email="accueil@veto-lilas.demo",
            address={
                "address_1": "22 avenue Lacassagne",
                "zipcode": "69003",
                "city": "Lyon",
                "country": "FR",
            },
        )
        contact(
            "Nadia", "Belkacem",
            structure_obj=veto,
            position="Vétérinaire",
            notes="Consulte les volailles le mardi et le samedi matin.",
        )

        structure(
            "MAIF — agence Lyon Part-Dieu",
            type_="Assurance",
            description="Habitation, auto et garantie accidents de la vie.",
            tags=["assurance"],
            phone="06 99 12 84 30",
            email="lyon.partdieu@assureur.demo",
        )
        contact(
            "Sophie", "Nguyen",
            position="Conseillère MAIF",
            notes="Interlocutrice pour le sinistre dégât des eaux de 2023.",
            email="s.nguyen@assureur.demo",
        )

        structure(
            "Mairie de Lyon 3e",
            type_="Administration",
            description="État civil, encombrants, autorisation de travaux.",
            website="https://mairie3.lyon.demo",
            tags=["administratif"],
            phone="06 99 00 33 03",
        )
        structure(
            "Crédit Mutuel — Lyon Montchat",
            type_="Banque",
            description="Compte courant et crédit immobilier.",
            tags=["banque"],
            phone="06 99 77 10 46",
            email="montchat@banque.demo",
        )

        self.stdout.write(
            f"  Annuaire : {Structure.objects.filter(household=household).count()} structures, "
            f"{Contact.objects.filter(household=household).count()} contacts"
        )

    # ------------------------------------------------------------------
    # Journal du foyer
    # ------------------------------------------------------------------

    def _create_journal(self, household, claire, antoine, zones, equipment, projects):
        """Les entrées qui ne sont ni une tâche, ni une dépense : ce dont on se souvient.

        Trois familles dans la même table, discriminées comme le veut la règle :
        des **notes**, des **entretiens** rattachés à un équipement par la liaison
        polymorphe, et le **carnet de rénovation** (`metadata.kind='renovation'`),
        qui garde la marque et la référence de ce qui a été posé — la question à
        laquelle personne ne sait répondre trois ans plus tard.
        """
        from django.contrib.contenttypes.models import ContentType

        from interactions.services import create_note_interaction, create_renovation_interaction

        now = timezone.now()

        def exists(subject):
            return Interaction.objects.filter(household=household, subject=subject).exists()

        def note(subject, content, days_ago, *, user=claire, zone_keys=()):
            if exists(subject):
                return None
            return create_note_interaction(
                household=household,
                user=user,
                subject=subject,
                content=content,
                occurred_at=now - timedelta(days=days_ago),
                zone_ids=[zones[key].id for key in zone_keys] or None,
            )

        def log(subject, content, type_, days_ago, *, user=claire, zone_keys=(), equip=None):
            """Une entrée d'entretien, éventuellement rattachée à un équipement."""
            if exists(subject):
                return None
            interaction = Interaction.objects.create(
                household=household,
                created_by=user,
                updated_by=user,
                subject=subject,
                content=content,
                type=type_,
                occurred_at=now - timedelta(days=days_ago),
            )
            for key in zone_keys:
                InteractionZone.objects.get_or_create(interaction=interaction, zone=zones[key])
            if equip is not None:
                EquipmentInteraction.objects.get_or_create(
                    equipment=equip,
                    interaction=interaction,
                    defaults={"role": "log", "created_by": user},
                )
            return interaction

        note(
            "Code du portail changé",
            "L'ancien ne fonctionnait plus depuis le remplacement de la carte électronique. "
            "Le nouveau est dans le gestionnaire de mots de passe partagé.",
            21,
            user=antoine,
            zone_keys=("garage",),
        )
        note(
            "Les voisins sont absents du 10 au 24",
            "On relève leur courrier et on arrose les tomates. Ils ont laissé la clé du portillon.",
            9,
            zone_keys=("jardin",),
        )
        note(
            "Idées pour la chambre de Léa",
            "Bleu ardoise sur le mur du lit, étagères murales au-dessus du bureau, "
            "et remplacer le luminaire du plafond.",
            40,
            zone_keys=("chambre_ado",),
        )
        note(
            "Où couper l'eau",
            "Vanne générale dans la cave, à droite du compteur, derrière l'étagère à outils.",
            120,
            user=antoine,
            zone_keys=("cave",),
        )

        log(
            "Entretien annuel de la chaudière",
            "Contrôle de combustion, nettoyage du corps de chauffe, pression remise à 1,4 bar. "
            "Attestation d'entretien remise sur place.",
            "maintenance",
            335,
            zone_keys=("cave",),
            equip=equipment["chaudiere"],
        )
        log(
            "Vidange de la tondeuse",
            "Huile, bougie et filtre à air changés avant la première tonte de la saison.",
            "maintenance",
            425,
            user=antoine,
            zone_keys=("garage",),
            equip=equipment["tondeuse"],
        )
        log(
            "Bruit de roulement au lave-linge",
            "Grondement à l'essorage, de plus en plus net. Encore sous extension de garantie "
            "jusqu'à l'an prochain — appeler le SAV avant de démonter quoi que ce soit.",
            "issue",
            12,
            zone_keys=("sdb",),
        )
        log(
            "Ramonage du conduit",
            "Ramonage annuel du conduit de l'insert, certificat à garder pour l'assurance.",
            "inspection",
            230,
            zone_keys=("salon",),
        )
        log(
            "Fuite sous l'évier",
            "Joint du siphon remplacé, plus de trace d'humidité depuis. Le meuble a gonflé, "
            "à surveiller.",
            "repair",
            65,
            user=antoine,
            zone_keys=("cuisine",),
        )

        renovations = [
            {
                "element": "plumbing",
                "interaction_type": "replacement",
                "subject": "Dépose de la baignoire, pose du receveur",
                "product": "Receveur extra-plat 120 × 90",
                "brand": "Jacob Delafon",
                "reference": "E62466-00",
                "zone_keys": ("sdb",),
                "days_ago": 24,
                "notes": "Évacuation refaite en diamètre 40, pente vérifiée.",
            },
            {
                "element": "floor",
                "interaction_type": "installation",
                "subject": "Carrelage de la salle de bain",
                "product": "Grès cérame 60 × 60 anthracite",
                "brand": "Novoceram",
                "reference": "NOV-6060-ANT",
                "zone_keys": ("sdb",),
                "days_ago": 11,
                "notes": "Deux boîtes de rechange rangées à la cave, sous l'établi.",
            },
            {
                "element": "paint",
                "interaction_type": "upgrade",
                "subject": "Peinture du mur du lit",
                "product": "Peinture mate lessivable — Bleu Ardoise",
                "brand": "Tollens",
                "reference": "T2035-BA",
                "zone_keys": ("chambre_ado",),
                "days_ago": 95,
                "notes": "Un pot de 2,5 L a suffi pour deux couches.",
            },
            {
                "element": "joinery",
                "interaction_type": "replacement",
                "subject": "Fenêtre du bureau",
                "product": "Fenêtre PVC double vitrage 4/16/4",
                "brand": "K-Line",
                "reference": "KL-DV-1204",
                "zone_keys": ("bureau",),
                "days_ago": 300,
                "notes": "Posée par l'entreprise, facture et garantie décennale au dossier.",
            },
        ]
        for entry in renovations:
            if exists(entry["subject"]):
                continue
            create_renovation_interaction(
                household=household,
                user=claire,
                element=entry["element"],
                interaction_type=entry["interaction_type"],
                subject=entry["subject"],
                product=entry["product"],
                brand=entry["brand"],
                reference=entry["reference"],
                occurred_at=now - timedelta(days=entry["days_ago"]),
                notes=entry["notes"],
                zone_ids=[zones[key].id for key in entry["zone_keys"]],
            )

        # Les étiquettes : elles ne servent qu'à retrouver, donc elles se posent
        # sur ce qui se cherche — une garantie, un chantier, le chauffage.
        content_type = ContentType.objects.get_for_model(Interaction)
        for tag_name, subjects in {
            "chauffage": ("Entretien annuel de la chaudière", "Ramonage du conduit"),
            "garantie": ("Bruit de roulement au lave-linge", "Fenêtre du bureau"),
            "chantier sdb": ("Dépose de la baignoire, pose du receveur", "Carrelage de la salle de bain"),
        }.items():
            tag, _created = Tag.objects.get_or_create(
                household=household,
                type=Tag.TagType.INTERACTION,
                name=tag_name,
                defaults={"created_by": claire},
            )
            for subject in subjects:
                interaction = Interaction.objects.filter(
                    household=household, subject=subject
                ).first()
                if interaction is None:
                    continue
                TagLink.objects.get_or_create(
                    household=household,
                    tag=tag,
                    content_type=content_type,
                    object_id=str(interaction.id),
                    defaults={"created_by": claire},
                )

        self.stdout.write(
            "  Journal : "
            f"{Interaction.objects.filter(household=household).exclude(type='expense').count()} entrées "
            f"(notes, entretiens, rénovation), "
            f"{Tag.objects.filter(household=household).count()} étiquettes"
        )
