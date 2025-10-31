# 🏠 House - Household Knowledge Management System

A comprehensive household knowledge management system built with Next.js 15, Supabase, and modern web technologies. House helps you centralize and organize all your household information including interactions, documents, zones, projects, contacts, and more.

## 🎯 Overview

House is a multi-tenant application designed to help households capture, organize, and retrieve knowledge efficiently. Whether it's documenting home maintenance, tracking renovation projects, managing contacts, or organizing photos by room, House provides a centralized hub for all your household information.

> 📄 Looking for implementation guidance? Start with [`STRUCTURE.md`](./STRUCTURE.md) for the repository map, then read [`PAGE_LAYOUTS.md`](./PAGE_LAYOUTS.md) to learn how pages use the shared shells and layouts.

### Key Capabilities

- **📝 Interactions**: Capture chronological notes, tasks, expenses, and quotes with attachments
- **🏘️ Zones**: Organize your home into hierarchical zones (rooms, areas) with photos and measurements
- **📋 Projects**: Track renovation projects with budgets, timelines, tasks, and expenses
- **📁 Documents**: Manage household documents with support for photos, PDFs, and other files
- **👥 Contacts**: Maintain relationships with contractors, service providers, and other contacts
- **🏢 Structures**: Track buildings, properties, and physical structures
- **🔍 Multi-household**: Support for multiple households per user with role-based access

## ✨ Features

### 🔐 Authentication & Security
- Email/Password authentication with Supabase Auth
- **Multi-factor authentication (MFA/TOTP)** support via authenticator apps
- Row-Level Security (RLS) policies protecting all data
- Secure file storage with user-scoped access
- Password reset and email verification

### 🏡 Household Management
- Create and manage multiple households
- Role-based access control (owner/member)
- Invite and manage household members
- Switch between households seamlessly

### 📝 Interactions System
- Create various interaction types: notes, tasks, expenses, quotes, documents, photos
- Link interactions to zones, projects, contacts, and structures
- Attach multiple files (images, PDFs, documents)
- Tag and categorize interactions
- Track metadata: status, occurred date, type-specific fields
- Full CRUD operations for household members

### 🏘️ Zone Management
- Hierarchical zone organization (e.g., House → Kitchen → Pantry)
- Color-coding with automatic shade inheritance for nested zones
- Surface area tracking
- Notes and descriptions per zone
- Photo galleries for each zone
- Zone-specific statistics and insights

### 📋 Project Management
- Track renovation and maintenance projects
- Budget planning (planned vs. actual costs)
- Project status workflow: draft → active → on_hold → completed
- Priority levels (1-5)
- Timeline management with start/due dates
- Link interactions (tasks, expenses, documents) to projects
- Project metrics: task completion, document count, actual costs
- Cover photos for projects

### 📁 Document & File Management
- Secure file upload to Supabase Storage
- Support for images, PDFs, and other document types
- File previews (images and PDFs)
- Many-to-many relationship: documents can link to multiple interactions
- Zone photo galleries
- OCR support (planned for text extraction)

### 🌍 Internationalization (i18n)
- Multi-language support (English and French)
- Custom i18n provider with React context
- User-specific language preferences
- Easy to extend with additional languages

### 🎨 Modern UI/UX
- Built with shadcn/ui components and Tailwind CSS
- Responsive, mobile-first design
- Dark mode support (via Tailwind themes)
- Loading states and optimistic updates
- Toast notifications
- Intuitive navigation and quick actions
- Feature-first architecture for maintainability

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - App Router with React Server Components
- **React 19** - Latest React features
- **TypeScript 5** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality component library
- **Lucide React** - Icon library
- **Framer Motion** - Animations
- **React Hook Form** - Form validation and management

### Backend
- **Supabase** - Backend as a Service
  - PostgreSQL 17 database
  - Row-Level Security (RLS)
  - Storage buckets for files
  - Real-time subscriptions
  - Authentication
- **Server Components** - Data fetching and rendering

### Development Tools
- **ESLint 9** - Code linting
- **Prettier** - Code formatting
- **Playwright** - End-to-end testing
- **Vitest** - Unit testing
- **TypeScript** - Static type checking

## 📦 Getting Started

### Prerequisites

- Node.js 18+ and Yarn
- A Supabase account and project
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/jammin-dev/house.git
   cd house
   ```

2. **Set up Supabase**
   
   First, gather your Supabase credentials:
   - Project URL: `Project Settings` → `API` → `Project URL`
   - Anon Key: `Project Settings` → `API` → `anon` key
   - Service Role Key: `Project Settings` → `API` → `service_role` key
   - Database Password: `Project Settings` → `Database` → Reset if needed

   Then link your Supabase project:
   ```bash
   # Login to Supabase CLI
   npx supabase login
   
   # Link to your Supabase project
   npx supabase link
   
   # Push configuration to Supabase
   npx supabase config push
   
   # Run database migrations
   npx supabase migrations up --linked
   ```

3. **Configure the frontend**
   ```bash
   cd nextjs
   yarn install
   
   # Copy environment template
   cp .env.template .env.local
   ```

   Edit `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   PRIVATE_SUPABASE_SERVICE_KEY=your-service-role-key
   ```

4. **Run the development server**
   ```bash
   yarn dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000) in your browser 🎉

### Testing

#### End-to-End Tests (Playwright)

```bash
# Install Playwright browsers (first time only)
cd nextjs
yarn playwright:install

# Run E2E tests
yarn test:e2e

# Run E2E tests with UI
yarn test:e2e:ui

# Run E2E tests in headed mode
yarn test:e2e:headed
```

#### Unit Tests (Vitest)

```bash
cd nextjs
yarn test:unit
```

## 🚀 Deployment

### Deploy to Vercel

1. **Fork or clone this repository**

2. **Create a new project in Vercel**
   - Import your repository
   - Vercel will auto-detect Next.js

3. **Configure environment variables**
   
   Add the following in Vercel's environment variables section:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   PRIVATE_SUPABASE_SERVICE_KEY=your-service-role-key
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete

5. **Update Supabase redirect URLs**
   
   In `supabase/config.toml`, update:
   ```toml
   site_url = "https://your-app.vercel.app"
   additional_redirect_urls = ["https://your-app.vercel.app/**"]
   ```
   
   Then push the config:
   ```bash
   npx supabase config push
   ```

## 📐 Architecture

### Feature-First Structure

House follows a feature-first architecture pattern:

```
nextjs/src/
├── app/                    # Next.js App Router routes
│   ├── app/               # Protected application routes
│   │   ├── contacts/      # Contact management
│   │   ├── documents/     # Document library
│   │   ├── households/    # Household management
│   │   ├── photos/        # Photo gallery
│   │   ├── projects/      # Project management
│   │   ├── structures/    # Structure tracking
│   │   ├── user-settings/ # User preferences
│   │   └── zones/         # Zone management
│   ├── auth/              # Authentication routes
│   └── api/               # API routes
├── features/              # Feature modules
│   ├── contacts/          # Contact domain logic
│   ├── dashboard/         # Dashboard components
│   ├── documents/         # Document management
│   ├── interactions/      # Interaction system
│   ├── photos/            # Photo handling
│   ├── projects/          # Project features
│   ├── structures/        # Structure management
│   └── zones/             # Zone features
├── components/            # Shared UI components
│   ├── ui/               # shadcn/ui primitives
│   └── layout/           # Layout components
└── lib/                   # Cross-cutting utilities
    ├── supabase/         # Supabase clients
    ├── i18n/             # Internationalization
    └── context/          # React contexts
```

### Database Schema

The database uses PostgreSQL with Row-Level Security (RLS) for multi-tenancy:

**Core Tables:**
- `households` - Household definitions
- `household_members` - User-household relationships with roles
- `zones` - Hierarchical zone structure
- `interactions` - Chronological household events/notes
- `interaction_zones` - Many-to-many: interactions ↔ zones
- `documents` - File metadata and references
- `interaction_documents` - Many-to-many: interactions ↔ documents
- `zone_documents` - Zone photo galleries
- `projects` - Renovation/maintenance projects
- `contacts` - People and organizations
- `structures` - Buildings and properties
- `emails`, `phones`, `addresses` - Contact information

**Key Features:**
- All tables have RLS policies based on household membership
- Automatic audit columns (`created_at`, `created_by`, `updated_at`, `updated_by`)
- Triggers for data integrity and denormalization
- Security-definer RPCs for complex operations

### API Architecture

- **Server Components**: Default for data fetching and rendering
- **Client Components**: Used only when browser APIs needed
- **API Routes**: Minimal, primarily for Supabase RPCs
- **RPC Functions**: 
  - `create_household_with_owner` - Atomic household creation
  - `create_interaction_with_zones` - Atomic interaction creation

## 🗺️ Roadmap

### Current Status (MVP)
- ✅ Multi-household support with RLS
- ✅ Interaction capture with attachments
- ✅ Zone hierarchy and management
- ✅ Project tracking with budgets
- ✅ Document management
- ✅ Contact and structure tracking
- ✅ Photo galleries for zones
- ✅ MFA/TOTP support
- ✅ Internationalization (EN/FR)
- ✅ End-to-end testing

### Planned Features
- 🔍 Full-text search across interactions and documents
- 📷 OCR (Optical Character Recognition) for document text extraction
- 🤖 Content enrichment and automatic categorization
- 📊 Advanced analytics and insights dashboards
- 📅 Maintenance schedules and reminders
- 📱 Mobile apps (iOS/Android)
- 🔗 Third-party integrations (calendars, smart home)
- 📧 Email notifications for tasks and updates

## 🤝 Contributing

Contributions are welcome! This project follows standard GitHub workflow:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`yarn test:e2e` and `yarn test:unit`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow the existing code style (enforced by ESLint/Prettier)
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described
- Ensure RLS policies are in place for new tables

## 📝 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with amazing open-source technologies:

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend platform
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Lucide](https://lucide.dev/) - Icon library
- [Playwright](https://playwright.dev/) - Testing framework

## 📞 Support

For questions, issues, or feature requests, please [open an issue](https://github.com/jammin-dev/house/issues) on GitHub.
