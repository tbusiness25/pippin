# Sobriety / drink-reduction apps and digital alcohol interventions

Scope: what leading apps do, what the evidence says works or harms, how good apps handle lapses. Aimed at an "I Am Sober"-like tracker for a UK adult's one-year alcohol-free challenge, released open source. Researched 2026-10-02. About 20 tool calls; several primary sources (Lancet eClinicalMedicine, Cochrane, PubMed, Nature) returned 403 or redirects, so some figures come from abstracts, university press releases or search snippets. Where that applies, it is flagged.

---

## 1. Feature inventories of leading apps

### Takeaway
The sobriety-counter apps (I Am Sober, Nomo, Loosid, Sober Tracker and similar) share a core: a start-date clock, milestones or chips, savings (money, time, calories), a daily pledge or check-in, a "reasons" list, and community or accountability partners. The UK evidence-based apps (Drink Less from UCL, Try Dry from Alcohol Change UK) are built around drink logging, goals, units/calories/money, and feedback, and they support cutting down as well as stopping. Paywalls on backup and community are the main commercial pattern, and users dislike them.

### Cited Findings
**I Am Sober**
- Daily pledge plus an evening "review", with configurable reminder times. — [I Am Sober FAQ](https://iamsober.com/en/site/faq)
- Milestones are calculated automatically from the start date (days, weeks, months, years). Users can share a story when they reach one. — [I Am Sober FAQ](https://iamsober.com/en/site/faq)
- There are four savings types: money (29 currencies), time, calories, or custom units, all calculated from sober days. — [I Am Sober FAQ](https://iamsober.com/en/site/faq)
- A "reasons" list ("why I'm sober") can be added to, edited and reordered, and is shown during the daily review. — [I Am Sober FAQ](https://iamsober.com/en/site/faq)
- Community: users post stories at milestones and can flag or block. Access requires **5 completed pledges** first, a deliberate gate. — [I Am Sober FAQ](https://iamsober.com/en/site/faq)
- **Reset behaviour:** "Your current clock starts from zero and milestones are recalculated from the new date", but "all your previous start dates, milestone history, reasons, savings data, and photos" are preserved. The calendar shows the full history across all periods, and an accidental reset can be undone by editing the start date. — [I Am Sober FAQ](https://iamsober.com/en/site/faq); [search summary of FAQ](https://iamsober.com/en/site/faq)
- Multiple habits: 2 on the free tier, up to 10 with Sober Plus, each with its own clock and history. — [I Am Sober FAQ](https://iamsober.com/en/site/faq)
- Sober Plus (subscription) unlocks cloud backups, full journaling, community reactions, motivation packs, the Apple Watch app and more habits. Privacy features include a custom app icon, biometric/passcode lock and hiding the community. — [I Am Sober FAQ](https://iamsober.com/en/site/faq)

**Nomo (Sobriety Clocks)**
- Unlimited clocks for "hurts, habits, or hang ups", private by default. — [App Store](https://apps.apple.com/us/app/nomo-sobriety-clocks/id566975787)
- "Refocus" mini-games/exercises for moments of temptation, described as a stand-in when you "don't have time to go to a meeting or phone a fellow person in recovery". — [Sober Library](https://soberlibrary.com/nomo-sobriety-app/); [App Store](https://apps.apple.com/us/app/nomo-sobriety-clocks/id566975787)
- Accountability partners: search for a partner, share selected clocks, private messaging, notify partners when tempted or when a clock is reset, chips at milestones, progress shown to the minute, money saved, check-ins. — [App Store](https://apps.apple.com/us/app/nomo-sobriety-clocks/id566975787)

**Try Dry (Alcohol Change UK)**
- Free, charity-funded, the official Dry January app. Supports cutting back as well as stopping ("unlike 'sobriety-only apps'"). Features: "planned drinking", custom goals, missions, tracking of units, calories and money saved, badges with in-app celebrations, charts, daily reminders, and email coaching. — [Alcohol Change UK](https://alcoholchange.org.uk/help-and-support/managing-your-drinking/dry-january/get-involved/the-dry-january-app); [App Store](https://apps.apple.com/us/app/try-dry-the-dry-january-app/id1441293755)
- Ratings around 4.8 on iOS (2.8K ratings) and 4.7 on Google Play (4.26K reviews), per the search snippet. — [App Store](https://apps.apple.com/us/app/try-dry-the-dry-january-app/id1441293755); [Google Play](https://play.google.com/store/apps/details?id=uk.org.alcoholconcern.dryjanuary&hl=en_US)

**Drink Less (UCL)**
- Features: goal setting, drink recording, logging mood and sleep after drinking, progress against goals, personalised feedback, action planning, and normative comparison against the UK population. — [MedicalXpress / UCL release](https://medicalxpress.com/news/2024-03-app-people-alcohol-intake.html)
- In the trial, 85% of screen views were in the Self-monitoring & Feedback module, which is how most people use the app. — [npj Digital Medicine process evaluation](https://www.nature.com/articles/s41746-024-01169-7)

**Reframe / Sunnyside**
- Reframe offers drink-tracking analytics and educational and motivational content. Its marketing claim that "91% of users see a difference in 3 months" is self-reported and not peer-reviewed. — [Reframe](https://www.reframeapp.com/)
- Sunnyside is a text-message-based moderation platform: daily SMS check-ins, drink tracking and plans. It now also markets naltrexone. — [Sunnyside](https://www.sunnyside.co/); [Trustpilot listing title](https://www.trustpilot.com/review/sunnyside.co)

**Loosid**
- Sobriety tracker with milestones, plus social chat, sober dating, sober events, local guides to alcohol-free venues and options, and "Recovery Voices" stories. — [Google Play](https://play.google.com/store/apps/details?id=com.loosidapp&hl=en_US); [Loosid](https://loosidapp.com/sobriety-app/)

**SMART Recovery**
- A CBT-based self-empowerment approach, with virtual meetings and a mobile app for education and support. — [Loosid overview page (secondary)](https://loosidapp.com/apps-to-help-stay-sober-discover-their-role-in-recovery/)

**Newer "no-punishment" trackers**
- SoberStack: "progress isn't erased by a slip", with a current streak plus a history graph. Sober Tracker: reset keeps history, and a "Phoenix badge" is awarded for coming back after a setback. — [SoberStack](https://soberstack.app/); [Sober Tracker](https://sober-tracker.com/)

### Inferences
- The minimum feature set for a credible "I Am Sober-like" app: start-date clock, auto milestones, money/calorie/unit savings, morning pledge plus evening review, an editable reasons list, history-preserving reset, multiple trackers, app lock or discreet icon, and local backup/export. For an open-source release, putting backup and export in the free core directly addresses I Am Sober's most-hated paywall.
- The UK apps (Try Dry, Drink Less) include "cut down" modes and units, which a UK user will expect. A one-year AF challenge app could still log any drinks that happen (units, context) instead of only resetting.
- Gating community access behind 5 completed pledges is a cheap, sensible moderation idea worth copying if any social feature is added.

### Gaps
- No primary feature pages were fetched for **Club Soda, Quit That!, Sober Time, AA meeting-finder apps (e.g. Meeting Guide) or 24-hour-chip apps**, and the SMART Recovery app's specific tools (cost-benefit analysis, ABC worksheet) were not confirmed from a primary source. These need direct checks before anyone cites them.
- One 2024 release said Drink Less was "not yet available" on Android. Its 2026 Android status was not verified.

---

## 2. Evidence: what works

### Takeaway
Digital alcohol interventions produce small but real average reductions (about 23 g/week, roughly 3 UK units, in the Cochrane review). The flagship UK RCT of Drink Less found only a small effect (about 1 to 2 units/week) against an active NHS-webpage comparator. BCT meta-regression points to behaviour substitution, problem solving and a credible source as active ingredients. Self-monitoring is how users actually engage, and it appears to be the mechanism.

### Cited Findings
- **Cochrane (Kaner et al. 2017):** 57 studies with 34,390 participants. In the primary meta-analysis (41 studies, 19,241 participants), digital-intervention users drank **about 23 g less alcohol per week** (about 3 UK units) than no/minimal-intervention controls at end of follow-up. Evidence quality was moderate. — [Cochrane Library](https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD011479.pub2/full); [UCL Discovery PDF](https://discovery.ucl.ac.uk/id/eprint/10024516/1/Kaner_Personalised_digital_interventions.pdf) (figures from search snippet; full text not fetched)
- **BCT meta-regression (Garnett et al. 2018, Ann Behav Med), 41 RCTs from the Cochrane review:**
  - Behaviour substitution: −95.1 g/week (about 12 units), 95% CI −162.9 to −27.3. Preliminary: only 4 trials, 3 of them from the same group.
  - Problem solving: −45.9 g/week (about 6 units).
  - Credible source: −32.1 g/week (about 4 units).
  - Feedback on behaviour (86% of trials) and social comparison (81%) showed no significant independent effect.
  - Self-monitoring (26%) and goal setting (29%) were under-used, so their effect couldn't be estimated well.
  - Interventions used a mean of 9.2 BCTs. The **number of BCTs was not associated with effectiveness**.
  — [PMC6361280](https://pmc.ncbi.nlm.nih.gov/articles/PMC6361280)
- **Drink Less RCT (Oldham, Garnett, Brown et al., eClinicalMedicine, March 2024):**
  - Design: n=5,602 UK increasing/higher-risk drinkers, double-blind. Drink Less (n=2,788) vs the NHS alcohol advice webpage (n=2,814). Follow-up at 6 months was 79–80%. — [SSRN preprint](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4495135)
  - Conservative ITT primary analysis: a **non-significant** extra reduction of 0.98 units/week (95% CI −2.67 to 0.70), Bayes factor 1.17 (data insensitive). — [search summary of SSRN/UCL](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4495135)
  - The UCL press release frames it as a 39 vs 37 unit/week reduction, i.e. about 2 more units with the app, and 2.5 more units in women. — [MedicalXpress / UCL](https://medicalxpress.com/news/2024-03-app-people-alcohol-intake.html)
  - **Caveat:** the press release's "2 units" relies on non-conservative analyses, while the pre-registered conservative ITT was null. Large reductions in *both* arms suggest strong regression to the mean, assessment reactivity, or an effective control.
- **Drink Less mechanism (process evaluation):** most engagement went to self-monitoring and feedback (85% of screen views). Being recommended a digital tool and tracking consumption appear to underlie effectiveness. Baseline motivation did not moderate the effect. — [npj Digital Medicine 2024](https://www.nature.com/articles/s41746-024-01169-7)
- **Drink Less qualitative evaluation:** users rated it ethical, easy and effective, and especially liked tracking and feedback, which "increased personal relevance and resulted in positive affect when achieving goals". — [JMIR 2024 e42319](https://www.jmir.org/2024/1/e42319)
- **Sunnyside (Vadhan et al. 2024, Alcohol Clin Exp Res):** among about 46,000 users, drinks per week fell 33% over 12 weeks, with most of the reduction in the early weeks. 64.3% drank 7 days a week at baseline. More severe baseline drinking was associated with greater relative benefit. This was an observational, company-linked study with no control group. — [ACER](https://onlinelibrary.wiley.com/doi/10.1111/acer.15414); [Sunnyside blog](https://www.sunnyside.co/blog/sunnyside-efficacy-study/)
- **Reframe:** no peer-reviewed outcome trial was found. The only outcome claim is its own marketing (91% see a difference). — [Reframe](https://www.reframeapp.com/)
- **Population reach (US, 2024):** about 6% of US adults reported using alcohol-reduction apps, and for most it was their only support. The most-used features were motivational content, consumption tracking and education. — [PMC11845864](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11845864/)

### Inferences
- Design priorities supported by evidence: (1) frictionless self-monitoring, which is the engagement core; (2) behaviour substitution ("what will I do/drink instead", alcohol-free alternatives); (3) problem-solving and if-then plans for high-risk situations; (4) credible-source framing (NHS/UK CMO guidance, Alcohol Change UK). Piling on BCTs does not help.
- Normative and social-comparison feedback has weak independent evidence, so it is optional rather than core.
- Expect modest average effects. The app's value for a committed one-year AF user is more about sustaining an already-made decision (self-efficacy, lapse recovery) than about persuasion.

### Gaps
- The 2024 Drink Less full text could not be fetched (Lancet 403), so the exact secondary-analysis figures and baseline units are unconfirmed beyond the press release. A 2025 Drink Less follow-up or cost-effectiveness paper was not located.
- No direct evidence was found on **identity-change** components (e.g. "I am a non-drinker" framing) in alcohol apps. The Drink Less factorial trial (Crane et al. 2018, Sci Rep) tested identity change and other modules, but the Nature page redirected to login and was not read.
- The Kwan et al. 2025 Addiction meta-analysis of remote/digital treatment and recovery support was seen in results but not read. — [Addiction 2025](https://onlinelibrary.wiley.com/doi/10.1111/add.70021)

---

## 3. Dry January / one-year challenges: outcomes, who benefits, rebound

### Takeaway
Temporary-abstinence challenges are associated with lower drinking, higher drink-refusal self-efficacy and better wellbeing at 6 months, and rebound is uncommon. But the evidence is mostly uncontrolled and self-selected, and it skews towards higher-income, educated, female, lighter drinkers. Using the app plus email support roughly doubles the chance of completing the month. No evidence was found specifically on 365-day challenges.

### Cited Findings
- **Scoping review (Strowger et al. 2025, Alcohol & Alcoholism):**
  - 16 empirical studies, 10 of them UK, and mostly observational. About two-thirds of registrants complete the month.
  - Outcomes: lower consumption and AUDIT scores at 1–6 months, plus higher drink-refusal and general self-efficacy and better wellbeing among completers.
  - Physiological changes reported: liver fat −15%, blood glucose −23%, improved insulin resistance, weight loss, and better sleep.
  — [Alcohol & Alcoholism](https://academic.oup.com/alcalc/article/60/5/agaf057/8249062)
- **Rebound** is a minority outcome: 8% of successful abstainers vs 15% of unsuccessful participants reported more frequent drunkenness at 6 months. — [Alcohol & Alcoholism](https://academic.oup.com/alcalc/article/60/5/agaf057/8249062)
- **Who participates and benefits:** participants are more often higher-income, university-educated, female and younger. Light-to-moderate drinkers succeed more often than heavier drinkers. — [Alcohol & Alcoholism](https://academic.oup.com/alcalc/article/60/5/agaf057/8249062)
- **Population effect:** rising participation (2015–2018) was not associated with population-level changes in drinking. — [Alcohol & Alcoholism](https://academic.oup.com/alcalc/article/60/5/agaf057/8249062)
- **Support channels:** 96% of registrants signed up for emails and about 70% read every one. 57% used text support, and 78% of them found it helpful. Try Dry app users rose 38.4% from 2020 to 2021; users were 70% female, mean age 42.8. — [Alcohol & Alcoholism](https://academic.oup.com/alcalc/article/60/5/agaf057/8249062)
- **de Visser (Sussex) 2019 evaluation:** over 6,000 participants surveyed in January, early February and August. Self-efficacy stayed higher at 6 months. Among those who stayed fully dry, 59% reported reduced intake, 49% more control and 43% better mental wellbeing at 6 months. Rebound was "uncommon". — [Alcohol Change UK: the evidence](https://alcoholchange.org.uk/blog/dry-january-the-evidence); [de Visser 2019 evaluation PDF](https://www.drugsandalcohol.ie/32647/1/R-de-Visser-Dry-January-evaluation-2019.pdf); [Sussex news](https://www.sussex.ac.uk/broadcast/read/50562)
- With the Try Dry app plus the daily email journey, participants "double their chances" of a fully AF month vs going it alone, and 70% are still drinking less 6 months later. This is an Alcohol Change UK claim citing Sussex research. — [Alcohol Change UK](https://alcoholchange.org.uk/help-and-support/managing-your-drinking/dry-january/get-involved/the-dry-january-app)
- Even participants who did *not* fully complete the month showed benefits in de Visser's evaluations. Rebound was higher among non-completers (see 15% above). — [Alcohol & Alcoholism](https://academic.oup.com/alcalc/article/60/5/agaf057/8249062)

### Inferences
- For a one-year challenge, the strongest analogues are the self-efficacy findings. The app should explicitly build and reflect *confidence and control*, e.g. a periodic drink-refusal self-efficacy check-in, instead of just counting days.
- Because non-completers still benefit and rebound is worse among them, a lapse should be framed as "still in the challenge". Abandonment is the bad outcome, not a single drink.
- Daily email/text-style nudges are heavily used and valued. A daily, short, content-bearing notification (not just "check in!") is justified.
- Planning for day 366 matters: the evidence covers a 1-month challenge followed by 6 months of tracking. An end-of-challenge "what next" (continue, moderate, re-commit) is a sensible guard against rebound, but this is inference, not tested.

### Gaps
- No studies were found on **year-long** AF challenges (e.g. "One Year No Beer" or Club Soda programmes). Evidence beyond 6 months is lacking.
- No RCT evidence exists for Dry January itself apart from one trial noted in the scoping review. Its results were not extracted.

---

## 4. Harms and design pitfalls: lapses, streaks, shame, community

### Takeaway
A hard streak reset maps directly onto Marlatt's abstinence violation effect (AVE): a lapse read as total failure ("I've blown it") drives relapse. Good apps keep the full history, show cumulative progress alongside the current streak, and reward returning. Open communities carry real moderation risk, including self-harm content and minors.

### Cited Findings
- The AVE is the self-blame, guilt and loss of perceived control after breaking a self-imposed rule. It has an affective component (guilt, shame, hopelessness) and a cognitive component. — [Collins & Witkiewitz, AVE chapter](https://www.researchgate.net/profile/Susan-Collins-6/publication/281298055_Abstinence_Violation_Effect/links/5600d24e08aeafc8ac8c7a55/Abstinence-Violation-Effect.pdf)
- Marlatt's relapse prevention model separates an initial **lapse** from a full **relapse**. A lapse raises relapse risk, but "the progression from lapse to relapse is not inevitable". Immediate determinants include high-risk situations, coping skills, outcome expectancies and the AVE. — [Larimer, Palmer & Marlatt, PMC6760427](https://pmc.ncbi.nlm.nih.gov/articles/PMC6760427/)
- Attributions matter: how people explain a lapse (internal, stable, global vs situational) predicts whether it becomes a relapse. — [PubMed 7942249](https://pubmed.ncbi.nlm.nih.gov/7942249/) (abstract-level only)
- Design critique from practitioners and developers: "Miss a day, the streak resets to zero. The entire product is built on the exact mechanic the science says hurts you most." — [Medium, habit-tracker test](https://medium.com/@wardtylerd/i-tested-10-habit-trackers-in-30-days-8-broke-me-the-same-way-9803ea20b228); [DEV: sobriety tracker that doesn't punish slips](https://dev.to/spencer_walden_9ca6a84f9f/i-built-a-free-sobriety-tracker-that-doesnt-punish-you-for-slipping-up-4lao). These are opinion pieces, not research.
- **Counter-patterns in apps:**
  - I Am Sober preserves all prior start dates and history on reset.
  - SoberStack keeps a history graph.
  - Sober Tracker awards a "Phoenix" badge for recovering after a setback.
  - Way of Life (a habit app) has an "intentional skip" state.
  — [I Am Sober FAQ](https://iamsober.com/en/site/faq); [SoberStack](https://soberstack.app/); [Sober Tracker](https://sober-tracker.com/); [Medium](https://medium.com/@wardtylerd/i-tested-10-habit-trackers-in-30-days-8-broke-me-the-same-way-9803ea20b228)
- Recovery-industry discussion presents day-counting as having both benefits (motivation, accountability) and drawbacks (pressure, shame on reset). — [Recovery.com](https://recovery.com/resources/to-count-or-not-to-count-the-pros-and-cons-of-counting-sobriety-days/)
- **Community toxicity:** I Am Sober App Store reviews report harmful comments, including encouragement to self-harm, and minors discussing vaping and self-harm in the community feed. — [App Store reviews via search summary](https://apps.apple.com/us/app/i-am-sober/id672904239?see-all=reviews); [Unstar negative reviews](https://unstar.app/app/672904239?platform=ios&country=pl)
- **Data loss as harm:** users report losing their sobriety progress and milestones because automatic backup is paywalled, unexpected full resets, and off-by-one day counts. — [JustUseApp reviews](https://justuseapp.com/en/app/672904239/i-am-sober/reviews); [AppSupports negative reviews](https://appsupports.co/672904239/i-am-sober/negative-reviews)

### Inferences
- Recommended lapse model for the build:
  - Track **"days since last drink" (current streak)** and **"total alcohol-free days this challenge / this year"** (e.g. "347 of 365 days AF") side by side, with the cumulative figure given equal or greater prominence.
  - Never delete history. Show the year as a calendar heatmap where a lapse is one cell, not a wiped slate.
  - Log a lapse as an event with context (units, trigger, setting, feeling) instead of a "reset" button. The flow should prompt a non-judgemental problem-solving step ("what was going on? what's the plan next time?"), which uses the problem-solving BCT that the meta-regression supports.
  - Use language like "lapse", "slip" or "drink day", not "relapse" or "failed". Offer a "return" acknowledgement (like the Phoenix badge) without gamified shame.
  - Make the challenge goal explicit, e.g. "AF days out of 365", so one drink costs one day, not the whole year.
- The project's no-shame principle (no streaks or shame mechanics) aligns with this. A primary display of cumulative AF days, with the current run secondary, fits both the evidence and that principle.
- For an open-source/public release: make any community feature optional or omit it. If included, gate it (pledge-count gate), require 18+, and moderate it. Ship robust local backup/export so a user can never lose their history.
- Off-by-one and timezone bugs are a real complaint, so day counting should be timezone-aware, use a clear "start of day" rule, and allow manual date editing.

### Gaps
- No peer-reviewed study was found that directly compares streak-reset vs cumulative-count displays in alcohol apps. The AVE link is theoretical extrapolation plus designer opinion. No qualitative study of shame from app counters was located.
- No data was found on the prevalence of community toxicity across apps beyond I Am Sober reviews.

---

## 5. Money / calorie / unit calculators and benefits displays

### Takeaway
Money, calorie and unit savings are near-universal in these apps (I Am Sober, Nomo, Try Dry, Drink Less). Users like tracking and feedback, but no evidence was found isolating savings displays as an active ingredient. "Feedback on behaviour" showed no significant independent effect in the BCT meta-regression.

### Cited Findings
- Try Dry tracks units, calories and money saved. I Am Sober tracks money, time, calories or custom units. Nomo tracks money saved. — [Alcohol Change UK](https://alcoholchange.org.uk/help-and-support/managing-your-drinking/dry-january/get-involved/the-dry-january-app); [I Am Sober FAQ](https://iamsober.com/en/site/faq); [App Store Nomo](https://apps.apple.com/us/app/nomo-sobriety-clocks/id566975787)
- Feedback on behaviour (86% of trials) was not significantly associated with effectiveness in adjusted models. — [Garnett et al. 2018, PMC6361280](https://pmc.ncbi.nlm.nih.gov/articles/PMC6361280)
- Drink Less users particularly liked tracking and feedback, citing personal relevance and positive affect on hitting goals. — [JMIR 2024](https://www.jmir.org/2024/1/e42319)
- The physiological benefits reported after a month off (liver fat −15%, glucose −23%, weight, sleep) provide credible content for a "benefits" timeline. — [Alcohol & Alcoholism scoping review](https://academic.oup.com/alcalc/article/60/5/agaf057/8249062)

### Inferences
- Include money/units/calories as cheap, well-liked feedback, but don't expect them to drive outcomes. Base them on the user's own pre-challenge baseline (typical week: units, spend). UK units should be first-class: 14 units/week is the UK CMO low-risk guideline (general knowledge; cite the NHS/CMO page in the report).
- Health-benefit milestones should cite credible sources (NHS, Alcohol Change UK) to exploit the "credible source" BCT, and should avoid overclaiming precise timelines.

### Gaps
- No experimental evidence was found on money-saved or calorie displays specifically motivating abstinence. This needs a targeted search, e.g. on "loss framing" or financial incentives.

---

## 6. What users love and hate (reviews, r/stopdrinking)

### Takeaway
Users love simple tracking, the daily pledge ritual, milestones and the sense of a sober peer group. Users hate paywalled backup and community, data loss, counter bugs and unmoderated communities. On r/stopdrinking, IWNDWYT is a public, daily, one-day-at-a-time pledge culture with a day-count badge that resets on a lapse.

### Cited Findings
- IWNDWYT means "I will not drink with you today". It is a daily public pledge renewed each morning, and the "with you" (shared commitment) is described as the active ingredient. — [AddictionHelp](https://www.addictionhelp.com/alcohol/iwndwyt/); [Innovo Detox](https://www.innovodetox.com/addiction/alcohol/iwndwyt-meaning-reddit/)
- r/stopdrinking has a daily check-in thread, milestone celebrations and an optional auto-updating days-sober badge that resets to the new date after a drink. Most posters aim for full abstinence. — [ChooseYourHorizon](https://www.chooseyourhorizon.com/blog/stopdrinking-reddit); [Exploring Sobriety Substack](https://exploringsobriety.substack.com/p/how-reddit-saved-my-sobriety) (secondary sources; Reddit not fetched directly)
- I Am Sober positives: helpful for tracking, inspirational quotes. Negatives: everything beyond tracking requires a subscription (including community access for UK users), paywalled backups leading to lost progress, unexpected resets, wrong day counts, and toxic community content. — [ChoosingTherapy review](https://www.choosingtherapy.com/i-am-sober-app-review/); [App Store reviews](https://apps.apple.com/us/app/i-am-sober/id672904239?see-all=reviews); [JustUseApp](https://justuseapp.com/en/app/672904239/i-am-sober/reviews)
- Self-reported adherence to Drink Less in trial data was 78%. Tracking is what people use (85% of screen views). — [npj Digital Medicine](https://www.nature.com/articles/s41746-024-01169-7)

### Inferences
- A morning pledge plus an evening "did you stay AF?" check-in is the ritual core users value. It mirrors both IWNDWYT and I Am Sober's pledge/review loop. The evening check-in also provides passive self-monitoring data without requiring drink logging.
- For a solo-user build, a social element could be a single accountability partner (e.g. a partner or friend), or Nomo-style clock sharing, rather than an open community.
- Selling points for an open-source release: free backup/export, no paywall, no ads, private by default.

### Gaps
- Reddit was not fetched directly. Claims about badge mechanics and daily-thread culture come from secondary blogs. No systematic review-mining study of sobriety-app reviews was found.
- No user-review data was gathered for Nomo, Loosid, Reframe or Sunnyside complaints (e.g. Reframe's subscription price).
