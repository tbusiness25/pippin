/*
 * The coach's health library: NHS website pages copied word for word into library/nhs/ by
 * scripts/update-library.js, searched locally (BM25) — no embeddings model, no network, works with any AI.
 * Each person ticks which pages their coach may use. Passages go to the model as reference and to the
 * person as source cards with the exact text, a link and the date it was copied (the NHS licence terms).
 * Dose and dosing passages are never indexed: the coach doesn't advise on medication.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'library');
const NO_DOSE_HEADING = /\b(dose|doses|dosage|how (and when )?to take|how much to take|if you take too much|if you forget to take|overdose)\b/i;
const DOSE_TEXT = /\b\d+(\.\d+)?\s?(mg|milligrams?|micrograms?|mcg)\b/i;
const MAX_CHUNK = 1400;
const STOP = new Set(('a about after again all also am an and any are as at be because been before being but by can could did do does doing '
  + 'for from get got had has have having he her here him his how i if in into is it its just like me more most my no not now of off on '
  + 'once only or other our out over own really same she should so some such than that the their them then there these they this those '
  + 'through to too under until up very was we were what when where which while who why will with would you your yours im ive dont cant '
  + 'every day days today time times feel feeling thing things want need lot bit much way make help please know think going').split(' '));

let TOPIC_STEMS = null;
let catalogue = { groups: {}, sources: [] };
let chunks = [];
let df = new Map();
let avgLen = 1;

// Everyday words → the words the NHS pages use.
const SAME = { angry: 'anger', furious: 'anger', rage: 'anger', anxious: 'anxiety', worried: 'anxiety', worry: 'anxiety', panic: 'anxiety',
  depressed: 'depression', low: 'depression', sad: 'depression', drunk: 'drink', booze: 'alcohol', hangover: 'alcohol',
  tired: 'tiredness', exhausted: 'tiredness', knackered: 'tiredness', fatigue: 'tiredness', meds: 'medicine', medication: 'medicine',
  tablets: 'medicine', gamble: 'gambling', bet: 'gambling', betting: 'gambling', stressed: 'stress', overwhelmed: 'stress',
  awake: 'sleep', asleep: 'sleep', bedtime: 'sleep', nightmares: 'sleep',
  exercise: 'activity', workout: 'activity', walking: 'activity', counselling: 'therapy', therapist: 'therapy' };
// Automatic look-ups only happen when a message mentions a health topic; otherwise the coach can still ask.
const TOPICS = ('adhd add diagnosis diagnosed assessment symptom symptoms sleep insomnia tiredness anxiety depression stress anger '
  + 'mood mental wellbeing alcohol drink drinking units hangover drug drugs cannabis cocaine gambling addiction addicted withdrawal detox '
  + 'medicine methylphenidate ritalin concerta elvanse lisdexamfetamine atomoxetine side effects therapy cbt talking gp crisis '
  + 'activity active fitness rest burnout overwhelm worry panic').split(' ');
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(ness|ing|edly|ed|ly|es|s)$/, '').slice(0, 12);
const tokens = (t) => String(t || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/)
  .filter((w) => w.length > 1 && !STOP.has(w)).flatMap((w) => (SAME[w] ? [stem(w), stem(SAME[w])] : [stem(w)]));

/** Split a long section on paragraph breaks so a passage stays readable on a phone. */
function pieces(text) {
  if (text.length <= MAX_CHUNK) return [text];
  const out = [];
  let cur = '';
  for (const para of text.split(/\n\n+/)) {
    if (cur && cur.length + para.length > MAX_CHUNK) { out.push(cur.trim()); cur = ''; }
    cur += (cur ? '\n\n' : '') + para;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function load() {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'sources.json'), 'utf8'));
    const docs = [];
    for (const s of meta.sources) {
      try { docs.push(JSON.parse(fs.readFileSync(path.join(DIR, 'nhs', `${s.id}.json`), 'utf8'))); } catch (_) { /* not fetched yet */ }
    }
    catalogue = {
      groups: meta.groups,
      sources: docs.map((d) => ({ id: d.id, group: d.group, title: d.title, url: d.url, copied_on: d.copied_on, last_reviewed: d.last_reviewed })),
    };
    chunks = [];
    for (const d of docs) {
      for (const s of d.sections) {
        if (NO_DOSE_HEADING.test(`${s.heading} ${s.sub}`)) continue;
        const parts = pieces(s.text);
        for (const [i, text] of parts.entries()) {
          if (d.group === 'medicines' && DOSE_TEXT.test(text)) continue;
          const toks = [...tokens(d.title), ...tokens(s.heading), ...tokens(s.heading), ...tokens(s.sub), ...tokens(s.sub), ...tokens(text)];
          const tf = new Map();
          for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
          chunks.push({ doc: d, heading: s.heading, sub: s.sub, part: parts.length > 1 ? `${i + 1} of ${parts.length}` : '', text, tf, len: toks.length });
        }
      }
    }
    df = new Map();
    for (const c of chunks) for (const t of c.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    avgLen = chunks.reduce((n, c) => n + c.len, 0) / (chunks.length || 1);
    console.log(`[library] ${docs.length} pages, ${chunks.length} passages`);
  } catch (e) {
    console.warn('[library] not loaded:', e.message);
  }
}

/** "Information from the NHS website, as at 061026" — the attribution the NHS licence asks for. */
function attribution(doc) {
  const [y, m, d] = String(doc.copied_on || '').split('-');
  return `Information from the NHS website${y ? `, as at ${d}${m}${y.slice(2)}` : ''}`;
}

/**
 * Best passages for a question, from the pages this person has switched on.
 * minScore keeps automatic look-ups quiet unless something genuinely matches.
 */
function search(query, allowed, { k = 3, minScore = 0 } = {}) {
  const allow = new Set(allowed || []);
  if (!allow.size || !chunks.length) return [];
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const N = chunks.length, K1 = 1.2, B = 0.75;
  const scored = [];
  for (const c of chunks) {
    if (!allow.has(c.doc.id)) continue;
    let score = 0, hits = 0;
    for (const t of q) {
      const f = c.tf.get(t);
      if (!f) continue;
      hits++;
      const idf = Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
      score += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * (c.len / avgLen)));
    }
    if (hits && score >= minScore) scored.push({ c, score: score * Math.min(1, hits / Math.min(q.length, 3)) });
  }
  scored.sort((a, b) => b.score - a.score);
  const out = [], seen = new Set();
  for (const { c, score } of scored) {
    const key = `${c.doc.id}|${label(c)}`;   // each part of a long section counts separately
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...passage(c), score: Math.round(score * 10) / 10 });
    if (out.length >= k) break;
  }
  return out;
}

const label = (c) => `${c.sub ? `${c.heading} — ${c.sub}` : c.heading}${c.part ? ` (part ${c.part})` : ''}`;

function passage(c) {
  return { source: c.doc.id, title: c.doc.title, heading: label(c), url: c.doc.url,
    text: c.text, attribution: attribution(c.doc) };
}

/** A saved reference ({source, heading}) back to its passage, from the current copy of the page. */
function find(ref) {
  const c = chunks.find((x) => x.doc.id === ref?.source && label(x) === ref.heading);
  return c ? passage(c) : null;
}

/** True when a message is about a health topic, so an automatic look-up is worth doing. */
function onTopic(text) {
  TOPIC_STEMS = TOPIC_STEMS || new Set(TOPICS.flatMap((w) => tokens(w)));
  return tokens(text).some((t) => TOPIC_STEMS.has(t));
}

const ids = () => catalogue.sources.map((s) => s.id);
const sources = () => catalogue;

load();
module.exports = { search, find, onTopic, sources, ids, attribution, reload: load, LICENCE_NOTE: 'Information from the NHS website is licensed under the Open Government Licence v3.0.' };
