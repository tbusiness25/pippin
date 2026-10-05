# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions: [SemVer](https://semver.org/).

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
