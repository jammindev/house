# Module — equipment

> Audit : 2026-08-18. Rôle : suivre les équipements du foyer (garantie, entretien, historique d'interventions et de dépenses).

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet dans `ui/src/features/equipment/`
- **Locales (en/fr/de/es)** : ok
- **Tests** : `test_api_equipment.py`, `test_api_equipment_extra.py`, `test_api_equipment_purchase.py`, `test_api_equipment_health.py`, `test_categories.py`, `test_import_supabase_equipment.py` ; côté front `health.test.ts`
- **Migrations** : 7
- **Couverture parcours métier** : parcours 05 (navigation équipement), parcours 06 (alertes garanties/maintenances)

## Modèles & API

- Modèles : `Equipment` (zone, status, garantie, entretien) ; `EquipmentInteraction` (table de liaison vers `Interaction`)
- `category` et `condition` sont des **vocabulaires fermés** (`Equipment.Category`, `Equipment.Condition`)
- Endpoints : `/api/equipment/` (CRUD) + actions `attention/`, `{id}/log-service/`, `{id}/history/`, `{id}/register-purchase/`, `{id}/audit/` ; `/api/equipment/equipment-interactions/`
- Permissions : `IsAuthenticated, IsHouseholdMember`

## Ce que ce module a appris — règles à préserver

### Un verdict de santé se calcule une fois, côté serveur

`services.warranty_state` et `services.maintenance_state` sont la **seule**
définition de « garantie expirée » et « entretien en retard ». Elles sont servies
par `EquipmentSerializer` (`warranty_state`, `maintenance_state`) et consommées
telles quelles par la liste, la fiche et le bandeau.

**Pourquoi** : la fiche écrivait « Garantie : Expirée » en rouge pendant que la
liste affichait la même date en gris, au milieu des autres — deux écrans, deux
voix sur le même fait. C'est la règle « un écart ne se dit jamais deux fois avec
deux voix », appliquée à un état. Corollaire : le front **ne recalcule jamais** un
état à partir d'une date, ne serait-ce que parce que « aujourd'hui » dans un
navigateur est le jour de la machine, pas celui du foyer (`core.timezones`).

- `unknown` n'est ni `expired` ni `ok`. Une garantie non renseignée est une case
  vide, pas une garantie perdue ; un équipement sans intervalle n'est pas « à
  jour », il n'est pas suivi. Même principe que `inflow_nature == ""` face à
  `"other"` : *toute entité est soit résolue, soit flaggée ; rien ne reste dans un
  entre-deux silencieux.*
- Le bandeau (`GET /api/equipment/attention/`) et le filtre `?attention=` lisent
  la **même** fonction (`services.matches_attention`) : cliquer une pastille
  ramène exactement le nombre annoncé. Régression :
  `test_api_equipment_health.py::TestTheBannerAgreesWithTheChip`.
- Les compteurs ignorent volontairement les filtres de la liste — un bandeau qui
  annoncerait « 0 entretien en retard » parce qu'on regarde le garage
  transformerait un filtre d'affichage en verdict sur le foyer.
- Le tri du filtre `?attention=` se fait en Python : « en retard » est une
  arithmétique de mois sur une date, qu'un `WHERE` SQL n'exprime pas sans
  réimplémenter le calcul une seconde fois. Le coût est borné par ce qu'un foyer
  possède, pas par un historique qui grossit.

### « Entretien fait » écrit la date **et** la trace

`POST /api/equipment/{id}/log-service/` avance `last_service_at` et crée une
`Interaction(type=maintenance)` via `interactions.services.create_service_interaction`,
dans **une seule transaction**.

**Pourquoi** : `last_service_at` n'était écrit que par le seed, l'import, ou le
formulaire d'édition à la main. On faisait entretenir la chaudière, on
l'enregistrait dans l'historique… et l'app continuait d'annoncer la même
échéance, `apps/alerts/services.py` comprise. Le geste le plus courant du module
était confié au formulaire le plus long.

- Une date qui avance sans trace laisse un historique qui ment ; une trace sans
  date laisse l'alerte allumée. D'où l'atomicité.
- Un entretien n'est **pas** une dépense : pas de montant, pas de fournisseur, et
  `kind` reste en `metadata` (la colonne `kind` est propre aux dépenses).
- Une date d'entretien future est refusée : elle repousserait l'échéance suivante
  sur la foi de rien.

### Une dépense liée ne réécrit pas la fiche

`register-purchase` recopiait montant, fournisseur et date dans `purchase_price` /
`purchase_vendor` / `purchase_date`. Changer un joint à 12 € sur une chaudière de
2015 réécrivait donc sa date d'achat à aujourd'hui et son prix à 12 €, sans un mot.

La dépense courante sur un équipement est une pièce ou une réparation, pas le
rachat de la machine ; l'achat initial se saisit dans la fiche, où il est relu et
corrigé. Le `kind` reste `equipment_purchase` — il dit « de l'argent dépensé sur
cet équipement », ce qui est toujours vrai, et le renommer scinderait en deux les
agrégats déjà en base. Régression :
`test_api_equipment_purchase.py::test_registering_an_expense_never_rewrites_the_record`.

### L'historique réunit les deux liaisons

Une interaction s'accroche à un équipement de deux façons : la FK polymorphe
`source` (ce qu'écrivent les services d'achat et d'entretien) et la table
`EquipmentInteraction` (rattachement manuel). L'onglet ne lisait que la seconde :
**une dépense enregistrée depuis la fiche n'y apparaissait jamais**. D'où
`GET /api/equipment/{id}/history/`, qui fait l'union — une seule réponse à « que
s'est-il passé ? ».

La table de liaison reste alimentée par `log-service` : c'est ce que lit
`apps.py::_equipment_related` pour le tool `get_related` de l'agent.

### Un vocabulaire fermé, et un repli côté front

`category` était un texte libre pré-rempli « general » : 13 orthographes pour 21
objets (`voiture`, `Machine`, `machine`, `outil`, `tool`, `garden`, `jardin`,
`hvac`…), affichées brutes — donc en anglais dans une interface française — et
infiltrables. Idem `condition` (`good` et `Neuf` en base, `État : good` à l'écran).

- Les **libellés** vivent dans le namespace i18n `equipment.category.*` /
  `equipment.condition.*` du front, pas en `gettext` : ajouter une catégorie ne
  doit pas imposer un passage dans quatre `.po` (même règle que les `kind` de
  l'argent).
- Les migrations `0006` et `0007` rassemblent l'existant et **conservent dans les
  tags** ce qu'elles ne savent pas traduire. Une migration qui perd une saisie du
  foyer pour faire propre fait un mauvais échange — et sur une instance tierce,
  personne ne saurait ce qui a disparu.
- ⚠️ **Le front ne construit jamais une clé i18n à partir de ce que la base
  contient.** `health.ts::categoryKey` / `conditionKey` replient l'inconnu sur
  `other` / `good`. Sans ça la liste affiche `equipment.category.hvac` en toutes
  lettres — constaté en vrai, sur une base semée par du code antérieur à `0006`.
  Un import, une écriture directe ou une instance en retard d'une version
  produisent le même effet. Régression : `health.test.ts`.
- `makemessages` n'est pas concerné : aucune de ces chaînes n'est côté serveur.

## Limites connues

- **Les alertes du dashboard ignorent toujours le retard.**
  `alerts.services._due_maintenances` ne remonte que les échéances des 30 jours à
  venir (`if next_due < today: continue`) : un entretien dépassé n'apparaît nulle
  part ailleurs que sur cette page. Ce n'est pas une divergence (les deux ne
  répondent pas à la même question) mais un trou — à traiter à part.
- Pas de photo de couverture dans la liste : il faudrait une notion de photo
  principale sur le serializer, sans quoi chaque ligne coûterait une requête.
