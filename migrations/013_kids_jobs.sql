-- Kids "jobs & money": chores, self-care, stars + rewards, pocket money + savings pots, the "Summer" wishlist.
-- Everything is per child (child_id). Rules (D-001/D-011): no shame mechanics, parents decide every reward
-- and every real spend, nothing auto-redeems. Real money is integer PENCE and is only ever changed by
-- the money ledger — never by sprig/game rewards. Soft delete only.

-- ---------- Chores ----------
CREATE TABLE kid_chores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES users(id),
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  icon_emoji  TEXT,
  frequency   TEXT NOT NULL DEFAULT 'daily',          -- daily | weekly | matchday | adhoc
  star_value  INTEGER NOT NULL DEFAULT 1,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX kid_chores_slug ON kid_chores(child_id, slug);
CREATE INDEX kid_chores_active ON kid_chores(child_id, active, sort_order);

CREATE TABLE kid_chore_completions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       UUID NOT NULL REFERENCES users(id),
  chore_id       UUID NOT NULL REFERENCES kid_chores(id),
  completed_date DATE NOT NULL,                        -- the child's local day
  completed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stars_awarded  INTEGER NOT NULL DEFAULT 0,
  removed_at     TIMESTAMPTZ                            -- a parent "reset" (soft); stars already earned stay
);
CREATE UNIQUE INDEX kid_chore_completions_once ON kid_chore_completions(chore_id, completed_date) WHERE removed_at IS NULL;
CREATE INDEX kid_chore_completions_day ON kid_chore_completions(child_id, completed_date DESC);

-- ---------- Self-care ----------
CREATE TABLE kid_selfcare_prompts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES users(id),
  slug        TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',          -- kindness | feelings | gratitude | people | body | general
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX kid_selfcare_prompts_slug ON kid_selfcare_prompts(child_id, slug);

CREATE TABLE kid_selfcare_responses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id           UUID NOT NULL REFERENCES users(id),
  prompt_id          UUID NOT NULL REFERENCES kid_selfcare_prompts(id),
  response_text      TEXT NOT NULL,
  responded_date     DATE NOT NULL,                     -- the child's local day
  responded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_seen_at     TIMESTAMPTZ,
  difficult_feelings BOOLEAN NOT NULL DEFAULT FALSE,
  flagged_at         TIMESTAMPTZ,                       -- when it was checked (by the app or an outside flagger)
  flag_reason        TEXT
);
CREATE INDEX kid_selfcare_responses_time ON kid_selfcare_responses(child_id, responded_at DESC);
CREATE INDEX kid_selfcare_responses_unflagged ON kid_selfcare_responses(responded_at) WHERE flagged_at IS NULL;

-- ---------- Stars + rewards ----------
CREATE TABLE kid_star_ledger (
  id            BIGSERIAL PRIMARY KEY,
  child_id      UUID NOT NULL REFERENCES users(id),
  source        TEXT NOT NULL,                          -- chore | selfcare | reward_redeem | adjust
  source_ref    TEXT,
  stars         INTEGER NOT NULL,                       -- + earned, − spent
  balance_after INTEGER NOT NULL,
  note          TEXT,
  import_ref    TEXT,                                   -- set by data imports, for re-runnable imports
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX kid_star_ledger_time ON kid_star_ledger(child_id, created_at DESC);
CREATE UNIQUE INDEX kid_star_ledger_import ON kid_star_ledger(child_id, import_ref) WHERE import_ref IS NOT NULL;

CREATE TABLE kid_rewards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       UUID NOT NULL REFERENCES users(id),
  slug           TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  icon_emoji     TEXT,
  stars_required INTEGER NOT NULL CHECK (stars_required > 0),
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX kid_rewards_slug ON kid_rewards(child_id, slug);

CREATE TABLE kid_reward_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id           UUID NOT NULL REFERENCES users(id),
  reward_id          UUID NOT NULL REFERENCES kid_rewards(id),
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stars_at_request   INTEGER NOT NULL,
  parent_decision    TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | declined | talk_first | completed
  parent_decision_at TIMESTAMPTZ,
  parent_note        TEXT,
  parent_user        TEXT,                               -- the deciding parent's name (display)
  decided_by         UUID REFERENCES users(id)
);
CREATE INDEX kid_reward_requests_child ON kid_reward_requests(child_id, requested_at DESC);

-- ---------- Pocket money (PENCE) ----------
-- total = SUM(ledger.pence); earmarked = SUM(active pots' saved_pence); spendable = total − earmarked.
-- Moving money into a pot is an earmark only (no ledger row). A real spend is parent-approved (negative row).
CREATE TABLE kid_money_ledger (
  id            BIGSERIAL PRIMARY KEY,
  child_id      UUID NOT NULL REFERENCES users(id),
  source        TEXT NOT NULL,                          -- opening | allowance | study_reward | payout | adjust | …
  source_ref    TEXT,                                   -- idempotency key (week ref, module id, payout id…)
  pence         INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  note          TEXT,
  import_ref    TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX kid_money_ledger_time ON kid_money_ledger(child_id, created_at DESC);
CREATE UNIQUE INDEX kid_money_ledger_ref ON kid_money_ledger(child_id, source, source_ref) WHERE source_ref IS NOT NULL;
CREATE UNIQUE INDEX kid_money_ledger_import ON kid_money_ledger(child_id, import_ref) WHERE import_ref IS NOT NULL;

CREATE TABLE kid_money_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     UUID NOT NULL REFERENCES users(id),
  slug         TEXT NOT NULL,
  title        TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'short',             -- short (a thing to buy) | long (open savings pot)
  target_pence INTEGER,                                   -- NULL for open-ended pots
  saved_pence  INTEGER NOT NULL DEFAULT 0 CHECK (saved_pence >= 0),
  icon_emoji   TEXT,
  created_by   TEXT NOT NULL DEFAULT 'child',             -- child | parent
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  achieved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX kid_money_goals_slug ON kid_money_goals(child_id, slug);
CREATE INDEX kid_money_goals_active ON kid_money_goals(child_id, active, kind, sort_order);

CREATE TABLE kid_money_payout_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     UUID NOT NULL REFERENCES users(id),
  goal_id      UUID REFERENCES kid_money_goals(id),
  amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',            -- pending | approved | declined | paid
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at   TIMESTAMPTZ,
  parent_note  TEXT,
  parent_user  TEXT,
  decided_by   UUID REFERENCES users(id)
);
CREATE INDEX kid_money_payout_child ON kid_money_payout_requests(child_id, requested_at DESC);

-- Per-child money settings (weekly allowance amount).
CREATE TABLE kid_money_settings (
  child_id        UUID PRIMARY KEY REFERENCES users(id),
  allowance_pence INTEGER NOT NULL DEFAULT 500 CHECK (allowance_pence >= 0),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- "Summer" wishlist: things the child would like to do ----------
CREATE TABLE kid_wishlist_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id           UUID NOT NULL REFERENCES users(id),
  title              TEXT NOT NULL,
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_decision    TEXT NOT NULL DEFAULT 'pending',      -- pending | planned | done | not_this_time | talk_first
  parent_decision_at TIMESTAMPTZ,
  parent_note        TEXT,
  parent_user        TEXT,
  decided_by         UUID REFERENCES users(id),
  planned_date       DATE,
  calendar_event_id  UUID,                                 -- family calendar event made by "Plan it"
  removed_at         TIMESTAMPTZ
);
CREATE INDEX kid_wishlist_items_child ON kid_wishlist_items(child_id, created_at DESC) WHERE removed_at IS NULL;
