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

⚠️ **Un préfixe déclaré dit ce que le code écrit, jamais ce que le foyer
possède.** La règle 1, appliquée aux seuls préfixes que
``Document.build_upload_path`` produit *aujourd'hui*, a fermé l'accès aux
documents rangés sous ``<foyer>/<dossier>/…`` — une disposition que plus aucune
ligne n'écrit mais que la base porte toujours. En production, 177 documents sur
202 sont devenus invisibles d'un coup, vignettes comprises, et rien dans les
tests ne pouvait le voir : ils fabriquaient leurs fixtures avec le builder,
c'est-à-dire dans la seule disposition qui marchait encore (issue #517).

D'où la troisième règle, qui est la forme durable des deux premières :

3. **Un fichier se rattache à un foyer en base, pas par la forme de son
   chemin.** Ce qu'aucun document ne réclame reste refusé — le default-deny est
   intact —, mais ce qu'un document réclame est contrôlé sur *son* foyer et
   *sa* confidentialité, quelle que soit la disposition sous laquelle il a été
   écrit. Un schéma de nommage change ; l'appartenance, non.
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


def _document_at(path: str, **filters) -> Document | None:
    """Le document dont ``path`` est le fichier — ou sa vignette.

    La vignette vit à un autre chemin que l'original ; ``source_path_prefix``
    est l'inverse exact de la fonction qui l'a produit, et rend ``None`` sur un
    chemin qui n'en est pas une. C'est le **seul** endroit où l'on traduit un
    chemin en document, pour que les deux portes ci-dessous ne se mettent pas à
    répondre différemment sur le même fichier.
    """
    prefix = source_path_prefix(path)
    if prefix is not None:
        return Document.objects.filter(file_path__startswith=prefix, **filters).first()
    return Document.objects.filter(file_path=path, **filters).first()


def _is_readable_by(document: Document, user) -> bool:
    """Un document privé n'appartient qu'à qui l'a déposé."""
    return not document.is_private or document.created_by_id == user.id


def _check_document(user, path: str) -> int | None:
    """``None`` si l'accès est permis, sinon le code HTTP à renvoyer."""
    parts = path.split("/")
    household_id = parts[1] if len(parts) >= 2 else ""
    if not household_id:
        raise Http404
    if not _is_member(user, household_id):
        return FORBIDDEN

    # Confidentialité — sur l'original comme sur sa vignette.
    document = (
        _document_at(path, household_id=household_id)
        if source_path_prefix(path) is not None
        else _document_at(path)
    )

    if document is None:
        # Chemin sous `documents/<foyer>/` sans document en base : orphelin de
        # stockage. L'appartenance au foyer a été vérifiée, on laisse servir —
        # refuser casserait les fichiers importés hors du modèle.
        return None

    return None if _is_readable_by(document, user) else FORBIDDEN


def _check_by_ownership(user, path: str) -> int | None:
    """Le contrôle de dernier recours — voir la règle 3 en tête de module.

    Aucune hypothèse sur la forme du chemin : on demande à la base **quel
    document réclame ce fichier**, et on contrôle sur le foyer de ce
    document-là. C'est ce qui rend le service indifférent à la disposition de
    stockage, présente comme passée.

    La différence avec ``_check_document`` tient en une ligne, et c'est la plus
    importante : ici, **un fichier que personne ne réclame est refusé**. Là-bas
    l'orphelin est servi, parce que l'appartenance au foyer était déjà établie
    par le chemin lui-même ; ici on ne sait rien du chemin, donc l'absence de
    document n'est pas un détail de stockage — c'est un fichier non attribuable.
    """
    document = _document_at(path)
    if document is None:
        return FORBIDDEN
    if not _is_member(user, document.household_id):
        return FORBIDDEN
    return None if _is_readable_by(document, user) else FORBIDDEN


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
# ligne ici : sans elle, le chemin doit se faire reconnaître en base
# (`_check_by_ownership`) ou il est refusé — ce qui reste le bon défaut.
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
    # Un préfixe déclaré porte son propre contrôle ; tout le reste doit se faire
    # reconnaître par un document en base, sinon c'est 403 (règles 1 et 3).
    check = _CHECKS.get(prefix, _check_by_ownership)

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
