-- Household roles: adults and children on one server, a per-person brain, and short handles.
-- role: 'adult' (default) | 'child'. Children get the kids' experience and never see adult tools.
-- is_parent: may see and manage the household's children (Family section).
-- slug: short handle for host hints and integration hooks (e.g. /hooks/<slug>/…). Optional.
-- brain: which agent profile this person talks to (see AGENT_PROFILES in .env). NULL = the
--        server's default brain for the owner only; everyone else has no agent unless set.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'adult' CHECK (role IN ('adult', 'child'));
ALTER TABLE users ADD COLUMN is_parent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN slug TEXT;
ALTER TABLE users ADD COLUMN brain TEXT;
CREATE UNIQUE INDEX users_slug ON users(lower(slug)) WHERE slug IS NOT NULL AND deleted_at IS NULL;
UPDATE users SET is_parent = true WHERE is_owner;

-- General chat threads can now be answered by the local model or by the person's own agent.
ALTER TABLE chat_threads ADD COLUMN engine TEXT NOT NULL DEFAULT 'local';

-- Sprig rewards for things done elsewhere in the app (chores, books, stories…). One row per
-- (person, kind, ref) so a reward is only ever given once for the same thing.
CREATE TABLE sprig_rewards (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL,
  ref         TEXT NOT NULL,
  day         DATE NOT NULL,
  energy      INT NOT NULL DEFAULT 0,
  acorns      INT NOT NULL DEFAULT 0,
  item_id     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, kind, ref)
);
CREATE INDEX sprig_rewards_day ON sprig_rewards(user_id, day);
