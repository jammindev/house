# Structures Feature

## Purpose
Manages companies, organizations, and service providers (contractors, insurance companies, government agencies, etc.).

## Key Concepts
- **Structures**: Legal entities with name, type, address, communication details
- **Types**: `contractor`, `insurance`, `government`, `utility`, `retailer`, `other`
- **Contacts**: People working for structures (linked via `contacts.structure_id`)
- **Interactions**: Link structures to events via `interaction_structures`

## Architecture

### Components
- `StructureCard`: Summary card with name, type, address, contact info
- `StructureForm`: Create/edit form with address, email/phone management
- `StructureSelector`: Multi-select picker for linking to interactions
- `StructureDeleteButton`: Confirmation dialog with cascade warning

### Hooks
- `useStructures()`: Loads all structures for household
- `useStructureInteractions()`: Interactions linked to specific structure

### Types (`types.ts`)
- `Structure`: Main entity
- `StructureAddress`: Address components
- `StructureEmail`, `StructurePhone`: Communication details
- `StructureType`: Union of type values

## Database Schema
- Table: `structures`
  - RLS: household members can CRUD structures
  - JSONB: `address` field stores structured address data
- Tables: `emails`, `phones` (polymorphic via `structure_id`)
- Join table: `interaction_structures`

## Import Aliases
- `@structures/components/*`
- `@structures/hooks/*`
- `@structures/types`

## Related Features
- `contacts`: People working for structures
- `interactions`: Link structures to events
- `insurance`: Insurance companies are a structure type
