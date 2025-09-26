# Supabase RLS & Permissions Overview

_Status: generated 2025-09-26 — keep this file in sync with new migrations and policy changes._

## Access Model
- Every domain table lives in the `public` schema with Row Level Security (RLS) enabled.
- Household membership drives authorization: policies usually join through `household_members` and check `auth.uid()`.
- Creator-only deletes exist on a few tables (`zones`, `entries`, `storage.objects`) to avoid cross-user content removal.
- Storage objects must live under a key prefixed by the uploader’s user ID to satisfy bucket policies.

## Tables

### `households`
| Operation | Who | Policy/Mechanism |
|-----------|-----|------------------|
| SELECT | Users with a membership (`household_members.user_id = auth.uid()`) | `Users can view households they belong to` |
| INSERT | Any authenticated user | `Users can create households` |
| UPDATE | _Not allowed (no policy)_ | — |
| DELETE | _Not allowed (no policy)_ | — |

Notes:
- Insert policy now has a permissive `WITH CHECK` because the RPC `create_household_with_owner` enforces authentication/validation before inserting and immediately enrolls the caller as owner in the same transaction.

### `household_members`
| Operation | Who | Policy/Mechanism |
|-----------|-----|------------------|
| SELECT | User can see their own membership rows | `Users can view their household memberships` |
| INSERT | User can join by inserting their own `user_id` | `Users can join a household` |
| UPDATE/DELETE | _Not allowed (no policy)_ | — |

### `zones`
| Operation | Who | Policy/Mechanism |
|-----------|-----|------------------|
| SELECT | Household members | `zones_select_members` |
| INSERT | Household members | `zones_insert_members` |
| UPDATE | Household members | `zones_update_members` |
| DELETE | Household members who created the zone (`created_by = auth.uid()`) | `zones_delete_owner_only` |

Notes:
- Column `created_by` is auto-filled by trigger `trg_zones_set_created_by`.
- Hierarchies are enforced via `(parent_id, household_id)` FK.

### `entries`
| Operation | Who | Policy/Mechanism |
|-----------|-----|------------------|
| SELECT | Household members | `Members can read entries of their household` |
| INSERT | Household members | `Members can insert entries into their household` |
| UPDATE | Household members | `Members can update entries of their household` |
| DELETE | Entry creator (`created_by = auth.uid()`) who is also a member | `entries_delete_owner_only` |

Notes:
- Trigger `update_entry_metadata` keeps `updated_at` and `updated_by` synchronized with `auth.uid()`.
- Client code generally uses the RPC `create_entry_with_zones` to insert entries atomically with zone links.

### `entry_zones`
| Operation | Who | Policy/Mechanism |
|-----------|-----|------------------|
| ALL | Household members tied to the entry | `Members can manage entry_zones of their household` |

Notes:
- AFTER DELETE/UPDATE triggers (`trg_enforce_entry_has_zone_after_delete`, `trg_enforce_entry_has_zone_after_update`) prevent entries from losing all zone links unless the entry itself is being deleted.

### `entry_files`
| Operation | Who | Policy/Mechanism |
|-----------|-----|------------------|
| SELECT | Household members | `Members can select entry_files of their household` |
| INSERT | Household members | `Members can insert entry_files in their household` |
| UPDATE | Household members | `Members can update entry_files of their household` |
| DELETE | Household members | `Members can delete entry_files of their household` |

Notes:
- Trigger `trg_entry_files_set_created_by` auto-populates `created_by = auth.uid()` so UI can enforce creator-only delete if desired.
- `ocr_text` and `metadata` are reserved for future OCR/enrichment pipelines.

### Template table: `todo_list`
| Operation | Who | Policy/Mechanism |
|-----------|-----|------------------|
| ALL | Record owner | Policy `Owner can do everything` (from template) |

Notes:
- Part of the upstream SaaS template; not used in House domain but still exposed through `/app/table`.

## Functions & RPCs
- `create_household_with_owner(p_name text)`
  - Runs as `SECURITY DEFINER` with `search_path = public`, checks `auth.uid()`, trims/validates the name, inserts the household, and immediately enrolls the caller as `owner`. This bypasses the insert-time RLS check while still enforcing authentication inside the function.
- `create_entry_with_zones(p_household_id uuid, p_raw_text text, p_zone_ids uuid[])`
  - Validates: user authenticated, member of household, and all zones belong to that household.
  - Inserts entry (`created_by = auth.uid()`) and related `entry_zones`, returns the new entry UUID.
- Triggers handle metadata (`update_entry_metadata`, `trg_zones_set_created_by`, `trg_entry_files_set_created_by`) and zone enforcement on join table.

## Storage (`storage.objects`)
All policies apply to bucket `files`:
| Operation | Who | Policy |
|-----------|-----|--------|
| SELECT | Authenticated users accessing their own prefix | `files_owner_select` |
| INSERT | Authenticated users uploading to `auth.uid()/…` | `files_owner_insert` |
| UPDATE | Authenticated users acting on their own prefix | `files_owner_update` |
| DELETE | Authenticated users acting on their own prefix | `files_owner_delete` |

Notes:
- Client code must store objects under `"${auth.uid()}/${entry_id}/${file}"` to satisfy regex `^<uid>/`.
- Signed URLs are used for sharing; no public access is granted by default.

## Keeping This File Current
When adding or modifying:
1. SQL migrations that create tables, policies, triggers, or functions.
2. Storage buckets/policies via Supabase CLI.
3. RPCs that guard permissions.

…ensure you update this document with the new behavior, including operation-level rows and any relevant notes.
