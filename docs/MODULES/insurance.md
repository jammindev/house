# Module — insurance

> Audit : 2026-04-28. Rôle : suivi des contrats d'assurance du foyer (santé, habitation, auto, vie, RC).

## État synthétique

- **Backend** : Présent
- **Frontend** : Absent (aucun dossier `ui/src/features/insurance/`, aucun client API)
- **Locales (en/fr/de/es)** : namespace `insurance` absent dans les 4 locales
- **Tests** : oui — 3 fichiers (`test_api_insurance.py`, `test_api_insurance_extra.py`, `test_import_supabase_insurance_contracts.py`)
- **Migrations** : 1 (`0001_initial.py`)

## Modèles & API

- Modèles principaux : `InsuranceContract` avec enums `InsuranceType` (health/home/car/life/liability/other), `InsuranceStatus` (active/suspended/terminated), `PaymentFrequency` (monthly/quarterly/yearly) — *source : `apps/insurance/models.py`*
- Endpoints exposés : `/api/insurance/` (CRUD via `InsuranceContractViewSet`)
- Filtres : `type`, `status`, `payment_frequency` ; recherche : `name`, `provider`, `contract_number`, `insured_item`, `coverage_summary`, `notes` — *source : `apps/insurance/views.py:17-19`*
- Permissions : `IsAuthenticated` + `IsHouseholdMember`, scoping household via `for_user_households` — *source : `apps/insurance/views.py:14`*

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.

_aucun item identifié_

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] **Construire la UI insurance** : page liste, dialog create/edit, card item, suivant le pattern feature standard — *source : issue #65 ; absence de `ui/src/features/insurance/` et `ui/src/lib/api/insurance.ts`*
- [ ] Ajouter le namespace `insurance` dans les 4 locales (`en/fr/de/es/translation.json`) — *source : issue #65 ; grep des locales*
- [ ] Brancher l'entrée "Insurance" dans la sidebar et le dashboard — *source : issue #65*
- [ ] Exploiter `renewal_date` pour des alertes proactives (lié au centre de notifications, issue #63) — *source : `apps/insurance/models.py:37`*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] Le viewset duplique la logique household-scoping standard (`get_queryset` + `perform_create`) qui pourrait être factorisée via `HouseholdDetailView` une fois mutualisée — voir issue #42 — *source : `apps/insurance/views.py:22-36`*

## Notes / décisions produit

- Constraints DB : coûts non-négatifs, `end_date >= start_date` — *source : `apps/insurance/models.py:58-68`*
- Champ `monthly_cost` ET `yearly_cost` co-existent (pas calculés l'un de l'autre) — décision à figer côté UI lors de la construction du formulaire — *source : `apps/insurance/models.py:40-41`*
- Une commande de migration depuis Supabase existe : `import_supabase_insurance_contracts` — *source : `apps/insurance/management/commands/`*
