-- 🌬️ Breathwork: practice sessions (with breath-hold times and a before/after "how busy is your head" rating)
-- and a one-time safety check that unlocks the intense practices.
CREATE TABLE IF NOT EXISTS breathwork_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  practice    TEXT NOT NULL,
  seconds     INTEGER NOT NULL DEFAULT 0,
  rounds      JSONB NOT NULL DEFAULT '[]',     -- breath-hold seconds per round (power breathing)
  before      SMALLINT,                        -- 1 (racing) … 5 (quiet)
  after       SMALLINT,
  eased_off   BOOLEAN NOT NULL DEFAULT FALSE,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS breathwork_sessions_user ON breathwork_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS breathwork_safety (
  user_id      UUID PRIMARY KEY REFERENCES users(id),
  answers      JSONB NOT NULL DEFAULT '{}',
  cleared      BOOLEAN NOT NULL DEFAULT FALSE,   -- may use the intense practices
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
