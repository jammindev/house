"""Permissions propres aux comptes."""
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from rest_framework.permissions import BasePermission


class OpenSignupAllowed(BasePermission):
    """Autorise la création d'un compte **si l'instance l'a laissée ouverte**.

    Remplace `AllowAny` sur `POST /api/accounts/users/`. Deux publics, un seul
    code : l'auto-hébergeur qui vient de lancer `docker compose up` doit pouvoir
    créer son premier compte sans lire un guide ; l'instance déjà en service et
    joignable depuis Internet ne doit pas laisser un inconnu s'en créer un.
    C'est un **choix d'exploitation**, pas une capacité manquante — d'où un 403
    nommé et non le 503 de `capabilities.require`, qui dit « il manque une clé ».

    Refuser explicitement plutôt que masquer la route : un endpoint qui répond
    404 laisserait croire à un bug de version, et le prochain à le lire serait
    l'auteur, six mois plus tard.
    """

    message = _("Open registration is disabled on this instance.")

    def has_permission(self, request, view):
        return bool(getattr(settings, "ALLOW_OPEN_SIGNUP", True))
