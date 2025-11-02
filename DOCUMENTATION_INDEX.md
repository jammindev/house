# 📚 Documentation Index

This file provides a navigation guide for all documentation in the House project.

## 🎯 For AI Contributors (Read First)

**Primary AI Documentation - READ THESE FIRST:**

1. **[AGENTS.md](./AGENTS.md)** ⭐ - Complete project context, architecture, conventions
2. **[AI_UPDATE_WORKFLOW.md](./AI_UPDATE_WORKFLOW.md)** ⭐ - Step-by-step process for making changes

**Monorepo Reference:**

3. **[WORKSPACE_COMMANDS.md](./WORKSPACE_COMMANDS.md)** - All available monorepo commands
4. **[MONOREPO_GUIDE.md](./MONOREPO_GUIDE.md)** - Detailed monorepo setup and patterns
5. **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Migration from single app to monorepo

## 👨‍💻 For Human Contributors

**Getting Started:**

1. **[README.md](./README.md)** - Project overview and quick start
2. **[STRUCTURE.md](./STRUCTURE.md)** - Detailed folder structure and patterns

**Architecture Reference:**

- **[Database Documentation](./supabase/RLS_OVERVIEW.md)** - Database security model
- **[Web App Documentation](./apps/web/README.md)** - Web-specific documentation

## 📱 Mobile Development

- **[MOBILE_ARCHITECTURE.md](./MOBILE_ARCHITECTURE.md)** - Mobile app architecture
- **[MOBILE_IMPLEMENTATION_DETAILED.md](./MOBILE_IMPLEMENTATION_DETAILED.md)** - Detailed mobile implementation
- **[MOBILE_IMPLEMENTATION_SUMMARY.md](./MOBILE_IMPLEMENTATION_SUMMARY.md)** - Mobile implementation summary

## 📋 Project Management

- **[BACKLOG.md](./BACKLOG.md)** - Feature planning and roadmap
- **[AUDIT.md](./AUDIT.md)** - Project audit and analysis
- **[PAGE_LAYOUTS.md](./PAGE_LAYOUTS.md)** - UI layout patterns
- **[RESUME-PROJECT.md](./RESUME-PROJECT.md)** - Project resumption guide

## 🗂️ Deprecated/Legacy Files

⚠️ These files contain outdated information and should not be used for current development:

- **[instructions.md](./instructions.md)** - Legacy single-app context (deprecated)

## 📖 Reading Order for New Contributors

### For AI/Automated Contributors:
1. Start with `AGENTS.md` for complete context
2. Read `AI_UPDATE_WORKFLOW.md` before making any changes
3. Reference `WORKSPACE_COMMANDS.md` for commands
4. Use other files as needed for specific domains

### For Human Contributors:
1. Start with `README.md` for project overview
2. Follow the quick start guide in `README.md`
3. Read `STRUCTURE.md` for detailed architecture
4. Consult `MONOREPO_GUIDE.md` for workspace management
5. Use domain-specific docs as needed

## 🔄 Keeping Documentation Updated

When making changes to the project:

1. **Always update `AGENTS.md`** if architecture, database schema, or major workflows change
2. **Update `README.md`** if setup process or core features change
3. **Update specific guides** (MONOREPO_GUIDE.md, WORKSPACE_COMMANDS.md) for workflow changes
4. **Mark outdated files** as deprecated if they become obsolete

## 🏷️ Documentation Categories

### Architecture & Setup
- AGENTS.md, README.md, STRUCTURE.md, MONOREPO_GUIDE.md

### Development Workflow
- AI_UPDATE_WORKFLOW.md, WORKSPACE_COMMANDS.md, MIGRATION_GUIDE.md

### Platform-Specific
- Mobile: MOBILE_*.md files
- Web: apps/web/README.md
- Database: supabase/RLS_OVERVIEW.md

### Project Management
- BACKLOG.md, AUDIT.md, PAGE_LAYOUTS.md

### Legacy/Deprecated
- instructions.md (marked as deprecated)

---

**📌 Quick Tip**: When in doubt, start with `AGENTS.md` for AI contributors or `README.md` for human contributors. These files provide complete context and link to relevant specialized documentation.