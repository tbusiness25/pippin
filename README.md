# Pippin 🌱

**A gentle, self-hosted companion for ADHD brains, with a private AI coach, habits and a no-shame sobriety tracker.**

You hatch a small moss creature called a *sprig*. Small acts of self-care give it energy: drinking water, taking
your meds, replying to that one email. When its energy bar is full it goes off on an adventure and comes home with
a little story. It never gets sad, sick or smaller because you were away.

Around the pet is a toolkit built from the ADHD, habit and relapse-prevention research:

- **A private ADHD coach**, running on *your* model (Ollama, llama.cpp or any OpenAI-compatible endpoint). It makes
  if-then plans, breaks tasks into two-minute steps, captures to-dos to one inbox and nudges you at the point of
  performance. Its crisis handling is code, not a prompt.
- **Habits** scored on strength rather than streaks. A missed day dents the score; it doesn't wipe your progress.
- **A sobriety tracker** for alcohol and 21 other substances and behaviours. The headline number is *total free
  days*, which never goes down. A slip opens a short debrief, not a reset.
- **Monthly GAD-7 / PHQ-9 / WHO-5** with trends, and a **PDF to share with your GP or therapist**.
- **Everyday AI chat** with optional web search, kept separate from the coach.

It runs on your server, works offline, and installs as an app on Android, iPhone and desktop.

<p align="center">
  <img src="docs/screenshots/home.png" width="230" alt="Home: the sprig in its room">
  <img src="docs/screenshots/habits.png" width="230" alt="Habits">
  <img src="docs/screenshots/sober.png" width="230" alt="Sobriety tracker">
</p>

> **Not therapy, not a medical device.** Pippin is a self-help wellbeing tool for adults. Questionnaires are
> screening tools, not diagnoses. If you're struggling, speak to your GP. **In crisis (UK):** Samaritans
> 116 123 · text SHOUT to 85258 · emergency 999. Elsewhere: [findahelpline.com](https://findahelpline.com).

## Why another ADHD app?
There are good pet apps (Finch), good ADHD planners (Tiimo, Sprout), good sobriety apps (I Am Sober, Reframe) and
good habit trackers (Loop). None of them puts all of this in one place, and they all keep your mental-health data
on someone else's cloud, often with a paid AI on top. Pippin is:

- **One place:** the pet keeps you coming back, and the tools are there when you do.
- **Private:** self-hosted, encrypted at rest, no telemetry. Point the coach at a local model and nothing leaves
  your network.
- **Forgiving by design:** no decay, no lost progress, no guilt copy, no streak resets used as punishment.
- **Free:** no ads, no paywalled self-care. Cosmetics are earned in-app.

See the full [feature list](FEATURES.md).

## Principles
1. **Nothing ever decays.** Absence is never punished.
2. **Streaks are optional** and forgiving. Habit strength and cumulative counts replace "day 1 again".
3. **Safety is code.** The crisis screen, withdrawal warnings and helplines don't depend on a model behaving.
4. **The coach only touches this app.** It can't email, browse, or change anything outside it.
5. **Your data is yours.** Export it all, delete it all, and run it where you like.

## Quick start
You need Docker and somewhere to run it (a home server, a NAS, a £5 VPS). For the coach you also need a model
endpoint; [Ollama](https://ollama.com) with a 7–14B instruct model is a reasonable start.

```bash
git clone https://github.com/tbusiness25/pippin.git && cd pippin
cp .env.example .env
# fill in DB_PASSWORD, JWT_SECRET and DATA_KEY (openssl rand -hex 32 for each), SETUP_CODE,
# and COACH_BASE_URL / COACH_MODEL for your model
docker compose up -d --build
```
Open `http://localhost:8910`. The first run asks for your name, a PIN and the setup code.

**Installing it as an app, notifications and the microphone all need HTTPS.** Put it behind a reverse proxy
(Caddy, nginx, Traefik), a Cloudflare Tunnel, or use `tailscale serve`. Don't expose port 8080 directly.

**Back up `DATA_KEY`.** Without it, encrypted chats and transcripts can't be read. There is no recovery.

## Configuration
Everything is in [`.env.example`](.env.example), with comments. The main switches:

| Setting | What it does |
|---|---|
| `COACH_BASE_URL`, `COACH_MODEL` | The coach's model (any OpenAI-compatible endpoint). The app warns if it isn't local |
| `BRAIN=openai` / `hermes` | Optional "plan my day" brain; `hermes` uses [Hermes Agent](https://github.com/NousResearch/hermes-agent) to read your calendar and email |
| `CHAT_WEB=true` + `SEARXNG_URL` | Lets everyday chat search the web. The coach never does |
| `WHISPER_URL`, `TTS_URL` | Local voice in and out |
| `VAULT_HOST_DIR` | An Obsidian folder for notes you approve |
| `VOICE_NOTES_HOST_DIR` | A folder of transcribed voice notes to sort into reminders, memories and journal |
| `CRISIS_RESOURCES_JSON` | Crisis lines for your country (defaults are UK) |
| `APP_NAME` | Call your copy whatever you like |

## Safety and privacy
- [docs/SAFETY.md](docs/SAFETY.md): intended purpose, hazard log, red-team suite and regulatory position
- [PRIVACY.md](PRIVACY.md): what stays on your server and what can leave it (only things you turn on)
- [SECURITY.md](SECURITY.md): reporting vulnerabilities

The design is grounded in published research; the reports and sources are in [docs/research](docs/research/reports/).

## Status
Version 0.8: everything listed works and the author uses it, but this is a first public release by one
person. Read [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) before relying on it, and see the [roadmap](ROADMAP.md).

UK-first: helplines, units and guidance are British. Country packs are welcome contributions.

## Contributing
Bug reports, safety reports and small PRs are very welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence
[AGPL-3.0](LICENSE). Use it, self-host it and change it freely. If you run a modified version as a service for
other people, you must share your changes. All art, sounds and text are original; "Finch" and other app names
mentioned belong to their owners and are used only for comparison.
