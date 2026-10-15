-- Media & learning for the family: an audio library (any person — a child's stories or an adult's podcasts),
-- "make me a story" requests, the daily morning paper, Learn modules, a collectables dex, nothing else.
-- Soft delete only: rows get removed_at / rejected_at, never DELETE.

-- Audio library. audio_path keeps the old '/static/audio/<sub>/<file>' (or '<sub>/<file>') form and is
-- resolved under that person's library folder (LIBRARY_DIR/<user_id>/…). New items wait for approval
-- unless whoever adds them approves them (story worker, a parent).
CREATE TABLE library_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  kind            TEXT NOT NULL,                       -- podcast | story | newspaper | article_podcast | …
  title           TEXT NOT NULL,
  transcript      TEXT,
  audio_path      TEXT,
  duration_s      INTEGER,
  generated_by    TEXT,
  source_url      TEXT,
  source_picks    JSONB,
  audio_status    TEXT NOT NULL DEFAULT 'pending',     -- pending | ready | failed
  approved        BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at     TIMESTAMPTZ,
  approved_by     UUID REFERENCES users(id),
  rejected_at     TIMESTAMPTZ,
  rejected_reason TEXT,
  last_played_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at      TIMESTAMPTZ
);
CREATE INDEX library_item_user_idx ON library_item(user_id, approved, created_at DESC);

-- "Make me a story": the row is the whole state machine; a worker claims it through /hooks.
CREATE TABLE kid_story_request (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        UUID NOT NULL REFERENCES users(id),
  theme           TEXT NOT NULL,
  characters      TEXT[] NOT NULL DEFAULT '{}',
  setting         TEXT NOT NULL,
  plot            TEXT NOT NULL,
  length_min      INTEGER NOT NULL DEFAULT 10,
  extra           TEXT,
  source          TEXT NOT NULL DEFAULT 'child',        -- child | nightly | parent
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','working','ready','failed','cancelled')),
  title           TEXT,
  transcript      TEXT,
  library_item_id UUID REFERENCES library_item(id),
  yoto_card_id    TEXT,
  duration_s      INTEGER,
  error           TEXT,
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX kid_story_request_child_idx ON kid_story_request(child_id, created_at DESC);
CREATE INDEX kid_story_request_status_idx ON kid_story_request(status, created_at);
-- One story in flight per child: a seven-year-old pressing the button five times gets one story.
CREATE UNIQUE INDEX kid_story_request_one_active ON kid_story_request(child_id) WHERE status IN ('queued','working');

-- The morning paper (written by an automation each morning).
CREATE TABLE kid_morning_paper (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES users(id),
  paper_date  DATE NOT NULL,
  content     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (child_id, paper_date)
);

-- Learn: a shared catalogue. Drafts (pending_review) are never shown to a child.
CREATE TABLE kid_learn_module (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT NOT NULL UNIQUE,
  topic              TEXT NOT NULL,
  title              TEXT NOT NULL,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  body               JSONB NOT NULL,
  illustration_path  TEXT,
  audio_path         TEXT,
  audio_status       TEXT NOT NULL DEFAULT 'none',
  published          BOOLEAN NOT NULL DEFAULT FALSE,
  review_status      TEXT NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending_review','approved','rejected')),
  draft_source       TEXT,
  draft_topic_prompt TEXT,
  reviewed_by        UUID REFERENCES users(id),
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at         TIMESTAMPTZ
);
CREATE INDEX kid_learn_module_topic_idx ON kid_learn_module(topic, sort_order);
CREATE INDEX kid_learn_module_review_idx ON kid_learn_module(review_status);

CREATE TABLE kid_learn_progress (
  child_id     UUID NOT NULL REFERENCES users(id),
  module_id    UUID NOT NULL REFERENCES kid_learn_module(id),
  explored_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (child_id, module_id)
);

-- Pocket money paid for finishing a module: once per child per module, ever.
CREATE TABLE kid_learn_reward (
  child_id    UUID NOT NULL REFERENCES users(id),
  module_id   UUID NOT NULL REFERENCES kid_learn_module(id),
  pence       INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (child_id, module_id)
);

-- A collectables dex (catalogue loaded from KIDS_DATA_DIR/pokedex/catalogue.json at startup) + favourites.
CREATE TABLE kid_pokedex (
  num           INTEGER PRIMARY KEY,
  national_num  INTEGER,
  name          TEXT NOT NULL,
  types         JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation    INTEGER NOT NULL DEFAULT 0,
  is_legendary  BOOLEAN NOT NULL DEFAULT FALSE,
  habitat       TEXT,
  form_note     TEXT,
  sprite        TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kid_pokedex_favourite (
  child_id    UUID NOT NULL REFERENCES users(id),
  num         INTEGER NOT NULL REFERENCES kid_pokedex(num),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at  TIMESTAMPTZ,
  PRIMARY KEY (child_id, num)
);
