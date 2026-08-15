"""Le premier compte d'une **installation non surveillée**.

Le chemin normal n'est plus ici : c'est l'assistant de premier démarrage
(`accounts.views.setup`, issue #591), où la personne ouvre l'adresse et choisit
ses identifiants dans l'interface. Cette commande ne sert plus qu'au cas où
personne ne regardera l'écran — un déploiement scripté, une instance provisionnée
d'avance — et elle le reconnaît à une seule chose : **`MAISONNEE_ADMIN_PASSWORD`
est fourni.**

Sans ce mot de passe, elle ne crée rien. C'est le changement qui compte : avant,
elle en générait un et l'imprimait dans la sortie de `docker compose up`, où il
défilait sous les logs de gunicorn en une quinzaine de secondes. Le cadre était
soigné, la consigne (« note-le, il n'est stocké nulle part ») restait la phrase la
moins accueillante du parcours, et le risque était écrit ici même : un mot de
passe perdu, et le lecteur fait un `down -v` qui détruit son volume.

Ce qu'elle crée, elle le crée **entier** — compte, foyer, appartenance, foyer
actif — et par le même service que l'assistant (`accounts.services`), pour que les
deux chemins ne puissent pas diverger.

Idempotente par la même règle que le reste du projet : relancée, elle ne fait
rien et le dit. Le conteneur ``init`` du ``docker-compose.yml`` l'appelle à
**chaque** démarrage.
"""
from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.services import DEFAULT_EMAIL, DEFAULT_HOUSEHOLD, create_first_account


class Command(BaseCommand):
    help = "Create the first account and its household, once, from the environment."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=os.environ.get("MAISONNEE_ADMIN_EMAIL", ""))
        parser.add_argument(
            "--password", default=os.environ.get("MAISONNEE_ADMIN_PASSWORD", "")
        )
        parser.add_argument(
            "--household", default=os.environ.get("MAISONNEE_HOUSEHOLD_NAME", "")
        )

    def handle(self, *args, **options):
        User = get_user_model()

        # La condition d'idempotence porte sur « **un** compte existe », pas sur
        # « **ce** compte existe » : quelqu'un qui a créé son vrai compte puis
        # supprimé l'admin par défaut ne doit pas le voir réapparaître à chaque
        # redémarrage, avec un mot de passe qu'il ne connaît pas.
        if User.objects.exists():
            self.stdout.write("create_admin: un compte existe déjà, rien à faire.")
            return

        password = options["password"]
        if not password:
            # Le cas normal, et il est **silencieux**. Générer un mot de passe
            # ici reviendrait à réinventer ce que l'assistant vient de supprimer :
            # un secret imprimé dans un flot de logs, illisible dix secondes plus
            # tard. L'instance reste sans compte, et le premier visiteur la
            # configure.
            self.stdout.write(
                "create_admin: aucun MAISONNEE_ADMIN_PASSWORD — "
                "le premier compte se créera dans l'interface."
            )
            return

        user = create_first_account(
            email=options["email"] or DEFAULT_EMAIL,
            password=password,
            household_name=options["household"] or DEFAULT_HOUSEHOLD,
        )
        self._announce(user.email)

    def _announce(self, email: str) -> None:
        """Ce qui reste à dire tient en deux lignes.

        Le mot de passe n'est plus imprimé : il vient de l'environnement, donc
        celui qui a lancé l'installation l'a déjà.
        """
        line = "─" * 64
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(line))
        self.stdout.write(self.style.SUCCESS("  Maisonnée — premier compte créé"))
        self.stdout.write(self.style.SUCCESS(line))
        self.stdout.write(f"  Identifiant : {email}")
        self.stdout.write("  Mot de passe : celui de MAISONNEE_ADMIN_PASSWORD.")
        self.stdout.write(self.style.SUCCESS(line))
        self.stdout.write("")
