"""
Management command to seed demo data for testing.

Usage:
    python manage.py seed_demo_data           # crée les données (idempotent)
    python manage.py seed_demo_data --flush   # supprime puis recrée tout

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
  et deux opérations laissées « à ranger » exprès
"""

from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from electricity.models import (
    CircuitUsagePointLink,
    ElectricCircuit,
    ElectricityBoard,
    ProtectiveDevice,
    UsagePoint,
)
from households.models import Household, HouseholdMember
from banking.models import (
    BankAccount,
    BankTransaction,
    ComplianceWaiver,
    RefundAllocation,
    StatementImport,
)
from budget.models import Budget, BudgetCategory
from interactions.models import Interaction
from projects.models import Project
from stock.models import StockCategory, StockItem
from tasks.models import Task, TaskZone
from zones.models import Zone

User = get_user_model()


class Command(BaseCommand):
    help = "Seed demo data focused on tasks (household, users, zones, projects, tasks)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete previously created demo data before seeding",
        )

    def handle(self, *args, **options):
        if options["flush"]:
            self._flush()

        with transaction.atomic():
            household = self._create_household()
            claire, antoine, lea = self._create_users(household)
            zones = self._create_zones(household, claire)
            projects = self._create_projects(household, claire, antoine, zones)
            self._create_tasks(household, claire, antoine, lea, zones, projects)
            self._create_electricity(household, claire, zones)
            self._create_money(household, claire, projects)

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

    def _create_users(self, household):
        claire = self._get_or_create_user(
            email="claire.mercier@demo.local",
            first_name="Claire",
            last_name="Mercier",
            display_name="Claire",
            locale="fr",
            household=household,
        )
        antoine = self._get_or_create_user(
            email="antoine.mercier@demo.local",
            first_name="Antoine",
            last_name="Mercier",
            display_name="Antoine",
            locale="fr",
            household=household,
        )
        lea = self._get_or_create_user(
            email="lea.martin@demo.local",
            first_name="Léa",
            last_name="Martin",
            display_name="Léa",
            locale="fr",
            household=household,
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

    def _get_or_create_user(self, email, first_name, last_name, display_name, locale, household):
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
        if created:
            user.set_password("demo1234")
            user.save()
        return user

    # ------------------------------------------------------------------
    # Zones (hiérarchiques)
    # ------------------------------------------------------------------

    def _create_zones(self, household, created_by):
        def zone(name, parent=None, color="#f4f4f5", note=""):
            obj, _ = Zone.objects.get_or_create(
                household=household,
                name=name,
                parent=parent,
                defaults={
                    "color": color,
                    "note": note,
                    "created_by": created_by,
                    "updated_by": created_by,
                },
            )
            return obj

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
        from core.timezones import household_today

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
