-- ✅ My jobs (responsibilities) + 📅 weekly plan + 🎧 Yoto link and uploads.

-- A child's jobs. slot: morning | after_school | bedtime | weekly. days: daily | school | weekend.
CREATE TABLE IF NOT EXISTS kid_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       UUID NOT NULL REFERENCES users(id),
  title          TEXT NOT NULL,
  detail         TEXT,
  icon           TEXT NOT NULL DEFAULT '✅',
  slot           TEXT NOT NULL DEFAULT 'morning',
  days           TEXT NOT NULL DEFAULT 'daily',
  timer_secs     INTEGER,
  sort           INTEGER NOT NULL DEFAULT 0,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  parent_edited  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS kid_jobs_child ON kid_jobs(child_id, slot, sort);

-- Ticked off on a given day.
CREATE TABLE IF NOT EXISTS kid_job_done (
  child_id   UUID NOT NULL REFERENCES users(id),
  job_id     UUID NOT NULL REFERENCES kid_jobs(id),
  day        DATE NOT NULL,
  done_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (child_id, job_id, day)
);

-- The plan: one activity per slot per day. slot: after_school | weekend_am | weekend_pm.
CREATE TABLE IF NOT EXISTS kid_plan (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   UUID NOT NULL REFERENCES users(id),
  day        DATE NOT NULL,
  slot       TEXT NOT NULL,
  activity   TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'Other',
  source     TEXT NOT NULL DEFAULT 'bank',
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (child_id, day, slot)
);

-- Ideas the child adds to the picker.
CREATE TABLE IF NOT EXISTS kid_plan_ideas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   UUID NOT NULL REFERENCES users(id),
  text       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'Other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

-- The household's Yoto connection (one row). Refresh tokens rotate on every use, so only this server holds it.
CREATE TABLE IF NOT EXISTS yoto_link (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  refresh_enc TEXT NOT NULL,
  linked_by   UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A recording/file being turned into a Yoto track, then used in a card.
CREATE TABLE IF NOT EXISTS yoto_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES users(id),
  title       TEXT,
  status      TEXT NOT NULL DEFAULT 'uploading',   -- uploading | ready | failed | used
  upload_id   TEXT,
  sha         TEXT,
  info        JSONB,
  error       TEXT,
  card_id     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
