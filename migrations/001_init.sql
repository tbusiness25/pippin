-- Pippin — core schema. All timestamps TIMESTAMPTZ; soft delete only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL DEFAULT 'Friend',
  pin_hash     TEXT NOT NULL,
  tz           TEXT NOT NULL DEFAULT 'Europe/London',
  settings     JSONB NOT NULL DEFAULT '{}'::jsonb,   -- streaks_enabled, streak_level, paused, …
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One companion per user (a "sprig").
CREATE TABLE pets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  pronouns        TEXT NOT NULL DEFAULT 'they/them',
  colour          TEXT NOT NULL DEFAULT 'moss',
  traits          TEXT[] NOT NULL DEFAULT '{}',
  energy          INT  NOT NULL DEFAULT 0,          -- toward the next adventure
  energy_day      DATE,                              -- energy resets each local day
  adventures      INT  NOT NULL DEFAULT 0,          -- completed adventures → growth
  acorns          INT  NOT NULL DEFAULT 0,
  equipped        JSONB NOT NULL DEFAULT '{}'::jsonb,
  hatched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX pets_one_per_user ON pets(user_id) WHERE deleted_at IS NULL;

CREATE TABLE goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  days        INT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',  -- 0=Sun … 6=Sat; empty + once_on = one-off
  once_on     DATE,                                       -- one-off goal for a single day
  steps       JSONB NOT NULL DEFAULT '[]'::jsonb,          -- [{text, done}] tiny steps
  why         TEXT,                                        -- why the coach suggested it
  source      TEXT NOT NULL DEFAULT 'manual',              -- manual | coach | suggestion
  source_ref  TEXT,
  sort        INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX goals_user ON goals(user_id) WHERE deleted_at IS NULL;

CREATE TABLE goal_completions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      UUID NOT NULL REFERENCES goals(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  day          DATE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  undone       BOOLEAN NOT NULL DEFAULT false,   -- un-ticked; row kept so energy is only ever given once
  UNIQUE (goal_id, day)
);

CREATE TABLE checkins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL,             -- morning | evening | moment
  day         DATE NOT NULL,
  mood        INT,                       -- 1..5
  energy      INT,                       -- 1..5 (how much the person has, not the pet)
  emotions    TEXT[] NOT NULL DEFAULT '{}',
  note        TEXT,
  gratitude   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX checkins_user_day ON checkins(user_id, day);

CREATE TABLE adventures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id      UUID NOT NULL REFERENCES pets(id),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at     TIMESTAMPTZ NOT NULL,
  place       TEXT NOT NULL,
  returned_at TIMESTAMPTZ,              -- set when the person has seen the return
  story       JSONB,                    -- {title, story, discovery, question}
  acorns      INT
);
CREATE INDEX adventures_pet ON adventures(pet_id, started_at DESC);

-- Coach chat history (kept so the brain can be given recent context).
CREATE TABLE messages (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  role        TEXT NOT NULL,            -- user | assistant
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coach day plans (one per ask), so a plan survives reloads.
CREATE TABLE plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  day         DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | ready | failed
  summary     TEXT,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Streak bookkeeping: repairs and pauses are explicit so the streak is always explainable.
CREATE TABLE streak_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL,            -- repair | pause | resume
  day         DATE NOT NULL,            -- repaired day, or pause/resume date
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE acorn_ledger (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  delta       INT NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
