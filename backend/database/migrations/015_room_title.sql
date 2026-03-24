-- Add dedicated title column to room table.
-- Previously the display title was concatenated into the objective field.
-- Now title holds the short display name and objective holds the description.
ALTER TABLE room ADD COLUMN IF NOT EXISTS title TEXT;
