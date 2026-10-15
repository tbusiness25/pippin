-- Monitoring log: scores a parent takes from an official questionnaire (filled in on paper or the official PDF).
-- Pippin stores the number and the date only — it doesn't reproduce the questionnaire.
CREATE TABLE IF NOT EXISTS kid_monitor (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES users(id),
  day         DATE NOT NULL,
  measure     TEXT NOT NULL,
  score       NUMERIC(6,1) NOT NULL,
  source      TEXT NOT NULL DEFAULT 'parent',   -- parent | teacher
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS kid_monitor_child ON kid_monitor(child_id, measure, day);
