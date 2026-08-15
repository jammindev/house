# Parcours 31 — Backlog technique V1

> **Cadré le 2026-08-15.** L'implémentation d'un lot se fait avec le skill
> `/new-feature`, qui consomme ce document comme point de départ.

## Tableau de bord

Issue parente : **#607**.

| Lot | Sujet | Statut | Issue |
|---|---|---|---|
| 1 | Étiquettes QR de zone — jeton, planche d'impression, route de scan | ⬜ À faire | #608 |
| 2 | La chasse — `apps/games`, session serveur, avancement par scan | ⬜ À faire | #609 |
| 3 | Énigmes par l'assistant — capability, génération, relecture | ⬜ À faire | #610 |
| 4 | Rejouer + ping du samedi pluvieux | ⬜ À faire | #611 |

## Doc associée

- Doc produit : [PARCOURS_31_LA_CHASSE_AU_TRESOR.md](./PARCOURS_31_LA_CHASSE_AU_TRESOR.md)
- Fiche concept : [ANCRAGE_PHYSIQUE.md](../fiches/ANCRAGE_PHYSIQUE.md) — **à lire
  avant le lot 1**
- User stories : [USER_STORIES.md](../USER_STORIES.md) — `CHAS-01` à `CHAS-16`
- `CLAUDE.md` — « Pattern standard — Feature page », « Capacités optionnelles »,
  « Notifications », « Fraîcheur des données », « Dates de calendrier »
- Patterns de référence : `apps/households/` (jeton d'invitation + route publique
  `/join/:token`), `apps/chickens/` (module optionnel complet), `apps/pings/`
  (PingSpec), `apps/app_settings/capabilities.py` (capability + 503 nommé)

## Flow cible

1. le foyer imprime une planche d'étiquettes et en colle une par pièce
2. scanner une étiquette hors partie ouvre la zone dans l'app
3. un parent compose une chasse : pièces, ordre, énigmes, texte du trésor
4. il lance ; le téléphone circule ; chaque scan juste dévoile l'énigme suivante
5. la dernière étape révèle le trésor et la durée de la partie
6. la chasse terminée se rejoue dans un ordre mélangé ; un samedi pluvieux, le
   foyer reçoit une invitation à jouer

## Décisions de cadrage

- **Le jeton est un champ de `Zone`, pas une table.** Une pièce a un et un seul
  ancrage physique ; une table `ZoneAnchor` n'ajouterait qu'une jointure. La
  rotation d'un jeton compromis se fait en place (`rotate_qr`).
- **Le jeton n'est jamais l'UUID de la zone**, et n'est **jamais** renvoyé par les
  endpoints de lecture ordinaires — seulement par la planche d'impression. Voir la
  fiche : l'UUID circule déjà partout, s'en servir comme preuve publie la réponse.
- **`POST /api/zones/scan/` est la seule porte**, et elle est *étendue* au lot 2,
  jamais dupliquée. Le lot 1 renvoie la zone ; le lot 2 ajoute l'avancement de la
  chasse dans la même réponse. Deux endpoints de scan finiraient par se
  contredire sur « qu'est-ce qu'un scan valide ».
- **La chasse est une session de foyer, pas un état par utilisateur.** Une seule
  chasse `active` par foyer (index unique partiel). Aucun `user` sur les étapes :
  on n'enregistre pas qui a scanné (cf. doc produit, § V1).
- **L'état vit en base, jamais en `localStorage`.** C'est ce qui permet au
  téléphone de changer de main, à l'app de se recharger, et au parent de suivre
  depuis son propre écran.
- **Le serveur tranche « bonne pièce ou non ».** Aucun calcul d'avancement côté
  client.
- **Un mauvais scan ne révèle rien et n'écrit rien.** Ni la bonne pièce, ni le
  nombre d'étapes restantes — sinon la triche consiste à scanner toute la maison.
- **Les étapes sont ordonnées et se franchissent en ordre.** Une chasse est une
  chaîne : scanner l'étape 4 quand on est à la 2 répond « pas ici ».
- **QR rendus côté serveur** (`segno`, Python pur) : pas de dépendance JS pour un
  écran ouvert une fois par foyer.
- **L'URL du QR réutilise `settings.FRONTEND_URL`**, comme le lien d'invitation.
  Une seule définition de « l'adresse publique de cette instance ».
- **Module `games` optionnel**, groupe `home`. Le **lot 1 n'est pas dans le
  module** : il est rattaché aux zones (core), et reste utile si le foyer désactive
  les jeux.
- **La génération d'énigmes est capability-gated**, avec repli manuel intégral.
  Une instance sans clé Anthropic doit pouvoir jouer — seule l'aide à l'écriture
  disparaît.
- **Le ping propose, il n'engage rien.** Il ne crée aucune chasse : il ouvre
  l'écran de composition.

## Lot 1 — Étiquettes QR de zone (#TBD)

### But

Ancrer chaque pièce dans le monde physique. **Livrable utile seul** : scanner
l'étiquette du garage ouvre le garage dans l'app, même si le jeu n'existe jamais.

### Backend

- `apps/zones/models.py` : `generate_zone_token()` (`secrets.token_urlsafe(32)`,
  copie du patron de `households.models.generate_invitation_token`) et champ
  `Zone.qr_token` — `CharField(max_length=64, unique=True, editable=False,
  default=generate_zone_token)`.
- Migrations : `0001` schéma + **`0002` data migration** rétro-remplissant les
  zones existantes avec un jeton distinct chacune (jamais un `default` unique
  appliqué en masse — ce serait un jeton partagé par toutes les pièces).
- `apps/zones/services.py` : `resolve_qr_token(token) -> Zone` (lookup global, non
  scopé foyer — c'est le jeton qui désigne le foyer) et `rotate_qr_token(zone)`.
- `apps/zones/views.py` :
  - `POST /api/zones/scan/` — corps `{token}`. Répond `{zone: {...}}`. **404 si le
    jeton est inconnu ; 403 si la zone appartient à un autre foyer que le foyer
    actif de l'appelant** (message nommé : on ne joue pas chez les voisins).
  - `POST /api/zones/{id}/rotate_qr/` — régénère le jeton.
  - `GET /api/zones/print-sheet/` — liste `{zone_id, name, path, svg}` pour toutes
    les zones du foyer, `svg` rendu par `segno`, `path` = `/z/<token>`. **Le seul
    endpoint qui expose les jetons.**
- `requirements/base.txt` : `segno`.

### Frontend

- `ui/src/router.tsx` : route **publique** `/z/:token` → `ZoneScanPage`, posée à
  côté de `/join/:token`.
- `ui/src/features/zones/ZoneScanPage.tsx` : appelle le scan, redirige vers
  `/app/zones/:id`. Non authentifié → `/login?next=/z/<token>`.
- `ui/src/features/zones/ZoneQrPrintPage.tsx` (route `/app/zones/print-qr`) :
  planche imprimable, un bloc par zone (QR + nom), CSS `@media print`.
- `ui/src/lib/api/zones.ts` : `scanZoneToken`, `fetchPrintSheet`, `rotateZoneQr`.
- i18n `zones.qr.*` dans les 4 catalogues.

### Critères

- Deux zones n'ont jamais le même jeton, y compris après la data migration.
- Le jeton **n'apparaît pas** dans la réponse du CRUD des zones (test explicite).
- Un jeton d'un autre foyer répond 403 nommé, jamais la zone.
- La planche s'imprime lisiblement en A4 (recette manuelle) ; correction d'erreur
  `M`.
- `POST /api/zones/scan/` non authentifié → 401 ; la page redirige vers le login
  en conservant la destination.

## Lot 2 — La chasse (#TBD)

### But

Le jeu. **Preuve V1 du parcours : composer une chasse de six pièces et la jouer
jusqu'au trésor, sans jamais pouvoir tricher depuis le canapé.**

### Modèles (`apps/games/models.py`, `HouseholdScopedModel`, PK UUID)

- **`Hunt`** (`games_hunts`) : `name` (200), `status` (`draft` | `active` | `done`
  | `abandoned`, défaut `draft`), `treasure_text` (Text), `started_at` /
  `finished_at` (nullable), `created_by` FK user `SET_NULL`.
  Index `(household, status)`. **Index unique partiel** : au plus un `Hunt` de
  statut `active` par foyer.
- **`HuntStep`** (`games_hunt_steps`) : `hunt` FK CASCADE `related_name='steps'`,
  `position` (PositiveSmallInteger), `zone` FK `zones.Zone` `PROTECT`,
  `riddle` (Text), `found_at` (nullable DateTime). `unique_together`
  `(hunt, position)`. Ordering `['position']`.
  `PROTECT` et non `CASCADE` : supprimer une pièce ne doit pas amputer en silence
  une chasse en cours — même arbitrage que `Tree.zone` au parcours 30.

### Services (`apps/games/services.py`)

`create_hunt`, `update_hunt`, `delete_hunt` (passent par le serializer),
`start_hunt(hunt)` (refuse si une autre est active, refuse si zéro étape),
`abandon_hunt(hunt)`, et surtout :

`record_scan(household, zone) -> dict` — **le cœur**. Cherche la chasse active,
compare la zone à la première étape non trouvée, écrit `found_at` si elle
correspond, clôt la chasse à la dernière. Rend un verdict structuré
(`no_hunt` | `wrong_zone` | `advanced` | `finished`) que la vue traduit.
Idempotent : re-scanner une étape déjà trouvée n'est pas une erreur et ne rejoue
rien.

### API (`/api/games/hunts/`, `IsHouseholdMember`)

CRUD + `POST {id}/start/`, `POST {id}/abandon/`, `GET active/`.
`apps/zones/views.py::scan` **appelle `record_scan`** et fusionne son verdict dans
la réponse — la porte reste unique.

### Frontend

`ui/src/features/games/{hooks.ts, HuntsPage.tsx, HuntComposerDialog.tsx,
HuntPlayPage.tsx, HuntCard.tsx}`, `ui/src/lib/api/games.ts`,
routes `/app/games` et `/app/games/play`, entrée `games` dans
`ui/src/lib/modules.ts` (groupe `home`, `optional: true`, icône `Compass`),
`ui/src/lib/invalidate.ts` (racine `games`), i18n `games.*` × 4.

`ZoneScanPage` gagne sa branche de jeu : verdict `advanced` → écran « trouvé ! » +
énigme suivante ; `wrong_zone` → « pas ici » ; `finished` → révélation du trésor.

### Critères

- Une chasse démarrée survit à un rechargement complet et se reprend **sur un
  autre appareil** connecté au même foyer.
- Scanner une pièce hors séquence ne change rien en base (`assertNumQueries` +
  état inchangé) et ne révèle pas la bonne pièce.
- Deux chasses actives simultanées sont refusées **par la base**, pas seulement
  par la vue.
- Supprimer une zone utilisée par une chasse → 409 nommé.
- Le trésor n'est **jamais** dans une réponse d'API avant la dernière étape (test
  dédié : c'est la seule fuite qui gâche la partie).

## Lot 3 — Énigmes par l'assistant (#TBD)

### But

Supprimer les vingt minutes de préparation qui font qu'une chasse se joue deux
fois puis jamais.

### Contenu

- `apps/games/riddles.py` : `generate_riddles(household, zones, *, age, language)`
  — un seul appel au modèle pour toutes les pièces, sortie JSON stricte,
  `ValueError` si la forme ne colle pas. Passe par `agent.llm.get_llm_client()`,
  **jamais** un client instancié sur place.
- `apps/games/capabilities.py` + enregistrement dans `apps/games/apps.py::ready()` :
  `CapabilitySpec(key="hunt_riddles", available=…, doc_anchor="assistant-anthropic",
  env_vars=("ANTHROPIC_API_KEY",))`.
- `POST /api/games/hunts/{id}/generate-riddles/` — `capabilities.require` **avant
  tout effet de bord**, 503 nommé. Throttle dédié (`hunt_riddles`) : c'est un appel
  qui coûte de l'argent, il se borne à part (règle du `CLAUDE.md`).
- Front : bouton « Proposer des énigmes » dans le composeur, chaque énigme éditable
  après génération ; le bouton est **absent** (pas grisé) si la capacité manque, et
  la saisie manuelle reste le chemin normal.
- i18n `capabilities.hunt_riddles.*` × 4.

### Critères

- Sans `ANTHROPIC_API_KEY` : l'écran ne propose pas la génération, la composition
  manuelle fonctionne de bout en bout, l'endpoint répond 503 nommé.
- Une réponse du modèle mal formée n'écrit rien et affiche une erreur lisible.
- Les énigmes proposées sont éditables avant lancement — aucune n'est écrite en
  base sans passage par le composeur.
- La langue de génération est celle de l'utilisateur.

## Lot 4 — Rejouer + ping du samedi pluvieux (#TBD)

### But

Faire revenir le jeu sans que personne n'y pense.

### Contenu

- `POST /api/games/hunts/{id}/replay/` → crée une chasse `draft` avec les mêmes
  zones **dans un ordre mélangé** et les mêmes énigmes ; ne touche pas l'originale.
- `apps/games/pings.py` : `PingSpec(ping_type='hunt_suggestion', module='games',
  default_send_at=10:00)`. `build_message` rend `None` — donc ne part pas — sauf si
  **tout** est vrai : jour de week-end (fuseau du foyer), précipitations annoncées
  par `weather.services.get_forecast`, foyer ayant ≥ 3 zones, et **aucune chasse
  active**. Dégradation silencieuse si la météo est indisponible ou le module
  météo désactivé.
- Type `hunt_suggestion` ajouté à `Notification.Type` **et à `MUTABLE_TYPES`** —
  c'est l'archétype du fréquent non actionnable, il doit pouvoir se taire.
- Front : bouton « Rejouer » sur une chasse terminée.

### Critères

- Rejouer ne modifie jamais la chasse d'origine ; l'ordre diffère (test sur graine
  fixée).
- Le ping ne part pas : en semaine, au sec, sans le module météo, ou si une chasse
  est déjà en cours — un test par condition.
- Le ping est silenciable depuis les préférences.

## Ordre recommandé d'implémentation

1. **Lot 1** — l'ancrage physique (utile seul, dérisque tout le reste)
2. **Lot 2** — le jeu (**preuve V1**)
3. **Lot 3** — les énigmes
4. **Lot 4** — rejouer et le ping

Branches : `feat/zones-qr-anchor`, `feat/games-hunt`, `feat/games-riddles`,
`feat/games-replay-ping`. Une PR par lot vers `main`.

## Points de vigilance

- ⚠️ **La data migration des jetons doit boucler sur les lignes**, pas poser un
  `default` : une migration qui applique la même valeur par défaut à toutes les
  zones existantes leur donne **le même jeton**, et toute la maison devient une
  seule pièce aux yeux du jeu. Test de régression obligatoire.
- ⚠️ **Le jeton ne doit jamais fuiter par le serializer de zone** — ni dans le
  CRUD, ni dans la recherche globale, ni dans les payloads de l'agent. Un test
  balaye la réponse du CRUD.
- ⚠️ **Le trésor est un secret jusqu'à la dernière étape.** Le sérialiseur de
  `Hunt` doit le masquer tant que `status != 'done'` pour la vue de jeu. C'est la
  fuite la plus facile à introduire et la seule qui ruine la partie.
- **Un scan non authentifié doit conduire au login puis revenir**, sans perdre le
  jeton (`?next=`). Sinon l'étiquette ne marche que pour qui est déjà connecté.
- **`invalidate('games')` + `DERIVED_FROM`** : au minimum `dashboard` et `zones`.
- **Dates et heures par `core.timezones`** — le week-end du ping se calcule dans
  le fuseau du foyer, jamais en UTC.
- **Le module désactivé doit couper le ping et la route**, mais **pas** le scan de
  zone du lot 1.
- `pytest` local : `TEST_DATABASE_NAME=test_house`, `--create-db` après bascule de
  branche.

## Définition de done technique

1. Une planche d'étiquettes s'imprime, se colle, et chaque scan ouvre la bonne
   pièce.
2. Une chasse se compose, se joue jusqu'au trésor, et ne se triche pas depuis le
   canapé.
3. L'état survit au rechargement et au changement d'appareil ; une seule chasse
   active par foyer, garantie en base.
4. Le trésor ne fuite dans aucune réponse avant la dernière étape.
5. Sans clé Anthropic, tout fonctionne sauf la génération, qui se **déclare**
   absente.
6. Le ping ne part qu'un week-end pluvieux, et se coupe.
7. i18n 4 langues sans `defaultValue`, lint propre, `pytest` vert.
8. Chaque user story `CHAS-xx` est citée par le titre d'une spec Playwright, et
   `docs/USER_STORIES.md` est à jour.
9. **`docs/MODULES/games.md` créée** ; `docs/MODULES/zones.md` complétée du QR.
10. **Guide « Chasse au trésor » ajouté à la page Tutoriel** (skill `/tutorials`).
11. **Compte rendu d'implémentation** dans `docs/journal/`, écrit dans la dernière
    PR du parcours.
