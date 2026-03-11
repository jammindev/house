# Parcours 06 — Backlog technique V1

Ce document traduit la décision produit du parcours 06 en backlog technique concret pour le repo actuel.

Flow cible :

1. ouvrir le dashboard et voir immédiatement les alertes actives (tâches en retard, garanties, maintenances)
2. accéder à la page Alertes complète organisée par catégorie
3. naviguer depuis une alerte vers l'entité concernée et agir
4. voir le badge d'alertes dans la navigation au chargement de chaque page

## Objectif d'implémentation

Ajouter une couche d'attention proactive au-dessus des données existantes, sans nouveau schéma de base de données.

Les données sources sont entièrement disponibles :

- `Interaction` avec `type=todo`, `due_date`, `status` — `apps/interactions/models.py`
- `Equipment` avec `warranty_expires_on`, `next_service_due` — `apps/equipment/models.py`

L'objectif est de les agréger intelligemment côté backend et de les exposer côté frontend dans les bons endroits.

Les surfaces concernées sont :

- un nouvel endpoint API `GET /api/alerts/summary/`
- la section "À surveiller" dans le dashboard React
- une nouvelle page Alertes (mini-SPA React)
- le badge de navigation dans le template Django

## État de réalisation au démarrage du parcours 06

### Déjà en place et réutilisable

- `Interaction` avec filtres `type`, `due_date`, `status` dans [apps/interactions/views.py](/apps/interactions/views.py)
- `Equipment` avec `warranty_expires_on`, `maintenance_interval_months`, `last_service_at` dans [apps/equipment/models.py](/apps/equipment/models.py)
- `EquipmentSerializer` avec `next_service_due` calculé dans [apps/equipment/serializers.py](/apps/equipment/serializers.py)
- Detection des tâches en retard côté frontend dans [apps/tasks/react/TasksNode.tsx](/apps/tasks/react/TasksNode.tsx)
- Dashboard existant : [apps/interactions/react/DashboardNode.tsx](/apps/interactions/react/DashboardNode.tsx)
- Pattern mini-SPA React : tous les parcours précédents

### À construire

- endpoint backend `GET /api/alerts/summary/` — agrégation des trois types d'alertes
- section "À surveiller" dans `DashboardNode.tsx`
- page Alertes dédiée : `apps/alerts/react/AlertsNode.tsx` + vue Django
- badge d'alertes dans le template de navigation
- (optionnel) app `alerts` Django minimaliste si l'endpoint ne rentre pas dans une app existante

## Principe d'exécution

Le backlog est organisé en lots techniques verticaux.

Chaque lot produit un incrément testable.

## Décisions de cadrage MVP réalisable

- pas de nouveau modèle de base de données — les alertes sont calculées à la demande
- l'endpoint `GET /api/alerts/summary/` est placé dans une nouvelle app légère `apps/alerts/` ou dans `apps/core/` selon la cohérence du repo
- les fenêtres de temps sont des constantes Python configurables : `ALERT_WARRANTY_DAYS = 90`, `ALERT_MAINTENANCE_DAYS = 30`
- le badge de navigation est alimenté par un appel fetch au montage — pas de polling, pas de websocket
- le frontend dashboard charge les alertes en parallèle des autres sections via un appel API dédié
- la page Alertes suit le pattern des autres mini-SPAs : vue Django + props initiales + composant React

## Lot 0 — Endpoint backend de synthèse des alertes

### But

Créer un endpoint performant qui agrège les alertes actives du household en un seul appel.

### Localisation recommandée

Option A (recommandée) : nouvelle app légère `apps/alerts/`

```
apps/alerts/
    __init__.py
    views.py       ← AlertsSummaryView
    urls.py        ← /api/alerts/summary/
    tests/
        test_alerts.py
```

Option B : dans `apps/core/` si une app dédiée semble excessive.

### Format de réponse attendu

```json
{
  "total": 5,
  "overdue_tasks": [
    {
      "id": 42,
      "title": "Appeler le plombier",
      "due_date": "2026-03-01",
      "days_overdue": 10,
      "entity_url": "/app/interactions/42/",
      "severity": "critical"
    }
  ],
  "expiring_warranties": [
    {
      "id": 7,
      "title": "Lave-vaisselle Bosch",
      "warranty_expires_on": "2026-04-01",
      "days_remaining": 21,
      "entity_url": "/app/equipment/7/",
      "severity": "critical"
    }
  ],
  "due_maintenances": [
    {
      "id": 3,
      "title": "Chaudière Viessmann",
      "next_service_due": "2026-03-23",
      "days_remaining": 12,
      "entity_url": "/app/equipment/3/",
      "severity": "warning"
    }
  ]
}
```

### Logique backend

#### Tâches en retard

```python
from datetime import date
from apps.interactions.models import Interaction

overdue = Interaction.objects.filter(
    household=request.user.current_household,
    type='todo',
    due_date__lt=date.today(),
).exclude(
    status__in=['done', 'cancelled']
).order_by('due_date').select_related('household')
```

Sévérité :
- `critical` si `days_overdue >= 3`
- `warning` si `days_overdue < 3`

#### Garanties à expiration proche

```python
from datetime import date, timedelta
from apps.equipment.models import Equipment

threshold = date.today() + timedelta(days=ALERT_WARRANTY_DAYS)
expiring = Equipment.objects.filter(
    household=request.user.current_household,
    warranty_expires_on__lte=threshold,
    warranty_expires_on__gte=date.today(),
).order_by('warranty_expires_on')
```

Sévérité :
- `critical` si `days_remaining <= 30`
- `warning` si `days_remaining > 30`

#### Maintenances à venir

```python
threshold = date.today() + timedelta(days=ALERT_MAINTENANCE_DAYS)
due_maintenances = Equipment.objects.filter(
    household=request.user.current_household,
    maintenance_interval_months__isnull=False,
).order_by('next_service_due')
# filtrer ensuite ceux dont next_service_due <= threshold
# next_service_due est une propriété calculée — nécessite annotation ou filtrage Python
```

Note : `next_service_due` est une propriété Python, pas un champ de base de données. Pour filtrer efficacement, soit annoter via `ExpressionWrapper`, soit filtrer en Python après récupération (acceptable pour les volumes d'un household).

Alternative : ajouter un champ `next_service_due_date` persisté en DB (mis à jour à chaque save d'Equipment) pour permettre un filtrage ORM direct. Recommandé si les volumes le justifient, mais non obligatoire pour la V1.

Sévérité :
- `critical` si `days_remaining <= 7`
- `warning` si `days_remaining > 7`

### URL

```
GET /api/alerts/summary/
```

Méthode : `GET`
Auth : session ou token — scope `household` de l'utilisateur connecté
Pas de paramètres en V1 — retourne toutes les alertes actives du household

### Fichiers à créer ou modifier

- `apps/alerts/__init__.py` (vide)
- `apps/alerts/views.py` — `AlertsSummaryView(APIView)`
- `apps/alerts/urls.py` — router avec `alerts/summary/`
- `config/urls.py` — inclure `apps/alerts/urls.py` sous `/api/alerts/`
- `apps/alerts/tests/test_alerts.py` — tests (voir Lot 3)

### Critères de validation

- `GET /api/alerts/summary/` retourne les bonnes alertes pour le household connecté
- les tâches en retard d'un autre household ne sont pas visibles
- les tâches marquées `done` ou `cancelled` ne sont pas dans les alertes
- les garanties déjà expirées ne sont pas dans `expiring_warranties` (elles ont déjà expiré — à traiter différemment ou à mettre dans une catégorie `expired`)
- le champ `total` est la somme des trois listes

## Lot 1 — Section alertes sur le dashboard

### But

Afficher les alertes les plus urgentes sur le dashboard existant, sans surcharger la page.

### Fichiers principaux

- [apps/interactions/react/DashboardNode.tsx](/apps/interactions/react/DashboardNode.tsx)
- [apps/interactions/views_web.py](/apps/interactions/views_web.py)

### Tâches

1. Dans `DashboardNode.tsx`, ajouter un `useEffect` au montage qui appelle `GET /api/alerts/summary/`.
2. Si `total > 0`, afficher une section "À surveiller" avant les sections existantes du dashboard.
3. La section affiche au maximum 5 alertes (les plus sévères et les plus urgentes).
4. Chaque item affiche : titre, type d'alerte, indicateur de sévérité (rouge / orange), lien vers l'entité.
5. Un lien "Voir tout" pointe vers la page Alertes (`/app/alerts/`).
6. Si `total === 0`, la section n'est pas affichée (pas de message "aucune alerte").

### Ordre d'affichage recommandé des alertes dans la section compacte

1. Tâches en retard depuis le plus longtemps
2. Garanties expirant dans le moins de jours
3. Maintenances dues dans le moins de jours

### Notes techniques

- le fetch alertes est indépendant des autres fetches du dashboard — pas de blocage si l'endpoint est lent
- traiter l'état d'erreur silencieusement : si l'endpoint échoue, ne pas bloquer le dashboard
- le composant `AlertsSummarySection` est extractible pour réutilisation

### Critères de validation

- si des alertes existent, la section "À surveiller" apparaît en haut du dashboard
- si aucune alerte n'existe, la section est absente
- chaque item de la section est cliquable et navigue vers la bonne URL
- le lien "Voir tout" navigue vers la page Alertes

## Lot 2 — Page Alertes dédiée

### But

Offrir une vue complète et organisée de toutes les alertes actives, accessible depuis le dashboard et la navigation.

### Pattern de développement

Suivre le pattern établi dans les parcours précédents :
1. Vue Django `AppAlertsView` dans `apps/alerts/views_web.py`
2. Template `apps/alerts/templates/alerts/alerts.html` (ou dans `templates/app/alerts/`)
3. Composant React `AlertsNode.tsx` dans `apps/alerts/react/`
4. URL dans `apps/alerts/urls.py` sous `/app/alerts/`

### Tâches

1. Créer `AppAlertsView` — vue Django qui rend le template avec les props initiales (notamment l'URL de l'API alertes).
2. Créer le template HTML avec le point de montage React.
3. Créer `AlertsNode.tsx` — fetch `GET /api/alerts/summary/` au montage, affichage organisé en trois sections.
4. Ajouter l'URL `/app/alerts/` dans `config/urls.py` ou `apps/alerts/urls.py`.
5. Ajouter un lien vers la page Alertes dans la navigation principale (template Django).

### Structure de AlertsNode.tsx

```
AlertsNode
├── section "Tâches en retard"
│   └── AlertItem (titre, retard, lien → détail interaction)
├── section "Garanties à surveiller"
│   └── AlertItem (titre, date expiration, lien → fiche équipement)
└── section "Maintenances à planifier"
    └── AlertItem (titre, date prévue, lien → fiche équipement)
```

Chaque section est masquée si elle est vide.

Si les trois sections sont vides, afficher un état positif : "Tout est sous contrôle. Aucun sujet urgent."

### Critères de validation

- la page est accessible via `/app/alerts/`
- les trois sections s'affichent si des alertes existent dans chaque catégorie
- les sections vides ne s'affichent pas
- chaque alerte est un lien vers l'entité concernée
- l'état vide affiche un message positif
- la page est utilisable sur mobile (liste verticale, items bien lisibles)

## Lot 3 — Badge de navigation et intégration globale

### But

Signaler la présence d'alertes dans la navigation principale sans requérir une action de l'utilisateur.

### Fichiers principaux

- Template Django de navigation principale (à identifier dans le repo : `templates/base.html` ou équivalent)
- Possibilité d'un script JS léger inline ou d'une mini-SPA pour le badge

### Tâches

1. Identifier le template Django de navigation principale.
2. Ajouter un élément `<span id="alerts-badge">` dans le lien de navigation vers la page Alertes.
3. Au chargement de la page, faire un fetch `GET /api/alerts/summary/` en JavaScript inline ou via un petit module JS.
4. Si `total > 0`, afficher le badge avec le count.
5. Si `total === 0`, masquer le badge.

### Option alternative : badge côté Django

Pour éviter le fetch JavaScript, `AppBaseView` (ou un context processor) peut appeler l'endpoint alertes et injecter le count dans les props du template. Avantage : pas de flash de contenu. Inconvénient : un appel DB à chaque page.

Recommandation V1 : fetch JavaScript — moins intrusif, plus cohérent avec l'approche mini-SPA du projet.

### Critères de validation

- le badge apparaît dans la navigation si des alertes existent
- le badge affiche le bon count
- le badge disparaît si `total === 0`
- le badge ne casse pas la navigation si le fetch échoue (état d'erreur silencieux)

## Lot 4 — Tests backend

### But

Sécuriser l'endpoint de synthèse des alertes sans multiplier les tests inutiles.

### Fichiers

- `apps/alerts/tests/test_alerts.py`

### Tâches

1. Test : `GET /api/alerts/summary/` avec un household qui a des tâches en retard — vérifier que `overdue_tasks` est correct.
2. Test : tâche avec `status=done` — vérifier qu'elle n'apparaît pas dans les alertes.
3. Test : tâche avec `due_date=tomorrow` — vérifier qu'elle n'est pas en retard.
4. Test : équipement avec `warranty_expires_on` dans 20 jours — vérifier qu'il est dans `expiring_warranties` avec `severity=critical`.
5. Test : équipement avec `warranty_expires_on` dans 120 jours — vérifier qu'il n'apparaît pas.
6. Test : isolation household — vérifier qu'un autre household n'a pas accès aux alertes.
7. Test : champ `total` = somme des trois listes.

### Critères de validation

- 7 tests passent
- les tests couvrent les trois types d'alertes et l'isolation household

## Ordre recommandé d'implémentation

1. Lot 0 — Endpoint backend (préalable à tout le reste)
2. Lot 1 — Section dashboard (valeur immédiate, visible à chaque ouverture)
3. Lot 2 — Page Alertes (complète le parcours)
4. Lot 3 — Badge de navigation (polish final)
5. Lot 4 — Tests (sécurise avant livraison)

## Découpage en sessions de travail

### Session 1

- Créer l'app `alerts` avec l'endpoint `GET /api/alerts/summary/`
- Vérifier la logique sur les trois types d'alertes
- Écrire les tests backend

### Session 2

- Intégrer la section "À surveiller" dans le dashboard React
- Créer la page Alertes avec la mini-SPA React

### Session 3

- Ajouter le badge dans la navigation
- Validation manuelle du parcours complet
- Corrections post-validation

## Points de vigilance

- `next_service_due` est une propriété calculée sur `Equipment`, pas un champ DB — filtrer en Python ou annoter avec `ExpressionWrapper` pour éviter de tout charger en mémoire
- ne pas afficher les garanties déjà expirées dans `expiring_warranties` — créer éventuellement une section `expired_warranties` séparée ou les exclure en V1
- le fetch alertes dans le dashboard ne doit pas bloquer le rendu si l'API répond lentement — utiliser un loading state léger
- garder le design de la section dashboard compact : 5 items maximum, pas de surcharge visuelle
- le badge de navigation doit rester accessible (attribut `aria-label` ou équivalent)
- ne pas compter deux fois une alerte si un équipement a à la fois une garantie proche et une maintenance proche — deux alertes séparées sont correctes

## Définition de done technique

La V1 peut être considérée terminée si :

1. `GET /api/alerts/summary/` retourne les alertes correctes et respecte l'isolation household
2. la section "À surveiller" s'affiche sur le dashboard si des alertes existent, est absente sinon
3. la page Alertes liste toutes les alertes actives organisées en trois sections
4. chaque alerte est cliquable et navigue vers l'entité concernée
5. le badge de navigation reflète le count total
6. 7 tests backend passent
7. le parcours complet est validé manuellement en mobile
