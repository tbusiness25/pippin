/*
 * Sobriety/addiction content and safety rules. Sources: docs/research/reports/Habit and sobriety tracker design.md
 * AUDIT/AUDIT-C: WHO AUDIT, UK (gov.uk/OHID) version with UK units and thresholds.
 * Helplines are UK and change — keep HELPLINES_CHECKED current; override for other countries in .env (SOBER_HELPLINES_JSON).
 */

const HELPLINES_CHECKED = '2026-10-02';
const HELPLINES = {
  emergency: { name: 'Emergency', detail: '999 — fits, hallucinations, overdose, immediate danger', href: 'tel:999' },
  nhs111: { name: 'NHS 111', detail: 'Urgent medical or mental-health advice (option 2 for mental health)', href: 'tel:111' },
  samaritans: { name: 'Samaritans', detail: '116 123 — free, 24/7', href: 'tel:116123' },
  shout: { name: 'Shout', detail: 'Text SHOUT to 85258', href: 'sms:85258?body=SHOUT' },
  drinkline: { name: 'Drinkline', detail: '0300 123 1110 — free alcohol advice (weekdays 9–8, weekends 11–4)', href: 'tel:03001231110' },
  aa: { name: 'Alcoholics Anonymous', detail: '0800 917 7650', href: 'tel:08009177650' },
  smart: { name: 'SMART Recovery UK', detail: 'Free meetings, online and in person', href: 'https://smartrecovery.org.uk' },
  withyou: { name: 'We Are With You', detail: '0808 801 0750 — alcohol & drug services, webchat', href: 'tel:08088010750' },
  frank: { name: 'FRANK', detail: '0300 123 6600, text 82111 — drugs, 24/7', href: 'tel:03001236600' },
  gambling: { name: 'National Gambling Helpline', detail: '0808 8020 133 — GamCare, 24/7', href: 'tel:08088020133' },
  gamstop: { name: 'GAMSTOP', detail: 'Free self-exclusion from UK gambling sites', href: 'https://www.gamstop.co.uk' },
  smokefree: { name: 'NHS Stop Smoking Service', detail: 'Free local support — the best-evidenced way to quit', href: 'https://www.nhs.uk/better-health/quit-smoking/' },
  alanon: { name: 'Al-Anon', detail: '0800 008 6811 — for family and friends', href: 'tel:08000086811' },
  gp: { name: 'Your GP', detail: 'Can help you stop safely and refer you to local services', href: '' },
};
function helplines(keys) {
  let all = HELPLINES;
  try { if (process.env.SOBER_HELPLINES_JSON) all = { ...HELPLINES, ...JSON.parse(process.env.SOBER_HELPLINES_JSON) }; } catch (_) {}
  return keys.map((k) => all[k]).filter(Boolean);
}

/*
 * Categories. Each says how the tracker counts, what it must warn about, and which helplines to show.
 *  - noQuitFlow: abrupt stopping can be dangerous — only a "with medical support" tracker is offered.
 *  - lapseCard: extra card shown on every lapse (opioid overdose risk after reduced tolerance).
 *  - unit: what "amount" means.
 */
const CATEGORIES = {
  alcohol: { name: 'Alcohol', emoji: '🍷', unit: 'units', screen: 'audit',
    helplines: ['drinkline', 'aa', 'smart', 'withyou', 'samaritans'],
    note: 'If you drink every day, drink in the morning, or have ever had shakes, sweats, fits or hallucinations when stopping, don’t stop suddenly on your own — see your GP first. They can help you stop safely.' },
  nicotine: { name: 'Smoking / vaping', emoji: '🚭', unit: 'cigarettes',
    helplines: ['smokefree', 'samaritans'],
    note: 'Stop-smoking services, nicotine replacement, prescribed medicines and vapes all help — combining support with them works best. Cutting down first works as well as a quit date. If you smoke, switching to vaping is a step forward, not a lapse.' },
  gambling: { name: 'Gambling', emoji: '🎰', unit: '£',
    helplines: ['gambling', 'gamstop', 'samaritans'],
    note: 'Put blocks in place while things are calm: GAMSTOP self-exclusion, your bank’s gambling block, and blocking software. If money worries or debt are building, the National Gambling Helpline can help today — 24/7.' },
  cannabis: { name: 'Cannabis', emoji: '🌿', unit: 'sessions',
    helplines: ['frank', 'withyou', 'samaritans'],
    note: 'Withdrawal (poor sleep, irritability, vivid dreams) is unpleasant but not dangerous and usually eases within a couple of weeks. If you notice paranoia, hearing or seeing things, or feel unsafe — contact your GP, NHS 111 or 999.' },
  opioids: { name: 'Opioids', emoji: '💊', unit: 'uses', lapseCard: 'overdose',
    helplines: ['withyou', 'frank', 'emergency', 'samaritans'],
    note: 'Please work with a drug service or GP — they can offer treatment that makes stopping safer. After any break your tolerance drops fast, so using your old amount can be fatal. Pharmacists can give you naloxone without a prescription.' },
  sedatives: { name: 'Benzodiazepines / sleeping pills', emoji: '💤', unit: 'doses', noQuitFlow: true,
    helplines: ['gp', 'withyou', 'frank', 'samaritans'],
    note: 'Stopping benzodiazepines or similar medicines suddenly can cause seizures. Don’t stop on your own — your GP can plan a safe, gradual reduction. This app can track the plan your GP gives you, but won’t suggest one.' },
  ghb: { name: 'GHB / GBL', emoji: '⚠️', unit: 'uses', noQuitFlow: true, lapseCard: 'overdose',
    helplines: ['withyou', 'frank', 'emergency'],
    note: 'Stopping GHB/GBL suddenly after regular use can be life-threatening. Please get medical help to stop — contact a drug service or your GP, or 999 in an emergency.' },
  stimulants: { name: 'Stimulants (cocaine, etc.)', emoji: '⚡', unit: 'uses',
    helplines: ['frank', 'withyou', 'samaritans'],
    note: 'The comedown can bring very low mood. If you feel unsafe, contact Samaritans (116 123) or 999. Mixing with alcohol raises the risks.' },
  vaping: { name: 'Vaping', emoji: '💨', unit: 'sessions',
    helplines: ['smokefree', 'samaritans'],
    note: 'If vaping helped you stop smoking, that’s a real health win — don’t let quitting vapes tip you back to cigarettes. Cutting nicotine strength gradually works; stop-smoking services support vape quitters too.' },
  ketamine: { name: 'Ketamine', emoji: '🐴', unit: 'uses',
    helplines: ['frank', 'withyou', 'samaritans'],
    note: 'Regular ketamine can seriously damage the bladder. Pain or blood when weeing, needing to go very often, or tummy pain — see your GP soon (and say you use ketamine; they need to know to help). Bladder damage can improve after stopping.' },
  mdma: { name: 'MDMA / ecstasy', emoji: '💗', unit: 'uses',
    helplines: ['frank', 'withyou', 'samaritans'],
    note: 'Low mood for a few days afterwards (“comedown”) is common. Overheating, confusion or a fit after taking it is an emergency — 999. Mixing with alcohol or other drugs raises the risks.' },
  nitrous: { name: 'Nitrous oxide (balloons)', emoji: '🎈', unit: 'canisters',
    helplines: ['frank', 'withyou'],
    note: 'Heavy use can cause B12 deficiency and nerve damage. Numbness, tingling, weak or wobbly legs — stop and see your GP or NHS 111 urgently; it’s treatable if caught early.' },
  spice: { name: 'Synthetic cannabinoids (spice)', emoji: '🧪', unit: 'uses', noQuitFlow: true,
    helplines: ['withyou', 'frank', 'emergency'],
    note: 'Withdrawal from regular spice use can be severe (including fits in some cases). Please get support from a drug service or your GP to stop safely. This app can track the plan they give you.' },
  gabapentinoids: { name: 'Pregabalin / gabapentin', emoji: '💊', unit: 'doses', noQuitFlow: true,
    helplines: ['gp', 'withyou', 'frank'],
    note: 'Stopping pregabalin or gabapentin suddenly can cause withdrawal and, rarely, fits. Don’t stop on your own — your GP can plan a gradual reduction. Mixing with opioids or alcohol can stop your breathing.' },
  codeine: { name: 'Codeine / prescription painkillers', emoji: '💊', unit: 'doses', lapseCard: 'overdose',
    helplines: ['gp', 'withyou', 'frank'],
    note: 'Your GP or pharmacist can help you cut down safely and manage pain another way. Many codeine products also contain paracetamol — taking extra can cause serious liver damage.' },
  caffeine: { name: 'Caffeine / energy drinks', emoji: '☕', unit: 'drinks',
    helplines: [],
    note: 'Cutting down gradually avoids the 2–9 day headache and tiredness. If you take ADHD stimulant medication, lots of caffeine can add to a racing heart or anxiety — worth mentioning to your prescriber.' },
  shopping: { name: 'Spending / shopping', emoji: '🛍️', unit: '£',
    helplines: ['samaritans'],
    note: 'Delete saved cards, unsubscribe from sale emails and use a 48-hour rule for non-essentials. If debt is building, free help: StepChange (0800 138 1111) or National Debtline (0808 808 4000).' },
  porn: { name: 'Porn', emoji: '🔒', unit: 'times', valuesBased: true,
    helplines: ['samaritans'],
    note: 'Set this goal around what matters to you, not around guilt. Slip-ups are information about what you needed, not a moral failing.' },
  screens: { name: 'Social media / phone', emoji: '📱', unit: 'hours',
    helplines: [], note: 'Measure what it does to your day, not just the hours. Small, specific limits (no phone in the bedroom) beat total bans.' },
  gaming: { name: 'Gaming', emoji: '🎮', unit: 'hours',
    helplines: ['samaritans'], note: 'Judge it by the impact on sleep, work and people — not hours alone.' },
  binge: { name: 'Binge eating', emoji: '🍽️', unit: 'episodes', noCalories: true,
    helplines: ['samaritans'],
    note: 'This app never tracks calories, weight or restriction here — restriction tends to drive binges. Regular meals help. Guided CBT self-help is the recommended first step; your GP can refer you, and Beat supports eating disorders.' },
  other: { name: 'Something else', emoji: '✳️', unit: 'times', helplines: ['samaritans'], note: '' },
};

// UK AUDIT (10 items). Options carry their points. Q2/Q3 use UK units.
const AUDIT = [
  { q: 'How often do you have a drink containing alcohol?', o: [['Never', 0], ['Monthly or less', 1], ['2–4 times a month', 2], ['2–3 times a week', 3], ['4 or more times a week', 4]] },
  { q: 'How many units of alcohol do you drink on a typical day when you are drinking?', hint: 'A pint of 4% beer ≈ 2.3 units; a 175ml glass of 12% wine ≈ 2.1; a single spirit ≈ 1.', o: [['0–2', 0], ['3–4', 1], ['5–6', 2], ['7–9', 3], ['10 or more', 4]] },
  { q: 'How often have you had 6 or more units (women) or 8 or more units (men) on a single occasion in the last year?', o: [['Never', 0], ['Less than monthly', 1], ['Monthly', 2], ['Weekly', 3], ['Daily or almost daily', 4]] },
  { q: 'How often during the last year have you found that you were not able to stop drinking once you had started?', o: [['Never', 0], ['Less than monthly', 1], ['Monthly', 2], ['Weekly', 3], ['Daily or almost daily', 4]] },
  { q: 'How often during the last year have you failed to do what was normally expected of you because of drinking?', o: [['Never', 0], ['Less than monthly', 1], ['Monthly', 2], ['Weekly', 3], ['Daily or almost daily', 4]] },
  { q: 'How often during the last year have you needed an alcoholic drink in the morning to get yourself going after a heavy drinking session?', o: [['Never', 0], ['Less than monthly', 1], ['Monthly', 2], ['Weekly', 3], ['Daily or almost daily', 4]], morning: true },
  { q: 'How often during the last year have you had a feeling of guilt or remorse after drinking?', o: [['Never', 0], ['Less than monthly', 1], ['Monthly', 2], ['Weekly', 3], ['Daily or almost daily', 4]] },
  { q: 'How often during the last year have you been unable to remember what happened the night before because you had been drinking?', o: [['Never', 0], ['Less than monthly', 1], ['Monthly', 2], ['Weekly', 3], ['Daily or almost daily', 4]] },
  { q: 'Have you or somebody else been injured as a result of your drinking?', o: [['No', 0], ['Yes, but not in the last year', 2], ['Yes, during the last year', 4]] },
  { q: 'Has a relative, friend, doctor or other health worker been concerned about your drinking or suggested that you cut down?', o: [['No', 0], ['Yes, but not in the last year', 2], ['Yes, during the last year', 4]] },
];
const AUDIT_C_BANDS = [[0, 'lower risk'], [5, 'increasing risk'], [8, 'higher risk'], [11, 'possible dependence']];
const AUDIT_BANDS = [[0, 'lower risk'], [8, 'increasing risk'], [16, 'higher risk'], [20, 'possible dependence']];
const WITHDRAWAL_QUESTIONS = [
  { id: 'daily', q: 'Do you drink every day, or almost every day?' },
  { id: 'morning', q: 'Do you ever drink in the morning, or to stop yourself feeling shaky or unwell?' },
  { id: 'symptoms', q: 'When you’ve stopped or cut down before, have you had shakes, sweats, feeling sick, or bad anxiety?' },
  { id: 'severe', q: 'Have you ever had a fit (seizure), seen or heard things that weren’t there, or become confused after stopping drinking?' },
];

const band = (bands, score) => [...bands].reverse().find(([min]) => score >= min)[1];

/**
 * Alcohol safety note. Deliberately the SAME for everyone, whatever their score: the app shows the published
 * AUDIT score and band, and published NHS/NICE safety advice, but never decides for someone whether stopping
 * is safe (personalised triage would make this a medical device under MHRA guidance, and could falsely reassure).
 */
const ALCOHOL_SAFETY = {
  title: 'Before you stop: is it safe for you to stop suddenly?',
  intro: 'For most people it is. But if your body has got used to alcohol, stopping all at once can be dangerous — it can cause fits. Speak to your GP or a local alcohol service BEFORE you stop if any of these are true:',
  signs: [
    'You drink every day or almost every day',
    'You sometimes drink in the morning, or to stop feeling shaky or unwell',
    'When you’ve stopped or cut down before, you’ve had shakes, sweats, sickness or bad anxiety',
    'You’ve ever had a fit, seen or heard things that weren’t there, or become confused after stopping drinking',
  ],
  outro: 'They can help you stop safely, sometimes with medication. This app can still track your plan with you. If you ever feel shaky, sweaty or unwell after stopping, contact your GP or NHS 111; for a fit, hallucinations or confusion, call 999.',
  source: 'NHS: Alcohol misuse — treatment; NICE CG115',
};
function alcoholGate() {
  return { gate: 'info', flags: [], message: '' };
}

// Emergency signs for the first days after stopping alcohol (shown days 0–5).
const ALCOHOL_EMERGENCY = 'If you have a fit, see or hear things that aren’t there, have severe shaking, or become confused after stopping drinking, call 999. Mild sweats, shakiness, nausea or anxiety: contact your GP or NHS 111 today.';

// Benefits — only claims with NHS/BMJ-level support, framed as "many people".
const BENEFITS = [
  { day: 3, text: 'Many people notice sleep starting to settle after the first few nights.' },
  { day: 14, text: 'Sleep quality and energy are commonly reported to improve within a couple of weeks.' },
  { day: 30, text: 'In a study of a month without alcohol, people’s blood pressure, insulin resistance and weight all improved on average (Mehta et al., BMJ Open 2018).' },
  { day: 90, text: 'Three months in, many people say their mood, concentration and confidence about drinking have changed for good.' },
  { day: 180, text: 'Six months: in Dry January follow-ups, people kept drinking less and felt more in control at six months — and you’ve done six times that.' },
  { day: 365, text: 'A year. There’s very little research on year-long challenges — you are your own study now. What will you keep?' },
];
const MILESTONES = [1, 3, 7, 14, 30, 50, 100, 150, 200, 250, 300, 365];

const TRIGGERS = ['hungry', 'angry', 'lonely', 'tired', 'stressed', 'bored', 'celebrating', 'social', 'after work', 'conflict', 'habit time', 'low mood'];

module.exports = { HELPLINES_CHECKED, helplines, CATEGORIES, AUDIT, AUDIT_C_BANDS, AUDIT_BANDS, WITHDRAWAL_QUESTIONS, ALCOHOL_SAFETY, band, alcoholGate, ALCOHOL_EMERGENCY, BENEFITS, MILESTONES, TRIGGERS };
