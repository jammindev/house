# Parcours 18 — Comprendre à quel rythme on consomme un article de stock

> Cadré le 2026-07-15 avec l'utilisateur (session `/po`). **Reprend l'idée
> explicitement reportée au Parcours 11 Lot 7** (« estimer un rythme depuis les
> achats datés `stock_purchase` si le besoin revient » — hors scope à l'époque).
> S'appuie sur le stock (parcours métier), les dépenses/`Interaction`
> (parcours 08), le poulailler (parcours 14, `ChickenSettings.feed_stock_item`)
> et la météo (parcours 17, `weather.services.get_history`).
> Issues : **#288** (18.1), **#289** (18.2), **#290** (18.3), **#291** (18.4),
> **#292** (18.5).

## Le constat

Le mécanisme stock+achat actuel (`StockItemViewSet.purchase`) fait déjà beaucoup :
il incrémente la quantité, snapshot `unit_price`/`supplier`/`purchase_date` sur
l'article, recalcule le statut (low/out), notifie, et crée une
`Interaction(type=expense, kind="stock_purchase")` liée par FK polymorphe — qui
alimente le fil d'activité, la page dépenses, le coût par œuf du poulailler et le
RAG de l'agent. Mais à l'usage (profil réel : article « Nourriture poules »), il
montre trois limites :

1. **Multi-marque / multi-fournisseur non tracé.** On achète des graines de
   marques différentes chez des enseignes différentes. Le fournisseur est capturé
   *par achat* dans l'interaction, mais **la marque n'est nulle part**, et
   l'historique par article n'est pas surfacé — impossible de comparer où et à
   quel prix on achète.
2. **Changer la quantité n'est pas évident.** `adjust-quantity` prend un **delta
   ±** : « il reste 4 kg » oblige à calculer « −3,8 ». Geste contre-intuitif.
3. **Aucune courbe de descente.** La quantité est **mutée en place** : hormis
   `last_restocked_at` (mono-valeur), aucun niveau daté n'est conservé. On ne peut
   ni tracer la descente du stock, ni estimer un rythme de conso, ni anticiper la
   rupture. C'est précisément le besoin repoussé au Lot 7 du parcours 11.

## L'intuition qui débloque tout — le « restant » à l'achat

Au parcours 11 Lot 7, on avait **retiré la saisie de conso au quotidien** (trop
lourde, personne ne la fait) au profit du seul enregistrement des achats. Le
problème restait : sans point de niveau entre deux achats, pas de rythme.

La solution validée : **à chaque achat, on demande (optionnellement) combien il
restait avant de réapprovisionner.** On sait presque toujours ce chiffre (le sac
était quasi vide). Il donne, sans geste supplémentaire :

- un **point de niveau daté** (la conso réelle depuis le dernier point connu =
  `dernier_niveau − restant`) ;
- une **auto-correction de la dérive** : stock théorique et réel se recalent à
  chaque achat ;
- de quoi tracer une **courbe** et dériver **rythme moyen** + **date de rupture**
  — sans jamais imposer une saisie quotidienne.

L'achat devient ainsi le **déclencheur principal** des points de conso ;
l'inventaire spontané (valeur absolue) reste un confort secondaire.

## Positionnement produit

- Parcours 08 — Suivre ses dépenses (l'achat reste une `Interaction` expense).
- Parcours 11 — Trackers / Lot 7 (retrait de la conso poules vers le stock) : ce
  parcours **livre l'idée reportée** de ce lot, sans réintroduire le kind
  `consumption` supprimé (pas de `reserve`/`rate_per_day` saisis à la main : on
  **dérive** le rythme du niveau observé).
- Parcours 14 — Poulailler : `ChickenSettings.feed_stock_item` pointe déjà un
  article de stock. La courbe de conso + date de rupture de la nourriture est la
  suite naturelle (la `FeedCard` la surface).
- Parcours 17 — Météo : `weather.services.get_history` fournit les températures
  journalières pour l'overlay de corrélation (déjà fait pour élec/eau au Lot 6).

## Décisions de cadrage (confirmées avec l'utilisateur le 2026-07-15)

### Décision 1 — Un modèle dédié `StockLevelReading`, pas de metadata

Tracer une courbe = **requêter un champ numérique daté dans le temps**. La règle
de décision du CLAUDE.md (« Interaction vs modèle dédié ») tranche : dès qu'il
faut **requêter/agréger un champ structuré** (et pas seulement l'afficher), c'est
un **modèle dédié** — comme `MeterReading` (élec) et `EggLog` (poules). On
**n'utilise pas** `metadata` d'`Interaction` (limite assumée du carnet de
rénovation : metadata = affiché, jamais requêté).

`StockLevelReading` (household-scoped) :

| champ | type | rôle |
|---|---|---|
| `stock_item` | FK `stock.StockItem`, `CASCADE` | l'article suivi |
| `reading_at` | `DateTimeField` | quand le niveau a été observé |
| `quantity` | `DecimalField(12,3)` | niveau **absolu** à cet instant |
| `kind` | `CharField` choices | `inventory` (comptage/restant) \| `purchase` (niveau après réappro) |
| `source_interaction` | FK `interactions.Interaction`, `SET_NULL`, null | relie le point d'achat à sa dépense |
| `created_by` | FK user | traçabilité |

Sémantique de la courbe : chaque relevé est un point `(reading_at, quantity)`.
Un achat avec `restant` produit **deux relevés** quasi simultanés — un `inventory`
au niveau `restant` (fin de la descente), puis un `purchase` au niveau
`restant + delta` (le saut de réappro). Le **rythme** se dérive des descentes
entre relevés mesurés (on ignore les sauts d'achat) ; la **date de rupture** =
`dernier_niveau / rythme`. Aucun rythme n'est saisi à la main.

> Anti-double-vérité : le relevé enregistre le niveau **absolu**, jamais un delta.
> `StockItem.quantity` reste la vérité « niveau courant » ; le dernier
> `StockLevelReading` doit coïncider avec elle. Toute écriture passe par le service
> (cf. décision 2), jamais par l'ORM brut, pour garantir cette cohérence.

### Décision 2 — Extraire le service d'achat de la view

Aujourd'hui toute la logique d'achat vit dans `StockItemViewSet.purchase`.
L'agent (décision 5) ne peut pas la réutiliser sans dupliquer. On **extrait**
`apps/stock/services.py` :

- `purchase_stock_item(*, item, user, delta, amount, supplier, brand, remaining_before, occurred_at, notes) -> (item, interaction)`
  — recalage quantité (`remaining_before + delta` si fourni, sinon `+= delta`),
  snapshots, relevés (`inventory` du restant + `purchase` du nouveau niveau),
  interaction dépense, recalcul statut + notification. **Transaction atomique
  unique.** La view et le writable agent l'appellent tous les deux.
- `record_inventory(*, item, user, quantity, occurred_at=None) -> item`
  — pose la quantité **absolue**, écrit un `StockLevelReading(kind=inventory)`,
  recalcule le statut, notifie.

Règle : REST **et** agent passent par ces services ; un test verrouille la parité
(cf. parcours 13, règle 5).

### Décision 3 — La marque est un champ d'achat, affiché non requêté

`brand` (optionnel) rejoint le `StockPurchaseSerializer` et part dans
`metadata` de l'interaction via `extra_metadata` (`_build_expense_metadata`).
Cohérent avec la rénovation : la marque est **affichée** dans l'historique
d'achats, **pas requêtée**. Si un jour on veut filtrer/agréger par marque, ce
sera le signal d'un modèle dédié — pas maintenant.

### Décision 4 — Inventaire = valeur absolue, geste par défaut

Nouvelle action `POST /stock/{id}/inventory/` (`{ quantity }`) → `record_inventory`.
Le champ est pré-rempli avec la quantité courante. Le mode delta ± reste dispo
(via `adjust-quantity`) mais l'inventaire absolu devient le geste mis en avant.
`quantity` négatif refusé ; `quantity` = courante accepté (point « plat »).

### Décision 5 — Volet agent complet (convention `/new-feature`)

Le stock est déjà *searchable*, pas *writable*. On câble l'agent :

- `stock_item` dans `agent.writables` → **création** via le tool générique
  `create_entity` (service réutilisant `StockItemSerializer`).
- **Achat** et **inventaire** en langage naturel, adossés aux services de la
  décision 2 (effet composé → action dédiée ou extension du contrat d'écriture,
  à trancher à l'implémentation). Écritures **réversibles** (`UNDO_HANDLERS`,
  toast « Annuler »), garde-fou « demande explicite uniquement ».
- **Lecture conso** : l'agent répond « à quel rythme ? / quand serai-je à
  court ? » via les métriques dérivées (tool de lecture ou injection dans la
  conversation ancrée). Si < 2 relevés : il le dit, n'invente pas de projection.
- **Assistant ancré** : `EntityAssistant entityType="stock_item"` sur la fiche
  article, `related` du `SearchableSpec` enrichi des achats/relevés récents.

### Décision 6 — Overlays de corrélation, extensibles

La courbe (fiche article) accepte des overlays sur un second axe, en réutilisant
le mécanisme élec/eau (#286). V1 : **température** (`weather.services.get_history`).
Architecture ouverte à d'autres overlays (ex. **effectif du poulailler** depuis
`chickens`) sans réécrire le graphe. Toggle masqué si le module source est
indisponible pour le foyer.

## Concept visible côté utilisateur

- **Formulaire d'achat enrichi** (`PurchaseForm`, partagé stock+équipement) :
  champs **marque** et **quantité restante avant achat** (pré-rempli, optionnel).
  Si le restant diffère du théorique, un texte non bloquant le signale (« stock
  ajusté de X à Y »).
- **Action « Inventaire »** sur la card et la fiche : saisie en valeur absolue.
- **Historique des achats** sur la fiche article : liste datée (marque ·
  fournisseur · quantité · prix unitaire · prix total), chaque ligne cliquable
  vers la dépense.
- **Courbe de consommation** sur la fiche : quantité = f(temps), sauts d'achat
  vers le haut, descentes de conso ; sélecteur de période ; **rythme moyen** +
  **date de rupture estimée** ; état vide si < 2 relevés.
- **Overlay température** (toggle) sur la courbe.
- **Assistant ancré** sur la fiche : « quand serai-je à court de graines ? ».
- **Poulailler** : la `FeedCard` surface la date de rupture de la nourriture liée.

## Backlog produit V1

| Lot | But | Issue | Labels |
|---|---|---|---|
| 18.1 | **Backend socle** — `StockLevelReading` + migration ; `stock/services.py` (`purchase_stock_item`, `record_inventory`) ; `remaining_before` + `brand` sur l'achat ; action `inventory` ; tests | #288 | `feat` `app:stock` |
| 18.2 | **Frontend achat + inventaire** — `PurchaseForm` (marque, restant, feedback) ; action inventaire ; historique d'achats sur la fiche ; i18n ; E2E | #289 | `feat` `app:stock` `i18n` |
| 18.3 | **Courbe de consommation** — `GET /stock/{id}/consumption/` (série + métriques) ; graphe fiche + période + rythme + rupture ; état vide ; i18n | #290 | `feat` `app:stock` `i18n` |
| 18.4 | **Agent** — writable `stock_item` (create) + achat/inventaire ; lecture conso ; `EntityAssistant` fiche article ; undo ; tests parité REST/agent | #291 | `feat` `app:stock` `app:agent` |
| 18.5 | **Overlays corrélation** — température sur la courbe (réutilise #286) ; extensible effectif poulailler ; date de rupture nourriture dans la `FeedCard` ; i18n | #292 | `feat` `app:stock` `app:chickens` `i18n` |

Ordre imposé : **18.1 → 18.2 / 18.3 → 18.4 → 18.5**. Le service extrait (18.1)
est le prérequis de tous les autres. Regroupement PR suggéré : `feat/stock-consumption`
pour 18.1–18.3, `feat/stock-agent` pour 18.4, `feat/stock-correlations` pour 18.5.

### Story 18.1 — Backend socle

En tant que membre du foyer, je veux que chaque achat et chaque inventaire
conservent un niveau daté, afin de pouvoir tracer ma consommation.

**Critères d'acceptation**
- Modèle `StockLevelReading` (champs ci-dessus) + migration ; household-scoped,
  manager `HouseholdScopedManager`, index `(stock_item, reading_at)`.
- `apps/stock/services.py::purchase_stock_item` extrait de la view, **transaction
  atomique** : recalage quantité (`remaining_before + delta` si fourni), snapshots
  (`unit_price`/`supplier`/`purchase_date`/`last_restocked_at`), relevés
  (`inventory` du restant si fourni + `purchase` du nouveau niveau),
  `create_expense_interaction(kind="stock_purchase", extra_metadata={..., brand, delta, unit})`,
  recalcul statut + `notify_stock_status_change`. La view `purchase` délègue.
- `record_inventory` : quantité absolue, relevé `inventory`, statut, notification.
- `StockPurchaseSerializer` gagne `remaining_before` (optionnel, ≥ 0) et `brand`
  (optionnel). Action `POST /stock/{id}/inventory/` + `StockInventorySerializer`.
- Le dernier relevé coïncide avec `StockItem.quantity` (invariant testé).
- Tests pytest : achat sans/avec restant (recalage + 1 ou 2 relevés), inventaire,
  marque en metadata, statut/notif, restant négatif refusé, parité invariant.

### Story 18.2 — Frontend achat + inventaire

En tant que membre du foyer, je veux saisir marque et quantité restante à l'achat,
et faire un inventaire en valeur absolue, afin d'alimenter un historique fiable
sans effort.

**Critères d'acceptation**
- `PurchaseForm` : champ **marque** (optionnel) ; champ **quantité restante avant
  achat** (pré-rempli avec la quantité courante, optionnel) ; message non bloquant
  « stock ajusté de X à Y » si écart. Rétro-compatible équipement (`withDelta=false`
  → pas de restant).
- Action **« Inventaire »** (card + fiche) : dialog valeur absolue pré-rempli ;
  refus si négatif ; « Annuler » jamais désactivé.
- **Historique des achats** sur `StockItemDetailPage` : liste datée (marque ·
  fournisseur · quantité · PU · total), tri desc, ligne → dépense ; état vide ;
  skeleton `useDelayedLoading`.
- Client API + hooks (`remaining_before`, `brand`, `recordInventory`), toast +
  invalidation ; suppression annulable là où pertinent.
- i18n en/fr/de/es (zéro `defaultValue`), tokens design-system uniquement.
- E2E : achat avec restant → l'historique et la quantité reflètent le recalage.

### Story 18.3 — Courbe de consommation

En tant que membre du foyer, je veux visualiser la descente de mon stock et savoir
quand je serai à court, afin d'anticiper mes réapprovisionnements.

**Critères d'acceptation**
- `GET /stock/{id}/consumption/?period=` → série de points `(date, quantity, kind)`
  + métriques : `rate_per_day`, `projected_depletion_date`, `last_level`,
  `points_count`.
- Rythme dérivé des descentes entre relevés mesurés (sauts d'achat exclus) ;
  rupture = `last_level / rate`. Nul/omises si `points_count < 2`.
- Graphe sur la fiche (composant partagé élec/eau) : achats en hausse, conso en
  descente ; sélecteur période (30 j / 90 j / 1 an / tout) ; affichage rythme +
  date de rupture ; état vide « pas assez d'historique » si < 2 points ; skeleton ;
  tokens couleur.
- i18n complet.

### Story 18.4 — Agent

En tant que membre du foyer, je veux acheter/inventorier/créer un article et
interroger ma conso en langage naturel, afin de gérer le stock depuis le chat.

**Critères d'acceptation**
- `WritableSpec(entity_type='stock_item')` dans `apps/stock/apps.py` (create =
  adaptateur vers un service réutilisant `StockItemSerializer`).
- Achat et inventaire agent adossés à `purchase_stock_item` / `record_inventory`
  (résolution article par nom via `searchables` ; ambiguïté → demande de préciser).
- Champs achat compris : `delta`, `amount`, `supplier`, `brand`, `remaining_before`,
  `occurred_at`, `notes` ; champs manquants laissés vides, jamais inventés.
- Écritures réversibles (`UNDO_HANDLERS` : article, inventaire, achat) ; garde-fou
  « demande explicite » + anti-doublon `service.ask`.
- Lecture conso : métriques 18.3 exposées (tool ou injection contexte ancré) ;
  < 2 relevés → l'agent le dit.
- `EntityAssistant entityType="stock_item"` sur la fiche ; `related` du
  `SearchableSpec` enrichi (achats/relevés récents).
- Extension `_CREATE_ENTITY_*` (`apps/agent/tools.py`) ; tests parité REST/agent.

### Story 18.5 — Overlays de corrélation

En tant que membre du foyer, je veux superposer la température (puis d'autres
facteurs) sur ma courbe de conso, afin de repérer des corrélations.

**Critères d'acceptation**
- Toggle **« Température »** sur la courbe 18.3, second axe, même période,
  `weather.services.get_history` (réutilise #286, pas de réimplémentation).
- Toggle masqué/désactivé si météo indisponible pour le foyer.
- Architecture ouverte à d'autres overlays (effectif poulailler `chickens`) sans
  réécrire le graphe.
- **Poulailler** : la `FeedCard` surface la date de rupture estimée de l'article
  `feed_stock_item` (métrique 18.3).
- i18n des libellés de toggle/légende.

## Hors scope V1

- **Filtre/agrégation par marque** (metadata affiché, pas requêté) — signal → modèle.
- **Rythme saisonnalisé / prévision ML** — V1 = régression linéaire simple sur les
  descentes.
- **Multi-article agrégé** (courbe « toute une catégorie ») — V1 = par article.
- **Overlay effectif poulailler** — architecture prête, branchement ultérieur.
- **Alerte proactive « bientôt à court »** — l'alerte low/out sur `min_quantity`
  existe déjà ; une alerte dérivée du rythme viendra si le besoin émerge (module
  alertes, pas ici).

## Définition de done — V1

1. Un achat avec « restant » recale la quantité et crée deux relevés (descente +
   saut) ; la marque apparaît dans l'historique d'achats de la fiche.
2. Un inventaire en valeur absolue met à jour la quantité et crée un relevé.
3. La fiche affiche une courbe de descente avec rythme moyen et date de rupture ;
   état vide propre sous 2 points.
4. L'overlay température se superpose à la courbe ; masqué si météo indisponible.
5. L'agent crée un article, enregistre un achat/inventaire (réversible) et répond
   « quand serai-je à court ? » ; create REST et agent produisent le même résultat.
6. La `FeedCard` du poulailler surface la date de rupture de la nourriture liée.
7. `pytest`, `npm run lint` et types API régénérés verts ; i18n complet en/fr/de/es.

## Recette manuelle (à pratiquer après livraison)

1. Sur l'article réel « Nourriture poules » : enregistrer 4–5 achats avec restant
   sur plusieurs semaines, observer la courbe, le rythme et la date de rupture.
2. Vérifier la cohérence avec le poulailler (coût par œuf, `FeedCard`).
3. Activer l'overlay température : la conso monte-t-elle par grand froid ? Ouvrir
   une issue ciblée (overlay effectif poules ?) plutôt que spéculer sur la V2.
