-- Phase 4: the private ADHD coach. Sensitive text (coach chat, intake profile) is AES-256-GCM
-- encrypted by the app before it reaches the database (see src/coach/crypto.js).

CREATE TABLE coach_messages (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  role        TEXT NOT NULL,                 -- user | assistant | event
  body_enc    TEXT NOT NULL,                 -- encrypted
  flow        TEXT,                          -- morning | evening | weekly | stuck | thought | hard | welcome | intake | chat
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX coach_messages_user ON coach_messages(user_id, id DESC);

CREATE TABLE coach_profile (
  user_id     UUID PRIMARY KEY REFERENCES users(id),
  data_enc    TEXT NOT NULL,                 -- encrypted JSON: goals, values, strengths, struggles, routines, support people
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Capture inbox: one list for everything ("Safren: one capture list + calendar").
CREATE TABLE inbox_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  text        TEXT NOT NULL,
  due_on      DATE,
  status      TEXT NOT NULL DEFAULT 'open',  -- open | done | dropped | scheduled
  goal_id     UUID REFERENCES goals(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ
);
CREATE INDEX inbox_user ON inbox_items(user_id, status);

-- If-then plans (implementation intentions) with a barrier plan. Nudged at their time.
CREATE TABLE commitments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  what        TEXT NOT NULL,                 -- the first tiny step
  when_text   TEXT,                          -- "after the school run", "14:00"
  due_at      TIMESTAMPTZ,                   -- for a nudge, if a clock time was given
  barrier     TEXT,                          -- "if X gets in the way…"
  backup      TEXT,                          -- "…then I'll Y"
  status      TEXT NOT NULL DEFAULT 'open',  -- open | done | missed | dropped
  source      TEXT NOT NULL DEFAULT 'coach',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ,
  nudged_at   TIMESTAMPTZ
);
CREATE INDEX commitments_user ON commitments(user_id, status);

-- People: the person's own relationships. Metadata only — never message bodies,
-- never inferred moods or traits about third parties.
CREATE TABLE people (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  ring          TEXT NOT NULL DEFAULT 'friends',   -- closest (≈5) | close (≈15) | friends (≈50) | wider
  cadence_days  INT,                               -- how often they'd like to be in touch (null = no reminders)
  birthday      TEXT,                              -- 'MM-DD'
  notes         TEXT,                              -- the person's OWN notes (kids' names, what they're up to)
  last_sent_at      TIMESTAMPTZ,
  last_received_at  TIMESTAMPTZ,
  snoozed_until DATE,
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX people_user ON people(user_id) WHERE archived_at IS NULL;

CREATE TABLE person_handles (
  user_id   UUID NOT NULL REFERENCES users(id),   -- two household members can both know the same person
  person_id UUID NOT NULL REFERENCES people(id),
  kind      TEXT NOT NULL,                 -- whatsapp | facebook
  handle    TEXT NOT NULL,                 -- WhatsApp number/lid user part, or Facebook display name
  PRIMARY KEY (user_id, kind, handle)
);

-- Per-day contact counts, by handle (so history survives linking/unlinking a person).
CREATE TABLE contact_days (
  user_id  UUID NOT NULL REFERENCES users(id),
  kind     TEXT NOT NULL,
  handle   TEXT NOT NULL,
  day      DATE NOT NULL,
  sent     INT NOT NULL DEFAULT 0,
  received INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind, handle, day)
);
-- Display names seen for handles (WhatsApp push names, Facebook names) to help linking.
CREATE TABLE handle_names (
  user_id UUID NOT NULL REFERENCES users(id),
  kind    TEXT NOT NULL,
  handle  TEXT NOT NULL,
  display TEXT,
  PRIMARY KEY (user_id, kind, handle)
);

-- Things the coach proposes to remember. Only APPROVED ones are written to the vault.
CREATE TABLE memories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL DEFAULT 'note',  -- note | insight | win | weekly
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'proposed', -- proposed | approved | rejected
  vault_path  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at  TIMESTAMPTZ
);

CREATE TABLE weekly_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  week_start  DATE NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

-- Crisis screen hits: level and time only — never the text.
CREATE TABLE crisis_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id),
  level      TEXT NOT NULL,                 -- high | concern
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
