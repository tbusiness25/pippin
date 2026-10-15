# Privacy

Pippin runs on the server you choose. There is no company behind it, no cloud service and no telemetry. The project
never receives any of your data. This page says what is stored, where, for how long, who can see it, and what can
leave your server. Where something is kept until you remove it, it says so.

## Where things are stored
- **The database:** PostgreSQL, in the `db` container (volume `pgdata`). Its port is bound to `127.0.0.1` by default.
- **Files:** the `./data` folder, mounted at `/data` in the app container.
  - Children's audio (Messages voice notes, Book Chat recordings) in `/data/kids/<child id>/`, plus a copy of Book Chat
    audio in `AUDIO_STORE` (default `/data/audio`).
  - Stories and other audio you can play, in `/data/library/<user id>/`.
  - Reads (Markdown articles you add) in `READS_DIR` (default `/data/reads`).
- **Your notes folder:** only if you set `VAULT_HOST_DIR`. Pippin writes only the notes you approve there.
- **Your voice-note folder:** only if you set `VOICE_NOTES_HOST_DIR`. It is mounted read-only unless you set
  `VOICE_NOTES_MOUNT=rw`.

## Encryption
- **Encrypted at rest (AES-256-GCM, key = `DATA_KEY`):** coach and chat messages, the coach profile and your coach
  instructions, agent chat messages, voice-note transcripts, the agent's answers to goal checks, the Garmin link key
  (fitness add-on), and the Yoto refresh token.
- **Not encrypted by Pippin:** everything else. That includes children's data (Buddy chats, Messages, jobs, money
  records, wish list, books and reviews, typing results, monitoring entries), goals, habits, check-ins, sobriety logs
  and the family calendar. These rely on the server's access controls, your database's access controls and your
  backups.
- **Passwords:** PINs are stored as bcrypt hashes. They are never stored in plain text.
- **Keep `DATA_KEY` safe and separate from your backups.** Without it the encrypted items cannot be read, and there is
  no recovery.

## Who can see what
- **You, the server owner,** can read everything on the server, including the database. That is true of any
  self-hosted app, so host it on a machine you trust.
- **Each adult** sees their own data. Two things are shared between adults:
  - the **family calendar**, which every adult can see and edit;
  - what you choose to share with **friends**: your sprig and its home, and shared goals. Friends never see check-ins,
    reflections, chats, private goals or coach plans.
- **Parents** (adults marked as parents) see a child's data in the Family section. That includes Buddy conversations
  and flags, Messages, typing results, monitoring entries and Book Chat recordings.
- **Children** see only their own features. Adult routes return "not found" for a child account.
- **Alerts** to parents carry the child's name and a short description of the kind of flag. They never carry the
  message.

## What can leave your server (only if you set it up)
| Feature (setting) | What leaves the server | Where it goes |
|---|---|---|
| Coach and everyday chat (`AI_PROVIDER`, `COACH_*`) | Your messages and the context the coach needs | The model endpoint you set. A local model means nothing leaves your network. The coach refuses to call any host other than `COACH_BASE_URL`, and the app marks a remote model as "remote". |
| Children's features (`KIDS_LLM_*`) | Buddy messages (after redaction), Book Chat answers, and the safety classifier's input | The endpoint in `KIDS_LLM_URL`, or `STORY_BASE_URL` if that is unset. The app only calls a host on your own network. Any other host is refused before anything is sent, unless you set `KIDS_LLM_ALLOW_CLOUD=true`. |
| Morning briefing (`BRIEFING_FOR`, `BRIEF_*`) | Today's date, the weather, today's calendar entries, the adult's plans and open to-dos, and reading items | `BRIEF_BASE_URL`, or `STORY_BASE_URL` if that is unset. Off unless `BRIEFING_FOR` names someone. |
| Weather (`BRIEF_LAT`, `BRIEF_LON`) | Your latitude and longitude | Open-Meteo (no account or key). Off unless set. |
| Stories and the story worker (`STORY_*`, your worker) | A child's story request, with its theme and characters, and the child's name | The worker you run, and its model. |
| Learn drafting (`KIDS_LEARN_DRAFT_WEBHOOK`) | The topic, its group and the child's slug | The webhook you configure. |
| Your agent (`BRAIN`, `HERMES_*`, `AGENT_*`) | Goal questions and planning context | The agent you run, and whatever that agent connects to. See [AGENT.md](AGENT.md). |
| Web search in chat (`CHAT_WEB`, `SEARXNG_URL`) | Search terms, and the pages it reads | Your SearXNG instance and those sites. The coach never searches. |
| Telegram alerts (`ALERT_TELEGRAM_*`) | Parent alerts (child's name and flag kind) | Telegram. Off unless set. |
| Web Push | A short notification (no chat or health details) | Your browser vendor's push service (Google, Apple or Mozilla). |
| Yoto (`YOTO_*`) | Card titles and audio a family makes in My Yoto | Yoto, once a parent connects it. |
| Fitness add-on (`COMPOSE_PROFILES=fitness`) | Your Garmin sign-in (once), sync requests, food search terms | Garmin (via SparkyFitness, which runs on your server) and Open Food Facts. Your diary and workouts stay on your server. |
| WhatsApp link (`COMPOSE_PROFILES=whatsapp`) | Nothing. It reads who messaged whom and when, never message text | Stays on your server. The library is unofficial; see [KNOWN_ISSUES.md](KNOWN_ISSUES.md). |
| Health library refresh (`scripts/update-library.js`) | Nothing. It downloads only the NHS pages listed in `library/sources.json` | Stays on your server. |

Nothing else leaves the server. There is no analytics code, no advertising and no crash reporter.

## How long things are kept
| Data | Kept for | Setting |
|---|---|---|
| Coach and chat messages | 60 days by default, then deleted | `COACH_RETENTION_DAYS` |
| Buddy chat messages (children) | 90 days by default, then deleted. `0` keeps them. | `KIDS_BUDDY_RETENTION_DAYS` |
| Book Chat voice recordings (children) | Until removed. A parent can remove one. | `KIDS_BOOK_CHAT_RETENTION_DAYS` (default `0` = keep) |
| Buddy voice audio | Not stored. It is transcribed in memory and wiped. | — |
| Messages to grown-ups, including voice notes | Until removed (by the child or a parent) | — |
| Other children's data (jobs, stars, pocket-money records, wish list, books, typing, monitoring entries, daily answers) | Until the child is removed. Nothing is deleted automatically before that. | — |
| A removed child's data | Until the purge, which runs daily and deletes it for good after the removal has been on record for `CHILD_PURGE_DAYS` days (default 30). Rows shared with others are kept, and links to the child are cleared. | `CHILD_PURGE_DAYS`, `CHILD_PURGE_DRY_RUN` |
| Family audit log | Kept. Nothing is deleted automatically. | — |
| Adult data (goals, habits, check-ins, sobriety logs, calendar, and so on) | Until deleted. Many deletes only mark a row as deleted and hide it; those rows stay in the database. | — |
| Push subscriptions | Until the push service reports the subscription as gone, and Pippin then removes it | — |

Retention settings are read when the app starts, so restart it after changing one. `0` always means "keep".

## Your rights in the app
- **Export (adults):** downloads your coach conversations and profile, coach settings, commitments, inbox items,
  memories, people, check-ins and reflections as one JSON file. It does not yet include every kind of data (for
  example, habits, sobriety logs and the calendar).
- **Wipe (adults):** deletes your coach conversations. You can also delete the coach profile. You must type `WIPE` to
  confirm.
- **Children (parents only):**
  - **Download:** everything held about a child, as one JSON file, with passwords, PIN hashes, tokens and encryption
    keys left out. The file's header lists which columns were left out. Their audio and files are available as a tar.
    Buddy chats also have their own download. Each Buddy download is recorded in the audit log.
  - **Remove:** a parent types the child's exact name to confirm. The child can't sign in, and their devices stop getting
    notifications at once. Their data is kept for `CHILD_PURGE_DAYS` days (default 30), then deleted for good by the
    daily purge.
  - **Adults are never affected** by any of these.

## If you run it for other people
If anyone other than you and your household uses this server, you are responsible for their data. Health data and
children's data need extra care. Check your duties before you start, for example under UK GDPR and the ICO's
Children's code if children use it. The project's maintainers do not recommend running a public instance for
strangers.
