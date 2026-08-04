"""Une photo ajoutée se dit au foyer — sauf celle qui n'attend rien de personne.

Trois choses se décident ici, et aucune ne se relit dans un diff :

1. **Un souvenir ne réveille personne.** L'intention posée à l'envoi est la seule
   information qui distingue « viens voir, il y a un truc à traiter » de « j'ai
   rangé les photos du week-end ». D'où `purpose` accepté à l'upload : sans lui,
   l'exception serait écrite mais inatteignable.
2. **Une rafale est un événement, pas quinze.** Le dialog d'envoi boucle fichier
   par fichier — quinze photos font quinze appels. Le dédoublonnage s'ancre sur le
   **début de la rafale**, jamais sur une tranche d'horloge : un lot à cheval sur
   deux tranches annoncerait deux fois la même chose.
3. **Une photo privée ne s'annonce pas.** `is_private` dit que personne d'autre ne
   la voit ; l'annoncer poserait dans la cloche une ligne qui ne mène nulle part.
"""
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from documents.models import Document
from households.models import Household, HouseholdMember
from notifications.models import MUTABLE_TYPES, Notification

UPLOAD_URL = reverse("document-upload")


def _jpeg_bytes() -> bytes:
    """Le plus petit JPEG que `validate_upload` accepte — l'entête suffit."""
    return b"\xff\xd8\xff\xe0" + b"\x00" * 64 + b"\xff\xd9"


@pytest.fixture
def household(db):
    return Household.objects.create(name="Photo House")


@pytest.fixture
def sender(db, household):
    user = UserFactory(email="sender@example.com")
    HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


@pytest.fixture
def reader(db, household):
    user = UserFactory(email="reader@example.com")
    HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.MEMBER
    )
    return user


@pytest.fixture
def client(sender, household):
    api = APIClient()
    api.force_authenticate(user=sender)
    api.credentials(HTTP_X_HOUSEHOLD_ID=str(household.id))
    return api


def _upload(client, household, *, name="photo.jpg", **extra):
    payload = {
        "file": SimpleUploadedFile(name, _jpeg_bytes(), content_type="image/jpeg"),
        "type": "photo",
        **extra,
    }
    return client.post(
        UPLOAD_URL, payload, format="multipart", HTTP_X_HOUSEHOLD_ID=str(household.id)
    )


def _at(monkeypatch, moment):
    """Fige l'horloge — celle de `created_at` comme celle du regroupement.

    Sans ça, deux envois d'un même test tombent dans la même seconde : ils
    formeraient une rafale même sous une implémentation qui n'en regroupe aucune,
    et le test passerait au vert sans rien prouver.
    """
    monkeypatch.setattr(timezone, "now", lambda: moment)


def _photo_notifications(user=None):
    queryset = Notification.objects.filter(type=Notification.Type.PHOTO_ADDED)
    return queryset.filter(user=user) if user else queryset


@pytest.mark.django_db
class TestAPhotoAddedIsToldToTheHousehold:
    def test_the_others_are_told_and_the_sender_is_not(
        self, client, household, sender, reader
    ):
        response = _upload(client, household)

        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert _photo_notifications(reader).count() == 1
        assert not _photo_notifications(sender).exists(), (
            "on ne prévient personne de sa propre action"
        )

    def test_the_notification_leads_where_the_photo_actually_is(
        self, client, household, reader
    ):
        """Annoncer sans mener fait refaire au lecteur la recherche qu'on venait de
        faire pour lui. Une photo fraîchement envoyée n'est pas triée : avec le
        défaut « souvenirs » de la galerie, `/app/photos` seul ne la montrerait pas."""
        _upload(client, household)

        notification = _photo_notifications(reader).get()
        assert notification.url == "/app/photos?purpose=untriaged"

    def test_a_photo_sent_already_sorted_leads_to_its_own_shelf(
        self, client, household, reader
    ):
        _upload(client, household, purpose="technical")

        notification = _photo_notifications(reader).get()
        assert notification.url == "/app/photos?purpose=technical"

    def test_it_can_be_silenced(self):
        """Fréquent et purement informatif : le taire doit rester possible, sinon la
        cloche devient du bruit et emporte avec elle la notification rare qui comptait."""
        assert Notification.Type.PHOTO_ADDED in MUTABLE_TYPES


@pytest.mark.django_db
class TestAMemoryNeverWakesAnybody:
    def test_a_photo_sent_as_a_memory_tells_nobody(self, client, household, reader):
        response = _upload(client, household, purpose="memory")

        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert Document.objects.get(id=response.data["document"]["id"]).purpose == "memory"
        assert not _photo_notifications().exists()

    def test_the_other_intents_still_tell(self, client, household, reader):
        """Le vide et `memory` ne se confondent nulle part — ici non plus : seul le
        souvenir se tait, une photo non triée s'annonce comme les autres."""
        _upload(client, household, purpose="observation", name="fissure.jpg")

        assert _photo_notifications(reader).count() == 1

    def test_a_private_photo_tells_nobody(self, client, household, reader):
        _upload(client, household, is_private=True)

        assert not _photo_notifications().exists(), (
            "personne d'autre ne peut la voir : l'annoncer mène dans le vide"
        )

    def test_a_document_that_is_not_a_photo_tells_nobody(self, client, household, reader):
        client.post(
            UPLOAD_URL,
            {
                "file": SimpleUploadedFile(
                    "facture.jpg", _jpeg_bytes(), content_type="image/jpeg"
                ),
                "type": "invoice",
            },
            format="multipart",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert not _photo_notifications().exists()


@pytest.mark.django_db
class TestABurstIsOneEventNotFifteen:
    def test_fifteen_photos_ring_the_bell_once(self, client, household, reader):
        for index in range(15):
            assert (
                _upload(client, household, name=f"lot-{index}.jpg").status_code
                == status.HTTP_201_CREATED
            )

        assert _photo_notifications(reader).count() == 1, (
            "quinze appels d'upload font un envoi, pas quinze nouvelles"
        )

    def test_a_burst_straddling_two_clock_slices_still_rings_once(
        self, monkeypatch, client, household, reader
    ):
        """Le dédoublonnage s'ancre sur le début de la rafale, pas sur un `now() //
        600` : une tranche d'horloge coupe un lot en deux au hasard de l'heure
        d'envoi, et ce hasard-là n'est pas quelque chose qu'on peut expliquer à un
        utilisateur — il verrait tantôt une notification, tantôt deux, pour le même
        geste."""
        boundary = timezone.now().replace(minute=0, second=0, microsecond=0)

        _at(monkeypatch, boundary - timedelta(seconds=30))
        assert (
            _upload(client, household, name="avant.jpg").status_code
            == status.HTTP_201_CREATED
        )

        _at(monkeypatch, boundary + timedelta(seconds=30))
        _upload(client, household, name="apres.jpg")

        assert _photo_notifications(reader).count() == 1

    def test_a_later_session_is_a_new_event(
        self, monkeypatch, client, household, reader
    ):
        start = timezone.now()

        _at(monkeypatch, start)
        _upload(client, household, name="matin.jpg")
        # Le premier avis est lu, pas supprimé : la portée d'une clé est le vivant,
        # et sans horodatage dans la clé le foyer ne serait plus jamais prévenu.
        _photo_notifications(reader).update(is_read=True)

        _at(monkeypatch, start + timedelta(hours=3))
        _upload(client, household, name="soir.jpg")

        assert _photo_notifications(reader).count() == 2

    def test_two_senders_are_two_events(self, client, household, sender, reader):
        """La rafale appartient à celui qui l'envoie : deux membres qui rangent leurs
        photos en même temps sont deux nouvelles, pas une."""
        _upload(client, household, name="du-sender.jpg")

        other = APIClient()
        other.force_authenticate(user=reader)
        other.credentials(HTTP_X_HOUSEHOLD_ID=str(household.id))
        _upload(other, household, name="du-reader.jpg")

        assert _photo_notifications(sender).count() == 1
        assert _photo_notifications(reader).count() == 1
