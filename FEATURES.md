# Features

Pippin is a self-hosted companion app for adults with ADHD. Everything below runs on your own server; the AI
features use any OpenAI-compatible model you point them at (ideally a local one, e.g. Ollama).

✅ = working · 🧪 = working but experimental · 🔌 = optional integration

## Your agent (optional)
- ✅ Connect your own agent ([Hermes Agent](https://github.com/NousResearch/hermes-agent), or any agent with an OpenAI-compatible API) — see [docs/AGENT.md](docs/AGENT.md)
- ✅ **Agent-linked goals**: write a yes/no question ("Is my current account above £200?", "Did I sleep 7 hours?",
  "Have I replied to emails older than 2 days?"); the agent checks it with the tools you gave it and ticks the goal
- ✅ "Not yet" is silent and neutral; only good news is notified; answers stored encrypted
- ✅ "Plan my day" from your real calendar, inbox, task board and any extra sources you name (bank, wearables…)
- 🔌 Works with whatever the agent can reach: Gmail/Calendar, finance APIs (e.g. Firefly III), wearables via
  [Open Wearables](https://github.com/the-momentum/open-wearables) (Garmin, Oura, Whoop, Apple Health, Fitbit…)

## The companion
- ✅ Hatch a small moss creature (a *sprig*) and name it; 5 growth stages, colours and outfits
- ✅ Small self-care goals (water, meds, eat, step outside, reply to that email…) give it energy
- ✅ Full energy → it goes on an adventure and comes home with a short story (AI or built-in templates)
- ✅ **Nothing decays** — your sprig never gets sad, sick or smaller because you were away
- ✅ Cosmetic-only currency: wardrobe, furniture, room themes, companions. No tool is ever locked behind it
- ✅ Seasonal events, gifts and "kind words"
- ✅ Optional, forgiving streaks: can be switched off, paused, and short gaps mended

## Daily tools
- ✅ Mood and energy check-ins with tags, and insights on what lifts your mood
- ✅ Breathing exercises (1–5 min), ambient sounds generated in the browser (rain, brown noise, fire…)
- ✅ Focus timer with your sprig as a body double
- ✅ Short guided stretch routines
- ✅ Reflection prompts and free writing
- ✅ Multi-day "journeys" of small steps
- ✅ Monthly questionnaires: GAD-7 (default), PHQ-9 and WHO-5 (optional), with trends — labelled as screening, never diagnosis

## Private ADHD coach
- ✅ Its own engine — its only tools act on Pippin data (goals, inbox, if-then plans, people, memories)
- ✅ Guided flows: morning plan, evening debrief, weekly review, can't-start, thought check, before-a-hard-thing,
  pause-before-acting, reach-out, intake
- ✅ If-then plans ("When it's 9am, I'll open the invoice") with nudges at the point of performance
- ✅ One capture inbox with due dates
- ✅ Honesty check: the coach can't claim to have saved something it didn't
- ✅ Deterministic crisis screen (code, not the model) with fixed helplines and a personal safety plan; works offline
- ✅ Conversations encrypted at rest (AES-256-GCM), auto-deleted after 60 days (configurable)
- ✅ Warns you if the coach endpoint isn't local
- ✅ Personality presets (warm, straight-talking, upbeat, calm and minimal, playful) and your own instructions, encrypted; safety rules always win
- ✅ Health library: tick NHS website pages (ADHD, mental health, sleep, alcohol and addiction, activity, ADHD medicines) for the coach to look things up in; local keyword search, exact NHS text shown with attribution, link and date; doses never indexed
- 🧪 Red-team suite of 20 safety probes (`scripts/redteam.js`)
- 🔌 Local voice: Whisper speech-to-text, Kokoro/Piper text-to-speech
- 🔌 Approved memories written to an Obsidian folder (nothing is written without your tap)
- 🔌 People: relationship nudges from contact **metadata only** (who/when, never message text) — WhatsApp/Facebook export importer, optional live WhatsApp link

## Habits
- ✅ "After I [routine], I will [tiny version]" habits, X days a week
- ✅ Habit-strength score (the Loop Habit Tracker formula) instead of a fragile streak
- ✅ One-tap Done / Mini / Rest day — also straight from the notification
- ✅ Back-fill the last 7 days without penalty
- ✅ At most 3 habits "building" at once; the rest wait in a parking lot

## Sobriety and quitting
- ✅ 22 categories: alcohol, smoking, vaping, gambling, cannabis, opioids, benzodiazepines, GHB/GBL, stimulants,
  ketamine, MDMA, nitrous oxide, synthetic cannabinoids, pregabalin/gabapentin, codeine, caffeine, spending,
  porn, social media, gaming, binge eating, or your own
- ✅ Headline is **total free days, which never goes down** — a slip is never a reset
- ✅ Lapse debrief: what happened, what helped, one plan for next time (relapse-prevention model)
- ✅ Alcohol starts with AUDIT-C → full AUDIT → withdrawal-safety gate ("see your GP first" when it matters)
- ✅ Per-category safety rules: no quit flow for substances where stopping suddenly is dangerous; overdose cards
- ✅ Urge surfing, urge log, event plans (how you'll handle the wedding/party), money and units saved,
  year calendar, milestones
- ✅ UK helplines by default (configurable)

## Fitness (optional add-on)
- ✅ **Watch**: everything your Garmin shows — sleep (time, score, deep/light/REM/awake), overnight HRV, resting and
  intraday heart rate, stress, Body Battery, steps and distance, blood pressure, SpO₂, breathing rate, training
  readiness, recovery time, intensity minutes, calories, VO₂ max and fitness age, floors — plus 30-day trends
- ✅ Garmin sync every hour (sign in once; 2-step codes supported)
- ✅ **Food**: diary by meal, search Open Food Facts or your own foods, quick add (name + calories), daily guide with
  protein/carbs/fat, and a **hide the numbers** switch for anyone who does better without calories
- ✅ **Meal plans**: plan a week of meals once and have them added to your diary
- ✅ **Workouts**: log exercises with sets × reps × kg or minutes, search 800+ exercises, save routines and log the
  whole thing in one tap; Garmin activities appear automatically
- 🔌 Runs [SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness) headless inside the stack; each person gets
  their own account automatically

## Chat and recordings
- ✅ General AI chat in separate conversations, auto-titled
- 🔌 Optional web search (SearXNG) with sources shown; page reader blocks private/internal addresses
- 🔌 Voice-note routing: a folder of transcribed recordings is sorted into reminders, work to-dos, memories,
  journal or kids' recordings; important audio is kept permanently
- 🔌 Optionally files every note into a folder per category (Kids/, Memories/, Journal/, Reminders/, Work/, Other/) and backs up every recording's audio

## Sharing with your GP or therapist
- ✅ PDF report: you choose the period and sections (mood, questionnaires, sobriety, habits, notes)

## Household and friends
- ✅ Several people on one server, each with their own PIN and private data
- ✅ Friends see your sprig, its home and shared goals — never check-ins, reflections, chats or plans
- ✅ Shared goals and gifts

## App
- ✅ Installable PWA (Android, iOS 16.4+, desktop) — needs HTTPS
- ✅ Works offline: cached screens and a queued outbox that syncs without double-counting
- ✅ Web Push nudges with action buttons, a daily cap and a "quiet day" switch; discreet wording
- ✅ App lock with PIN (works offline), PIN brute-force lockout on the server
- ✅ Export everything / wipe conversations / forget profile
