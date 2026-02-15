# Contacts Feature

## Purpose
Manages people (contractors, neighbors, service providers, family members) associated with household activities.

## Key Concepts
- **Contacts**: Individuals with names, position, communication details
- **Structure Link**: Optional link to a company/organization via `structure_id`
- **Communication**: Multiple emails and phone numbers with labels
- **Interactions**: Link contacts to interactions via `interaction_contacts`

## Architecture

### Components
- `ContactCard`: Summary card with name, position, structure, contact info
- `ContactForm`: Create/edit form with email/phone management
- `ContactSelector`: Multi-select picker for linking to interactions
- `ContactList`: Searchable/filterable list

### Hooks
- `useContacts()`: Loads all contacts for household
- `useContactInteractions()`: Interactions linked to specific contact

### Types (`types.ts`)
- `Contact`: Main entity
- `ContactEmail`: Email with label and primary flag
- `ContactPhone`: Phone with label and primary flag

### Lib
- `format.ts`: `formatFullName()`, `formatPhoneNumber()`, etc.

## Database Schema
- Table: `contacts`
  - RLS: household members can CRUD contacts
  - Optional FK: `structure_id` references `structures`
- Tables: `emails`, `phones` (polymorphic via `contact_id` or `structure_id`)
- Join table: `interaction_contacts`

## Import Aliases
- `@contacts/components/*`
- `@contacts/hooks/*`
- `@contacts/types`
- `@contacts/lib/*`

## Related Features
- `structures`: Companies/organizations
- `interactions`: Link contacts to events
