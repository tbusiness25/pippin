# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions: [SemVer](https://semver.org/).

## [0.14.0] — 2026-10-15
### Added
- **Household roles**: adults and children on one server (`users.role`, `is_parent`, `slug`). Child accounts get a
  kid-friendly app; adult routes answer 404 for them. Parents see a Family tab with each child's panel.
- **Per-person installs**: `HOST_USERS` ties a host name to a person: their PIN pad is preselected and the manifest,
  title and colour become theirs. A host never signs anyone in; the PIN is always checked.
- **Agent chat** (Talk → 🤖): talk to your own agent, streamed, with tool activity, dictation and read-aloud.
  Hermes Agent sessions are used directly; any OpenAI-compatible agent works with threads kept here. Per-person
  agents via `AGENT_PROFILES` and `users.brain`.
- **Reads** (Explore → Reads): articles the server owner drops in as Markdown, with optional audio.
- **Kids**: a home with the sprig's room and savings jars, and modules for jobs, feelings check-ins, stars and
  rewards, pocket money with savings pots, a wish list, a listening library, a daily paper, Learn, a collection,
  word games, room controls (a closed Home Assistant allowlist), Buddy (a safety-guarded chat with no tools or web,
  `scripts/redteam-kids.js`), Messages to grown-ups, and typing practice.
  Doing things grows the child's sprig (energy, acorns and earned keepsakes); rewards never touch real money.
- **Family** tab: children's panels, a shared calendar and monitoring records.
- Optional daily briefing and link digest, per adult (opt-in).
- Breathwork (Explore → 🌬️): everyday slow-breathing practices, and intense practices after a safety check.
- Integration hooks `/hooks/<slug>/…` (token, refused through a proxy) for automations and workers.
- `EXPLORE_LINKS` for extra Explore tiles.
### Fixed
- Login never signs in "whoever's PIN matches first": a PIN is checked against one chosen person only.
- Async route errors return 500 instead of crashing the server (Express 4).
- A new service worker replaces a different app's old one on the same address at once.
- Garmin: Sparky's hourly sync is switched on for a new link, so the watch syncs on its own.

## [0.12.1] — 2026-10-06
### Fixed
- Coach no longer gives calorie or weight-loss numbers. The persona now rules out calorie figures, targets and ranges,
  weight-loss rates, meal plans and asking for weight or height, and says what to do instead (GP, practice nurse or
  dietitian; Beat; non-food self-care). A check in code catches slips: the reply is sent back once for a rewrite, then
  replaced with a fixed kind reply. Diet probe went from 0/15 to 15/15 (see docs/SAFETY.md)
- Beat's web address is always given correctly (the model sometimes misspelt it)
- Health library: when a long NHS section is split into parts, every part can now be found. Only the first part used
  to be returned, so "how many units a week is low risk?" missed the passage with the 14-unit guideline

### Changed
- Red-team `diet` probe is stricter: catches comma-formatted ranges ("1,200–1,500 kcal"), weight-loss rates and asking
  for height/weight, and needs a GP/dietitian pointer

## [0.12.0] — 2026-10-06
### Added
- **How forgiving**: a 1–100% setting in *Me → Coach style & library*. 100% is extra gentle; the default 80% is
  the coach as before; lower settings set higher standards (bigger blocks of real work, stretching targets, specific
  times, excuses named). It never shames, and it automatically goes back to at least the default when today's
  check-in mood is low and in the lapse, urge and welcome-back flows. Crisis turns ignore style settings entirely
- Red-team probes `strict-no-shame`, `strict-lapse`, `strict-accountability` (run at 1–5%)

## [0.11.0] — 2026-10-06
### Added
- **Coach style**: pick a personality (warm and gentle, straight-talking, upbeat, calm and minimal, playful) and
  write your own instructions for the coach, stored encrypted. The safety rules always win, and the style is dropped
  on crisis turns
- **Health library**: 22 NHS website pages (ADHD, mental health, sleep, alcohol and addiction, physical activity,
  ADHD medicines) that each person can tick for their coach to look things up in. Searched locally with no extra
  model; the coach gets matching passages automatically and through a `look_up_health_info` tool; the person sees
  the exact NHS text under the reply with attribution, link and copy date. Dose information is never indexed
- `scripts/update-library.js` to refresh the pages; `library/sources.json` to add more
- Four red-team probes: `style-override-medication`, `style-override-shame`, `library-dose`, `library-grounded`;
  `scripts/redteam.js <probe ids>` runs a subset
- Coach settings included in the data export

### Changed
- Red-team medication checks no longer fail on negated advice ("don't take an extra dose")

## [0.10.0] — 2026-10-05
### Added
- **Fitness add-on** (`COMPOSE_PROFILES=fitness`): SparkyFitness runs headless inside the stack, with Pippin's own
  screens — **Watch** (Garmin sleep, HRV, stress, Body Battery, heart rate, BP, steps, readiness, VO₂ max… and
  30-day trends), **Food** (diary, search, quick add, meal plans, hide-the-numbers) and **Workouts** (sets, routines,
  history). Per-person backend accounts are created automatically; nothing is exposed outside the stack
- Voice notes: file each note into a category folder and back up every recording's audio
- Setup script asks about the fitness add-on

## [0.9.0] — 2026-10-02
### Added
- **Agent-linked goals**: a goal can carry a yes/no question your own agent checks with its tools (bank, email,
  calendar, wearables…) about once an hour or on demand; true → ticked with energy, not yet → silent
- `BRAIN=agent` for any agent with an OpenAI-compatible API; `AGENT_SOURCES` to widen "plan my day"
- One-setting AI providers: `AI_PROVIDER` = ollama, openai, anthropic, openrouter, gemini or custom
- `scripts/setup.sh`; install guides for Docker, WSL 2 and Linux without Docker; docs/AGENT.md

### Fixed
- "+ New" button overlapping the intro text on Habits and Chat

## [0.8.0] — 2026-10-02 — first public release
### Added
- General AI chat with separate conversations and optional web search (SearXNG) with sources
- Voice-note routing: transcribed recordings sorted into reminders, work, memories, journal and kids' recordings; important audio kept
- Change PIN in settings; PIN brute-force lockout (per IP and per account); optional `SETUP_CODE` for first run
- Basic security headers
- Project docs: features, known issues, roadmap, contributing, security and privacy policies

### Earlier (private development)
- 0.7 — 22 substance/behaviour categories, monthly GAD-7/PHQ-9/WHO-5, GP/therapist PDF report
- 0.6 — Habit tracker, sobriety tracker, nudges with action buttons, offline outbox, app lock
- 0.5 — Private ADHD coach engine, crisis screen, encryption at rest, red-team suite
- 0.2–0.4 — Shop, home, tools, journeys, insights, household, friends, events
- 0.1 — The companion, goals, check-ins, adventures, optional streaks
