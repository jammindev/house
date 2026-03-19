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
"""

from datetime import date, datetime, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from households.models import Household, HouseholdMember
from projects.models import Project
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

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))

    # ------------------------------------------------------------------
    # Flush
    # ------------------------------------------------------------------

    def _flush(self):
        email_list = ["claire.mercier@demo.local", "antoine.mercier@demo.local", "lea.martin@demo.local"]
        users = User.objects.filter(email__in=email_list)
        Household.objects.filter(name="Famille Mercier").delete()
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
