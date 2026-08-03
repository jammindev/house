"""Authentification par jeton d'appareil.

Un raccourci iOS ne peut pas emprunter la session du navigateur : il lui faut un
secret à lui. Ce module le reconnaît, sur un schéma d'en-tête **distinct du
Bearer JWT** (``Authorization: Device <secret>``) — deux mécanismes qui portent des
droits différents ne doivent pas se ressembler à la lecture.

⚠️ **Cette classe ne suffit pas à faire fonctionner un jeton.**
``ActiveHouseholdMiddleware`` s'exécute **avant** l'authentification DRF : sans son
pendant côté middleware, l'utilisateur serait authentifié au niveau de la vue mais
``request.household`` vaudrait déjà ``None``, et tout envoi répondrait « A valid
household context is required ». Les deux se posent ensemble, toujours.
"""
from rest_framework import authentication, exceptions

from .models import DeviceToken

#: Le mot-clé du schéma, en clair pour les deux points qui le lisent.
SCHEME = "Device"


def raw_token_from_request(request) -> str | None:
    """Le secret porté par l'en-tête, sans rien valider.

    Partagé avec le middleware — qui ne peut pas passer par DRF, puisqu'il tourne
    avant lui. Une seule définition du format, lue aux deux endroits.
    """
    header = request.META.get("HTTP_AUTHORIZATION", "")
    prefix = f"{SCHEME} "
    if not header.startswith(prefix):
        return None
    return header[len(prefix):].strip() or None


class DeviceTokenAuthentication(authentication.BaseAuthentication):
    """``Authorization: Device <secret>`` → l'utilisateur porteur du jeton."""

    keyword = SCHEME

    def authenticate(self, request):
        raw = raw_token_from_request(request)
        if raw is None:
            return None  # pas notre schéma : on laisse la main aux autres

        token = DeviceToken.resolve(raw)
        if token is None or not token.user.is_active:
            # Volontairement indistinct : un jeton inconnu, révoqué, ou dont le
            # compte est désactivé donnent la même réponse. Détailler renseignerait
            # celui qui essaie.
            raise exceptions.AuthenticationFailed("Invalid device token.")

        token.touch()
        return (token.user, token)

    def authenticate_header(self, request):
        return self.keyword
