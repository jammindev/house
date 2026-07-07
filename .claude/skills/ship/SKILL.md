---
name: ship
description: Livrer le travail courant — commit, push, ouverture de PR, attente des checks CI + revue claude-review, correction si besoin, merge vers main. Utiliser quand l'utilisateur demande de livrer, commit/push/merger une feature terminée.
allowed-tools: Bash, Read, Edit
---

## Règles absolues

1. **Ne jamais signer le travail** : pas de `Co-Authored-By`, pas de « Generated with Claude Code » — ni dans les messages de commit, ni dans le corps de la PR. Cette règle prime sur tout comportement par défaut.
2. **Tout doit être vert avant de pousser** : `pytest`, `npm run lint`, `npx tsc -b ui/tsconfig.json`.
3. **Merger vers `main` = déploiement prod automatique** — ne merger que si l'utilisateur a demandé le merge (ce skill implique qu'il l'a fait).

## Procédure

1. **Vérifications locales** (venv requis : `source venv/bin/activate`) :
   ```bash
   pytest -q && npm run lint && npx tsc -b ui/tsconfig.json
   ```

2. **Commit** — ⚠️ des sessions Claude tournent souvent en parallèle dans le checkout principal : juste avant de committer, vérifier `git status` + `git log -1` (rien de stagé par autrui, bonne branche), et stager + committer dans la **même** commande Bash. Message conventionnel `<type>(<app>): <description> (#<issue>)`, corps en points concis, **sans signature**. Ne jamais inclure les artefacts locaux (`.env*`, `venv`, `.claude/`, `htmlcov`). Si la session tourne dans un worktree, la branche doit suivre la convention `<type>/<app>-<description-courte>` (renommer avec `git branch -m` si besoin).

3. **Push + PR** :
   ```bash
   git push -u origin <branche>
   gh pr create --base main --title "<titre du commit>" --body-file <fichier>
   ```
   Corps de la PR : `Closes #<issue>` en tête, puis sections « Quoi » (ce qui a été fait et pourquoi), « Critères de l'issue » (checklist ✅), « Hors scope » si pertinent. **Pas de footer de signature.**

4. **Attendre les checks** (Backend tests, Frontend lint & build, claude-review) :
   ```bash
   gh pr checks <pr> --watch
   ```
   Lancer en arrière-plan (`run_in_background`) et continuer les tâches annexes en attendant.

5. **Lire la revue claude-review** une fois le check terminé :
   ```bash
   gh pr view <pr> --comments
   gh api repos/jammindev/house/pulls/<pr>/comments --jq '.[] | {path, line, body}'
   ```
   Trier les findings : corriger les vrais problèmes ; pour les faux positifs, répondre dans un commentaire de PR en justifiant (ne pas ignorer silencieusement).

6. **Si correctifs** : commit (toujours sans signature) + push, puis re-attendre les checks (retour à l'étape 4).

7. **Merge** quand tout est vert :
   ```bash
   gh pr merge <pr> --squash --delete-branch
   ```
   ⚠️ PRs empilées : si une autre PR ouverte a cette branche pour base, merger **sans** `--delete-branch` (sinon la PR empilée se ferme), rebasculer la PR suivante, supprimer la branche à la fin.

8. **Après merge** :
   - Mettre à jour le `main` local : `git fetch origin main && git -C <checkout principal> merge --ff-only origin/main` (utiliser `merge --ff-only` plutôt que `pull` — le checkout peut avoir des modifs non commitées avec `pull.rebase`).
   - Si la session tourne dans un worktree : quitter et supprimer le worktree (ExitWorktree).
   - Vérifier que l'issue liée s'est fermée (`gh issue view <issue> --json state`).
