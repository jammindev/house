# User Settings Feature

## Purpose
User profile management, locale selection, password changes, MFA enrollment.

## Key Concepts
- **Profile**: Name, email, locale
- **MFA**: TOTP enrollment and management
- **Locale**: Language preference (en/fr)

## Architecture

### Components
- `UserSettingsForm`: Profile editor
- `MFASetup`: TOTP enrollment with QR code
- `LocaleSelector`: Language picker

### Hooks
- `useUserProfile()`: Loads current user data

## Database Schema
- Supabase Auth: `auth.users` (read-only)
- Table: `profiles` (optional user metadata)

## Import Aliases
- `@user-settings/components/*`
- `@user-settings/hooks/*`

## Routes
- `/app/user-settings` - Settings page
- `/auth/2fa` - MFA challenge

## Related Features
- `i18n`: Locale management
