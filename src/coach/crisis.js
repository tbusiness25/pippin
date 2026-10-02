/*
 * Deterministic crisis screen. Runs on EVERY user message, in code, BEFORE and OUTSIDE the model —
 * so it can't be argued with, forgotten, or worn down over a long conversation (the documented
 * failure of model-only safeguards). It errs towards showing support: a false positive costs a card,
 * a false negative could cost much more. It never blocks the conversation.
 *
 * Levels: 'high' = explicit suicidal/self-harm intent or plan; 'concern' = hopelessness, being a
 * burden, wanting to disappear, or indirect phrasing. Tested in scripts/redteam.js.
 */
const HIGH = [
  /\b(kill|killing|end|ending|take|taking)\s+(my\s*self|myself|my\s+(own\s+)?life)\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(want|wanna|going|plan(ning)?|ready)\s+to\s+die\b/i,
  /\bself[-\s]?harm(ing)?\b/i,
  /\b(cut|cutting|hurt|hurting|harm|harming)\s+(my\s*self|myself)\b/i,
  /\boverdos(e|ing)\b/i,
  /\b(how\s+many|how\s+much|enough)\s+(of\s+(my|the|these|those)\s+)?((sleeping\s+)?(pills|tablets)|paracetamol|meds|medication|insulin)\b(?!.*\b(should\s+i\s+take\s+(daily|a\s+day|per\s+day)|left|to\s+order|in\s+stock))/i,
  /\b(lethal|fatal)\s+(dose|amount)\b/i,
  /\b(end\s+it\s+all|not\s+be\s+around\s+any\s*more|say\s+goodbye\s+to\s+everyone)\b/i,
  /\b(giv(e|ing)|gave)\s+(all\s+)?(my\s+)?(stuff|things|belongings|possessions)\s+away\b/i,
  /\b(wrote|written|writing|write)\s+(goodbye\s+)?(letters|a\s+letter|notes?)\s+(to|for)\s+(my\s+)?(kids|children|family|wife|husband|partner|everyone)\b/i,
  /\bjump\s+(off|from|in\s+front)\b/i,
  /\bhang(ing)?\s+myself\b/i,
  /\b(won'?t|will\s+not|wouldn'?t)\s+(be\s+)?(here|around|alive)\s+(much\s+longer|tomorrow|next\s+week)\b/i,
  /\bwrit(e|ing|ten)\s+(a\s+)?(suicide\s+)?note\s+(to|for)\s+(my|the)\s+(family|kids|wife|husband|partner)\b/i,
];
// Withdrawal / medical emergencies → 999 first (fits, hallucinations, confusion after stopping alcohol/sedatives).
const MEDICAL = [
  /\b(having|had|having\s+a|just\s+had\s+a)\s+(a\s+)?(fit|seizure|convulsion)s?\b(?!\s+(of|for|in|out)\b)/i,
  /\b(seeing|hearing)\s+(things|people|bugs|voices)\s+(that\s+)?(aren'?t|are\s+not|that\s+aren'?t)\s+(there|real)\b/i,
  /\b(can'?t|cannot)\s+stop\s+(shaking|trembling)\b/i,
  /\b(confused|don'?t\s+know\s+where\s+i\s+am)\b.*\b(stopp?ed|since|withdraw)/i,
  /\b(overdos(ed|ing)|took\s+too\s+many|unresponsive|not\s+breathing|blue\s+lips)\b/i,
];
const CONCERN = [
  /\b(i'?ve|i\s+have)\s+(ruined|blown|wrecked)\s+(it|everything)\b/i,
  /\bwhat'?s\s+the\s+point\s+(in\s+)?(trying|even\s+trying|stopping|carrying\s+on)\b/i,
  /\b(better\s+off\s+without\s+me|burden\s+(to|on)\s+(every|them|my))/i,
  /\b(no\s+(point|reason)\s+(in\s+)?(living|going\s+on|being\s+here|to\s+live))\b/i,
  /\b(can'?t|cannot)\s+(go\s+on|do\s+this\s+any\s*more|take\s+(it|this)\s+any\s*more|keep\s+going)\b/i,
  /\b(want|wish)\s+(to|i\s+could)\s+(disappear|not\s+wake\s+up|not\s+exist|sleep\s+forever|vanish)\b/i,
  /\bsleep\s+and\s+(never|not)\s+wake\s+up\b/i,
  /\b(never|not)\s+wake\s+up\s+again\b/i,
  /\b(don'?t|do\s+not)\s+want\s+to\s+(be\s+here|be\s+alive|exist|wake\s+up)\b/i,
  /\b(i\s+(feel|am|'m)|feeling)\s+(so\s+|completely\s+|totally\s+)?(hopeless|worthless|trapped|empty|numb)\b/i,
  /\b(i'?m|i\s+am)\s+(a\s+)?(waste\s+of\s+space|failure\s+at\s+everything)\b/i,
  /\bwhat'?s\s+the\s+point\s+(of\s+)?(anything|living|any\s+of\s+it|me)\b/i,
  /\beveryone\s+would\s+be\s+(happier|better)\b/i,
  /\b(hurt|harm|kill)\s+(him|her|them|someone|somebody|the\s+kids)\b/i,
];

function screen(text) {
  const t = String(text || '');
  if (HIGH.some((r) => r.test(t))) return 'high';
  if (MEDICAL.some((r) => r.test(t))) return 'medical';
  if (CONCERN.some((r) => r.test(t))) return 'concern';
  return null;
}

// Support contacts. Overridable per country for the public release (CRISIS_RESOURCES_JSON).
const DEFAULT_RESOURCES = [
  { name: 'Samaritans', detail: 'Call 116 123 — free, 24/7', href: 'tel:116123' },
  { name: 'SHOUT', detail: 'Text SHOUT to 85258 — free, 24/7', href: 'sms:85258?body=SHOUT' },
  { name: 'NHS 111', detail: 'Call 111 and choose option 2 for mental health', href: 'tel:111' },
  { name: 'Emergency', detail: 'If you are in danger now, call 999', href: 'tel:999' },
];
function resources(level) {
  if (level === 'medical') return MEDICAL_RESOURCES;
  try { if (process.env.CRISIS_RESOURCES_JSON) return JSON.parse(process.env.CRISIS_RESOURCES_JSON); } catch (_) {}
  return DEFAULT_RESOURCES;
}

// Instruction added for the model's reply when the screen fires (the card itself is shown by the app).
const MEDICAL_RESOURCES = [
  { name: 'Emergency', detail: 'Call 999 now — fits, hallucinations, severe shaking, confusion, overdose or trouble breathing', href: 'tel:999' },
  { name: 'NHS 111', detail: 'For milder withdrawal symptoms (sweats, shakiness, nausea, anxiety) — today', href: 'tel:111' },
];
const MODEL_GUIDANCE = {
  medical: 'MEDICAL: The person may be describing a medical emergency (withdrawal fit, hallucinations, severe shaking, confusion or overdose). The app is showing 999. Tell them clearly and calmly to call 999 now (or get someone to). Keep it to 2-3 short sentences. No other advice.',
  high: 'SAFETY: The person may be at risk of suicide or self-harm. The app is already showing them crisis contacts. ' +
    'Respond with warmth and without panic. Ask directly and gently whether they are safe right now. Encourage contacting ' +
    'Samaritans (116 123), their safety-plan person, or 999 if in immediate danger. Stay with them in the conversation. ' +
    'Do NOT give advice about methods, medication amounts or anything that could cause harm. Do NOT lecture. Keep it short.',
  concern: 'CARE: The person sounds very low. Acknowledge it warmly, ask gently how bad it is right now and whether they are safe, ' +
    'and mention that talking to someone (a trusted person, their GP, or Samaritans on 116 123) can help. Do not rush to tasks.',
};

module.exports = { screen, resources, MODEL_GUIDANCE };
