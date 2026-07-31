"""Service de fichiers protégés, avec contrôle d'accès.

Django authentifie toujours la requête. Ce qui change, c'est **qui envoie les
octets** une fois l'accès accordé, et c'est réglé par ``PROTECTED_MEDIA_ACCEL`` :

- ``True`` (défaut, déploiement de l'auteur) — Django répond un en-tête
  ``X-Accel-Redirect`` et Nginx sert le fichier depuis un emplacement interne
  (``/_protected_media/``), sans occuper un worker gunicorn ;
- ``False`` — Django sert le fichier lui-même. C'est le cas du développement, et
  celui d'une **instance auto-hébergée** : la pile ``docker compose up`` tient en
  trois conteneurs et n'a pas de Nginx à qui déléguer.

⚠️ **Ce réglage se déclare, il ne se déduit pas de ``DEBUG``.** C'est ce qu'il
faisait, et le raccourci était faux dès qu'on sortait des deux seuls
déploiements connus : ``DEBUG=False`` sans Nginx en face — exactement la pile
auto-hébergée — renvoyait au navigateur une réponse **vide** portant un en-tête
que personne n'allait interpréter. Une image cassée sans une ligne d'erreur, et
un réglage de confidentialité qui décide d'un mécanisme de transport n'a aucune
raison de rester lisible six mois.

⚠️ **Cette vue est la seule porte du foyer qui ne passe ni par un viewset ni par
un queryset** : elle reçoit un chemin et rend des octets. Les cinquante-sept
viewsets peuvent tous filtrer parfaitement sans que ça protège un seul fichier.
D'où deux règles structurantes, tenues par
``apps/core/tests/test_media_isolation.py`` :

1. **Ce qui n'est pas explicitement autorisé est refusé.** Le dispatch ci-dessous
   ne connaît que des préfixes déclarés ; tout le reste tombe en 403. La version
   précédente ne contrôlait que ``documents/`` et laissait passer le reste, si
   bien qu'un préfixe ajouté plus tard (exports, sauvegardes, pièces jointes)
   aurait été public par défaut — sans une ligne de code pour le trahir.
2. **Un contrôle porte sur ce qu'on sert, pas sur ce qu'on croit servir.** La
   vignette d'un document privé est *le* document pour un scan ou une photo ;
   la faire échapper au contrôle rendait ``is_private`` décoratif.
"""
from urllib.parse import quote

from django.conf import settings
from django.core.exceptions import ValidationError
from django.http import HttpResponse, Http404

from documents.models import Document
from documents.thumbnails import source_path_prefix
from households.models import HouseholdMember

FORBIDDEN = 403
UNAUTHORIZED = 401


def _is_member(user, household_id) -> bool:
    if not household_id:
        return False
    try:
        return HouseholdMember.objects.filter(
            household_id=household_id, user=user
        ).exists()
    except (ValueError, ValidationError):
        # Un identifiant qui n'est pas un UUID n'est pas une erreur serveur :
        # c'est quelqu'un qui essaie un chemin.
        raise Http404


def _check_document(user, path: str) -> int | None:
    """``None`` si l'accès est permis, sinon le code HTTP à renvoyer."""
    parts = path.split("/")
    household_id = parts[1] if len(parts) >= 2 else ""
    if not household_id:
        raise Http404
    if not _is_member(user, household_id):
        return FORBIDDEN

    # Confidentialité — sur l'original comme sur sa vignette.
    prefix = source_path_prefix(path)
    if prefix is not None:
        document = Document.objects.filter(
            household_id=household_id, file_path__startswith=prefix
        ).first()
    else:
        document = Document.objects.filter(file_path=path).first()

    if document is None:
        # Chemin sous `documents/<foyer>/` sans document en base : orphelin de
        # stockage. L'appartenance au foyer a été vérifiée, on laisse servir —
        # refuser casserait les fichiers importés hors du modèle.
        return None

    if document.is_private and document.created_by_id != user.id:
        return FORBIDDEN
    return None


def _check_avatar(user, path: str) -> int | None:
    """Un avatar est la photo d'une personne, pas un fichier public.

    Règle retenue — la plus permissive qui reste vraie : on voit l'avatar de
    quelqu'un avec qui on partage un foyer, et le sien. Auparavant tout
    utilisateur authentifié voyait tous les avatars, ce qui donnait à un ancien
    membre un accès permanent.
    """
    parts = path.split("/")
    owner_id = parts[1] if len(parts) >= 2 else ""
    if not owner_id:
        raise Http404
    if str(owner_id) == str(user.pk):
        return None
    try:
        shares_household = HouseholdMember.objects.filter(
            user_id=owner_id,
            household_id__in=HouseholdMember.objects.filter(user=user).values(
                "household_id"
            ),
        ).exists()
    except (ValueError, ValidationError):
        raise Http404
    return None if shares_household else FORBIDDEN


# Préfixe → contrôleur. Ajouter un emplacement de fichiers, c'est ajouter sa
# ligne ici : sans elle il est refusé, ce qui est le bon défaut.
_CHECKS = {
    "documents": _check_document,
    "avatars": _check_avatar,
}


def serve_protected_media(request, path):
    if not request.user.is_authenticated:
        return HttpResponse(status=UNAUTHORIZED)

    # Aucune remontée d'arborescence, aucun chemin absolu.
    if ".." in path.split("/") or path.startswith("/"):
        raise Http404

    prefix = path.split("/", 1)[0]
    check = _CHECKS.get(prefix)
    if check is None:
        # Default-deny : voir la règle 1 en tête de module.
        return HttpResponse(status=FORBIDDEN)

    denied = check(request.user, path)
    if denied is not None:
        return HttpResponse(status=denied)

    if not settings.PROTECTED_MEDIA_ACCEL:
        from django.views.static import serve as static_serve

        return static_serve(request, path, document_root=settings.MEDIA_ROOT)

    response = HttpResponse()
    # Le chemin doit être encodé : WSGI sérialise les en-têtes en latin-1, donc
    # un nom de fichier non-ASCII (« carte-identité.pdf ») partirait avec les
    # mauvais octets et Nginx renverrait 404. quote() garde « / » comme
    # séparateur et encode le reste en UTF-8, que Nginx redécode.
    response["X-Accel-Redirect"] = "/_protected_media/" + quote(path)
    response["Content-Type"] = ""  # Nginx déduit le type de l'extension
    return response
