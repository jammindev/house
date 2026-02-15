# Tests for useProjectsByGroup Hook and Project Groups Page

## Overview

This document describes the tests created for the new `useProjectsByGroup` hook and the project groups detail page functionality.

## Unit Tests

### `useProjectsByGroup.test.ts`

Tests the `fetchProjectsByGroup` function and `useProjectsByGroup` hook:

- **fetchProjectsByGroup function:**
  - Returns empty array when householdId is null/undefined
  - Fetches projects without group filter when projectGroupId is null
  - Fetches projects with group filter when projectGroupId is provided
  - Enriches projects with metrics and group information
  - Handles Supabase errors appropriately

- **useProjectsByGroup hook:**
  - Returns loading state initially
  - Sets loading to false when required parameters are missing
  - Fetches projects successfully and updates state
  - Handles fetch errors and displays error messages
  - Provides a reload function

## Integration Tests

### `project-groups-detail.spec.ts`

End-to-end tests for the project groups detail page:

- **Navigation and Error Handling:**
  - Shows 404 state for non-existent groups
  - Navigates back to project groups list
  
- **Data Display:**
  - Displays correct group information
  - Shows only projects belonging to the specific group (filtering test)

## Running the Tests

### Unit Tests
```bash
cd nextjs
yarn test:unit
# or specifically for this hook:
yarn test:unit useProjectsByGroup
```

### Integration Tests
```bash
cd nextjs
yarn test:e2e
# or specifically for project groups:
yarn test:e2e project-groups-detail
```

## Test Coverage

The tests verify that:
1. The `fetchProjectsByGroup` function correctly filters projects by `project_group_id`
2. The `useProjectsByGroup` hook provides the same interface as `useProjects` but with focused data
3. The project groups detail page only shows projects from the specified group
4. Error states are handled appropriately
5. Performance is improved by not loading all projects when only group projects are needed

## Key Benefits Tested

- ✅ **Filtering works correctly** - Only projects with matching `project_group_id` are returned
- ✅ **No interference with global filters** - Uses separate query without persistent filters
- ✅ **Proper error handling** - Network errors, missing data, and invalid IDs are handled
- ✅ **Loading states** - UI shows appropriate loading indicators
- ✅ **Type safety** - All TypeScript types are correct and enforced