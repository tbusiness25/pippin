# Safe design for tracking other addictions/behaviours (beyond alcohol) in a public UK self-help app

Scope: gambling, nicotine/vaping, cannabis, other drugs (opioids, benzodiazepines, stimulants), behavioural categories (porn/compulsive sexual behaviour, social media/phone, gaming, shopping, binge eating), cross-category safe design, and evidence on quit counters. UK context, current to Oct 2026. Research budget was limited (~20 tool calls); items not verified are listed under Gaps rather than asserted.

## Gambling: self-exclusion, blocking, self-help, helplines, financial harm, suicide risk

### Takeaway
Gambling is the highest-risk behavioural category for an app: harm is financial as well as psychological, and gambling disorder carries a markedly elevated suicide mortality. The app should signpost practical friction tools (GAMSTOP, bank gambling blocks, blocking software) and the 24/7 National Gambling Helpline, and should treat money-lost data and distress as a crisis-escalation trigger. Evidence for GAMSTOP is mostly self-reported, from evaluations GAMSTOP commissioned, not from RCTs.

### Cited Findings
- National Gambling Helpline (run by GamCare): free on **0808 8020 133**, 24 hours a day, 365 days a year. Also available by live chat and WhatsApp. It offers confidential one-to-one advice and emotional support, plus referral to treatment across England, Scotland and Wales — [GambleAware service finder](https://www.gambleaware.org/tools-and-support/support-in-your-area/service-finder-results/gamcare-national-gambling-helpline/); [GamCare on X](https://x.com/GamCare/status/2036714785639702624?lang=en); [GamCare 24h helpline news](https://www.gamcare.org.uk/news-and-blog/news/nat-gambling-helpline-24/)
- GAMSTOP evaluation by Sonnet Impact, commissioned by GAMSTOP (Dec 2020; 3,300 demographic responses, 1,700 impact responses, 41 interviews). 82% of users said they had stopped or reduced gambling since registering. 84% felt safer from gambling harm and more in control. 70% reported less anxiety and stress, and 63% reported better relationships — [Sonnet Impact report PDF via GREO](https://www.greo.ca/en/greo-resource/resources/Documents/Sonnet-Advisory-and-Impact-2021_-GAMSTOP-Evaluating-online-self-exclusion-scheme.pdf); [Sonnet Impact](https://sonnetimpact.co.uk/reports/extensive-research-into-the-effectiveness-of-gamstops-online-gambling-exclusion-scheme/)
- Ipsos independent evaluation (2024; more than 4,650 users). 78% said GAMSTOP delivered the results they wanted. It worked best for people with a sustained commitment to change, rather than people wanting "a break". Ipsos recommended adding a lifetime self-exclusion option — [Hipther summary](https://hipther.com/gaming-and-entertainment-europe/2024/09/23/78940/gamstop-is-delivering-real-impact-for-its-users-independent-evaluation-concludes/); [CasinoBeats](https://casinobeats.com/2024/09/24/gamstop-ipsos-lifetime-self-exclusion/)
- Exploratory UK study of voluntary self-exclusion combined with contingency management for harmful gambling — [PMC10573067](https://pmc.ncbi.nlm.nih.gov/articles/PMC10573067/) (only the abstract-level listing was seen; findings not extracted)
- Bank gambling blocks:
  - Monzo lets users choose a cooling-off period from 2 days to 12 months. Turning the block off takes 48 hours.
  - Starling has a toggle under Card and Currency Controls. Removing it takes 48 hours, customer services cannot override this, and the app shows the National Gambling Helpline when a user tries to switch it off.
  - The Gambling Commission keeps a guide on blocking gambling transactions.
  - Sources: [Chapter One – bank blocks](https://www.chapter-one.org/blog/bank-blocks); [iGB on Starling](https://igamingbusiness.com/finance/starling-bank-may-strengthen-gambling-self-exclusion-blocker/); [Gambling Commission: how to block gambling transactions](https://www.gamblingcommission.gov.uk/public-and-players/page/i-want-to-know-how-to-block-gambling-transactions)
- Suicide risk:
  - **2018 Swedish register study:** a 15-fold increase in suicide mortality for people aged 20–74 diagnosed with gambling disorder, compared with the general population — [Karlsson & Håkansson 2018, J Behav Addict](https://akjournals.com/view/journals/2006/7/4/article-p1091.xml)
  - **2025 matched case-control register study:** 1.2% of cases died by suicide versus 0.3% of controls, a significant difference for men only. After adjusting for co-occurring mental and physical illness, age and education, gambling disorder itself was not an independent predictor. In other words, comorbidity explains much of the excess risk — [Karlsson et al. 2025, J Gambl Stud (PMC12361315)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12361315/); [GREO research snapshot](https://www.greo.ca/Modules/EvidenceCentre/files/Karlsson%20et%20al%20(2025)_Research%20Snapshot_Suicide%20and%20mortality%20in%20individuals%20with%20gambling%20disorder_final.pdf)
  - **Swedish general-population case-control study:** problem gambling is associated with suicidal ideation and suicide attempts — [J Gambl Stud 2022 (PMC9120086)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9120086/)
  - **Norwegian registry cohort:** examines the association between gambling disorder and suicide mortality — [PMC11600009](https://pmc.ncbi.nlm.nih.gov/articles/PMC11600009/)
- NHS National Gambling Clinic (CNWL): free and confidential. It takes young people aged 13–18 from anywhere in England, and adults in London and the South East. Self-referral is by online form; phone 020 7381 7722. It also runs a Family and Friends service — [CNWL National Gambling Clinic](https://www.cnwl.nhs.uk/services/addictions/national-gambling-clinic); [NHS gambling help page](https://www.nhs.uk/live-well/addiction-support/gambling-addiction/)
- Gam-Anon offers peer support, in person and online, to family and friends affected by someone else's gambling — [Channel 4 gambling help list](https://www.channel4.com/4viewers/help/gambling)

### Inferences
- Gambling is the one behavioural category where the app should proactively offer "add friction" actions:
  - a GAMSTOP link
  - instructions for turning on a bank gambling block
  - blocking-software links
- Bank blocks and GAMSTOP work by adding pre-commitment and delay (48-hour cooling-off). An app can copy this pattern for its own settings: for example, a delay before the user can delete a gambling goal or turn off safeguards.
- Money tracking is risky in two directions. "Money lost" can shame people, and "money won" can glamorise gambling. Prefer "money kept/protected" framing, and show the helpline when losses or debt are logged.
- Because suicide risk in gambling disorder is concentrated in people with co-occurring mental illness, the crisis escalation path should be prominent for gambling users, not only for drug or alcohol users.
- GAMSTOP evidence is self-reported, comes from people who opted in, and was largely commissioned by GAMSTOP. Describe it as "users report benefit", not as proven efficacy.

### Gaps
- Could not fetch GamCare's blocking-software page (HTTP 403). Not verified: details of Gamban/BetBlocker, the current GAMSTOP exclusion periods (believed to be 6 months, 1 year or 5 years; check gamstop.co.uk), whether a lifetime option has since been added, and the land-based schemes (SENSE, MOSES).
- Gam-Anon's UK contact details were not verified.
- No RCT evidence was found for GAMSTOP or for blocking software.
- No source was found on how a gambling-tracking app itself affects outcomes.
- Debt advice routes (StepChange, National Debtline) were not checked.

## Nicotine / vaping: NHS evidence, app, quit date vs cutting down, withdrawal

### Takeaway
The UK evidence base is strong. Support plus medication or vapes beats willpower alone. Nicotine vapes beat NRT (high-certainty Cochrane evidence). Cutting down first and stopping abruptly give similar long-term quit rates. An ACT-based app (iCanQuit) beat a guideline-based app in a large RCT. The app should support both a quit date and a "cut down to quit" route, and should point to NHS Stop Smoking Services.

### Cited Findings
- **Cochrane living review on e-cigarettes** (Lindson et al., searches to Jan 2026; 80 RCTs; versions in 2025 and 2026):
  - Nicotine vapes increase quit rates compared with NRT (high certainty; about 4 more quitters per 100).
  - Nicotine vapes probably beat non-nicotine vapes (moderate certainty; about 3 more per 100).
  - Nicotine vapes may not be associated with serious adverse effects.
  - Sources: [Cochrane CD010216 (2026)](https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD010216.pub11/full); [Tobacco Induced Diseases summary](https://www.tobaccoinduceddiseases.org/Newest-findings-from-the-Cochrane-living-systematic-review-of-e-cigarettes-for-smoking,206389,0,2.html); [CEBM plain-language briefing Jan 2025](https://www.cebm.ox.ac.uk/files/reports/eclsr-plain-language-briefing-document-january-2025.pdf)
- **NICE NG209 (updated 2025)** says these should be accessible:
  - Behavioural support (individual and group) and very brief advice.
  - Cytisinicline (added 2025), NRT (short- and long-acting), varenicline and bupropion.
  - Nicotine e-cigarettes, and the Allen Carr Easyway in-person seminar.
  - Cytisinicline, combination NRT or varenicline, together with behavioural support, give the best quit chances.
  - Cytisinicline, varenicline and bupropion are not for under-18s, and cytisinicline is not for people aged 66 and over.
  - Sources: [NICE NG209 – treating tobacco dependence](https://www.nice.org.uk/guidance/ng209/chapter/treating-tobacco-dependence); [GPnotebook summary](https://gpnotebook.com/pages/respiratory-and-chest-medicine/nice-guidance-use-of-nicotine-replacement-therapy-nrt-cytisinicline-varenicline-and-bupropion-for-smoking-cessation)
- **NHS Better Health Quit Smoking:**
  - The free NHS Quit Smoking app tracks progress, calculates money saved, sends daily encouragement and shares peer stories.
  - Also offered: a Personal Quit Plan, Stoptober, quit-date planning, and local Stop Smoking Services.
  - NHS claim: reaching 28 days smoke-free makes you "5 times more likely to quit for good".
  - NHS health-recovery timeline: pulse normalises at 20 minutes; carbon monoxide halves at 8 hours; taste and smell improve at 48 hours; breathing is easier at 72 hours; circulation improves at 2–12 weeks.
  - Source: [NHS Better Health – Quit smoking](https://www.nhs.uk/better-health/quit-smoking/)
- **Cutting down vs abrupt quitting** (Cochrane, Lindson et al. 2019; 22 studies, 9,219 participants): no difference in long-term quit rates (RR 1.01, 95% CI 0.87–1.17; moderate certainty). Cutting down may do better when supported by fast-acting NRT or varenicline (low certainty) — [Cochrane CD013183](https://cochranelibrary.com/cdsr/doi/10.1002/14651858.CD013183.pub2/abstract?cookiesEnabled=); [Cochrane plain-language summary](https://www.cochrane.org/evidence/CD013183_can-people-stop-smoking-cutting-down-amount-they-smoke-first); [Lindson 2020 Addiction commentary](https://onlinelibrary.wiley.com/doi/10.1111/add.14928)
- **iCanQuit RCT** (Bricker et al., JAMA Intern Med 2020; n=2,415):
  - Compared the ACT-based iCanQuit app with NCI's guideline-based QuitGuide app.
  - 30-day abstinence at 12 months: 28.2% vs 21.1% (OR 1.49, 95% CI 1.22–1.83).
  - Sources: [Fred Hutch release](https://www.fredhutch.org/en/news/releases/2020/09/fred-hutch-led-clinical-trial-shows-new-smartphone-app-helps-smokers-quit.html); [JAMA IM abstract via Ovid](https://www.ovid.com/journals/jaim/abstract/10.1001/jamainternmed.2020.4055~efficacy-of-smartphone-applications-for-smoking-cessation-a?redirectionsource=fulltextview)
  - Mediation analysis: the effect worked through acceptance of cravings/cues and engagement — [JMIR mHealth 2022](https://doi.org/10.2196/32847)
  - Secondary analysis on whether medications add to the app's effect — [Addiction 2024](https://onlinelibrary.wiley.com/doi/abs/10.1111/add.16396)
- **Haskins et al. 2017** (Transl Behav Med): only 2 of the 50 top app-store smoking cessation apps had scientific support — [JMIR 2023 framework citing Haskins](https://www.jmir.org/2023/1/e45183); see also [Abroms-type adherence review, PMC6567534](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6567534/)
- Vaping-cessation apps were assessed for quality and content in a separate review — [PMC9002586](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9002586/)

### Inferences
- The app should not frame vapes as just another addiction to quit for an adult smoker who is switching. UK policy (NICE, Cochrane) treats nicotine vapes as a cessation aid. Separate "vaping as a quit tool" from "quitting vaping".
- Offer both "set a quit date" and "cut down to quit" with equal standing. Nudge users towards medication or vapes plus NHS Stop Smoking Services, since those combinations beat unaided attempts.
- ACT-style content (accepting urges, values) has stronger RCT support in an app than standard guideline content. This supports urge-surfing over a counter-only design.
- Counters and money-saved features are standard and appear in the NHS app. However, no evidence was found that counters themselves drive quitting (see the last section).

### Gaps
- The NHS Stop Smoking Services "3x more likely to quit" claim was not confirmed in the fetched text.
- No authoritative nicotine *withdrawal symptom* timeline was found (irritability, craving, sleep, appetite; typically peaking in the first week and easing over 2–4 weeks per general literature). The NHS page fetched gave health-recovery milestones instead.
- Evidence on quitting vapes (for people who vape without ever having smoked, or young people) was not reviewed in depth.

## Cannabis: withdrawal, self-help/digital evidence, FRANK

### Takeaway
Cannabis withdrawal (mood, irritability, sleep, appetite) is unpleasant but not medically dangerous. Digital interventions produce small but real reductions in use. FRANK (0300 123 6600, text 82111) is the main UK signpost, and the app should flag psychosis risk.

### Cited Findings
- FRANK contacts: phone **0300 123 6600**, text **82111**, plus an email form and a support-centre locator — [FRANK – cannabis](https://www.talktofrank.com/drug/cannabis)
- FRANK lists withdrawal in heavy users as: moodiness and irritability, nausea, trouble sleeping, poor appetite, sweating and shaking, diarrhoea — [FRANK – cannabis](https://www.talktofrank.com/drug/cannabis)
- FRANK warns that cannabis can trigger serious relapse in psychotic illnesses and may raise the risk of schizophrenia, especially in teenagers with a family history. Vaping cannabis is "generally less harmful to the lungs", but illicit THC vapes have quality-control risks — [FRANK – cannabis](https://www.talktofrank.com/drug/cannabis)
- Boumparis et al. 2019 meta-analysis (30 RCTs, 21 meta-analysed). Digital prevention: g=0.33 (95% CI 0.13–0.54), with effects lasting up to 12 months. Digital treatment: g=0.12 (95% CI 0.02–0.22). Both are small but significant — [PubMed 31112834](https://pubmed.ncbi.nlm.nih.gov/31112834/)
- The ICan guided digital intervention RCT to reduce cannabis use — [Olthof et al. 2023, Addiction](https://onlinelibrary.wiley.com/doi/full/10.1111/add.16217) (results not extracted)

### Inferences
- Cannabis can use the standard "reduce or quit" flow. The withdrawal note should say symptoms are uncomfortable and usually short-lived, offer sleep support, and point users to their GP or FRANK if symptoms are severe.
- Add a mental-health flag: if the user logs paranoia, hallucinations or psychotic symptoms, escalate to urgent help (GP/111/999). Do not use self-help tips for these.
- Expect modest effects (g≈0.12 for treatment). The app should not overclaim.

### Gaps
- No authoritative timeline for cannabis withdrawal onset or duration was retrieved. The general literature suggests onset in 1–2 days, a peak at days 2–6, and resolution over about 1–2 weeks, with sleep problems sometimes lasting longer. This needs a source (e.g. NHS or a DSM-5 review) before it is used in the app.
- No UK NICE guidance specific to cannabis self-help was checked.

## Other drugs (opioids, benzodiazepines, stimulants): dangerous withdrawal, overdose after lost tolerance, naloxone

### Takeaway
For benzodiazepines (and alcohol), the app must never encourage abrupt stopping. It must tell users to seek medical help to taper, because withdrawal can cause seizures, delirium and death. For opioids, any "lapse after abstinence" flow must include overdose harm-reduction messaging, because lost tolerance sharply raises overdose death risk. Naloxone is now available from UK pharmacies without a prescription.

### Cited Findings
- Benzodiazepines should not be stopped suddenly without a supervised plan to reduce the dose and frequency. Abrupt withdrawal can cause serious reactions, including seizures and delirium that can be fatal (FDA boxed-warning communication) — [FDA boxed warning document](https://www.fda.gov/media/142368/download)
- Alcohol dependence withdrawal (fits, delirium) needs medical management. NHS trust guideline — [Oxford Health NHS FT alcohol dependence guideline](https://www.oxfordhealthformulary.nhs.uk/docs/Guidelines%20for%20the%20management%20of%20alcohol%20dependendence%20-%20Dec%202020_RH.pdf) (only the listing was seen; details not extracted)
- Overdose after lost tolerance (released prisoners with a heroin-injecting history):
  - Drug-related death risk is 3–8 times higher in the first 2 weeks after release than in the following 10 weeks.
  - About 1 in 200 die of heroin overdose within 4 weeks of release.
  - The main causes are lost tolerance and misjudging the dose on return to use.
  - Sources: [N-ALIVE pilot RCT, PMC5324705](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5324705/); [UNODC overdose guidance](https://www.unodc.org/docs/treatment/overdose.pdf)
- Scotland's national naloxone programme was linked to a 36% reduction in opioid overdose deaths in the first 4 weeks after prison release — [Take-home naloxone review, PMC6728289](https://pmc.ncbi.nlm.nih.gov/articles/PMC6728289/)
- UK law: since 2 December 2024, pharmacists and pharmacy technicians (and others such as nurses, midwives and prison staff) can supply take-home naloxone without a prescription, under the Human Medicines (Amendments Relating to Naloxone and Transfers of Functions) Regulations 2024 — [Pharmaceutical Journal](https://pharmaceutical-journal.com/article/news/legislation-enabling-pharmacy-professionals-to-supply-take-home-naloxone-comes-into-force); [legislation.gov.uk explanatory memorandum](https://www.legislation.gov.uk/uksi/2024/1125/pdfs/uksiem_20241125_en_001.pdf); [Pharmacy Magazine](https://www.pharmacymagazine.co.uk/news/community-pharmacies-take-home-naloxone-powers-kick-in-today)
- Northern Ireland consulted on expanding naloxone access in 2025 — [DoH NI consultation](https://www.health-ni.gov.uk/consultations/expanding-access-naloxone-2025)

### Inferences
Hard rules for the app:
- **Benzodiazepines, alcohol (if dependent), GHB/GBL and possibly high-dose opioids:** no "quit today" or abrupt-stop flow. Show a blocking safety screen before the user sets an abstinence goal, telling them to speak to a GP or drug service about a supervised taper or detox.
- **Opioids (and other depressants) after any period of reduced use or abstinence:** if a lapse is logged, show harm-reduction messaging. This means lower tolerance, smaller dose, don't use alone, avoid mixing with alcohol or benzos, carry naloxone, and call 999. A "you broke your streak" message here could be lethal.
- **Stimulants:** withdrawal is not usually medically dangerous, but the "crash" brings low mood and suicidal-thought risk. Link to crisis support (inference; not sourced in this pass).
- The app must not give dosing advice, taper schedules or drug-checking guidance. It should signpost FRANK, local drug services and the GP.

### Gaps
- An NHS-specific page on benzodiazepine withdrawal was not retrieved. The FDA (US) source was used for the seizure warning. Look for NHS/BNF/NICE or the "Ashton manual" equivalent for UK wording.
- GHB/GBL withdrawal danger was not researched.
- No UK-specific source was found on stimulant crash or suicide risk.
- UK drug-death statistics (ONS) were not retrieved.

## Behavioural categories: porn/CSB, social media/phone, gaming, shopping, binge eating

### Takeaway
The evidence base and diagnostic status vary widely by category:
- **Gaming disorder:** an ICD-11 diagnosis.
- **Compulsive sexual behaviour:** ICD-11 compulsive sexual behaviour disorder (CSBD), with contested framing.
- **Social media:** no diagnosis; detox evidence is mixed and small.
- **Binge eating:** NICE-guided CBT self-help is first line.

Shame and moral framing are linked to worse outcomes for porn use (moral incongruence). Food/calorie tracking can maintain eating-disorder symptoms, so binge-eating support must avoid restriction or calorie framing.

### Cited Findings
- **Porn/CSB and moral incongruence:**
  - Grubbs' moral incongruence model holds that distress about porn use is often driven by the gap between behaviour and moral or religious values, not by use level alone. This replicates across cultures and languages — [Grubbs: Moral Incongruence project](https://joshuagrubbsphd.com/project/moral-incongruence/); [Moral Incongruence After 10 Years, Curr Addict Rep 2025](https://link.springer.com/article/10.1007/s40429-025-00675-2)
  - People high in moral incongruence show transient rises in shame, guilt, disconnection and low mood after porn use or masturbation — [Grubbs: Moral incongruence and addiction (registered report)](https://joshuagrubbsphd.com/publication/journal-article/)
  - NoFap/"reboot" abstinence: qualitative work suggests the abstinence goal can itself cause distress, by recasting ordinary sexual behaviour as personal "failure" — [Abstinence from Masturbation and Hypersexuality, Arch Sex Behav 2020](https://link.springer.com/article/10.1007/s10508-019-01623-8); [NoFap/PornFree forum narrative analysis](https://www.academia.edu/71466509/Exploring_the_Etiological_Pathways_of_Problematic_Pornography_Use_in_NoFap_PornFree_Rebooting_Communities_A_Critical_Narrative_Analysis_of_Internet_Forum_Data)
  - Clinical overview of CSBD assessment and treatment — [Sexual Medicine Reviews 2024](https://academic.oup.com/smr/article/12/3/355/7634799)
- **Gaming:**
  - Gaming disorder is in ICD-11. Prevalence estimates vary with the criteria used: a pooled 8.6% (95% CI 6.9–10.8%) across 84 studies, but 2.48% under ICD-11 vs 3.83% under DSM-5 in a representative sample of Swiss young men. Roughly 3–6% is often quoted — [Meta-analysis, PMC11203952](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11203952/); [Swiss men ICD-11 study](https://www.sciencedirect.com/science/article/pii/S2352853226000374)
  - Measurement validity of gaming disorder scales is questioned — [Systematic Error in Gaming Disorder Measures, PMC7618306](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7618306/)
- **Social media/phone:**
  - One meta-analysis found no significant effect of social media abstinence on positive affect, negative affect or life satisfaction — [Lemahieu et al. 2025, Sci Rep](https://www.nature.com/articles/s41598-025-90984-3)
  - Another found a small positive effect on wellbeing. Breaks shorter than 1 week were linked to worse outcomes, and breaks of 1 week or longer to improvements — [Am I Happier Without You? meta-analysis of RCTs, PMC11939267](https://pmc.ncbi.nlm.nih.gov/articles/PMC11939267/)
  - A reanalysis argues that reduction or abstinence does give mental-health benefits — [PMC12125955](https://pmc.ncbi.nlm.nih.gov/articles/PMC12125955/)
  - A further meta-analysis found small improvements in positive wellbeing after restriction — [ScienceDirect 2025](https://www.sciencedirect.com/science/article/pii/S2666560325000714)
- **Binge eating:**
  - NICE NG69 recommends a binge-eating-disorder-focused **guided self-help** programme (CBT-based materials plus brief support sessions, e.g. 4–9 sessions of 20 minutes over 16 weeks) as first-line treatment for adults. If that doesn't work after 4 weeks, it steps up to group, then individual, CBT-ED — [NICE NG69 PDF](https://www.nice.org.uk/guidance/ng69/resources/eating-disorders-recognition-and-treatment-pdf-1837582159813); [NICE QS175 statement 3](https://www.nice.org.uk/guidance/qs175/chapter/quality-statement-3-first-line-psychological-treatment-for-binge-eating-disorder)
- **Calorie-tracking harm:**
  - Simpson & Mazzeo 2017 (n=493 students): diet/fitness app use was linked to higher eating-disorder symptoms. Tracking frequency was linked to restraint and bulimic symptoms only in people with existing body dissatisfaction.
  - Levinson et al. 2017 (clinical ED sample): about three-quarters perceived MyFitnessPal as contributing to their eating disorder.
  - Linardon & Messer 2019: similar associations in men.
  - Sources: [Linardon & Messer 2019, Eating Behaviors](https://www.sciencedirect.com/science/article/abs/pii/S147101531830326X?via=ihub); [Levinson et al. 2017 via ResearchGate](https://www.researchgate.net/publication/319194941_My_Fitness_Pal_calorie_tracker_usage_in_the_eating_disorders); [qualitative study, diet/fitness apps and ED behaviours](https://www.researchgate.net/publication/354842756_Effects_of_diet_and_fitness_apps_on_eating_disorder_behaviours_qualitative_study)
  - These are cross-sectional or self-perceived findings, so they do not prove causation.

### Inferences
- **Porn/CSB:** offer neutral, values-based goals ("use less than X", "not at work", "not when lonely") rather than "NoFap"-style absolute abstinence with streak resets. Never use moral or purity language. Consider a gentle note that distress about porn use is sometimes about values conflict, and that a therapist (not a counter) can help.
- **Social media/phone:** frame as "time well spent" or "intentional use" goals. Avoid addiction language unless the user chooses it. Detox of 1 week or more may help modestly. The app should not promise mental-health gains.
- **Gaming:** most heavy gamers do not have a disorder. Use functional-impairment framing (sleep, work, relationships), not hours alone.
- **Shopping:** no evidence was retrieved. Treat it like gambling in its financial-harm aspect (spending blocks, debt-advice signposting).
- **Binge eating:**
  - Track binge episodes, triggers, regular eating and mood. **Never track calories, weight or restriction.**
  - Promote *regular eating*, the core of CBT-ED, rather than "clean" days, since restriction drives binges.
  - Screen or flag for eating-disorder signs (compensatory behaviours, very low weight) and signpost to the GP or an eating-disorder charity.
  - Offer an option to hide all food-quantity features.

### Gaps
- No evidence was retrieved on compulsive shopping (buying-shopping disorder) self-help, or on UK helplines for it.
- Beat (UK eating disorder charity) helpline numbers were not verified this pass.
- No UK-specific gaming disorder service (e.g. the NHS National Centre for Gaming Disorders) was checked.
- RCT evidence for CSB self-help apps was not retrieved.

## Generic cross-category safe design, and evidence on quit counters/streaks

### Takeaway
There is good evidence for treating lapses as learning (Marlatt's abstinence violation effect). Only weak or no evidence was found that quit counters or streaks improve outcomes. The best-evidenced app (iCanQuit) used ACT skills, not counters. Safe design means:
- per-category medical or withdrawal gating
- always-available crisis routes
- reduce-or-quit choice
- non-shaming language
- discreet privacy options for stigmatised data

### Cited Findings
- **Marlatt's abstinence violation effect (AVE):** a lapse defined as a violation of total abstinence leads to internal, stable, global self-blame ("I am an addict; I cannot change") and a sense of lost control, which raises the risk of full relapse. Relapse prevention teaches clients to see lapses as learning opportunities, and the step from lapse to relapse is not inevitable — [Hendershot et al., Relapse Prevention overview (PMC6760427)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6760427/); [Marlatt & Donovan excerpt, Guilford](https://www.guilford.com/excerpts/marlatt.pdf)
- **iCanQuit:** an ACT-based app teaching acceptance of urges beat a guideline-based app (which included standard quit-plan features) on 12-month abstinence (OR 1.49) — [Fred Hutch](https://www.fredhutch.org/en/news/releases/2020/09/fred-hutch-led-clinical-trial-shows-new-smartphone-app-helps-smokers-quit.html)
- **Haskins 2017:** only 2 of 50 popular cessation apps had scientific support. Popularity does not equal evidence — [JMIR 2023 citing Haskins](https://www.jmir.org/2023/1/e45183)
- The NHS Quit Smoking app itself includes progress and money-saved tracking — [NHS Better Health](https://www.nhs.uk/better-health/quit-smoking/)
- In NoFap communities, abstinence goals and resets can recast normal behaviour as "failure" and add distress — [Arch Sex Behav 2020](https://link.springer.com/article/10.1007/s10508-019-01623-8)
- Gambling block design shows pre-commitment and cooling-off in practice: a 48-hour delay to remove the block, plus helpline details shown on removal — [iGB on Starling](https://igamingbusiness.com/finance/starling-bank-may-strengthen-gambling-self-exclusion-blocker/)

### Inferences
Design rules, inferred from the findings above:
1. **Medical-risk gating per category.**
   - **Hard stop:** benzodiazepines, alcohol (if dependent), and GHB/GBL. Show "Do not stop suddenly; speak to your GP or drug service". No abrupt quit-date flow.
   - **Overdose:** opioids and depressants get overdose-on-lapse messaging and naloxone information.
   - **Mental health:** cannabis gets a psychosis flag, and stimulants get a crash/mood flag.
2. **Crisis escalation everywhere**, prominent for gambling and drugs:
   - National Gambling Helpline 0808 8020 133 (24/7)
   - FRANK 0300 123 6600 / text 82111
   - NHS 111 / 999
   - Samaritans 116 123 (not verified this pass; widely known UK number)
   - NHS Stop Smoking Services / NHS Quit Smoking app
   - NHS National Gambling Clinic
   Trigger escalation on keywords, high losses or debt, and logged suicidal thoughts.
3. **Lapses are data:** a lapse never wipes progress. Show cumulative "days on track this month" or a rate, not a single fragile streak. Ask "what was happening?" to capture triggers. This counters the AVE.
4. **Reduce-or-quit choice for every category.** Smoking evidence shows cutting down to quit is as effective as abrupt quitting. Do not force abstinence, especially for porn, social media and gaming, where moderation is the norm.
5. **Language:** no moral, purity or "clean/dirty" words. Avoid "addict" unless the user chooses it. No shame copy for food or sex.
6. **Food:** no calorie, weight or restriction tracking in any binge-eating mode.
7. **Privacy for stigmatised data** (inferred, not sourced here):
   - local-first storage
   - an optional app lock
   - a neutral app name and icon
   - notifications that never name the substance or behaviour
   - a fast exit or decoy screen
   - per-category hiding on shared devices
   - no analytics on category choice
8. **Counters:** offer them as optional (they are a convention, including in the NHS app). Make them resilient to lapses, and pair them with skills content (ACT/urge-surfing). Do not make them the core engagement mechanic.

### Gaps
- No direct experimental evidence was found isolating the effect of quit counters, streaks or money-saved displays on cessation outcomes, either positive or harmful. Haskins 2017's specific feature findings on counters were not extracted. Treat counters as unproven.
- No sourced evidence was found on privacy harms for stigmatised addiction-app data (e.g. data-sharing scandals involving mental-health or addiction apps, or shared-device risks). Researching this is recommended.
- Samaritans and Beat helpline numbers were not verified in this pass.
- No UK regulatory guidance (MHRA software-as-medical-device, or the NICE Evidence Standards Framework for digital health) was checked for whether these features push the app into medical-device territory.
