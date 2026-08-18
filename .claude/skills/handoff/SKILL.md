---
name: handoff
description: Écrire la passation avant de vider le contexte — état du chantier en cours, ce qui a été tenté et n'a pas marché, prochaine action, pièges rencontrés. Écrit .claude/HANDOFF.md, relu automatiquement au démarrage de la session suivante. Utiliser quand l'utilisateur annonce qu'il va clear, s'arrêter au milieu d'un chantier, changer de sujet, ou demande une passation.
allowed-tools: Bash, Read, Write
---

# Handoff — écrire ce que la session suivante ne peut pas redécouvrir

Le contexte va disparaître. Une partie de ce qu'il contient se **retrouve toute
seule** — la branche, le diff, la PR, les tests qui passent : `git` et `gh` les
diront à la session suivante mieux que n'importe quelle note. Une autre partie
ne se retrouve **jamais** : les trois approches essayées qui n'ont pas marché,
la raison pour laquelle on a renoncé à la deuxième, le piège sur lequel on a
perdu quarante minutes.

**C'est cette seconde partie, et elle seule, qui justifie ce fichier.** Une
passation qui récite `git status` fait perdre son temps à celui qui la lit, et
au bout de trois fois il cesse de la lire.

## 1. D'abord : est-ce que ça va vraiment ici ?

Trois destinations, et se tromper est la façon habituelle de perdre l'info.

| Ce qu'on veut garder | Où ça va | Pourquoi |
|---|---|---|
| Un fait qui resservira dans six mois (piège d'environnement, contrainte de la stack) | `memory/` du projet | Rechargé à **chaque** session, pas seulement la prochaine |
| Un reliquat de lot, une dette, une idée | **Issue GitHub** | `CLAUDE.md` : *« une note de mémoire ne se priorise pas »* |
| L'état d'un chantier **en cours**, à reprendre tout de suite | `.claude/HANDOFF.md` ← ce skill | Éphémère par construction, meurt avec le chantier |

Si ce qu'on s'apprête à écrire tient dans les deux premières lignes, **écris-le
là-bas** et dis-le. Une passation n'est pas un fourre-tout : elle a une durée de
vie de quelques heures.

Et si le travail est **fini et livré**, il n'y a pas de passation à écrire —
dis-le, ne fabrique pas un fichier vide pour faire quelque chose.

## 2. Collecter le déterministe (un seul appel)

Ce relevé ne va pas dans la passation en tant que tel : il sert à **situer**, et
à éviter d'écrire de mémoire ce que la machine sait exactement.

```bash
git status -sb | head -1
git status -s | grep -v '^?? \.claude/'
git log main..HEAD --oneline 2>/dev/null | head -10
git stash list 2>/dev/null | head -5
gh pr list --head "$(git branch --show-current)" --state open \
  --json number,title,statusCheckRollup \
  --template '{{range .}}#{{.number}} {{.title}}{{"\n"}}{{end}}' 2>/dev/null
```

Le reste — ce qui a été tenté, pourquoi ça a échoué, ce qui vient ensuite — ne
se relève nulle part. Il est dans le contexte courant, et c'est **maintenant ou
jamais**.

## 3. Écrire `.claude/HANDOFF.md`

Un seul fichier, **écrasé** à chaque fois. Pas de dossier d'archives : un tas de
passations datées que personne ne relit est exactement le bruit qu'on cherche à
éviter.

```markdown
# Passation — <AAAA-MM-JJ HH:MM> — <branche>

## Où on en est
Deux ou trois phrases. Le but du chantier, et jusqu'où il est allé.
Rattacher à l'issue / la PR quand il y en a une (#NNN).

## Ce qui a été tenté et écarté
- <approche> → <pourquoi ça n'a pas marché>
La section qui compte. Sans elle, la session suivante refait les mêmes
trois heures et arrive à la même impasse.

## Prochaine action
Une action, concrète, exécutable. Pas « continuer le chantier ».

## Pièges rencontrés
Ce qui a coûté du temps et ne se voit pas dans le diff — commande à lancer
dans un ordre précis, service à redémarrer, test qui ment, dépendance
d'environnement.

## État du dépôt
Branche, WIP non commité, PR ouverte, tests verts ou non. Une ligne chacun.
```

**Omettre une section vide.** Une passation sans impasse à raconter est plus
courte, pas remplie de « RAS ».

## 4. Règles

- **Pas de recopie du diff.** `git diff` est là et sera plus à jour que la note.
  Écrire *l'intention* du changement, jamais son contenu.
- **Nommer les fichiers en chemins cliquables** (`apps/banking/queries.py`), pas
  « le fichier des requêtes ».
- **Une passation se rédige au passé et à l'impératif**, pas au conditionnel :
  celui qui la lit doit pouvoir agir sans arbitrer à nouveau.
- **Ne jamais y mettre de secret** — le fichier vit dans le dépôt (ignoré par
  git, mais présent sur le disque) et sera relu à voix haute au démarrage.

## 5. La consommer, puis la supprimer

Le hook `SessionStart` ([inject-handoff.sh](../../hooks/inject-handoff.sh))
réinjecte ce fichier au démarrage de la session suivante, avec son âge.

**Une passation lue et reprise se supprime** (`rm .claude/HANDOFF.md`) — dès que
son chantier repart ou qu'il est livré. Une passation de trois semaines qui
traîne redevient un `defaultValue` : elle a l'air d'une information et c'est du
bruit, et le suivant apprend à ne plus la lire.

Le hook le signale de lui-même au-delà de **7 jours**. Un signalement n'est pas
un ménage : c'est à la session qui le lit de trancher — reprendre, ou supprimer.
