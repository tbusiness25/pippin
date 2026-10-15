-- 💬 Messages between a child and their grown-ups (text with emoji, or voice), and ⌨️ typing practice results.
CREATE TABLE IF NOT EXISTS kid_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES users(id),
  sender      TEXT NOT NULL,              -- child | parent
  parent_id   UUID REFERENCES users(id),  -- the grown-up who wrote a parent's reply (null = to all)
  kind        TEXT NOT NULL,              -- text | voice
  body        TEXT,
  audio_file  TEXT,
  seconds     INTEGER,
  read_at     TIMESTAMPTZ,                -- when a grown-up last opened the child's notes
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at  TIMESTAMPTZ                 -- soft delete
);
CREATE INDEX IF NOT EXISTS kid_messages_child ON kid_messages(child_id, created_at);

CREATE TABLE IF NOT EXISTS kid_typing (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL,              -- drill (type a given text) | explain (type your own thinking)
  lesson      TEXT NOT NULL,              -- lesson id for drills, the question for explanations
  wpm         NUMERIC(6,1),
  accuracy    NUMERIC(5,1),
  seconds     INTEGER,
  body        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kid_typing_child ON kid_typing(child_id, created_at);
