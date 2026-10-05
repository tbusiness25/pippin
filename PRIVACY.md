# Privacy

Pippin is software you run yourself. **There is no company, no cloud and no telemetry.** The project never
receives any of your data.

## What stays on your server
Everything: your companion, goals, check-ins, questionnaires, habits, sobriety logs, journal, coach and chat
conversations, recordings. Coach/chat messages and voice transcripts are encrypted at rest (AES-256-GCM) with a
key only your server holds. Coach conversations are deleted after 60 days by default.

## What can leave your server — only if you turn it on
| Feature | What leaves | Where to |
|---|---|---|
| Coach / chat model | Your messages and the context the coach needs | The model endpoint you configure. **Use a local one** (Ollama, llama.cpp) and nothing leaves. The app warns you if the endpoint isn't local |
| Chat web search (`CHAT_WEB=true`) | Search terms and the addresses of pages it reads | Your SearXNG instance and those websites. The private coach never searches |
| Your agent (`BRAIN=hermes` / `agent`) | The goal-check question, the date and time; for "plan my day" your mood/energy and today's goal titles — never chats, journal, sobriety or questionnaire data | The agent you run. What *it* reads (email, bank, health) is under its own permissions |
| Fitness add-on | Garmin: your Garmin sign-in (once) and the sync requests; food search terms to Open Food Facts; exercise search to the open exercise database | Garmin, openfoodfacts.org, the exercise database. Your diary, workouts and health data stay in the fitness database on your server |
| Web Push nudges | A short, discreet notification ("Time for a small step") — never health details | Your browser vendor's push service (Google, Apple, Mozilla) |
| Live WhatsApp link | Nothing is sent; it **reads** who messaged whom and when (never content) | — |

## If you run it for other people
If you host this for anyone other than yourself and your household, **you** are the data controller for
health data (special category data under UK/EU GDPR). That means a lawful basis, a privacy notice, a DPIA and
proper security. The project's maintainers don't recommend running a public instance for strangers.

## Your rights inside the app
Export everything (JSON), wipe conversations, forget your coach profile, and delete recordings — all in Settings.
