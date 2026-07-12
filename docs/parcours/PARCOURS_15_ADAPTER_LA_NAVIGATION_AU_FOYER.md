# Parcours 15 — Adapter la navigation au foyer

> **État** — cadrage + implémentation V1 livrés le 2026-07-12 (branche
> `feat/general-modules-sidebar`, issues #251–#254). US-1 à US-8 couvertes.
> Tests : backend (households/accounts/agent), E2E `modules-sidebar.spec.ts`.

## Résumé

La sidebar a grandi module après module : ~19 entrées (22 pour un staff/owner),
et chaque nouveau parcours en ajoute une. Tous les foyers voient tout : un foyer
en appartement voit « Poulailler », un foyer sans compteur connecté voit
« Électricité ». Ce parcours fait passer la navigation du modèle « une app avec
des pages » au modèle « une plateforme de modules » : le foyer active les
modules qui le concernent, et chaque membre épingle ses modules fréquents en
tête de sidebar.

## Positionnement produit

C'est un parcours **transverse** (comme le dashboard, parcours 12) : aucun
nouveau module métier, mais une couche de personnalisation qui conditionne la
visibilité des modules existants — sidebar, dashboard, agent IA. Il prépare
l'arrivée des prochains modules : un module de plus ne doit plus coûter une
ligne de sidebar à tous les foyers.

## Étude — deux besoins distincts

1. **La pertinence est une propriété du foyer.** Avoir des poules, un compteur
   Linky, un contrat d'assurance suivi : c'est vrai ou faux pour le foyer
   entier, pas par personne. → activation **par household**, décidée par
   l'owner (comme les autres réglages structurants du foyer).
2. **La fréquence d'usage est une propriété de la personne.** Dans un même
   foyer, l'un vit dans Tâches, l'autre dans Stock. → épinglage **par user**,
   chacun le sien.

Les deux mécanismes sont indépendants et se composent : les modules désactivés
disparaissent pour tout le monde ; parmi ce qui reste, chacun ordonne son accès
rapide.

### Découpage core / optionnel

| Catégorie | Modules | Désactivable |
|---|---|---|
| Socle navigation | dashboard, agent, alerts | non |
| Socle patrimoine & suivi | zones, equipment, tasks, projects, interactions, expenses, documents | non |
| Modules métier optionnels | **electricity, water, stock, chickens, insurance, trackers, photos, directory** | **oui** |
| Compte / admin | settings, admin/* | non |

Principe : est optionnel ce qui dépend d'un contexte de foyer particulier
(équipement connecté, animaux, pratique de suivi). Le socle reste toujours
visible — c'est lui qui définit l'app.

### Choix de stockage — `disabled_modules`, pas `enabled_modules`

On stocke la **liste des modules désactivés** (`Household.disabled_modules`,
JSONField, défaut `[]`). Défaut vide = tout est actif, et surtout : **un
nouveau module livré est actif par défaut** pour tous les foyers existants,
sans migration de données. La liste est validée contre la liste canonique
`apps/households/modules.py::OPTIONAL_MODULES` (clé inconnue ou module non
optionnel → 400).

Les épinglés vivent sur `User.pinned_modules` (JSONField, liste ordonnée de
clés de navigation), pattern identique à `locale`/`theme` : exposé et modifiable
via `PATCH /api/accounts/users/me/`.

### Hors scope V1 (assumé)

- **Récents automatiques** : le tracking d'usage ajoute du churn visuel (la
  sidebar bouge toute seule) pour un gain faible vs l'épinglage manuel.
- **Gating de l'API REST** des modules désactivés : désactiver = masquer, pas
  interdire. Les données restent intactes et réactivables ; l'accès API direct
  reste possible (limite acceptée, pas un mécanisme de sécurité).
- **Activation par membre** (un membre masque un module pour lui seul) : les
  épinglés couvrent le besoin de tri personnel.
- **Groupes repliables** : l'activation par foyer raccourcit déjà la liste ;
  on ne superpose pas deux mécanismes de masquage.

## Concept interne

Aucune nouvelle app Django — deux champs et un module de constantes :

- `apps/households/modules.py` : `OPTIONAL_MODULES` (clés canoniques,
  source de vérité backend).
- `Household.disabled_modules` : JSONField défaut `[]`, exposé dans
  `HouseholdSerializer`, modifiable via le `PATCH` household existant (déjà
  protégé par `IsHouseholdOwner`).
- `User.pinned_modules` : JSONField défaut `[]`, exposé dans `UserSerializer`,
  modifiable via `/api/accounts/users/me/`.
- **Agent** : les specs `SearchableSpec` / `ListableSpec` / `WritableSpec`
  gagnent un champ déclaratif `module` (renseigné dans les `apps.py` des
  modules optionnels, `None` = socle). `retrieval.search` et les handlers
  `search_household` / `list_entities` / `create_entity` / `update_entity`
  ignorent les specs dont le module est désactivé pour le household courant.

Côté UI, **un registry unique** `ui/src/lib/modules.ts` décrit chaque entrée de
navigation (clé, route, icône, labelKey, groupe, optionnelle ou non). La
sidebar, la section Réglages et le guard de route consomment ce registry — les
clés sont les mêmes que `OPTIONAL_MODULES` côté backend (duplication d'une
liste de constantes, assumée et documentée).

## Concept visible côté utilisateur

- **Réglages → section « Modules »** (visible owner uniquement) : un toggle par
  module optionnel, effet immédiat sur la sidebar de tous les membres.
- **Sidebar** : les modules désactivés disparaissent (groupes, dashboard,
  épinglés). Un groupe vidé disparaît avec son label.
- **Épinglés** : au survol d'un item de groupe, une icône épingle permet
  d'épingler/désépingler. Les épinglés remontent dans une section « Épinglés »
  en tête (sous Dashboard/Assistant/Alertes) et **sortent de leur groupe**
  (pas de doublon — l'objectif est une nav plus courte, pas plus longue).
- **URL directe d'un module désactivé** : redirection vers le dashboard.
- **Dashboard** : les cards des modules désactivés (Électricité, Eau,
  Poulailler, Trackers) ne s'affichent plus.

---

## User stories

### US-1 — Activer/désactiver des modules (owner)

**En tant que** owner du foyer
**Je veux** choisir les modules actifs dans les réglages
**Afin de** ne montrer au foyer que ce qui le concerne

**Critères d'acceptation**
- [ ] Section « Modules » dans `/app/settings`, visible seulement si `current_user_role === 'owner'`
- [ ] Un toggle par module optionnel (icône + nom traduit), état lu depuis `household.disabled_modules`
- [ ] Toggle → `PATCH /api/households/{id}/` avec la nouvelle liste ; toast succès/erreur ; invalidation de la query households
- [ ] API : un membre non-owner reçoit 403 (permission `IsHouseholdOwner` existante), une clé inconnue ou non optionnelle reçoit 400
- [ ] Désactiver puis réactiver un module ne touche à aucune donnée

### US-2 — Sidebar reflétant les modules actifs

**En tant que** membre
**Je veux** une sidebar limitée aux modules actifs du foyer
**Afin de** naviguer dans une liste courte et pertinente

**Critères d'acceptation**
- [ ] Les items des modules désactivés n'apparaissent plus dans `Sidebar.tsx`
- [ ] Un groupe entièrement vidé disparaît (pas de label orphelin)
- [ ] Les items socle (dashboard, agent, alertes, tâches…) sont toujours visibles
- [ ] Le changement est visible sans reload après le toggle (invalidation React Query)

### US-3 — Route gardée

**En tant que** membre
**Je veux** être redirigé si j'ouvre l'URL d'un module désactivé
**Afin de** ne pas tomber sur une page « fantôme »

**Critères d'acceptation**
- [ ] Accès direct à une route d'un module désactivé (`/app/chickens`…) → redirect `/app/dashboard`
- [ ] Les routes socle ne passent jamais par le guard
- [ ] Pendant le chargement du household, pas de flash de redirect (attendre la donnée)

### US-4 — Dashboard filtré

**En tant que** membre
**Je veux** que le dashboard ne montre pas les cards des modules désactivés
**Afin de** garder un poste de pilotage cohérent avec la sidebar

**Critères d'acceptation**
- [ ] `ElectricityCard`, `WaterCard`, `ChickensCard`, `RunwaysCard` masquées si le module correspondant est désactivé
- [ ] Aucun appel réseau du module désactivé depuis le dashboard (queries non montées, pas juste `return null`)

### US-5 — Agent IA aligné

**En tant que** membre
**Je veux** que l'agent ignore les modules désactivés
**Afin de** ne pas recevoir de réponses/citations sur des modules invisibles

**Critères d'acceptation**
- [ ] Champ `module` sur les specs, renseigné dans les `apps.py` des 8 modules optionnels — zéro logique métier dans `apps/agent/`
- [ ] `search_household` n'indexe/ne retourne plus les entités d'un module désactivé pour ce foyer
- [ ] `list_entities` répond « module désactivé » (message clair) pour un type désactivé
- [ ] `create_entity`/`update_entity` refusent poliment sur un type désactivé
- [ ] Les foyers sans module désactivé ont un comportement strictement inchangé

### US-6 — Épingler un module

**En tant que** membre
**Je veux** épingler mes modules fréquents
**Afin de** les avoir en tête de sidebar

**Critères d'acceptation**
- [ ] Icône épingle au survol d'un item de groupe (et visible au tap dans le drawer mobile), toggle épinglé/désépinglé
- [ ] Persistance sur `User.pinned_modules` via `PATCH /api/accounts/users/me/` — multi-appareils
- [ ] Optimistic update (la sidebar réagit immédiatement, rollback si erreur)
- [ ] Dashboard/Assistant/Alertes/Réglages/Admin ne sont pas épinglables (déjà en position fixe)

### US-7 — Section Épinglés

**En tant que** membre
**Je veux** une section « Épinglés » en tête de sidebar
**Afin d'** accéder en un clic à mes modules fréquents

**Critères d'acceptation**
- [ ] Section sous le bloc Dashboard/Assistant/Alertes, label « Épinglés », dans l'ordre de `pinned_modules`
- [ ] Un item épinglé sort de son groupe d'origine (pas de doublon)
- [ ] Section absente si aucun épinglé (état actuel inchangé)
- [ ] Un module épinglé puis désactivé par l'owner disparaît aussi des épinglés (sans corrompre la préférence : réactivation → il revient)

### US-8 — i18n complète

**En tant que** membre non anglophone
**Je veux** la section Modules et les épinglés dans ma langue
**Afin de** rester dans une app cohérente

**Critères d'acceptation**
- [ ] Clés `settings.modules.*`, `sidebar.pinned`, `sidebar.pin`/`unpin` dans les 4 fichiers (en/fr/de/es), aucune `defaultValue`
- [ ] Les noms de modules réutilisent les clés titres existantes (`chickens.title`…), pas de re-traduction

---

## Carte d'intégration (récap)

| Brique existante | Connexion |
|---|---|
| `households` | `disabled_modules` + validation `modules.py`, PATCH existant (`IsHouseholdOwner`) |
| `accounts` | `User.pinned_modules`, PATCH `users/me/` existant |
| `agent` | Champ `module` sur les specs, filtrage dans retrieval + tools handlers |
| `dashboard` | Cards conditionnées aux modules actifs |
| `settings` (UI) | Nouvelle section « Modules » owner-only |
| Sidebar / router | Registry `ui/src/lib/modules.ts` consommé par Sidebar, Settings, guard |

## Découpage en lots

- **Lot 1 — Backend** : `OPTIONAL_MODULES`, `Household.disabled_modules`,
  `User.pinned_modules`, serializers + validation, migrations (US-1 API, socle US-6)
- **Lot 2 — Navigation dynamique** : registry front, sidebar filtrée, section
  Réglages « Modules », guard de route, dashboard filtré (US-1 UI, US-2, US-3, US-4)
- **Lot 3 — Agent** : champ `module` sur les specs + filtrage (US-5)
- **Lot 4 — Épinglés** : section sidebar + pin/unpin + persistance (US-6, US-7)

i18n (US-8) transverse à chaque lot. Issues GitHub : « Parcours 15 — Lot N : … »,
labels `feat` / `app:households` / `i18n`.
