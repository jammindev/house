"""`/accounts/me/` est le contrat d'identité du SPA — et il se construit à la main.

C'est un dict littéral, pas `UserSerializer` : rien ne le rattache au modèle, donc
rien ne signale qu'un champ manque. Le front, lui, déclare ce qu'il attend dans
`AuthUser` (`ui/src/lib/auth/authContext.ts`) et lit ces clés sans les vérifier —
une clé absente arrive `undefined`, ce qui en TypeScript n'est ni une erreur de
compilation ni une erreur au runtime, juste un repli silencieux.

C'est exactement ce qui a produit #546 : le header lisait `full_name`, que
l'endpoint ne servait pas, et retombait sur l'email pour tout le monde.
"""
import re
from pathlib import Path

import pytest
from django.urls import reverse

REPO_ROOT = Path(__file__).resolve().parents[3]
AUTH_CONTEXT = REPO_ROOT / "ui" / "src" / "lib" / "auth" / "authContext.ts"


def _required_authuser_fields() -> set[str]:
    """Les champs que le front déclare non-optionnels dans `AuthUser`.

    Les champs marqués `?` sont tolérés absents par construction — le reste,
    non : le front les lit comme s'ils étaient toujours là.
    """
    source = AUTH_CONTEXT.read_text(encoding="utf-8")
    body = re.search(r"interface AuthUser \{(.*?)\n\}", source, re.S)
    assert body, "l'interface AuthUser a bougé — ce test doit suivre"
    return set(re.findall(r"^\s{2}(\w+):", body.group(1), re.M))


@pytest.mark.django_db
class TestTheMeEndpointServesWhatTheFrontendDeclares:
    def test_full_name_is_served(self, authenticated_client, user):
        """Régression #546 — le nom d'affichage canonique traverse l'endpoint."""
        user.display_name = "Benjamin"
        user.save(update_fields=["display_name"])

        payload = authenticated_client.get(reverse("accounts-me")).json()

        assert payload["full_name"] == "Benjamin"

    def test_full_name_falls_back_to_the_email_only_when_there_is_no_name(
        self, authenticated_client, user
    ):
        """Le repli reste celui du modèle — il ne se recompose pas au front."""
        user.display_name = ""
        user.first_name = ""
        user.last_name = ""
        user.save(update_fields=["display_name", "first_name", "last_name"])

        payload = authenticated_client.get(reverse("accounts-me")).json()

        assert payload["full_name"] == user.email

    def test_every_required_authuser_field_is_served(self, authenticated_client):
        """Le dict écrit à la main ne peut pas prendre de retard sur `AuthUser`."""
        payload = authenticated_client.get(reverse("accounts-me")).json()

        missing = _required_authuser_fields() - set(payload)

        assert not missing, (
            f"`/accounts/me/` ne sert pas {sorted(missing)}, que le front lit "
            "comme s'ils étaient toujours là (repli silencieux, cf. #546)."
        )
