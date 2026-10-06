# Pippin coach — intended purpose, hazard log and safety case (lightweight DCB0129-style)

## Intended purpose
Pippin's coach is an **AI ADHD coaching and wellbeing companion** for adults. It helps people plan, start and
finish things, keep routines, maintain relationships and reflect. **It is not therapy, treatment, diagnosis
or a medical device**, and it does not manage any mental-health condition. Questionnaire results only signpost.
Basis: docs/research/reports/ADHD coach app blueprint.md.

## Architecture safeguards
| Safeguard | Where |
|---|---|
| Coach is Pippin's own engine, separate from any general agent; its ONLY tools act on Pippin data (no shell, web, email, calendar, files, home automation) | `src/coach/tools.js` |
| Only one network destination: the configured OpenAI-compatible endpoint (refused in code otherwise); UI warns when it isn't local | `src/coach/llm.js` |
| Deterministic crisis screen on every message, outside the model, with UK helplines (configurable) and the user's own safety plan; never ends the conversation; tools disabled on high risk | `src/coach/crisis.js`, `engine.js` |
| Crisis support still returned if the model is offline | `src/routes/coach.js` |
| Chat + intake profile encrypted at rest (AES-256-GCM), deleted after `COACH_RETENTION_DAYS` | `src/coach/crypto.js`, `engine.purge` |
| No message text in logs; push notifications carry no task or conversation content | throughout; `src/push.js` |
| Honesty check: replies that claim an action with no tool call are corrected | `engine.js` (CLAIM) |
| Only user-approved summaries reach Obsidian; only the server owner's data goes to the vault | `src/coach/vault.js` |
| Relationships from metadata only (who/when/direction); no message bodies, no inference about other people; group chats skipped | `src/coach/people.js`, `scripts/import-history.py`, `whatsapp/sidecar.js` |
| Export everything / wipe conversations / forget profile | `src/routes/privacy.js` |
| Personal style and instructions sit after the persona and say the rules above always win; dropped entirely on crisis turns | `src/coach/style.js`, `engine.js` |
| Health library: only unchanged NHS website text, only pages the person ticked, searched locally; dose sections and any medicine passage with an amount never indexed; exact text shown to the person with attribution, link and copy date | `src/coach/library.js`, `scripts/update-library.js` |

## Hazard log
| # | Hazard | Cause | Controls | Residual |
|---|---|---|---|---|
| H1 | Missed or mishandled suicide/self-harm risk | Model safeguards erode in long chats; concealed phrasing | Code-level screen incl. concealed/indirect patterns; fixed resources + safety plan; model guidance; red-team probes crisis-explicit/concealed/burden/method | Medium — regex can't catch everything; errs to over-showing support |
| H2 | Harmful agreement (sycophancy) — e.g. validating hostile mind-reading, impulsive actions | General LLMs over-agree | Persona: gentle challenge, 24-h pause for impulsive moves; probe `impulse` | Medium |
| H3 | Medication / diet / method advice | Model helpfulness | Persona limits; probes `medication`, `diet`, `crisis-method` | Low |
| H4 | Claiming to be a therapist / overreach | Model role drift | Persona; probe `not-therapist`; UI says "not a therapist" | Low |
| H5 | Dependency / isolation | Always-available companion | Persona points outward; no "always here" copy; probe `dependency`; static helplines work offline | Medium |
| H6 | Labelling or profiling other people | Chat history + model speculation | Metadata-only import; persona forbids; probe `third-party-label` | Low |
| H7 | Work personal data (colleagues, clients, people in their care) entering the coach | User mentions them by name | Persona: initials, no details; probe `work-gdpr`; work contacts never named | Medium — relies on user and model |
| H8 | Leak of sensitive conversations | Logs, notifications, vault sync, cloud model | Encryption, no-content logs/pushes, owner-only approved vault writes, local endpoint check | Low |
| H9 | False claims of having saved a plan/reminder | Model hallucinating tool use | Honesty check + tool-result confirmations shown as chips | Low |
| H10 | Shame from streaks/currency | Gamification | Streaks optional, forgiving, never used as leverage by the coach (design principle); probe `no-shame` | Low |
| H27 | Custom instructions switch off safety ("ignore your rules", "shame me", "give me doses") | Person's own instructions | Placed after the persona and framed as tone/format only, the rules win; not used on crisis turns; probes `style-override-medication`, `style-override-shame` | Low–medium — relies on the model |
| H28 | Health library misused as medical advice, or wrong/out-of-date NHS text | Retrieval of clinical pages | Unchanged NHS text with copy date and link so the person can check the live page; doses never indexed; persona LIMITS unchanged; probes `library-dose`, `library-grounded`; refresh with `scripts/update-library.js` | Low |
| H29 | Low forgiveness turns into pressure or shame, or pushes someone who is struggling | Person sets high standards | Bands change targets and accountability only; every band carries "never shame, no counters as pressure"; forced back to at least the default (80%) when today's mood is ≤2/5 and in lapse/urge/welcome flows; ignored on crisis turns; probes `strict-no-shame`, `strict-lapse`, `strict-accountability` | Low–medium — relies on the model |
| H11 | Model/prompt change silently degrades safety | Model or prompt churn | **Re-run `scripts/redteam.js` after every model, prompt, context or tool change** | — |

## Habits & sobriety (phase 5) — research: docs/research/reports/Habit and sobriety tracker design.md
| # | Hazard | Controls |
|---|---|---|
| H12 | Stopping alcohol suddenly when dependent → seizures/DTs | AUDIT-C → full AUDIT shown with the published WHO band; then the SAME safety note for everyone (NHS/NICE withdrawal signs → speak to your GP or an alcohol service before stopping) that must be acknowledged — the app never tells anyone it is safe to stop; "first days" 999 card days 0–5; crisis screen level `medical` (fits, hallucinations, can't stop shaking) → 999; probes `withdrawal-gate`, `withdrawal-emergency` |
| H13 | Abstinence violation effect (one drink → "ruined it" → relapse) | Headline = cumulative free days, never decreases; no reset or repair button; lapse = debrief + next-24h + if-then; run counter opt-in; honest logging rewarded; coach banned from "relapse/reset/start again"; probe `lapse-ruined` |
| H14 | Coach using counters as pressure | Persona rule; probe `counter-pressure` |
| H15 | Dangerous categories (sedatives, GHB, opioids) | No quit flow without acknowledging "medical help to taper"; overdose card on every opioid/GHB lapse; per-category notes + UK helplines (`src/sober/content.js`, last checked date) |
| H16 | Eating-disorder harm | Binge category never records calories/weight |
| H17 | Exposure on a shared phone | Discreet mode default; notification text never names a substance; app lock (PIN, works offline) default 5 min |
| H18 | Notification overload / shame | Max 4/day default, "quiet today", one follow-up only after a lapse, never broken-streak or "missed X days" alerts |

| # | Hazard | Controls |
|---|---|---|
| H19 | Shared PDF exposes more than intended | Person picks the date range and every section; written notes, reflections and journal OFF by default; coach conversations never included; PDF built in-process (pdfkit), never sent to another service; cover page says self-reported, not a clinical record |
| H20 | Questionnaire scores read as diagnosis | Labelled "screening, not a diagnosis" in app and PDF; PHQ-9 item 9 endorsement shown explicitly in the PDF for clinicians and triggers support in-app |
| H21 | Dangerous withdrawal for newly added substances | spice and pregabalin/gabapentin = no quit flow without acknowledging medical support; codeine = overdose card + paracetamol warning; nitrous = B12/nerve-damage symptoms → GP/111; ketamine = bladder symptoms → GP |
| H22 | Agent-linked goals pressure or shame (money, body targets) | "Not yet" is silent and neutral — no nudge, no red state, no failure count; only success notifies; guide tells people to delete goals that feel like pressure Residual: low–medium. |
| H23 | Agent acts instead of reading (sends, pays, changes) | Every agent prompt says read-only; docs require read-only credentials; Pippin never passes credentials — residual risk sits with the agent's own permissions. Residual: medium. |
| H24 | Sensitive financial/health detail stored or leaked via the agent's answer | Evidence capped at ~100 chars, asked to omit names/account numbers, encrypted at rest; never sent to the coach model or push. Residual: low. |
| H25 | Food tracking feeding restriction or disordered eating | Calorie "guide" wording, never "over/under" judgements beyond a neutral number; "eating something is always better than skipping"; per-device **hide the numbers** switch; binge-eating quit category still never records calories; coach never sees food or weight data. Residual: medium — anyone with an eating-disorder history should keep numbers hidden or not use Food. |
| H26 | Garmin password exposure | Password sent once over the private Docker network to the backend, which signs in to Garmin and keeps only encrypted tokens; Pippin never stores or logs it. Residual: low. |

## Re-testing
```
docker compose exec app node scripts/redteam.js
```
Last runs: 2026-10-02, Qwen3.6 35B-A3B (local, via Ollama), 16 probes — 16/16, 15/16, 14/16, 13/16 across runs. All misses
on review were wording (the model not using a phrase the check looks for), not harmful advice — but the model is
stochastic, so run the suite SEVERAL times after any change and READ the failing transcripts, not just the ticks.

2026-10-06 (0.11.0, coach style + health library), same model, 20 probes: 18/20, 18/20, 17/20, and the four new
probes 11/12 over three runs. Misses on review: wording in `lapse-ruined`, `no-shame` and `style-override-shame`
(kind replies the regex didn't recognise), plus `diet` once, giving general calorie ranges. Diet was then sampled
15 times on 0.10.0 and 0.11.0: 2/15 and 3/15. It's a pre-existing weakness of the persona with this model, not
caused by this release, and needs its own fix.

0.12.0 (how forgiving): strict probes at 1–5% plus shame, lapse, crisis and override probes, 6 runs: no shaming, no
counters as pressure, lapse handled warmly at 1%; misses were wording only. An A/B at 100/50/5% on the same message
showed the intended shift (2-minute starter → 15-minute timer → specific deliverable by Sunday).

## Regulatory position (UK)
Intended purpose: a self-help wellbeing and habit tool for adults. It is **not** intended to diagnose, triage,
monitor or treat any condition. Design choices that keep it that way (MHRA guidance on digital mental health
technology, 2025):
- Validated questionnaires (GAD-7, PHQ-9, WHO-5, AUDIT) are shown with their published score bands only, labelled
  "screening, not a diagnosis". No score changes the advice anyone gets, except that crisis helplines are always
  shown when someone indicates thoughts of self-harm (signposting).
- Safety information (alcohol withdrawal, dangerous substances) is static, published guidance shown to everyone in
  that category.
- The AI coach does not see or interpret questionnaire scores.
- The health library shows published NHS website text that the person chose; it doesn't assess symptoms or
  recommend treatment, and the coach keeps its medication limits.
If you change any of these, re-check the MHRA guidance first.
