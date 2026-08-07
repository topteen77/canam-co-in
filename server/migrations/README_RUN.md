# How to run DB migrations

Run these **from the project root** (the folder that contains `server/` and `App.tsx`), with MySQL running and **`.env`** set (in project root or `server/.env`) with `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

---

## Option A: Node scripts (recommended)

Open a terminal and **cd to the project root**:

```bash
cd "c:\Users\ADMIN\Agent follow up crm"
```

Then run:

### 1. Create database and run 001 (tables)

```bash
node server/scripts/run-mysql-migration.js
```

- Creates the database if it doesn’t exist.
- Runs `001_firestore_collections_to_mysql.sql` (creates/updates tables).
- Uses `DB_NAME` from `.env` (e.g. `iapply_crm`).  
- Optional: `node server/scripts/run-mysql-migration.js --fresh` will **drop and recreate** the database (destructive).

### 2. Run 002 (add numeric `id` as primary key)

Only if your tables still use `firebase_id` as primary key and you want to switch to numeric `id`:

```bash
node server/scripts/002_primary_key_id.js
```

- Adds `id` INT AUTO_INCREMENT as primary key where needed.
- Keeps `firebase_id` for legacy; services already support both.

---

## Option B: MySQL CLI

From any terminal (MySQL client in PATH):

```bash
mysql -u root -p
```

Then in MySQL:

```sql
CREATE DATABASE IF NOT EXISTS iapply_crm;
USE iapply_crm;
SOURCE c:/Users/ADMIN/Agent follow up crm/server/migrations/001_firestore_collections_to_mysql.sql;
SOURCE c:/Users/ADMIN/Agent follow up crm/server/migrations/002_primary_key_id.sql;
```

Or one-liner (replace password and path):

```bash
mysql -u root -p iapply_crm < "c:\Users\ADMIN\Agent follow up crm\server\migrations\001_firestore_collections_to_mysql.sql"
mysql -u root -p iapply_crm < "c:\Users\ADMIN\Agent follow up crm\server\migrations\002_primary_key_id.sql"
```

---

## Where to run

| What              | Where to run        |
|-------------------|---------------------|
| Node migration    | **Project root**    |
| MySQL `SOURCE`    | Paths as above      |

The Node scripts read `.env` from **project root** or **`server/.env`** (they check both).
