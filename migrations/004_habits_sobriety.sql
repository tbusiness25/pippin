-- Phase 5: habit tracker + sobriety/addiction tracker.
-- Design: docs/research/reports/Habit and sobriety tracker design.md
-- Headline numbers never go down; a lapse is an event with a debrief, never a reset.

CREATE TABLE habits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,                 -- short name
  anchor          TEXT,                          -- "After I …"
  tiny            TEXT,                          -- "…I will <tiny version>"
  barrier         TEXT,                          -- "If <barrier> …"
  backup          TEXT,                          -- "…then <backup>"
  pair_with       TEXT,                          -- optional temptation bundle
  per_week        INT NOT NULL DEFAULT 4 CHECK (per_week BETWEEN 1 AND 7),
  remind_at       TEXT,                          -- 'HH:MM' local, optional
  remind_days     INT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  instead_for     UUID,                          -- tracker this is an "instead" behaviour for
  status          TEXT NOT NULL DEFAULT 'building',  -- building | parked | archived
  sort            INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX habits_user ON habits(user_id, status);

CREATE TABLE habit_logs (
  habit_id   UUID NOT NULL REFERENCES habits(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  day        DATE NOT NULL,
  status     TEXT NOT NULL,                      -- done | mini | skip (planned rest day, not a miss)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (habit_id, day)
);

-- One tracker per thing someone is quitting or cutting down (alcohol, nicotine, gambling, …).
CREATE TABLE trackers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  category      TEXT NOT NULL,                   -- see src/sober/categories.js
  label         TEXT NOT NULL,                   -- the person's own name for it ("My AF year")
  goal          TEXT NOT NULL DEFAULT 'quit',    -- quit | reduce
  start_date    DATE NOT NULL,
  target_days   INT NOT NULL DEFAULT 365,
  baseline      JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {per_week_spend, per_week_units, per_week_kcal, …}
  reasons       TEXT[] NOT NULL DEFAULT '{}',
  show_run      BOOLEAN NOT NULL DEFAULT false,  -- secondary "current run" counter, opt-in
  screening     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {auditc, audit, flags[], gate, acknowledged_at}
  discreet      BOOLEAN NOT NULL DEFAULT true,   -- never name it in notifications / on the home screen
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at   TIMESTAMPTZ
);

CREATE TABLE tracker_days (
  tracker_id UUID NOT NULL REFERENCES trackers(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  day        DATE NOT NULL,
  status     TEXT NOT NULL,                      -- free | lapse
  amount     NUMERIC,                            -- units / £ / cigarettes, optional
  pledged    BOOLEAN NOT NULL DEFAULT false,     -- morning pledge made
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tracker_id, day)
);
CREATE TABLE pledges (
  tracker_id UUID NOT NULL REFERENCES trackers(id),
  day        DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tracker_id, day)
);

CREATE TABLE urges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id  UUID NOT NULL REFERENCES trackers(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  before      INT,                               -- 0..10
  after       INT,
  triggers    TEXT[] NOT NULL DEFAULT '{}',      -- hungry, angry, lonely, tired, social, stress, bored, celebrating …
  outcome     TEXT,                              -- passed | lapsed | unsure
  note        TEXT
);

CREATE TABLE lapses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id    UUID NOT NULL REFERENCES trackers(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  day           DATE NOT NULL,
  amount        NUMERIC,
  situation     TEXT[] NOT NULL DEFAULT '{}',
  what_happened TEXT,
  next_24h      TEXT,
  next_time     TEXT,                            -- the if-then plan for next time
  commitment_id UUID REFERENCES commitments(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Known high-risk moments (a party, a work do, Friday nights) with a plan, refreshed before each.
CREATE TABLE risk_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id  UUID NOT NULL REFERENCES trackers(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  on_date     DATE,
  plan        TEXT,
  drink       TEXT,                              -- what I'll have instead
  exit        TEXT,                              -- when/how I'll leave
  script      TEXT,                              -- what I'll say if offered
  refreshed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE screenings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  tracker_id  UUID REFERENCES trackers(id),
  kind        TEXT NOT NULL,                     -- auditc | audit | withdrawal | confidence
  score       INT,
  answers     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Offline outbox dedupe: a queued request replayed twice must not double-count.
CREATE TABLE client_ops (
  user_id   UUID NOT NULL REFERENCES users(id),
  op_id     TEXT NOT NULL,
  at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, op_id)
);
