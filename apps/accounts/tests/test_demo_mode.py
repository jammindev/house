# accounts/tests/test_demo_mode.py
"""Le mode démonstration s'annonce, et il est éteint partout ailleurs.

Ce réglage n'existe que pour l'instance publique remplie qui sert de vitrine. Le
code part pourtant dans **toutes** les images distribuées, donc ce qui compte
autant que son fonctionnement, c'est son silence : un auto-hébergeur qui ne pose
rien ne doit voir aucune trace de tout ceci.

Le mot de passe voyage en clair dans une réponse publique. C'est assumé — il est
déjà publié dans un dépôt public, sur un foyer de fausses données remis à zéro
chaque nuit. Ce qui ne l'est pas, et que ces tests protègent, c'est l'idée d'un
chemin d'authentification **sans identifiants** : l'écran pré-remplit un
formulaire, il ne contourne pas la connexion.
"""
from __future__ import annotations

import pytest
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User

SETUP_URL = "/api/accounts/setup/"


@pytest.fixture
def client(db):
    User.objects.create_user(email="someone@example.com", password="already-installed-x9")
    return APIClient()


@pytest.mark.django_db
class TestAnOrdinaryInstanceSaysNothing:
    def test_the_payload_carries_no_demo_block_by_default(self, client):
        response = client.get(SETUP_URL)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["demo"] is None

    @override_settings(DEMO_MODE=False, DEMO_EMAIL="claire@demo.local", DEMO_PASSWORD="demo1234")
    def test_credentials_alone_do_not_turn_it_on(self, client):
        """Le drapeau décide, jamais la présence des identifiants.

        Sans ça, un `.env` recopié depuis la démonstration transformerait une
        instance réelle en vitrine, avec un compte dont tout le monde a la clé.
        """
        assert client.get(SETUP_URL).json()["demo"] is None

    @override_settings(DEMO_MODE=True, DEMO_EMAIL="claire@demo.local", DEMO_PASSWORD="")
    def test_half_a_configuration_counts_as_unavailable(self, client):
        """Même défaut sûr que les capacités optionnelles : l'inconnu vaut absent.

        Une bannière annonçant une démonstration au-dessus d'un formulaire à
        moitié rempli promet ce que le premier clic dément.
        """
        assert client.get(SETUP_URL).json()["demo"] is None


@pytest.mark.django_db
class TestTheDemoInstanceAnnouncesItself:
    @override_settings(DEMO_MODE=True, DEMO_EMAIL="claire@demo.local", DEMO_PASSWORD="demo1234")
    def test_it_serves_the_published_credentials(self, client):
        response = client.get(SETUP_URL)

        assert response.json()["demo"] == {
            "email": "claire@demo.local",
            "password": "demo1234",
        }

    @override_settings(DEMO_MODE=True, DEMO_EMAIL="claire@demo.local", DEMO_PASSWORD="demo1234")
    def test_it_stays_readable_without_a_token(self, client):
        """L'écran de connexion interroge cet endpoint **avant** toute session.

        Le rendre authentifié le rendrait inutile : la seule page qui en a besoin
        est la seule qu'on voit sans compte.
        """
        response = APIClient().get(SETUP_URL)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["demo"] is not None

    @override_settings(DEMO_MODE=True, DEMO_EMAIL="claire@demo.local", DEMO_PASSWORD="demo1234")
    def test_it_does_not_disturb_what_the_endpoint_already_answered(self, client):
        """`required` reste le contrat d'origine : le bloc démo est additionnel."""
        assert client.get(SETUP_URL).json()["required"] is False
