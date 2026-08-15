# Module Verger (`apps/orchard`)

> Le carnet des pérennes du foyer : ce qu'on a fait à chaque sujet, ce que chacun
> a donné, et ce que la saison réclame. Livré au parcours 30.
>
> Doc produit : [PARCOURS_30_SUIVRE_LE_VERGER.md](../parcours/PARCOURS_30_SUIVRE_LE_VERGER.md) ·
> Fiche concept : [CADENCE_SAISONNIERE.md](../fiches/CADENCE_SAISONNIERE.md) ·
> Compte rendu : [CR_PARCOURS_30_VERGER.md](../comptes-rendus/CR_PARCOURS_30_VERGER.md)

## En une phrase

Un arbre fruitier est un **objet lent** — il produit une fois par an et répond à
un geste la saison suivante. Le module tient les trois faits qu'aucune mémoire ne
retient à cette échelle, et n'invente qu'une mécanique : la **cadence
saisonnière**.

## Modèles

| Modèle | Table | Rôle |
|---|---|---|
| `Tree` | `orchard_trees` | Un sujet pérenne : arbre fruitier, petits fruits, vigne, ornemental |
| `TreeEvent` | `orchard_tree_events` | Le journal d'entretien, typé et daté |
| `Harvest` | `orchard_harvests` | Une cueillette : quantité + unité + date |
| `CareRule` | `orchard_care_rules` | Une cadence **saisonnière** (fenêtre de mois) |

### Ce qui ne doit pas bouger

- **`Tree.zone` est obligatoire et en `PROTECT`.** La zone est un contenant,
  l'arbre est un bien : supprimer « Jardin » ne doit pas effacer quinze ans de
  récoltes en silence. `ZoneViewSet.destroy` traduit le `ProtectedError` en
  **409 qui nomme et compte** ce qui bloque — sans ça, c'est un 500 sur un geste
  banal.
- **Une entité `Tree` avec un `kind`, pas quatre modèles.** `kind` pilote
  l'affichage et les valeurs proposées, **jamais le schéma**. Le jour où un foyer
  récolte des feuilles de tilleul, l'ornemental doit pouvoir porter une récolte
  sans migration.
- **Le journal est dédié, pas une `Interaction`.** L'échéance se dérive d'un
  `MAX(occurred_on)` **groupé par règle** : un `GROUP BY` sur une FK, que
  `metadata` ne permet ni d'indexer ni de contraindre. **Contrepartie assumée** :
  comme le poulailler, le verger n'apparaît pas dans le fil d'activité du foyer —
  sujet transverse (#509), pas une raison de dupliquer le journal.
- **`Harvest` n'est ni une `Interaction` ni un `Tracker`.** Agrégée par saison,
  donc jamais du JSON ; et elle porte une unité, une saison et plusieurs
  occurrences par saison.
- **`next_due` n'est stocké nulle part.** Un test le vérifie. Une échéance
  dénormalisée dérive au premier événement édité, et un rappel qui se déclenche
  sur une date périmée est pire que pas de rappel.

## La cadence saisonnière

Tout est dans [`docs/fiches/CADENCE_SAISONNIERE.md`](../fiches/CADENCE_SAISONNIERE.md).
Le minimum à savoir avant de toucher `apps/orchard/seasons.py` :

- une **saison** porte l'année où sa fenêtre **s'ouvre** — le 20 décembre 2026 et
  le 15 janvier 2027 sont la même saison 2026 pour une règle « novembre → mars » ;
- la fenêtre **à cheval sur deux années est le cas normal**, pas le cas limite :
  tout test qui n'utilise que « juin → août » laisse le bug en place ;
- quatre états — `upcoming`, `due`, `done`, **`missed`** — et `missed` n'est pas
  `due` : une fenêtre refermée ne se rattrape pas, mais elle se **dit** ;
- **une règle par type est un état par sujet.** Avoir taillé un pommier sur cinq
  ne solde pas la saison.

## Ce que le module réutilise, et ne réimplémente jamais

| Brique | Usage |
|---|---|
| `zones` | `Tree.zone` obligatoire, `PROTECT` |
| `tasks` | Une règle **propose** une tâche (`create_task`) — aucun rappel maison |
| `alerts` | Règles échues + gel × floraison dans le résumé existant |
| `weather` | `evaluate_weather_alerts` / `KIND_FROST` **tel quel**, aucun seuil réécrit |
| `interactions` | Achat via `create_expense_interaction(kind='orchard_purchase')` |
| `documents` / `photos` | `DocumentLink` polymorphe + onglets génériques |
| `agent` | 3 registries + `get_harvest_stats`, déclarés depuis `apps.py::ready()` |

**Les onglets Documents et Photos ont coûté une ligne de backend**, découverte
après coup : le filtre par entité de l'API documents était une **liste blanche
écrite en dur**, pas un mécanisme générique. `?tree=` y était donc ignoré — et un
filtre ignoré ne rend pas *moins* de documents, il les rend **tous**. Corrigé en
dérivant la liste du registre `agent.searchables` et en **refusant** un type
inconnu. Les deux onglets passent désormais par la forme non ambiguë
`?linked_to=tree:<id>`. Régression : `documents/tests/test_entity_filter.py`.

## API

```
/api/orchard/trees/            CRUD  ?zone= ?kind= ?status= (défaut : vivants)
/api/orchard/trees/{id}/purchase/    POST — dépense via le service partagé
/api/orchard/events/           CRUD  ?tree= ?type= ?from= ?to=
/api/orchard/harvests/         CRUD  ?tree= ?season=
/api/orchard/harvests/summary/ GET   série par saison (?tree=, ?seasons=)
/api/orchard/care-rules/       CRUD  ?active=false
/api/orchard/care-rules/season/           GET  ce que la saison réclame
/api/orchard/care-rules/{id}/complete/    POST « c'est fait » sur un sujet
/api/orchard/care-rules/{id}/create-task/ POST une tâche datée
```

Toute écriture passe par `apps/orchard/services.py` — viewsets **et** agent.

## Agrégats

- `queries.harvest_totals` / `harvest_series` — **groupés par unité**, jamais
  additionnés : 12 kg et 40 pièces ne font pas 52 de quoi que ce soit. Toute la
  série tient en **une requête** (test `assertNumQueries`).
- `queries.rule_states` — l'état de chaque paire (règle, sujet), en deux requêtes
  quelle que soit la taille du verger.
- La saison se calcule en **fuseau du foyer** (`core.timezones`) : une cueillette
  saisie le 31 décembre au soir tomberait sinon dans la mauvaise année.

## Frontend

`ui/src/features/orchard/` — pattern Feature page standard. Points spécifiques :

- la page **groupe par zone** : un foyer parcourt son jardin, il ne balaie pas
  une liste alphabétique ;
- `SeasonPanel` ouvre la page — ce que la saison réclame passe avant le registre ;
- quantités en `DecimalInput`, rendues par `formatQuantity` (`lib/format.ts`) —
  **jamais** `toLocaleString()` sans locale, garde-fou `lib/locale.test.ts` ;
- racine de cache **`orchard`**, avec ses arêtes dans `DERIVED_FROM` : `alerts`,
  `dashboard`, `zones`.

## Ce qui reste

Issue annexe **#602** : DAR après traitement (V1.1), pollinisation croisée, base
de variétés, plan du verger, crédit d'une récolte au stock, détection de déclin,
degré-jours, potager annuel (parcours distinct).

Non livré de la V1 : le **widget dashboard** (ORCH-11) — l'alerte gel remonte
bien dans le résumé d'alertes, mais aucune card ne l'affiche sur le tableau de
bord.
