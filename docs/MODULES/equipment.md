# Module — equipment

> Audit : 2026-04-28. Rôle : suivre les équipements du foyer (garantie, maintenance, historique d'interventions).

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet dans `ui/src/features/equipment/`
- **Locales (en/fr/de/es)** : ok
- **Tests** : oui — 3 fichiers (`test_api_equipment.py`, `test_api_equipment_extra.py`, `test_import_supabase_equipment.py`)
- **Migrations** : 3
- **Couverture parcours métier** : parcours 05 (navigation équipement), parcours 06 (alertes garanties/maintenances — partiellement livré via P4)

## Modèles & API

- Modèles principaux : `Equipment` (zone, status, warranty, maintenance) ; `EquipmentInteraction` (lien through vers `Interaction`)
- `next_service_due` : calculé par `compute_next_service_due()` dans `apps/equipment/services.py`, exposé dans `EquipmentSerializer` (P4), partagé avec `apps/alerts/services.py`
- Endpoints exposés : `/api/equipment/` (CRUD `EquipmentViewSet` + action `audit/`), `/api/equipment/equipment-interactions/` (CRUD `EquipmentInteractionViewSet`)
- Permissions : `IsAuthenticated, IsHouseholdMember` (pas de custom)

## À corriger (urgent)

_aucun item identifié_

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] Champ "équipement concerné" dans le formulaire d'interaction — *#78*
- [ ] Permettre de "brancher" des équipements sur un breaker/circuit (lien équipement ↔ électricité) — *source : inspection `docs/IDEES_FUTURES.md`, non tracé en issue GH (à créer ?)*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] Pas de soft-delete : la suppression est destructive — *source : inspection `apps/equipment/views.py`*
- [ ] `category` est un `TextField` libre (pas d'enum/référentiel) — *source : `apps/equipment/models.py:22`*
- [ ] Aucune validation de cohérence `last_service_at` ≤ `today` ni `warranty_expires_on` ≥ `purchase_date` — *source : `apps/equipment/models.py`*

## Notes / décisions produit

- **P4 (commit aaaf621)** : `next_service_due` déplacé dans `apps/equipment/services.py` (`compute_next_service_due`) pour être partagé entre `EquipmentSerializer` et `apps/alerts/services.py`. `GET /api/alerts/summary/` agrège garanties ≤ 90 j et maintenances dues ≤ 30 j — consomme directement ce module.
- V1 livrée dans le Parcours 05 (zone cliquable, badge garantie tricolore, prochaine maintenance, bouton "Enregistrer une intervention", lien `EquipmentInteraction` post-création) — *source : `docs/JOURNAL_PRODUIT.md`*.
- Les `EquipmentInteraction` sont créées via un second appel API après création de l'interaction (pas via un champ direct), pattern aligné avec `InteractionDocument` — *source : `docs/parcours/PARCOURS_05_BACKLOG_TECHNIQUE.md`*.
- Parcours 06 consomme `warranty_expires_on` et `next_service_due` comme sources principales d'alertes proactives — *source : `docs/parcours/PARCOURS_06_BACKLOG_TECHNIQUE.md`*.
