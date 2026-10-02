# Market, naming and publishing — research report

*Researched 2026-10-02 via web search. Prices are list prices found in reviews/store pages and vary by region. Trademark and domain checks are SURFACE checks only (web search + DNS lookups); they are not a clearance search.*

---

## 1. Competitors

### 1.1 Closest analogues

| App | What it does | Price | AI | Privacy stance |
|---|---|---|---|---|
| **Finch: Self-Care Pet** (Finch Care PBC) | Virtual bird pet grows as you complete self-care goals; mood check-ins, journaling, breathing, forgiving missed days | Free (generous); Plus ~$9.99/mo or ~$40–70/yr | No generative coach | Cloud account; ~$30M ARR, bootstrapped, 4.9★ / 550k+ reviews |
| **Sprout** | ADHD productivity + pet companion (8 species, pet never dies/sulks), AI task breakdown, voice brain-dump, focus timer, XP | Free + Premium | Yes (cloud) | Not stated |
| **Otto: Habit Tracker Pet** | Virtual pet + planner + to-do + habits, ADHD-marketed | Freemium | No (as listed) | Cloud |
| **Buddy — ADHD Life Planner** | To-dos, habits, water/medication reminders, focus timer, virtual-pet motivation | Freemium | No (as listed) | Cloud |
| **Pika / Momo / HabitYou / QuillBy** | Smaller self-care-pet clones of Finch | Freemium | Mostly no | Cloud |
| **Pocket Kin** (open source, GitHub) | Cozy virtual pet game, Wear OS step/HR tracking; heading to Play with ads + IAP | Free + IAP | No | — |
| **Fernlet** (open source, GitHub, pre-release iOS) | "Tamagotchi of yourself": pet reflects food/sleep/movement/journaling; no streaks, P2P only | Free, FOSS | No | Strong: no server, device-to-device |

### 1.2 ADHD planners / coaches

| App | What it does | Price | AI | Privacy |
|---|---|---|---|---|
| **Tiimo** | Visual timeline planner, per-activity timers | Free; Pro ~$7–12/mo, ~$54/yr | Some cloud AI planning | Account + cloud |
| **Inflow** | CBT-based ADHD programme, lessons, community, optional 1:1 coaching | ~$47.99/mo or ~$199.99/yr | Limited | Account + cloud |
| **Numo** | "Cringe-free" ADHD app: brain dump, planner, community, gamified tasks | ~$7.99–15.99/mo | Some | Cloud |
| **Shimmer** | Human 1:1 ADHD coaching via video + accountability | ~$140–345/mo | No (human) | Cloud |
| **Focus Bear** | Routine enforcement + distraction blocking, "built for AuDHDers" | Free; Pro $9.99/mo | No | Account |
| **Goblin Tools** | Magic ToDo task breakdown, tone checker, etc. | Free web; small one-off mobile fee | Yes (cloud LLM) | Text sent to cloud model |
| **Saner.AI** | AI "ADHD personal assistant": notes, tasks, reminders, chat | Free; $8 / $16 per mo | Yes (cloud) | Cloud |
| **Lunatask** | End-to-end encrypted to-dos, habits, mood, journal, notes | Free; ~$6–8/mo; $180 lifetime | No | **E2E encrypted** — the privacy benchmark |
| **Habitica** | RPG-gamified habits/dailies/to-dos, party quests; open source | Free; ~$5/mo sub | No | Hosted; FOSS server |
| **Routinery** | Step-by-step timed routines | Free; $7.99/mo, $39.99/yr, ~$72 lifetime | No | Cloud |
| **Fabulous** | Behavioural-science habit "journeys" + coaching | ~$40–80/yr | Some AI coaching | Cloud |
| **Llama Life** | Timed task list, one-thing-at-a-time | $6/mo or $39/yr | Minimal | Cloud |
| **Sunsama / Motion** | Daily planning / AI auto-scheduling for knowledge work (not ADHD-specific) | ~$16–20/mo / ~$19–34/mo | Motion: yes | Cloud; work-oriented |
| **KickMint** | Task initiation, on-device Qwen 2.5 task breakdown | Free; $8.99/mo, $59.99/yr, $209.99 lifetime | **On-device LLM** | No account, local processing |
| **Wisp – Smart Life Companion** | AI journaling + habits + goals | Freemium | **On-device AI** | Local processing |
| **Focused Flow / Mindflow AI** | Chat-based "ADHD AI coach" apps | Subscription | Yes (cloud) | Cloud |
| **Joon** | ADHD — for *children* (parent-assigned quests, pet) | Subscription | No | Cloud — not adult competitor |
| "Mila" | No ADHD coaching app by this name found (Mila = nursing study coach) | — | — | — |

### 1.3 Sobriety / drinking

| App | What it does | Price | AI | Privacy |
|---|---|---|---|---|
| **I Am Sober** | Sober-day counter (resets on relapse), pledges, community, workbook | Free; Plus $9.99/mo or $39.99/yr | No | Account + community |
| **Reframe** | Neuroscience-based drink-less programme; "Melody" AI chatbot; paid human coaching | ~$99.99/yr; coaching add-ons $9.99–$249.99/mo | Yes (cloud chatbot) | Cloud |
| SobrMate, Sober Tracker, etc. | Counters/check-ins | Freemium | Mixed | Cloud |

### 1.4 Open-source / self-hosted (GitHub)
- **adhd-dashboard** — self-hosted gamified daily dashboard (XP, habit loops), Docker. Tiny (2★).
- **otto-cognitive-nudge** — commitment tracker using Claude API (cloud), ~130★.
- **Beaver Habits, HabitSync, OpenHabitTracker, Table Habit (mhabit), Loop** — self-hosted/FOSS habit trackers, no pet, no AI coach, no sobriety.
- **Habitica** — FOSS, self-hostable in theory, gamified but no AI, no sobriety, no clinical measures.
- **Fernlet**, **Pocket Kin** — FOSS pet companions (see 1.1).
- `awesome-adhd-tools` curated list.

### 1.5 The gap — honest assessment
- **Nothing found combines pet companion + AI coach + habit strength + sobriety + standardised measures + local/self-hosted LLM.** Each piece exists separately:
  - Pet + gentle habits: Finch (dominant), Sprout (pet + cloud AI), Otto, Buddy.
  - AI coach: Reframe (sobriety, cloud), Saner/Goblin/Focused Flow (cloud).
  - Privacy: Lunatask (E2E, no AI, no pet), KickMint & Wisp (on-device AI, narrow scope), Fernlet (FOSS pet, no AI).
  - Sobriety: I Am Sober, Reframe — neither has cumulative never-reset counting as the headline nor ADHD framing.
- **Closest overall: Sprout** (ADHD + pet + AI breakdown + voice brain-dump) — but cloud AI, no sobriety, no clinical measures, not self-hostable. **Closest on philosophy: Fernlet** (FOSS, no-shame, privacy-first pet) — but no AI, no ADHD tooling, iOS only, pre-release.
- Defensible differentiators: (1) self-hosted / bring-your-own OpenAI-compatible endpoint — no competitor offers this; (2) ADHD × substance use in one place (high real-world comorbidity) with cumulative-days counting; (3) deterministic crisis screen + GP-ready PDF export.
- Risk: "everything app" breadth; the store audience for a self-hosted app is small. The niche is homelab / privacy-conscious adults with ADHD.

---

## 2. Naming

### 2.1 "Finch" itself
- Finch: Self-Care Pet is published by **Finch Care Public Benefit Corporation** (Play developer, App Store id1528595748). A surface search of USPTO via Justia/Trademarkia did **not** surface a Finch Care registration (hits were other owners: Windy Valley Woodworks (abandoned), Epimed (cancelled), Finch Therapeutics (health), Rajant, Hans-Gerhard Fink). **Could not confirm a registered mark** — but with ~$30M ARR, 550k+ reviews and the identical category, Finch Care has strong unregistered rights (US common law; UK passing off). **Treat "Finch" as unusable.** The private working name should not ship as the product name.

### 2.2 Candidates checked (12 + rejects)

DNS check = no NS records for the domain (likely unregistered; verify at a registrar, some may be premium/reserved).

| # | Name | App-store collisions | Trademark (surface) | GitHub | .app / .org / .dev | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Hedgeling** (hedgehog + -ling) | None found | None found | Empty org `github.com/hedgeling` (0 repos); 0 repos named it | all three free | **Clean** |
| 2 | **Tuftling** | None found | TUFT marks are mattresses/rugs/cat furniture — different classes | 0 repos | .app, .dev free; .org taken | **Clean** |
| 3 | **Puddock** (Scots: frog/toad) | None found | None found | 0 repos | .org free; .app, .dev taken | Clean name, domains partly gone |
| 4 | **Dabchick** (little grebe) | "Dabchy" (Tunisian shopping app) — not confusing | None found | 4 small repos | all three free | Clean but hard to spell |
| 5 | **Mudlark** | None found | "MUDLARK PUBLISHING" US abandoned; HarperCollins UK "Mudlark" book imprint (class 16/41, not software) | 32 repos (incl. NLP tool) | .org, .dev free; .app taken | Usable, weaker |
| 6 | Hedgelet | None | Generic finance term ("hedgelet" binary futures contract) | 0 | all free | Meaning clash — avoid |
| 7 | Quillet | QuillBy (pet + habit app) is near | None found | — | .app, .org taken | Too close to QuillBy |
| 8 | Pipkin | None found | — | — | all taken | Domains gone |
| 9 | Mossling | Same-concept "Mossling" movement-companion app on GitHub (joshrwolf/mossling) + mossling.carrd.co | — | collision | .org taken | **Reject** |
| 10 | Bramble | "Bramble: Talk About Feelings" (parent–child feelings) **and** "Bramble: AI Chat Companion" on Play | — | — | .org/.dev taken | **Reject (wellbeing collision)** |
| 11 | Wisp | "Wisp: Smart Life Companion" (on-device AI journaling/habits), "Wisp: Mood Tracker & Self Care", Wisp telehealth | — | — | — | **Reject (wellbeing collision)** |
| 12 | Fernlet | FOSS self-care tamagotchi on GitHub (bowman-mw/fernlet) — same concept | — | collision | free | **Reject** |

Also rejected: **Pocketkin** (FOSS virtual pet + health tracking going to Play), **Smidge** (UK insect-repellent brand), **Kindlekin** (Kindle), **Burrow** (Burrow furniture brand), **Sprig** ("Sprig: Clean Food Scanner" + Sprig survey SaaS), **Wren** (internal work product).

### 2.3 Ranked shortlist (5 cleanest)
1. **Hedgeling** — friendly, British (hedgehogs), pet-flavoured, not clinical; no app/TM/repo collisions found; .app/.org/.dev all appear free. Grab the domains and the GitHub org name issue (org exists but is empty — choose `hedgeling-app` or similar).
2. **Tuftling** — soft and creature-like; no collisions; .app/.dev free.
3. **Puddock** — characterful (Scots for frog), no collisions; .app/.dev already taken, so .org or a `getpuddock.app` style domain.
4. **Dabchick** — very clean everywhere, all domains free; cost is spelling/pronunciation, which hurts voice search and word of mouth.
5. **Mudlark** — clean in app stores and software classes; more repo noise and the .app is taken; connotation (Victorian river scavenger) is fun to Brits but less obviously a pet.

**Before committing:** run proper searches at UKIPO (trademarks.ipo.gov.uk), EUIPO eSearch/TMview and USPTO Trademark Search for classes 9, 42 and 44. These could not be queried directly here.

---

## 3. Publishing

### 3.1 PWA to Google Play
- **Route:** Trusted Web Activity (TWA). Use **PWABuilder** (GUI, generates the package via Bubblewrap) or the **Bubblewrap CLI** directly. Needs a valid manifest, service worker and HTTPS origin, plus **Digital Asset Links** (`/.well-known/assetlinks.json`) on the origin. The app wraps *one* origin — so the store build points at a hosted instance. A self-hosted-only product can't easily ship a single Play build for everyone's own server. Options: (a) publish a hosted demo/instance, or (b) skip Play and rely on PWA install (Chrome "Install app"), which needs no store at all.
- **Cost:** $25 one-off Play developer registration. PWABuilder/Bubblewrap are free.
- **New personal accounts** (created after 13 Nov 2023) need a **closed test with ≥12 testers opted in for 14 continuous days** before production access. Organisation accounts are exempt.
- **Health apps:** Google says to register as an **organisation** (requires a D-U-N-S number) if you provide health apps (medical / human-subjects research). One third-party blog claims individual accounts are barred from Health/Medical categories from Jan 2026; this was **not confirmed** on Google's own page. Budget for an org account (sole trader / Ltd + D-U-N-S) to be safe.
- **Health apps declaration form** (Play Console → App content): mandatory for all developers.
- **Privacy policy:** a public, non-geofenced, non-PDF URL, identical in Console and in-app. It must disclose access to, collection, use and sharing of sensitive data. Complete the Data safety form accordingly (health + mental-health info, AI chat content).
- **Medical device status:** either declare it as a regulated device with proof, **or** put a clear disclaimer in the store description: "not a medical device and does not diagnose, treat, cure, or prevent any medical condition". Also remind users to consult a healthcare professional.
- iOS: PWAs can't go on the App Store as-is (needs a native wrapper and is subject to Guideline 4.2 rejections). Safari home-screen install works with no store.

### 3.2 UK regulation — MHRA (software as a medical device)
- **MHRA Digital Mental Health Technology (DMHT) guidance, final Feb 2025.** A product is SaMD when it has (1) a **medical intended purpose** (diagnosis, prevention, monitoring, prediction, treatment or alleviation of mental ill health, or use within an NHS service) **and** (2) **high functionality** (non-easily-verifiable algorithms/AI, personalised interactive outputs).
- **Questionnaires:** a validated questionnaire (PHQ-9, GAD-7, WHO-5, AUDIT-C) that outputs the **score unchanged with easily-verifiable arithmetic** is *low functionality* → **not a device**. It **becomes risky** when it combines scoring with **personalised recommendations or triage**. Commentators describe that as screening and clinical output. The MHRA treated Limbic as a device despite its wellness framing. Symptom checkers that signpost are Class I under UK MDR (IIa if they "allow direct diagnosis"). In EU / Northern Ireland, most DMHTs are minimum Class IIa (notified body).
- **Implications for this app:**
  - Keep the measures as a **self-monitoring diary**: show the raw score and standard published bands, offer a PDF "to take to your GP", **no diagnosis language**, no personalised treatment recommendation.
  - Keep crisis signposting **static and universal**: Samaritans 116 123, NHS 111 option 2, 999 shown to everyone who hits the deterministic screen. Don't tailor clinical advice.
  - The **AUDIT-C "withdrawal-risk gate"** is the riskiest feature: it algorithmically turns a score into advice to see a GP before stopping drinking. That is a safety-relevant output. Mitigate by making it plain, static, universal guidance (published NHS / Alcohol Change advice that heavy drinkers should get medical advice before stopping) rather than a personalised risk assessment. Frame the whole product's intended purpose as wellbeing / self-management, not management of mental ill health.
  - The **AI coach** is "high functionality". Keep its intended purpose non-medical (planning, habits, motivation) and never let it interpret measure scores clinically. Write the intended-purpose statement down — the MHRA looks at both the stated intended purpose and the functionality.
  - If it's offered to or recommended by an NHS service, it falls in scope much more readily.
- Not legal advice. If in doubt, the MHRA runs a free regulatory query service (devices.regulatory@mhra.gov.uk), and its guidance flowcharts are designed for self-assessment.

### 3.3 UK GDPR
- Mood scores, PHQ-9/GAD-7, substance use and the AI chat about them are **health data = special category** (Art. 9).
- **Self-hosted only (FOSS release):** each operator is the controller for their own instance. The developer processes no personal data and has no controller duties, just good practice: secure defaults, encryption at rest, no telemetry. Say plainly in the README that the developer does not see the data. Any optional web search or remote LLM endpoint sends text to a third party — warn users clearly at configuration time.
- **Hosted service (e.g. a public instance or the Play TWA build):** you become the **controller**. You need:
  - an Art. 6 lawful basis **plus** an Art. 9 condition — realistically **explicit consent**: separate, specific, opt-in, withdrawable;
  - a **DPIA** — health data at scale is "likely high risk";
  - an **ICO data protection fee** registration;
  - a privacy notice and data-subject-rights handling (access, erasure, export);
  - processor terms with your host and any LLM / search provider;
  - breach procedures;
  - **ICO Children's Code** applies if under-18s could use it — make it 18+.
  - The current encryption-at-rest + PIN design helps but doesn't replace these.

---

## Sources
- Finch: [Play](https://play.google.com/store/apps/details?id=com.finch.finch&hl=en_US), [App Store](https://apps.apple.com/us/app/finch-self-care-pet/id1528595748), [$30M ARR profile](https://blog.sparrowapps.io/p/finch-how-a-self-care-app-hit-30m-arr-without-vc-money), [finchcare.com](https://finchcare.com/), [Slate review 2026-09](https://slate.com/technology/2026/09/finch-app-self-care-wellness-review.html), [FINCH TM 90167826 (Windy Valley, abandoned)](https://uspto.report/TM/90167826), [Finch Therapeutics TM](https://trademarks.justia.com/972/47/finch-97247034.html)
- ADHD apps: [KickMint comparison](https://kick-mint.com/compare/), [ChoosingTherapy best ADHD apps](https://www.choosingtherapy.com/best-adhd-apps/), [Inflow review](https://www.selfpause.com/resources/inflow), [Tiimo review](https://www.selfpause.com/resources/tiimo), [Numo App Store](https://apps.apple.com/us/app/numo-adhd-app-for-adults/id1628994767), [Shimmer pricing](https://neurolaunch.com/shimmer-adhd-coaching/), [Focus Bear pricing](https://www.focusbear.io/pricing), [Saner.AI review](https://aichief.com/ai-productivity-tools/saner-ai/), [Lunatask](https://lunatask.app/), [Llama Life Capterra](https://www.capterra.com/p/253326/Llama-Life/), [Routinery review](https://makeheadway.com/blog/routinery/), [Focused Flow](https://play.google.com/store/apps/details?id=io.focusedflow.app), [Mindflow AI](https://apps.apple.com/us/app/mindflow-ai-overcome-adhd/id6743873832)
- Pet apps: [Sprout virtual pet](https://www.sproutapp.tech/features/virtual-pet), [Otto](https://play.google.com/store/apps/details?id=com.otto.ottocareapp&hl=en), [Buddy ADHD](https://play.google.com/store/apps/details?id=com.kedi.dehb_destek&hl=en_CA), [Pocket Kin](https://github.com/chartmann1590/pocket-kin), [Fernlet](https://github.com/bowman-mw/fernlet), [Mossling](https://github.com/joshrwolf/mossling), [QuillBy](https://play.google.com/store/apps/details?id=com.quillbyapp&hl=en_US)
- Sobriety: [I Am Sober review](https://www.choosingtherapy.com/i-am-sober-app-review/), [Reframe review](https://www.choosingtherapy.com/reframe-app-review/)
- FOSS: [GitHub adhd-tools topic](https://github.com/topics/adhd-tools), [habit-tracking topic](https://github.com/topics/habit-tracking), [Beaver Habits](https://github.com/daya0576/beaverhabits), [mhabit](https://github.com/friesi23/mhabit)
- Name collisions: [Bramble Play results](https://play.google.com/store/apps/details?id=com.kineticorigin.bramble&hl=en), [Bramble: Talk About Feelings](https://play.google.com/store/apps/details?id=com.letsbramble.bramble&hl=en_CA&gl=US), [Wisp](https://play.google.com/store/apps/details?id=io.wisp_app.wisp&hl=en_IE), [Wisp mood](https://apps.apple.com/us/app/wisp-mood-tracker-self-care/id6745816249), [Sprig food scanner](https://apps.apple.com/us/app/sprig-clean-food-scanner/id6761384794), [Mudlark Publishing TM](https://trademarks.justia.com/876/82/mudlark-87682666.html), [Tuft & Needle TM](https://trademarks.justia.com/861/91/tuft-86191760.html), [Hedgelet definition](https://investinganswers.com/dictionary/h/hedgelet)
- Play publishing: [TWA quick start](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start), [Bubblewrap](https://github.com/googlechromelabs/bubblewrap), [PWA publishing 2026](https://www.mobiloud.com/blog/publishing-pwa-app-store/), [12 testers/14 days](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en), [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en), [Choose account type](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en), [Jan 2026 health update (third-party)](https://myappmonitor.com/blog/google-play-health-apps-update-2026-requirements)
- MHRA: [Hardian Health DMHT summary](https://www.hardianhealth.com/insights/regulation-of-digital-mental-health-technologies), [Bristows on DMHT guidance](https://inquisitiveminds.bristows.com/post/102jzqs/a-wellcome-development-for-samd-the-uk-publishes-guidance-on-digital-mental-hea), [Is a mental health app a medical device?](https://qualihq.com/guides/is-a-mental-health-app-a-medical-device), [Superscript on DMHT rules](https://gosuperscript.com/news-and-resources/new-rules-for-digital-mental-health-apps/)
- ICO: [Special category data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/), [Conditions for processing](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-conditions-for-processing/)
