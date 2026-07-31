"""Les réglages d'une instance auto-hébergée, et leur seul bouton.

``config/settings/selfhost.py`` répond à une question que ``production.py`` n'a
jamais eu à se poser : que faire quand **personne n'a rien configuré**. Ses
défauts sont donc du code que personne ne relit — ils s'appliquent chez des gens
qu'on ne connaît pas, sur des machines qu'on ne voit pas.

Deux propriétés méritent d'être figées, et ce sont les deux qui ne se voient
jamais à l'usage :

1. **la liste d'hôtes se resserre quand l'exposition s'élargit** — un
   ``ALLOWED_HOSTS`` permissif sur un réseau local est un choix, le même sur une
   instance publique est un défaut ;
2. **le durcissement vient de ``production.py``, jamais d'une copie** — le jour
   où les deux divergent, aucun des deux ne fait plus autorité.
"""
import importlib
import os

import pytest


@pytest.fixture
def clean_environ():
    """Le module écrit dans ``os.environ`` à l'import — il faut le rembobiner.

    ``monkeypatch`` ne suffit pas : le module pose des clés **nouvelles** par
    ``setdefault``, dont monkeypatch n'a pas gardé trace. Sans cette restauration,
    le premier test qui importe le module léguerait son ``ALLOWED_HOSTS=*`` à
    toute la session.
    """
    snapshot = dict(os.environ)
    yield os.environ
    os.environ.clear()
    os.environ.update(snapshot)


def _load(environ, tmp_path, **overrides):
    """Charge le module de réglages avec un environnement donné.

    ``importlib.reload`` seul ne suffit pas, et le piège vaut d'être nommé :
    recharger ``selfhost`` ré-exécute son ``from .production import *``, mais
    ``production`` reste **en cache** et n'est pas ré-évalué. On relirait donc
    les valeurs du tout premier import, c'est-à-dire un test qui passe en
    vérifiant l'environnement d'un autre. Les deux modules sortent du cache.
    """
    import sys
    for key in (
        "SECRET_KEY",
        "ALLOWED_HOSTS",
        "CORS_ALLOWED_ORIGINS",
        "CSRF_TRUSTED_ORIGINS",
        "DATABASE_URL",
        "FRONTEND_URL",
        "MAISONNEE_PUBLIC_URL",
        "SESSION_COOKIE_SECURE",
        "CSRF_COOKIE_SECURE",
        "SECURE_SSL_REDIRECT",
        "SECURE_HSTS_SECONDS",
        "EMAIL_BACKEND",
    ):
        environ.pop(key, None)
    environ["MAISONNEE_STATE_DIR"] = str(tmp_path)
    environ.update(overrides)

    sys.modules.pop("config.settings.selfhost", None)
    sys.modules.pop("config.settings.production", None)
    return importlib.import_module("config.settings.selfhost")


class TestNothingHasToBeConfigured:
    """Le critère du lot : une VM nue, trois lignes, aucun fichier édité."""

    def test_it_loads_with_an_empty_environment(self, clean_environ, tmp_path):
        settings = _load(clean_environ, tmp_path)

        assert settings.SECRET_KEY
        assert settings.DATABASES["default"]["NAME"]
        assert settings.DEBUG is False

    def test_the_secret_key_survives_a_restart(self, clean_environ, tmp_path):
        """Trois conteneurs lisent la même clé, et elle vit plus longtemps qu'eux.

        Une clé volatile par conteneur marcherait à l'écran — la connexion
        réussit — et déconnecterait tout le monde au premier redémarrage sans
        qu'une ligne ne dise pourquoi.
        """
        first = _load(clean_environ, tmp_path).SECRET_KEY
        second = _load(clean_environ, tmp_path).SECRET_KEY

        assert first == second
        assert (tmp_path / "secret_key").exists()

    def test_an_unwritable_state_directory_is_fatal(self, clean_environ, tmp_path):
        """Échouer bruyamment plutôt que de fabriquer une clé jetable."""
        from django.core.exceptions import ImproperlyConfigured

        unwritable = tmp_path / "nope"
        unwritable.write_text("je suis un fichier, pas un dossier")

        with pytest.raises(ImproperlyConfigured):
            _load(clean_environ, unwritable / "state")

    def test_a_provided_secret_key_wins(self, clean_environ, tmp_path):
        settings = _load(clean_environ, tmp_path, SECRET_KEY="fourni-par-l-hebergeur")

        assert settings.SECRET_KEY == "fourni-par-l-hebergeur"
        assert not (tmp_path / "secret_key").exists()


class TestTheHostListNarrowsAsExposureWidens:
    """La propriété centrale du fichier, et la seule qui protège quelqu'un."""

    def test_without_a_public_url_any_host_is_accepted(self, clean_environ, tmp_path):
        settings = _load(clean_environ, tmp_path)

        assert "*" in settings.ALLOWED_HOSTS
        # Sur une boîte de réseau local, servie en clair : marquer les cookies
        # `Secure` les ferait jeter par le navigateur, donc personne ne pourrait
        # se connecter.
        assert settings.SESSION_COOKIE_SECURE is False
        assert settings.SECURE_HSTS_SECONDS == 0

    def test_declaring_a_public_url_locks_the_host_down(self, clean_environ, tmp_path):
        settings = _load(
            clean_environ, tmp_path, MAISONNEE_PUBLIC_URL="https://maison.exemple.fr"
        )

        assert "*" not in settings.ALLOWED_HOSTS
        assert "maison.exemple.fr" in settings.ALLOWED_HOSTS
        assert settings.SESSION_COOKIE_SECURE is True
        assert settings.CSRF_COOKIE_SECURE is True
        assert settings.SECURE_HSTS_SECONDS >= 31536000
        assert settings.CSRF_TRUSTED_ORIGINS == ["https://maison.exemple.fr"]
        assert settings.FRONTEND_URL == "https://maison.exemple.fr"

    def test_the_container_can_always_probe_itself(self, clean_environ, tmp_path):
        """Sinon la sonde de vie se heurte à un 400 et le conteneur est déclaré
        malade à perpétuité — sur une instance parfaitement saine."""
        settings = _load(
            clean_environ, tmp_path, MAISONNEE_PUBLIC_URL="https://maison.exemple.fr"
        )

        assert "127.0.0.1" in settings.ALLOWED_HOSTS
        assert "localhost" in settings.ALLOWED_HOSTS


class TestItNeverRedirectsToHttpsItself:
    """Le piège classique de l'auto-hébergement, et il ne se voit que chez l'hôte.

    Un proxy qui omet ``X-Forwarded-Proto`` fait croire à Django que la requête
    est en clair ; Django renvoie vers ``https://`` ; le proxy repasse la requête
    sans le header. Le navigateur tourne jusqu'à l'erreur, et l'utilisateur en
    conclut que l'application est cassée.
    """

    def test_the_redirect_is_left_to_the_proxy(self, clean_environ, tmp_path):
        for env in ({}, {"MAISONNEE_PUBLIC_URL": "https://maison.exemple.fr"}):
            settings = _load(clean_environ, tmp_path, **env)
            assert settings.SECURE_SSL_REDIRECT is False


class TestTheHardeningIsInheritedNotCopied:
    def test_it_imports_production_rather_than_redeclaring_it(self):
        """Deux textes qui divergent font perdre leur crédit aux deux.

        ``test_production_settings.py`` ne surveille qu'un fichier ; il faut donc
        que ce soit celui que les deux déploiements utilisent réellement.
        """
        from pathlib import Path

        source = Path("config/settings/selfhost.py").read_text(encoding="utf-8")
        assert "from .production import *" in source

    def test_the_inherited_hardening_is_actually_present(self, clean_environ, tmp_path):
        settings = _load(clean_environ, tmp_path)

        assert settings.SECURE_CONTENT_TYPE_NOSNIFF is True
        assert settings.SECURE_REFERRER_POLICY == "same-origin"
        assert "login_email" in settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]


class TestFilesAreServedByDjangoWhenThereIsNoNginx:
    def test_the_accel_mechanism_is_off(self, clean_environ, tmp_path):
        """La pile auto-hébergée n'a pas de Nginx à qui déléguer.

        Laisser ce mécanisme actif renverrait au navigateur une réponse vide
        portant un en-tête que personne n'interprète : une image cassée, sans
        une ligne d'erreur nulle part.
        """
        settings = _load(clean_environ, tmp_path)

        assert settings.PROTECTED_MEDIA_ACCEL is False
