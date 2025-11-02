# 📋 Migration Guide: Single Project → Monorepo

This document explains the migration from the original single Next.js project to the current monorepo structure.

## Migration Overview

The House project has been restructured from a single Next.js application to a monorepo containing:

- **Web application** (Next.js) → `apps/web/`
- **Mobile application** (React Native + Expo) → `apps/mobile/`  
- **Shared code** (TypeScript) → `packages/shared/`

## What Changed

### Directory Structure

**Before:**
```
house/
├── nextjs/                 # Next.js application
│   ├── src/
│   ├── package.json
│   └── ...
├── package.json            # Root scripts only
└── supabase/              # Database
```

**After:**
```
house/
├── apps/
│   ├── web/               # Moved from nextjs/
│   └── mobile/            # New React Native app
├── packages/
│   └── shared/            # New shared package
├── package.json           # Workspace configuration
└── supabase/             # Unchanged
```

### Package Dependencies

**Before:**
- Single `nextjs/package.json` with all dependencies
- No code sharing capabilities

**After:**
- Root `package.json` with workspace configuration
- `apps/web/package.json` with web-specific dependencies
- `apps/mobile/package.json` with mobile-specific dependencies
- `packages/shared/package.json` with shared dependencies
- Dependencies reference shared package: `"@house/shared": "file:../../packages/shared"`

### Scripts and Commands

**Before:**
```bash
cd nextjs && yarn dev     # Development
cd nextjs && yarn build   # Build
```

**After:**
```bash
yarn dev                  # Web development
yarn dev:mobile          # Mobile development  
yarn build               # Build web (includes shared)
yarn build:shared        # Build shared package only
```

### Environment Variables

**Before:**
- `nextjs/.env.local`

**After:**
- `apps/web/.env.local` (web app)
- `apps/mobile/.env.local` (mobile app)

## Migration Benefits

### 1. Code Sharing
- Business logic shared between web and mobile
- Consistent TypeScript types across platforms
- Reusable React hooks

### 2. Consistent Development Experience
- Unified commands from root directory
- Shared tooling configuration
- Single dependency management

### 3. Scalability
- Easy to add new applications or packages
- Clear separation of concerns
- Independent versioning capabilities

## Breaking Changes

### Import Paths
**Before:**
```typescript
// Direct file imports
import { someUtil } from '../lib/utils';
```

**After:**
```typescript
// Workspace imports for shared code
import { someUtil } from '@house/shared';
```

### Build Process
**Before:**
```bash
# Simple Next.js build
yarn build
```

**After:**
```bash
# Must build shared package first
yarn build:shared
yarn workspace @house/web build
# Or use the combined command
yarn build
```

### Deployment Configuration
**Before:**
```json
// vercel.json
{
  "buildCommand": "next build",
  "outputDirectory": ".next"
}
```

**After:**
```json
// vercel.json
{
  "buildCommand": "corepack enable && yarn build",
  "outputDirectory": "apps/web/.next"
}
```

## Step-by-Step Migration

If you need to perform this migration on another project, here are the steps:

### 1. Create Monorepo Structure
```bash
mkdir apps packages
mv nextjs apps/web
```

### 2. Update Root Package.json
```json
{
  "name": "house-monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "packageManager": "yarn@4.10.3",
  "scripts": {
    "dev": "yarn workspace @house/web dev",
    "build": "yarn build:shared && yarn workspace @house/web build"
  }
}
```

### 3. Create Shared Package
```bash
mkdir -p packages/shared/src
```

Create `packages/shared/package.json`:
```json
{
  "name": "@house/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

### 4. Update Web App Dependencies
In `apps/web/package.json`:
```json
{
  "dependencies": {
    "@house/shared": "file:../../packages/shared"
  }
}
```

### 5. Move Shared Code
Extract reusable hooks, types, and utilities to `packages/shared/src/`.

### 6. Update TypeScript Configuration
Root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@house/shared": ["./packages/shared/src"]
    }
  }
}
```

### 7. Update Build Scripts
Ensure shared package is built before applications.

### 8. Create Mobile App (Optional)
```bash
cd apps
npx create-expo-app mobile --template
```

## Verification Steps

After migration, verify everything works:

### 1. Install Dependencies
```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
yarn install
```

### 2. Build Shared Package
```bash
yarn build:shared
```

### 3. Test Web App
```bash
yarn dev
# Verify app loads at localhost:3000
```

### 4. Test Mobile App (if applicable)
```bash
yarn dev:mobile
# Verify Expo QR code appears
```

### 5. Test Production Build
```bash
yarn build
# Verify build completes successfully
```

## Rollback Plan

If issues arise, you can rollback by:

1. **Move web app back to root:**
   ```bash
   mv apps/web/* .
   rm -rf apps packages
   ```

2. **Restore original package.json**

3. **Remove workspace dependencies**

4. **Update scripts back to original**

## Common Migration Issues

### 1. Import Resolution
**Problem:** Imports break after moving files
**Solution:** Update TypeScript paths and ensure shared package is built

### 2. Dependency Conflicts
**Problem:** Different versions across workspaces
**Solution:** Use workspace protocol or align versions manually

### 3. Build Order
**Problem:** Web app builds before shared package
**Solution:** Ensure build scripts include shared package build

### 4. Environment Variables
**Problem:** Environment files not found
**Solution:** Move .env files to appropriate app directories

## Next Steps

After successful migration:

1. **Extract more shared code** - Move common utilities to shared package
2. **Add mobile features** - Implement mobile-specific functionality
3. **Set up CI/CD** - Configure build pipeline for monorepo
4. **Update documentation** - Ensure all docs reflect new structure

## Support

If you encounter issues during migration:

1. Check the [Monorepo Guide](MONOREPO_GUIDE.md) for detailed configuration
2. Review workspace commands in the root package.json
3. Verify TypeScript path mapping configuration
4. Ensure build order includes shared package

The migration significantly improves the project's maintainability and enables mobile development while preserving all existing web functionality.