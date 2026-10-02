-- Phase 2 (tools, shop, home, insights, nudges) + Phase 3 (people, companions, events).

-- ---------- shop / home ----------
CREATE TABLE inventory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  item_id     TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'shop',     -- shop | gift | journey | event | milestone
  gift_from   UUID REFERENCES users(id),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX inventory_user ON inventory(user_id);
ALTER TABLE pets ADD COLUMN home JSONB NOT NULL DEFAULT '{}'::jsonb;   -- {slot: item_id}

-- ---------- self-care tools ----------
CREATE TABLE tool_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL,                     -- breathing | sound | focus | stretch
  detail     TEXT,
  seconds    INT NOT NULL DEFAULT 0,
  day        DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX tool_sessions_user_day ON tool_sessions(user_id, day);

CREATE TABLE reflections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  prompt     TEXT,
  body       TEXT NOT NULL,
  tags       TEXT[] NOT NULL DEFAULT '{}',
  day        DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX reflections_user ON reflections(user_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE quiz_results (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  quiz       TEXT NOT NULL,
  score      INT NOT NULL,
  answers    INT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE daily_answers (
  user_id     UUID NOT NULL REFERENCES users(id),
  day         DATE NOT NULL,
  question    INT NOT NULL,
  answer      INT NOT NULL,                     -- 0 or 1
  PRIMARY KEY (user_id, day)
);

-- Weekly category milestones: goals in one category on N distinct days of a week.
CREATE TABLE milestones (
  user_id    UUID NOT NULL REFERENCES users(id),
  week_start DATE NOT NULL,
  category   TEXT NOT NULL,
  level      INT NOT NULL,                      -- 3, 5 or 7 days
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week_start, category, level)
);

CREATE TABLE journeys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  journey     TEXT NOT NULL,
  started_on  DATE NOT NULL,
  step        INT NOT NULL DEFAULT 0,            -- index of the next day to hand out
  last_issued DATE,
  finished_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ
);

-- ---------- nudges ----------
CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  endpoint   TEXT NOT NULL UNIQUE,
  keys       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE push_sent (
  user_id UUID NOT NULL REFERENCES users(id),
  kind    TEXT NOT NULL,
  ref     TEXT NOT NULL,                        -- day or adventure id: never send the same nudge twice
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, kind, ref)
);
CREATE TABLE app_secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- ---------- people ----------
ALTER TABLE users ADD COLUMN friend_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN is_owner BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
UPDATE users SET is_owner = true WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1);

CREATE TABLE friendships (
  user_a     UUID NOT NULL REFERENCES users(id),
  user_b     UUID NOT NULL REFERENCES users(id),
  points     INT NOT NULL DEFAULT 0,             -- friendship grows with kind words
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at   TIMESTAMPTZ,
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE TABLE kindnesses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user  UUID NOT NULL REFERENCES users(id),
  to_user    UUID NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL,
  day        DATE NOT NULL,
  seen_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX kindnesses_to ON kindnesses(to_user, created_at DESC);

-- Shared goal = one goal row per member, linked by shared_id.
ALTER TABLE goals ADD COLUMN shared_id UUID;
ALTER TABLE goals ADD COLUMN journey_id UUID;
CREATE INDEX goals_shared ON goals(shared_id) WHERE shared_id IS NOT NULL;

-- ---------- collection / events ----------
CREATE TABLE companions (
  user_id     UUID NOT NULL REFERENCES users(id),
  companion   TEXT NOT NULL,
  source      TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, companion)
);
CREATE TABLE event_tokens (
  user_id UUID NOT NULL REFERENCES users(id),
  event   TEXT NOT NULL,
  tokens  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, event)
);
