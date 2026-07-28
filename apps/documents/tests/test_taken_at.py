"""Date de prise de vue des photos — lecture EXIF, fuseau, tri et back-fill.

Ce que ces tests tiennent, et pourquoi :

1. **La date est lue avant que la normalisation la détruise.** `normalize_image`
   ré-encode sans transmettre l'EXIF ; si l'upload lisait après, `taken_at` serait vide
   pour tout HEIC et toute image > `MAX_DIMENSION` — soit l'essentiel du réel — et aucun
   test d'upload existant ne s'en apercevrait. C'est LE test qui protège la feature.
2. **`NULL` reste `NULL`.** Une capture d'écran n'a pas de date de prise. Écrire
   `created_at` en repli fabriquerait une donnée fausse indistinguable d'une vraie.
3. **L'EXIF est une heure locale sans fuseau**, donc son interprétation dépend du foyer.
   Deux foyers dans deux fuseaux ne doivent pas lire le même instant.
4. **Le tri de la galerie est `COALESCE(taken_at, created_at)`** : une photo prise en
   juin et importée en juillet se range en juin, sans que celles sans date disparaissent.
5. **Une horloge d'appareil délirante ne pollue pas le tri.** Une date en 2049
   resterait perchée en tête de galerie pour toujours.
"""
import io
from datetime import datetime, timedelta, timezone as dt_timezone

import pytest
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from documents.exif import read_taken_at
from documents.image_processing import MAX_DIMENSION
from documents.models import Document
from households.models import Household, HouseholdMember


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _jpeg_with_exif(
    *,
    size=(400, 300),
    original: str | None = "2026:06:14 15:30:00",
    offset: str | None = None,
    digitized: str | None = None,
) -> bytes:
    """JPEG portant (ou non) les tags EXIF de date de prise de vue."""
    image = Image.new("RGB", size, "red")
    exif = image.getexif()
    ifd = exif.get_ifd(0x8769)
    if original is not None:
        ifd[36867] = original
    if digitized is not None:
        ifd[36868] = digitized
    if offset is not None:
        ifd[36880] = offset
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif.tobytes())
    return buffer.getvalue()


def _jpeg_without_exif(size=(400, 300)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, "blue").save(buffer, format="JPEG")
    return buffer.getvalue()


def _upload(content: bytes, name="photo.jpg") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, content, content_type="image/jpeg")


@pytest.fixture
def paris_household(db):
    user = UserFactory(email="taken-at-owner@example.com")
    hh = Household.objects.create(name="Taken At House", timezone="Europe/Paris")
    HouseholdMember.objects.create(user=user, household=hh, role=HouseholdMember.Role.OWNER)
    return hh, user


@pytest.fixture
def client_for(paris_household):
    _, user = paris_household
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
# 1. Lecture EXIF
# ---------------------------------------------------------------------------

class TestReadTakenAt:
    def test_reads_datetime_original_in_household_timezone(self, paris_household):
        household, _ = paris_household
        taken = read_taken_at(io.BytesIO(_jpeg_with_exif()), household=household)

        assert taken is not None
        # 15 h 30 à Paris en juin (UTC+2) = 13 h 30 UTC.
        assert taken.astimezone(dt_timezone.utc).hour == 13
        assert (taken.year, taken.month, taken.day) == (2026, 6, 14)

    def test_a_different_household_timezone_yields_a_different_instant(self, paris_household):
        """L'EXIF ne porte pas de fuseau : le même fichier lu par deux foyers
        distants ne peut pas donner le même instant absolu."""
        paris, _ = paris_household
        tokyo = Household.objects.create(name="Tokyo", timezone="Asia/Tokyo")
        content = _jpeg_with_exif()

        from_paris = read_taken_at(io.BytesIO(content), household=paris)
        from_tokyo = read_taken_at(io.BytesIO(content), household=tokyo)

        assert from_paris != from_tokyo
        assert from_paris.utcoffset() != from_tokyo.utcoffset()

    def test_offset_time_original_wins_over_the_household_timezone(self, paris_household):
        """Quand l'appareil a écrit son décalage (EXIF 2.31+), il est plus sûr que
        la supposition du foyer."""
        household, _ = paris_household
        content = _jpeg_with_exif(offset="-05:00")

        taken = read_taken_at(io.BytesIO(content), household=household)

        assert taken.utcoffset() == timedelta(hours=-5)

    def test_falls_back_to_datetime_digitized(self, paris_household):
        household, _ = paris_household
        content = _jpeg_with_exif(original=None, digitized="2026:05:01 08:00:00")

        taken = read_taken_at(io.BytesIO(content), household=household)

        assert taken is not None
        assert (taken.year, taken.month, taken.day) == (2026, 5, 1)

    @pytest.mark.parametrize(
        "value",
        ["0000:00:00 00:00:00", "", "   ", "pas une date", "2026-06-14 15:30:00"],
    )
    def test_unusable_values_yield_none_rather_than_a_guess(self, paris_household, value):
        household, _ = paris_household
        taken = read_taken_at(io.BytesIO(_jpeg_with_exif(original=value)), household=household)
        assert taken is None

    def test_no_exif_yields_none(self, paris_household):
        household, _ = paris_household
        assert read_taken_at(io.BytesIO(_jpeg_without_exif()), household=household) is None

    def test_an_implausible_future_date_is_ignored(self, paris_household):
        """Une pile morte remet l'horloge d'un appareil à une date lointaine ; sans
        borne, la photo resterait en tête de galerie pour toujours."""
        household, _ = paris_household
        far_future = (timezone.now() + timedelta(days=400)).strftime("%Y:%m:%d %H:%M:%S")

        assert read_taken_at(io.BytesIO(_jpeg_with_exif(original=far_future)), household=household) is None

    def test_a_date_before_photography_is_ignored(self, paris_household):
        household, _ = paris_household
        assert read_taken_at(io.BytesIO(_jpeg_with_exif(original="1830:01:01 00:00:00")), household=household) is None

    def test_a_non_image_never_raises(self, paris_household):
        household, _ = paris_household
        assert read_taken_at(io.BytesIO(b"not an image at all"), household=household) is None

    def test_the_file_is_rewound_for_the_caller(self, paris_household):
        """L'appelant écrit ce même objet dans le stockage juste après : le laisser
        positionné en fin de fichier sauverait une image vide."""
        household, _ = paris_household
        content = _jpeg_with_exif()
        handle = io.BytesIO(content)

        read_taken_at(handle, household=household)

        assert handle.tell() == 0
        assert handle.read() == content


# ---------------------------------------------------------------------------
# 2. Upload — la lecture précède la destruction
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestUploadCapturesTheDate:
    def _upload_photo(self, client, household, content, name="photo.jpg"):
        url = reverse('document-upload')
        response = client.post(
            url,
            {'file': _upload(content, name), 'type': 'photo', 'household_id': str(household.id)},
            format='multipart',
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )
        return response

    def test_a_small_photo_keeps_its_capture_date(self, client_for, paris_household):
        household, _ = paris_household
        response = self._upload_photo(client_for, household, _jpeg_with_exif())

        assert response.status_code == status.HTTP_201_CREATED, response.data
        document = Document.objects.get(id=response.data['document']['id'])
        assert document.taken_at is not None
        assert (document.taken_at.year, document.taken_at.month) == (2026, 6)

    def test_a_LARGE_photo_keeps_its_capture_date_although_the_exif_is_destroyed(
        self, client_for, paris_household
    ):
        """Le test qui protège la feature.

        Au-delà de `MAX_DIMENSION`, `normalize_image` ré-encode et l'EXIF disparaît du
        fichier stocké. La date doit malgré tout être en base — ce qui n'est vrai que si
        la lecture a lieu **avant** la normalisation. Inverser les deux lignes dans la
        vue fait tomber ce test, et lui seul.
        """
        household, _ = paris_household
        big = _jpeg_with_exif(size=(MAX_DIMENSION + 500, 1200))

        response = self._upload_photo(client_for, household, big, name="big.jpg")

        assert response.status_code == status.HTTP_201_CREATED, response.data
        document = Document.objects.get(id=response.data['document']['id'])

        assert document.metadata.get('resized') is True, "le fichier a bien été ré-encodé"
        assert document.taken_at is not None, "et pourtant la date a survécu, en colonne"

        # Et l'EXIF n'est effectivement plus dans le fichier stocké.
        with default_storage.open(document.file_path, 'rb') as handle:
            stored = Image.open(io.BytesIO(handle.read()))
        assert not stored.getexif().get_ifd(0x8769).get(36867)

    def test_a_photo_without_exif_gets_a_null_date_not_the_upload_date(
        self, client_for, paris_household
    ):
        household, _ = paris_household
        response = self._upload_photo(client_for, household, _jpeg_without_exif(), name="scan.jpg")

        assert response.status_code == status.HTTP_201_CREATED, response.data
        document = Document.objects.get(id=response.data['document']['id'])
        assert document.taken_at is None

    def test_taken_at_is_exposed_but_never_writable(self, client_for, paris_household):
        """Le laisser modifiable permettrait de contredire l'EXIF par un PATCH, et le
        tri de la galerie cesserait de vouloir dire quelque chose."""
        household, _ = paris_household
        response = self._upload_photo(client_for, household, _jpeg_with_exif())
        document_id = response.data['document']['id']

        assert 'taken_at' in response.data['document']

        patched = client_for.patch(
            reverse('document-detail', args=[document_id]),
            {'taken_at': '2020-01-01T00:00:00Z'},
            format='json',
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert patched.status_code == status.HTTP_200_OK
        document = Document.objects.get(id=document_id)
        assert document.taken_at.year == 2026, "le PATCH n'a pas écrasé la date EXIF"


# ---------------------------------------------------------------------------
# 3. Tri de la galerie
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestGalleryOrdering:
    def test_effective_date_falls_back_to_created_at_without_hiding_anything(
        self, client_for, paris_household
    ):
        """Une photo prise en juin mais importée en juillet doit passer *avant* une
        photo importée en juin sans date de prise — et aucune des deux ne disparaît."""
        household, user = paris_household

        imported_later = Document.objects.create(
            household=household, created_by=user, name="prise en juin",
            file_path="documents/a.jpg", mime_type="image/jpeg", type="photo",
            taken_at=datetime(2026, 6, 15, 12, 0, tzinfo=dt_timezone.utc),
        )
        Document.objects.filter(id=imported_later.id).update(
            created_at=datetime(2026, 7, 20, 12, 0, tzinfo=dt_timezone.utc)
        )

        undated = Document.objects.create(
            household=household, created_by=user, name="sans date",
            file_path="documents/b.jpg", mime_type="image/jpeg", type="photo",
        )
        Document.objects.filter(id=undated.id).update(
            created_at=datetime(2026, 6, 1, 12, 0, tzinfo=dt_timezone.utc)
        )

        response = client_for.get(
            reverse('document-list'),
            {'type': 'photo', 'ordering': '-effective_date'},
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_200_OK
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        names = [item['name'] for item in results]

        assert names == ["prise en juin", "sans date"], names

    def test_ordering_by_created_at_still_works(self, client_for, paris_household):
        """L'ancien ordre reste disponible : `effective_date` s'ajoute, il ne remplace pas."""
        household, user = paris_household
        for name in ("un", "deux"):
            Document.objects.create(
                household=household, created_by=user, name=name,
                file_path=f"documents/{name}.jpg", mime_type="image/jpeg", type="photo",
            )

        response = client_for.get(
            reverse('document-list'),
            {'type': 'photo', 'ordering': '-created_at'},
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# 4. Back-fill
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestBackfillCommand:
    def test_it_fills_what_it_can_and_reports_what_it_cannot(self, paris_household, capsys):
        """Un back-fill qui n'annonce que ses succès laisse croire que la galerie est
        triable de bout en bout. Le chiffre qui compte est celui des photos restées
        sans date."""
        from django.core.management import call_command

        household, user = paris_household

        with_exif = default_storage.save("documents/with-exif.jpg", io.BytesIO(_jpeg_with_exif()))
        without = default_storage.save("documents/without.jpg", io.BytesIO(_jpeg_without_exif()))

        Document.objects.create(
            household=household, created_by=user, name="datable",
            file_path=with_exif, mime_type="image/jpeg", type="photo",
        )
        Document.objects.create(
            household=household, created_by=user, name="indatable",
            file_path=without, mime_type="image/jpeg", type="photo",
        )

        call_command("backfill_photo_taken_at", household=str(household.id))
        out = capsys.readouterr().out

        assert Document.objects.get(name="datable").taken_at is not None
        assert Document.objects.get(name="indatable").taken_at is None
        assert "1 datée(s) depuis l'EXIF" in out
        assert "1 sans date de prise de vue récupérable" in out

    def test_dry_run_writes_nothing(self, paris_household):
        from django.core.management import call_command

        household, user = paris_household
        path = default_storage.save("documents/dry.jpg", io.BytesIO(_jpeg_with_exif()))
        document = Document.objects.create(
            household=household, created_by=user, name="dry",
            file_path=path, mime_type="image/jpeg", type="photo",
        )

        call_command("backfill_photo_taken_at", household=str(household.id), dry_run=True)

        document.refresh_from_db()
        assert document.taken_at is None
