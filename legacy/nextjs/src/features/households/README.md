# Households Feature

## Purpose
Multi-tenancy foundation. Manages households and membership.

## Key Concepts
- **Households**: Top-level containers for all data
- **Members**: Users belong to households via `household_members`
- **Roles**: `owner`, `admin`, `member` (future role-based permissions)

## Architecture

### Components
- `HouseholdSelector`: Dropdown to switch active household
- `HouseholdForm`: Create household form
- `MemberList`: Display household members

### Hooks
- `useHouseholds()`: Loads user's households (via GlobalContext)

### API
- `/api/households`: POST to create household (calls `create_household_with_owner` RPC)

## Database Schema
- Table: `households`
  - RLS: members can view households they belong to
- Table: `household_members`
  - RLS: users can view their memberships
  - PK: `(household_id, user_id)`

## Import Aliases
- `@households/components/*`
- `@households/hooks/*`

## Related Features
- All features scope data by `household_id`
- `GlobalContext`: Manages selected household state
