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

## 3bis. Réglages du dépôt (appliqués le 2026-07-31)

| Réglage | Avant | Après |
|---|---|---|
| Approbation des workflows de fork | `first_time_contributors` | `all_external_contributors` |
| `allowed_actions` | `all` | `selected` (GitHub + `anthropics/claude-code-action@*` + `gitleaks/gitleaks-action@*`) |
| `sha_pinning_required` | `false` | `true` |
| `default_workflow_permissions` | `read` | inchangé — déjà au minimum |

**L'ordre comptait.** `sha_pinning_required` **rejette** toute action référencée
par tag : l'activer avant d'avoir épinglé aurait cassé les quatre workflows, donc
le deploy. Les 11 références ont donc été résolues en SHA de commit *d'abord*
(avec le tag conservé en commentaire pour rester lisible), le réglage ensuite.
C'est exactement le piège annoncé au cadrage : *un dépôt bien gardé qui ne
déploie plus est une régression, pas un durcissement.*

À noter : **le job `deploy` n'utilise aucune action** — que des étapes `run:`.
Ce durcissement ne peut donc pas l'affecter, ce qui rend le risque nul de ce
côté-là.

`verified_allowed` est laissé à `false` : les actions « vérifiées » du Marketplace
sont un annuaire, pas une garantie. Deux patterns explicites valent mieux qu'une
catégorie ouverte.

### Protection de `main` : les tests deviennent bloquants, le push direct non

Ajouté : `required_status_checks` sur **Backend tests**, **Frontend lint &
build**, **Reverse-proxy resilience**. Jusqu'ici la CI pouvait être rouge et le
bouton *Merge* restait actif — rien n'empêchait de merger du code cassé.

Trois réglages volontairement laissés en l'état, et chacun pour une raison :

- **`enforce_admins: false`** — c'est ce qui préserve le workflow trunk-based de
  l'auteur : son push direct sur `main` continue de passer. La règle bloque le
  *merge d'une PR*, pas le travail quotidien.
- **`strict: false`** — exiger qu'une branche soit à jour avec `main` avant merge
  imposerait un rebase à chaque fois que `main` bouge. Du bruit pour un
  mainteneur seul.
- **`required_pull_request_reviews: null`** — se demander une revue à soi-même
  n'a pas de sens tant qu'on est seul.

`allow_force_pushes` et `allow_deletions` étaient déjà à `false`, ce qui est
l'essentiel une fois le dépôt public : personne ne peut réécrire ni supprimer
`main`.

Le job `gitleaks` n'est **pas** rendu bloquant pour l'instant : un check jamais
rapporté fige un merge en « waiting for status ». À ajouter une fois qu'il aura
tourné pour de vrai sur une PR.

Le jour où un contributeur obtient les droits d'écriture, deux choses changent en
même temps : `enforce_admins`, **et** la sortie du deploy hors du runner (cf. « le
vrai risque est social »).

## 4. Ménage

- Détrackés : `coverage.json`, `issues/tasks.md` (+ ajoutés au `.gitignore` avec
  `playwright-report/`, `test-results/`, `.claude/worktrees/`).
- Supprimés : `.github/agents/` et `.github/prompts/` — 12 gabarits *speckit*
  décrivant un workflow qui n'est pas celui du projet. Dont un
  `copilot-instructions.md` auto-généré le 2026-02-26, annonçant une arborescence
  `src/` / `tests/` qui n'a jamais existé ici : périmé **et** trompeur pour un
  visiteur.

## 5. `specs/` — supprimé

L'audit a soulevé **29 fichiers suivis** dans `specs/`
(`001-document-context-linking`, `002-settings-migration`,
`003-migrate-zones-parity`) : les *sorties* du même workflow speckit dont les
gabarits viennent d'être supprimés. Dernier travail réel en mars 2026, et le
sujet 001 recoupe le parcours 02.

Le vrai problème n'était pas leur présence mais leur **ambiguïté** : un visiteur
voyait à la racine deux systèmes de documentation, `specs/` et `docs/`, sans que
rien ne dise lequel fait foi. Un dépôt qui documente deux fois documente mal —
c'est « un compteur ne peut pas avoir deux définitions » appliqué à la doc.

Supprimés après arbitrage. **Rien n'est perdu** : les fichiers restent dans les
787 commits, récupérables par `git show <commit>:specs/…`. C'est précisément
l'argument qui rend la suppression sans risque — et c'est le même que celui qui a
fait conserver l'historique plutôt que repartir d'un dépôt neuf.
