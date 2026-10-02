# Known issues and limitations

The live list is in GitHub Issues — this file is the snapshot at release, so nothing is hidden. Labels:
`security`, `safety`, `bug`, `limitation`, `docs`.

## Security
| # | Issue | Impact | Notes |
|---|---|---|---|
| S1 | Sessions are signed JWTs and can't be revoked server-side; changing your PIN doesn't sign out other devices | Medium | Add a per-user session version checked on each request |
| S2 | PIN lockout is held in memory — a restart clears the counters | Low | Fine for one instance; persist if you run several |
| S3 | No Content-Security-Policy yet (the UI uses inline handlers/styles) | Medium | Move inline script out, then add a strict CSP |
| S4 | First visitor to a fresh install becomes the owner | Medium if exposed before setup | Set `SETUP_CODE` in `.env`, or finish setup before exposing it |
| S5 | Web page reader (chat) resolves DNS before fetching; a DNS-rebinding host could still reach a private address between check and fetch | Low | Pin the resolved IP for the request |
| S6 | Offline app-lock PIN hash (PBKDF2) lives in the browser's localStorage | Low | Someone with the unlocked device and devtools could brute-force a short PIN offline. Use 6+ digits |
| S8 | Anyone who can reach the login page can lock an account for a few minutes by guessing wrong PINs | Low | The trade-off for brute-force protection; lockouts double from 1 min, capped at 2 h |
| S7 | Losing `DATA_KEY` makes coach chats, transcripts and voice notes unreadable | High (data loss) | Back the key up somewhere safe; there is no recovery by design |

## Safety (AI and wellbeing)
| # | Issue | Notes |
|---|---|---|
| A1 | The red-team suite passes 13–16 of 16 probes depending on the run — models are stochastic | Misses reviewed so far were wording, not harmful advice. Run it several times after any model or prompt change and read the failures |
| A2 | The crisis screen is English-only pattern matching | It errs on the side of showing support; it can't catch everything. Other languages need their own patterns |
| A3 | Helplines and the withdrawal guidance are UK-specific | Set `CRISIS_RESOURCES_JSON` for crisis lines elsewhere; substance helplines are not yet configurable per country |
| A4 | Behaviour depends heavily on the model. Small models (<8B) follow the coach's rules less reliably | Tested mostly on Qwen3.x 27–35B. Report results with other models |
| A5 | Not a medical device and not therapy. Questionnaires are screening tools only | See [SAFETY.md](SAFETY.md) |

## Bugs and limitations
| # | Issue |
|---|---|
| B1 | English (en-GB) only; no translations yet |
| B2 | PDF report uses the built-in Latin-1 font: emoji and non-Latin scripts are dropped |
| B3 | Offline outbox is last-write-wins; editing the same thing on two offline devices keeps one |
| B4 | Web Push needs HTTPS; on iPhone it only works after "Add to Home Screen" (iOS 16.4+) |
| B5 | Scheduled jobs (nudges, voice-note scan) run inside the app process — running more than one replica would double-send |
| B6 | Voice-note routing reads one specific Markdown layout (frontmatter + `## Transcript`), owner account only |
| B7 | Relative dates in voice notes ("next Tuesday") depend on the model reading a date table; check the plans it creates |
| B8 | The optional live WhatsApp link uses an unofficial library (Baileys). It may break, and WhatsApp may restrict accounts that use it — the export importer is the safer route |
| B9 | No automated unit/integration tests yet — only the safety red-team script |
| B10 | Accessibility hasn't been audited (screen readers, contrast, reduced motion) |
| B13 | Agent-linked goals depend on the agent: answers can be wrong, slow (minutes) or fail; each check is a full agent run, so cloud-model agents cost money per check | 
| B11 | `BRAIN=hermes` (calendar/email planning) needs a separately-run Hermes Agent and takes 1–3 minutes |
