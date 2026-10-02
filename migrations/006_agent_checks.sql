-- Goals your own agent can check and tick for you ("Is my current account above £200?", "Did I sleep 7 h?").
-- The question is plain English; the agent answers using whatever tools YOU gave it (bank, email, wearables…).
ALTER TABLE goals ADD COLUMN agent_check TEXT;          -- null = an ordinary goal you tick yourself
ALTER TABLE goals ADD COLUMN agent_check_after TIME;    -- optional: don't check before this local time

CREATE TABLE goal_checks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      UUID NOT NULL REFERENCES goals(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  day          DATE NOT NULL,
  met          BOOLEAN,                 -- null = the agent couldn't check
  evidence_enc TEXT,                    -- short reason from the agent, encrypted (may mention money or health)
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX goal_checks_goal_day ON goal_checks(goal_id, day, checked_at DESC);
