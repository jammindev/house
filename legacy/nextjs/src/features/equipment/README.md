# Equipment Feature

## Purpose
Catalogues household equipment and appliances with purchase info, warranty tracking, maintenance scheduling, and lifecycle event logging.

## Key Concepts
- **Equipment**: Physical items (appliances, HVAC, furniture, etc.) with metadata
- **Lifecycle States**: `active`, `maintenance`, `storage`, `retired`, `lost`, `ordered`
- **Maintenance**: Interval-based scheduling with automatic `next_service_due` calculation
- **Warranty**: Expiration tracking with vendor/notes
- **Zone Assignment**: Optional link to specific zone
- **Interactions**: Link maintenance/repair/installation events via `equipment_interactions`

## Architecture

### Components
- `EquipmentCard`: Summary card with status, warranty, next service indicators
- `EquipmentForm`: Create/edit form with all metadata fields
- `EquipmentList`: Filterable list with status/category/zone filters
- `EquipmentDetail`: Full view with lifecycle timeline, linked interactions
- `EquipmentDeleteButton`: Confirmation dialog for deletion
- `MaintenanceScheduleIndicator`: Visual cue for upcoming/overdue service

### Hooks
- `useEquipment()`: Loads all equipment for household
- `useEquipmentInteractions()`: Linked interactions (maintenance, repairs, etc.)

### Types (`types.ts`)
- `Equipment`: Main entity with purchase/warranty/maintenance fields
- `EquipmentStatus`: Union of lifecycle states
- `EquipmentCategory`: `general`, `appliance`, `hvac`, `furniture`, `electronics`, etc.
- `EquipmentCondition`: `excellent`, `good`, `fair`, `poor`

### Constants
- `EQUIPMENT_CATEGORIES`: Category definitions with icons
- `EQUIPMENT_STATUSES`: Status definitions with colors

## Database Schema
- Table: `equipment`
  - RLS: household members can CRUD equipment
  - Triggers: 
    - `set_equipment_created_by`, `set_equipment_updated_by`: audit fields
    - `check_equipment_zone_household`: ensures zone belongs to same household
  - Generated column: `next_service_due` = `last_service_at + (maintenance_interval_months * interval '1 month')`
- Join table: `equipment_interactions`
  - Links equipment to interactions (maintenance logs, repairs, etc.)
  - Trigger: `check_equipment_interaction_household` validates matching households

## Usage Patterns

### Create Equipment
```tsx
await createEquipment({
  household_id: householdId,
  zone_id: kitchenZoneId,
  name: "Dishwasher",
  category: "appliance",
  manufacturer: "Bosch",
  model: "SMV46KX01E",
  serial_number: "FD9801234567",
  purchase_date: "2023-01-15",
  purchase_price: 749.99,
  warranty_expires_on: "2025-01-15",
  maintenance_interval_months: 6,
});
```

### Log Maintenance Event
```tsx
// Create interaction linked to equipment
await createInteraction({
  type: "maintenance",
  subject: "Annual dishwasher service",
  content: "Cleaned filters, checked hoses",
  occurred_at: new Date().toISOString(),
});

// Link to equipment
await linkEquipmentInteraction(equipmentId, interactionId, {
  role: "maintenance",
  note: "Regular checkup",
});
```

## Import Aliases
- `@equipment/components/*`
- `@equipment/hooks/*`
- `@equipment/types`

## Related Features
- `zones`: Equipment can be assigned to specific zones
- `interactions`: Maintenance/repair/installation events
- `documents`: Manuals, receipts, photos via linked interactions

## Routes
- `/app/equipment` - List view
- `/app/equipment/new` - Create new equipment
- `/app/equipment/[id]` - Detail view

## RLS & Security
- All equipment operations require household membership
- Zone assignment validated via trigger to prevent cross-household references

## Maintenance Scheduling
- `maintenance_interval_months`: defines service frequency
- `last_service_at`: manually updated or auto-set via interaction linking
- `next_service_due`: auto-calculated generated column
- UI highlights overdue/upcoming maintenance with color-coded badges

## Warranty Tracking
- `warranty_expires_on`: expiration date
- `warranty_provider`: company name
- `warranty_notes`: terms, coverage details
- UI warns when warranty expiring soon or expired

## Future Enhancements
- Automatic maintenance reminders (notifications)
- QR code labels for equipment (link to detail page)
- Maintenance history report (PDF export)
- Warranty document upload/OCR
- Service provider contact management
- Equipment value depreciation tracking
- Insurance integration (link to insurance policies)
