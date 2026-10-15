-- Family (adult) features: shared household calendar, the parenting course, daily briefings,
-- the daily link digest and the no-politics Reddit reader. All adult-only; children never see these.
-- TIMESTAMPTZ everywhere, soft delete where people delete things.

-- ---------- Shared household calendar (every adult sees and edits it) ----------
CREATE TABLE IF NOT EXISTS family_calendar_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  starts_on   DATE NOT NULL,
  ends_on     DATE,
  all_day     BOOLEAN NOT NULL DEFAULT TRUE,
  start_time  TEXT,                         -- 'HH:MM' local, NULL when all day
  end_time    TEXT,
  notes       TEXT,
  created_by  UUID REFERENCES users(id),
  source      TEXT NOT NULL DEFAULT 'manual', -- manual | wishlist | (future) google …
  external_id TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS family_calendar_events_day ON family_calendar_events (starts_on) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS family_calendar_events_ext ON family_calendar_events (source, external_id)
  WHERE external_id IS NOT NULL AND deleted_at IS NULL;

-- ---------- Parenting course: what each adult has done with it (content is static) ----------
CREATE TABLE IF NOT EXISTS family_course_progress (
  user_id     UUID NOT NULL REFERENCES users(id),
  session_key TEXT NOT NULL,
  block_key   TEXT NOT NULL,
  state       TEXT NOT NULL DEFAULT 'done',   -- done | skipped
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, session_key, block_key)
);
CREATE TABLE IF NOT EXISTS family_course_answers (
  user_id    UUID NOT NULL REFERENCES users(id),
  item_key   TEXT NOT NULL,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_key)
);
CREATE TABLE IF NOT EXISTS family_course_practice (
  user_id    UUID NOT NULL REFERENCES users(id),
  log_date   DATE NOT NULL,
  item_key   TEXT NOT NULL,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, log_date, item_key)
);
CREATE INDEX IF NOT EXISTS family_course_practice_day ON family_course_practice (user_id, log_date DESC);

-- ---------- Daily briefing (one per person per day) ----------
CREATE TABLE IF NOT EXISTS family_briefings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  brief_date DATE NOT NULL,
  content    TEXT NOT NULL,
  data       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, brief_date)
);

-- ---------- Daily link digest (written by an external workflow through /hooks) ----------
CREATE TABLE IF NOT EXISTS family_digests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  digest_date       DATE NOT NULL,
  picks             JSONB NOT NULL,
  rendered_telegram TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, digest_date)
);
CREATE TABLE IF NOT EXISTS family_digest_seen (
  user_id       UUID NOT NULL REFERENCES users(id),
  url           TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, url)
);

-- ---------- Reddit reader: a shared, self-pruning cache (blocked posts are never stored) ----------
CREATE TABLE IF NOT EXISTS family_reddit_posts (
  id           TEXT PRIMARY KEY,
  subreddit    TEXT NOT NULL,
  title        TEXT NOT NULL,
  author       TEXT,
  permalink    TEXT,
  url          TEXT,
  selftext     TEXT,
  thumb        TEXT,
  preview_img  TEXT,
  score        INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  is_self      BOOLEAN DEFAULT FALSE,
  is_video     BOOLEAN DEFAULT FALSE,
  post_hint    TEXT,
  over_18      BOOLEAN DEFAULT FALSE,
  flair        TEXT,
  created_utc  TIMESTAMPTZ,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS family_reddit_posts_sub ON family_reddit_posts (subreddit);
CREATE INDEX IF NOT EXISTS family_reddit_posts_created ON family_reddit_posts (created_utc DESC);
CREATE INDEX IF NOT EXISTS family_reddit_posts_score ON family_reddit_posts (score DESC);
CREATE TABLE IF NOT EXISTS family_reddit_comments (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL,
  parent_id   TEXT,
  author      TEXT,
  body        TEXT,
  score       INTEGER DEFAULT 0,
  depth       INTEGER DEFAULT 0,
  created_utc TIMESTAMPTZ,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS family_reddit_comments_post ON family_reddit_comments (post_id, depth, score DESC);
CREATE TABLE IF NOT EXISTS family_reddit_comment_fetch (
  post_id    TEXT PRIMARY KEY,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
