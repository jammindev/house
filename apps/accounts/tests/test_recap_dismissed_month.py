"""Fermer le teaser du récap est un fait de l'utilisateur, pas de son onglet.

Le drapeau « vu » vivait en `sessionStorage` (`RecapTeaserCard.tsx`), et le choix
était assumé en commentaire : « the card reappears in another browser ». L'usage
l'a démenti deux fois plutôt qu'une — la carte revenait sur le téléphone après
avoir été fermée sur le poste fixe, mais aussi, sur le **même** appareil, dès
qu'un onglet neuf était ouvert. Un geste qu'on doit refaire est un geste qui n'a
pas été enregistré.

Le mois masqué rejoint donc `recap_disabled_chapters` sur le compte : même nature
(une préférence de **lecture** du récap, qui ne touche jamais le snapshot gelé) et
même chemin d'écriture, le `PATCH /api/accounts/users/me/` qui existe déjà.

Régression #626.
"""
from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.serializers import UserSerializer


def _url():
    return reverse("user-me")


@pytest.mark.django_db
class TestDismissingTheRecapOutlivesTheTab:
    """Le cœur du bug : le masquage doit survivre au client qui l'a posé."""

    def test_another_device_sees_the_month_as_dismissed(self, authenticated_client, user):
        """Fermé sur un appareil = fermé sur les autres.

        Le second client n'a jamais rien fermé et ne partage aucun stockage avec
        le premier : c'est l'appareil sur lequel la carte revenait.
        """
        authenticated_client.patch(
            _url(), {"recap_dismissed_month": "2026-07"}, format="json"
        )

        other_device = APIClient()
        other_device.force_authenticate(user=user)
        payload = other_device.get(_url()).json()

        assert payload["recap_dismissed_month"] == "2026-07"

    def test_the_field_is_self_editable(self):
        """La liste blanche du PATCH laisse tomber en silence ce qu'elle ignore.

        `me()` filtre la requête sur `SELF_EDITABLE_FIELDS` : un champ oublié là
        répond **200** sans rien écrire — soit exactement le bug qu'on corrige,
        avec une confirmation par-dessus. C'est déjà arrivé à
        `recap_disabled_chapters`, resté muet aussi longtemps que la page récap
        l'avait envoyé.
        """
        assert "recap_dismissed_month" in UserSerializer.SELF_EDITABLE_FIELDS

    def test_nothing_is_dismissed_by_default(self, authenticated_client):
        """Vide = personne n'a fermé. La carte du premier mois doit s'afficher."""
        payload = authenticated_client.get(_url()).json()

        assert payload["recap_dismissed_month"] == ""

    def test_a_later_month_replaces_the_previous_one(self, authenticated_client, user):
        """Un seul mois est masqué à la fois : le récap suivant reprend la parole.

        C'est la propriété que le stockage par mois avait déjà et qu'il ne faut
        pas perdre — masquer juillet ne doit pas masquer août.
        """
        authenticated_client.patch(
            _url(), {"recap_dismissed_month": "2026-07"}, format="json"
        )
        authenticated_client.patch(
            _url(), {"recap_dismissed_month": "2026-08"}, format="json"
        )

        user.refresh_from_db()
        assert user.recap_dismissed_month == "2026-08"

    def test_it_can_be_cleared(self, authenticated_client, user):
        """Rouvrir la carte reste possible — la préférence n'est pas à sens unique."""
        authenticated_client.patch(
            _url(), {"recap_dismissed_month": "2026-07"}, format="json"
        )
        response = authenticated_client.patch(
            _url(), {"recap_dismissed_month": ""}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.recap_dismissed_month == ""


@pytest.mark.django_db
class TestTheDismissedMonthIsAMonth:
    """Ce qui se compare à `recap.month` doit avoir la forme d'un `recap.month`.

    Sans contrôle, un client peut écrire n'importe quoi : ça ne masquerait rien
    (l'égalité serait toujours fausse) mais l'interface confirmerait un geste
    sans effet — la même famille de silence que celle du dessus.
    """

    @pytest.mark.parametrize("value", ["2026-13", "2026-0", "juillet", "2026/07", "26-07"])
    def test_a_malformed_month_is_refused(self, authenticated_client, value):
        response = authenticated_client.patch(
            _url(), {"recap_dismissed_month": value}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "recap_dismissed_month" in response.data

    @pytest.mark.parametrize("value", ["2026-01", "2026-12", "2100-06"])
    def test_a_well_formed_month_is_accepted(self, authenticated_client, user, value):
        response = authenticated_client.patch(
            _url(), {"recap_dismissed_month": value}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.recap_dismissed_month == value
