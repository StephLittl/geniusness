-- Migration: Redesign league types
-- New structure:
-- 1. tracking: Infinite, no winners/losers, just tracking
-- 2. periodic: Infinite with periodic resets (weekly, monthly, yearly, custom)
-- 3. dated: Specific dates, non-repeating

-- Step 1: Add new columns
ALTER TABLE league 
ADD COLUMN IF NOT EXISTS league_type text DEFAULT 'tracking' 
  CHECK (league_type IN ('tracking', 'periodic', 'dated'));

ALTER TABLE league
ADD COLUMN IF NOT EXISTS reset_period text 
  CHECK (reset_period IN ('weekly', 'monthly', 'yearly', 'custom') OR reset_period IS NULL);

ALTER TABLE league
ADD COLUMN IF NOT EXISTS custom_period_days integer 
  CHECK (custom_period_days IS NULL OR custom_period_days > 0);

-- Step 2: Migrate existing data
-- Convert old duration_type to new league_type
UPDATE league 
SET league_type = CASE
  WHEN duration_type = 'indefinite' AND is_repeating = false THEN 'tracking'
  WHEN duration_type IN ('weekly', 'monthly', 'yearly') AND is_repeating = true THEN 'periodic'
  WHEN duration_type = 'specific' THEN 'dated'
  ELSE 'tracking' -- default fallback
END,
reset_period = CASE
  WHEN duration_type IN ('weekly', 'monthly', 'yearly') AND is_repeating = true 
    THEN duration_type
  ELSE NULL
END
WHERE league_type IS NULL;

-- Step 3: Make league_type NOT NULL after migration
ALTER TABLE league 
ALTER COLUMN league_type SET NOT NULL;

-- Step 4: Update constraints
-- For periodic leagues, reset_period should be set
-- For dated leagues, start_date and end_date should be set
-- For tracking leagues, dates are optional

-- Step 5: Drop old columns (optional - comment out if you want to keep for reference)
-- ALTER TABLE league DROP COLUMN IF EXISTS duration_type;
-- ALTER TABLE league DROP COLUMN IF EXISTS is_repeating;

-- Note: We'll keep duration_type and is_repeating for now in case of rollback
-- You can drop them later once everything is verified
