"""Date de prise de vue d'une image — lecture EXIF, et rien d'autre.

## Pourquoi ce module existe

La galerie se rangeait par ``created_at``, la date d'**ajout dans House**. Une série
prise en juin et importée en juillet apparaissait donc sous « juillet ». La date qui
intéresse l'utilisateur est celle du déclenchement, et elle est dans l'EXIF.

## Pourquoi il faut lire AVANT de normaliser

``image_processing.normalize_image`` ré-encode en JPEG sans transmettre l'EXIF, donc
il le **détruit** — pour tout HEIC/HEIF (le défaut iPhone, toujours transcodé) et pour
toute image dépassant ``MAX_DIMENSION`` sur son plus grand côté, soit l'essentiel des
photos réelles. La lecture doit donc se faire sur le fichier **tel qu'il arrive**.

**On ne réinjecte volontairement pas l'EXIF dans le fichier stocké.** Ce serait la
correction « symétrique », mais elle coûterait deux choses pour rien : elle
réintroduirait les **coordonnées GPS** dans des originaux qui n'en portent plus
aujourd'hui, et il faudrait penser à retirer le tag ``Orientation`` — ``exif_transpose``
ayant déjà appliqué la rotation aux pixels, le garder ferait pivoter l'image une
seconde fois dans les visionneuses. Comme la date part dans une **colonne**
(``Document.taken_at``), la conserver dans le fichier n'apporte rien.

## Pourquoi le résultat peut être ``None``, et pourquoi c'est un état

Une capture d'écran, un scan, une image exportée par un outil qui strippe les
métadonnées n'**ont pas** de date de prise de vue. ``None`` veut dire « on ne sait
pas », et ne doit jamais être remplacé par ``created_at`` au moment de l'écriture :
ça fabriquerait une donnée fausse qu'on ne pourrait plus distinguer d'une vraie. Le
repli se fait à la lecture, là où on peut encore dire lequel des deux on affiche.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone as dt_timezone

from django.utils import timezone
from PIL import Image, UnidentifiedImageError

from core.timezones import household_tz

logger = logging.getLogger(__name__)

# Tags EXIF, dans l'IFD Exif (0x8769).
_EXIF_IFD = 0x8769
_DATETIME_ORIGINAL = 36867  # 0x9003 — l'instant du déclenchement
_DATETIME_DIGITIZED = 36868  # 0x9004 — numérisation ; identique sur un APN numérique
_OFFSET_TIME_ORIGINAL = 36880  # 0x9010 — décalage UTC, EXIF 2.31+ et souvent absent

# `DateTime` (306) est **volontairement absent** : c'est la date de *modification* du
# fichier, pas celle de la prise de vue. Sur une photo retouchée elle vaut la date de
# l'export — la lire ferait passer une donnée fausse pour une date de prise, ce qui est
# exactement ce que `None` sert à éviter.

_EXIF_DATE_FORMAT = "%Y:%m:%d %H:%M:%S"

# Une horloge d'appareil mal réglée (usine, pile morte) produit soit 1970, soit une date
# lointaine dans le futur. Sans borne, une photo « 2049 » resterait perchée en tête de
# galerie pour toujours — un tri faux est pire qu'une date absente.
_MIN_YEAR = 1900
_MAX_FUTURE = timedelta(days=2)


def _parse_offset(raw) -> dt_timezone | None:
    """« +02:00 » → fuseau fixe. ``None`` si absent ou illisible."""
    if not isinstance(raw, str):
        return None
    value = raw.strip()
    if len(value) != 6 or value[0] not in "+-" or value[3] != ":":
        return None
    try:
        hours, minutes = int(value[1:3]), int(value[4:6])
    except ValueError:
        return None
    if not (0 <= hours <= 14 and 0 <= minutes < 60):
        return None
    delta = timedelta(hours=hours, minutes=minutes)
    return dt_timezone(-delta if value[0] == "-" else delta)


def _naive_from_exif(raw) -> datetime | None:
    """« 2026:07:14 15:30:00 » → datetime naïf. ``None`` sur les valeurs vides."""
    if not isinstance(raw, str):
        return None
    value = raw.strip().rstrip("\x00").strip()
    # Beaucoup d'appareils écrivent le tag « à blanc » plutôt que de l'omettre.
    if not value or value.startswith("0000"):
        return None
    try:
        return datetime.strptime(value, _EXIF_DATE_FORMAT)
    except ValueError:
        return None


def taken_at_from_image(image: Image.Image, *, household) -> datetime | None:
    """Instant *aware* du déclenchement, ou ``None`` si l'image ne le dit pas.

    Le tag EXIF est une heure **locale sans fuseau**. ``OffsetTimeOriginal`` le donne
    quand il est présent ; sinon on interprète dans le fuseau du foyer — le choix le
    moins faux, et le seul cohérent avec la règle « le fuseau du foyer, et rien
    d'autre » (``core.timezones``).
    """
    try:
        exif = image.getexif()
    except Exception as exc:  # noqa: BLE001 — un EXIF corrompu ne doit rien casser
        logger.info("taken_at: cannot read exif: %s", exc)
        return None

    if not exif:
        return None

    try:
        ifd = exif.get_ifd(_EXIF_IFD)
    except Exception as exc:  # noqa: BLE001
        logger.info("taken_at: cannot read exif ifd: %s", exc)
        return None

    naive = _naive_from_exif(ifd.get(_DATETIME_ORIGINAL)) or _naive_from_exif(
        ifd.get(_DATETIME_DIGITIZED)
    )
    if naive is None:
        return None

    tz = _parse_offset(ifd.get(_OFFSET_TIME_ORIGINAL)) or household_tz(household)
    aware = naive.replace(tzinfo=tz)

    if aware.year < _MIN_YEAR or aware > timezone.now() + _MAX_FUTURE:
        logger.info("taken_at: implausible capture date %s, ignoring", aware.isoformat())
        return None

    return aware


def read_taken_at(file, *, household) -> datetime | None:
    """Lit la date de prise de vue d'un fichier ouvert, puis le rembobine.

    Fail-soft de bout en bout : un upload ne doit **jamais** échouer parce qu'une
    image porte un EXIF illisible. Le fichier est repositionné en 0 dans tous les cas,
    y compris en erreur — l'appelant écrit ensuite ce même objet dans le stockage.
    """
    try:
        file.seek(0)
        with Image.open(file) as image:
            return taken_at_from_image(image, household=household)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.info("taken_at: cannot open image: %s", exc)
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("taken_at: unexpected failure: %s", exc)
        return None
    finally:
        try:
            file.seek(0)
        except (OSError, ValueError):
            pass


__all__ = ["read_taken_at", "taken_at_from_image"]
