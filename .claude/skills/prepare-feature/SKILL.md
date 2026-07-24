---
name: prepare-feature
description: Cadrer un chantier AVANT de coder — produire la doc produit (parcours), la fiche concept (cours/leçon), le backlog technique découpé en lots et les issues GitHub. Ne produit AUCUN code. Utiliser quand l'utilisateur demande de préparer / cadrer / spécifier un chantier, une feature ou un module, ou de « préparer la doc + specs + github ».
---

# Préparer une feature — cadrage, doc, specs, GitHub (zéro code)

Ce skill couvre la **phase amont** d'un chantier : transformer une idée en un
plan exécutable — doc produit, fiche concept pédagogique, backlog technique
découpé en lots, et issues GitHub — **sans écrire une ligne de code applicatif**.
L'implémentation vient après, avec le skill `/new-feature`.

**Règle d'or : le livrable est de la doc.** Ne créer aucun fichier dans `apps/`
ou `ui/`, aucune migration, aucun test. Si l'envie de coder apparaît, s'arrêter :
ce n'est pas ce skill. Corollaire pour le backlog : décrire les **chemins de
fichiers et les signatures** (nom de service, champs d'un modèle, endpoints), mais
**jamais de corps de fonction** — figer l'implémentation ici retire à
`/new-feature` les choix qui lui reviennent.

## Deux natures de chantier

- **Chantier métier** — ajoute un usage utilisateur (nouveau module, nouvelle
  entité). Ex : trackers (parcours 11), repas/courses (parcours 22).
- **Chantier technique transverse** — renforce le socle sans surface UI nouvelle.
  Ex : recherche sémantique hybride / embeddings (parcours 21). Le positionnement
  produit y est un **investissement de plateforme**, pas une feature visible.

Le découpage change peu ; le ton de la doc produit, si.

## Étape 0 — Cadrer par la conversation

Avant d'écrire, verrouiller avec l'utilisateur (poser les questions manquantes,
ne pas inventer) :

- **Le problème utilisateur en une phrase** — idéalement une citation (« Je pose
  une question avec *mes* mots, mais mes docs utilisent *d'autres* mots »).
- **Périmètre V1** vs différé — ce qu'on ne fait *pas* est aussi important.
- **Concept non-trivial ?** — le chantier introduit-il une notion qui mérite une
  fiche (cf. Étape 2) ? Sinon, sauter cette étape.
- **Numéro de parcours** — prendre le prochain libre :
  `ls docs/parcours/ | grep -oE 'PARCOURS_[0-9]+' | sort -u | tail`.
- **Module(s) touché(s)** → détermine les labels `app:<module>` des issues.

Ne pas produire de doc tant que le problème et le périmètre V1 ne sont pas clairs.

## Étape 1 — Doc produit / vision (`PARCOURS_NN_<NOM>.md`)

Fichier `docs/parcours/PARCOURS_NN_<NOM_EN_MAJUSCULES>.md`. Répliquer les
conventions d'un parcours récent (lire `PARCOURS_21_*` pour un chantier technique,
`PARCOURS_11_TRACKER_DES_VALEURS.md` pour un chantier métier). Squelette :

1. **En-tête** — une phrase de cadrage (métier ou technique transverse), + liens
   vers la fiche concept et le backlog technique (créés aux étapes suivantes).
2. **Résumé** — le problème sous forme de citation, puis la solution en 2-3 §.
3. **Positionnement produit** — pourquoi maintenant, quelle limite ça lève.
4. **Ce que l'utilisateur gagne** — tableau `Question | Aujourd'hui | Après` ou
   scénarios concrets.
5. **Ce qu'on ne fait pas en V1** — le périmètre différé, explicitement.

Prose grand-public, ancrée sur des exemples du foyer réel.

## Étape 2 — Fiche concept / « le cours » (`docs/fiches/<CONCEPT>.md`)

**Uniquement si** le chantier intègre un concept non-trivial (RAG, embeddings,
full-text, registry pattern, pipeline OCR, observabilité…). Pas de fiche pour du
CRUD/formulaire. C'est la partie **cours/leçon** : elle sert l'apprentissage et
l'onboarding, elle cite les décisions et les alternatives écartées.

Squelette imposé (`docs/fiches/README.md`) :

1. Le problème — qu'est-ce qu'on cherche à résoudre ?
2. Le concept en deux phrases.
3. Comment on l'a appliqué dans house.
4. Pourquoi cette implémentation — décisions et trade-offs.
5. Ce qu'on a écarté et pourquoi.
6. Pour aller plus loin — liens externes.

Puis **mettre à jour l'index** `docs/fiches/README.md` (section Index) et
relier les fiches connexes entre elles (ex : `RAG.md` ↔ `EMBEDDINGS.md`).

## Étape 3 — Backlog technique (`PARCOURS_NN_BACKLOG_TECHNIQUE.md`)

Le plan d'exécution. Modèle de référence : `PARCOURS_11_BACKLOG_TECHNIQUE.md`.
Sections :

- **Tableau de bord** — `| Lot | Sujet | Statut | Issue |`. Statut initial
  « ⬜ À faire », colonne Issue remplie à l'étape 4.
- **Doc associée** — liens doc produit + fiche + patterns de référence
  (`apps/tasks/` pour le socle service/agent, CLAUDE.md sections pertinentes).
- **Flow cible** — le parcours technique de bout en bout.
- **Décisions de cadrage** — tranchées, avec justification courte.
- **Un `## Lot N — <titre> (#issue)` par lot**, chacun avec : **But**, **Fichiers**
  (chemins précis à créer/modifier ; signatures, pas de corps de fonction),
  **Critères** d'acceptation.
- **Ordre recommandé d'implémentation**.
- **Points de vigilance**.
- **Définition de done technique** — liste numérotée, testable, incluant
  toujours : i18n 4 langues, lint propre, `pytest` vert, **fiche
  `docs/MODULES/<app>.md` créée/à jour** et **tutoriels** (`/tutorials`) si le
  chantier change le parcours utilisateur. Ces deux derniers sont les livrables
  que `/new-feature` produit à son Étape 4 : les nommer ici garantit qu'ils ne
  tombent pas entre les deux skills.

**Découpage en lots** : un lot = une unité livrable indépendamment, alignée sur
les faces du projet — typiquement `socle backend` / `services + API` / `frontend`
/ `embed dans une entité` / `intégration agent`. Un lot = une issue.

## Étape 4 — Issues GitHub

D'abord **l'issue parente** (ombrelle du parcours) : elle chapeaute les lots,
porte le lien vers la doc produit et sert de point de fermeture une fois la recette
finie (modèle : `#51` pour le parcours 07). Titre `Parcours NN — <nom du chantier>`.
Puis **une issue par lot**, chacune reliée à la parente (« Lot du #<parente> »).

Vérifier les labels existants (`gh label list`) avant d'en inventer ; créer un
`app:<module>` manquant seulement si nécessaire.

```bash
gh issue create \
  --title "Parcours NN — Lot X : <sujet>" \
  --label feat --label "app:<module>" \
  --body "$(cat <<'EOF'
<But du lot, repris du backlog.>

**Fichiers** : ...
**Critères** : ...

Backlog : docs/parcours/PARCOURS_NN_BACKLOG_TECHNIQUE.md
EOF
)"
```

Conventions labels : `feat` (métier) ou `docs`/`refactor`/`perf` selon la nature ;
`app:<module>` pour chaque module touché ; `i18n` si l'UI ajoute du texte ; `idea`
pour une issue « annexe » de sujets V2 délibérément différés. Après création,
**reporter les numéros d'issue** dans le Tableau de bord du backlog.

## Étape 5 — Câblage et index

- Relier **doc produit ↔ fiche ↔ backlog ↔ issues** (liens croisés dans les 3
  docs).
- Mettre à jour les fiches connexes déjà existantes (ex : ajouter dans `RAG.md`
  un renvoi vers le nouveau chantier).
- Si le chantier change les priorités : mettre à jour `docs/NEXT_STEPS.md` et/ou
  ajouter une entrée dans `docs/JOURNAL_PRODUIT.md` (+ `docs/journal/` daté).

## Étape 6 — Commit de la doc

La doc de cadrage se commit (pas de code = commit direct sur `main` acceptable, ou
petite branche si l'utilisateur préfère). Type conventionnel `docs(<scope>):` —
**ignoré du changelog** (interne), c'est voulu.

## Étape 7 — Checkpoint de validation (stop obligatoire)

Le cadrage propage ses choix sur **tous** les lots : une erreur non détectée ici
se paie N fois à l'implémentation. Donc, cadrage terminé :

1. Présenter à l'utilisateur une **synthèse** : problème, périmètre V1/différé,
   liste des lots et leur ordre.
2. **S'arrêter et attendre son feu vert.** Ne pas enchaîner sur `/new-feature`
   ni sur du code dans la même passe.

L'implémentation d'un lot se fait ensuite avec **`/new-feature`**, qui consomme ce
backlog comme point de départ (son Étape 0 renvoie ici). Ce skill ne code jamais
lui-même.

## Check final

- [ ] Aucun fichier applicatif touché (`apps/`, `ui/`, migrations) — que de la doc
- [ ] Problème utilisateur formulé en citation dans la doc produit
- [ ] Périmètre V1 vs différé explicite
- [ ] Fiche concept créée **si** concept non-trivial, index `fiches/README.md` à jour
- [ ] Backlog découpé en lots livrables, chacun avec Fichiers + Critères (fiche MODULES + tutoriels dans la définition de done)
- [ ] Issue parente + une issue par lot, labels corrects, numéros reportés au Tableau de bord
- [ ] Liens croisés doc produit ↔ fiche ↔ backlog ↔ issues en place
- [ ] Synthèse présentée à l'utilisateur, feu vert obtenu avant tout code
