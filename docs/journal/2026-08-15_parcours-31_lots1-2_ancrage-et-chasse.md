# 2026-08-15 — Parcours 31, lots 1 et 2 livrés

> Compte rendu d'implémentation. Ce document dit ce qui a été livré, **ce qui a
> résisté**, et comment chaque arbitrage a été tranché. Les décisions de *cadrage*
> sont dans le backlog ; celles-ci ont été prises **pendant** l'écriture, et
> aucune n'était prévue.

## Contexte

Cadrage puis implémentation du parcours 31 (« la chasse au trésor dans la
maison ») en une session, dans un worktree isolé — cinq autres sessions Claude
tournaient en parallèle sur le dépôt.

| | |
|---|---|
| Cadrage | `51d1255f` poussé direct sur `main` (docs seules) |
| Lot 1 — étiquettes QR de zone | PR **#616**, mergée, issue #608 fermée |
| Lot 2 — la chasse | PR **#617**, issue #609 |
| Lots 3 et 4 | **non faits** — #610, #611 restent ouvertes |

## Ce qui est livré

**Cadrage** — doc produit, fiche concept `ANCRAGE_PHYSIQUE.md` (prouver une
présence physique sans GPS ni compte), backlog en 4 lots, issue parente #607 +
4 issues de lot, et **user stories `CHAS-01` à `CHAS-16`** au glossaire, chacune
reprise dans son issue.

**Lot 1 — l'ancrage physique.** `Zone.qr_token` (jeton opaque, distinct de
l'UUID), planche d'étiquettes imprimable (`segno`, SVG rendus côté serveur),
route publique `/z/:token` résolue dans le SPA, rotation d'un jeton. 18 tests
backend, 4 specs Playwright. `CHAS-01/02/03` ✅.

**Lot 2 — le jeu.** App `apps/games` (`Hunt`, `HuntStep`), composition, lancement,
avancement par scan, révélation du trésor, module optionnel, écran de partie.
20 tests backend, 5 specs Playwright. `CHAS-04` → `CHAS-10` ✅.

Suites complètes : **4496 tests backend**, **344 tests front**, **9 specs E2E**
neuves — toutes vertes.

## Soucis rencontrés, et comment ils ont été tranchés

### 1. `reverse()` passait, le front prenait un 404

DRF construit `url_name` en remplaçant les underscores par des tirets
(`zone-print-sheet`) mais **sert** le nom de méthode tel quel (`print_sheet/`).
Tous les tests backend passaient — ils utilisent `reverse()` — pendant que le
front, qui écrit l'URL en dur, recevait un 404. Le défaut n'est apparu qu'en E2E.

**Tranché** : `url_path` explicite (`print-sheet`, `rotate-qr`) **plus** un test
qui épingle les **chemins littéraux**, pas les noms inversés
(`TestTheUrlsAreTheOnesTheFrontCalls`). Le test sur le nom ne prouvait rien.

### 2. La migration du jeton aurait donné le même à toutes les pièces

Django n'évalue le `default` d'une `AddField` **qu'une fois** et le pose sur
toutes les lignes par un unique `ALTER TABLE`. Avec un jeton unique par zone, la
migration naïve donnait soit une violation d'unicité, soit la même valeur partout
— une maison entière réduite à une seule pièce aux yeux du jeu.

**Tranché** : trois opérations (colonne nullable → `RunPython` qui **boucle** →
`AlterField` unique). Et **deux** tests, parce qu'un seul ne suffisait pas : le
test de comportement passe même sur une migration naïve (il n'y a pas de lignes
préexistantes en base de test), donc un second test lit la **forme** du fichier
de migration. Faute d'outillage de test de migration dans le projet, le test de
comportement annule le `NOT NULL` en SQL brut — DDL transactionnel sous
PostgreSQL, donc annulé à la sortie ; il a fallu un `SET CONSTRAINTS ALL
IMMEDIATE` d'abord, les FK différées bloquant l'`ALTER TABLE`.

### 3. Le garde-fou du projet a refusé le lot 1 en CI — et il avait raison

`invalidate.test.ts` interdit qu'un composant importe une fonction d'écriture de
`lib/api/`. `ZoneScanPage` appelait `scanZoneToken` en direct. J'avais lancé
`lint` et `tsc` en local, **pas** `npm run test -- --run` : la CI lance la suite
vitest complète, et c'est là que vivent les garde-fous i18n et fraîcheur.

**Tranché** : `useScanZoneToken` / `useZonePrintSheet` / `useRotateZoneQr` dans
`zones/hooks.ts`. La règle n'était pas cosmétique : au lot 2 ce même scan fait
avancer une chasse côté serveur, donc il **devait** pouvoir invalider `games`.
Le composant qui garde son chemin d'écriture est exactement celui qui l'oublie.

### 4. L'écran de victoire ne voyait jamais le trésor

La dernière étape fait passer la chasse en `done` — donc `GET /hunts/active/`
renvoie `null` à l'instant précis où il faut révéler le trésor. Le joueur
arrivait sur « aucune chasse en cours ». Trouvé par la spec E2E, invisible aux
tests unitaires qui interrogeaient le service et pas l'enchaînement d'écrans.

**Tranché** : `GET /hunts/{id}/play/`, et le front garde l'identifiant (`?hunt=`).
**Écarté** : renvoyer « la dernière chasse terminée depuis moins de N minutes » —
une constante arbitraire, invérifiable, et qui aurait fait réapparaître l'écran
de victoire au hasard. La nouvelle route réutilise le **même**
`HuntPlaySerializer` : une seule définition de ce qui est révélable.

### 5. `PROTECT` sur la zone a cassé le reseed de la base de démo

`HuntStep.zone` est `PROTECT` — supprimer une pièce ne doit pas amputer une partie
en silence. Mais `seed_demo_data --flush` supprime les zones : dès qu'un foyer
avait joué **une** fois, le flush levait `ProtectedError`, et **toute la suite
Playwright tombait au seed**, pas dans les tests. Le symptôme (« 3 specs rouges »)
ne désignait pas la cause.

**Tranché** : les chasses se suppriment **avant** les zones dans `_flush()`, avec
le commentaire qui dit pourquoi. Même famille que `BankTransaction.account` déjà
traité au même endroit — *un flush qui ne flushe pas est pire que pas de flush*.
Écarté : passer la FK en `SET_NULL`, qui aurait laissé des étapes sans pièce,
c'est-à-dire des chasses injouables et silencieuses.

### 6. Trois faux positifs dans mes propres tests

- Un test refusait que l'énigme **courante** apparaisse dans la réponse d'un
  mauvais scan. C'était trop strict : le téléphone l'affiche déjà, c'est celle
  qu'on cherche. Le secret, c'est la **pièce** — le test vérifie donc maintenant
  que ni le nom ni l'id de la zone visée ne sortent.
- Un test attendait un **toast**. Un toast s'auto-efface : le test devenait une
  course entre son délai et celui de Playwright. Remplacé par une assertion
  d'**état** (on est resté sur la liste, un seul bouton « Lancer » subsiste).
- Le catalogue i18n utilise l'apostrophe typographique (`’`), les sélecteurs
  Playwright écrits à la main la droite (`'`). Résolu par une regex.

### 7. Incident d'environnement : le `venv` partagé détruit à mi-parcours

En pleine session, `~/Code/perso/house/venv` est devenu un **lien symbolique vers
lui-même** : une session parallèle a lancé la commande de setup de worktree
(`ln -s <checkout>/venv venv`) **depuis la racine du checkout**. Tout est tombé
d'un coup — pytest, et Playwright dont le `webServer` référence
`venv/bin/python`. Symptôme trompeur : `npx playwright --version` sortait en 194
sans un mot, ce qui ressemblait à un blocage du bac à sable.

**Tranché** : venv recréé (`python3.12 -m venv` + `requirements/dev.txt`),
incident consigné en mémoire avec sa prévention (`[ -e venv ] || ln -s …`, et
vérifier `pwd`). À noter aussi : `npx` échoue dans cet environnement (résolution
réseau) — utiliser `./node_modules/.bin/playwright`.

### 8. Les docs de cadrage écrites dans le mauvais checkout

Les cinq fichiers de cadrage sont partis dans le checkout principal au lieu du
worktree — le piège déjà consigné en mémoire, et il a resservi. Rapatriés,
checkout principal restauré fichier par fichier, sans toucher au travail des
autres sessions.

## Décisions prises au-delà du cadrage

- **`HuntPlaySerializer` vs `HuntSerializer`** — le cadrage disait « masquer le
  trésor » ; l'implémentation en a fait **deux sérialiseurs**, parce que le parent
  qui compose doit voir ce qu'il écrit et que le téléphone qui circule ne le doit
  pas. La différence est du métier, pas de la présentation.
- **`position` en lecture seule côté API**, déduit de l'ordre du tableau — le
  cadrage ne le disait pas, et le client l'envoyait, ce qui produisait un 400 à la
  première création.
- **`useActiveHunt` rallume `refetchOnWindowFocus`** contre le défaut du
  `QueryClient` : c'est le seul écran du produit qu'on regarde pendant qu'un
  *autre* appareil écrit dedans.
- **Le scan hors partie reste un raccourci vers la pièce** ; pendant une chasse le
  même geste est un coup joué et renvoie vers l'écran de jeu. Un seul endpoint,
  deux lectures — c'est ce que le cadrage voulait dire par « étendre, pas
  dupliquer », et il fallait l'écrire pour s'en apercevoir.

## Ce qui reste (recette et suite)

- **Recette manuelle obligatoire** : imprimer la planche, coller une étiquette,
  scanner avec un vrai téléphone. La lisibilité d'un QR scotché près d'un
  interrupteur ne se teste pas en CI — `CHAS-01` n'est ✅ que sur la génération.
- **Lot 3 (#610)** — énigmes par l'assistant, `CapabilitySpec` + repli manuel.
- **Lot 4 (#611)** — rejouer en ordre mélangé + ping du samedi pluvieux.
- **Issue parente #607** reste ouverte jusqu'à la recette du foyer.
- Limite assumée : un enfant qui ouvrirait le composeur verrait le trésor. Le
  secret n'est protégé que sur la surface de jeu — c'était le modèle de menace
  retenu, il mérite d'être revu si le module sert à autre chose qu'un dimanche.
