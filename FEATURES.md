# Features

Pippin is a family app: a dad's companion for chores, pocket money, messages, a little reading and a calm place for
the grown-ups too. Everything runs on your own server. The AI features use any OpenAI-compatible model you point them
at (ideally a local one, such as Ollama). Anything marked optional is off until you set it up.

✅ = in the app · 🔌 = optional, needs a setting or an outside service · 🧪 = working but still being tried out

## For children (their own app)
- ✅ **Their own sprig**: a small companion that grows when they do things (chores, the daily question, word games, Book Chat)
- ✅ **Chores and jobs**: a daily list that earns stars, a weekly plan, and "My jobs" with a growing-up guide
- ✅ **Stars and rewards**: stars from chores and the daily question. A child asks for a reward; a parent decides. Stars are only taken away when a parent marks a reward as done
- ✅ **Pocket money**: a weekly allowance, savings pots and spending requests, kept as a record. The app moves no real money
- ✅ **Wish list**: ideas for things to do, which a parent accepts, plans or declines
- ✅ **The daily question**: one gentle question a day, which earns two stars
- ✅ **Books and Book Chat**: a bookshelf (finished, reading, not read yet); a score out of 7, likes and dislikes, and four questions, typed or spoken. Book requests too
- ✅ **Stories**: a child orders a bedtime story. The app queues the order; a worker you run writes and narrates it 🔌
- ✅ **Listening library**: audio for stories and sounds. New items wait for a parent's approval
- ✅ **Today**: a short morning paper, written each day by an automation you run 🔌
- ✅ **Learn**: short illustrated modules. AI-drafted modules stay hidden until a parent approves them; finishing one earns a little pocket money, once
- ✅ **Collection**: a searchable catalogue of things a child collects, with favourites. You supply the catalogue and pictures
- ✅ **Word games**: Boggle, Word Search and Word Connect, offline
- ✅ **Typing practice**: drills that measure speed and accuracy, and "explain it" writing. Nothing is graded; parents can read the results
- ✅ **Messages to Mum and Dad**: text notes and voice notes (up to 3 minutes). Every parent gets a gentle push; parents reply in the same thread
- ✅ **Buddy**: a chat friend, typed or spoken, with hard blocks, personal-detail redaction, a safety check and an output guard. Parents can read every conversation and every flag 🔌 (needs a children's model)
- 🔌 **My Yoto**: a child's Yoto library, making cards from recordings or files, and seeing which Yoto players are online (needs a Yoto app and a parent to connect it)
- 🔌 **Room**: a few Home Assistant controls a child may use, such as a night light, a noise machine or a sleep timer. A closed allowlist; the Home Assistant token stays on the server
- ✅ **Child sign-in**: a child signs in on their own device with their PIN. The signed-out screen lists adults only
- ✅ **Time windows**: a parent can set when the child's app works. Outside those times, only the modules a parent allowed are open. Parents are never restricted
- ✅ **My jobs and the weekly plan**: a child ticks off jobs and adds activities to their plan; parents edit the jobs and the time windows

## For parents (the Family section)
- ✅ **A panel for each child** with all of the above, and their Buddy conversations
- ✅ **Adding a child** with a name and a PIN; a parent can reset a child's PIN
- ✅ **Downloading a child's data**: one JSON file of everything held about them (passwords, PIN hashes, tokens and keys left out), plus a tar of their audio and files
- ✅ **Removing a child**: the parent types the child's name to confirm. The child can't sign in; their data is purged for good after `CHILD_PURGE_DAYS` (30 by default). A dry-run switch previews the purge
- ✅ **Shared family calendar**: every adult can see and edit it. A planned wish-list item can go on it
- ✅ **Monitoring log**: record a score from a questionnaire a parent or teacher fills in elsewhere (SDQ, Vanderbilt, or your own measure) with a date and a note, and see it change over time. Pippin does not score or diagnose
- ✅ **Alerts**: a push notification when Buddy flags something or a daily answer needs a gentle check-in. Telegram too 🔌
- 🔌 **Morning briefing**: a short note each morning for each adult you choose, with the weather, today's calendar and plans, and open to-dos. Needs a model endpoint

## For grown-ups
- ✅ **Their own sprig**, with the same growing rules as a child's
- ✅ **Check-ins**: morning and evening mood and energy, with tags; insights on what lifts your mood
- ✅ **Monthly check-ins**: GAD-7 by default, with PHQ-9 and WHO-5 optional, shown with their published bands and trends. Labelled as screening, not diagnosis
- ✅ **Habits**: "After I [routine], I will [tiny version]", X days a week. Habit strength is a score (the Loop Habit Tracker formula), not a streak. One-tap Done, Mini or Rest day, also from the notification. Back-fill the last 7 days without penalty. At most three habits build at once; the rest wait
- ✅ **Calm tools**: breathing practices (everyday ones, and intense ones after a one-time safety check); sounds made in the browser (brown, fire, forest, ocean, rain, wind); a focus timer with your sprig as company; short stretch routines
- ✅ **Reflections and journeys**: reflection prompts, free writing and multi-day journeys of small steps
- ✅ **Sharing with a GP or therapist**: a PDF you build yourself. You choose the period and the sections (summary, mood, notes, questionnaires, sobriety, habits, reflections, journal). Made inside Pippin; the data doesn't go to another service
- 🔌 **The coach**: an AI coach with its own engine, whose only tools act on Pippin's own data. Flows: morning plan, evening debrief, weekly review, "I can't get started", thought check, before a hard thing, pause before acting, who to reach out to, welcome back, urge, lapse, plan for an event, and intake. If-then plans with nudges, one capture inbox, and voice (Whisper, Kokoro or Piper) when set up
- 🔌 **Coach personality and how forgiving**: five presets (warm and gentle, straight-talking, upbeat, calm and minimal, playful), a forgiveness setting from 1 to 100%, and your own instructions. Your instructions are encrypted and can't switch off the safety rules
- 🔌 **Health library**: 22 NHS website pages, including pages on ADHD, mental health, sleep, alcohol, activity and medicines. You tick the ones the coach may use. It searches them on your server and shows the exact NHS text, with a link and date. Doses are never indexed
- ✅ **Sobriety tracker**: 22 categories, from alcohol and nicotine to gambling, gaming and spending. The headline is total free days, which never goes down. Lapses open a debrief, not a reset. Alcohol starts with AUDIT-C, then AUDIT and a withdrawal-safety gate. Per-category safety rules and UK helplines
- ✅ **Talk**: a chat with your own AI agent 🔌, or everyday AI chat with separate conversations 🔌
- ✅ **Explore**: Reads (your own Markdown articles, with optional audio 🔌), the daily link digest (chosen by a workflow you run 🔌), breathwork, and extra links you set 🔌

## Your agent (optional)
- 🔌 Connect your own agent ([Hermes Agent](https://github.com/NousResearch/hermes-agent) or any agent with an OpenAI-compatible API). See [docs/AGENT.md](docs/AGENT.md)
- 🔌 **Agent-linked goals**: a yes/no question ("Is my current account above £200?"). The agent checks it with the tools you gave it. True ticks the goal; "not yet" is silent
- 🔌 **Plan my day** from the agent's view of your calendar, inbox and any extra sources you name
- 🔌 **Per-person agents**: each adult can have their own agent through `AGENT_PROFILES`

## Fitness (optional add-on)
- 🔌 Runs [SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness) headless inside the stack. Each person gets their own account
- 🔌 **Watch**: Garmin data (sleep, HRV, heart rate, stress, Body Battery, steps, blood pressure, readiness, VO₂ max and more) with 30-day trends. Synced every hour once linked; the password is not stored
- 🔌 **Food**: a diary by meal, search (Open Food Facts), your own foods, quick add (a name and calories), meal plans, and a switch to hide calories and macros
- 🔌 **Workouts**: exercises with sets, reps and weights or minutes, saved routines logged in one tap

## Chat, notes and voice (optional)
- 🔌 **Optional web search** in everyday chat, through your SearXNG, with sources shown. The page reader blocks private and internal addresses. The coach never searches
- 🔌 **Voice in and out**: Whisper speech to text, Kokoro or Piper text to speech, on your own server
- 🔌 **Voice-note routing**: a folder of transcribed recordings is sorted into reminders, work to-dos, memories, journal and kids' recordings. Important audio is kept
- 🔌 **Obsidian notes**: approved summaries are written to a folder you choose. Nothing is written without your approval
- 🔌 **Folders for every note**: Kids/, Memories/, Journal/, Reminders/, Work/, Other/, with a backup of every recording's audio

## People and friends
- ✅ **Several people on one server**, each with their own PIN and private data
- ✅ **Friends** see your sprig, its home and shared goals. They never see check-ins, reflections, chats, private goals or coach plans
- 🔌 **Relationship nudges** from contact metadata only (who and when, never message text). Import a WhatsApp or Facebook export, or link WhatsApp live (unofficial library; see [known issues](docs/KNOWN_ISSUES.md))

## App
- ✅ **Installable web app** on Android, iPhone and desktop. Needs HTTPS
- ✅ **Works offline**: cached screens and a queued outbox that syncs without double-counting
- ✅ **Web Push** with action buttons, a daily cap and a "quiet day" switch. Discreet wording
- ✅ **PIN lock and sign-in**, with lockouts after repeated wrong PINs. A PIN is only ever checked against one person
- ✅ **Export and wipe** (adults): download your coach data as JSON, or wipe your coach conversations
- ✅ **Per-person installs**: a host name can be tied to one person, so each install has their name (`HOST_USERS`)
- 🔌 **Demo mode**: a shared, made-up family that resets nightly, for a public try-it site
