/*
 * Breathwork content: practices, the science behind them (with sources), and the safety check that unlocks the
 * intense ones. Kept as data so it can be reviewed and translated without touching the session engine.
 * Wording rule: say what's known, what isn't, and never promise a cure.
 */

// Session types the browser engine understands:
//   pattern   — repeat `steps` ([cue, seconds]) for one of `minutes`
//   power     — rounds of fast deep breaths, an empty-lung hold (stopwatch), a 15-s recovery hold
//   connected — continuous breathing at `pace` with no pauses, then a quiet integration period
const PRACTICES = [
  { id: 'sigh', group: 'everyday', type: 'pattern', emoji: '😮‍💨', name: 'Cyclic sighing',
    about: 'Two breaths in through the nose, one long, slow sigh out of the mouth. The best-studied five minutes for mood.',
    how: 'Breathe in through your nose, then take a second short sip of air on top. Let it all out slowly through your mouth, longer than the in-breath.',
    steps: [['in', 2.5, 'Breathe in (nose)'], ['in', 1, 'Little extra sip'], ['out', 6, 'Long slow sigh out']], minutes: [3, 5, 10], defaultMinutes: 5 },
  { id: 'resonance', group: 'everyday', type: 'pattern', emoji: '🌊', name: 'Slow breathing (6 a minute)',
    about: 'Even, slow breaths at about six a minute. Lines your heart rhythm up with your breath — the body’s natural brake.',
    how: 'In through the nose for 5½, out through the nose for 5½. Belly soft. Smooth, not forced — it should feel easy.',
    steps: [['in', 5.5, 'Breathe in'], ['out', 5.5, 'Breathe out']], minutes: [5, 10, 15, 20], defaultMinutes: 10 },
  { id: 'box', group: 'everyday', type: 'pattern', emoji: '⬜', name: 'Box breathing',
    about: 'Four in, four hold, four out, four hold. Steadying before something stressful, and easy to count when your head is busy.',
    how: 'Trace the box: in through the nose for 4, hold for 4, out for 4, hold for 4.',
    steps: [['in', 4, 'Breathe in'], ['hold', 4, 'Hold'], ['out', 4, 'Breathe out'], ['hold', 4, 'Hold']], minutes: [3, 5, 10], defaultMinutes: 5 },
  { id: 'downshift', group: 'everyday', type: 'pattern', emoji: '🪶', name: 'Long out-breath',
    about: 'In for 4, out for 6–8 through the nose. Also the “ease off” breath for when an intense session gets too much.',
    how: 'Slow, quiet in-breath through the nose; let the out-breath be longer and softer.',
    steps: [['in', 4, 'Breathe in (nose)'], ['out', 7, 'Slowly out (nose)']], minutes: [2, 5, 10], defaultMinutes: 5 },
  { id: 'power', group: 'deep', type: 'power', emoji: '⚡', name: 'Power breathing (Wim Hof-style)',
    about: 'Rounds of deep, fast breaths, then a breath-hold on empty lungs, then a 15-second recovery hold. Energising, tingly, often very still afterwards.',
    how: 'Lying down. Breathe fully in (belly then chest), let it go without pushing. After the last breath, exhale and hold with empty lungs until you need to breathe. Then a big breath in and hold for 15.',
    breaths: [30, 35, 40], defaultBreaths: 30, rounds: [3, 4], defaultRounds: 3, pace: { in: 1.4, out: 1.1 }, recovery: 15, maxHold: 180 },
  { id: 'connected', group: 'deep', type: 'connected', emoji: '🌀', name: 'Connected breathing (beginner)',
    about: 'Continuous breathing with no pause between in and out — the style used in the brain-imaging study, in a short, gentle form. Ends with quiet rest.',
    how: 'Lying down, eyes closed. Breathe in and out through the mouth in one continuous circle, a little fuller and faster than normal — no gap at the top or bottom. If it gets too much, press Ease off.',
    pace: { in: 2.2, out: 2.2 }, minutes: [10, 15, 20], defaultMinutes: 10, integration: 5 },
];
const INTENSE = PRACTICES.filter((p) => p.group === 'deep').map((p) => p.id);
const ALL = PRACTICES.map((p) => p.id);

// Each card: short, plain English, with where it comes from.
const LEARN = [
  { id: 'slow', title: 'Why slow breathing helps a busy brain',
    body: 'At about six breaths a minute your heart rate starts rising and falling with each breath. That boosts heart-rate variability — a sign the vagus nerve, the body’s brake, is working. Reviews of trials that train this (HRV biofeedback) find moderate drops in stress and anxiety. Studies in ADHD are small but promising, mainly for emotional control rather than attention itself.',
    source: 'Lehrer et al. 2020, Applied Psychophysiology and Biofeedback (meta-analysis of 58 studies)' },
  { id: 'sigh', title: 'Five minutes of sighing beat meditation',
    body: 'In a month-long trial with 108 people, five minutes a day of cyclic sighing improved mood more than mindfulness meditation did, and lowered resting breathing rate. Box breathing and fast “cyclic hyperventilation” also helped, but sighing helped most.',
    source: 'Balban et al. 2023, Cell Reports Medicine' },
  { id: 'fast', title: 'What fast breathing actually does',
    body: 'Breathing fast and deep blows off carbon dioxide faster than you make it. Your blood becomes less acidic (respiratory alkalosis), the blood vessels in your brain narrow, and less blood reaches it. That’s the light-headedness. Less free calcium in the blood causes the tingling and the clawed, cramping hands (tetany). It’s all reversible: a minute or two of slow breathing brings the carbon dioxide back — which is why “Ease off” works.',
    source: 'Standard respiratory physiology' },
  { id: 'hold', title: 'Why the breath-holds feel so long — and why never in water',
    body: 'After fast breathing your carbon dioxide starts low, so the urge to breathe arrives late. But oxygen keeps falling during the hold, and blood oxygen can drop well below normal before you feel any need to breathe. That’s how people black out without warning — it’s the cause of “shallow water blackout”. Lying down on dry land, it’s harmless; in water or behind the wheel, it can kill.',
    source: 'Hyperventilation and breath-hold blackout: diving-medicine literature; Wim Hof Method safety guidance' },
  { id: 'study', title: 'The brain-imaging study',
    body: 'Researchers in Mannheim scanned 30 experienced practitioners doing intense connected breathing. Grey-matter blood flow fell by about 45% (from 16.2 to 9.8 ml per 100 g per minute). People described an “oceanic” state like a moderate dose of psilocybin, with fewer visuals. How strong it felt tracked changes in the default mode network — the self-talk network — more than the drop in blood flow. Limits: a small group of experienced people, measured during the session; it says nothing yet about lasting benefits.',
    source: 'Schmitz et al., Central Institute of Mental Health, Mannheim — ECNP Congress 2026; Progress in Neuro-Psychopharmacology & Biological Psychiatry' },
  { id: 'wimhof', title: 'What’s actually proven about Wim Hof breathing',
    body: 'In the best-known trial, 12 people trained in the method released more adrenaline and had fewer flu-like symptoms after an injection of bacterial toxin than 12 untrained people. So it really does change the stress system. Most other claims (immunity, weight, “alkalising”) haven’t been properly tested.',
    source: 'Kox et al. 2014, PNAS' },
  { id: 'adhd', title: 'ADHD and the “always on” brain',
    body: 'In ADHD the default mode network — the mind-wandering, self-talk network — tends not to switch off cleanly when you try to focus, so it keeps leaking into tasks. Intense breathwork, ketamine and psychedelics all quieten it for a while, which is why those states can feel like a rare break. There are no trials yet of breathwork changing this in ADHD; the everyday slow practices are the ones with evidence for steadier days.',
    source: 'Sonuga-Barke & Castellanos 2007, Neuroscience & Biobehavioral Reviews (default-mode interference hypothesis)' },
  { id: 'quiet', title: 'Chasing the quiet',
    body: 'If an intense session gives you a quiet you rarely get, that’s real and worth having. Treat it like any strong state: planned, a couple of times a week, lying down, never as a way out of a bad hour. Pippin will gently mention it if you do more than one a day. The slow everyday breaths are the ones that build a steadier baseline — use those daily, and the deep sessions as the occasional treat.',
    source: 'Pippin guidance' },
];

// One-time safety check for the intense practices. block = rules them out in the app; others are cautions.
const SAFETY = [
  { id: 'seizure', q: 'Have you ever had a seizure or epilepsy?', block: true },
  { id: 'heart', q: 'Any heart condition, irregular heartbeat, heart attack or stroke?', block: true },
  { id: 'bp', q: 'High blood pressure that isn’t well controlled?', block: true },
  { id: 'pregnant', q: 'Are you pregnant?', block: true },
  { id: 'eyes', q: 'Glaucoma, a detached retina, or an aneurysm?', block: true },
  { id: 'mental', q: 'Psychosis, bipolar disorder, or severe panic attacks?', block: true },
  { id: 'surgery', q: 'Surgery or a serious injury in the last six weeks?', block: true },
  { id: 'lungs', q: 'Asthma or another lung condition?', block: false, caution: 'Go gently, keep your inhaler nearby, and stop if you get wheezy.' },
  { id: 'meds', q: 'Taking medicine for your heart, blood pressure, blood sugar or seizures?', block: false, caution: 'Check with your GP before the intense practices.' },
];
const RULES = [
  { id: 'water', text: 'Never in or near water — no baths, pools or the sea.' },
  { id: 'position', text: 'Only lying down, or sitting well supported. Never standing, walking or driving.' },
  { id: 'substances', text: 'Not within 24 hours of alcohol, cannabis or any other drug.' },
  { id: 'stop', text: 'Ease off straight away for chest pain, a sudden bad headache, confusion or a racing, uneven heartbeat — and get help if it doesn’t settle.' },
  { id: 'company', text: 'For connected breathing, have someone else at home the first few times.' },
];
const BLOCKED_MESSAGE = 'Because of what you ticked, Pippin keeps the intense practices locked. The everyday ones are safe and are where most of the benefit is. If you want to try intense breathwork, do it with a trained facilitator and your doctor’s OK.';

const PUBLIC = { practices: PRACTICES, learn: LEARN, safety: SAFETY, rules: RULES, blockedMessage: BLOCKED_MESSAGE };
module.exports = { PRACTICES, INTENSE, ALL, LEARN, SAFETY, RULES, PUBLIC };
