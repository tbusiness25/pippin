-- How each person wants their coach to sound, and which health-library pages it may use.
CREATE TABLE coach_settings (
  user_id          UUID PRIMARY KEY REFERENCES users(id),
  personality      TEXT NOT NULL DEFAULT 'warm',     -- one of the presets in src/coach/style.js
  instructions_enc TEXT,                             -- their own instructions, encrypted (can be personal)
  library          TEXT[] NOT NULL DEFAULT '{}',     -- ids from library/sources.json they've ticked
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Which health-library passages a coach reply used (page id + section), so the source cards come back with the chat.
ALTER TABLE coach_messages ADD COLUMN sources JSONB;
