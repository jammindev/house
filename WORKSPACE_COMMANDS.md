# 🧩 Workspace Commands Reference

This document provides a comprehensive reference for all available commands in the House monorepo.

## Root Commands

All commands are run from the root directory (`/house`).

### Development

```bash
# Start web development server (localhost:3000 or 3001)
yarn dev

# Start mobile development server with Expo
yarn dev:mobile

# Start both web and mobile (in separate terminals)
yarn dev && yarn dev:mobile
```

### Building

```bash
# Build shared package + web application (production)
yarn build

# Build only the shared package (TypeScript compilation)
yarn build:shared

# Build web application with shared package dependency
yarn build:web

# Build web application directly (assumes shared is built)
yarn workspace @house/web build
```

### Testing

```bash
# Run all tests across all workspaces
yarn test

# Run end-to-end tests (web application)
yarn test:e2e

# Run end-to-end tests with UI (Playwright)
yarn test:e2e:ui

# Run end-to-end tests in headed mode
yarn test:e2e:headed
```

### Linting & Type Checking

```bash
# Lint all workspaces
yarn lint

# Fix linting issues across all workspaces
yarn lint:fix

# Type check all workspaces
yarn type-check
```

### Database Operations

```bash
# Run Supabase migrations
yarn db:migrate

# Reset Supabase database (destructive!)
yarn db:reset

# Create new migration
yarn db:new <migration_name>
```

### Maintenance

```bash
# Clean build artifacts across all workspaces
yarn clean

# Start web application in production mode
yarn start
```

## Workspace-Specific Commands

### Working with Specific Workspaces

```bash
# Run command in specific workspace
yarn workspace @house/web <command>
yarn workspace @house/mobile <command>
yarn workspace @house/shared <command>

# Examples:
yarn workspace @house/web dev
yarn workspace @house/mobile start
yarn workspace @house/shared build
```

### Web Application (`@house/web`)

```bash
# Development
yarn workspace @house/web dev

# Building
yarn workspace @house/web build

# Production start
yarn workspace @house/web start

# Linting
yarn workspace @house/web lint

# Type checking
yarn workspace @house/web type-check

# Testing
yarn workspace @house/web test
yarn workspace @house/web test:e2e
yarn workspace @house/web test:unit

# Playwright management
yarn workspace @house/web playwright:install
```

### Mobile Application (`@house/mobile`)

```bash
# Development (Expo)
yarn workspace @house/mobile start

# Platform-specific development
yarn workspace @house/mobile android
yarn workspace @house/mobile ios
yarn workspace @house/mobile web

# Type checking
yarn workspace @house/mobile type-check

# Cleaning
yarn workspace @house/mobile clean
```

### Shared Package (`@house/shared`)

```bash
# Build (TypeScript compilation)
yarn workspace @house/shared build

# Watch mode for development
yarn workspace @house/shared dev

# Testing
yarn workspace @house/shared test
```

## Bulk Operations

### Run Command Across All Workspaces

```bash
# Run command in all workspaces (parallel)
yarn workspaces foreach -A run <command>

# Examples:
yarn workspaces foreach -A run lint
yarn workspaces foreach -A run type-check
yarn workspaces foreach -A run clean

# Run command in parallel with output
yarn workspaces foreach -A -p run <command>

# Run command in topological order (dependencies first)
yarn workspaces foreach -A -t run <command>
```

### Dependency Management

```bash
# Add dependency to specific workspace
yarn workspace @house/web add <package>
yarn workspace @house/mobile add <package>
yarn workspace @house/shared add <package>

# Add dev dependency
yarn workspace @house/web add -D <package>

# Add dependency to root (affects all workspaces)
yarn add -W <package>

# Remove dependency
yarn workspace @house/web remove <package>

# Upgrade dependencies
yarn workspace @house/web upgrade <package>
```

## Advanced Commands

### Workspace Information

```bash
# List all workspaces
yarn workspaces list

# Show workspace dependency tree
yarn workspaces list --json

# Show why a package is installed
yarn why <package>

# Show workspace information
yarn workspace @house/web info
```

### Development Workflow Commands

```bash
# Fresh install (clean setup)
rm -rf node_modules apps/*/node_modules packages/*/node_modules yarn.lock
yarn install

# Build everything from scratch
yarn clean
yarn build:shared
yarn build

# Verify monorepo integrity
yarn workspaces list
yarn build:shared
yarn workspace @house/web build
yarn workspace @house/mobile start --help
```

### Debugging Commands

```bash
# Check Yarn configuration
yarn config list

# Check workspace configuration
yarn workspaces list --verbose

# Show TypeScript configuration
yarn workspace @house/web tsc --showConfig
yarn workspace @house/mobile tsc --showConfig
yarn workspace @house/shared tsc --showConfig

# Verify Metro configuration (mobile)
yarn workspace @house/mobile expo start --clear
```

## Environment-Specific Commands

### Development Environment

```bash
# Setup development environment
cp apps/web/.env.template apps/web/.env.local
cp apps/mobile/.env.template apps/mobile/.env.local

# Start development with all services
yarn build:shared
yarn dev                    # Terminal 1
yarn dev:mobile            # Terminal 2
```

### Production Environment

```bash
# Production build and start
yarn build
yarn start

# Mobile production builds
cd apps/mobile
expo build:android
expo build:ios
```

### Testing Environment

```bash
# Run full test suite
yarn build:shared
yarn test
yarn test:e2e

# Test specific workspace
yarn workspace @house/web test:unit
yarn workspace @house/web test:e2e
```

## Command Aliases

You can create aliases in your shell for frequently used commands:

```bash
# Add to ~/.zshrc or ~/.bashrc
alias h-dev="yarn dev"
alias h-mobile="yarn dev:mobile"
alias h-build="yarn build"
alias h-test="yarn test"
alias h-shared="yarn build:shared"

# Workspace-specific aliases
alias h-web="yarn workspace @house/web"
alias h-mobile-ws="yarn workspace @house/mobile"
alias h-shared-ws="yarn workspace @house/shared"

# Usage:
# h-dev              # Start web dev
# h-web build        # Build web app
# h-mobile-ws start  # Start mobile app
```

## Common Workflows

### New Feature Development

```bash
# 1. Start development environment
yarn build:shared
yarn dev                    # Terminal 1
yarn dev:mobile            # Terminal 2 (if working on mobile)

# 2. Make changes to shared code
# Edit files in packages/shared/src/

# 3. Rebuild shared package
yarn build:shared

# 4. Test changes
yarn test
yarn test:e2e

# 5. Build for production
yarn build
```

### Adding New Dependencies

```bash
# For web app only
yarn workspace @house/web add react-query

# For mobile app only
yarn workspace @house/mobile add react-native-gesture-handler

# For shared package
yarn workspace @house/shared add lodash
yarn workspace @house/shared add -D @types/lodash

# For development tools (all workspaces)
yarn add -W -D prettier
```

### Deployment Workflow

```bash
# 1. Ensure everything builds
yarn clean
yarn build

# 2. Run tests
yarn test
yarn test:e2e

# 3. Commit and push
git add .
git commit -m "feat: add new feature"
git push

# 4. Deploy (automatic via Vercel for web)
# Mobile deployment requires manual build and submission
```

This command reference should help you navigate the monorepo efficiently and understand which commands to use for different scenarios.