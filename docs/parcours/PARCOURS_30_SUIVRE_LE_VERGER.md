# Parcours 30 — Suivre le verger

> **État** — cadrage réalisé le 2026-08-15. **Aucune ligne de code.**
> Backlog technique : [PARCOURS_30_BACKLOG_TECHNIQUE.md](./PARCOURS_30_BACKLOG_TECHNIQUE.md).
> Fiche concept : [CADENCE_SAISONNIERE.md](../fiches/CADENCE_SAISONNIERE.md).

## Résumé

> « Le pommier a moins donné cette année. Ou alors c'est l'an dernier qu'il
> avait moins donné, je ne sais plus. Et je crois qu'on l'a taillé, mais je ne
> sais plus quand. »

Un arbre fruitier est un **objet lent**. Il vit trente à quatre-vingts ans, il
produit une fois par an, et il répond à un geste avec un an de décalage. La
mémoire humaine n'est pas construite pour ça : elle tient bien la semaine, mal
l'année, et pas du tout la comparaison entre deux années. Résultat, le foyer
possède le verger mais ne sait pas le lire — il ne peut ni dire ce qu'il a fait,
ni dire ce que ça a donné, ni relier les deux.

Le module **Verger** est un carnet qui tient à la place du foyer les trois faits
qu'aucune tête ne retient à l'échelle de l'année : **ce qu'on a fait à chaque
arbre**, **ce que chaque arbre a donné**, et **ce qui reste à faire cette
saison**. Il s'appuie entièrement sur des briques déjà en place — les zones, les
tâches, les dépenses, les photos, la météo, l'agent — et n'invente qu'une seule
mécanique nouvelle : une **échéance saisonnière**, qui dit « la taille d'hiver,
c'est entre novembre et mars » là où l'app ne savait dire jusqu'ici que « tous
les N jours ».

## Positionnement produit

Après le poulailler (parcours 14), c'est le **deuxième module vivant** du foyer —
et il en est l'exact opposé sur l'axe qui compte : le poulailler a un geste
**quotidien** (ramasser les œufs) et une mémoire courte ; le verger a un geste
**annuel** et une mémoire longue. Cette différence est ce que le module apporte
au socle : jusqu'ici, toutes les récurrences de l'app étaient des **intervalles**
(`interval_days` des corvées de poulailler, `maintenance_interval_months` des
équipements, récurrences mensuelles de l'argent). Aucune ne sait exprimer « en
hiver ». Le parcours 30 introduit la **fenêtre calendaire** et, ce faisant,
ajoute au socle une forme d'échéance que les autres modules pourront réutiliser.

Il lève aussi une limite de couverture : les zones extérieures du foyer
(jardin, verger, potager) existent dans l'app depuis le parcours 05, mais rien ne
les habite. Une zone « Verger » sans contenu est une zone qu'on n'ouvre jamais.

## Étude métier — l'arboriculture familiale

Ce qui caractérise un verger **familial** (vs professionnel) :

- **Peu de sujets, tous connus individuellement.** Trois à trente arbres, chacun
  désigné par un nom d'usage (« le gros pommier du fond »), pas par un rang de
  plantation. La variété est souvent approximative ou perdue — surtout pour les
  arbres plantés par le propriétaire précédent.
- **Le geste est saisonnier, pas périodique.** La taille d'hiver se fait après
  les grands froids et **avant le débourrement** ; la taille en vert en été ; un
  traitement d'automne à la chute des feuilles. « Tous les 365 jours » ne décrit
  aucun de ces gestes : ce qui commande, c'est le mois, pas le compteur.
- **La récolte est la seule mesure de succès**, et elle est **alternante** : un
  pommier peut donner beaucoup une année et peu la suivante sans que rien n'aille
  mal. Une seule année ne veut donc rien dire — il faut la série.
- **Les accidents sont climatiques.** Le gel de printemps **sur fleurs** détruit
  une récolte entière en une nuit, et c'est le seul accident contre lequel un
  foyer peut réellement agir (voile d'hivernage, aspersion) s'il est prévenu la
  veille.
- **Le savoir se perd.** Date de plantation, variété, porte-greffe, qui a taillé
  et quand : rien de tout ça n'est écrit, et le foyer suivant repart de zéro.
- **Ce n'est pas que des arbres.** Le même geste — tailler, traiter, récolter,
  noter — s'applique aux framboisiers, aux cassissiers, à la vigne et à la haie.
  Un module « arbre fruitier » forcerait le foyer à mentir sur ce qu'il possède.

**Hors sujet en familial** : registre phytosanitaire réglementaire et certiphyto,
rendement à l'hectare, éclaircissage calibré, taille de formation
professionnelle, conduite palissée sur fil, vente avec facturation.

### Use cases couverts (V1)

| # | Use case | Réponse produit |
|---|----------|-----------------|
| UC1 | Connaître son verger | Registre des sujets, rattachés à une zone, avec variété et date de plantation |
| UC2 | Se souvenir de ce qu'on a fait | Journal d'entretien daté et typé, par arbre |
| UC3 | Savoir ce qui reste à faire cette saison | Règles d'entretien à fenêtre calendaire, échéance dérivée |
| UC4 | Mesurer ce que ça donne | Récoltes chiffrées (quantité + unité) et série par saison |
| UC5 | Protéger la récolte | Alerte gel croisée avec la période de floraison déclarée |
| UC6 | Savoir ce que ça a coûté | Achat de l'arbre via les dépenses existantes |
| UC7 | Voir l'arbre changer | Photos datées sur la fiche, avec les composants existants |
| UC8 | Demander à l'IA | « Combien de kilos de pommes cette année ? », « note que j'ai taillé le prunier » |

### Hors scope V1 (assumé, capturé au backlog)

- **Délai avant récolte (DAR)** après traitement — reporté en V1.1, c'est le
  premier sujet de la liste différée.
- **Pollinisation croisée** — savoir qu'un fruitier autostérile n'a pas de
  partenaire dans le verger suppose une base de variétés, ou une déclaration
  manuelle qui n'aiderait que ceux qui savent déjà.
- **Base de variétés** avec fenêtre de récolte attendue et sensibilités connues.
- **Plan / carte du verger**, géolocalisation d'un sujet.
- **Crédit automatique de la récolte au stock** — les 12 kg de pommes ne
  deviennent pas encore une réserve.
- **Détection de déclin** (« ce prunier ne donne plus depuis trois ans ») — il
  faut d'abord trois ans de données.
- **Potager annuel** (semis, planches, rotation) — c'est un autre métier et un
  autre modèle, donc un autre parcours.
- **Registre phytosanitaire réglementaire** — jamais : ce n'est pas le produit.

## Concept interne

Nouvelle app Django `apps/orchard/`, quatre modèles, tous `HouseholdScopedModel`.

- **`Tree`** — un sujet pérenne du verger. `zone` FK **obligatoire** (`PROTECT`),
  `name`, `kind` (`fruit_tree` | `berry_bush` | `vine` | `ornamental`),
  `species` (variété, texte libre), `rootstock` (porte-greffe), `planted_on`
  nullable (« si connue »), `flowering_months` (période de floraison déclarée,
  vide = non renseigné), `status` (`alive` | `ailing` | `dead` | `removed`),
  `notes`, `document_links`.
- **`TreeEvent`** — le journal d'un sujet. `tree` FK CASCADE, `type` (`pruning` |
  `treatment` | `fertilizing` | `watering` | `training` | `observation` |
  `flowering` | `other`), `occurred_on`, `title`, `notes`, et `care_rule` FK
  nullable `SET_NULL` vers la règle qui a motivé le geste.
- **`Harvest`** — une récolte. `tree` FK CASCADE, `harvested_on`, `quantity` +
  `unit` (kg | pièces | litres), `notes`.
- **`CareRule`** — une règle d'entretien **saisonnière** : `name`, fenêtre de mois
  (`start_month` → `end_month`, éventuellement à cheval sur deux années),
  portée (un arbre précis, ou tous les sujets d'un `kind`), `is_active`.
  **`next_due` n'est jamais stocké** : il se dérive à la lecture du dernier
  `TreeEvent` lié.

**Pourquoi un journal dédié et pas des `Interaction` génériques** — arbitré au
cadrage, avec la règle « Interaction vs modèle dédié » du `CLAUDE.md`. L'échéance
d'entretien se dérive d'un `MAX(occurred_on)` **groupé par règle** : c'est un
`GROUP BY` sur une FK, exactement ce que le projet interdit de faire depuis
`metadata` — le même raisonnement qui a fait de `Interaction.recurring_expense`
une vraie colonne. S'y ajoutent un `type` qu'on filtre et qu'on contraint, et une
cascade par arbre. Contrepartie **assumée et connue** : comme le poulailler
aujourd'hui, les entrées du verger n'apparaissent pas dans le fil d'activité du
foyer. C'est un sujet transverse à traiter pour les deux modules d'un coup
(issue #509, « le carnet de la maison, vue transversale »), pas une raison de
dupliquer le journal du verger dans le journal du foyer.

Réutilisation des briques transverses — **le module n'invente aucun schéma qui
existe déjà** :

- **Achat d'un arbre** → `interactions.services.create_expense_interaction`
  (`source=tree`), avec son template dans `AUTO_SUBJECT_TEMPLATES`. Le coût du
  verger tombe donc dans les dépenses, les budgets et les agrégations, sans une
  ligne d'agrégat nouvelle.
- **Photos** → `documents.DocumentLink` et les composants génériques
  `EntityDocumentsTab` / `EntityPhotosTab`.
- **Rappels** → une `Task` du module tâches, créée en un clic depuis une règle
  échue. Le module **ne crée aucun mécanisme de rappel** : il en existe déjà
  trois, un quatrième donnerait quatre définitions de « en retard ».
- **Alerte gel** → `weather.alerts.evaluate_weather_alerts`, qui calcule déjà le
  gel. Le module n'apporte que le croisement avec la floraison déclarée ; aucun
  seuil n'est réécrit.
- **Agent** → `SearchableSpec` / `ListableSpec` / `WritableSpec` déclarés dans
  `orchard/apps.py::ready()`, plus un tool `get_harvest_stats` sur le modèle de
  `get_chicken_stats`. **Zéro modification de la logique de `apps/agent/`.**

## Concept visible côté utilisateur

- Entrée de menu « 🌳 Verger » → `/app/orchard`, groupe **Maison**, module
  **optionnel** (désactivable comme le poulailler).
- **Page principale** : ce qu'il y a à faire cette saison en tête (règles échues
  ou dans leur fenêtre), puis les sujets en cards groupés par zone, avec leur
  dernière récolte et leur dernier entretien.
- **Fiche arbre** `/app/orchard/:id` : identité (variété, porte-greffe, âge
  calculé depuis `planted_on`), série des récoltes par saison, timeline du
  journal, photos, bouton « Déclarer un achat ».
- **Widget dashboard** : ce qui est à faire au verger cette saison, et la récolte
  de l'année en cours. Masqué si le foyer n'a aucun sujet.
- **Alerte** : « Gel annoncé demain (−2 °C) — 3 sujets sont en période de
  floraison », menant à la liste des sujets concernés.

## Objectif produit

Permettre au membre du foyer de :

1. Écrire une fois pour toutes ce qu'il sait de chaque sujet (variété, plantation,
   porte-greffe) — le savoir cesse de se perdre au changement de propriétaire.
2. Dire en deux gestes ce qu'il vient de faire, et retrouver un an plus tard
   quand il l'a fait.
3. Savoir, en ouvrant la page en février, ce que la saison réclame.
4. Chiffrer ses récoltes et voir la série — la seule façon de lire un objet dont
   la production alterne.
5. Être prévenu la veille d'un gel qui menace une floraison.
6. Interroger et alimenter tout ça via l'agent, en langage courant.

---

## User stories

> `US-N` d'ici correspond à `ORCH-NN` dans le [glossaire des user
> stories](../USER_STORIES.md), qui porte l'identifiant stable et la preuve
> attendue. Ce qui suit garde le détail des critères d'acceptation ; le glossaire
> dit **ce qui est prouvé**.

### US-1 — Registre des sujets (`ORCH-01`)

**En tant que** membre
**Je veux** créer, modifier et supprimer les sujets de mon verger
**Afin de** tenir le registre de ce que je possède

**Critères d'acceptation**
- [ ] Page `/app/orchard` listant les sujets du foyer en cards (pattern Feature page : `PageHeader`, `FilterPill`, `EmptyState`, skeleton `useDelayedLoading`)
- [ ] Dialog create/edit (pattern `existing?`), champs : nom (requis), **zone (requise)**, type, variété, porte-greffe, date de plantation (nullable), période de floraison, notes
- [ ] Une seule entité pour arbres fruitiers, petits fruits, vigne et ornementaux — le `kind` pilote l'affichage, jamais le schéma
- [ ] Suppression avec undo (`useDeleteWithUndo`)
- [ ] API DRF `/api/orchard/trees/` CRUD scopé foyer ; un membre d'un autre foyer reçoit 404
- [ ] État vide avec CTA « Ajouter un sujet »

### US-2 — La zone est obligatoire, et sa suppression est refusée proprement

**En tant que** membre
**Je veux** que chaque sujet soit rattaché à une zone
**Afin de** retrouver mon verger par l'endroit, comme le reste de la maison

**Critères d'acceptation**
- [ ] `Tree.zone` non nullable, `on_delete=PROTECT`
- [ ] Supprimer une zone qui contient des sujets est **refusé avec un message nommé** (« cette zone contient 4 sujets du verger »), jamais un 500 ni une suppression silencieuse
- [ ] Le refus vaut aussi quand la zone est supprimée **en cascade** depuis un parent — c'est le cas qui casse si on l'oublie
- [ ] Si le foyer n'a aucune zone, le dialog de création propose d'en créer une plutôt que d'afficher un sélecteur vide
- [ ] La fiche zone affiche les sujets qu'elle contient

### US-3 — Journal d'entretien

**En tant que** membre
**Je veux** consigner ce que je fais à un sujet (taille, traitement, fertilisation, arrosage, palissage, observation, floraison)
**Afin de** m'en souvenir un an plus tard

**Critères d'acceptation**
- [ ] Création depuis la fiche du sujet (pré-liée) ou depuis la page principale
- [ ] Champs : type (requis), date (défaut aujourd'hui, en fuseau du foyer), titre (requis), notes
- [ ] Timeline sur la fiche du sujet, journal des dernières entrées sur la page principale
- [ ] Suppression avec undo
- [ ] API `/api/orchard/events/` CRUD scopé foyer, filtre `?tree=<id>` et `?type=`

### US-4 — Règles d'entretien saisonnières

**En tant que** membre
**Je veux** déclarer que « la taille d'hiver, c'est entre novembre et mars »
**Afin de** savoir en ouvrant l'app ce que la saison réclame

**Critères d'acceptation**
- [ ] Création d'une règle : nom, mois de début → mois de fin, portée (un sujet précis **ou** tous les sujets d'un type)
- [ ] Une fenêtre **à cheval sur deux années** (novembre → mars) est gérée correctement — c'est le cas normal, pas le cas limite
- [ ] L'échéance est **dérivée à la lecture** du dernier événement lié : jamais stockée, jamais dénormalisée
- [ ] Une règle est « à faire » quand on est **dans sa fenêtre** et qu'aucun événement ne l'a satisfaite **pour cette saison** ; « en retard » quand la fenêtre s'est refermée sans qu'elle le soit
- [ ] Consigner un entretien depuis une règle échue lie l'événement à la règle et fait retomber l'échéance sur la saison suivante
- [ ] La page principale ouvre sur ce qui est à faire cette saison

### US-5 — La règle propose une tâche, elle n'invente pas un rappel

**En tant que** membre
**Je veux** transformer une règle échue en tâche datée
**Afin de** la voir avec le reste de ce que j'ai à faire

**Critères d'acceptation**
- [ ] Bouton « Créer une tâche » sur une règle dans sa fenêtre, passant par `tasks.services.create_task` (jamais l'ORM brut)
- [ ] La tâche porte un sujet explicite (« Taille d'hiver — le gros pommier ») et une échéance dans la fenêtre
- [ ] **Aucune tâche n'est créée automatiquement en fond** — une règle qui fabrique des tâches toute seule remplit la liste de tâches que personne n'a demandées
- [ ] Les règles échues remontent dans `alerts.services` comme les corvées de poulailler — aucun mécanisme d'alerte nouveau
- [ ] La tâche est cochable comme les autres et déclenche les alertes de retard existantes

### US-6 — Récoltes chiffrées

**En tant que** membre
**Je veux** noter combien j'ai récolté et quand
**Afin de** comparer les années

**Critères d'acceptation**
- [ ] Saisie depuis la fiche du sujet : quantité (`DecimalInput`, jamais `type="number"`), unité (kg / pièces / litres), date, notes
- [ ] Plusieurs récoltes par saison et par sujet (on cueille en plusieurs fois) — pas d'upsert, contrairement au relevé de ponte
- [ ] Suppression avec undo
- [ ] API `/api/orchard/harvests/` CRUD scopé foyer, filtres `?tree=` et `?season=`
- [ ] Un sujet `ornamental` ne propose pas la récolte

### US-7 — Série par saison

**En tant que** membre
**Je veux** voir ce que chaque sujet a donné année après année
**Afin de** lire une production qui alterne naturellement

**Critères d'acceptation**
- [ ] Total de la saison en cours par sujet et pour le verger entier
- [ ] Série des saisons précédentes (au moins les 5 dernières), par sujet
- [ ] La saison est calculée **en fuseau du foyer** (`core.timezones`), jamais avec `date.today()`
- [ ] Les totaux ne mélangent jamais deux unités : kg et pièces sont comptés à part, et l'écran le dit
- [ ] État vide explicite : une seule saison ne permet aucune comparaison, l'écran ne prétend pas le contraire

### US-8 — Alerte gel × floraison

**En tant que** membre
**Je veux** être prévenu quand un gel menace des sujets en fleur
**Afin de** pouvoir les protéger la veille

**Critères d'acceptation**
- [ ] L'alerte réutilise `weather.alerts.evaluate_weather_alerts` (`KIND_FROST`) — **aucun seuil de température réécrit**
- [ ] Elle ne se déclenche que pour les sujets dont la **période de floraison déclarée** couvre la date de l'alerte
- [ ] `flowering_months` vide = **non renseigné**, pas « jamais en fleur » : aucune alerte, et l'écran propose de renseigner la période plutôt que de se taire
- [ ] L'alerte apparaît dans le résumé d'alertes et mène à la liste des sujets concernés
- [ ] Aucune alerte si le module météo est désactivé ou si le foyer n'a pas de localisation — dégradation silencieuse, jamais d'erreur

### US-9 — Achat d'un sujet

**En tant que** membre
**Je veux** déclarer le prix d'achat d'un arbre
**Afin de** suivre ce que mon verger m'a coûté sans double saisie

**Critères d'acceptation**
- [ ] Bouton « Déclarer un achat » sur la fiche, wrappant le `PurchaseForm` partagé
- [ ] Crée une `Interaction` expense via `create_expense_interaction(source=tree, kind='orchard_purchase')` — nouveau template dans `AUTO_SUBJECT_TEMPLATES` + traductions `.po` fr/de/es compilées
- [ ] L'interaction est visible dans `/app/money/expenses` et rattachée à la zone du sujet
- [ ] Coût cumulé du sujet affiché sur sa fiche, lu via `interactions.queries.expenses()` — jamais un cast JSON

### US-10 — Photos datées

**En tant que** membre
**Je veux** attacher des photos à un sujet
**Afin de** le voir changer d'une année sur l'autre

**Critères d'acceptation**
- [ ] Onglets Documents et Photos sur la fiche, via les composants génériques existants (`EntityDocumentsTab` / `EntityPhotosTab`)
- [ ] Aucune table de liaison nouvelle : `documents.DocumentLink` polymorphe
- [ ] Les photos du verger sont visibles depuis la galerie du foyer comme les autres

### US-11 — Widget dashboard

**En tant que** membre
**Je veux** voir l'essentiel du verger sans ouvrir le module
**Afin de** ne pas rater une fenêtre saisonnière

**Critères d'acceptation**
- [ ] Card « 🌳 Verger » : ce qui est à faire cette saison, récolte de l'année en cours
- [ ] Masquée si le foyer n'a aucun sujet (pattern des cards existantes)
- [ ] Clic → `/app/orchard` avec `pushBack`

### US-12 — Agent : lecture et citation

**En tant que** membre
**Je veux** interroger l'agent sur mon verger
**Afin d'** obtenir des réponses citées sans naviguer

**Critères d'acceptation**
- [ ] `SearchableSpec` pour `tree` (nom, variété, notes) avec `related` = derniers événements et récoltes ; `SearchableSpec` pour `tree_event`
- [ ] `ListableSpec` pour `tree` (filtres zone, type, statut) et pour `harvest`
- [ ] Tool `get_harvest_stats` déclaré depuis `orchard/apps.py`, sur le modèle de `get_chicken_stats` — les agrégats ne sont pas des lignes listables
- [ ] « Quand a-t-on taillé le gros pommier ? » retrouve l'événement et le cite avec un lien `/app/orchard/{id}`
- [ ] Ajouter `tree` aux icônes et libellés de la palette de recherche globale (`entityIcons.ts` + 4 locales)

### US-13 — Agent : écriture

**En tant que** membre
**Je veux** dicter « j'ai taillé le prunier » ou « note 12 kg de pommes »
**Afin de** consigner sans ouvrir l'app

**Critères d'acceptation**
- [ ] `WritableSpec` pour `tree`, `tree_event` et `harvest`, dont les `create` appellent `orchard/services.py` — **jamais l'ORM ni le serializer directement**
- [ ] La désignation d'un sujet **par son nom** est la règle (« le prunier »), un nom ambigu lève une erreur qui nomme les candidats plutôt que de choisir au hasard
- [ ] Une conversation ancrée sur un sujet pré-remplit le lien ; l'ancre est un **défaut**, jamais la seule source (un nom explicite prime)
- [ ] Undo côté front : entrées dans `UNDO_HANDLERS` (`ui/src/features/agent/hooks.ts`)
- [ ] Un test vérifie que le create agent et le create REST produisent le **même** résultat

### US-14 — i18n complète

**En tant que** membre non anglophone
**Je veux** le module dans ma langue
**Afin de** l'utiliser comme le reste de l'app

**Critères d'acceptation**
- [ ] Toutes les clés `orchard.*` présentes dans les 4 catalogues (en/fr/de/es), aucune `defaultValue`
- [ ] Types d'événements, types de sujets, statuts et unités traduits — jamais les valeurs techniques à l'écran
- [ ] Template d'auto-subject traduit dans les 3 `.po` + `compilemessages`
- [ ] Guide « Verger » ajouté à la page Tutoriel (registre + 4 locales)

---

## Carte d'intégration (récap)

| Brique existante | Connexion verger |
|---|---|
| `zones` | `Tree.zone` **obligatoire** en `PROTECT` (US-1, US-2) |
| `tasks` | Une règle échue propose une tâche via `create_task` (US-5) |
| `alerts` | Règles échues + gel × floraison dans le résumé existant (US-5, US-8) |
| `weather` | `evaluate_weather_alerts` réutilisé tel quel (US-8) |
| `interactions` | Achat via `create_expense_interaction`, coût cumulé (US-9) |
| `documents` / `photos` | `DocumentLink` polymorphe + onglets génériques (US-10) |
| `dashboard` | Nouvelle card masquable (US-11) |
| `agent` | 3 registries + tool `get_harvest_stats` depuis `apps.py` (US-12, US-13) |
| `stock` | Rien en V1 — le crédit d'une récolte au stock est différé |
| `trackers` | Rien : une récolte n'est pas une série de relevés, elle a une unité et une saison |

## Découpage en lots

- **Lot 1 — Socle backend** : app `orchard`, modèles `Tree` / `TreeEvent` / `Harvest`, clé de module (US-1, US-3, US-6 côté schéma)
- **Lot 2 — Services + API DRF** : point d'écriture unique viewset + agent (US-1, US-3, US-6)
- **Lot 3 — Frontend Verger** : page, cards par zone, fiche du sujet, journal (US-1, US-2, US-3) — **preuve V1**
- **Lot 4 — Récoltes et séries** : saisie, agrégats par saison, écran de comparaison (US-6, US-7)
- **Lot 5 — Entretien saisonnier** : `CareRule`, échéance dérivée, tâche en un clic, remontée dans les alertes (US-4, US-5)
- **Lot 6 — Argent et photos** : achat, coût cumulé, onglets Documents/Photos (US-9, US-10)
- **Lot 7 — Le verger hors du module** : widget dashboard, alerte gel × floraison (US-8, US-11)
- **Lot 8 — Intégration agent** : Searchable / Listable / Writable, tool `get_harvest_stats`, undo, palette (US-12, US-13)

L'i18n (US-14) n'est pas un lot : chaque lot livre ses clés dans les 4 langues.

Issues GitHub : « Parcours 30 — Lot N : … », labels `feat` / `app:orchard` / `i18n`.
