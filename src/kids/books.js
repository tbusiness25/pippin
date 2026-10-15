/*
 * Books — a child's bookshelf (GREEN finished · BLUE reading · RED not read yet) and "Book Chat":
 * a score out of 7, what they liked / didn't like and four rotating questions, typed or spoken.
 * Book Buddy (the kids' model, with the child-safety guards) writes one short reaction to what THEY said.
 *
 *  - The book list is shared (kid_books), seeded from a JSON catalogue in the data dir
 *    (BOOKS_CATALOGUE, default <KIDS_DATA_DIR>/books/books-catalogue.json; covers in …/books/covers/).
 *    Status, owned and hidden are per child (kid_book_status).
 *  - Voice notes are a KEEPSAKE (unlike Buddy chat): kept until a grown-up removes them (Family → child → Books →
 *    Manage voice notes: Remove deletes the audio files and soft-deletes the row). <KIDS_DATA_DIR>/<childId>/books/, a copy in AUDIO_STORE, and — when
 *    VOICE_NOTES_DIR is set and writable — a Markdown note + audio in the voice-notes folder, filed with the
 *    household's other kids' recordings (KIDS_VOICE_NOTES_SUBDIR, KIDS_VOICE_NOTES_INDEX). Optional limit:
 *    KIDS_BOOK_CHAT_RETENTION_DAYS (default 0 = keep forever). When set, a daily job hard-deletes older voice
 *    notes and their audio files in the data dir and AUDIO_STORE (./retention.js). The Obsidian copies are NOT
 *    removed by that job.
 *  - Stars: the first Book Chat for a book pays KIDS_BOOK_STARS (default 3, 0 = off) once ever, via the star ledger.
 *  - Sprig: book_started, book_finished, book_chat (first Book Chat per book), books_milestone (filling shelves).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const safety = require('./safety');
const retention = require('./retention');

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const UUID_RE = new RegExp(`^${UUID}$`);
const STATUSES = new Set(['not_read', 'reading', 'finished']);
const KINDS = new Set(['main', 'special', 'activity', 'standalone']);
const SHELF_SIZE = 10;
const BOOK_STARS = Math.max(0, parseInt(process.env.KIDS_BOOK_STARS ?? '3', 10) || 0);
const BOOK_CHAT_RETENTION_DAYS = retention.daysFromEnv('KIDS_BOOK_CHAT_RETENTION_DAYS', 0);
const MILESTONES = [
  [1, 'First book on the shelf!'], [5, 'Bookworm'], [10, 'A whole shelf!'], [20, 'Two full shelves'],
  [30, 'Library builder'], [50, 'Super reader'], [75, 'Book explorer'], [100, 'Hundred-book hero'],
  [150, 'Reading legend'], [200, 'The Great Library'],
];
const GROUP_LAST = ['Picture & first chapter books', 'More great reads', 'Added by us'];

let util = require('./util');
const coverDir = () => util.dataDir('books', 'covers');
const seedFile = () => process.env.BOOKS_CATALOGUE || util.dataDir('books', 'books-catalogue.json');
const tzOf = (kid) => kid.tz || process.env.TZ_DEFAULT || 'Europe/London';

// ---------- small helpers ----------
function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function clean(v, max = 200) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function intOrNull(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }
const coverUrl = (f) => (f ? `/api/kids/books/cover/${encodeURIComponent(f)}` : null);

// ---------- seed ----------
async function seedBooks(pool) {
  let data;
  try { data = JSON.parse(fs.readFileSync(seedFile(), 'utf8')); }
  catch (e) { console.log('[books] no catalogue to seed:', e.message); return { ok: false, error: 'no catalogue file' }; }
  if (!Array.isArray(data)) return { ok: false, error: 'catalogue is not a list' };
  let inserted = 0, updated = 0, i = 0;
  for (const b of data) {
    i += 1;
    const slug = slugify(b.slug || `${b.author || ''}-${b.title || ''}`);
    const title = clean(b.title, 200);
    if (!slug || !title) continue;
    const cover = b.cover_file && /^[a-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(b.cover_file)
      && fs.existsSync(path.join(coverDir(), b.cover_file)) ? b.cover_file : null;
    const kind = KINDS.has(b.kind) ? b.kind : (b.series ? 'main' : 'standalone');
    const vals = [slug, title, clean(b.author, 120), clean(b.series, 80), intOrNull(b.series_num), kind,
      clean(b.group, 80) || clean(b.series, 80) || 'More great reads', intOrNull(b.year), clean(b.isbn, 20),
      clean(b.ol_work, 30), cover, clean(b.age_band, 10), clean(b.source, 120), !!b.verified, clean(b.note, 300), i];
    const { rows } = await pool.query(
      `INSERT INTO kid_books (slug, title, author, series, series_num, kind, shelf_group, year, isbn, ol_work, cover_file,
                              age_band, source, verified, note, sort_order, origin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'seed')
       ON CONFLICT (slug) DO UPDATE SET
         title=EXCLUDED.title, author=EXCLUDED.author, series=EXCLUDED.series, series_num=EXCLUDED.series_num,
         kind=EXCLUDED.kind, shelf_group=EXCLUDED.shelf_group, year=EXCLUDED.year, isbn=EXCLUDED.isbn,
         ol_work=EXCLUDED.ol_work, cover_file=COALESCE(EXCLUDED.cover_file, kid_books.cover_file),
         age_band=EXCLUDED.age_band, source=EXCLUDED.source, verified=EXCLUDED.verified, note=EXCLUDED.note,
         sort_order=EXCLUDED.sort_order, updated_at=NOW()
       WHERE kid_books.origin='seed' AND NOT kid_books.parent_edited
         AND (kid_books.title, kid_books.author, kid_books.series, kid_books.series_num, kid_books.kind, kid_books.shelf_group,
              kid_books.year, kid_books.isbn, kid_books.ol_work, kid_books.cover_file, kid_books.age_band, kid_books.source,
              kid_books.verified, kid_books.note, kid_books.sort_order)
           IS DISTINCT FROM
             (EXCLUDED.title, EXCLUDED.author, EXCLUDED.series, EXCLUDED.series_num, EXCLUDED.kind, EXCLUDED.shelf_group,
              EXCLUDED.year, EXCLUDED.isbn, EXCLUDED.ol_work, COALESCE(EXCLUDED.cover_file, kid_books.cover_file),
              EXCLUDED.age_band, EXCLUDED.source, EXCLUDED.verified, EXCLUDED.note, EXCLUDED.sort_order)
       RETURNING (xmax = 0) AS inserted`, vals);
    if (rows.length) { if (rows[0].inserted) inserted++; else updated++; }
  }
  if (inserted || updated) console.log(`[books] seed: ${data.length} in file, ${inserted} new, ${updated} refreshed`);
  return { ok: true, inserted, updated, total: data.length };
}

// ---------- shelf ----------
const COLS = `b.id, b.slug, b.title, b.author, b.series, b.series_num, b.kind, b.shelf_group, b.year, b.cover_file,
  COALESCE(s.status,'not_read') AS status, s.started_on, s.finished_on, s.requested_at`;

async function listBooks(pool, kid, { parent = false } = {}) {
  const extra = parent ? `, s.owned, b.isbn, b.source, b.verified, b.note, b.origin, b.age_band, s.status_by,
      (s.hidden_at IS NOT NULL) AS hidden,
      (SELECT COUNT(*)::int FROM kid_book_voice v WHERE v.child_id=$1 AND v.book_id=b.id AND v.removed_at IS NULL) AS voice_count` : '';
  const { rows } = await pool.query(
    `SELECT ${COLS}, r.score, (r.id IS NOT NULL) AS reviewed ${extra},
            MIN(b.sort_order) OVER (PARTITION BY b.shelf_group) AS group_order
       FROM kid_books b
       LEFT JOIN kid_book_status s ON s.book_id=b.id AND s.child_id=$1
       LEFT JOIN kid_book_reviews r ON r.book_id=b.id AND r.child_id=$1 AND r.removed_at IS NULL
      WHERE b.removed_at IS NULL AND (b.added_for IS NULL OR b.added_for=$1)
        AND ($2::boolean OR s.hidden_at IS NULL)
      ORDER BY b.series_num NULLS LAST, b.kind, b.year NULLS LAST, b.title`, [kid.id, parent]);
  const rank = (r) => { const j = GROUP_LAST.indexOf(r.shelf_group); return j >= 0 ? 1e9 + j : r.group_order; };
  rows.sort((a, b) => rank(a) - rank(b) || a.shelf_group.localeCompare(b.shelf_group));
  return rows.map((r) => { const { group_order, ...x } = r; return Object.assign(x, { cover: coverUrl(r.cover_file) }); });
}

async function stats(pool, kid) {
  const { rows: [s] } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE s.status='finished')::int AS finished,
            COUNT(*) FILTER (WHERE s.status='reading')::int AS reading,
            COUNT(*) FILTER (WHERE s.status='finished' AND s.finished_on >= date_trunc('year', (NOW() AT TIME ZONE $2))::date)::int AS this_year
       FROM kid_book_status s JOIN kid_books b ON b.id=s.book_id
      WHERE s.child_id=$1 AND s.hidden_at IS NULL AND b.removed_at IS NULL`, [kid.id, tzOf(kid)]);
  const done = MILESTONES.filter(([n]) => s.finished >= n);
  const next = MILESTONES.find(([n]) => s.finished < n) || null;
  return Object.assign(s, {
    shelf_size: SHELF_SIZE, shelves_full: Math.floor(s.finished / SHELF_SIZE), on_current_shelf: s.finished % SHELF_SIZE,
    milestone: done.length ? done[done.length - 1][1] : null, next_milestone: next ? { at: next[0], name: next[1] } : null,
    year: Number(util.localDate(tzOf(kid)).slice(0, 4)),
  });
}

async function getBook(pool, kid, id) {
  if (!UUID_RE.test(id)) return null;
  const { rows: [b] } = await pool.query(
    `SELECT ${COLS}, s.owned, (s.hidden_at IS NOT NULL) AS hidden FROM kid_books b
       LEFT JOIN kid_book_status s ON s.book_id=b.id AND s.child_id=$1
      WHERE b.id=$2 AND b.removed_at IS NULL AND (b.added_for IS NULL OR b.added_for=$1)`, [kid.id, id]);
  if (b) b.cover = coverUrl(b.cover_file);
  return b || null;
}

const logEvent = (db, kid, bookId, kind, detail, by) => db.query(
  'INSERT INTO kid_book_events (child_id, book_id, kind, detail, by) VALUES ($1,$2,$3,$4,$5)',
  [kid ? kid.id : null, bookId, kind, JSON.stringify(detail || {}), by]);

async function setStatus(db, kid, bookId, { status, started, finished, by }) {
  await db.query(
    `INSERT INTO kid_book_status (child_id, book_id, status, started_on, finished_on, status_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT (child_id, book_id) DO UPDATE SET status=$3, started_on=$4, finished_on=$5, status_by=$6, updated_at=NOW()`,
    [kid.id, bookId, status, started, finished, by]);
}

// ---------- Book Chat questions ----------
const QUESTIONS = [
  { slug: 'fav_character', q: 'Who was your favourite character? Why?' },
  { slug: 'funniest', q: 'What was the funniest bit?' },
  { slug: 'friend', q: 'Would you give this book to a friend? Who would you give it to?' },
  { slug: 'ending', q: 'If you could change the ending, what would happen instead?' },
  { slug: 'draw', q: 'Draw a picture with words: tell me about your favourite page or picture.' },
  { slug: 'be_char', q: 'If you could be one character for a day, who would you be? What would you do?' },
  { slug: 'surprise', q: 'Was there a bit that surprised you?' },
  { slug: 'new_word', q: 'Did you learn a new word or a new fact? What was it?' },
  { slug: 'feel', q: 'How did the book make you feel? Laughing, excited, a bit sad, amazed…?' },
  { slug: 'title', q: 'If you could give this book a brand new title, what would it be?' },
  { slug: 'author', q: 'If you could ask the author one question, what would you ask?' },
  { slug: 'next', q: 'What do you think will happen in the next book?', seriesOnly: true },
  { slug: 'sequel', q: 'If you wrote the next chapter, what would happen?', standaloneOnly: true },
];
const QUESTION_BY_SLUG = new Map(QUESTIONS.map((x) => [x.slug, x]));

// Four questions per book, picked deterministically from the slug (same book → same questions), `spin` for others.
function questionsFor(book, spin) {
  const list = QUESTIONS.filter((x) => (!x.seriesOnly || book.series) && (!x.standaloneOnly || !book.series));
  const seed = crypto.createHash('sha1').update(`${book.slug}:${parseInt(spin, 10) || 0}`).digest();
  return list.map((x, i) => ({ x, k: seed[i % seed.length] ^ (i * 37) })).sort((a, b) => a.k - b.k)
    .slice(0, 4).map((s) => ({ slug: s.x.slug, question: s.x.q }));
}

// ---------- voice notes ----------
function voiceExt(mime) {
  const m = String(mime || '');
  if (/mp4|m4a|aac/.test(m)) return 'm4a';
  if (/ogg|opus/.test(m)) return 'ogg';
  if (/wav/.test(m)) return 'wav';
  if (/mpeg|mp3/.test(m)) return 'mp3';
  return 'webm';
}
const voiceFile = (kid, file) => (/^[a-z0-9-]+\.(webm|m4a|ogg|wav|mp3)$/.test(file || '') ? util.childDir(kid, 'books', file) : null);
// The files one voice note owns: the child's copy and the back-up copy in AUDIO_STORE (book-<id>.<ext>).
const voiceAudioPaths = (row) => {
  const p = voiceFile({ id: row.child_id }, row.file);
  return p ? [p, path.join(STORE, `book-${row.id}${path.extname(row.file)}`)] : [];
};

// Kids' recordings are filed with the household's other voice notes (an Obsidian-style folder), in the same
// format the voice-note exporter uses, so they show up in the same "kids memories" index. `source: pippin-…`
// marks them so the voice-note agent (src/voice/ingest.js) leaves them alone.
const VAULT = process.env.VOICE_NOTES_DIR || '';
const VAULT_SUBDIR = process.env.KIDS_VOICE_NOTES_SUBDIR ?? 'Kids';
const VAULT_INDEX = process.env.KIDS_VOICE_NOTES_INDEX ?? '_Kids Memories.md';
const VAULT_ON = !!VAULT && process.env.KIDS_VOICE_NOTES !== 'false';
const STORE = process.env.AUDIO_STORE || '/data/audio';

function stamp(tz, d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}-${p.minute}-${p.second}`;
}
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();

async function summarise(kid, book, question, transcript) {
  const fallback = `${kid.name} talked about “${book.title}”${question ? ` — ${question.replace(/\?$/, '').toLowerCase()}` : ''}.`;
  const text = oneLine(transcript);
  if (!text || text.length < 8 || !util.llmConfigured() || safety.hardBlockCategory(text)) return fallback;
  try {
    const out = await util.kidsLlm([
      { role: 'system', content: 'You write one short, kind sentence (max 25 words) for a family keepsake log, summarising what a young child said in a voice note about a book they read. Third person, past tense, using the child\'s name. Only use what the child said — never invent plot or details. British English. No emoji.' },
      { role: 'user', content: `Child: ${kid.name}\nBook: ${book.title}${book.author ? ` by ${book.author}` : ''}\nQuestion: ${question || 'What did you think?'}\nWhat they said: ${safety.redactPII(text).slice(0, 2000)}` },
    ], { maxTokens: 120, temperature: 0.3, timeoutMs: 60000 });
    const s = oneLine(out).replace(/^["“]|["”]$/g, '');
    return s && s.length < 300 && safety.outputGuard(s).ok ? s : fallback;
  } catch { return fallback; }
}

// Writes "<subdir>/<stamp>.md" + "audio/<stamp>.<ext>" and links it from the kids index. Returns the note path.
async function fileVoiceNote(kid, book, v, src) {
  if (!VAULT_ON || !fs.existsSync(VAULT)) return null;
  const tz = tzOf(kid), when = new Date(v.created_at || Date.now());
  const ext = path.extname(src) || '.webm';
  const noteDir = path.join(VAULT, VAULT_SUBDIR);
  let name = stamp(tz, when), n = 1;
  while (fs.existsSync(path.join(noteDir, `${name}.md`)) || fs.existsSync(path.join(VAULT, 'audio', `${name}${ext}`))) name = `${stamp(tz, when)} (${++n})`;
  const q = v.field === 'liked' ? 'What did you like about it?' : v.field === 'disliked' ? 'Was there anything you didn’t like?'
    : (QUESTION_BY_SLUG.get(v.field.slice(2)) || {}).q || '';
  const summary = await summarise(kid, book, q, v.transcript);
  fs.mkdirSync(path.join(VAULT, 'audio'), { recursive: true });
  fs.mkdirSync(noteDir, { recursive: true });
  fs.copyFileSync(src, path.join(VAULT, 'audio', `${name}${ext}`));
  const utc = when.toISOString().replace('T', ' ').slice(0, 19);
  const md = `---\nsource: pippin-book-chat\nrecording_id: book-${v.id}\ndate: ${utc}\nduration_sec: ${v.duration_sec || ''}\nlanguage: en\n`
    + `tags: [voice-note, kids-memory]\ncategory: kids-memory\n---\n\n# Voice note — ${name}\n\n![[audio/${name}${ext}]]\n\n`
    + `## Summary\n${summary}\n\nBook Chat: *${oneLine(book.title)}*${book.author ? ` by ${oneLine(book.author)}` : ''}${q ? ` — “${q}”` : ''}\n\n`
    + `## Transcript\n${oneLine(v.transcript) || '*(no words written down)*'}\n`;
  fs.writeFileSync(path.join(noteDir, `${name}.md`), md);
  if (VAULT_INDEX) {
    const idx = path.join(VAULT, VAULT_INDEX);
    if (!fs.existsSync(idx)) fs.writeFileSync(idx, `---\ntags: [voice-index]\n---\n\n# ${VAULT_INDEX.replace(/^_/, '').replace(/\.md$/, '')}\n\n`);
    const cur = fs.readFileSync(idx, 'utf8');
    if (!cur.includes(`[[${name}]]`)) fs.appendFileSync(idx, `${cur.endsWith('\n') ? '' : '\n'}- [[${name}]] — ${oneLine(summary)} <small>(${utc.slice(0, 10)})</small>\n`);
  }
  return path.join(VAULT_SUBDIR, `${name}.md`);
}

// Back-up copy + vault note, after the response has gone (a slow model never keeps a child waiting).
function keepVoice(pool, kid, book, v, src) {
  setImmediate(async () => {
    try {
      fs.mkdirSync(STORE, { recursive: true });
      const dest = path.join(STORE, `book-${v.id}${path.extname(src)}`);
      if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
    } catch (e) { console.warn('[books] audio backup failed:', e.message); }
    try {
      const note = await fileVoiceNote(kid, book, v, src);
      if (note) await pool.query('UPDATE kid_book_voice SET vault_note=$2 WHERE id=$1', [v.id, note]);
    } catch (e) { console.warn('[books] voice note not filed:', e.message); }
  });
}

// ---------- stars (the kids' star economy in ./stars; never touches money) ----------
async function awardStars(db, kid, bookId, n, note) {
  if (!n) return 0;
  const stars = require('./stars');
  await stars.lockChild(db, kid.id);
  const { rowCount: paid } = await db.query(`SELECT 1 FROM kid_star_ledger WHERE child_id=$1 AND source='book' AND source_ref=$2`, [kid.id, String(bookId)]);
  if (paid) return 0;   // once per book, ever
  await stars.addStars(db, kid.id, { source: 'book', ref: bookId, stars: n, note: note.replace(/[<>&"]/g, '').slice(0, 200) });
  return n;
}
const starBalance = (db, kid) => require('./stars').balance(db, kid.id).catch(() => null);

// ---------- Book Buddy ----------
const BOOK_BUDDY_INSTRUCTION = (name) => `${name} has just finished reading a book and told you what they thought of it (their answers are below). Write ONE short, warm reaction to THEIR answers — 2 or 3 short sentences, under 60 words.
Rules for this reply:
- React to the specific things they said (quote or mention one of their ideas). Be genuinely pleased they shared it.
- Do NOT state any facts about the book's story, characters, jokes or ending that they did not mention themselves. You may not know this book — never guess or invent plot details.
- Do NOT quiz them or ask questions that check whether they read it or remember it. No "gotcha" questions.
- You may end with at most ONE open question about their own opinion or ideas (e.g. what they might like to read next, or what they would add). Or no question at all.
- Do not mention stars, points or rewards. No lecturing. British English.
- Sign off "— Buddy".`;
const BUDDY_FALLBACK = 'Thank you for telling me all about it — I loved reading your answers! What a brilliant review.\n— Buddy';

function reviewText(book, r) {
  const lines = [`Book: "${book.title}"${book.author ? ` by ${book.author}` : ''}`];
  if (r.score) lines.push(`Their score: ${r.score} out of 7`);
  if (r.liked) lines.push(`What they liked: ${r.liked}`);
  if (r.disliked) lines.push(`What they didn't like: ${r.disliked}`);
  for (const a of r.answers || []) if (a && a.text) lines.push(`${a.question} — ${a.text}`);
  return lines.join('\n');
}

// Their review is always kept exactly as written; this only decides what Buddy says back. Hard-block topics get a
// gentle canned reply and a flag to the parents. Book reviews mention baddies and fights, so the violence word list
// is NOT used to block here — the output guard still applies.
async function buddyReply(kid, book, r) {
  const kidText = [r.liked, r.disliked].concat((r.answers || []).map((a) => a && a.text)).filter(Boolean).join('\n');
  const hb = kidText ? safety.hardBlockCategory(kidText) : null;
  if (hb) {
    util.alertParents(`🚩 ${kid.name}'s Book Chat (${book.title}) mentions something to check (${hb.cat}). Please read it in Family → ${kid.name} → Books.`,
      { tag: 'kids-safety', url: `/#family/child/${kid.id}/books` }).catch(() => {});
    util.audit(kid.id, 'books.flag', { book: book.id, cat: hb.cat });
    return { reply: "Thank you for telling me about this book. If anything's on your mind, your grown-ups would love to chat with you about it.\n— Buddy", flag: `hard_block:${hb.cat}` };
  }
  if (!util.llmConfigured()) return { reply: null, flag: 'llm_not_configured' };
  let text;
  try {
    text = safety.ensureBuddySignature(await util.kidsLlm([
      { role: 'system', content: safety.buddyPrompt(kid) },
      { role: 'system', content: BOOK_BUDDY_INSTRUCTION(kid.name || 'Your friend') },
      { role: 'user', content: safety.redactPII(reviewText(book, r)) },
    ], { maxTokens: 220, temperature: 0.7, timeoutMs: 90000 }));
  } catch (e) { return { reply: null, flag: `llm_error:${String(e.message).slice(0, 80)}` }; }
  const og = safety.outputGuard(text);
  if (!og.ok) return { reply: BUDDY_FALLBACK, flag: `${og.flagType}:${og.flagReason || ''}` };
  return { reply: text, flag: null };
}

// ---------- routes ----------
function validDate(s, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
  if (Number.isNaN(new Date(`${s}T12:00:00Z`).getTime())) return null;
  if (s > util.localDate(tz) || s < '2000-01-01') return null;
  return s;
}

async function tx(pool, fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
  finally { c.release(); }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  slugify, seedBooks, questionsFor, QUESTION_BY_SLUG, fileVoiceNote, MILESTONES,

  routes(r, deps) {
    const { pool, sprig, parentOnly } = deps;
    util = deps.util;
    const I = `:id(${UUID})`;

    // ----- child (and a parent looking at the child's screen) -----
    r.get('/books', wrap(async (req, res) => {
      const [items, s] = await Promise.all([listBooks(pool, req.kid), stats(pool, req.kid)]);
      res.json({ ok: true, items, stats: s });
    }));

    r.get('/books/cover/:file', (req, res) => {
      const f = req.params.file;
      if (!/^[a-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(f)) return res.status(404).end();
      res.set('Cache-Control', 'public, max-age=604800');
      res.sendFile(path.join(coverDir(), f), (e) => e && !res.headersSent && res.status(404).end());
    });

    r.get(`/books/voice/${I}`, wrap(async (req, res) => {
      const { rows: [v] } = await pool.query('SELECT file, mime FROM kid_book_voice WHERE id=$1 AND child_id=$2 AND removed_at IS NULL', [req.params.id, req.kid.id]);
      const p = v && voiceFile(req.kid, v.file);
      if (!p || !fs.existsSync(p)) return res.status(404).json({ ok: false, error: 'not found' });
      res.set('Cache-Control', 'private, no-store');
      res.type(v.mime || 'audio/webm').sendFile(p);
    }));

    r.get(`/books/${I}`, wrap(async (req, res) => {
      const b = await getBook(pool, req.kid, req.params.id);
      if (!b || (b.hidden && !req.asParent)) return res.status(404).json({ ok: false, error: 'not found' });
      const { rows: [review] } = await pool.query(
        `SELECT id, score, liked, disliked, liked_voice, disliked_voice, answers, buddy_reply, stars_awarded, created_at, updated_at
           FROM kid_book_reviews WHERE child_id=$1 AND book_id=$2 AND removed_at IS NULL`, [req.kid.id, b.id]);
      const { rows: voices } = await pool.query(
        'SELECT id, field, transcript, created_at FROM kid_book_voice WHERE child_id=$1 AND book_id=$2 AND removed_at IS NULL ORDER BY created_at', [req.kid.id, b.id]);
      res.json({ ok: true, book: b, review: review || null, voices });
    }));

    r.get(`/books/${I}/questions`, wrap(async (req, res) => {
      const b = await getBook(pool, req.kid, req.params.id);
      if (!b) return res.status(404).json({ ok: false, error: 'not found' });
      res.json({ ok: true, questions: questionsFor(b, req.query.spin) });
    }));

    r.post(`/books/${I}/status`, wrap(async (req, res) => {
      const kid = req.kid, tz = tzOf(kid);
      const status = String((req.body || {}).status || '');
      if (!STATUSES.has(status)) return res.status(400).json({ ok: false, error: 'bad status' });
      const b = await getBook(pool, kid, req.params.id);
      if (!b || b.hidden) return res.status(404).json({ ok: false, error: 'not found' });
      let date = null;
      if (req.body.date != null && req.body.date !== '') {
        date = validDate(String(req.body.date), tz);
        if (!date) return res.status(400).json({ ok: false, error: 'That date doesn’t look right' });
      }
      const today = util.localDate(tz);
      let started = b.started_on, finished = b.finished_on;
      if (status === 'reading') { started = date || (b.status === 'reading' ? b.started_on : today) || today; finished = null; }
      if (status === 'finished') finished = date || today;
      if (status === 'not_read') { started = null; finished = null; }
      const before = (await stats(pool, kid)).finished;
      await tx(pool, async (c) => {
        await setStatus(c, kid, b.id, { status, started, finished, by: req.asParent ? 'parent' : 'child' });
        await logEvent(c, kid, b.id, 'status', { from: b.status, to: status, started_on: started, finished_on: finished }, req.asParent ? 'parent' : 'child');
      });
      const s = await stats(pool, kid);
      const msgs = []; let energy = null;
      const give = async (kind, ref) => { const g = await sprig.reward(kid.id, kind, ref); msgs.push(...g.messages); energy = g.energy || energy; };
      if (status === 'reading' && b.status === 'not_read') await give('book_started', b.id);
      if (status === 'finished' && b.status !== 'finished') {
        await give('book_finished', b.id);
        for (const [n] of MILESTONES) if (before < n && s.finished >= n) await give('books_milestone', `shelf-${n}`);
      }
      res.json({ ok: true, book: { id: b.id, status, started_on: started, finished_on: finished }, stats: s, sprig: { messages: msgs, energy } });
    }));

    // The child asks a grown-up to get a book they haven't got ({ cancel: true } = never mind).
    r.post(`/books/${I}/request`, wrap(async (req, res) => {
      const kid = req.kid, cancel = !!(req.body || {}).cancel;
      const b = await getBook(pool, kid, req.params.id);
      if (!b || b.hidden) return res.status(404).json({ ok: false, error: 'not found' });
      if (!cancel && b.owned === true) return res.status(400).json({ ok: false, error: 'You’ve already got this one!' });
      await tx(pool, async (c) => {
        await c.query('INSERT INTO kid_book_status (child_id, book_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [kid.id, b.id]);
        await c.query(`UPDATE kid_book_status SET requested_at=${cancel ? 'NULL' : 'COALESCE(requested_at, NOW())'}, owned=${cancel ? 'owned' : 'FALSE'}, updated_at=NOW() WHERE child_id=$1 AND book_id=$2`, [kid.id, b.id]);
        await logEvent(c, kid, b.id, cancel ? 'request_cancel' : 'request', {}, req.asParent ? 'parent' : 'child');
      });
      if (!cancel && !b.requested_at && !req.asParent) {
        // tell the parents (only if they have nudges on — push.notify checks that)
        const { rows: parents } = await pool.query(`SELECT id FROM users WHERE role='adult' AND is_parent AND deleted_at IS NULL`);
        for (const p of parents) {
          require('../push').notify(p.id, 'kid-book-request', `${String(kid.name).trim()} would like “${b.title}” 📚`,
            { ref: `${kid.id}:${b.id}`, title: 'Book request', url: `/#family/child/${kid.id}/books/shop` }).catch(() => {});
        }
      }
      res.json({ ok: true, requested: !cancel });
    }));

    r.post(`/books/${I}/voice`, express.raw({ type: () => true, limit: '12mb' }), wrap(async (req, res) => {
      const kid = req.kid;
      const field = String(req.query.field || '');
      if (!/^(liked|disliked|q:[a-z_]{2,30})$/.test(field)) return res.status(400).json({ ok: false, error: 'bad field' });
      const b = await getBook(pool, kid, req.params.id);
      if (!b) return res.status(404).json({ ok: false, error: 'not found' });
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (buf.length < 256) return res.status(400).json({ ok: false, error: 'That was too short — try again?' });
      const mime = String(req.get('content-type') || 'audio/webm').split(';')[0].trim();
      const id = crypto.randomUUID();
      const file = `${id}.${voiceExt(mime)}`;
      const abs = path.join(util.ensureDir(util.childDir(kid, 'books')), file);
      fs.writeFileSync(abs, buf);
      let transcript = '';
      try { transcript = await util.transcribe(buf, mime); }
      catch (e) { console.warn('[books] transcribe failed:', e.message); }   // keep the recording anyway; they can type
      const dur = Math.max(0, Math.min(600, parseInt(req.query.dur, 10) || 0)) || null;
      const { rows: [v] } = await pool.query(
        `INSERT INTO kid_book_voice (id, child_id, book_id, field, file, mime, bytes, duration_sec, transcript)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, field, transcript, duration_sec, created_at`,
        [id, kid.id, b.id, field, file, mime, buf.length, dur, transcript.slice(0, 2000) || null]);
      keepVoice(pool, kid, b, v, abs);
      res.json({ ok: true, voice_id: v.id, transcript });
    }));

    r.post(`/books/${I}/review`, wrap(async (req, res) => {
      const kid = req.kid;
      const b = await getBook(pool, kid, req.params.id);
      if (!b) return res.status(404).json({ ok: false, error: 'not found' });
      const body = req.body || {};
      const score = body.score == null || body.score === '' ? null : parseInt(body.score, 10);
      if (score !== null && !(score >= 1 && score <= 7)) return res.status(400).json({ ok: false, error: 'Score 1 to 7' });
      const text = (v) => clean(v, 1000);
      const out = await tx(pool, async (c) => {
        const voiceOk = async (id) => {
          if (!id || !UUID_RE.test(String(id))) return null;
          const { rowCount } = await c.query('SELECT 1 FROM kid_book_voice WHERE id=$1 AND child_id=$2 AND book_id=$3 AND removed_at IS NULL', [id, kid.id, b.id]);
          return rowCount ? String(id) : null;
        };
        const answers = [];
        for (const a of (Array.isArray(body.answers) ? body.answers.slice(0, 8) : [])) {
          const q = a && QUESTION_BY_SLUG.get(String(a.slug || ''));
          if (!q) continue;
          const t = text(a.text), v = await voiceOk(a.voice_id);
          if (t || v) answers.push({ slug: q.slug, question: q.q, text: t, voice_id: v });
        }
        const liked = text(body.liked), disliked = text(body.disliked);
        const lv = await voiceOk(body.liked_voice), dv = await voiceOk(body.disliked_voice);
        if (!score && !liked && !disliked && !answers.length && !lv && !dv) return { empty: true };
        const { rows: cur } = await c.query('SELECT id FROM kid_book_reviews WHERE child_id=$1 AND book_id=$2 AND removed_at IS NULL FOR UPDATE', [kid.id, b.id]);
        let review, starsNow = 0;
        if (cur.length) {
          ({ rows: [review] } = await c.query(
            `UPDATE kid_book_reviews SET score=$2, liked=$3, disliked=$4, liked_voice=$5, disliked_voice=$6, answers=$7,
                    buddy_reply=NULL, buddy_flag=NULL, buddy_at=NULL, updated_at=NOW() WHERE id=$1 RETURNING *`,
            [cur[0].id, score, liked, disliked, lv, dv, JSON.stringify(answers)]));
        } else {
          // First Book Chat for this book earns stars — once per book, ever (even if removed and redone).
          starsNow = await awardStars(c, kid, b.id, BOOK_STARS, `Book Chat: ${b.title}`);
          ({ rows: [review] } = await c.query(
            `INSERT INTO kid_book_reviews (child_id, book_id, score, liked, disliked, liked_voice, disliked_voice, answers, stars_awarded)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [kid.id, b.id, score, liked, disliked, lv, dv, JSON.stringify(answers), starsNow]));
        }
        await logEvent(c, kid, b.id, 'review', { score, answers: answers.length, edit: !!cur.length }, req.asParent ? 'parent' : 'child');
        return { review, starsNow, first: !cur.length };
      });
      if (out.empty) return res.status(400).json({ ok: false, error: 'Give it a score or say something first!' });
      const g = await sprig.reward(kid.id, 'book_chat', b.id);
      res.json({ ok: true, review: out.review, stars_awarded: out.starsNow, balance: await starBalance(pool, kid), sprig: g });
    }));

    // Book Buddy's one reaction, generated once per saved review (editing the review clears it).
    r.post(`/books/${I}/buddy`, wrap(async (req, res) => {
      const b = await getBook(pool, req.kid, req.params.id);
      if (!b) return res.status(404).json({ ok: false, error: 'not found' });
      const { rows: [rv] } = await pool.query(
        'SELECT id, score, liked, disliked, answers, buddy_reply FROM kid_book_reviews WHERE child_id=$1 AND book_id=$2 AND removed_at IS NULL', [req.kid.id, b.id]);
      if (!rv) return res.status(404).json({ ok: false, error: 'no review' });
      if (rv.buddy_reply) return res.json({ ok: true, reply: rv.buddy_reply });
      const out = await buddyReply(req.kid, b, rv);
      if (!out.reply) return res.json({ ok: true, reply: null, error: 'buddy unavailable' });
      await pool.query('UPDATE kid_book_reviews SET buddy_reply=$2, buddy_flag=$3, buddy_at=NOW() WHERE id=$1', [rv.id, out.reply, out.flag]);
      res.json({ ok: true, reply: out.reply });
    }));

    // A book they're reading that isn't on the shelf yet (only on their own shelf).
    r.post('/books', wrap(async (req, res) => {
      const title = clean((req.body || {}).title, 200), author = clean(req.body.author, 120);
      if (!title || title.length < 2) return res.status(400).json({ ok: false, error: 'What’s the book called?' });
      const slug = `added-${slugify(title).slice(0, 50)}-${crypto.randomBytes(3).toString('hex')}`;
      const id = await tx(pool, async (c) => {
        const { rows: [x] } = await c.query(
          `INSERT INTO kid_books (slug, title, author, kind, shelf_group, origin, source, added_for)
           VALUES ($1,$2,$3,'standalone','Added by us',$4,$5,$6) RETURNING id`,
          [slug, title, author, req.asParent ? 'parent' : 'child', req.asParent ? 'added by a parent' : 'added by the child', req.kid.id]);
        await logEvent(c, req.kid, x.id, 'add', { title, author }, req.asParent ? 'parent' : 'child');
        return x.id;
      });
      res.json({ ok: true, id });
    }));

    // ----- parents -----
    r.get('/books/parent', parentOnly, wrap(async (req, res) => {
      const [items, s] = await Promise.all([listBooks(pool, req.kid, { parent: true }), stats(pool, req.kid)]);
      res.json({ ok: true, items, stats: s });
    }));

    r.get('/books/parent/reviews', parentOnly, wrap(async (req, res) => {
      const { rows: reviews } = await pool.query(
        `SELECT r.id, r.book_id, r.score, r.liked, r.disliked, r.liked_voice, r.disliked_voice, r.answers, r.buddy_reply, r.buddy_flag,
                r.stars_awarded, r.created_at, r.updated_at, b.title, b.author, b.series, b.series_num, b.cover_file, s.finished_on
           FROM kid_book_reviews r JOIN kid_books b ON b.id=r.book_id
           LEFT JOIN kid_book_status s ON s.child_id=r.child_id AND s.book_id=r.book_id
          WHERE r.child_id=$1 AND r.removed_at IS NULL
          ORDER BY COALESCE(s.finished_on, r.created_at::date) DESC, r.created_at DESC`, [req.kid.id]);
      const { rows: voices } = await pool.query(
        'SELECT id, book_id, field, transcript, vault_note, created_at FROM kid_book_voice WHERE child_id=$1 AND removed_at IS NULL ORDER BY created_at', [req.kid.id]);
      res.json({ ok: true, reviews: reviews.map((x) => Object.assign(x, { cover: coverUrl(x.cover_file) })), voices });
    }));

    r.get(`/books/parent/${I}`, parentOnly, wrap(async (req, res) => {
      const b = await getBook(pool, req.kid, req.params.id);
      if (!b) return res.status(404).json({ ok: false, error: 'not found' });
      const { rows: [meta] } = await pool.query('SELECT isbn, source, verified, note, origin, age_band FROM kid_books WHERE id=$1', [b.id]);
      Object.assign(b, meta);
      const { rows: [review] } = await pool.query('SELECT * FROM kid_book_reviews WHERE child_id=$1 AND book_id=$2 AND removed_at IS NULL', [req.kid.id, b.id]);
      const { rows: voices } = await pool.query(
        'SELECT id, field, transcript, vault_note, created_at FROM kid_book_voice WHERE child_id=$1 AND book_id=$2 AND removed_at IS NULL ORDER BY created_at', [req.kid.id, b.id]);
      const { rows: history } = await pool.query(
        'SELECT kind, detail, by, created_at FROM kid_book_events WHERE book_id=$2 AND (child_id=$1 OR child_id IS NULL) ORDER BY created_at DESC LIMIT 50', [req.kid.id, b.id]);
      res.json({ ok: true, book: b, review: review || null, voices, history });
    }));

    r.post('/books/parent', parentOnly, wrap(async (req, res) => {
      const body = req.body || {};
      const title = clean(body.title, 200);
      if (!title || title.length < 2) return res.status(400).json({ ok: false, error: 'Title needed' });
      const series = clean(body.series, 80);
      const slug = `added-${slugify(title).slice(0, 50)}-${crypto.randomBytes(3).toString('hex')}`;
      const id = await tx(pool, async (c) => {
        const { rows: [x] } = await c.query(
          `INSERT INTO kid_books (slug, title, author, series, series_num, kind, shelf_group, origin, source, added_for)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'parent','added by a parent',$8) RETURNING id`,
          [slug, title, clean(body.author, 120), series, intOrNull(body.series_num), KINDS.has(body.kind) ? body.kind : (series ? 'main' : 'standalone'),
            clean(body.group, 80) || series || 'Added by us', req.kid.id]);
        if (typeof body.owned === 'boolean') {
          await c.query(`INSERT INTO kid_book_status (child_id, book_id, owned) VALUES ($1,$2,$3)`, [req.kid.id, x.id, body.owned]);
        }
        await logEvent(c, req.kid, x.id, 'add', { title, series }, 'parent');
        return x.id;
      });
      res.json({ ok: true, id });
    }));

    // PATCH {title?, author?, series?, series_num?, group?, kind?, owned? (true|false|null), hidden?, status? + started_on?/finished_on?}
    // Catalogue fields change the shared book for every child; owned/hidden/status are this child's.
    r.patch(`/books/parent/${I}`, parentOnly, wrap(async (req, res) => {
      const kid = req.kid, body = req.body || {}, tz = tzOf(kid);
      const b = await getBook(pool, kid, req.params.id);
      if (!b) return res.status(404).json({ ok: false, error: 'not found' });
      const sets = [], vals = [b.id], events = [];
      const set = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
      for (const [k, max] of Object.entries({ title: 200, author: 120, series: 80 })) {
        if (body[k] === undefined) continue;
        const v = clean(body[k], max);
        if (k === 'title' && (!v || v.length < 2)) return res.status(400).json({ ok: false, error: 'Title needed' });
        set(k, v);
      }
      if (body.series_num !== undefined) set('series_num', intOrNull(body.series_num));
      if (body.group !== undefined) set('shelf_group', clean(body.group, 80) || 'More great reads');
      if (body.kind !== undefined) { if (!KINDS.has(body.kind)) return res.status(400).json({ ok: false, error: 'bad kind' }); set('kind', body.kind); }
      if (sets.length) events.push(['edit', { fields: Object.keys(body).filter((k) => ['title', 'author', 'series', 'series_num', 'group', 'kind'].includes(k)) }]);

      let status = null;
      if (body.status !== undefined) {
        if (!STATUSES.has(body.status)) return res.status(400).json({ ok: false, error: 'bad status' });
        const today = util.localDate(tz);
        const pick = (k, dflt) => (body[k] === undefined || body[k] === '' ? dflt : body[k] === null ? null : validDate(body[k], tz) || undefined);
        let started = null, finished = null;
        if (body.status === 'reading') started = pick('started_on', b.started_on || today);
        if (body.status === 'finished') { started = pick('started_on', b.started_on); finished = pick('finished_on', b.finished_on || today); }
        if (started === undefined || finished === undefined) return res.status(400).json({ ok: false, error: 'bad date' });
        status = { status: body.status, started, finished };
        events.push(['status', { from: b.status, to: body.status, started_on: started, finished_on: finished }]);
      }
      if (body.owned !== undefined) events.push(['owned', { from: b.owned ?? null, to: body.owned === null ? null : !!body.owned }]);
      if (body.hidden !== undefined) events.push([body.hidden ? 'hide' : 'unhide', {}]);
      if (body.request === null) events.push(['request_declined', {}]);
      if (!events.length) return res.status(400).json({ ok: false, error: 'nothing to change' });

      await tx(pool, async (c) => {
        if (sets.length) await c.query(`UPDATE kid_books SET ${sets.join(', ')}, parent_edited=TRUE, updated_at=NOW() WHERE id=$1`, vals);
        if (status || body.owned !== undefined || body.hidden !== undefined || body.request === null) {
          await c.query('INSERT INTO kid_book_status (child_id, book_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [kid.id, b.id]);
          if (status) await c.query(`UPDATE kid_book_status SET status=$3, started_on=$4, finished_on=$5, status_by='parent', updated_at=NOW() WHERE child_id=$1 AND book_id=$2`,
            [kid.id, b.id, status.status, status.started, status.finished]);
          if (body.owned !== undefined) await c.query('UPDATE kid_book_status SET owned=$3, updated_at=NOW() WHERE child_id=$1 AND book_id=$2', [kid.id, b.id, body.owned === null ? null : !!body.owned]);
          if (body.owned === true || body.request === null) await c.query('UPDATE kid_book_status SET requested_at=NULL, updated_at=NOW() WHERE child_id=$1 AND book_id=$2', [kid.id, b.id]);
          if (body.hidden !== undefined) await c.query(`UPDATE kid_book_status SET hidden_at=${body.hidden ? 'COALESCE(hidden_at, NOW())' : 'NULL'}, updated_at=NOW() WHERE child_id=$1 AND book_id=$2`, [kid.id, b.id]);
        }
        for (const [kind, detail] of events) await logEvent(c, kid, b.id, kind, detail, 'parent');
      });
      res.json({ ok: true });
    }));

    r.post(`/books/parent/voice/${I}/remove`, parentOnly, wrap(async (req, res) => {
      const { rows: [v] } = await pool.query(
        'UPDATE kid_book_voice SET removed_at=NOW() WHERE id=$1 AND child_id=$2 AND removed_at IS NULL RETURNING id, child_id, file, book_id, field', [req.params.id, req.kid.id]);
      if (!v) return res.status(404).json({ ok: false, error: 'not found' });
      // The row stays (soft delete, history intact); the audio itself is deleted: the child's copy and the AUDIO_STORE backup.
      for (const p of voiceAudioPaths(v)) {
        try { await fs.promises.unlink(p); }
        catch (e) { if (e.code !== 'ENOENT') console.warn('[books] voice audio not deleted:', e.message); }
      }
      await logEvent(pool, req.kid, v.book_id, 'voice_remove', { voice_id: req.params.id, field: v.field }, 'parent');
      res.json({ ok: true });
    }));

    r.post('/books/parent/reseed', parentOnly, wrap(async (req, res) => res.json(await seedBooks(pool))));
  },

  // Re-run the catalogue loader from a server-side job: POST /hooks/<slug>/api/parent/books/reseed
  hooks(r, deps) {
    util = deps.util;
    r.post('/api/parent/books/reseed', wrap(async (req, res) => res.json(await seedBooks(deps.pool))));
  },

  start(deps) {
    util = deps.util;
    seedBooks(deps.pool).catch((e) => console.warn('[books] seed failed:', e.message));
    if (!(BOOK_CHAT_RETENTION_DAYS > 0)) return console.log('[kids] book chat: voice notes kept until a grown-up removes them');
    console.log(`[kids] book chat: voice notes deleted after ${BOOK_CHAT_RETENTION_DAYS} days`);
    retention.scheduleDaily('book-chat', async () => {
      const r = await retention.purgeOld(deps.pool, { table: 'kid_book_voice', tsColumn: 'created_at', childColumn: 'child_id',
        days: BOOK_CHAT_RETENTION_DAYS, audioPaths: voiceAudioPaths });
      const filed = r.rows.filter((x) => x.vault_note).length;
      console.log(`[kids] book chat retention: ${r.deleted} voice notes deleted, ${r.audioRemoved} audio files removed, `
        + `${r.audioFailed} failed, ${filed} also filed in the voice-notes folder (not removed)`);
    });
  },
};
