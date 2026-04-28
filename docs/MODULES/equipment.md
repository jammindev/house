# Module — equipment

> Audit : 2026-04-27. Rôle : suivre les équipements du foyer (garantie, maintenance, historique d'interventions).

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet dans `ui/src/features/equipment/`
- **Locales (en/fr/de/es)** : ok
- **Tests** : oui — 3 fichiers (`test_api_equipment.py`, `test_api_equipment_extra.py`, `test_import_supabase_equipment.py`)
- **Migrations** : 2 total

## Modèles & API

- Modèles principaux : `Equipment` (zone, status, warranty, maintenance) ; `EquipmentInteraction` (lien through vers `Interaction`)
- Endpoints exposés : `/api/equipment/` (CRUD `EquipmentViewSet` + action `audit/`), `/api/equipment/equipment-interactions/` (CRUD `EquipmentInteractionViewSet`)
- Permissions : `IsAuthenticated, IsHouseholdMember` (pas de custom)

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.
- _aucun item identifié_

## À faire (backlog)

> Features identifiées non encore commencées.
- [ ] Exposer `next_service_due` dans `EquipmentSerializer` pour alimenter Parcours 06 (alertes maintenance) — *source : `docs/parcours/PARCOURS_06_BACKLOG_TECHNIQUE.md` lignes 35-44*
- [ ] Endpoint `GET /api/alerts/summary/` agrégeant garanties < 30 j et maintenances dues — *source : `GITHUB_ISSUES_BACKLOG.md` FEAT-02 lignes 110-123*
- [ ] Section "À surveiller" du dashboard alimentée par les garanties/maintenances — *source : `GITHUB_ISSUES_BACKLOG.md` FEAT-03 lignes 127-135*
- [ ] Permettre de "brancher" des équipements sur un breaker/circuit (lien équipement ↔ électricité) — *source : `ELECTRICTY_RETOUR.md` lignes 13-14*

## À améliorer

> Refacto, perf, UX, qualité de code.
- [ ] Pas de soft-delete : la suppression est destructive (cohérence avec demande tasks `TO_FIX.md` ligne 7)
- [ ] `category` est un `TextField` libre (pas d'enum/référentiel) — *source : `apps/equipment/models.py:22`*
- [ ] Aucune validation de cohérence `last_service_at` ≤ `today` ni `warranty_expires_on` ≥ `purchase_date` — *source : `apps/equipment/models.py`*

## Notes

- V1 livrée dans le Parcours 05 (zone cliquable, badge garantie tricolore, prochaine maintenance, bouton "Enregistrer une intervention", lien `EquipmentInteraction` post-création) — *source : `docs/JOURNAL_PRODUIT.md` lignes 98-115*.
- Parcours 06 (alertes proactives) va consommer ce module : `warranty_expires_on`, `next_service_due` sont les sources principales — *source : `docs/parcours/PARCOURS_06_BACKLOG_TECHNIQUE.md` lignes 16-21*.
- Les `EquipmentInteraction` sont créées via un second appel API après création de l'interaction (pas via un champ direct), pattern aligné avec `InteractionDocument` — *source : `docs/parcours/PARCOURS_05_BACKLOG_TECHNIQUE.md` lignes 137-141*.
