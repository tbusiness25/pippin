# Connecting your agent

Pippin can work with **your own AI agent**: a program that runs on your server and has tools, such as reading
your email or checking your bank balance. Once it's connected:

- **"Plan my day"** reads today's calendar, the emails that need you and your task board, and turns them into
  2–4 small, concrete goals with two-minute first steps.
- **Agent-linked goals** are goals the agent checks for you and ticks when they're true.

Pippin never gets your passwords or bank details. The agent holds the access; Pippin asks it read-only
questions and keeps only the short answer, encrypted.

> Everything here is optional. With no agent, Pippin is a complete companion and coach that knows only what you
> tell it.

## 1. Run an agent
Pippin talks to any agent that offers an **OpenAI-compatible chat API** and uses its tools when asked.

**[Hermes Agent](https://github.com/NousResearch/hermes-agent)** (Nous Research, open source) is the one Pippin is
tested with. Turn on its API server in its environment:
```ini
API_SERVER_ENABLED=true
API_SERVER_KEY=make-up-a-long-random-key
```
Then in Pippin's `.env`:
```ini
BRAIN=hermes
HERMES_API_URL=http://hermes:8642/v1      # the agent's address as Pippin's container sees it
HERMES_API_KEY=the-same-long-random-key
```
If both run in Docker, put them on the same network (`EXTRA_NETWORK` in `.env`) so `hermes` resolves.

**Another agent?** Use `BRAIN=agent` with `AGENT_API_URL`, `AGENT_API_KEY` and `AGENT_MODEL`. It must call its own
tools when asked in plain English and reply in text. Agents that only chat, without tools, can't check anything.

**Speed:** agents take 15 seconds to a few minutes per question. Plans and checks run in the background.

## 2. Give the agent tools (you choose how much)
Set these up **in the agent**, not in Pippin. Use read-only access wherever the service allows it.

| To let goals and plans use… | Give your agent | Notes |
|---|---|---|
| **Calendar and email** | Hermes' Google Workspace skill (Gmail and Calendar) | Read-only OAuth scopes are enough |
| **Task board** | Hermes' built-in kanban, or your to-do app's API | |
| **Bank balances and payments** | Your finance app's API, e.g. [Firefly III](https://www.firefly-iii.org/) with a bank sync | Use a read-only token. Pippin never sees account numbers |
| **Sleep, steps, heart rate, workouts** | [Open Wearables](https://github.com/the-momentum/open-wearables) and its MCP server | Self-hosted; connects Garmin, Oura, Whoop, Polar, Suunto, Fitbit, Strava, Apple Health, Samsung Health and Health Connect |
| **Anything else** | Any tool or MCP server your agent supports | Smart-home sensors, a habit API, a reading log… |

Then tell the planner about the extras, so "plan my day" looks there too:
```ini
AGENT_SOURCES=Firefly III (bank balances, bills due), Open Wearables (last night's sleep, today's steps)
```
And if your agent needs a nudge to use the right skill:
```ini
HERMES_CONTEXT_HINT=Use your google-workspace skill for Gmail and Calendar.
```

## 3. Make goals your agent ticks
Edit any goal → **🔗 Let your assistant tick this** → write a **yes/no question** the agent can answer with its
tools. Optionally choose a time before which it won't check.

Good questions are specific, checkable and about *today*:

| Area | Goal | Question for the agent | Check after |
|---|---|---|---|
| Money | Keep a cushion | Is my current account balance above £200? | — |
| Money | Pay the card | Has a payment to my credit card gone out this month? | — |
| Money | No takeaway Tuesday | Is there no takeaway or food-delivery payment on my account today? | 21:00 |
| Email | Inbox under control | Have I replied to every email in my inbox that's more than 2 days old? | 16:00 |
| Email | School admin | Is there nothing from school in my inbox still waiting for a reply? | — |
| Calendar | Plan tomorrow | Does tomorrow have at least one block of focus time in my calendar? | 18:00 |
| Sleep | Rest | Did I sleep at least 7 hours last night? | 10:00 |
| Movement | Move a bit | Have I done 6,000 steps today? | 17:00 |
| Movement | Exercise | Is there a workout of 20 minutes or more recorded today? | — |

How it behaves:
- Checked about **once an hour** while the goal is due and not done (`AGENT_CHECK_EVERY_MIN`), or tap **Check now**.
- **True:** the goal ticks, your sprig gets its energy, and you get one quiet notification.
- **Not true yet:** nothing happens. No red mark, no nudge. The goal just shows "not yet" and the time it looked.
- **Couldn't check** (tool down, no access): shown as such; it tries again later.
- You can always tick it yourself.

## Privacy and safety
- **What Pippin sends the agent:** the question, the date and the time. For "plan my day": your mood and energy
  from today's check-in, and the titles of today's goals. **Never** your coach conversations, journal, sobriety
  logs or questionnaire answers.
- **What Pippin keeps:** the agent's yes/no and a one-line reason (e.g. "Balance is above £200"), encrypted at rest.
- **Read-only is an instruction, not a guarantee.** Pippin tells the agent not to send, pay, move or change
  anything, but only the agent's own permissions can enforce that. Give it read-only credentials.
- **Money and health goals are personal.** Write them so they support you. "Not yet" is never shown as failure,
  but if a money or body goal starts to feel like pressure, delete it. That's what the design wants you to do.
- If your agent uses a cloud model, the agent's lookups (your email, balances) go to that model provider. That's
  between you and your agent; Pippin's own coach can still run locally.
