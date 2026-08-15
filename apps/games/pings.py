"""Le ping du samedi pluvieux (parcours 31, lot 4).

Le seul crochet de notification du parcours, et il est **contextuel**. Un rappel
quotidien « et si vous jouiez ? » ne fait pas revenir un jeu : il apprend à
ignorer la cloche, et emporte avec lui la notification rare qui comptait. Ce
ping ne part que quand jouer est **effectivement** une bonne idée — un jour où
personne ne travaille, un temps qui garde les enfants dedans, une maison qui a
assez de pièces, et pas de partie déjà en cours.

Quatre conditions, donc, et **toutes** doivent être vraies :

1. **c'est le week-end**, dans le fuseau du foyer (jamais en UTC : un samedi
   commence à Paris deux heures avant qu'il commence pour le serveur) ;
2. **il pleut**, ou c'est annoncé — c'est ce qui distingue « ce serait bien » de
   « c'est le moment » ;
3. **le foyer a au moins trois pièces étiquetées** : une chasse à deux étapes
   n'en est pas une, et proposer un jeu qu'on ne peut pas composer est pire que
   se taire ;
4. **aucune chasse n'est en cours** — inviter à jouer quelqu'un qui joue déjà est
   la définition du bruit.

Et **le ping propose, il n'engage rien** : il n'écrit aucune chasse, il ouvre
l'écran de composition. Une chasse créée par une notification serait une chasse
que personne n'a voulue, avec des pièces que personne n'a choisies.

Dégradation silencieuse partout : pas de localisation, module météo coupé,
fournisseur injoignable → ``None``, donc rien ne part. Une invitation à jouer
n'est jamais assez importante pour produire une erreur.
"""
from __future__ import annotations

from datetime import date

from django.utils.translation import gettext as _

from .models import Hunt

#: Discriminateur `Notification.type` de la cloche. Déclaré dans l'énumération
#: comme tous les autres : `choices` n'est pas contraint en base et `.create()`
#: ne fait pas de `full_clean`, donc une string littérale persisterait très bien
#: — et vivrait hors de l'affichage admin et hors de `MUTABLE_TYPES`, ce qui est
#: exactement ce qui est arrivé à `weather_alert`.
NOTIFICATION_TYPE = "hunt_suggestion"

#: En dessous, il n'y a pas de parcours à composer.
MIN_ZONES = 3

#: Probabilité de précipitation à partir de laquelle on parle de pluie. Volontairement
#: haut : un ping qui part sur « 30 % de chance d'averse » part presque tous les
#: week-ends, et redevient le rappel périodique qu'on voulait éviter.
RAIN_PROBABILITY_THRESHOLD = 60


def build_hunt_suggestion_ping(household, user, *, today: date) -> str | None:
    """L'invitation à jouer, ou ``None`` — c'est-à-dire la plupart du temps."""
    if not _is_weekend(household, today):
        return None
    if Hunt.objects.filter(household=household, status=Hunt.Status.ACTIVE).exists():
        return None
    if _zone_count(household) < MIN_ZONES:
        return None
    if not _rain_expected(household, today):
        return None

    message = _(
        "🌧️ Rainy weekend — how about a treasure hunt? "
        "Pick a few rooms, write a riddle for each, and hide something at the end."
    )
    _notify_bell(household, user, today, message)
    return message


def _is_weekend(household, today: date) -> bool:
    """Samedi ou dimanche **chez le foyer**.

    ``today`` arrive déjà en date locale du foyer (c'est le contrat du tick), et
    c'est précisément pourquoi ce test ne recalcule rien : reconstruire la date
    ici avec ``date.today()`` ferait basculer le week-end au fuseau du serveur.
    """
    return today.weekday() >= 5


def _zone_count(household) -> int:
    from zones.models import Zone

    return Zone.objects.filter(household=household).count()


def _rain_expected(household, today: date) -> bool:
    """Pluie annoncée aujourd'hui chez le foyer, ``False`` sur tout le reste.

    Le module météo coupé, une localisation absente ou un fournisseur injoignable
    valent tous « non » — même défaut sûr que ``banking.rules.guess_internal`` et
    que le registre des capacités : une devinette optimiste ferait partir une
    invitation un samedi de grand soleil, et le ping perdrait le seul crédit qu'il
    a, celui d'arriver au bon moment.
    """
    if "weather" in (getattr(household, "disabled_modules", None) or []):
        return False
    if household.latitude is None or household.longitude is None:
        return False

    from weather import services as weather_services

    try:
        forecast = weather_services.get_forecast(household.latitude, household.longitude)
    except Exception:  # noqa: BLE001 — météo indisponible : on se tait, on n'échoue pas
        return False

    wanted = today.isoformat()
    for day in forecast.get("daily") or []:
        if str(day.get("date")) != wanted:
            continue
        try:
            probability = float(day.get("precipitation_probability_max"))
        except (TypeError, ValueError):
            return False
        return probability >= RAIN_PROBABILITY_THRESHOLD
    return False


def _notify_bell(household, user, today: date, message: str) -> None:
    """La cloche en plus du Telegram — un foyer qui n'a pas de bot doit voir
    l'invitation quand même. Dédupliqué sur le jour local du foyer : un renvoi
    Telegram ne doit pas produire une deuxième entrée."""
    from notifications.service import send

    day = today.isoformat()
    send(
        user,
        NOTIFICATION_TYPE,
        title=_("Rainy weekend"),
        body=message,
        # Mène à l'écran de composition, jamais à une chasse : le ping propose.
        url="/app/games",
        dedup_key=f"hunt:{day}",
        payload={"household_id": str(household.id), "day": day},
    )
