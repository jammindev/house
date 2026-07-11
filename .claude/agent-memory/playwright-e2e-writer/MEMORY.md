# Memory Index

## Patterns UI
- [select_native_options.md](select_native_options.md) — Comment interagir avec les `<option>` d'un `<select>` natif (state: attached, pas visible)
- [form_error_state.md](form_error_state.md) — Vérifier l'échec d'un formulaire via l'état du bouton submit
- [fixtures_pattern.md](fixtures_pattern.md) — Toujours importer depuis ./fixtures, pas @playwright/test. Fixture loginAs disponible.
- [dropdown_radix_roles.md](dropdown_radix_roles.md) — Rôles ARIA des composants Radix UI (menuitem, menuitemradio, etc.)
- [task_card_structure.md](task_card_structure.md) — Structure DOM de TaskCard et helpers getTaskCard/openTaskMenu
- [electricity_module_patterns.md](electricity_module_patterns.md) — Sélecteurs, chaînes FR et patterns spécifiques au module Électricité (/app/electricity)
- [electricity_consumption_patterns.md](electricity_consumption_patterns.md) — Patterns onglet Consommation : apiCreateMeter, CardActions barre compteur, toast Import strict-mode, navigation période, contrainte unique reading
- [electricity_tariffs_patterns.md](electricity_tariffs_patterns.md) — Patterns TariffsDialog : CardActions LEFT container, SheetDialog Close button, undo toast derrière Sheet overlay, granularité "Jour" vs "Mois" pour navigation mensuelle, bandeau coût €
- [water_module_patterns.md](water_module_patterns.md) — Patterns module Eau : pas de compteur, apiCreateReading/deleteAllReadings, IDs #water-reading-date / #water-reading-index, 3 granularités (sans Heure), p.text-lg pour total m³, isolation tests via delete-all + reload
- [dashboard_patterns.md](dashboard_patterns.md) — Sélecteurs dashboard, pièges strict-mode (toast sujet tâche = 3 éléments, "Tâche créée" = 2), scoper `main` pour distinguer sidebar vs cards métriques, zones sur /api/zones/ (pas /api/tasks/zones/), entity_url des tâches overdue = "/app/tasks"
- [zone_detail_renovation_patterns.md](zone_detail_renovation_patterns.md) — Patterns onglet Rénovation dans ZoneDetailPage : TabShell = boutons (pas tabs ARIA), toast strict-mode, subject auto "Sol — Maison" → exact:true sur badge, endpoint POST /api/interactions/interactions/renovation/
- [chickens_module_patterns.md](chickens_module_patterns.md) — URLs API /api/chickens/ (pas /api/chickens/chickens/), deux boutons "Nouvelle poule" en empty state (.first()), EntityAssistant consent modal bloque h1 (pré-accepter via localStorage), heading h1 contient emoji 🐔 (toContainText sans emoji), upsert ponte toasts stackés (.first()), status deceased → auto-event "Décès" dans timeline
