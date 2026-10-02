-- General AI chat (separate conversations, may use web search) + voice-note routing.

CREATE TABLE chat_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL DEFAULT 'New chat',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
-- NULL thread = the private coach conversation; otherwise a general chat.
ALTER TABLE coach_messages ADD COLUMN thread_id UUID REFERENCES chat_threads(id);
CREATE INDEX coach_messages_thread ON coach_messages(thread_id, id);

-- Every recording Pippin has seen. Transcripts are encrypted at rest; kids' recordings and memories keep a
-- permanent audio copy in Pippin's own storage (the recorder service purges its audio after a while).
CREATE TABLE voice_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id),
  recording_id   TEXT NOT NULL,
  recorded_at    TIMESTAMPTZ,
  source_file    TEXT,                    -- vault-relative note file
  category       TEXT NOT NULL,           -- reminder | memory | journal | kids | work | other
  title          TEXT,
  summary        TEXT,
  transcript_enc TEXT,                    -- encrypted (src/coach/crypto.js)
  audio_file     TEXT,                    -- path in Pippin storage (kept copy) or null
  vault_audio    TEXT,                    -- path inside the vault's Voice Notes/audio
  actions        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- what Pippin did with it
  starred        BOOLEAN NOT NULL DEFAULT false,
  routed_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  UNIQUE (user_id, recording_id)
);
CREATE INDEX voice_notes_user ON voice_notes(user_id, recorded_at DESC) WHERE deleted_at IS NULL;
