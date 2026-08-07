-- Optional: add a dedicated `password` column to Users if your dump only has customPassword/defaultPassword.
-- Run: mysql -u root -p iapply_crm < server/migrations/003_add_password_column_to_users.sql
-- The app already uses customPassword or defaultPassword when present, so this is only if you want a dedicated column.
-- If you get "Duplicate column name 'password'", the column already exists; ignore.

ALTER TABLE Users ADD COLUMN password TEXT NULL;
