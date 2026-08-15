"""L'assistant de premier démarrage — le compte se crée dans l'interface.

Avant ce module, une installation neuve générait un mot de passe et l'imprimait
dans la sortie de `docker compose up`. Le cadre était soigné ; il défilait quand
même. `web` déverse ses logs d'accès dès qu'il démarre, et quinze secondes plus
tard le mot de passe est hors écran — avec pour seule consigne « note-le, il
n'est stocké nulle part ». `create_admin` avait nommé le risque sans pouvoir
l'éviter : « un mot de passe perdu, et le lecteur ferait un `down -v` pour
recommencer, en détruisant son volume ».

Le terminal était devenu une **étape du parcours**, alors que le README promet
que tout se fait depuis l'interface. C'est ce que ce module supprime : on ouvre
l'adresse, on choisit ses identifiants, on est dedans. Même pratique que
Nextcloud, Home Assistant, Immich, Jellyfin, Gitea ou Portainer — la commande
`MAISONNEE_ADMIN_PASSWORD` restant l'échappatoire pour l'installation non
surveillée.

Doc : `docs/self-hosting/install.md`. Issue : #591.
"""
from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import connection, transaction
from django.utils.translation import gettext_lazy as _

from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.services import DEFAULT_HOUSEHOLD, create_first_account
from accounts.throttles import SignupRateThrottle

# Clé arbitraire mais **stable** du verrou consultatif. Elle ne désigne rien
# d'autre que « la configuration initiale de cette base » ; deux processus qui
# la demandent s'attendent l'un l'autre.
_SETUP_LOCK_KEY = 728_119_034


class SetupSerializer(serializers.Serializer):
    """Ce que l'écran de configuration envoie, et rien d'autre.

    Volontairement **pas** un `ModelSerializer` : on n'ouvre pas ici la surface
    d'écriture d'un utilisateur (`is_staff`, `is_superuser`, `locale`…) à une
    requête non authentifiée. Trois champs, tous obligatoires sauf le nom du
    foyer, qui a un défaut parce qu'on peut le renommer d'un clic ensuite.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    # Le prénom n'est pas de la coquetterie : sans lui, le nom affiché se dérive
    # de l'adresse et le premier mot de l'app est « Bonjour benjamin.vandamme ».
    first_name = serializers.CharField(
        required=False, allow_blank=True, max_length=150, default=""
    )
    household_name = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )

    def validate_password(self, value):
        """Le premier mot de passe de l'instance passe par `AUTH_PASSWORD_VALIDATORS`.

        `set_password` hache n'importe quoi. C'est exactement le défaut corrigé
        sur le chemin d'inscription (#569), et il vaut ici davantage : ce compte
        est superutilisateur, et c'est le seul de l'instance.
        """
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class SetupView(APIView):
    """``/api/accounts/setup/`` — le premier compte, une fois et une seule."""

    permission_classes = [AllowAny]

    def get_throttles(self):
        """Seule l'écriture est serrée.

        `SignupRateThrottle` vaut 5 par heure et par IP : appliqué au `GET`, il
        casserait l'écran de connexion, qui interroge cet endpoint à chaque
        visite pour savoir s'il doit rediriger. Le `GET` retombe donc sur le
        plancher global de `core.throttles` — ne jamais renvoyer une liste vide,
        ce serait retirer une limite au lieu d'en poser une.
        """
        if self.request.method == "POST":
            return [SignupRateThrottle()]
        return super().get_throttles()

    def get(self, request):
        """L'instance attend-elle encore d'être configurée ?

        Public, comme `signup-availability`, et pour la même raison : l'écran de
        connexion doit savoir **avant** d'afficher quoi que ce soit s'il faut
        rediriger vers la configuration. Il n'expose rien qu'un `POST` ne dirait
        déjà en 403.
        """
        return Response({"required": not User.objects.exists()})

    def post(self, request):
        with transaction.atomic():
            # ⚠️ Deux `POST` simultanés verraient tous deux zéro compte, et
            # créeraient deux administrateurs dans deux foyers différents — dont
            # un fantôme, invisible et impossible à rejoindre. Le verrou est
            # tenu jusqu'à la fin de la transaction : le second appelant attend,
            # puis lit un compte existant et se prend le 403.
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(%s)", [_SETUP_LOCK_KEY])

            if User.objects.exists():
                # 403 et jamais 401 : aucun identifiant n'ouvrira une
                # configuration déjà faite. Même raisonnement que le refus
                # d'inscription — DRF convertirait un refus de permission en 401
                # dès qu'un authenticator annonce `WWW-Authenticate`, ce qui
                # voudrait dire « identifie-toi et recommence » sur une porte
                # qui ne se rouvrira jamais.
                raise PermissionDenied(
                    _("This instance is already set up. Sign in instead.")
                )

            serializer = SetupSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data

            user = create_first_account(
                email=data["email"],
                password=data["password"],
                household_name=data.get("household_name") or DEFAULT_HOUSEHOLD,
                first_name=data.get("first_name") or "",
            )

        # Aucun jeton renvoyé : le front enchaîne sur son `login()` habituel, qui
        # pose les jetons, recharge `/me/` et applique la locale. Réémettre une
        # paire ici ferait deux définitions du chemin d'authentification, et
        # c'est toujours celle qu'on ne relit pas qui dérive.
        return Response(
            {"email": user.email, "household": user.active_household.name},
            status=status.HTTP_201_CREATED,
        )
