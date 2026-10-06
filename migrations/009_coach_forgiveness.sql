-- How forgiving the coach is, 1–100. High = gentle, tiny steps, no pushing (the original behaviour).
-- Low = higher standards: holds you to what you said, bigger steps, more challenge. Never shame either way.
ALTER TABLE coach_settings ADD COLUMN forgiveness SMALLINT NOT NULL DEFAULT 80 CHECK (forgiveness BETWEEN 1 AND 100);
