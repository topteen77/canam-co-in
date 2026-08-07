# Primary key: `id` instead of `firebase_id`

After moving from Firebase to MySQL, exported tables used `firebase_id` as the primary key. New records cannot use Firebase-style IDs, so we use a numeric **`id`** column as the primary key.

## Recommendation: use `id` (not `crm_user_id`)

- **`id`** – Standard name; every table has its own `id`. The frontend already uses `row.id ?? row.firebase_id`. Works for all entities (Leads, Attendance, Users, etc.).
- **`crm_user_id`** – Would only fit a Users table; other tables would need `crm_lead_id`, `crm_attendance_id`, etc.

## How to migrate

1. **Run the script** (from project root):
   ```bash
   node server/scripts/002_primary_key_id.js
   ```
   This, for each table that has `firebase_id` as PK:
   - Drops the primary key on `firebase_id`
   - Adds `id` INT AUTO_INCREMENT as the new primary key
   - Makes `firebase_id` nullable (new rows don’t need it)
   - Adds a UNIQUE index on `firebase_id` so legacy lookups still work

2. **Or run SQL manually** – See `002_primary_key_id.sql` and uncomment the blocks for the tables you need.

## After migration

- **Existing rows**: Keep their `firebase_id`; they get `id` = 1, 2, 3, …
- **New rows**: Get an auto-generated `id`; `firebase_id` can be NULL.
- **API**: Services return `id` (numeric when present). UPDATE/DELETE accept either numeric `id` or legacy `firebase_id` for backward compatibility.

## Services updated

- **attendanceService.js** – Uses `id` when the table has it; INSERT without `firebase_id`, UPDATE/DELETE by `id` or `firebase_id`.
- **leadsService.js** – Prefers `id` over `firebase_id` for SELECT/UPDATE/DELETE when both columns exist; `addLead` already returns `insertId`.

Other tables (MeetingCheckInRecords, CTAActivities, Documents, etc.) can follow the same pattern: run the script for them, then in the service prefer `id` for SELECT/INSERT/UPDATE/DELETE and support legacy `firebase_id` in WHERE when the client sends a string ID.
