---
name: dashboard_patterns
description: Patterns spécifiques au dashboard (/app/dashboard) — sélecteurs, pièges strict-mode, API helpers
type: ui-patterns
---

# Dashboard — Patterns E2E

## Route et sélecteurs stables

- URL : `/app/dashboard`
- Salutation : `page.getByRole('heading', { level: 1 })` → contient "Bonjour"
- Quick actions : `page.getByRole('button', { name: 'Dépense' })`, `'Tâche'`, `'Note'`, `"Demander à l'assistant"`
- Card "Ma semaine" : `page.getByText('Ma semaine')` — toujours rendue
- Card "À traiter" : conditionnelle — retourne `null` si `total === 0` dans `/api/alerts/summary/`
- Card "Activité récente" : `page.getByText('Activité récente')` — retourne `null` si aucune interaction
- Card "Projets actifs" : `page.getByText('Projets actifs')` — retourne `null` si aucun projet actif

## Pièges strict-mode fréquents

### Toast du sujet d'une tâche complétée
Quand on clique le bouton "Marquer comme terminée", le toast affiche le sujet.
`getByText(subject)` résout 3 éléments :
1. Le lien dans la liste "Ma semaine" (tant qu'il existe)
2. `div.text-sm.font-semibold` dans le toast
3. `span[role=status][aria-live=assertive]`

**Solutions** :
- Pour vérifier la disparition de la tâche de la liste : `page.getByRole('link', { name: subject })`
- Pour vérifier le toast : `page.getByText(/.*${subject}.*terminée/).first()`
- Pour le bouton Annuler du toast : `page.getByRole('button', { name: 'Annuler' }).first()`

### Toast de création de tâche ("Tâche créée")
`getByText('Tâche créée')` résout 2 éléments (div + span aria-live).
Utiliser : `page.getByText('Tâche créée', { exact: true })`

### Cards métriques vs sidebar
La sidebar contient des entrées "Électricité", "Eau" etc.
Pour les cards dashboard uniquement, scoper à `page.getByRole('main')` :
```ts
const main = page.getByRole('main');
const elecCard = main.getByText('Électricité', { exact: true });
```

## API Helpers pour le dashboard

### Zones (requis pour créer des tâches)
Les zones sont sur `/api/zones/` (pas `/api/tasks/zones/`).
```ts
const zonesResp = await page.request.get('/api/zones/', {
  headers: { Authorization: `Bearer ${token}` },
});
```

### Créer une tâche overdue pour le bloc "À traiter"
```ts
const pastDate = isoDateOffset(-3);  // date négative = passé
await apiCreateTask(page, subject, pastDate, 'pending');
await page.reload();
await expect(page.getByText('À traiter')).toBeVisible({ timeout: 10_000 });
```

### entity_url des tâches en retard dans /api/alerts/summary/
Les tâches en retard ont `entity_url = "/app/tasks"` (pas `/app/tasks/:id`).
Le clic sur l'item triage navigue donc vers `/app/tasks` (liste), pas le détail.

## Comportement attendu selon les données demo seedées

| Composant | État après seed_demo_data |
|---|---|
| HeroGreeting | "Bonjour Claire" |
| QuickActions | Dépense, Tâche, Note, Demander visible ; Relevé eau/élec masqués (pas de données) |
| TriageSection | Masqué (pas de tâches overdue au moment du seed) |
| MyWeekCard | Tâches dues dans les 7 prochains jours du seed |
| ExpensesCard | Visible (dépenses seedées) |
| ElectricityCard | Masquée (aucune consommation kWh) |
| WaterCard | Masquée (0 relevés eau) |
| RunwaysCard | Masquée (aucun tracker) |
| ActivityTimeline | Masquée (aucune interaction seedée) |
| PinnedProjects | Visible ("Rénovation salle de bain", "Aménagement jardin printemps") |

## Pattern beforeEach pour tests avec création API

```ts
test.beforeEach(async ({ page }) => {
  // Naviguer d'abord pour avoir le JWT dans localStorage
  await page.goto('/app/dashboard');
  const created = await apiCreateTask(page, subject, dueDate);
  taskId = created.id;
  await page.reload();
  await expect(page.getByText(subject)).toBeVisible({ timeout: 10_000 });
});
```
