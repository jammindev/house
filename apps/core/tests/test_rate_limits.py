"""Ce qu'un compte peut coûter à l'instance — les régressions du durcissement.

Le dépôt est public depuis le 2025-09-21 et l'inscription était ouverte au
niveau de l'API : `POST /api/accounts/users/` acceptait n'importe qui, sans cap
de débit et sans validation de mot de passe. Chaque compte né là pouvait ensuite
acheter des embeddings (une écriture d'entité = un appel fournisseur) et de
l'OCR (un envoi de document = un appel de vision), sur la clé de l'instance.

Les tests ci-dessous portent chacun le nom du défaut qu'ils empêchent.
"""
import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.introspection import dotted as _dotted
from core.introspection import registered_api_views as _registered_api_views

User = get_user_model()

# Un mot de passe qui passe les quatre validateurs de `AUTH_PASSWORD_VALIDATORS`.
STRONG_PASSWORD = "Corr3ct-Horse-Battery"


def _project_throttle_classes():
    """Toutes les classes de throttle **définies par le projet**.

    Passe par les modules `<app>.throttles` puis par l'arbre des sous-classes,
    plutôt que par une liste écrite à la main qui aurait dérivé au premier ajout.
    Les classes de DRF elles-mêmes sont exclues : `UserRateThrottle` porte la
    portée `user`, qu'on ne tarife pas (le plancher a ses propres portées).
    """
    import importlib

    from django.apps import apps as django_apps
    from rest_framework.throttling import SimpleRateThrottle

    project_roots = set()
    for config in django_apps.get_app_configs():
        root = config.name.split(".")[0]
        project_roots.add(root)
        try:
            importlib.import_module(f"{config.name}.throttles")
        except ModuleNotFoundError:
            continue
    project_roots.discard("rest_framework")
    project_roots.discard("django")

    found = set()

    def walk(cls):
        for sub in cls.__subclasses__():
            found.add(sub)
            walk(sub)

    walk(SimpleRateThrottle)
    return {c for c in found if c.__module__.split(".")[0] in project_roots}


@pytest.fixture
def client():
    return APIClient()


class TestNoEndpointIsUnbounded:
    """Aucune vue de l'API ne sert sans plafond de débit.

    Avant le durcissement, `DEFAULT_THROTTLE_CLASSES` n'était pas posé : les
    limites étaient déclarées **vue par vue** (agent, connexion, recherche,
    mot de passe) et tout le reste — l'écrasante majorité des endpoints —
    n'en avait aucune. Le défaut ne se lit pas en revue, parce que le diff
    d'une vue bornée et celui d'une vue nue sont identiques ; c'est la vue
    nue qu'on écrit sans y penser.

    Même mécanique que `test_tenant_isolation` : on parcourt le **routeur
    réel**, et on lui emprunte sa découverte plutôt que d'en écrire une
    seconde qui dériverait.
    """

    def test_the_discovery_still_finds_the_router(self):
        # Garde-fou identique à celui du scoping : si un renommage d'URL
        # cassait le parcours, les tests suivants passeraient en ne vérifiant
        # rien — et un contrôle qui ne contrôle plus ressemble exactement à une
        # absence d'écart.
        views = _registered_api_views()
        assert len(views) > 50, (
            f"Seulement {len(views)} vues découvertes sous /api/ — la découverte "
            "est cassée, pas l'API."
        )

    def test_every_api_view_carries_at_least_one_throttle(self):
        offenders = [
            _dotted(cls)
            for cls in _registered_api_views()
            if not getattr(cls, "throttle_classes", None)
        ]
        assert not offenders, (
            "Ces vues servent sans plafond de débit : "
            f"{', '.join(sorted(offenders))}. Un `throttle_classes = []` explicite "
            "retire le plancher global — si c'est voulu, il faut le justifier ici."
        )

    def test_every_declared_throttle_has_a_rate(self):
        """Une portée sans tarif **n'a aucune limite**, et le dit à personne.

        `SimpleRateThrottle.get_rate()` lève `ImproperlyConfigured` quand sa
        portée manque de `DEFAULT_THROTTLE_RATES` — mais à la **première
        requête**, donc en production. Ajouter une classe de throttle en
        oubliant son tarif est le genre d'écart qui se livre vert.

        ⚠️ **Le balayage porte sur les classes du projet, pas sur
        `cls.throttle_classes`.** La première version de ce test lisait
        l'attribut de classe des vues — et ne voyait donc *aucun* des throttles
        posés par un `get_throttles()` par action (`upload`, `reprocess_ocr`,
        `create`), qui sont précisément ceux qu'on vient d'ajouter. Retirer le
        tarif de `document_upload` le laissait vert. Vérifié par sabotage, comme
        au #487.
        """
        for throttle_cls in _project_throttle_classes():
            throttle = throttle_cls()  # lève si la portée n'a pas de tarif
            assert getattr(throttle, "rate", None), (
                f"{throttle_cls.__module__}.{throttle_cls.__name__} déclare la "
                f"portée '{throttle_cls.scope}' sans tarif dans "
                "DEFAULT_THROTTLE_RATES."
            )

    def test_the_throttle_discovery_finds_them_all(self):
        # Même garde-fou que pour le routeur : une découverte cassée rendrait le
        # test ci-dessus vert en n'inspectant rien.
        found = {c.__name__ for c in _project_throttle_classes()}
        for expected in (
            "GlobalUserBurstThrottle",
            "SignupRateThrottle",
            "DocumentUploadThrottle",
            "AgentBurstRateThrottle",
        ):
            assert expected in found, (
                f"{expected} introuvable — la découverte des throttles ne "
                f"balaye plus tout le projet (trouvé : {sorted(found)})."
            )


@pytest.mark.django_db
class TestAWeakPasswordNeverBecomesAnAccount:
    """`abc` était un mot de passe valide à l'inscription, en production.

    `set_password` hache n'importe quoi : sans appel explicite à
    `validate_password`, `AUTH_PASSWORD_VALIDATORS` n'était consulté nulle part
    sur ce chemin. L'app était donc **plus stricte sur un changement de mot de
    passe que sur la création du premier** — le contraire de ce qu'il faut.
    """

    def test_a_short_password_is_refused(self, client):
        response = client.post(
            reverse("user-list"),
            {"email": "short@example.com", "password": "abc"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.data

    def test_a_common_password_is_refused(self, client):
        response = client.post(
            reverse("user-list"),
            {"email": "common@example.com", "password": "password123"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.data

    def test_a_refused_password_leaves_no_account_behind(self, client):
        client.post(
            reverse("user-list"),
            {"email": "ghost@example.com", "password": "abc"},
        )
        assert not User.objects.filter(email="ghost@example.com").exists()

    def test_a_strong_password_still_creates_the_account(self, client):
        response = client.post(
            reverse("user-list"),
            {"email": "solid@example.com", "password": STRONG_PASSWORD},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert "password" not in response.data


@pytest.mark.django_db
class TestTheSignupDoorIsCappedPerAddress:
    """Créer un compte est le seul geste anonyme qui **écrit**.

    Sans cap, un dépôt public suffit à savoir où pointer une boucle, et chaque
    compte né là peut ensuite dépenser la clé de l'instance.
    """

    def test_the_sixth_account_from_one_address_is_refused(self, client):
        url = reverse("user-list")
        for i in range(5):
            response = client.post(
                url, {"email": f"early{i}@example.com", "password": STRONG_PASSWORD}
            )
            assert response.status_code == status.HTTP_201_CREATED, response.data

        response = client.post(
            url, {"email": "late@example.com", "password": STRONG_PASSWORD}
        )
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert not User.objects.filter(email="late@example.com").exists()


@pytest.mark.django_db
class TestRegistrationCanBeClosedWithoutForkingTheCode:
    """Deux publics, un seul code.

    L'auto-hébergeur qui vient de lancer `docker compose up` doit pouvoir créer
    son premier compte sans lire un guide ; l'instance déjà en service et
    joignable depuis Internet ne doit pas laisser un inconnu s'en créer un. Le
    `.env` tranche, pas un fork.
    """

    def test_open_by_default(self, client):
        response = client.get(reverse("accounts-signup-availability"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"open": True}

    @override_settings(ALLOW_OPEN_SIGNUP=False)
    def test_a_closed_instance_refuses_the_creation(self, client):
        response = client.post(
            reverse("user-list"),
            {"email": "stranger@example.com", "password": STRONG_PASSWORD},
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not User.objects.filter(email="stranger@example.com").exists()

    @override_settings(ALLOW_OPEN_SIGNUP=False)
    def test_a_closed_instance_says_so_before_being_asked(self, client):
        """L'écran de connexion doit pouvoir ne pas promettre.

        C'est la leçon du lot 3 du parcours 28 : une capacité indisponible se
        déclare, elle ne se découvre pas au clic. Sans cet endpoint public, le
        bouton « créer un compte » mènerait à un 403 — donc l'interface
        promettrait, et l'utilisateur en conclurait que le produit est cassé
        plutôt que fermé.
        """
        response = client.get(reverse("accounts-signup-availability"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"open": False}
