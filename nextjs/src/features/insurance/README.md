# Insurance Feature

## Purpose
Manages household insurance policies (home, auto, liability, etc.) with coverage details and claim tracking.

## Key Concepts
- **Policies**: Insurance contracts with provider, coverage, dates
- **Claims**: Incidents filed against policies
- **Documents**: Policy documents, claim forms, correspondence
- **Coverage**: Policy limits, deductibles, covered items

## Architecture

### Components
- `InsuranceCard`: Summary card with policy info, expiration
- `InsuranceForm`: Create/edit form with coverage details
- `ClaimList`: Claims associated with policy

### Hooks
- `useInsurance()`: Loads policies for household
- `useClaims()`: Claims for specific policy

### Types
- `InsurancePolicy`: Main entity
- `Claim`: Claim record

## Database Schema
- Table: `insurance_policies`
  - RLS: household members can CRUD policies
- Table: `claims`
  - FK: `policy_id` references `insurance_policies`

## Import Aliases
- `@insurance/components/*`
- `@insurance/hooks/*`
- `@insurance/types`

## Related Features
- `structures`: Insurance companies
- `interactions`: Link policies to interactions
- `documents`: Policy documents

## Future Enhancements
- Coverage gap analysis
- Renewal reminders
- Claim status tracking
