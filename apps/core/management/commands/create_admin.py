"""Le premier compte d'une instance, créé sans que personne n'ait rien à saisir.

Il n'y a **pas d'inscription ouverte** dans Maisonnée : on entre dans un foyer
par invitation. C'est la bonne règle pour un foyer, et elle laisse un trou d'une
seule case — le premier compte, celui qui n'a personne pour l'inviter. Sans cette
commande, une installation neuve affiche un écran de connexion qu'aucun mot de
passe n'ouvre, et le lecteur en déduit que le produit est cassé.

Ce que la commande crée, elle le crée **entier** : un compte *et* un foyer *et*
l'appartenance qui les relie, avec le foyer actif positionné. Un compte sans
foyer se connecte et arrive sur une application vide de tout — c'est un
demi-succès qui ressemble exactement à un échec.

Idempotente par la même règle que le reste du projet : relancée, elle ne fait
rien et le dit. Le conteneur ``init`` du ``docker-compose.yml`` l'appelle à
**chaque** démarrage.
"""
from __future__ import annotations

import os
import secrets

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from households.models import Household, HouseholdMember

DEFAULT_EMAIL = "admin@maisonnee.local"
DEFAULT_HOUSEHOLD = "Ma maisonnée"


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

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()

        # La condition d'idempotence porte sur « **un** compte existe », pas sur
        # « **ce** compte existe » : quelqu'un qui a créé son vrai compte puis
        # supprimé l'admin par défaut ne doit pas le voir réapparaître à chaque
        # redémarrage, avec un mot de passe qu'il ne connaît pas.
        if User.objects.exists():
            self.stdout.write("create_admin: un compte existe déjà, rien à faire.")
            return

        email = (options["email"] or DEFAULT_EMAIL).strip().lower()
        household_name = options["household"] or DEFAULT_HOUSEHOLD
        password = options["password"]
        generated = not password
        if generated:
            # Assez court pour être retapé depuis les logs, assez long pour ne
            # pas être deviné (~77 bits).
            password = secrets.token_urlsafe(12)

        user = User.objects.create_superuser(
            email=email,
            password=password,
            first_name="",
            display_name=email.split("@")[0],
        )
        household = Household.objects.create(name=household_name)
        HouseholdMember.objects.create(
            household=household, user=user, role=HouseholdMember.Role.OWNER
        )
        user.active_household = household
        user.save(update_fields=["active_household"])

        self._announce(email, password, generated)

    def _announce(self, email: str, password: str, generated: bool) -> None:
        """Les identifiants doivent sauter aux yeux dans le flot de `compose up`.

        Un mot de passe généré qui défile entre deux lignes de migration est un
        mot de passe perdu : le lecteur ferait un ``docker compose down -v`` pour
        recommencer, et détruirait son volume.
        """
        line = "─" * 64
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(line))
        self.stdout.write(self.style.SUCCESS("  Maisonnée — premier compte créé"))
        self.stdout.write(self.style.SUCCESS(line))
        self.stdout.write(f"  Identifiant : {email}")
        if generated:
            self.stdout.write(f"  Mot de passe : {password}")
            self.stdout.write("")
            self.stdout.write(
                "  Note-le : il est généré une seule fois et n'est stocké nulle part."
            )
            self.stdout.write(
                "  Pour le choisir toi-même : MAISONNEE_ADMIN_PASSWORD dans l'environnement."
            )
        else:
            self.stdout.write("  Mot de passe : celui de MAISONNEE_ADMIN_PASSWORD.")
        self.stdout.write(self.style.SUCCESS(line))
        self.stdout.write("")
