-- Add manual_code column to outpasses table
-- Must be 12-14 characters, uppercase alphanumeric only, unique

ALTER TABLE outpasses
  ADD COLUMN IF NOT EXISTS manual_code VARCHAR(16);
-- Enforce format (12 to 14 chars, uppercase A-Z and 0-9) when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_outpasses_manual_code_format'
  ) THEN
    ALTER TABLE outpasses
      ADD CONSTRAINT chk_outpasses_manual_code_format
      CHECK (manual_code IS NULL OR manual_code ~ '^[A-Z0-9]{12,14}$');
  END IF;
END $$;
-- Create unique index on manual_code when not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_outpasses_manual_code_unique
  ON outpasses (manual_code)
  WHERE manual_code IS NOT NULL;
