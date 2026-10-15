-- Kids core: an append-only audit log for family features (what a parent changed, safety flags…).
CREATE TABLE kid_audit (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id),        -- whose action (child or parent)
  event       TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX kid_audit_time ON kid_audit(created_at DESC);
