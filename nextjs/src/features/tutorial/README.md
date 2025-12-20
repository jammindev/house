# Tutorial Feature

## Purpose
Onboarding guides and interactive tutorials for new users.

## Key Concepts
- **Steps**: Sequential tutorial progression
- **Tooltips**: Contextual help overlays
- **Progress**: Track completion state

## Architecture

### Components
- `TutorialOverlay`: Step-by-step guide overlay
- `TutorialTooltip`: Context-aware hints
- `TutorialProgress`: Progress indicator

### Hooks
- `useTutorial()`: Tutorial state management
- `useTutorialProgress()`: Completion tracking

## Database Schema
- Table: `tutorial_progress` (optional)
  - Tracks user completion state

## Import Aliases
- `@tutorial/components/*`
- `@tutorial/hooks/*`

## Related Features
- Integrates with all features for onboarding
