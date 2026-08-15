"""Des énigmes proposées par le modèle — et jamais écrites en base (lot 3).

Ce que ce module supprime, ce sont **les vingt minutes de préparation** qui font
qu'une chasse se joue deux fois puis plus jamais. « Va dans la salle de bain »
n'amuse personne ; « je suis là où l'eau chante le matin » si — et c'est
exactement ce qu'un modèle sait produire à partir d'un nom de pièce.

Trois décisions structurent le fichier, et chacune répond à une façon précise de
se tromper :

1. **Un seul appel pour toutes les pièces.** Une chasse de six étapes ferait
   sinon six allers-retours, six fois la latence, six fois la facture — et
   surtout six énigmes écrites *dans l'ignorance les unes des autres*, donc deux
   fois la même image sur deux pièces différentes. Le modèle a besoin de voir la
   maison entière pour ne pas se répéter.
2. **La forme se vérifie, elle ne se devine pas.** Une réponse mal formée lève
   ``ValueError`` et n'écrit **rien** : mieux vaut un refus lisible qu'une chasse
   dont trois étapes sur six portent une énigme. Même arbitrage que
   ``recap.polish._parse`` — un résultat à moitié appliqué se lit plus mal
   qu'aucun résultat.
3. **Rien ne touche la base.** La fonction rend des textes ; c'est le composeur
   qui les affiche, le parent qui les corrige, et l'enregistrement de la chasse
   qui les persiste. La relecture n'est pas une option de confort : un modèle qui
   écrirait directement dans une chasse pourrait désigner la mauvaise pièce, et
   personne ne s'en apercevrait avant que l'enfant tourne en rond.

Le client passe par ``agent.llm.get_llm_client()``, **jamais** par un
``anthropic.Anthropic()`` instancié sur place : c'est lui qui journalise l'appel
dans ``AIUsageLog``, applique le timeout de l'instance, et reste le seul endroit
qui décide quel fournisseur répond.
"""
from __future__ import annotations

import json
import logging

from django.utils import translation

from agent.llm import get_llm_client

logger = logging.getLogger(__name__)

#: Au-delà, ce n'est plus une chasse au trésor — et le prompt cesserait de tenir
#: dans une réponse courte. La borne existe pour que le refus soit lisible plutôt
#: que pour brider un usage réel : un foyer ne colle pas trente étiquettes.
MAX_ZONES = 20

#: Tranches d'âge proposées à l'écran. Ce n'est pas un détail cosmétique : la
#: même pièce demande une métaphore transparente à cinq ans et une devinette
#: retorse à douze, et une chasse au mauvais niveau se solde par des enfants qui
#: abandonnent ou qui s'ennuient.
AGE_BANDS = {
    'small': "4-6 years old: very simple, concrete, one obvious clue about the room's use",
    'medium': "7-9 years old: a short riddle with one image or a play on words",
    'big': "10-13 years old: a real riddle, indirect, allowed to be a little tricky",
}
DEFAULT_AGE = 'medium'

_SYSTEM = (
    "You write riddles for a family treasure hunt played inside a real house. "
    "You receive a JSON array of rooms, each with an index and a name. For EACH "
    "room, write one riddle that points at THAT room without ever naming it. "
    "Reply with ONLY a JSON array of objects [{\"index\": <int>, \"riddle\": "
    "\"<text>\"}], one entry per room, same indexes as the input, in the same "
    "order. Each riddle is one or two short sentences, in the language given "
    "below, playful, and never repeats an image already used for another room. "
    "No markdown, no preamble, no extra keys, no explanation."
)


def generate_riddles(household, zones, *, age: str = DEFAULT_AGE, language: str | None = None,
                     user=None) -> list[str]:
    """Une énigme par pièce, dans l'ordre reçu — sans rien écrire en base.

    ``zones`` est une séquence de ``zones.Zone`` **déjà scopées au foyer** par
    l'appelant. Lève ``ValueError`` sur une entrée vide, une liste trop longue,
    ou une réponse du modèle dont la forme ne colle pas.
    """
    rooms = list(zones)
    if not rooms:
        raise ValueError("At least one room is needed to write riddles.")
    if len(rooms) > MAX_ZONES:
        raise ValueError(f"A hunt cannot exceed {MAX_ZONES} rooms.")

    # La langue de génération est celle de **l'utilisateur qui compose**, pas
    # celle du serveur : c'est lui qui relira, et un foyer francophone recevant
    # six énigmes en anglais n'a rien gagné sur la saisie manuelle.
    lang = language or translation.get_language() or "en"
    band = AGE_BANDS.get(age, AGE_BANDS[DEFAULT_AGE])

    payload = [{"index": index, "name": zone.name} for index, zone in enumerate(rooms)]
    user_message = (
        f"Language for the riddles: {lang}\n"
        f"Audience: {band}\n\n"
        f"Rooms:\n{json.dumps(payload, ensure_ascii=False)}"
    )

    client = get_llm_client()
    response = client.complete(
        system=_SYSTEM,
        user=user_message,
        feature="hunt_riddles",
        household_id=household.id,
        user_id=getattr(user, 'id', None),
        # ~60 tokens par énigme, large : une réponse tronquée casse le JSON, donc
        # elle ne coûte pas une énigme en moins, elle coûte la génération entière.
        max_tokens=120 * len(rooms) + 200,
        metadata={"rooms": len(rooms), "age": age, "language": lang},
    )
    return _parse(response.text, expected=len(rooms))


def _parse(text: str, *, expected: int) -> list[str]:
    """Valide la réponse : un objet par pièce, des index complets, du texte réel.

    Tout écart lève ``ValueError``. On ne « rattrape » pas une réponse partielle
    en complétant les trous par des chaînes vides : l'écran afficherait des
    champs remplis à moitié sans dire lesquels viennent du modèle, et le parent
    lancerait une chasse dont deux étapes ne disent rien.
    """
    body = (text or "").strip()
    if not body:
        raise ValueError("The model returned nothing.")
    # On tolère un bloc de code fencé — c'est le seul écart de forme qu'un modèle
    # produit encore régulièrement, et il ne change pas le contenu.
    if body.startswith("```"):
        body = body.strip("`")
        body = body.split("\n", 1)[1] if "\n" in body else ""

    try:
        parsed = json.loads(body)
    except (ValueError, TypeError) as exc:
        logger.warning("games: riddle generation returned non-JSON (%s)", exc)
        raise ValueError("The model did not answer with valid JSON.") from exc

    if not isinstance(parsed, list) or len(parsed) != expected:
        raise ValueError("The model did not return one riddle per room.")

    riddles: dict[int, str] = {}
    for entry in parsed:
        if not isinstance(entry, dict):
            raise ValueError("The model returned an unexpected shape.")
        index = entry.get("index")
        riddle = entry.get("riddle")
        if not isinstance(index, int) or not isinstance(riddle, str) or not riddle.strip():
            raise ValueError("The model returned an unexpected shape.")
        riddles[index] = riddle.strip()

    if set(riddles) != set(range(expected)):
        raise ValueError("The model skipped or duplicated a room.")

    return [riddles[index] for index in range(expected)]
