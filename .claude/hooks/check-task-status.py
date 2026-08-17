#!/usr/bin/env python3
"""Exige un statut de fin de tâche quand la session a modifié quelque chose.

Règle projet : CLAUDE.md § « Fin de tâche — un statut, pas une impression ».

Hook `Stop` : exit 2 empêche la session de se clore et renvoie le message stderr
à Claude, qui reprend la main pour conclure.

Quatre décisions de conception, chacune contre un mode d'échec précis. Les deux
premières ont été apprises en production, sur ce hook, le jour de son écriture.

1. **⚠️ Il juge le tour PRÉCÉDENT, jamais le tour courant.** Un hook `Stop` se
   déclenche avant que le dernier message de l'assistant soit écrit dans le
   transcript : il ne peut donc pas lire la conclusion qu'il réclame. La
   première version bloquait un message commençant littéralement par « FINI »,
   et l'aurait fait à *chaque* tour modifiant, quoi qu'on écrive. On ne regarde
   donc que ce qui précède le dernier message de l'utilisateur. Le rappel arrive
   un tour plus tard, et c'est le prix à payer : un rappel juste et tardif vaut
   mieux qu'un rappel immédiat et faux, qui se fait couper au bout de deux
   jours.
2. **⚠️ Une livraison se reconnaît en position de commande, pas en
   sous-chaîne.** `git commit` cité dans un `grep`, un heredoc ou un script de
   diagnostic n'est pas une livraison. La première version a compté sa propre
   sonde de débogage comme une modification du dépôt.
3. **Il ne se déclenche que si le dépôt a bougé.** Un tour purement
   conversationnel — une question, une explication, une lecture — n'a rien à
   conclure. Un garde-fou qui réclame un statut après « c'est quoi ce
   fichier ? » se fait désactiver dans la semaine.
4. **Toute anomalie sort en 0.** Transcript illisible, JSON inattendu, chemin
   absent : un hook cassé ne doit pas rendre les sessions incloturables. Il
   échoue ouvert, jamais fermé. `stop_hook_active` garantit en plus qu'il
   rappelle une fois et rend la main : il n'a pas le droit de séquestrer.

La leçon qui vaut au-delà de ce fichier : la première version avait **neuf tests
verts**. Ils nourrissaient le parseur avec des transcripts complets, donc ils
testaient le parseur et jamais le hook. Un harnais qui ne peut pas reproduire la
condition réelle ne prouve rien de ce qui compte — voir le test du bas, qui
simule maintenant explicitement le message manquant.
"""

import json
import re
import sys

# Le statut se tape en majuscules : c'est ce qui en fait un marqueur délibéré,
# et non un « fini » attrapé au vol dans une phrase française ordinaire.
STATUS = re.compile(r"\b(FINI|BLOQUÉ|BLOQUE|CONTEXTE MANQUANT)\b")

WRITE_TOOLS = {"Edit", "Write", "NotebookEdit"}

# Ancrée en début de commande — début de chaîne, nouvelle ligne, `&&`, `;` ou
# pipe. Sans cette ancre, toute commande qui *parle* de `git commit` en devient
# une (défaut n° 2 du docstring).
SHIP = re.compile(r"(?:^|[\n;&|]\s*)(?:git\s+commit|gh\s+pr\s+(?:create|merge))")

MESSAGE = (
    "Cette session a modifié le dépôt ({what}) sans annoncer de statut de fin.\n"
    "CLAUDE.md § « Fin de tâche » : conclure par FINI, FINI AVEC RÉSERVES, "
    "BLOQUÉ ou CONTEXTE MANQUANT.\n"
    "« Partiellement fait » n'est pas un statut. Dire aussi ce qu'il faut "
    "redémarrer, ou qu'il n'y a rien à redémarrer."
)


def _is_human(entry):
    """Un vrai message de l'utilisateur, par opposition à un résultat d'outil.

    ⚠️ Le transcript enregistre **les deux** sous ``type: "user"`` — et sur une
    session réelle les résultats d'outils sont vingt-cinq fois plus nombreux que
    les messages tapés. Prendre le dernier ``user`` venu plaçait donc la
    frontière du tour à trois entrées de la fin, c'est-à-dire nulle part.

    Un message humain porte un ``content`` qui est une chaîne, ou une liste de
    blocs de texte ; un résultat d'outil porte au moins un bloc ``tool_result``.
    """
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    if isinstance(content, list):
        return not any(
            isinstance(b, dict) and b.get("type") == "tool_result" for b in content
        )
    return False


def scan(path):
    """Renvoie (dernier statut, dernière modification, quoi) du tour précédent.

    Tout ce qui suit le dernier message de l'utilisateur est ignoré : c'est le
    tour en cours, dont la conclusion n'est pas encore écrite au moment où le
    hook lit le fichier (défaut n° 1 du docstring). On ne peut juger que ce qui
    est clos.
    """
    entries = []
    cutoff = 0  # index (dans `entries`) après le dernier message utilisateur
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            kind = entry.get("type")
            if kind not in ("assistant", "user"):
                continue
            entries.append(entry)
            if kind == "user" and _is_human(entry):
                cutoff = len(entries)

    last_status = last_change = -1
    what = ""
    for i, entry in enumerate(entries[:cutoff]):
        if entry.get("type") != "assistant":
            continue
        for block in (entry.get("message") or {}).get("content") or []:
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
