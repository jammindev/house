# Insurance Feature Documentation

## Overview

The Insurance feature allows users to manage their insurance contracts within the household management system. It provides a complete CRUD interface for tracking insurance policies, renewals, costs, and coverage details.

## Reference Pattern for Future Feature Pages

Use the Insurance feature as the blueprint for new domains. Key expectations:
- **Create/Edit in SheetDialog**: Both new and update flows live inside a SheetDialog, triggered from list cards or detail actions; no full-page navigation.
- **Shared form component**: A single form component powers both create and edit, initialized with defaults or existing values.
- **List + detail pairing**: Keep a fast list/grid surface plus a focused detail view; avoid building isolated forms without list context.
- **Feature-first placement**: Route files stay thin and delegate to `nextjs/src/features/<domain>/` components/hooks.
- **RLS-first data access**: All Supabase calls validate household membership and stay within the household scope.

## Features

### List View (`/app/insurance`)
- Displays all insurance contracts in a responsive 2-column grid
- Each card shows:
  - Contract name and insurance type
  - Provider information
  - Status badge (Active, Suspended, Terminated)
  - Monthly or yearly cost
  - Renewal date
  - "Renewal Soon" badge for contracts expiring within 60 days
- Empty state with call-to-action button
- Create new contracts using the "+" button (opens in SheetDialog; this is the canonical pattern for new resources)

### Detail View (`/app/insurance/[id]`)
- Comprehensive contract information organized in sections:
  - **General Information**: Provider, contract number, insured item
  - **Coverage Details**: Coverage summary
  - **Important Dates**: Start date, end date, renewal date
  - **Costs & Payment**: Payment frequency, monthly cost, yearly cost
  - **Notes**: Additional notes
- Action buttons:
  - Edit (opens form in SheetDialog)
  - Delete (with confirmation dialog)
- Audit history showing creation and last update timestamps

### Create & Edit Forms
- Opens in SheetDialog (no page navigation)
- Fields:
  - Contract name* (required)
  - Provider
  - Insurance type (health, home, car, life, liability, other)
  - Status (active, suspended, terminated)
  - Contract number
  - Insured item
  - Start date, end date, renewal date
  - Payment frequency (monthly, quarterly, yearly)
  - Monthly cost, yearly cost
  - Coverage summary
  - Notes
- Form validation with error messages
- Success/error toast notifications

## Database Schema

### Table: `insurance_contracts`

```sql
- id: uuid (primary key)
- household_id: uuid (foreign key to households)
- name: text (required)
- provider: text
- contract_number: text
- type: text (health, home, car, life, liability, other)
- insured_item: text
- start_date: date
- end_date: date
- renewal_date: date
- status: text (active, suspended, terminated)
- payment_frequency: text (monthly, quarterly, yearly)
- monthly_cost: numeric(12,2)
- yearly_cost: numeric(12,2)
- coverage_summary: text
- notes: text
- created_at: timestamp
- updated_at: timestamp
- created_by: uuid
- updated_by: uuid
```

### Security (RLS Policies)
- All operations scoped to household members
- Policies for SELECT, INSERT, UPDATE, DELETE
- Validates household membership via `household_members` table

## File Structure

```
nextjs/src/features/insurance/
├── components/
│   ├── InsuranceCard.tsx          # Card component for list view
│   ├── InsuranceList.tsx          # Grid layout for contracts
│   ├── InsuranceForm.tsx          # Create/edit form
│   └── InsuranceDetailView.tsx    # Detail page view
├── hooks/
│   ├── useInsurance.ts            # List with filters
│   └── useInsuranceContract.ts    # Single contract fetch
├── constants.ts                    # Insurance types, statuses, defaults
├── types.ts                        # TypeScript type definitions
└── index.ts                        # Feature exports

nextjs/src/app/app/(pages)/insurance/
├── page.tsx                        # List page
└── [id]/page.tsx                   # Detail page
```

## Internationalization

All strings are fully translated in English and French:
- `insurance.*` keys in `en.json` and `fr.json`
- Insurance types: health, home, car, life, liability, other
- Status values: active, suspended, terminated
- Payment frequencies: monthly, quarterly, yearly

## Accessibility

- Semantic HTML structure
- Proper ARIA labels
- Keyboard navigation support
- Focus management in SheetDialog
- Visible focus states
- Screen reader friendly

## Design Consistency

The feature follows the existing design patterns:
- Uses the same layout components (ListPageLayout, ResourcePageShell)
- Consistent with ProjectCard and Equipment styles
- Reuses SheetDialog for forms
- Standard badge colors and styles
- Follows the project's color scheme and spacing

## Future Enhancements

Potential improvements that could be added:
- Document attachment support
- Renewal reminder notifications
- Filter by insurance type or status
- Annual cost summary dashboard
- Icon based on insurance type
- Link to related interactions or expenses
- Multi-contract comparison view
- Export contracts to PDF
