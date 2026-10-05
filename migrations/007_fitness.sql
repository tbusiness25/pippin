-- Link each Pippin person to their own account on the fitness backend (SparkyFitness).
-- Pippin creates the account itself; the API key is encrypted with DATA_KEY.
CREATE TABLE fitness_links (
  user_id       UUID PRIMARY KEY REFERENCES users(id),
  backend_email TEXT NOT NULL,
  key_enc       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
