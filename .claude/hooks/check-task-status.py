#!/usr/bin/env python3
"""Exige un statut de fin de tâche quand la session a modifié quelque chose.

Règle projet : CLAUDE.md § « Fin de tâche — un statut, pas une impression ».

Hook `Stop` : exit 2 empêche la session de se clore et renvoie le message stderr
à Claude, qui reprend la main pour conclure.

Trois décisions de conception, chacune contre un mode d'échec précis :

1. **Il ne se déclenche que si le dépôt a bougé.** Un tour purement
   conversationnel — une question, une explication, une lecture — n'a rien à
   conclure. Un garde-fou qui réclame un statut après « c'est quoi ce fichier ? »
   se fait désactiver dans la semaine.
2. **Il ne réclame jamais deux fois.** `stop_hook_active` vaut vrai au tour
   suivant et le hook rend la main quoi qu'il arrive : il rappelle, il ne
   séquestre pas.
3. **Toute anomalie sort en 0.** Transcript illisible, JSON inattendu, chemin
   absent : un hook cassé ne doit pas rendre les sessions incloturables. Il
   échoue ouvert, jamais fermé.
"""

import json
import re
import sys

# Le statut se tape en majuscules : c'est ce qui en fait un marqueur délibéré,
# et non un « fini » attrapé au vol dans une phrase française ordinaire.
STATUS = re.compile(r"\b(FINI|BLOQUÉ|BLOQUE|CONTEXTE MANQUANT)\b")

WRITE_TOOLS = {"Edit", "Write", "NotebookEdit"}
SHIP = re.compile(r"git\s+commit|gh\s+pr\s+(?:create|merge)")

MESSAGE = (
    "Cette session a modifié le dépôt ({what}) sans annoncer de statut de fin.\n"
    "CLAUDE.md § « Fin de tâche » : conclure par FINI, FINI AVEC RÉSERVES, "
    "BLOQUÉ ou CONTEXTE MANQUANT.\n"
    "« Partiellement fait » n'est pas un statut. Dire aussi ce qu'il faut "
    "redémarrer, ou qu'il n'y a rien à redémarrer."
)


def scan(path):
    """Renvoie (dernier tour avec statut, dernier tour modifiant, quoi)."""
    last_status = last_change = -1
    what = ""
    with open(path, encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if entry.get("type") != "assistant":
                continue
            message = entry.get("message") or {}
            for block in message.get("content") or []:
                kind = block.get("type")
                if kind == "text":
                    if STATUS.search(block.get("text") or ""):
                        last_status = i
                elif kind == "tool_use":
                    name = block.get("name")
                    if name in WRITE_TOOLS:
                        last_change, what = i, name
                    elif name == "Bash":
                        command = (block.get("input") or {}).get("command") or ""
                        if SHIP.search(command):
                            last_change, what = i, "livraison git/gh"
    return last_status, last_change, what


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    if payload.get("stop_hook_active"):
        return 0

    transcript = payload.get("transcript_path")
    if not transcript:
        return 0

    try:
        last_status, last_change, what = scan(transcript)
    except OSError:
        return 0

    if last_change <= last_status:
        return 0

    print(MESSAGE.format(what=what), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
