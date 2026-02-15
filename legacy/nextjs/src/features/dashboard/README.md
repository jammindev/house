# Dashboard Feature

## Purpose
Home screen showing recent activity, statistics, and quick actions.

## Key Concepts
- **Recent Interactions**: Latest household entries
- **Quick Actions**: Create interaction, manage zones, settings
- **Stats**: Interaction counts, zone counts, upcoming tasks

## Architecture

### Components
- `DashboardStats`: Metric cards
- `RecentActivity`: Timeline of recent interactions
- `QuickActions`: Action buttons grid

### Hooks
- `useDashboardData()`: Aggregates stats and recent items

## Import Aliases
- `@dashboard/components/*`
- `@dashboard/hooks/*`

## Routes
- `/app` - Main dashboard

## Related Features
- Aggregates data from all features
