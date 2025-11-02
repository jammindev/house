# 🏗️ Monorepo Structure Guide

This document explains the monorepo architecture of the House project and how the different packages work together.

## Overview

House is structured as a Yarn Workspaces monorepo with the following key benefits:

- **Code sharing** between web and mobile applications
- **Consistent tooling** across all packages
- **Simplified dependency management**
- **Type safety** across package boundaries
- **Unified build and test processes**

## Workspace Structure

```
house/
├── package.json              # Root workspace configuration
├── yarn.lock                 # Dependency lock file
├── .yarnrc.yml              # Yarn v4 configuration
├── tsconfig.json            # Shared TypeScript config
├── vercel.json              # Deployment configuration
│
├── apps/                    # Applications
│   ├── web/                 # Next.js web application
│   │   ├── package.json     # Web app dependencies
│   │   ├── next.config.ts   # Next.js configuration
│   │   ├── tsconfig.json    # TypeScript config
│   │   └── src/             # Source code
│   │
│   └── mobile/              # React Native mobile app
│       ├── package.json     # Mobile app dependencies
│       ├── expo.json        # Expo configuration
│       ├── metro.config.js  # Metro bundler config
│       ├── tsconfig.json    # TypeScript config
│       └── src/             # Source code
│
├── packages/                # Shared packages
│   └── shared/              # Shared TypeScript package
│       ├── package.json     # Shared package config
│       ├── tsconfig.json    # TypeScript config
│       ├── src/             # Source code
│       └── dist/            # Compiled output
│
└── supabase/               # Database & backend
    ├── config.toml         # Supabase configuration
    └── migrations/         # Database migrations
```

## Package Dependencies

### Dependency Flow

```
apps/web ────────┐
                 ├─→ packages/shared
apps/mobile ─────┘
```

Both applications depend on the shared package, but the shared package has no dependencies on the applications.

### Workspace Dependencies

Dependencies are declared using different strategies:

```json
// In apps/web/package.json and apps/mobile/package.json
{
  "dependencies": {
    "@house/shared": "file:../../packages/shared"
  }
}
```

**Note:** We use `file:` instead of `workspace:*` for Vercel compatibility, as Vercel uses Yarn v1 which doesn't support the workspace protocol.

## Shared Package (`packages/shared/`)

### Purpose

The shared package contains business logic, types, and utilities that are used by both web and mobile applications.

### Structure

```
packages/shared/src/
├── index.ts              # Main export file
├── types.ts              # Shared TypeScript types
├── hooks/                # Reusable React hooks
│   ├── useContacts.ts    # Contact management hook
│   └── useSupabase.ts    # Supabase client hook
└── utils/                # Utility functions
    └── supabase.ts       # Supabase configuration
```

### TypeScript Configuration

```json
// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

### Build Process

The shared package is compiled to JavaScript before being used by the applications:

```bash
# Build the shared package
yarn workspace @house/shared build

# Watch for changes during development
yarn workspace @house/shared dev
```

## Web Application (`apps/web/`)

### Configuration

#### Next.js Configuration

```typescript
// apps/web/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Custom configuration for monorepo
  transpilePackages: ['@house/shared'],
  experimental: {
    // Enable external directory imports
    externalDir: true,
  },
};

export default nextConfig;
```

#### TypeScript Path Mapping

```json
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@house/shared": ["../../packages/shared/src"]
    }
  }
}
```

### Usage of Shared Code

```typescript
// apps/web/src/components/ContactList.tsx
import { useContacts } from '@house/shared';
import type { Contact } from '@house/shared';

export default function ContactList() {
  const { contacts, loading } = useContacts();
  
  return (
    <div>
      {contacts.map((contact: Contact) => (
        <div key={contact.id}>{contact.name}</div>
      ))}
    </div>
  );
}
```

## Mobile Application (`apps/mobile/`)

### Configuration

#### Metro Configuration

```javascript
// apps/mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add workspace root for monorepo support
const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

config.watchFolders = [workspaceRoot];
config.resolver.platforms = ['native', 'ios', 'android'];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Resolve shared package
config.resolver.alias = {
  '@house/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
};

module.exports = config;
```

#### TypeScript Configuration

```json
// apps/mobile/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@house/shared": ["../../packages/shared/src"]
    }
  }
}
```

### Usage of Shared Code

```typescript
// apps/mobile/src/screens/ContactsScreen.tsx
import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { useContacts } from '@house/shared';
import type { Contact } from '@house/shared';

export default function ContactsScreen() {
  const { contacts, loading } = useContacts();

  const renderContact = ({ item }: { item: Contact }) => (
    <View>
      <Text>{item.name}</Text>
    </View>
  );

  return (
    <FlatList
      data={contacts}
      renderItem={renderContact}
      keyExtractor={(item) => item.id}
    />
  );
}
```

## Root Configuration

### Yarn Workspaces

```json
// package.json
{
  "name": "house-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "packageManager": "yarn@4.10.3",
  "scripts": {
    "dev": "yarn workspace @house/web dev",
    "dev:mobile": "yarn workspace @house/mobile start",
    "build": "yarn build:shared && yarn workspace @house/web build",
    "build:shared": "yarn workspace @house/shared build"
  }
}
```

### Yarn Configuration

```yaml
# .yarnrc.yml
nodeLinker: node-modules
```

We use `node-modules` linker instead of Yarn PnP for better compatibility with React Native and Expo.

### Shared TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@house/shared": ["./packages/shared/src"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

## Development Workflow

### Setting Up the Environment

1. **Install dependencies for all workspaces:**
   ```bash
   yarn install
   ```

2. **Build the shared package:**
   ```bash
   yarn build:shared
   ```

3. **Start development servers:**
   ```bash
   # Terminal 1: Web app
   yarn dev

   # Terminal 2: Mobile app
   yarn dev:mobile
   ```

### Making Changes to Shared Code

1. **Edit files in `packages/shared/src/`**

2. **Rebuild the shared package:**
   ```bash
   yarn build:shared
   ```

3. **Or use watch mode during development:**
   ```bash
   yarn workspace @house/shared dev
   ```

### Adding New Dependencies

**To the shared package:**
```bash
yarn workspace @house/shared add react-query
```

**To the web app:**
```bash
yarn workspace @house/web add @radix-ui/react-dialog
```

**To the mobile app:**
```bash
yarn workspace @house/mobile add react-native-gesture-handler
```

**To all workspaces (dev dependencies):**
```bash
yarn add -D typescript -W
```

## Build and Deployment

### Web Application (Vercel)

The web application build process:

1. **Install dependencies:** `corepack enable && yarn install`
2. **Build shared package:** Automatically included in `yarn build`
3. **Build web app:** `yarn workspace @house/web build`
4. **Output:** `apps/web/.next`

### Mobile Application (Expo)

```bash
cd apps/mobile

# Development build
expo start

# Production builds
expo build:android
expo build:ios
```

## Common Patterns

### Adding a New Shared Hook

1. **Create the hook in `packages/shared/src/hooks/`:**
   ```typescript
   // packages/shared/src/hooks/useProjects.ts
   import { useState, useEffect } from 'react';
   import type { Project } from '../types';

   export function useProjects() {
     const [projects, setProjects] = useState<Project[]>([]);
     // Implementation...
     return { projects };
   }
   ```

2. **Export from `packages/shared/src/index.ts`:**
   ```typescript
   export { useProjects } from './hooks/useProjects';
   ```

3. **Rebuild the shared package:**
   ```bash
   yarn build:shared
   ```

4. **Use in applications:**
   ```typescript
   import { useProjects } from '@house/shared';
   ```

### Adding Shared Types

1. **Define types in `packages/shared/src/types.ts`:**
   ```typescript
   export interface Project {
     id: string;
     name: string;
     status: 'active' | 'completed';
   }
   ```

2. **Export from `packages/shared/src/index.ts`:**
   ```typescript
   export type { Project } from './types';
   ```

3. **Use in applications:**
   ```typescript
   import type { Project } from '@house/shared';
   ```

## Troubleshooting

### Common Issues

**Metro bundler can't resolve `@house/shared`:**
- Check `metro.config.js` alias configuration
- Ensure the shared package is built: `yarn build:shared`

**TypeScript errors with shared imports:**
- Verify path mapping in `tsconfig.json`
- Check that the shared package exports the required types

**Vercel deployment fails:**
- Ensure `file:` dependencies are used instead of `workspace:`
- Check that `corepack enable` is included in install command

**Yarn workspace commands fail:**
- Verify you're running commands from the root directory
- Check that workspace names match package.json `name` fields

### Debug Commands

```bash
# List all workspaces
yarn workspaces list

# Check workspace dependencies
yarn why @house/shared

# Show workspace dependency tree
yarn workspaces foreach run --help

# Verify TypeScript configuration
yarn tsc --showConfig
```

## Best Practices

1. **Keep the shared package focused** - Only include code that is truly shared
2. **Use TypeScript strictly** - Leverage type safety across package boundaries
3. **Build before testing** - Always build the shared package before running tests
4. **Version consistently** - Keep dependency versions aligned across workspaces
5. **Document exports** - Clearly document what the shared package exports
6. **Test in both environments** - Ensure shared code works in both web and mobile contexts

This monorepo structure enables efficient code sharing while maintaining clear separation of concerns between web and mobile applications.