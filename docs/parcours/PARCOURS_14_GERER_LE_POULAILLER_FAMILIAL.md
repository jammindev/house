# Parcours 14 — Gérer le poulailler familial

> **État** — cadrage + implémentation V1 livrés le 2026-07-11 (branche
> `feat/chickens-module`). US-1 à US-13 couvertes, sauf : photo de poule (US-1,
> reporté). Le coût par œuf compte désormais aussi la nourriture achetée dans
> Stock (lot 7). **Lot 6 — Stats & santé** (2026-07-16) ajoute : courbe de ponte
> (période + taux de relevé), coût au œuf transparent (alimentation + soins),
> alerte de chute anormale croisée météo/mue, tool agent `get_chicken_stats`.
> Cadrage : `docs/parcours/PARCOURS_14_LOT6_STATS_SANTE_TROUPEAU.md`.

## Résumé

Le foyer élève quelques poules (3 à 15) pour les œufs et le plaisir familial — pas
d'élevage commercial. Aujourd'hui rien dans l'app ne permet de suivre le troupeau,
la ponte, la nourriture ou les soins : tout est de tête ou sur un carnet papier.
Le module « Poulailler » centralise ce suivi et se branche sur l'existant (stock,
trackers, dépenses, tâches, agent IA, dashboard).

## Positionnement produit

Après les parcours patrimoine (zones, équipements, documents) et consommation
(électricité, eau, trackers), le poulailler est le premier module « vivant » :
des animaux avec un cycle de vie, un geste quotidien (ramasser les œufs), et des
soins périodiques. Il réutilise massivement les briques transverses au lieu d'en
créer de nouvelles.

## Étude métier — élevage familial

Ce qui caractérise un élevage **familial** (vs commercial) :

- **Petit effectif nominatif** : chaque poule a un nom, souvent donné par les
  enfants. On la connaît individuellement (race, caractère, couleur).
- **Le geste quotidien, c'est la ponte** : on ramasse les œufs une fois par jour
  et on aime savoir « combien aujourd'hui / cette semaine ». C'est LE point
  d'entrée du module — il doit être ultra-rapide (2 taps).
- **Cycle de vie riche mais informel** : arrivée d'une nouvelle poule,
  couvaison, mue (arrêt de ponte normal), maladie, prédateur, décès, don.
  On veut un journal, pas un registre sanitaire réglementaire.
- **Alimentation** : sac de grain/granulés acheté périodiquement, consommation
  à peu près constante → la vraie question est « quand racheter ? ».
- **Soins périodiques** : vermifuge (2×/an), traitement anti-poux rouges,
  nettoyage/désinfection du poulailler, paille/litière. Ce sont des rappels,
  pas des protocoles.
- **Coût vs plaisir** : la question rigolote « combien me coûte un œuf ? » —
  dépenses cumulées (nourriture, litière, achat des poules) rapportées aux œufs
  ramassés.
- **Hors sujet en familial** : traçabilité réglementaire, lots, pesées, taux de
  conversion alimentaire, gestion de couvoir industriel, vente avec facturation.

### Use cases couverts (V1)

| # | Use case | Réponse produit |
|---|----------|-----------------|
| UC1 | Connaître son troupeau | Registre des poules (fiche par poule, statut) |
| UC2 | Ramasser les œufs | Relevé de ponte quotidien en 2 taps |
| UC3 | Suivre la ponte | Stats : œufs/jour/semaine/mois, tendance |
| UC4 | Savoir quand racheter la nourriture | Tracker CONSUMPTION existant lié au module |
| UC5 | Ne pas oublier les soins | Événements de soin + tâches de rappel |
| UC6 | Tenir le journal du troupeau | Événements de vie (arrivée, couvaison, mue, décès…) |
| UC7 | Savoir ce que ça coûte | Dépenses via Interactions + coût par œuf |
| UC8 | Demander à l'IA | « Combien d'œufs cette semaine ? », « J'ai ramassé 4 œufs » |

### Hors scope V1 (assumé)

- Destination détaillée des œufs (consommés / donnés / vendus) — V2 possible.
- Incubation / éclosion de poussins (dates de couvaison suffisent en journal).
- Pesée des poules, courbes de croissance.
- Multi-poulaillers par foyer (1 seul troupeau par foyer en V1).

## Concept interne

Nouvelle app Django `apps/chickens/` :

- **`Chicken`** (`HouseholdScopedModel`) : `name`, `breed`, `color`,
  `hatched_on` (date approx. nullable), `acquired_on`, `status`
  (ACTIVE | BROODY | SICK | DECEASED | GONE), `notes`, `photo` (nullable),
  `zone` (FK Zone nullable — la zone « Poulailler » du foyer).
- **`EggLog`** (`HouseholdScopedModel`) : `date` (unique par foyer), `count`
  (entier ≥ 0), `note`. Un enregistrement par jour et par foyer — re-saisir le
  même jour met à jour le compte (upsert).
- **`ChickenEvent`** (`HouseholdScopedModel`) : `chicken` (FK nullable — un
  événement peut concerner tout le troupeau), `type` (ARRIVAL | CARE | ILLNESS |
  BROODY | MOLT | PREDATOR | DEATH | DEPARTURE | OTHER), `occurred_on`,
  `title`, `notes`. Les événements CARE (vermifuge…) portent l'historique de
  soins.

Réutilisation des briques transverses (pas de nouveau schéma) :

- **Achat d'une poule / de matériel** → `create_expense_interaction(source=chicken, …)`
  avec template auto-subject dédié dans `AUTO_SUBJECT_TEMPLATES`.
- **Nourriture** → item de stock + tracker CONSUMPTION existants ; le module les
  référence, il ne les duplique pas.
- **Rappels de soins** → création de `Task` (service `tasks/services.py::create_task`).
- **Agent** → `SearchableSpec` (chicken, avec events en `related`) +
  `WritableSpec` (créer une poule, logger la ponte du jour).

## Concept visible côté utilisateur

- Entrée de menu « 🐔 Poulailler » → `/app/chickens`.
- Page principale : bandeau ponte du jour (saisie rapide), stats de ponte,
  grille des poules (cards avec statut), journal des derniers événements.
- Fiche poule `/app/chickens/:id` : infos, statut, timeline de ses événements,
  bouton « Déclarer un achat » (pattern `PurchaseForm` partagé).
- Widget dashboard : œufs du jour + 7 derniers jours, effectif du troupeau,
  autonomie nourriture (si tracker lié). Masqué si le module est vide.

## Objectif produit

Permettre au membre du foyer de :

1. Tenir le registre de ses poules sans effort (créer, statut, journal).
2. Logger la ponte quotidienne en 2 taps et voir les tendances.
3. Être rappelé pour la nourriture et les soins sans y penser.
4. Connaître le coût réel de ses œufs.
5. Interroger et alimenter tout ça via l'agent IA.

---

## User stories

### US-1 — Registre des poules

**En tant que** membre
**Je veux** créer, modifier et supprimer des poules (nom, race, couleur, dates, notes)
**Afin de** tenir le registre de mon troupeau

**Critères d'acceptation**
- [ ] Page `/app/chickens` listant les poules du foyer en cards (pattern Feature page : PageHeader, FilterPill par statut, EmptyState, skeleton `useDelayedLoading`)
- [ ] Dialog create/edit (pattern `existing?`), champs : nom (requis), race, couleur, date d'éclosion (approximative, nullable), date d'arrivée, notes
- [ ] Suppression avec undo (`useDeleteWithUndo`)
- [ ] API DRF : `ChickenViewSet` CRUD scopé foyer (`/api/chickens/`), un membre d'un autre foyer reçoit 404
- [ ] État vide avec CTA « Ajouter une poule »

### US-2 — Statut d'une poule

**En tant que** membre
**Je veux** changer le statut d'une poule (active, en couvaison, malade, décédée, partie)
**Afin de** refléter l'état réel du troupeau

**Critères d'acceptation**
- [ ] Statuts : ACTIVE, BROODY, SICK, DECEASED, GONE — badge coloré sur la card (tokens design-system, pas de couleurs hardcodées)
- [ ] Passer à DECEASED ou GONE crée automatiquement un `ChickenEvent` du type correspondant daté du jour
- [ ] Les poules DECEASED/GONE sortent du filtre par défaut (« troupeau actif ») mais restent accessibles via un filtre « historique »
- [ ] L'effectif affiché (dashboard, stats) ne compte que ACTIVE + BROODY + SICK

### US-3 — Relevé de ponte quotidien

**En tant que** membre
**Je veux** saisir le nombre d'œufs ramassés aujourd'hui en 2 taps
**Afin de** tenir le compte sans friction

**Critères d'acceptation**
- [ ] Bandeau en tête de `/app/chickens` : compteur du jour avec steppers +/− et saisie directe
- [ ] Un seul `EggLog` par jour et par foyer : re-saisir le même jour met à jour le compte (upsert), pas de doublon
- [ ] Saisie possible pour une date passée (j'ai oublié hier) via un date picker
- [ ] `count` ≥ 0, erreur de validation API sinon
- [ ] Toast de confirmation ; erreur réseau → toast destructive, la valeur affichée n'est pas faussée

### US-4 — Statistiques de ponte

**En tant que** membre
**Je veux** voir l'évolution de la ponte (jour, 7 jours, 30 jours)
**Afin de** repérer les tendances (saison, mue, problème)

**Critères d'acceptation**
- [ ] Section stats sur `/app/chickens` : total du jour, moyenne/jour sur 7 j et 30 j, total du mois
- [ ] Graphique simple des 30 derniers jours (même lib que les graphes electricity/water)
- [ ] Les jours sans relevé comptent comme absents (pas 0) dans les moyennes
- [ ] État vide : message expliquant qu'il faut au moins un relevé

### US-5 — Journal d'événements du troupeau

**En tant que** membre
**Je veux** consigner les événements (arrivée, soin, maladie, couvaison, mue, prédateur, décès, départ, autre)
**Afin de** garder l'historique du troupeau

**Critères d'acceptation**
- [ ] Création d'un événement depuis la page principale (troupeau entier) ou depuis une fiche poule (pré-liée)
- [ ] Champs : type (requis), date (défaut aujourd'hui), titre (requis), notes, poule (optionnelle)
- [ ] Timeline des événements sur la fiche poule et journal global (derniers événements) sur la page principale
- [ ] Suppression avec undo
- [ ] API : `ChickenEventViewSet` CRUD scopé foyer, filtre `?chicken=<id>`

### US-6 — Rappels de soins

**En tant que** membre
**Je veux** créer une tâche de rappel depuis un événement de soin (ex : vermifuge → rappel dans 6 mois)
**Afin de** ne pas oublier les soins périodiques

**Critères d'acceptation**
- [ ] Sur le formulaire d'un événement CARE : option « Me le rappeler » avec date d'échéance
- [ ] La tâche est créée via le service `tasks/services.py::create_task` (jamais l'ORM brut), `due_date` renseignée, sujet explicite (« Vermifuge poules »)
- [ ] La tâche apparaît dans le module Tâches et déclenche les alertes de retard existantes — aucune mécanique d'alerte nouvelle
- [ ] Pas de récurrence automatique (les tâches sont one-shot en V1) : au traitement suivant on recrée un rappel

### US-7 — Achat lié au poulailler (dépense auto)

**En tant que** membre
**Je veux** déclarer un achat (poule, matériel) depuis le module
**Afin de** suivre mes dépenses poulailler sans double saisie

**Critères d'acceptation**
- [ ] Bouton « Déclarer un achat » sur la fiche poule, wrappant le `PurchaseForm` partagé (dialog dédié, pattern StockPurchaseDialog)
- [ ] Crée une `Interaction` expense via `create_expense_interaction(source=chicken, kind='chickens_purchase')` — nouveau template dans `AUTO_SUBJECT_TEMPLATES` + traductions .po fr/de/es compilées
- [ ] L'interaction est visible dans `/app/expenses/` et rattachée à la zone de la poule si définie
- [ ] La nourriture s'achète via le module Stock existant (pas de flux d'achat nourriture dupliqué ici)

### US-8 — Nourriture : lien stock/tracker et autonomie

**En tant que** membre
**Je veux** voir l'autonomie de nourriture depuis la page poulailler
**Afin de** savoir quand racheter sans changer de module

**Critères d'acceptation**
- [ ] Réglage du module (par foyer) : associer un tracker CONSUMPTION existant comme « tracker nourriture »
- [ ] Si associé : la page et le widget dashboard affichent rythme + autonomie (mêmes données que `ConsumptionCard`, pas de recalcul)
- [ ] Si non associé : encart discret proposant de lier ou créer un tracker
- [ ] Aucune duplication : la réserve vit dans le tracker, le stock dans Stock ; le module ne fait que référencer

### US-9 — Coût par œuf

**En tant que** membre
**Je veux** voir le coût cumulé du poulailler et le coût moyen par œuf
**Afin de** connaître (et rigoler du) prix réel de mes œufs

**Critères d'acceptation**
- [ ] Coût cumulé = somme des Interactions expense dont la source est une entité du module (+ celles du tracker/stock nourriture lié)
- [ ] Coût par œuf = coût cumulé ÷ total d'œufs loggés ; affiché seulement si œufs > 0 et coût > 0
- [ ] Période : depuis le début + année en cours
- [ ] Pas de saisie supplémentaire demandée à l'utilisateur

### US-10 — Widget dashboard

**En tant que** membre
**Je veux** un widget Poulailler sur le dashboard
**Afin de** voir l'essentiel sans ouvrir le module

**Critères d'acceptation**
- [ ] Card « 🐔 Poulailler » : œufs du jour, total 7 jours, effectif actif, autonomie nourriture (si tracker lié)
- [ ] Masquée si le foyer n'a ni poule ni relevé (pattern des cards existantes)
- [ ] Clic → `/app/chickens` avec `pushBack` pour le retour contextuel

### US-11 — Agent IA : recherche et consultation

**En tant que** membre
**Je veux** poser des questions à l'agent sur mon poulailler
**Afin d'** obtenir des réponses citées sans naviguer

**Critères d'acceptation**
- [ ] `SearchableSpec` pour `chicken` (search sur name, breed, notes) avec `related` incluant les derniers événements — enregistré dans `apps.py::ready()`, zéro modification de `apps/agent/`
- [ ] « Quand a-t-on vermifugé les poules ? » retrouve l'événement CARE et le cite avec lien `/app/chickens/{id}`
- [ ] Les stats de ponte récentes sont exposées au retrieval (résumé RAG type `entries_summary` des trackers)

### US-12 — Agent IA : actions d'écriture

**En tant que** membre
**Je veux** dire à l'agent « j'ai ramassé 4 œufs » ou « ajoute une poule Roussette »
**Afin de** logger sans ouvrir l'app

**Critères d'acceptation**
- [ ] `WritableSpec` pour `chicken` et pour le relevé de ponte, `create` passant par les services métier (jamais l'ORM brut)
- [ ] « J'ai ramassé 4 œufs » → upsert de l'`EggLog` du jour (pas de doublon si déjà saisi)
- [ ] Undo côté front : entrées dans `UNDO_HANDLERS` (`ui/src/features/agent/hooks.ts`)
- [ ] Description du tool `create_entity` étendue avec les champs des nouvelles entités

### US-13 — i18n complète

**En tant que** membre non anglophone
**Je veux** le module dans ma langue
**Afin de** l'utiliser comme le reste de l'app

**Critères d'acceptation**
- [ ] Toutes les clés `chickens.*` présentes dans les 4 fichiers (en/fr/de/es), aucune `defaultValue` dans les `t()`
- [ ] Templates d'auto-subject traduits dans les 3 `.po` + `compilemessages`
- [ ] Types d'événements et statuts traduits (jamais les valeurs techniques à l'écran)

---

## Carte d'intégration (récap)

| Brique existante | Connexion poulailler |
|---|---|
| `interactions` | Achats via `create_expense_interaction` (US-7), coût cumulé (US-9) |
| `trackers` | Tracker CONSUMPTION nourriture référencé, autonomie (US-8) |
| `stock` | La nourriture/litière reste des StockItems ; le module référence (US-8) |
| `tasks` | Rappels de soins via `create_task` (US-6) |
| `zones` | `Chicken.zone` → zone « Poulailler » (US-1) |
| `agent` | SearchableSpec + WritableSpec déclarés dans `apps.py` (US-11/12) |
| `dashboard` | Nouvelle card masquable (US-10) |
| `alerts` | Rien de neuf : retards de tâches + autonomie tracker déjà couverts |
| `directory` | Rien de neuf : Structure type « vétérinaire » libre, déjà possible |
| `documents`/`photos` | Rien de neuf en V1 (rattachement via Interactions déjà possible) |

## Découpage en lots

- **Lot 1 — Troupeau** : app `chickens`, modèle `Chicken`, CRUD API + page + dialog + statuts (US-1, US-2)
- **Lot 2 — Ponte** : `EggLog`, saisie rapide, stats + graphe (US-3, US-4)
- **Lot 3 — Journal & soins** : `ChickenEvent`, timeline, rappels tâches (US-5, US-6)
- **Lot 4 — Argent & nourriture** : achats, lien tracker, coût par œuf (US-7, US-8, US-9)
- **Lot 5 — Transverse** : widget dashboard, agent search/write, i18n finale (US-10 à US-13)

Issues GitHub : « Parcours 14 — Lot N : … », labels `feat` / `app:chickens` / `i18n`.
