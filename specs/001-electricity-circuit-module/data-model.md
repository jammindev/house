# Data Model — Module Électricité Maison

## 1) ElectricityBoard
Représente le tableau électrique principal d’un foyer.

### Fields
- `id` (UUID)
- `household_id` (UUID, unique par foyer pour le MVP)
- `name` (string, ex: "Tableau principal")
- `supply_type` (enum: `single_phase`, `three_phase`)
- `main_notes` (text, optionnel)
- `created_at`, `updated_at`
- `created_by`, `updated_by`

### Validation Rules
- Un seul `ElectricityBoard` actif par foyer au MVP.
- `supply_type` obligatoire.

## 2) ResidualCurrentDevice (Interrupteur différentiel)
Protection amont pouvant couvrir plusieurs disjoncteurs/circuits.

### Fields
- `id` (UUID)
- `household_id` (UUID)
- `board_id` (FK -> ElectricityBoard)
- `label` (string, repère visible unique au niveau foyer)
- `rating_amps` (integer, optionnel)
- `sensitivity_ma` (integer, optionnel)
- `type_code` (enum optionnel: `ac`, `a`, `f`, `b`, `other`)
- `notes` (text, optionnel)
- `created_at`, `updated_at`

### Validation Rules
- `label` unique globalement dans le foyer (tous types confondus).
- `board_id` doit appartenir au même `household_id`.

## 3) Breaker (Disjoncteur)
Protection dédiée couvrant plusieurs circuits; chaque circuit pointe vers un seul disjoncteur.

### Fields
- `id` (UUID)
- `household_id` (UUID)
- `board_id` (FK -> ElectricityBoard)
- `rcd_id` (FK nullable -> ResidualCurrentDevice)
- `label` (string, repère visible unique au niveau foyer)
- `rating_amps` (integer)
- `curve_type` (enum optionnel: `b`, `c`, `d`, `other`)
- `notes` (text, optionnel)
- `created_at`, `updated_at`

### Validation Rules
- `label` unique globalement dans le foyer.
- `rcd_id`, si renseigné, doit être dans le même foyer.
- Suppression refusée si circuits actifs encore liés.

## 4) ElectricCircuit
Circuit métier principal du plan électrique.

### Fields
- `id` (UUID)
- `household_id` (UUID)
- `board_id` (FK -> ElectricityBoard)
- `breaker_id` (FK -> Breaker, obligatoire)
- `label` (string, repère visible unique au niveau foyer)
- `name` (string)
- `phase` (enum nullable: `L1`, `L2`, `L3`; obligatoire si tableau triphasé)
- `is_active` (bool, default `true`)
- `notes` (text, optionnel)
- `created_at`, `updated_at`
- `created_by`, `updated_by`

### Validation Rules
- Un circuit a exactement un `breaker_id`.
- `label` unique globalement dans le foyer.
- Si `supply_type=three_phase`, `phase` obligatoire.
- Si `supply_type=single_phase`, `phase` doit être null.

## 5) UsagePoint
Point terminal: prise ou lumière.

### Fields
- `id` (UUID)
- `household_id` (UUID)
- `label` (string, repère visible unique au niveau foyer)
- `name` (string)
- `kind` (enum: `socket`, `light`)
- `zone_id` (FK nullable -> zones.Zone)
- `notes` (text, optionnel)
- `created_at`, `updated_at`

### Validation Rules
- `label` unique globalement dans le foyer.
- `zone_id`, si renseigné, doit appartenir au même foyer.

## 6) CircuitUsagePointLink
Association entre circuit et point d’usage (soft delete obligatoire).

### Fields
- `id` (UUID)
- `household_id` (UUID)
- `circuit_id` (FK -> ElectricCircuit)
- `usage_point_id` (FK -> UsagePoint)
- `is_active` (bool, default `true`)
- `deactivated_at` (datetime nullable)
- `deactivated_by` (FK nullable -> accounts.User)
- `created_at`, `created_by`

### Validation Rules
- Un `usage_point_id` ne peut avoir qu’un lien actif à la fois.
- `circuit_id` et `usage_point_id` doivent être du même foyer.
- Unicité conditionnelle: `(usage_point_id, is_active=true)`.

### State Transitions
- `active` -> `inactive` (soft delete métier)
- `inactive` -> `active` (réactivation possible selon règles de conflit)

## 7) PlanChangeLog (minimal)
Historique minimal des opérations demandées par la spec.

### Fields
- `id` (UUID)
- `household_id` (UUID)
- `actor_id` (FK -> accounts.User)
- `action` (enum: `create`, `update`, `deactivate`)
- `entity_type` (enum: `board`, `rcd`, `breaker`, `circuit`, `usage_point`, `link`)
- `entity_id` (UUID)
- `payload` (JSON, snapshot minimal avant/après)
- `created_at`

### Validation Rules
- `actor_id` obligatoire pour toute action write.
- Logs en lecture pour membres, écriture système uniquement.

## Relationships Summary
- `ElectricityBoard` 1..n `ResidualCurrentDevice`
- `ElectricityBoard` 1..n `Breaker`
- `ResidualCurrentDevice` 1..n `Breaker` (optionnel)
- `Breaker` 1..n `ElectricCircuit`
- `ElectricCircuit` 1..n `CircuitUsagePointLink`
- `UsagePoint` 1..n `CircuitUsagePointLink` (max 1 actif)
- Toutes les entités sont scoppées par `household_id`
