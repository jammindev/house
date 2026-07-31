"""Les garanties de configuration de production, tenues par un test.

Le durcissement de ce dépôt était **déjà largement en place** avant le parcours
28 : `DEBUG` en dur, `ALLOWED_HOSTS` sans défaut, cookies `Secure`, HSTS d'un an,
throttling sur l'authentification. Ce fichier n'ajoute donc pas de protection —
il empêche qu'elles disparaissent.

Pourquoi c'est nécessaire alors que le code est juste : une valeur de sécurité se
désactive d'une seule ligne, souvent pour une bonne raison locale (« juste pour
déboguer ce soir »), et rien ne la rallume. Ce sont des réglages dont l'absence
ne se voit **jamais** à l'usage — l'app marche exactement pareil sans HSTS, sans
cookie `Secure` et sans throttle. Le jour où ça se remarque, c'est trop tard.

Le dépôt étant public, ces réglages sont aussi ce qu'un lecteur peut inspecter
avant de tenter quoi que ce soit contre une instance.
"""
import importlib

import pytest


@pytest.fixture(scope="module")
def production_settings():
    """Charge le module de settings de production sans l'activer.

    On l'importe directement plutôt que de le rendre actif : l'activer
    exigerait un `.env` complet et transformerait un test de configuration en
    test d'environnement.
    """
    import os

    os.environ.setdefault("SECRET_KEY", "test-only-not-a-real-secret")
    os.environ.setdefault("ALLOWED_HOSTS", "example.test")
    os.environ.setdefault(
        "DATABASE_URL", "postgres://user:pass@localhost:5432/placeholder"
    )
    # Le module refuse de se charger sans celle-ci — un durcissement à part
    # entière, vérifié par `TestTheModuleRefusesAnIncompleteEnvironment`.
    os.environ.setdefault("CORS_ALLOWED_ORIGINS", "https://example.test")
    return importlib.import_module("config.settings.production")


class TestDebugCannotBeTurnedOnInProduction:
    """`DEBUG` en production expose les tracebacks, les settings et les requêtes."""

    def test_debug_is_hardcoded_off(self, production_settings):
        assert production_settings.DEBUG is False

    def test_debug_is_not_readable_from_the_environment(self):
        """Le point important : ce n'est pas une valeur par défaut.

        `DEBUG = env.bool("DEBUG", default=False)` aurait la même tête et
        laisserait une variable d'environnement rallumer le mode debug en
        production. Ici c'est une constante — il faut éditer le fichier.
        """
        from pathlib import Path

        source = Path("config/settings/production.py").read_text(encoding="utf-8")
        assert "DEBUG = False" in source, (
            "DEBUG doit rester une constante dans production.py, jamais une "
            "valeur lue de l'environnement."
        )


class TestTheModuleRefusesAnIncompleteEnvironment:
    """Un réglage de sécurité manquant doit empêcher le démarrage, pas se deviner.

    `config/settings/production.py` lève sur `CORS_ALLOWED_ORIGINS` absent. C'est
    le bon comportement et il mérite d'être figé : la tentation, un jour de
    déploiement qui coince, est de lui donner une valeur par défaut permissive.
    Un serveur qui refuse de démarrer se remarque en trente secondes ; un
    serveur qui accepte toutes les origines ne se remarque jamais.
    """

    def test_missing_cors_origins_raises_at_import(self):
        from pathlib import Path

        source = Path("config/settings/production.py").read_text(encoding="utf-8")
        assert "CORS_ALLOWED_ORIGINS must be set in production" in source, (
            "La garde sur CORS_ALLOWED_ORIGINS a disparu : une origine par "
            "défaut permissive ne se voit pas à l'usage."
        )


class TestTheHostsAreDeclared:
    def test_allowed_hosts_has_no_default(self):
        """Sans `ALLOWED_HOSTS`, le démarrage doit échouer, pas passer en `*`.

        Un `*` accepte n'importe quel `Host:` et ouvre l'empoisonnement de
        cache et les liens de réinitialisation forgés. Échouer au démarrage est
        bruyant ; accepter tout est silencieux.
        """
        from pathlib import Path

        source = Path("config/settings/production.py").read_text(encoding="utf-8")
        assert 'ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")' in source, (
            "ALLOWED_HOSTS ne doit pas avoir de valeur par défaut."
        )
        assert '"*"' not in source.split("ALLOWED_HOSTS")[1][:200]


class TestTheTransportIsProtected:
    def test_cookies_are_secure_by_default(self, production_settings):
        assert production_settings.SESSION_COOKIE_SECURE is True
        assert production_settings.CSRF_COOKIE_SECURE is True

    def test_https_is_enforced(self, production_settings):
        assert production_settings.SECURE_SSL_REDIRECT is True

    def test_health_stays_reachable_without_https(self, production_settings):
        """`/health/` est la sonde du deploy : une redirection la casserait."""
        assert any(
            "health" in pattern for pattern in production_settings.SECURE_REDIRECT_EXEMPT
        )

    def test_hsts_is_at_least_a_year(self, production_settings):
        assert production_settings.SECURE_HSTS_SECONDS >= 31536000

    def test_content_type_sniffing_is_off(self, production_settings):
        """Sur une app qui sert des fichiers de l'utilisateur, le sniffing
        transforme un fichier téléversé en script exécuté par le navigateur."""
        assert production_settings.SECURE_CONTENT_TYPE_NOSNIFF is True


class TestTheSensitiveEndpointsAreThrottled:
    """Un mot de passe se devine, sauf si on ne peut essayer que cinq fois."""

    REQUIRED_SCOPES = {
        "login_ip",
        "login_email",
        "change_password",
        "password_reset",
        "invitation_join",
    }

    def test_every_sensitive_scope_has_a_rate(self, settings):
        rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        missing = self.REQUIRED_SCOPES - set(rates)
        assert not missing, f"Portées de throttle disparues : {sorted(missing)}"

    def test_login_is_throttled_per_email_not_only_per_ip(self, settings):
        """Le throttle par IP seul ne protège pas d'un attaquant distribué.

        C'est le throttle **par email** qui borne les tentatives sur un compte
        donné, quelle que soit l'origine.
        """
        rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        attempts, _, period = rates["login_email"].partition("/")
        assert int(attempts) <= 10, (
            f"login_email autorise {attempts} essais par {period} : trop pour "
            "borner une attaque par dictionnaire."
        )

    def test_the_login_view_actually_uses_them(self):
        """Une portée déclarée mais jamais branchée ne protège rien."""
        from accounts.views.api import AuthViewSet

        source = __import__("inspect").getsource(AuthViewSet)
        assert "LoginIPRateThrottle" in source
        assert "LoginEmailRateThrottle" in source


class TestClickjackingIsBlocked:
    def test_the_middleware_is_installed(self, settings):
        assert (
            "django.middleware.clickjacking.XFrameOptionsMiddleware"
            in settings.MIDDLEWARE
        )

    def test_framing_is_denied(self, settings):
        """Django vaut « DENY » par défaut ; ce test le fige.

        Passer à `SAMEORIGIN` « pour un widget » suffirait à rouvrir le
        détournement de clic sur toute l'app.
        """
        assert getattr(settings, "X_FRAME_OPTIONS", "DENY") == "DENY"
