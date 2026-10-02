/*
 * Voice-note agent: watches the Obsidian "Voice Notes" folder (e.g. written by a voice-recorder → Obsidian exporter),
 * classifies each new recording with the local model, and routes it:
 *   reminder → if-then plan (timed nudge) or inbox with a due date
 *   work     → inbox items tagged [work]
 *   memory   → memory (audio kept permanently)
 *   journal  → private reflection
 *   kids     → kids' archive (transcript + audio kept permanently) + memory
 *   other    → archived only
 * Old recordings (backfill) are archived using the exporter's own category — no actions, so nothing floods.
 * Owner only: the voice notes belong to the server owner. Transcripts are encrypted at rest.
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const game = require('../game');
const llm = require('../coach/llm');
const { encrypt } = require('../coach/crypto');

const DIR = process.env.VOICE_NOTES_DIR || '';
const STORE = process.env.AUDIO_STORE || '/data/audio';
const ACT_WITHIN_DAYS = 3;
const KEEP_AUDIO = new Set(['kids', 'memory']);
const FROM_ROUTER = { 'kids-memory': 'kids', 'work-todo': 'work', reminder: 'reminder', 'life-admin': 'reminder', general: 'other' };
let running = false;

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const fm = (raw.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const get = (k) => ((fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1] || '').trim().replace(/^["']|["']$/g, '');
  const transcript = ((raw.split(/^## Transcript\s*$/m)[1] || '').split(/^## /m)[0] || '').trim();
  const audio = (raw.match(/!\[\[(audio\/[^\]]+)\]\]/) || [])[1] || null;
  const title = ((raw.match(/^# (.+)$/m) || [])[1] || '').trim();
  return { rid: get('recording_id'), date: get('date'), routerCategory: get('category'), transcript, audio, title };
}

function keepAudio(rel, rid) {
  if (!rel) return null;
  const src = path.join(DIR, rel);
  if (!fs.existsSync(src)) return null;
  fs.mkdirSync(STORE, { recursive: true });
  const dest = path.join(STORE, `${rid.replace(/[^\w-]/g, '_')}${path.extname(src) || '.mp3'}`);
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
  return dest;
}

function calendar(tz, from) {
  // Explicit date table so "tomorrow" / "Sunday" resolve correctly (models get relative dates wrong).
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(from.getTime() + i * 86400000);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
    const wd = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long' }).format(d);
    return `${i === 0 ? 'today' : i === 1 ? 'tomorrow' : wd} = ${wd} ${day}`;
  }).join('; ');
}
const CLASSIFY = (tz, now, cal) => `You sort a person's voice-note transcripts. Recorded: ${now} (${tz}).
Date lookup (use it for every relative date): ${cal}.
Categories:
- "reminder": things to do or remember to do for home/family/life admin (appointments, buy X, call Y).
- "work": to-dos or notes about their job or business. Keep names out — use roles or initials.
- "memory": a moment, story or thing worth remembering about their life (not their kids talking).
- "journal": them reflecting on feelings, their day, thoughts, plans for themselves.
- "kids": their children talking, singing, telling stories, or a memory about the kids.
- "other": none of the above (music, accidental recording, a meeting recording, a podcast).
Reply with ONLY JSON:
{"category": "...", "title": "<max 8 words>", "summary": "<one or two sentences>",
 "reminders": [{"text": "<starts with a verb>", "date": "YYYY-MM-DD or null", "time": "HH:MM or null"}],
 "todos": ["<action, starts with a verb>"]}
Put each item in EITHER "reminders" (home/life things, especially with a date or time) OR "todos" (work tasks, or undated jobs) — never both.
Only include reminders/todos the speaker explicitly says they need to do ("remind me", "I need to", "must", "don't forget").
Wishes, intentions and reflections ("I want to be more patient") are NOT todos. A journal or kids recording usually has none.
Use the date lookup above for "tomorrow", "Sunday", "next week" etc. — never guess.`;

function parseJson(t) { const s = t.indexOf('{'), e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)); }

function dueAt(tz, date, time) {
  const guess = new Date(`${date}T${time}:00Z`);
  const off = (new Date(guess.toLocaleString('en-US', { timeZone: tz })) - new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }))) / 60000;
  return new Date(guess.getTime() - off * 60000);
}

async function route(owner, note, file) {
  const recorded = note.date ? new Date(note.date.replace(' ', 'T') + 'Z') : fs.statSync(file).mtime;
  const ageDays = (Date.now() - recorded) / 86400000;
  const actions = [];
  let cat = FROM_ROUTER[note.routerCategory] || 'other', title = note.title, summary = note.transcript.slice(0, 200);
  let c = null;
  if (ageDays <= ACT_WITHIN_DAYS && llm.configured() && note.transcript.length > 20) {
    try {
      const now = new Intl.DateTimeFormat('en-GB', { timeZone: owner.tz, dateStyle: 'full', timeStyle: 'short' }).format(recorded);
      const m = await llm.chat([{ role: 'system', content: CLASSIFY(owner.tz, now, calendar(owner.tz, recorded)) }, { role: 'user', content: note.transcript.slice(0, 12000) }], { maxTokens: 700, temperature: 0.2 });
      c = parseJson(m.content || '');
      if (['reminder', 'work', 'memory', 'journal', 'kids', 'other'].includes(c.category)) cat = c.category;
      title = c.title || title; summary = c.summary || summary;
    } catch (e) { console.warn('[voice] classify failed, using exporter category:', e.message); }
  }
  // Act only on recent recordings.
  if (ageDays <= ACT_WITHIN_DAYS) {
    for (const r of (c?.reminders || []).slice(0, 8)) {
      const text = String(r.text || '').slice(0, 200);
      if (!text) continue;
      if (r.date && r.time && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && /^\d{1,2}:\d{2}$/.test(r.time)) {
        const { rows } = await pool.query(`INSERT INTO commitments(user_id, what, when_text, due_at, source) VALUES ($1,$2,$3,$4,'voice') RETURNING id`,
          [owner.id, text, `${r.date} ${r.time}`, dueAt(owner.tz, r.date, r.time.padStart(5, '0'))]);
        actions.push({ type: 'plan', id: rows[0].id, text, when: `${r.date} ${r.time}` });
      } else {
        await pool.query('INSERT INTO inbox_items(user_id, text, due_on) VALUES ($1,$2,$3)', [owner.id, text, /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : null]);
        actions.push({ type: 'inbox', text, due: r.date || null });
      }
    }
    // Models often repeat the same item in both lists — keep each thing once.
    const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const seenItems = new Set((c?.reminders || []).map((r) => norm(r.text)));
    for (const t of (c?.todos || []).slice(0, 8)) {
      const k = norm(t);
      if (!k || [...seenItems].some((r) => r === k || r.includes(k) || k.includes(r))) continue;
      seenItems.add(k);
      const text = `${cat === 'work' ? '[work] ' : ''}${String(t).slice(0, 200)}`;
      await pool.query('INSERT INTO inbox_items(user_id, text) VALUES ($1,$2)', [owner.id, text]);
      actions.push({ type: 'inbox', text });
    }
    if (cat === 'journal') {
      await pool.query(`INSERT INTO reflections(user_id, prompt, body, tags, day) VALUES ($1,'Voice journal',$2,'{voice}',$3)`,
        [owner.id, note.transcript.slice(0, 10000), game.localDay(owner.tz, recorded)]);
      actions.push({ type: 'journal' });
    }
  }
  if (cat === 'memory' || cat === 'kids') {
    await pool.query(`INSERT INTO memories(user_id, kind, title, body, status, vault_path, decided_at, created_at) VALUES ($1,$2,$3,$4,'approved',$5,NOW(),$6)`,
      [owner.id, cat === 'kids' ? 'kids' : 'note', String(title || 'A memory').slice(0, 120), String(summary || '').slice(0, 2000), `Voice Notes/${path.basename(file)}`, recorded]);
    actions.push({ type: 'memory' });
  }
  const kept = KEEP_AUDIO.has(cat) ? keepAudio(note.audio, note.rid) : null;
  await pool.query(`INSERT INTO voice_notes(user_id, recording_id, recorded_at, source_file, category, title, summary, transcript_enc, audio_file, vault_audio, actions, starred, routed_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()) ON CONFLICT (user_id, recording_id) DO NOTHING`,
    [owner.id, note.rid, recorded, path.basename(file), cat, String(title || '').slice(0, 120), String(summary || '').slice(0, 1000),
      note.transcript ? encrypt(note.transcript) : null, kept, note.audio, JSON.stringify(actions), cat === 'kids']);
  return { cat, actions, recent: ageDays <= ACT_WITHIN_DAYS };
}

async function scan() {
  if (!DIR || !fs.existsSync(DIR) || running) return;
  running = true;
  try {
    const { rows: [owner] } = await pool.query('SELECT * FROM users WHERE is_owner AND deleted_at IS NULL ORDER BY created_at LIMIT 1');
    if (!owner) return;
    const { rows } = await pool.query('SELECT recording_id FROM voice_notes WHERE user_id=$1', [owner.id]);
    const seen = new Set(rows.map((r) => r.recording_id));
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => path.join(DIR, f));
    let done = 0;
    const summary = { reminders: 0, kids: 0, memories: 0, journal: 0, work: 0 };
    for (const f of files) {
      let note;
      try { note = parse(f); } catch { continue; }
      if (!note.rid || seen.has(note.rid) || !note.transcript || /pending/i.test(note.transcript.slice(0, 40))) continue;
      const r = await route(owner, note, f);
      done++;
      if (r.recent) {
        summary.reminders += r.actions.filter((a) => a.type === 'plan' || a.type === 'inbox').length;
        if (r.cat === 'kids') summary.kids++; if (r.cat === 'memory') summary.memories++; if (r.cat === 'journal') summary.journal++;
      }
    }
    if (done) console.log(`[voice] routed ${done} recording(s)`);
    const parts = [summary.reminders && `${summary.reminders} to-do${summary.reminders === 1 ? '' : 's'}`, summary.kids && `${summary.kids} kids’ recording${summary.kids === 1 ? '' : 's'} saved`,
      summary.memories && `${summary.memories} memor${summary.memories === 1 ? 'y' : 'ies'}`, summary.journal && 'a journal entry'].filter(Boolean);
    if (parts.length) require('../push').notify(owner.id, 'voice', `From your recordings: ${parts.join(', ')}.`, { ref: `voice:${Date.now()}`, url: '/#voice' }).catch(() => {});
  } catch (e) { console.error('[voice] scan failed:', e.message); }
  finally { running = false; }
}

function start() {
  if (!DIR) return;
  setTimeout(scan, 15000);
  setInterval(scan, 5 * 60 * 1000);
  console.log(`[voice] watching ${DIR}`);
}

module.exports = { start, scan, STORE, route, parse };
