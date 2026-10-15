-- Buddy: a child's safe chat friend. Every message is kept (with its safety flags) so parents can read
-- every conversation and mark flags as reviewed. Audio is never stored — voice turns only record that
-- the recording was transcribed and deleted.
CREATE TABLE kid_chat_messages (
  id                  BIGSERIAL PRIMARY KEY,
  child_id            UUID NOT NULL REFERENCES users(id),
  session_id          UUID NOT NULL,
  role                TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content             TEXT NOT NULL,                 -- what the model saw / what the child saw (PII redacted)
  raw_content         TEXT,                          -- the child's original words, only when PII was redacted (parents only)
  voice               BOOLEAN NOT NULL DEFAULT false, -- came from the mic (the audio was deleted straight after transcribing)
  flagged             BOOLEAN NOT NULL DEFAULT false,
  flag_type           TEXT,
  flag_reason         TEXT,
  drifting            BOOLEAN NOT NULL DEFAULT false,
  llm_model           TEXT,
  reviewed_at         TIMESTAMPTZ,
  reviewed_by         UUID REFERENCES users(id),
  legacy_id           TEXT UNIQUE,                   -- id in an older app, for idempotent imports
  removed_at          TIMESTAMPTZ,                   -- soft delete only
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX kid_chat_messages_child ON kid_chat_messages(child_id, created_at DESC);
CREATE INDEX kid_chat_messages_session ON kid_chat_messages(session_id, created_at);
CREATE INDEX kid_chat_messages_flagged ON kid_chat_messages(child_id, created_at DESC) WHERE flagged AND reviewed_at IS NULL;
