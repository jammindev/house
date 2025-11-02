# 🏠 House - Digital Household Management

A comprehensive household management system built with modern web and mobile technologies. Manage households, zones, interactions, and collaborate with family members or housemates.

## 🏗️ Monorepo Structure

This is a Yarn Workspaces monorepo containing:

- **`apps/web/`** - Next.js 15 web application (React 19, Tailwind CSS)
- **`apps/mobile/`** - React Native + Expo mobile application
- **`packages/shared/`** - Shared TypeScript package with reusable hooks and utilities
- **`supabase/`** - Database migrations, schemas, and configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ with Corepack enabled
- Yarn v4.10.3 (managed by package.json)
- Supabase CLI

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd house

# Install dependencies for all workspaces
yarn install

# Build shared package
yarn build:shared
```

### Environment Setup

1. **Web app environment:**
   ```bash
   cp apps/web/.env.template apps/web/.env.local
   # Edit apps/web/.env.local with your Supabase credentials
   ```

2. **Mobile app environment:**
   ```bash
   cp apps/mobile/.env.template apps/mobile/.env.local
   # Edit apps/mobile/.env.local with your Supabase credentials
   ```

3. **Supabase setup:**
   ```bash
   npx supabase login
   npx supabase link
   npx supabase db push
   ```

### Development

```bash
# Start web development server
yarn dev

# Start mobile development server (in another terminal)
yarn dev:mobile

# Build everything
yarn build

# Run tests
yarn test
```

## 📱 Applications

### Web Application (`apps/web/`)

- **Framework:** Next.js 15 with App Router
- **UI:** Tailwind CSS + shadcn/ui components
- **Features:** 
  - Household management and member collaboration
  - Zone-based organization system
  - Interaction tracking with attachments
  - Project management with kanban boards
  - Multi-language support (EN/FR)
  - Document storage and OCR processing
  - 2FA authentication

### Mobile Application (`apps/mobile/`)

- **Framework:** React Native + Expo
- **Navigation:** React Navigation v7
- **Features:**
  - Native mobile experience
  - Shared business logic with web app
  - Offline-first capabilities (planned)
  - Camera integration for document capture

### Shared Package (`packages/shared/`)

- **Purpose:** Code sharing between web and mobile
- **Contents:**
  - TypeScript type definitions
  - Reusable React hooks
  - Utility functions
  - Supabase client configurations

## 🛠️ Tech Stack

- **Monorepo:** Yarn Workspaces v4.10.3
- **Frontend Web:** Next.js 15, React 19, Tailwind CSS, shadcn/ui
- **Frontend Mobile:** React Native, Expo, React Navigation
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Shared Logic:** TypeScript, React hooks
- **Deployment:** Vercel (web), Expo (mobile)
- **Development:** TypeScript 5, ESLint 9, Metro bundler

## 📁 Project Structure

```
house/
├── apps/
│   ├── web/                 # Next.js web application
│   │   ├── src/app/         # App Router pages
│   │   ├── src/components/  # React components
│   │   ├── src/lib/         # Utilities and configurations
│   │   └── package.json
│   └── mobile/              # React Native mobile app
│       ├── src/screens/     # Mobile screens
│       ├── src/components/  # Mobile components
│       ├── App.tsx          # Entry point
│       └── package.json
├── packages/
│   └── shared/              # Shared TypeScript package
│       ├── src/hooks/       # Reusable React hooks
│       ├── src/types.ts     # Type definitions
│       └── package.json
├── supabase/
│   ├── migrations/          # Database migrations
│   └── config.toml          # Supabase configuration
├── package.json             # Root workspace configuration
└── yarn.lock               # Dependency lock file
```

## 🚢 Deployment

### Web Application (Vercel)

The web application is configured for deployment on Vercel with the following settings:

- **Framework:** Other (custom configuration)
- **Build Command:** `yarn build`
- **Output Directory:** `apps/web/.next`
- **Install Command:** `corepack enable && yarn install`
- **Root Directory:** `./`

Environment variables needed:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PRIVATE_SUPABASE_SERVICE_KEY`

### Mobile Application (Expo)

```bash
cd apps/mobile
expo build:android
expo build:ios
```

## 🧩 Workspace Commands

```bash
# Development
yarn dev                    # Start web dev server
yarn dev:mobile            # Start mobile dev server

# Building
yarn build                 # Build web app (includes shared package)
yarn build:shared          # Build shared package only
yarn build:web             # Build web app with shared package

# Testing
yarn test                  # Run all tests
yarn test:e2e              # Run end-to-end tests (web)

# Linting & Type Checking
yarn lint                  # Lint all workspaces
yarn type-check            # Type check all workspaces

# Database
yarn db:migrate            # Run Supabase migrations
yarn db:reset              # Reset Supabase database
yarn db:new <name>         # Create new migration

# Maintenance
yarn clean                 # Clean build artifacts
```

## 🔧 Development Guidelines

### Adding Features

1. **Shared logic** goes in `packages/shared/src/`
2. **Web-specific** components go in `apps/web/src/`
3. **Mobile-specific** components go in `apps/mobile/src/`
4. **Database changes** require migrations in `supabase/migrations/`

### Code Sharing

Import shared code using the workspace alias:

```typescript
// In web or mobile apps
import { useContacts } from '@house/shared';
import type { Contact } from '@house/shared';
```

### TypeScript Configuration

- Root `tsconfig.json` provides shared configuration
- Path mapping configured for `@house/shared` imports
- Metro bundler configured for monorepo structure

## 📚 Documentation

- [Project Structure](STRUCTURE.md) - Detailed architecture overview
- [Mobile Implementation](MOBILE_IMPLEMENTATION_DETAILED.md) - Mobile app details
- [Database Schema](supabase/DB_SCHEMAS.md) - Database structure
- [API Documentation](AGENTS.md) - API and component reference

## 🤝 Contributing

1. Create a feature branch
2. Make your changes in the appropriate workspace
3. Run tests: `yarn test`
4. Build all packages: `yarn build`
5. Submit a pull request

## 📄 License

[Add your license information here]