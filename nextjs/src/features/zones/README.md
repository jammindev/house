# Zones Feature

## Purpose
Manages hierarchical household spaces/locations. Zones represent rooms, areas, or outdoor spaces within a household, with optional parent-child relationships for nested organization.

## Key Concepts
- **Zones**: Named spaces with optional parent (e.g., Kitchen → Apartment → Building)
- **Hierarchy**: Unlimited nesting depth via `parent_id` self-referencing FK
- **Colors**: First-level children store base color; descendants auto-inherit lightened shades
- **Surface Area**: Optional `surface` field (numeric, >= 0)
- **Notes**: Free-form text for zone-specific context
- **Creator**: `created_by` tracks who created the zone

## Architecture

### Components
- `ZoneSelector`: Multi-select picker for linking zones to interactions
- `ZonePicker`: Hierarchical selector with inline zone creation (used in InteractionForm)
- `ZoneForm`: Create/edit form with parent selector, color picker, surface input
- `ZoneList`: Display all zones with hierarchy indicators
- `ZoneCard`: Detail card with stats, photos, linked interactions

### Hooks
- `useZones()`: Loads all zones for household, provides delete operation
- `useZoneHierarchy()`: Builds tree structure from flat zone list
- `useZoneColor()`: Calculates inherited color for nested zones

### Types (`types.ts`)
- `Zone`: Main entity with `id`, `household_id`, `name`, `parent_id`, `note`, `surface`, `color`, `created_at`, `created_by`
- `ZoneOption`: Simplified type for selectors (`id`, `name`, `parent_id`)
- `ZoneTree`: Hierarchical structure for tree views

## Database Schema
- Table: `zones`
  - RLS: household members can CRUD zones in their household
  - Trigger: `trg_zones_set_created_by` populates `created_by = auth.uid()`
  - FK: `parent_id` references same table (`zones.id`) with ON DELETE CASCADE
  - Check: `surface >= 0`

## Usage Patterns

### List Zones
```tsx
const { zones, loading, error } = useZones();
```

### Create Zone
```tsx
await createZone({
  household_id: householdId,
  name: "Kitchen",
  parent_id: apartmentZoneId,
  color: "#ff6b6b",
  surface: 15.5,
  note: "Renovated 2024",
});
```

### Build Tree
```tsx
const { tree, findZone, getAncestors } = useZoneHierarchy(zones);
```

## Import Aliases
- `@zones/components/*`
- `@zones/hooks/*`
- `@zones/types`

## Related Features
- `interactions`: Zones provide location context for all interactions
- `equipment`: Equipment can be assigned to zones
- `photos`: Zones can have photo galleries via `zone_documents`

## Routes
- `/app/zones` - List/manage zones
- `/app/zones/[id]` - Zone detail with photo gallery

## RLS & Security
- Any household member can create/update/delete zones
- Previously, only creator could delete; now membership is sufficient

## Color System
- Root zones: default neutral gray (`#f4f4f5`)
- First-level children: user selects base color via color picker
- Deeper descendants: automatically inherit lightened shade of parent
- UI handles color calculation transparently

## Photo Galleries
- Join table: `zone_documents` links zones to documents with `type = 'photo'`
- Trigger enforces same household and correct document type
- Zone detail pages display photo grids with signed URLs

## Future Enhancements
- Zone templates (common room types with default colors)
- Surface area rollup (calculate total surface for parent zones)
- Zone-based budget tracking (expense rollup by zone)
- Drag-and-drop tree reordering
