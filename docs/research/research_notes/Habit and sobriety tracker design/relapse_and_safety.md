# Relapse prevention, alcohol clinical safety, and ADHD-and-alcohol (for a UK self-help sobriety tracker)

Context: an adult with diagnosed, medicated ADHD starting a one-year alcohol-free challenge. Research done 2026-10-02. All claims carry inline sources; unsourced points are in Gaps.

## 1. Relapse prevention model (Marlatt & Gordon; Witkiewitz & Marlatt 2004) and lapse design

### Takeaway
Relapse prevention (RP) treats a lapse (a single return to drinking) as distinct from relapse (return to the pre-change pattern); the bridge between them is often the abstinence violation effect (AVE) — self-blame, guilt and perceived loss of control. The 2004 dynamic model frames relapse as non-linear and driven by stable "tonic" risk (craving baseline, self-efficacy, coping skills, support) interacting with "phasic" in-the-moment triggers, so an app should both build tonic resilience and give an in-the-moment response, and must frame a lapse as information, not failure.

### Cited Findings
- AVE definition: "the self-blame, guilt, and loss of perceived control that individuals often experience after the violation of self-imposed rules" — [Larimer, Palmer & Marlatt, Relapse Prevention: An Overview of Marlatt's Cognitive-Behavioral Model (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6760427/)
- A lapse is the initial return to use after an abstinence attempt; it progresses to relapse if the person returns to the pre-abstinence level of problematic use — [PMC3296289](https://pmc.ncbi.nlm.nih.gov/articles/PMC3296289); [Guilford, Marlatt & Donovan RP ch.1 excerpt](https://www.guilford.com/excerpts/marlatt.pdf)
- Witkiewitz & Marlatt (2004), "Relapse prevention for alcohol and drug problems: That was Zen, this is Tao" (American Psychologist), reconceptualised relapse as a nonlinear, probabilistic process shaped by interacting tonic and phasic influences rather than a fixed sequence; tonic factors include baseline craving, self-efficacy, motivation, coping skills and social support — [Dynamic Model of Relapse figure (ResearchGate)](https://www.researchgate.net/figure/Dynamic-Model-of-Relapse_fig1_8557471); [Guilford excerpt](https://www.guilford.com/excerpts/marlatt.pdf)
- The AVE "occurs when [a person] responds to a lapse with the thought that the lapse proves they are a failure and will never be capable of permanent abstinence, and it increases the likelihood that the patient will relapse" — [Witkiewitz et al., Mindfulness-Based Treatment to Prevent Addictive Behavior Relapse (PMC5441879)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5441879/)
- Attributions matter: internal, stable, global attributions for a lapse were studied as predictors of progression from lapse to relapse (Walton et al. 1994) — [PubMed 7942249](https://pubmed.ncbi.nlm.nih.gov/7942249/)
- Core RP components: identify high-risk situations, build coping responses; effective coping raises self-efficacy and lowers relapse probability, while lack of coping plus positive outcome expectancies for alcohol raises it — [PMC6760427](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6760427/)

### Inferences
- Lapse UX should: (a) avoid resetting a single "streak to zero" as the dominant signal (this mirrors the AVE's all-or-nothing cognition) — show total alcohol-free days / % of days and "days since" as secondary; (b) prompt a specific, situational, controllable attribution ("what was the situation, what would I do differently?") rather than a global/stable one ("I'm weak"); (c) immediately offer a "next 24 hours" plan and a high-risk-situation entry so the lapse feeds back into the coping plan. This also matches the project's no-shame design principle ("no streaks, no shame").
- The tonic/phasic split maps neatly to app features: tonic = reasons list, weekly review, sleep/medication adherence, support contacts; phasic = urge button, if-then plans, delay timer.

### Gaps
- I did not retrieve the full text of Witkiewitz & Marlatt 2004 itself; summary relies on secondary sources above.
- No RCT found testing a specific app lapse-response script vs. streak-reset on relapse outcomes.

## 2. Self-help techniques with evidence

### Takeaway
The strongest evidence is for mindfulness-based relapse prevention (MBRP, incl. urge surfing) and cognitive-behavioural RP (both beat treatment-as-usual at 6–12 months in Bowen 2014), and for if-then plans (implementation intentions), which reduce weekly consumption modestly but with fading effect beyond a month — so they need to be re-made/refreshed. Several popular techniques (HALT, "delay-distract-decide") are clinically common but I found no trial evidence for them specifically.

### Cited Findings
- **MBRP RCT (Bowen et al. 2014, JAMA Psychiatry 71(5):547–556):** 286 participants who had completed initial SUD treatment randomised to MBRP, cognitive-behavioural RP, or treatment as usual (12-step aftercare). No group differences at 3 months; at 6 months both RP and MBRP reduced risk of relapse to drug use and heavy drinking vs TAU; at 12 months MBRP showed fewer days of drug use and reduced heavy drinking vs both RP and TAU — [JAMA Psychiatry](https://jamanetwork.com/journals/jamapsychiatry/fullarticle/1839290); [PubMed 24647726](https://pubmed.ncbi.nlm.nih.gov/24647726/)
- Mechanism: mindfulness trains awareness of cues and internal states that previously triggered relapse, interrupting the habitual response; habituation may generalise to discomfort across triggers — [JAMA Psychiatry](https://jamanetwork.com/journals/jamapsychiatry/fullarticle/1839290)
- **Urge surfing**: intentionally observing and staying in contact with craving without defaulting to habitual behaviour; the urge is pictured as a wave that rises, peaks and falls, with the breath as the surfboard. MBRP participation associated with significant reductions in self-reported craving; mindfulness may weaken the craving→use link — [PMC5441879](https://pmc.ncbi.nlm.nih.gov/articles/PMC5441879/); [MBRP review, UVA](https://med.virginia.edu/perceptual-studies/wp-content/uploads/sites/360/2017/01/Mindfulness-based-prevention.pdf)
- "Acting without awareness" mediates the link between negative affect and craving — supports awareness/self-monitoring of urges and moods — [PMC7394723](https://pmc.ncbi.nlm.nih.gov/articles/PMC7394723/)
- Systematic review of MBRP effectiveness for SUD — [PMC8533446](https://pmc.ncbi.nlm.nih.gov/articles/PMC8533446/)
- **Implementation intentions (if-then plans):** Cooke et al. 2023 (Drug and Alcohol Review) meta-analysis: forming implementation intentions reduces weekly alcohol consumption (d = 0.14) but has a null effect on heavy episodic drinking. Earlier meta-analysis: overall d = 0.21; d = 0.43 when measured within one month; non-significant (d = 0.07) beyond one month. Example format: "if I am offered an alcoholic drink, then I will ask for a non-alcoholic drink" — [Cooke et al. 2023, PMC10087331](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10087331/); [EHPS meta-analysis](https://ehps.net/ehp/index.php/contents/article/view/2408/0)
- Cue exposure: craving rises and stays higher for alcohol vs water cues; heavy drinkers with poorer response inhibition show more cue-elicited craving (relevant to ADHD) — [UCLA alcohol priming / cue reactivity paper](https://addictions.psych.ucla.edu/wp-content/uploads/sites/160/2018/01/AJDAA-The-Effect-Of-Alcohol-Priming-On-Neural-Markers-Of-Alcohol-Cue-Reactivity.pdf); images of social drinking scenes raised craving regardless of whether drinks shown were alcoholic or non-alcoholic — [ScienceDirect 2024 cue-reactivity experiment](https://www.sciencedirect.com/science/article/abs/pii/S0306460324001746)
- Coping responses + self-efficacy are central RP targets (supports "my coping plan" and rehearsal features) — [PMC6760427](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6760427/)

### Inferences
- Because the if-then effect decays after ~1 month, a year-long challenge app should prompt users to review/re-form if-then plans regularly (e.g., monthly, and before known high-risk events such as birthdays/holidays).
- Urge-surfing can be delivered as a short guided timer (e.g., 5–15 min) attached to the "I'm having an urge" button, logging intensity before/after — this doubles as self-monitoring data.
- For ADHD users (poorer response inhibition, see §7), cue avoidance/planning ahead may be more valuable than relying on in-the-moment willpower.

### Gaps
- **HALT** (Hungry/Angry/Lonely/Tired): no peer-reviewed evidence found in this search; treat as a common-sense mnemonic from mutual-aid culture, not an evidence-based intervention.
- **Delay-distract-decide**: no primary evidence source found.
- **Decisional balance / "my reasons" (MI-style)**: not specifically searched to a primary source in this session; MI evidence for brief interventions exists but I did not retrieve a citation.
- **Refusal skills / social scripts**: standard component of CBT/RP; no specific trial retrieved.

## 3. Screening: AUDIT and AUDIT-C (UK thresholds, self-administration, routing to medical support)

### Takeaway
UK (OHID/gov.uk) versions: AUDIT-C (3 items, 0–12): 0–4 low, 5–7 increasing, 8–10 higher risk, 11–12 possible dependence; ≥5 is a positive screen → complete full AUDIT. Full AUDIT (10 items, 0–40): 0–7 low, 8–15 increasing, 16–19 higher, ≥20 possible dependence. NICE CG115: AUDIT ≥20 → consider assisted withdrawal / specialist assessment. An app should treat ≥20 (or any withdrawal signs, regardless of score) as "do not stop suddenly on your own — speak to your GP/local service first".

### Cited Findings
- UK AUDIT (OHID print version, WHO tool modified for UK units). Items and scoring (0/1/2/3/4):
  1. How often do you have a drink containing alcohol? Never / Monthly or less / 2–4 times per month / 2–3 times per week / 4+ times per week
  2. How many units on a typical drinking day? 0–2 / 3–4 / 5–6 / 7–9 / 10+
  3. How often 6+ units (female) or 8+ units (male) on a single occasion in the last year? Never / Less than monthly / Monthly / Weekly / Daily or almost daily
  4. Not able to stop once started (last year) — same frequency scale
  5. Failed to do what was normally expected because of drinking — same scale
  6. Needed a drink in the morning to get going after a heavy session — same scale
  7. Guilt or remorse after drinking — same scale
  8. Unable to remember the night before — same scale
  9. Have you or someone else been injured as a result of your drinking? No (0) / Yes, but not in the last year (2) / Yes, during the last year (4)
  10. Has a relative, friend, doctor or health worker been concerned or suggested you cut down? No (0) / Yes, not in last year (2) / Yes, during the last year (4)
  - Scoring: 0–7 low risk; 8–15 increasing risk; 16–19 higher risk; 20+ possible dependence. Guidance: score ≥8 → brief advice; ≥20 → consider referral to specialist alcohol harm assessment — [gov.uk AUDIT (print)](https://assets.publishing.service.gov.uk/media/6357a7af8fa8f557d85b7c44/Alcohol-use-disorders-identification-test-AUDIT_for-print.pdf)
- AUDIT-C (first 3 AUDIT items): 0–4 low, 5–7 increasing, 8–10 higher, 11–12 possible dependence; ≥5 = positive screen — [gov.uk AUDIT-C (print)](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1113177/Alcohol-use-disorders-identification-test-for-consumption-AUDIT-C_for-print.pdf); [Drinkaware, Understanding the AUDIT](https://www.drinkaware.co.uk/facts/information-about-alcohol/alcohol-and-the-facts/understanding-the-alcohol-use-disorders-identification-test)
- NICE CG115: for AUDIT ≥20, consider community-based assisted withdrawal assessment, or specialist services if safety concerns. Severity via SADQ: ≤15 mild (usually no assisted withdrawal needed); 15–30 moderate (usually needs assisted withdrawal, typically community); >30 severe (needs assisted withdrawal, typically inpatient/residential) — [NICE CG115](https://www.nice.org.uk/guidance/cg115/resources/alcoholuse-disorders-diagnosis-assessment-and-management-of-harmful-drinking-highrisk-drinking-and-alcohol-dependence-pdf-35109391116229); [BJGP summary of NICE](https://bjgp.org/content/61/593/754)
- Self-administration: Drinkaware and NHS publish AUDIT/AUDIT-C as self-completion tests — [Drinkaware](https://www.drinkaware.co.uk/facts/information-about-alcohol/alcohol-and-the-facts/understanding-the-alcohol-use-disorders-identification-test). Mode evidence (not AUDIT-specific): a meta-analysis of 460 effect sizes (n=125,672) found computerised surveys elicit more reporting of socially undesirable behaviours than paper; computer self-interviewing produced equally reliable substance-use screening data to interviewer administration (ASSIST, ICC 0.7–0.9) — [Gnambs & Kaspar 2015, Behav Res Methods](https://link.springer.com/article/10.3758/s13428-014-0533-4); [ASSIST CASI vs interviewer, PMC4414742](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4414742/)

### Inferences
- App flow: AUDIT-C at onboarding → if ≥5, offer full AUDIT → if ≥20 OR any "yes" to morning drinking (item 6 > 0 combined with daily drinking) OR any history of withdrawal symptoms/seizures, show a blocking-but-respectful "check with your GP before stopping" screen before the challenge begins. Score 16–19: strongly suggest GP/local service conversation. AUDIT should be framed as a screen, not a diagnosis.
- Use UK units in questions (as the UK version does), not "standard drinks".
- Re-running AUDIT-C at 3/6/12 months gives a meaningful progress metric for the year.

### Gaps
- No AUDIT-specific meta-analysis of self- vs interviewer-administered validity was retrieved; the WHO AUDIT manual (Babor et al. 2001) discusses self-report validity but was not fetched.

## 4. Withdrawal safety — who must not stop suddenly, what the app must say, emergency signs

### Takeaway
People who are physically dependent should not stop overnight without medical help; NHS lists morning anxiety, sweating/tremor, morning nausea/retching and vomiting as withdrawal signs needing medicine, and says call 999 for hallucinations, severe tremors or seizures/fits. Seizures typically occur 12–48 h after the last drink and delirium tremens typically 48–72 h (up to ~5 days); untreated DTs carry substantial mortality, so the app must screen for dependence before day 1 and show emergency guidance during the first 3–5 days.

### Cited Findings
- NHS: if you "have become physically dependent", "stopping overnight could be harmful"; get medical advice. Withdrawal symptoms that may need medicine: "anxiety after waking", "sweating and mild tremors", "nausea or retching in the morning", "vomiting". "Call 999 if you have severe symptoms of alcohol withdrawal, including: hallucinations; severe tremors; seizures or fits" — [NHS, Alcohol support](https://www.nhs.uk/live-well/alcohol-advice/alcohol-support/)
- NICE CG115 SADQ bands for who needs assisted withdrawal (see §3); community assisted withdrawal involves 2–4 staff contacts per week in the first week — [NICE CG115](https://www.nice.org.uk/guidance/cg115/resources/alcoholuse-disorders-diagnosis-assessment-and-management-of-harmful-drinking-highrisk-drinking-and-alcohol-dependence-pdf-35109391116229)
- Timeline: symptoms start within hours, peak 24–48 h, subside by 60–72 h; generalised seizures in 1–15%, usually 12–36 h after last drink; DTs onset usually 48–72 h (can be 1–5 days); DTs occur in <5% but mortality up to 15–20% untreated, reduced to 0–1% with treatment; first 48–72 h is the critical period — [Patient.info, Acute Alcohol Withdrawal and DTs](https://patient.info/doctor/mental-health/acute-alcohol-withdrawal-and-delirium-tremens); [NNUH Trust guideline (NHS)](https://www.nnuh.nhs.uk/publication/download/acute-alcohol-withdrawal-ca2074-v10/); [RDaSH NHS inpatient detox policy](https://www.rdash.nhs.uk/policies/alcohol-detoxification-policy-inpatients/)
- Clinical review of withdrawal management — [Day & Daly 2022, Addiction](https://onlinelibrary.wiley.com/doi/10.1111/add.15647)

### Inferences
- Mandatory app copy (pre-start screen): "If you drink every day, drink in the morning, get shakes/sweats/anxiety when you stop, or have ever had a seizure, hallucinations or confusion when stopping — don't stop suddenly on your own. Speak to your GP or local alcohol service first; they can help you stop safely." Plus: "If you or someone else has a fit, sees or hears things that aren't there, or becomes confused after stopping drinking — call 999."
- Emergency guidance should be one tap from every screen during days 0–5, and the app must not imply that "willpower" handles physical withdrawal.
- For a user with a modest AUDIT and no withdrawal history (likely the target persona), the screen is a safety net rather than a barrier; it should still be shown once.

### Gaps
- NICE CG100 (acute withdrawal management) was not fetched directly; timeline figures come from NHS trust guidelines and Patient.info. Note NICE CG115 is a 2011 guideline; check NICE for any 2025–26 update before shipping.

## 5. UK support services and numbers

### Takeaway
Core UK lines (verified 2026 via NHS/Drinkaware): Drinkline 0300 123 1110; AA Great Britain 0800 917 7650; We Are With You 0808 801 0750 (plus webchat); Samaritans 116 123 (24/7); Al-Anon 0800 008 6811; Nacoa 0800 358 3456; Mind 0300 123 3393; FRANK 0300 123 6600; Scotland Drinkline 0800 7314 314; Wales DAN 24/7 0808 808 2234. SMART Recovery UK offers face-to-face and online meetings (no helpline number found). GP / local NHS alcohol service for medical support; 999 for emergencies.

### Cited Findings
- Drinkline 0300 123 1110, weekdays 9am–8pm, weekends 11am–4pm; Nacoa 0800 358 3456; NHS also lists AA, Al-Anon, WithYou, Adfam, SMART Recovery — [NHS, Alcohol support](https://www.nhs.uk/live-well/alcohol-advice/alcohol-support/)
- AA GB 0800 917 7650 (help@aamail.org); We Are With You 0808 801 0750; Al-Anon 0800 008 6811; FRANK 0300 123 6600 (24/7); Samaritans 116 123 (24/7, jo@samaritans.org); Mind 0300 123 3393; Drinkline Scotland 0800 7314 314; DAN Wales 0808 808 2234 (24/7) — [Drinkaware support lines](https://www.drinkaware.co.uk/advice-and-support/alcohol-support-services/support-lines)
- AA helpline confirmed as free and confidential; meetings online and in person — [AA Great Britain](https://www.alcoholics-anonymous.org.uk/helpline/contact/)
- We Are With You webchat weekdays 10am–4pm and 6pm–9pm, weekends 11am–4pm; SMART Recovery runs face-to-face and online meetings — [Alcohol Change UK, Get help now](https://alcoholchange.org.uk/help-and-support/get-help-now); [Mind useful contacts](https://www.mind.org.uk/information-support/types-of-mental-health-problems/recreational-drugs-alcohol-and-addiction/drug-and-alcohol-addiction-useful-contacts/)

### Inferences
- The brief's "0800 9177 650" is the same number as AA's 0800 917 7650 (different digit grouping) — fine to display as 0800 917 7650.
- Numbers and opening hours change; store them in a single editable config and show a "last checked" date.

### Gaps
- SMART Recovery UK phone number not found; link to smartrecovery.org.uk instead (URL not verified in this session).
- Alcohol Change UK's "Try Dry" app is the Dry January companion — not verified here.

## 6. UK CMO low-risk drinking guidelines and unit maths

### Takeaway
UK CMOs (2016, still current per NHS): men and women should not regularly drink more than 14 units/week, spread over 3+ days if drinking that much, with several drink-free days. Units = ABV(%) × volume(ml) ÷ 1000.

### Cited Findings
- "strength (ABV) x volume (ml) ÷ 1,000 = units"; "men and women are advised not to drink more than 14 units a week on a regular basis"; "spread your drinking over 3 or more days if you regularly drink as much as 14 units a week"; "have several drink-free days each week" — [NHS, Calculating alcohol units](https://www.nhs.uk/live-well/alcohol-advice/calculating-alcohol-units/)
- Examples: single 25ml 40% spirit = 1 unit; 175ml 12% wine = 2.1 units; 250ml 12% wine = 3 units; pint 3.6% = 2 units; pint 5.2% = 3 units — [NHS](https://www.nhs.uk/live-well/alcohol-advice/calculating-alcohol-units/)
- 1 UK unit = 8 g / 10 ml pure alcohol (implied by formula); AUDIT binge item uses 6+ units (female) / 8+ units (male) — [gov.uk AUDIT](https://assets.publishing.service.gov.uk/media/6357a7af8fa8f557d85b7c44/Alcohol-use-disorders-identification-test-AUDIT_for-print.pdf)

### Inferences
- For "money saved" and "units avoided" counters, let the user enter their usual drinks (ABV, volume, price) at baseline and compute units with the NHS formula.

### Gaps
- Did not fetch the 2016 CMO guidelines document directly; the 8 g/unit figure is derived, not quoted.

## 7. ADHD and alcohol/substance use (prevalence, mechanisms, medication, interactions)

### Takeaway
ADHD substantially raises AUD risk (childhood ADHD → AUD OR ~1.35–2.15 across meta-analyses; about half of adults 20–39 with ADHD have had an SUD, alcohol the most common). Large registry/claims studies show ADHD medication periods are associated with ~31–35% lower odds of substance-related events, so staying on medication is plausibly protective. Alcohol + stimulants: avoid/limit — increased cardiovascular strain (lisdexamfetamine), worsened CNS side effects and, for some modified-release methylphenidate products, alcohol-induced rapid drug release; atomoxetine shows no PK interaction but manufacturers still advise against combining.

### Cited Findings
- Lee et al. 2011 meta-analysis: childhood ADHD → AUD OR 1.74 (95% CI 1.38–2.20) — [Lee et al. 2011, Clin Psychol Rev](http://www.kathrynhumphreys.com/uploads/4/3/0/6/43065295/lee_2011_metaanalysis.pdf); another meta-analysis: AUD by young adulthood OR 1.35 (1.11–1.64) — [Charach et al., PubMed 21156266](https://pubmed.ncbi.nlm.nih.gov/21156266/); more recent meta-analysis of childhood psychiatric disorders: alcohol OR 2.15 (1.56–2.97) — [Groenman et al. 2017, JAACAP](https://www.sciencedirect.com/science/article/abs/pii/S089085671730206X) (figures as reported in search summaries; verify against full text)
- Half of adults aged 20–39 with ADHD have had an SUD in their lifetime; AUD the most common — [EurekAlert (Univ. of Toronto study)](https://www.eurekalert.org/news-releases/924775)
- ADHD prevalence among people in SUD treatment ~21–23% when screened (meta-analysis, 34,036 people) — [ADHD and AUD: Optimizing Screening and Treatment, CNS Drugs 2025](https://link.springer.com/article/10.1007/s40263-025-01168-6); [VA Evidence Synthesis 2024](https://www.hsrd.research.va.gov/publications/esp/adult-adhd.pdf)
- Medication: Quinn et al. 2017 (Am J Psychiatry; ~3 million US ADHD patients' claims 2005–14): during medicated periods, men had 35% and women 31% lower odds of concurrent substance-related events; among men, lower long-term risk too — [Quinn et al. 2017](https://psychiatryonline.org/doi/full/10.1176/appi.ajp.2017.16060686)
- Chang et al. 2014 (Swedish registers, 38,753 people with ADHD): stimulant medication not associated with increased later substance abuse; ~31% reduction in substance abuse among those on long-term medication — [Chang et al. 2014, JCPP](https://acamh.onlinelibrary.wiley.com/doi/abs/10.1111/jcpp.12164); [PubMed 25158998](https://pubmed.ncbi.nlm.nih.gov/25158998/)
- Stimulant treatment not associated with greater later substance use through adolescence into early adulthood (MTA follow-up) — [JAMA Psychiatry 2023](https://jamanetwork.com/journals/jamapsychiatry/fullarticle/2806881); VA review: no evidence of difference in new adult SUD risk between stimulant-prescribed and unprescribed ADHD — [VA ESP 2024](https://www.hsrd.research.va.gov/publications/esp/adult-adhd.pdf)
- Mechanisms: emotional dysregulation is a significant feature of adult ADHD — [Management of Emotional Dysregulation in Adult ADHD, PMC9568011](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9568011/); poorer response inhibition increases cue-elicited craving in heavy drinkers — [UCLA cue-reactivity paper](https://addictions.psych.ucla.edu/wp-content/uploads/sites/160/2018/01/AJDAA-The-Effect-Of-Alcohol-Priming-On-Neural-Markers-Of-Alcohol-Cue-Reactivity.pdf). (Self-medication narratives found mainly in UK clinic blogs — lower-quality sources, e.g. [ADHD Centre](https://www.adhdcentre.co.uk/how-does-alcohol-affect-adhd-does-alcohol-make-adhd-worse/).)
- Interactions: alcohol may exacerbate CNS adverse effects of methylphenidate, and with certain sustained-release methylphenidate formulations may cause rapid release and higher drug levels; patients advised to avoid alcohol. Lisdexamfetamine + alcohol may increase cardiovascular side effects (heart rate, BP); avoid or limit. Atomoxetine: manufacturer says alcohol's intoxicating effects unchanged, but co-ingestion still not recommended — [Drugs.com ADHD meds and alcohol](https://www.drugs.com/article/adhd-medication-alcohol.html); [Systematic review: combining ADHD medication with alcohol/drugs, BMC Psychiatry 2015 (PMC4628434)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4628434/)
- NHS shared care (North Central London, adults): advise to avoid alcohol during ADHD treatment as it may worsen some side effects — [NCL Shared Care Guideline ADHD adults](https://nclhealthandcare.org.uk/wp-content/uploads/2024/10/SCG_ADHD_adults.pdf)

### Inferences
- For this user, going alcohol-free also removes a medication-interaction concern — a legitimate "my reasons" entry.
- App can treat medication adherence as a tonic protective factor (optional private tick) without making medical claims; should never advise changing medication.
- ADHD-friendly design: externalise plans (pre-written if-then plans, reminders before known high-risk times such as evenings/weekends), make the urge tool one tap, minimise friction and shame; afternoon/evening medication wear-off may coincide with drinking time (inference — not sourced).

### Gaps
- No direct evidence found on alcohol, ADHD and sleep in this session.
- No Elvanse UK SmPC wording fetched directly (NHS lisdexamfetamine Q&A page URL returned 404).
- No trial of ADHD-adapted relapse prevention apps found.

## 8. Benefits timeline of stopping drinking

### Takeaway
One month off (Mehta et al. 2018 BMJ Open, moderate-heavy drinkers): ~26% lower insulin resistance, ~6.6% lower systolic BP, lower weight and cancer-related growth factors; controls unchanged. Dry January participant surveys (de Visser): most report saving money (86%), better sleep (70%), more energy (66%), weight loss (54%), with lower AUDIT scores at 6 months — but these are self-selected self-reports.

### Cited Findings
- Mehta et al. 2018 (BMJ Open), prospective observational, healthy drinkers (>64 g/week men, >48 g/week women) choosing 1 month abstinence vs continued drinking: insulin resistance (HOMA) −25.9%; systolic BP −6.6%, diastolic also improved; weight, VEGF and EGF improved; no significant changes in controls — [UCL Discovery full text](https://discovery-pp.ucl.ac.uk/id/eprint/10048446/1/e020673.full.pdf); [ResearchGate record](https://www.researchgate.net/publication/324967778_Short-term_abstinence_from_alcohol_and_changes_in_cardiovascular_risk_factors_liver_function_tests_and_cancer-related_growth_factors_a_prospective_observational_study)
- Dry January (de Visser 2019, via Alcohol Change UK): 86% saved money, 81% felt more in control, 70% slept better, 67% better concentration, 66% more energy, 65% improved health, 54% lost weight; at 6 months lower AUDIT scores, improved wellbeing, greater drink-refusal confidence; 70% of those using Alcohol Change tools had improved wellbeing and lower risk at 6 months — [Alcohol Change UK evidence page](https://alcoholchange.org.uk/help-and-support/managing-your-drinking/dry-january/about-dry-january/the-evidence-behind-the-dry-january-challenge-benefits-and-long-term-impact)
- Scoping review of Dry January evidence — [PMC12415855](https://pmc.ncbi.nlm.nih.gov/articles/PMC12415855/)

### Inferences
- Benefit messaging at day ~30 can cite BP/insulin/weight; sleep/energy/money are reasonable earlier encouragements but should be labelled "many people report".
- A year-long timeline beyond one month (e.g., liver fat, GGT normalisation, longer-term BP) needs further sourcing.

### Gaps
- Mehta: liver stiffness/LFT changes — not extracted. Sample size for de Visser surveys not given on the Alcohol Change page. No sourced 3/6/12-month physiological timeline found.
- Note Mehta was observational (self-selected), not randomised.

## 9. Sober-curious social strategies and alcohol-free drinks

### Takeaway
No/lo drinks are a double-edged tool: experiments show substitution can reduce consumption, but observational substitution is limited, and in people with AUD, AF drinks can raise craving in proportion to dependence severity; UK women in recovery describe them as both a harm-reduction tool and a relapse trigger. An app should let users decide, flag AF beer/wine "lookalikes" as a possible cue, and suggest non-alcohol-mimicking alternatives too.

### Cited Findings
- Systematic review ("Doctor, can I drink an alcohol-free beer?"): craving and desire to drink increased after no/lo drinks in AUD patients, correlating with dependence severity — [Caballeria et al. 2022, Nutrients](https://www.mdpi.com/2072-6643/14/19/3925)
- UK qualitative study of women in recovery: no/lo drinks navigated both as harm-reduction tools ("weaning") and as relapse triggers — [Davey et al. 2024, Drug and Alcohol Review](https://onlinelibrary.wiley.com/doi/10.1111/dar.13766)
- IAS (June 2026): no/lo drinks only reduce harm if they substitute for alcohol; free provision/availability reduced consumption in experiments, but observational substitution evidence is limited; most buyers are low-risk occasional triers — [Institute of Alcohol Studies 2026](https://www.ias.org.uk/2026/06/18/no-lo-drinks-and-alcohol-harm-reduction-a-targeted-tool-not-a-population-level-solution/); [Latent profile analysis of purchases, PMC13357960](https://pmc.ncbi.nlm.nih.gov/articles/PMC13357960/)
- Social-drinking imagery triggers craving even when drinks shown are non-alcoholic — [ScienceDirect 2024](https://www.sciencedirect.com/science/article/abs/pii/S0306460324001746)
- Sentiment/self-reported experiences with NA beverages among people cutting down — [PMC13339844](https://pmc.ncbi.nlm.nih.gov/articles/PMC13339844/)
- Dry January participants report greater confidence refusing drinks at 6 months — [Alcohol Change UK](https://alcoholchange.org.uk/help-and-support/managing-your-drinking/dry-january/about-dry-january/the-evidence-behind-the-dry-january-challenge-benefits-and-long-term-impact)
- If-then plan template for being offered a drink ("if offered..., then I will ask for a non-alcoholic drink") — [Cooke et al. 2023](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10087331/)

### Inferences
- For celebrations (e.g., a birthday party early in the challenge), the app should offer an event-prep flow: pre-commit plan, own drink in hand early, exit time, ally who knows, a short refusal script ("I'm doing a year off — I'll have a [X]"), and a post-event check-in.
- AF drinks should be a user-set toggle with an honest note: "fine for many; if they make you crave the real thing, swap for something that doesn't taste like alcohol."

### Gaps
- No RCT evidence on refusal-script training specifically; no evidence found on sober birthday/celebration strategies beyond implementation intentions.
