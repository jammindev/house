# Module — recap (le récap mensuel raconté)

> Rôle : **rendre au foyer ce qu'il a saisi**. Une fois par mois, le mois clos est
> raconté en une **story** de cartes — une idée par écran, un gros chiffre, une
> phrase. Premier écran de House qui ne demande rien.
>
> App : `apps/recap/`. Parcours :
> [PARCOURS_27_LE_RECAP_MENSUEL_RACONTE.md](../parcours/PARCOURS_27_LE_RECAP_MENSUEL_RACONTE.md).
> Concept : [SNAPSHOT_ET_RECIT.md](../fiches/SNAPSHOT_ET_RECIT.md). Socle réutilisé :
> [budget.md](./budget.md) (le mécanisme d'instantané, et le chapitre Argent),
> [pings.md](./pings.md) (rendez-vous), [digest.md](./digest.md) (le registre de
> collecteurs — **pas** son contrat).

## État synthétique

- **Backend** : `apps/recap/`
  - `models.py` — `HouseholdRecap(HouseholdScopedModel)` : `month` (`YYYY-MM`),
    `stats` JSON, `UniqueConstraint(household, month)`. Décalque volontaire de
    `budget.BudgetReport`. Propriété `card_count`.
  - `chapters.py` — `RecapCard`, `Chapter`, `ChapterSpec`, `CHAPTER_SPECS`,
    `CHAPTER_KEYS`, `active_chapter_specs` + un collecteur par chapitre
    (`collect_money`, `collect_achievements`, `collect_home`, `collect_memories`).
    Imports des apps sources **paresseux**.
  - `service.py` — `last_closed_month`, `build_stats` (assemble, isole un collecteur
    qui lève), `get_or_generate_recap` (idempotent, fige une fois),
    `render_recap` (rendu + polish mémoïsé par langue + préférence de lecture).
  - `render.py` — `CARD_RENDERERS` (un rendu par `kind`), `CHAPTER_EMOJI`,
    `chapter_title`, `render_card`, `render_chapters`. **Un `kind` inconnu est
    ignoré, une clé absente dégrade.**
  - `polish.py` — `polish_captions` : repolissage LLM des **captions seules**,
    `None` sur toute anomalie, gardé par `RECAP_AI_POLISH_ENABLED`.
  - `ping.py` — `build_monthly_recap_message` : le 1er, un **teaser + lien**.
  - `views.py` / `serializers.py` / `urls.py` — `/api/recap/` lecture seule.
- **Enregistrement** : `apps/recap/apps.py::ready()` enregistre le
  `PingSpec(ping_type='monthly_recap', default_send_at=09:00, module=None)`.
- **Préférence de chapitres** : `User.recap_disabled_chapters` (JSONField, liste des
  chapitres coupés) — validée contre `CHAPTER_KEYS` dans `accounts.serializers`,
  éditable via `PATCH /api/accounts/users/me/`. Miroir de
  `digest_disabled_sections`.
- **Frontend** : `ui/src/features/recap/` (`RecapHistoryPage` = historique + réglages,
  `RecapStoryPage` = la story, `RecapCardView`, `month.ts` + son test, `hooks.ts`),
  carte `features/dashboard/RecapTeaserCard.tsx`, client `ui/src/lib/api/recap.ts`,
  routes `/app/recap` et `/app/recap/:month` (sidebar, groupe Compte).
  `monthly_recap` est masqué de `settings/components/ProactiveSection` (configuré sur
  sa page dédiée, comme `daily_digest`).
- **Locales (en/fr/de/es)** : namespace `recap` (front) + 34 chaînes `gettext`
  (back, `render.py` / `ping.py` / `models.py` / validation `accounts`).
- **Réglages** (`config/settings/base.py`) : `RECAP_MIN_CARDS` (défaut `3`),
  `RECAP_AI_POLISH_ENABLED` (défaut `False`).
- **Tests** : `apps/recap/tests/` (106) — `test_service.py` (gel, idempotence,
  isolation, gating, garde-fous AST), `test_chapters.py` (les quatre chapitres, tâches
  privées, non-ventilation par membre), `test_render.py` (tolérance aux `kind`
  inconnus, 4 langues), `test_polish.py` (mémoïsation, tous les modes d'échec),
  `test_api.py`, `test_ping.py`. E2E : `e2e/recap.spec.ts` (7).

## API

| Endpoint | Rôle |
|---|---|
| `GET /api/recap/` | Historique du foyer, mois décroissants |
| `GET /api/recap/<YYYY-MM>/` | Un mois (404 s'il n'a jamais été gelé) |
| `GET /api/recap/latest/` | Le dernier mois clos — **génère** au premier appel ; `204` sous `RECAP_MIN_CARDS` |
| `GET /api/recap/chapters/` | Les chapitres que ce foyer peut recevoir (gatés module) |

Lecture seule (`ReadOnlyModelViewSet`, `IsHouseholdMember`) : un récap ne s'édite pas.
Le `stats` brut n'est **jamais** exposé — le publier ferait de chaque client un second
moteur de rendu.

## Ajouter un chapitre (~10 lignes)

1. Écrire un collecteur dans `chapters.py` :
   `def collect_foo(household, month, *, start, end) -> Chapter | None:` — lecture
   pure via le **service** de l'app source (jamais d'ORM dupliqué ; créer le service
   s'il manque, comme `tasks.services.completion_summary`), **sans un mot de
   langue**, `None` si rien à dire.
2. Ajouter `ChapterSpec('foo', module='foo_or_None', collect_foo)` à
   `CHAPTER_SPECS`, à sa place dans le récit.
3. Ajouter un rendu par `kind` dans `CARD_RENDERERS`, son emoji dans
   `CHAPTER_EMOJI`, son titre dans `chapter_title`, et les chaînes dans les 3 `.po`.
4. Ajouter la clé i18n front `recap.chapters.foo` (4 langues) pour le libellé du
   toggle.

Le gating module, l'assemblage, l'isolation des pannes, le gel, l'API, la story et le
ping sont génériques.

## Pourquoi ce design

- **Instantané figé, récit tardif.** Ce qui est *vrai* est calculé une fois à la
  clôture et gelé ; ce qui est *dit* en est dérivé à la lecture, dans la langue du
  lecteur. Détail et alternatives écartées :
  [SNAPSHOT_ET_RECIT.md](../fiches/SNAPSHOT_ET_RECIT.md).
- **Le contrat de collecteur n'est pas celui du digest.** Ici on renvoie des
  **données** ; là-bas des chaînes déjà traduites. Un récap est persisté et relu,
  éventuellement par quelqu'un d'autre — traduire à la collecte gèlerait la langue de
  l'auteur dans l'historique. **Ne pas copier un collecteur de digest.**
- **Un instantané de foyer exclut le privé au calcul, pas à l'affichage.** Le digest
  peut filtrer par destinataire ; un instantané est gelé une fois et lu par tous les
  membres. `Task.is_private=True` ne doit jamais entrer dans le chiffre.
- **Aucun chiffre par membre, jamais.** Ni classement, ni score, ni badge : chiffrer
  que l'un en a fait moins que l'autre transforme un moment de fierté en dispute, et
  la personne qui perd désinstalle. Un chiffre de contribution est collectif ou n'est
  pas. Tenu par `test_no_collector_groups_by_member` (analyse AST).
- **Le chapitre Argent lit le `BudgetReport` gelé.** *Un compteur ne peut pas avoir
  deux définitions* : deux sommes écrites séparément divergent d'un centime d'arrondi
  ou d'une borne de fuseau. Un `Sum` dans `apps/recap/` est interdit par un test.
- **Un instantané est un format public** : on ajoute des clés, on n'en renomme
  jamais. Un chapitre livré après coup n'apparaît pas dans les mois déjà gelés, et le
  rendu tolère un `kind` inconnu — pour toujours.
- **Une source sans données ne produit pas de carte à zéro.** « 0 kWh » est une
  affirmation *fausse*, pas une case vide. Et un jour sans `EggLog` est **inconnu**,
  jamais un zéro (pivot du module poulailler), d'où `logged_days` à côté du total.
- **Un récap pauvre ne part pas** (`RECAP_MIN_CARDS`) : l'instantané est calculé et
  reste consultable, mais ni ping ni carte dashboard. Un rendez-vous qui livre du
  vide use le rendez-vous.
- **Le ping est un teaser + lien.** Une story se regarde ; aplatie dans un fil
  Telegram elle redevient le paragraphe gris que ce parcours remplace. Conséquence
  assumée : doublon possible avec le bilan budgétaire du 1er, d'où
  `monthly_recap` **off par défaut** et la mention explicite sur la page.
- **Couper un chapitre est une préférence de lecture**, pas de calcul : le chapitre
  disparaît du rendu et reste dans l'instantané, donc le réactiver rend les mois
  déjà racontés entiers.

## Limites V1

- **Aucun partage hors du foyer** : ni lien public, ni export image. Le récap contient
  montants, noms de pièces et photos de l'intérieur ; ouvrir cette porte demande un
  cadrage sécurité à part.
- **Pas de bilan annuel** — chaque chapitre devrait savoir agréger sur douze mois
  autant que sur un, sans recul d'usage sur la première échelle.
- **Pas de rattrapage historique** : le récap commence au premier mois clos après la
  livraison. Les premiers mois d'un foyer sont incomplets et produiraient des récaps
  faux.
- **Pas de réactions ni de commentaires** sur les cartes — c'est le chantier voisin
  (le fil du foyer), et il mérite son propre parcours.
- Le « vu » de la carte dashboard vit côté client (`sessionStorage`) : elle
  réapparaît dans un autre navigateur. Une table pour retenir qu'on a fermé une carte
  coûterait plus que le problème.
- Le chapitre Souvenirs affiche un **compte**, pas encore la mosaïque : les ids sont
  gelés, le rendu visuel des photos reste à faire.
