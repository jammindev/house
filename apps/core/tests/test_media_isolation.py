"""Isolation des fichiers servis — un chemin deviné ne doit rien rendre.

Le service de médias est la seule porte du foyer qui ne passe **ni** par un
viewset **ni** par un queryset : elle prend un chemin et rend des octets. Les
57 viewsets peuvent tous filtrer parfaitement sans que ça protège un seul
fichier — c'est pourquoi elle a ses propres tests de régression.

Chaque classe ici est nommée d'après le défaut qu'elle empêche.
"""
import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from accounts.tests.factories import UserFactory
from documents.models import Document
from households.models import Household, HouseholdMember


def media_url(path):
    return f"/media/{path}"


@pytest.fixture
def household_a(db):
    return Household.objects.create(name="Foyer A")


@pytest.fixture
def household_b(db):
    return Household.objects.create(name="Foyer B")


@pytest.fixture
def alice(db, household_a):
    user = UserFactory()
    HouseholdMember.objects.create(
        household=household_a, user=user, role=HouseholdMember.Role.OWNER
    )
    return user


@pytest.fixture
def amelie(db, household_a):
    """Deuxième membre du foyer A — pour la confidentialité *entre* membres."""
    user = UserFactory()
    HouseholdMember.objects.create(
        household=household_a, user=user, role=HouseholdMember.Role.MEMBER
    )
    return user


@pytest.fixture
def bob(db, household_b):
    user = UserFactory()
    HouseholdMember.objects.create(
        household=household_b, user=user, role=HouseholdMember.Role.OWNER
    )
    return user


@pytest.mark.django_db
class TestAPrivateDocumentThumbnailStaysPrivate:
    """Régression : la vignette d'un document privé échappait au contrôle.

    Le contrôle de confidentialité cherchait le document par ``file_path``
    exact. Une vignette vit à un **autre** chemin
    (``…/.thumbnails/thumb/<stem>.jpg``), donc la recherche levait
    ``DoesNotExist`` et le code tombait dans un ``pass`` — servant l'aperçu.

    Pour un document scanné ou une photo, l'aperçu *est* le document. Le
    marquer privé ne protégeait donc que l'original, jamais ce qu'on voit.
    """

    def _private_doc(self, household, owner):
        file_path = Document.build_upload_path(
            household_id=household.id, filename="rib.pdf"
        )
        default_storage.save(file_path, ContentFile(b"%PDF-1.4 fake"))
        doc = Document.objects.create(
            household=household,
            created_by=owner,
            name="RIB",
            file_path=file_path,
            is_private=True,
        )
        from documents.thumbnails import thumbnail_storage_path

        thumb_path = thumbnail_storage_path(file_path, "thumb")
        default_storage.save(thumb_path, ContentFile(b"\xff\xd8\xff fake jpeg"))
        return doc, file_path, thumb_path

    def test_the_creator_still_sees_the_thumbnail(self, client, household_a, alice):
        _, _, thumb_path = self._private_doc(household_a, alice)
        client.force_login(alice)
        assert client.get(media_url(thumb_path)).status_code == 200

    def test_another_member_cannot_read_the_original(self, client, household_a, alice, amelie):
        _, file_path, _ = self._private_doc(household_a, alice)
        client.force_login(amelie)
        assert client.get(media_url(file_path)).status_code == 403

    def test_another_member_cannot_read_the_thumbnail_either(
        self, client, household_a, alice, amelie
    ):
        """Le défaut lui-même : l'original refusé, l'aperçu servi."""
        _, _, thumb_path = self._private_doc(household_a, alice)
        client.force_login(amelie)
        assert client.get(media_url(thumb_path)).status_code == 403

    def test_a_stranger_cannot_read_the_thumbnail(self, client, household_a, alice, bob):
        _, _, thumb_path = self._private_doc(household_a, alice)
        client.force_login(bob)
        assert client.get(media_url(thumb_path)).status_code == 403


@pytest.mark.django_db
class TestAnUnknownMediaPrefixIsRefused:
    """Régression : le service était en *default-allow*.

    Seul ``documents/`` était contrôlé ; tout autre préfixe tombait jusqu'au
    ``X-Accel-Redirect`` final et était servi à n'importe quel utilisateur
    authentifié. Un préfixe ajouté plus tard (exports, sauvegardes, pièces
    jointes) aurait donc été public par défaut, sans une ligne de code pour
    le trahir.

    La règle est inversée : ce qui n'est pas explicitement autorisé est refusé.
    """

    def test_an_unknown_prefix_is_refused(self, client, alice):
        client.force_login(alice)
        assert client.get(media_url("exports/2026/tout.csv")).status_code == 403

    def test_even_a_path_that_looks_like_a_document_is_refused(self, client, alice):
        client.force_login(alice)
        assert client.get(media_url("documents-backup/secret.pdf")).status_code == 403

    def test_a_traversal_attempt_is_refused(self, client, alice):
        client.force_login(alice)
        response = client.get(media_url("../../etc/passwd"))
        assert response.status_code in (403, 404)


@pytest.mark.django_db
class TestAnAvatarStaysInsideItsHouseholds:
    """Un avatar est la photo d'une personne, pas un fichier public.

    Il était servi à tout utilisateur authentifié, quel que soit son foyer —
    et un ancien membre gardait donc l'accès pour toujours. La règle retenue
    est la plus permissive qui reste vraie : on voit l'avatar de quelqu'un
    avec qui on partage un foyer, et le sien.
    """

    def _avatar_path(self, user):
        path = f"avatars/{user.pk}/portrait.jpg"
        default_storage.save(path, ContentFile(b"\xff\xd8\xff fake jpeg"))
        return path

    def test_you_can_see_your_own_avatar(self, client, alice):
        path = self._avatar_path(alice)
        client.force_login(alice)
        assert client.get(media_url(path)).status_code == 200

    def test_a_household_member_can_see_it(self, client, alice, amelie):
        path = self._avatar_path(alice)
        client.force_login(amelie)
        assert client.get(media_url(path)).status_code == 200

    def test_someone_from_another_household_cannot(self, client, alice, bob):
        path = self._avatar_path(alice)
        client.force_login(bob)
        assert client.get(media_url(path)).status_code == 403

    def test_an_avatar_of_nobody_is_not_served(self, client, alice):
        """Un chemin bien formé mais sans utilisateur derrière ne rend rien."""
        client.force_login(alice)
        response = client.get(media_url("avatars/00000000-0000-0000-0000-000000000000/x.jpg"))
        assert response.status_code in (403, 404)

    def test_a_malformed_avatar_path_is_not_served(self, client, alice):
        client.force_login(alice)
        response = client.get(media_url("avatars/pas-un-uuid/x.jpg"))
        assert response.status_code in (403, 404)


@pytest.mark.django_db
class TestTheDocumentRulesStillHold:
    """Les garanties déjà en place ne doivent pas régresser en durcissant."""

    def _doc(self, household, owner, *, private=False):
        file_path = Document.build_upload_path(
            household_id=household.id, filename="facture.pdf"
        )
        default_storage.save(file_path, ContentFile(b"%PDF-1.4 fake"))
        Document.objects.create(
            household=household,
            created_by=owner,
            name="Facture",
            file_path=file_path,
            is_private=private,
        )
        return file_path

    def test_a_member_reads_a_public_document(self, client, household_a, alice, amelie):
        path = self._doc(household_a, alice)
        client.force_login(amelie)
        assert client.get(media_url(path)).status_code == 200

    def test_a_stranger_does_not(self, client, household_a, alice, bob):
        path = self._doc(household_a, alice)
        client.force_login(bob)
        assert client.get(media_url(path)).status_code == 403

    def test_anonymous_gets_401_not_403(self, client, household_a, alice):
        """401 et 403 disent deux choses différentes ; le front s'en sert."""
        path = self._doc(household_a, alice)
        assert client.get(media_url(path)).status_code == 401


@pytest.mark.django_db
class TestADocumentWrittenBeforeTodaysLayoutStaysReadable:
    """Régression : le *default-deny* a fermé l'accès à l'existant.

    Le durcissement précédent n'autorise que les préfixes ``documents/`` et
    ``avatars/`` — ceux que ``Document.build_upload_path`` produit
    **aujourd'hui**. Or les documents plus anciens sont rangés sous
    ``<foyer>/<dossier>/…``, une disposition que plus aucune ligne de code
    n'écrit mais que la base porte toujours : en production, 177 documents sur
    202 sont devenus invisibles d'un coup, vignettes comprises.

    ⚠️ **Ce que ces tests corrigent tient moins au code qu'à leur propre
    fabrication.** Toute la classe voisine construit ses fixtures avec
    ``build_upload_path`` : elle vérifie donc le service des fichiers contre ce
    que le code écrit, jamais contre ce que le foyer possède. Un contrôle qui ne
    connaît qu'un seul schéma de chemin ne peut pas voir mourir les autres —
    d'où les chemins écrits **en dur** ici, exactement sous la forme trouvée en
    base.

    L'attribution ne se déduit pas du chemin : elle se **résout en base**, par le
    document dont c'est le fichier. Un chemin qu'aucun document ne réclame reste
    donc refusé, et le default-deny garde son sens.
    """

    def _legacy_paths(self, household):
        """La forme réellement présente en base — jamais celle du builder."""
        folder = "44e6e84b-b680-428d-982e-3b5e0c9a1f27"
        file_path = f"{household.id}/{folder}/e997edd3_IMG_2212.jpg"
        thumb_path = f"{household.id}/{folder}/.thumbnails/thumb/e997edd3_IMG_2212.jpg"
        return file_path, thumb_path

    def _legacy_doc(self, household, owner, *, private=False):
        file_path, thumb_path = self._legacy_paths(household)
        default_storage.save(file_path, ContentFile(b"\xff\xd8\xff fake jpeg"))
        default_storage.save(thumb_path, ContentFile(b"\xff\xd8\xff fake jpeg"))
        Document.objects.create(
            household=household,
            created_by=owner,
            name="IMG_2212",
            file_path=file_path,
            is_private=private,
        )
        return file_path, thumb_path

    def test_a_member_reads_it(self, client, household_a, alice, amelie):
        file_path, _ = self._legacy_doc(household_a, alice)
        client.force_login(amelie)
        assert client.get(media_url(file_path)).status_code == 200

    def test_a_member_reads_its_thumbnail(self, client, household_a, alice, amelie):
        """La grille de photos ne montre que des vignettes : sans elles, page vide."""
        _, thumb_path = self._legacy_doc(household_a, alice)
        client.force_login(amelie)
        assert client.get(media_url(thumb_path)).status_code == 200

    def test_a_stranger_still_does_not(self, client, household_a, alice, bob):
        file_path, _ = self._legacy_doc(household_a, alice)
        client.force_login(bob)
        assert client.get(media_url(file_path)).status_code == 403

    def test_a_stranger_does_not_get_the_thumbnail_either(
        self, client, household_a, alice, bob
    ):
        _, thumb_path = self._legacy_doc(household_a, alice)
        client.force_login(bob)
        assert client.get(media_url(thumb_path)).status_code == 403

    def test_privacy_still_holds_between_members(
        self, client, household_a, alice, amelie
    ):
        file_path, thumb_path = self._legacy_doc(household_a, alice, private=True)
        client.force_login(amelie)
        assert client.get(media_url(file_path)).status_code == 403
        assert client.get(media_url(thumb_path)).status_code == 403

    def test_a_file_no_document_claims_is_still_refused(self, client, household_a, alice):
        """Le default-deny reste entier : on sert ce qu'un document réclame.

        Un fichier posé sous un chemin d'apparence légitime, mais qu'aucune ligne
        de la base ne rattache à un foyer, n'est attribuable à personne — donc
        refusé. C'est ce qui distingue « rouvrir l'ancien » de « rouvrir tout ».
        """
        path = f"{household_a.id}/orphelin/inconnu.jpg"
        default_storage.save(path, ContentFile(b"\xff\xd8\xff fake jpeg"))
        client.force_login(alice)
        assert client.get(media_url(path)).status_code == 403

    def test_an_unknown_prefix_is_still_refused(self, client, alice):
        """Le garde-fou de la classe voisine, rejoué depuis cette porte-ci."""
        client.force_login(alice)
        assert client.get(media_url("exports/2026/tout.csv")).status_code == 403
