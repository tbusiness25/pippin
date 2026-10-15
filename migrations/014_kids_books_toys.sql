-- Kids: Books (bookshelf + Book Chat reviews) and Toys (catalogue + rated wishlist + weekly browsing note).
-- Shared catalogues have no child_id; everything a child does is per child. Soft delete only.

-- ---------- Books ----------
-- The shared book list, seeded from a JSON catalogue in the data dir (src/kids/books.js). The loader only
-- refreshes catalogue columns of seed rows a parent hasn't edited. A book a child or parent adds is
-- `added_for` that child (NULL = on everyone's shelf).
CREATE TABLE kid_books (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  author         TEXT,
  series         TEXT,
  series_num     INTEGER,
  kind           TEXT NOT NULL DEFAULT 'standalone',      -- main | special | activity | standalone
  shelf_group    TEXT NOT NULL DEFAULT 'More great reads',
  sort_order     INTEGER NOT NULL DEFAULT 100000,         -- position in the seed file (orders the shelves)
  year           INTEGER,
  isbn           TEXT,
  ol_work        TEXT,
  cover_file     TEXT,                                    -- file in <data>/books/covers
  age_band       TEXT,
  source         TEXT,
  verified       BOOLEAN NOT NULL DEFAULT FALSE,
  note           TEXT,
  origin         TEXT NOT NULL DEFAULT 'seed',            -- seed | parent | child
  added_for      UUID REFERENCES users(id),
  parent_edited  BOOLEAN NOT NULL DEFAULT FALSE,
  removed_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX kid_books_group ON kid_books (shelf_group, series_num, title) WHERE removed_at IS NULL;

-- One row per (child, book) once anything is set. No row = not read, owned unknown, visible.
CREATE TABLE kid_book_status (
  child_id    UUID NOT NULL REFERENCES users(id),
  book_id     UUID NOT NULL REFERENCES kid_books(id),
  status      TEXT NOT NULL DEFAULT 'not_read' CHECK (status IN ('not_read', 'reading', 'finished')),
  started_on  DATE,
  finished_on DATE,
  status_by   TEXT,                                       -- child | parent
  owned       BOOLEAN,                                    -- NULL = don't know yet
  hidden_at   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (child_id, book_id)
);
CREATE INDEX kid_book_status_child ON kid_book_status (child_id, status);

-- Book Chat: one live review per (child, book). answers = [{slug, question, text, voice_id}].
CREATE TABLE kid_book_reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       UUID NOT NULL REFERENCES users(id),
  book_id        UUID NOT NULL REFERENCES kid_books(id),
  score          SMALLINT CHECK (score BETWEEN 1 AND 7),
  liked          TEXT,
  disliked       TEXT,
  liked_voice    UUID,
  disliked_voice UUID,
  answers        JSONB NOT NULL DEFAULT '[]'::jsonb,
  buddy_reply    TEXT,
  buddy_flag     TEXT,
  buddy_at       TIMESTAMPTZ,
  stars_awarded  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX kid_book_reviews_one_live ON kid_book_reviews (child_id, book_id) WHERE removed_at IS NULL;

-- Voice notes recorded for a Book Chat. Kept on purpose (a child's voice is worth keeping).
CREATE TABLE kid_book_voice (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     UUID NOT NULL REFERENCES users(id),
  book_id      UUID NOT NULL REFERENCES kid_books(id),
  field        TEXT NOT NULL,                             -- liked | disliked | q:<slug>
  file         TEXT NOT NULL,                             -- in <data>/<childId>/books/
  mime         TEXT,
  bytes        INTEGER,
  duration_sec INTEGER,
  transcript   TEXT,
  vault_note   TEXT,                                      -- the Markdown note written to the voice-notes folder, if any
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at   TIMESTAMPTZ
);
CREATE INDEX kid_book_voice_book ON kid_book_voice (child_id, book_id) WHERE removed_at IS NULL;

-- History: status / owned / review / edit / add / hide changes.
CREATE TABLE kid_book_events (
  id          BIGSERIAL PRIMARY KEY,
  child_id    UUID REFERENCES users(id),
  book_id     UUID NOT NULL REFERENCES kid_books(id),
  kind        TEXT NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  by          TEXT NOT NULL,                              -- child | parent | seed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX kid_book_events_book ON kid_book_events (child_id, book_id, created_at);

-- ---------- Toys ----------
-- Shared catalogue, imported through /hooks/:slug/api/parent/toys/import (sections + age band filtered).
CREATE TABLE kid_toy_catalogue (
  sku          TEXT PRIMARY KEY,                          -- retailer-prefixed product code
  name         TEXT NOT NULL,
  brand        TEXT,
  section      TEXT NOT NULL,
  category     TEXT,
  price_pence  INTEGER,
  image_url    TEXT,
  image_local  TEXT,                                      -- file name in <data>/toys once cached
  product_url  TEXT NOT NULL,
  age_label    TEXT,
  age_min      INTEGER,
  age_max      INTEGER,
  description  TEXT,
  source       TEXT NOT NULL DEFAULT 'other',             -- retailer, e.g. argos | smyths
  active       BOOLEAN NOT NULL DEFAULT TRUE,             -- FALSE once it drops out of a full import
  imported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX kid_toy_catalogue_active ON kid_toy_catalogue (category, name) WHERE active;

CREATE TABLE kid_toy_wishlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES users(id),
  sku         TEXT NOT NULL REFERENCES kid_toy_catalogue(sku),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 10),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX kid_toy_wishlist_one_active ON kid_toy_wishlist (child_id, sku) WHERE removed_at IS NULL;

-- Browse log: open | view | dwell | search | category | add | rate | remove. Write-only from the child side.
CREATE TABLE kid_toy_events (
  id          BIGSERIAL PRIMARY KEY,
  child_id    UUID NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL,
  sku         TEXT,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX kid_toy_events_time ON kid_toy_events (child_id, created_at);

-- One row per child per Monday-starting week (child's time zone); the narrative is cached here.
CREATE TABLE kid_toy_weekly (
  child_id      UUID NOT NULL REFERENCES users(id),
  week_start    DATE NOT NULL,
  stats         JSONB NOT NULL,
  narrative     TEXT,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (child_id, week_start)
);
