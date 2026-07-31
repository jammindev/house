# 2026-07-31 — Parcours 28, lot 0 : audit de l'historique et durcissement CI

Trace de l'audit exigé par le critère 1 du [lot 0](../parcours/PARCOURS_28_BACKLOG_TECHNIQUE.md)
(issue #486). Le dépôt étant **public depuis le 2025-09-21**, il ne s'agissait pas
de préparer une ouverture mais de vérifier une exposition déjà en cours.

## 1. Scan de secrets sur l'historique complet

Outil : `gitleaks` 8.x, exécuté via Docker (aucun scanner n'était installé
localement) sur la totalité de l'historique, pas sur l'arbre courant.

```
787 commits scannés — 27,09 Mo — 4 détections
```

**Les quatre sont des faux positifs**, vérifiés un par un :

| # | Fichier | Commit | Verdict |
|---|---|---|---|
| 1-2 | `specs/001-settings-migration/contracts/user-change-password.md` | `957e4876` (2026-02-28) | Corps de requête d'exemple dans un contrat d'API : `"new_password": "MyNewS3cur3Pass"`. Mot de passe fictif de documentation. |
| 3-4 | `nextjs/src/lib/i18n/dictionaries/{en,fr}.json` | `44dab808` (2025-09-26) | Chaînes de traduction voisines de « Authenticator Device » / « authentification », attrapées par l'heuristique `generic-api-key`. Code `nextjs/` supprimé depuis. |

**Résultat : 0 secret réel sur 787 commits.** Ce que le cadrage supposait est
désormais vérifié — `.env*` et `media/` sont ignorés depuis le premier jour, et
rien n'est passé à travers.

Conséquence : **aucune réécriture d'historique n'est nécessaire.** Les 787
commits sont conservés tels quels.

Les deux commits sont allowlistés **par SHA** dans `.gitleaks.toml`, jamais par
chemin — un chemin allowlisté couvrirait aussi les fichiers futurs qui y
atterriraient, et cacherait donc un vrai secret le jour où il arriverait.

## 2. Recherche de données personnelles

- `git grep` sur `/Users/<login>` : **deux occurrences**, toutes deux dans
  `docs/journal/2026-03-09_parcours-02_cadrage_initial.md` — des liens Markdown
  écrits en chemin absolu vers un ancien emplacement du dépôt (`~/Dev/house`).
  Doublement à corriger : ils divulguaient le login local **et** ils étaient
  cassés depuis le déménagement des docs vers `docs/parcours/`. Remplacés par des
  liens relatifs.
- `docs/SYNC_CONTACTS_STRUCTURES.md` porte « Auteur : Benjamin Vandamme ». **Ce
  n'est pas une fuite mais une attribution** — la même qui figurera dans `LICENSE`
  et `AUTHORS` au lot 4. Conservée.
- Rappel de l'audit des issues (cadrage du même jour) : 232 issues, 0 image,
  0 donnée personnelle.

## 3. Durcissement de la CI

Deux risques identifiés au cadrage, tous deux dans la CI et non dans le code.

**Le runner self-hosted.** La structure était déjà saine et n'a pas été refondue :
un seul job (`deploy`) tourne sur le VPS, les trois autres sur `ubuntu-latest`,
et aucun `pull_request_target` n'existe nulle part. La garde a été rendue
**explicite** et complétée par `github.repository`, avec le raisonnement écrit
au-dessus du job — les trois conditions comptent, et une seule qui saute rouvre
la porte.

**Le déclencheur `@claude`.** C'était le vrai trou : `issue_comment` est ouvert à
tous par construction, donc n'importe qui pouvait consommer le quota Claude du
mainteneur en écrivant « @claude » dans un commentaire, sans jamais toucher au
code. Fermé par une garde sur `author_association` ∈ {OWNER, MEMBER,
COLLABORATOR}. `CONTRIBUTOR` est volontairement exclu : quelqu'un dont une PR a
été mergée une fois garderait sinon la clé pour toujours.

`claude-code-review.yml` n'était pas exposé (`workflow_dispatch` seul, qui exige
les droits d'écriture), mais son déclencheur `pull_request` commenté porte
désormais l'avertissement — la remise en service sans la garde reproduirait le
trou.

## 4. Ménage

- Détrackés : `coverage.json`, `issues/tasks.md` (+ ajoutés au `.gitignore` avec
  `playwright-report/`, `test-results/`, `.claude/worktrees/`).
- Supprimés : `.github/agents/` et `.github/prompts/` — 12 gabarits *speckit*
  décrivant un workflow qui n'est pas celui du projet. Dont un
  `copilot-instructions.md` auto-généré le 2026-02-26, annonçant une arborescence
  `src/` / `tests/` qui n'a jamais existé ici : périmé **et** trompeur pour un
  visiteur.

## 5. Ce que l'audit a soulevé et qui reste à arbitrer

`specs/` contient encore **29 fichiers suivis** (`001-document-context-linking`,
`002-settings-migration`, `003-migrate-zones-parity`) — les *sorties* du même
workflow speckit dont les gabarits viennent d'être supprimés. Dernier travail réel
en mars 2026. Le sujet 001 recoupe le parcours 02.

Ce n'est pas un gabarit mais du contenu, donc pas supprimé unilatéralement. Le
point à trancher : un visiteur voit à la racine **deux systèmes de documentation**,
`specs/` et `docs/parcours/`, dont un seul est vivant.
