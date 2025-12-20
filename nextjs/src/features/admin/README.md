# Admin Feature

## Purpose
Household administration tools for owners/admins: member management, invitations, role assignment, audit logs.

## Key Concepts
- **Member Management**: Invite, remove, change roles
- **Invitations**: Email-based household invites
- **Roles**: Owner, admin, member permissions
- **Audit Logs**: Track who changed what

## Architecture

### Components
- `MemberList`: Display members with role badges
- `InviteForm`: Email invitation form
- `RoleSelector`: Change member roles
- `AuditLog`: Activity history

### Hooks
- `useMembers()`: Loads household members
- `useInvitations()`: Pending invites
- `useAuditLog()`: Activity history

### Types
- `HouseholdMember`: Member with role
- `Invitation`: Pending invite
- `AuditLogEntry`: Activity record

## Database Schema
- Table: `household_members`
  - Role field: `owner`, `admin`, `member`
- Table: `invitations` (future)
  - Email, token, expiration

## Import Aliases
- `@admin/components/*`
- `@admin/hooks/*`
- `@admin/types`

## Related Features
- `households`: Household management
- All features: Audit logging

## RLS & Security
- Only owners/admins can manage members
- Audit logs visible to all members

## Future Enhancements
- Role-based permissions (restrict features by role)
- Invitation expiration
- Activity notifications
