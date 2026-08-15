# Module `games` — la chasse au trésor

> Le jeu ne se joue pas dans l'app : il se joue **dans la maison**. L'app compose
> le parcours, garde l'état et **valide l'arrivée**. Parcours 31, lot 2 (#609).

- Doc produit : [PARCOURS_31_LA_CHASSE_AU_TRESOR.md](../parcours/PARCOURS_31_LA_CHASSE_AU_TRESOR.md)
- Fiche concept : [ANCRAGE_PHYSIQUE.md](../fiches/ANCRAGE_PHYSIQUE.md)
- User stories : `CHAS-04` → `CHAS-10` — spec `e2e/hunt.spec.ts` ;
  `CHAS-11`/`CHAS-12` — spec `e2e/hunt-riddles.spec.ts`

## État

| Lot | Sujet | État |
|---|---|---|
| 1 | Étiquettes QR de zone (dans `apps/zones`) | ✅ livré |
| 2 | La chasse — modèles, session, avancement par scan | ✅ livré |
| 3 | Énigmes proposées par l'assistant | ✅ livré |
| 4 | Rejouer + ping du samedi pluvieux | ⬜ à faire (#611) |

Module **optionnel** (`games` dans `OPTIONAL_MODULES` et `PINNABLE_MODULES`),
groupe **Maison**. Le lot 1 vit dans les zones et reste actif même module coupé.

## Modèles

- **`Hunt`** (`games_hunts`) — `name`, `status` (`draft`/`active`/`done`/
  `abandoned`), `treasure_text`, `started_at`, `finished_at`, `created_by`.
- **`HuntStep`** (`games_hunt_steps`) — `hunt` (CASCADE), `position`, `zone`
  (**PROTECT**), `riddle`, `found_at`. `unique_together (hunt, position)`.

## Les règles du jeu, et où elles vivent

- **Une chasse est une session de foyer, pas un état par utilisateur.** Un seul
  téléphone circule ; aucun `user` n'est stocké sur une étape. C'est ce qui rend
  le jeu jouable par des enfants **sans leur créer de compte** — la seule des cinq
  idées de jeu du cadrage qui contourne ce blocage.
- **L'état vit en base, jamais en `localStorage`.** Une partie survit à un
  rechargement et se reprend sur un autre appareil du foyer. Régression :
  `TestAHuntSurvivesTheDevice` + `CHAS-09` en navigateur.
- **⚠️ Une seule chasse active par foyer, tenue par un `UniqueConstraint`
  partiel**, pas seulement par la vue. Une règle de jeu qui ne vit que dans une
  vue tombe au premier appelant qui ne passe pas par elle — un service, une
  commande, un shell.
- **Le serveur seul tranche « bonne pièce ou non »** (`services.record_scan`), et
  rend un **verdict structuré** (`no_hunt` / `wrong_zone` / `already_found` /
  `advanced` / `finished`), jamais une phrase d'affichage. Un client qui
  déciderait pourrait être poussé à dire oui.
- **Un mauvais scan n'écrit rien et ne révèle ni la pièce visée, ni le nombre
  d'étapes restantes** — sinon la triche consiste à scanner toute la maison et à
  lire la réponse dans le payload.
- **`record_scan` est idempotent** : un enfant qui repasse devant une porte déjà
  trouvée ne casse pas la partie (`already_found`).
- **`position` est déduit de l'ordre du tableau**, jamais envoyé par le client —
  même raison que `Zone.position` : deux étapes au même rang rendraient « l'étape
  suivante » dépendante du plan d'exécution PostgreSQL.

## Le trésor est un secret, et c'est du code

**Deux sérialiseurs, et la différence est du métier :**

| Sérialiseur | Sert | Trésor |
|---|---|---|
| `HuntSerializer` | la **composition** (le parent écrit) | toujours visible |
| `HuntPlaySerializer` | la **partie** (le téléphone circule) | `null` tant que `status != done` |

`current_step` de la vue de partie porte l'énigme et le rang, **jamais la zone** :
c'est précisément la réponse que les joueurs doivent trouver en se déplaçant.

⚠️ **`GET /hunts/{id}/play/` existe pour une raison précise** : la dernière étape
fait passer la chasse en `done`, donc `active/` renvoie `null` à l'instant exact
où il faut révéler le trésor. Le front garde l'identifiant (`?hunt=`) et demande
celle-là. Ce n'est pas un contournement du secret — c'est le **même**
`HuntPlaySerializer`, donc une seule définition de ce qui est révélable.

## L'assistant propose, le parent décide (lot 3)

`generate_riddles` (`apps/games/riddles.py`) rend **une énigme par pièce** et
n'écrit **rien**. Ce qui se persiste est ce que le parent a relu dans le
composeur — exactement comme une énigme tapée à la main.

- **Un seul appel pour toutes les pièces.** Six étapes ne coûtent pas six
  allers-retours : au-delà de la latence et de la facture, six énigmes écrites
  dans l'ignorance les unes des autres se répètent, et deux pièces finissent avec
  la même image. Régression : `test_all_the_rooms_travel_in_a_single_call`.
- **La forme se vérifie, elle ne se devine pas.** Une réponse mal formée lève
  `ValueError` → **502 nommé**, et aucun champ ne se remplit. Un demi-résultat se
  lit plus mal qu'aucun résultat : le parent lancerait une chasse dont deux
  étapes ne disent rien. Même arbitrage que `recap.polish._parse`.
- **La capacité `hunt_riddles` est distincte d'`assistant`** bien qu'elle lise la
  même clé — elles ne se coupent pas ensemble, et leur texte d'absence ne dit pas
  la même chose. Sans clé, le bouton est **absent** (pas grisé) et la composition
  manuelle est le chemin normal, pas un mode dégradé.
- **Cap dédié `hunt_riddles` (20/h/utilisateur)** : le plancher global compte des
  requêtes, pas des euros.
- **⚠️ Le geste est une action de liste, pas de détail.** Il a lieu *pendant* la
  composition, le plus souvent sur une chasse qui n'existe pas encore : une route
  `{id}/generate-riddles/` obligerait à enregistrer une chasse vide avant de
  pouvoir demander de l'aide à l'écrire. Ici la question du « rien en base » ne
  se pose même pas — l'endpoint ne sait pas où écrire.
- Le recollement se fait **par rang** (`index`), jamais par zone : deux étapes ont
  le droit de désigner la même pièce (un aller-retour dans une chasse).

## API

| Route | Rôle |
|---|---|
| `/api/games/hunts/` | CRUD de composition |
| `POST /hunts/{id}/start/` | lance (400 si une autre tourne, 400 si zéro étape) |
| `POST /hunts/{id}/abandon/` | libère la place |
| `GET /hunts/active/` | la partie en cours, `{hunt: null}` sinon |
| `GET /hunts/{id}/play/` | la vue de partie d'une chasse désignée |
| `POST /hunts/generate-riddles/` | propose une énigme par pièce — **n'écrit rien** |

**L'avancement n'est pas ici** : il passe par `POST /api/zones/scan/`, la porte
unique du scan, que ce module *étend* sans la dupliquer.

## Pièges à ne pas redécouvrir

- **`HuntStep.zone` est `PROTECT`, et ça déborde sur le seed de démo.**
  `seed_demo_data --flush` supprime les zones : un foyer ayant joué une seule fois
  devenait impossible à purger, et **toute la suite Playwright tombait au seed**.
  Les chasses se suppriment donc **avant** les zones dans `_flush()`. Même famille
  que `BankTransaction.account` — un flush qui ne flushe pas est pire que pas de
  flush.
- **Le front n'appelle jamais `lib/api/games.ts` en direct** : tout passe par
  `features/games/hooks.ts` (garde-fou `ui/src/lib/invalidate.test.ts`).
- **`useActiveHunt` rallume `refetchOnWindowFocus`**, contre le défaut du
  `QueryClient` : c'est le seul écran du produit qu'on regarde pendant qu'un
  *autre* appareil écrit dedans.
- **`url_path` s'écrit explicitement sur toute action à plusieurs mots.** DRF
  dérive `url_name` en remplaçant les underscores par des tirets, et `url_path`
  **non** : `generate_riddles` se sert par défaut sur `/generate_riddles/` tout en
  se nommant `hunt-generate-riddles`. Un test passant par `reverse()` reste vert
  pendant que le front prend un 404 — c'est arrivé à la planche d'impression du
  lot 1. Régression : `TestTheDoorIsWhereTheFrontKnocks`, qui teste le **chemin
  littéral**.
- **Une chasse laissée `active` détourne tous les scans du foyer.** C'est le
  comportement voulu en partie, mais dans une suite Playwright qui partage sa
  base, ça faisait tomber `zone-qr.spec.ts` dès qu'il tournait *après*
  `hunt.spec.ts` — vert seul, rouge à deux. D'où l'`afterEach` : nettoyer avant
  ne suffit pas, il faut aussi nettoyer après.
