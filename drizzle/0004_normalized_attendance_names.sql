ALTER TABLE attendances ADD COLUMN normalized_full_name TEXT NOT NULL DEFAULT '';
UPDATE attendances SET normalized_full_name = lower(trim(full_name));
DROP INDEX IF EXISTS attendances_no_duplicates;
