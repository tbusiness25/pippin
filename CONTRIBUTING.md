# Contributing

Thanks for helping. This project is built for ADHD brains, by one — so small, focused contributions are perfect.

## Ground rules
1. **No shame mechanics.** Nothing that punishes absence: no decay, no lost progress, no reset streaks, no guilt copy.
   Read the principles in the [README](README.md) before proposing a feature.
2. **Privacy first.** Nothing leaves the user's server unless they turn it on, and the UI must say so.
3. **Safety is code, not prompts.** Anything touching crisis handling, substances or questionnaires needs a source
   (guideline, paper) in the PR and an update to [docs/SAFETY.md](docs/SAFETY.md).
4. **Plain words.** UI copy is short, warm, British English, reading age ~9–11.

## Getting started
```bash
cp .env.example .env     # fill in DB_PASSWORD, JWT_SECRET, DATA_KEY
docker compose up -d --build
docker compose logs -f app
```
The frontend (`public/`) is mounted live — refresh the page, and bump `SW_VERSION` in `.env` so installed copies update.
The stack is deliberately boring: Node + Express, Postgres, vanilla JS. No build step, no framework.

- New tables → a new numbered file in `migrations/` (never edit an applied one)
- All timestamps `TIMESTAMPTZ`; soft-delete with `deleted_at`
- Sensitive text (chats, transcripts) goes through `src/coach/crypto.js`

## Before you open a PR
- `node --check` passes on changed files (CI runs this and a Docker build)
- If you changed the coach prompt, tools or crisis screen: run `docker compose exec app node scripts/redteam.js`
  **several times** and paste the results
- Screenshots for any UI change (phone width)
- One topic per PR

## Reporting bugs
Use the issue templates. **Never paste real chats, journal entries or health data** into an issue — make up an example.
Security problems: see [SECURITY.md](SECURITY.md), not a public issue.
