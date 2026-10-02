/*
 * "Share with my GP / therapist" — a PDF of what the person CHOOSES to include, for a chosen date range.
 * Generated entirely inside Pippin with pdfkit: the data never goes to another service.
 * Self-reported, clearly labelled as not a clinical record. Coach conversations are never included.
 */
const { APP_NAME } = require('../brand');
const express = require('express');
const PDFDocument = require('pdfkit');
const { pool } = require('../db');
const game = require('../game');
const C = require('../content');
const S = require('../sober/content');
const { strength } = require('./habits');

const router = express.Router();
const SECTIONS = ['summary', 'mood', 'notes', 'questionnaires', 'sobriety', 'habits', 'reflections', 'journal'];
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
// Standard PDF fonts are Latin-1 only: drop emoji, normalise quotes/dashes.
const txt = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
  .replace(/…/g, '...').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF£]/g, '').trim();
const fmt = (d) => new Date(String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const MOOD = ['', 'very low', 'low', 'okay', 'good', 'very good'];

async function gather(uid, from, to, want) {
  const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
  const data = { user: await game.getUser(uid) };
  if (want.has('mood') || want.has('summary')) {
    data.checkins = await q(`SELECT day::text, kind, mood, energy, emotions, note, gratitude FROM checkins WHERE user_id=$1 AND day BETWEEN $2 AND $3 ORDER BY day, kind DESC`, [uid, from, to]);
  }
  if (want.has('questionnaires') || want.has('summary')) {
    data.quizzes = await q(`SELECT quiz, score, answers, created_at FROM quiz_results WHERE user_id=$1 AND created_at::date BETWEEN $2 AND $3 ORDER BY created_at`, [uid, from, to]);
  }
  if (want.has('sobriety') || want.has('summary')) {
    data.trackers = await q(`SELECT * FROM trackers WHERE user_id=$1 AND archived_at IS NULL ORDER BY created_at`, [uid]);
    for (const t of data.trackers) {
      t.days = await q(`SELECT day::text, status, amount FROM tracker_days WHERE tracker_id=$1 AND day BETWEEN $2 AND $3 ORDER BY day`, [t.id, from, to]);
      t.lapses = await q(`SELECT day::text, amount, situation, what_happened, next_time FROM lapses WHERE tracker_id=$1 AND day BETWEEN $2 AND $3 ORDER BY day`, [t.id, from, to]);
      t.urges = await q(`SELECT at, before, after, triggers, outcome FROM urges WHERE tracker_id=$1 AND at::date BETWEEN $2 AND $3 ORDER BY at`, [t.id, from, to]);
      t.screens = await q(`SELECT kind, score, created_at FROM screenings WHERE (tracker_id=$1 OR (tracker_id IS NULL AND user_id=$4)) AND created_at::date BETWEEN $2 AND $3 ORDER BY created_at`, [t.id, from, to, uid]);
    }
  }
  if (want.has('habits') || want.has('summary')) {
    data.habits = await q(`SELECT * FROM habits WHERE user_id=$1 AND status <> 'archived' ORDER BY created_at`, [uid]);
    for (const h of data.habits) h.logs = await q(`SELECT day::text, status FROM habit_logs WHERE habit_id=$1 ORDER BY day`, [h.id]);
  }
  if (want.has('reflections')) data.reflections = await q(`SELECT day::text, prompt, body FROM reflections WHERE user_id=$1 AND deleted_at IS NULL AND day BETWEEN $2 AND $3 ORDER BY day`, [uid, from, to]);
  if (want.has('journal')) data.journal = await q(`SELECT kind, title, body, created_at FROM memories WHERE user_id=$1 AND status='approved' AND created_at::date BETWEEN $2 AND $3 ORDER BY created_at`, [uid, from, to]);
  return data;
}

// ---------- drawing helpers ----------
function heading(doc, text) {
  if (doc.y > 680) doc.addPage();
  doc.moveDown(0.6).font('Helvetica-Bold').fontSize(15).fillColor('#2f4d24').text(txt(text), { paragraphGap: 4 });
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#c9d9bf').lineWidth(1).stroke();
  doc.moveDown(0.4).font('Helvetica').fontSize(10).fillColor('#222');
}
function para(doc, text, opts = {}) { doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 10).fillColor(opts.color || '#222').text(txt(text), { paragraphGap: 3, ...opts }); }
function table(doc, cols, rows) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const widths = cols.map((c) => c.w * width);
  const drawRow = (cells, bold) => {
    const heights = cells.map((c, i) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).heightOfString(txt(c), { width: widths[i] - 6 }));
    const h = Math.max(...heights) + 6;
    if (doc.y + h > doc.page.height - doc.page.margins.bottom - 10) { doc.addPage(); if (!bold) drawRow(cols.map((c) => c.label), true); }
    const y = doc.y;
    if (bold) doc.rect(left, y, width, h).fill('#eef4ea');
    let x = left;
    cells.forEach((c, i) => { doc.fillColor('#222').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).text(txt(c), x + 3, y + 3, { width: widths[i] - 6 }); x += widths[i]; });
    doc.moveTo(left, y + h).lineTo(left + width, y + h).strokeColor('#e3e3e3').lineWidth(0.5).stroke();
    doc.x = left; doc.y = y + h;
  };
  if (doc.y > doc.page.height - doc.page.margins.bottom - 70) doc.addPage();   // never strand a header
  drawRow(cols.map((c) => c.label), true);
  rows.forEach((r) => drawRow(r, false));
  doc.moveDown(0.6);
}
/** Line chart. series: [{label, color, points:[{x:Date|string, y:number}]}], yMin/yMax, optional bands [[from, label]] */
function chart(doc, { series, yMin, yMax, bands = [], height = 150, yLabel = '' }) {
  if (doc.y + height + 40 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  const left = doc.page.margins.left + 28, top = doc.y + 6;
  const width = doc.page.width - doc.page.margins.right - left - 6;
  const all = series.flatMap((s) => s.points);
  if (!all.length) { para(doc, 'No data in this period.', { color: '#777' }); return; }
  const xs = all.map((p) => new Date(p.x).getTime());
  const x0 = Math.min(...xs), x1 = Math.max(...xs) === x0 ? x0 + 86400000 : Math.max(...xs);
  const X = (t) => left + ((new Date(t).getTime() - x0) / (x1 - x0)) * width;
  const Y = (v) => top + height - ((v - yMin) / (yMax - yMin)) * height;
  bands.forEach(([from, label], i) => {           // shaded threshold bands for questionnaires
    const to = bands[i + 1] ? bands[i + 1][0] : yMax;
    doc.rect(left, Y(Math.min(to, yMax)), width, Y(from) - Y(Math.min(to, yMax))).fill(i % 2 ? '#f6f6f2' : '#ffffff');
    doc.fillColor('#999').fontSize(7).text(txt(label), left + width - 110, Y(Math.min(to, yMax)) + 2, { width: 106, align: 'right' });
  });
  doc.rect(left, top, width, height).strokeColor('#ccc').lineWidth(0.5).stroke();
  [yMin, (yMin + yMax) / 2, yMax].forEach((v) => doc.fillColor('#777').fontSize(7).text(String(Math.round(v * 10) / 10), left - 26, Y(v) - 3, { width: 22, align: 'right' }));
  doc.fillColor('#777').fontSize(7).text(fmt(new Date(x0).toISOString()), left, top + height + 3).text(fmt(new Date(x1).toISOString()), left + width - 60, top + height + 3, { width: 60, align: 'right' });
  series.forEach((s) => {
    const pts = s.points.filter((p) => p.y != null).sort((a, b) => new Date(a.x) - new Date(b.x));
    if (!pts.length) return;
    doc.moveTo(X(pts[0].x), Y(pts[0].y));
    pts.slice(1).forEach((p) => doc.lineTo(X(p.x), Y(p.y)));
    doc.strokeColor(s.color).lineWidth(1.6).stroke();
    pts.forEach((p) => doc.circle(X(p.x), Y(p.y), 2).fill(s.color));
  });
  let lx = left;
  series.forEach((s) => { doc.rect(lx, top + height + 14, 8, 8).fill(s.color); doc.fillColor('#444').fontSize(8).text(s.label, lx + 11, top + height + 14); lx += 90; });
  if (yLabel) doc.fillColor('#777').fontSize(7).text(yLabel, left, top - 10);
  doc.x = doc.page.margins.left; doc.y = top + height + 32;
}

// ---------- the report ----------
function build(doc, data, from, to, want) {
  const name = txt(data.user.name);
  // Cover
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#2f4d24').text('Wellbeing record', { paragraphGap: 2 });
  para(doc, `${name}  ·  ${fmt(from)} to ${fmt(to)}`, { size: 12 });
  para(doc, `Generated ${new Date().toLocaleString('en-GB', { timeZone: data.user.tz })} from the ${APP_NAME} app.`, { color: '#666' });
  doc.moveDown(0.5);
  doc.rect(doc.page.margins.left, doc.y, doc.page.width - 100, 64).fill('#f3f7ef');
  doc.fillColor('#333').fontSize(9).text(txt('About this record: everything here was self-reported by the person in a self-care app. It is not a clinical record, diagnosis or assessment. Questionnaires are standard screening tools (PHQ-9 and GAD-7: Pfizer, free to use; WHO-5: World Health Organization; AUDIT: WHO, UK version) and are not diagnostic on their own. The person chose which sections to include.'),
    doc.page.margins.left + 8, doc.y + 8, { width: doc.page.width - 116 });
  doc.x = doc.page.margins.left; doc.moveDown(2.2);
  para(doc, `Included: ${[...want].filter((w) => w !== 'notes').map((w) => ({ summary: 'summary', mood: `mood diary${want.has('notes') ? ' (with notes)' : ''}`, questionnaires: 'questionnaires', sobriety: 'substance / behaviour tracking', habits: 'habits', reflections: 'reflections', journal: 'journal entries' }[w])).join(', ')}.`, { color: '#555' });

  const checkins = data.checkins || [];
  const quizzes = data.quizzes || [];
  const latest = (quiz) => quizzes.filter((r) => r.quiz === quiz).slice(-1)[0];
  const bandOf = (quiz, score) => [...C.QUIZZES[quiz].bands].reverse().find(([m]) => score >= m)[1];

  if (want.has('summary')) {
    heading(doc, 'Summary');
    const moods = checkins.filter((c) => c.mood != null);
    const days = new Set(checkins.map((c) => c.day)).size;
    const avg = (arr) => (arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '-');
    const rows = [
      ['Check-in days', `${days}`],
      ['Average mood (1-5)', `${avg(moods.map((c) => c.mood))}`],
      ['Average energy (1-5)', `${avg(checkins.filter((c) => c.energy != null).map((c) => c.energy))}`],
    ];
    ['gad7', 'phq9', 'who5'].forEach((qz) => { const l = latest(qz); if (l) rows.push([`Latest ${C.QUIZZES[qz].name}`, `${l.score} (${bandOf(qz, l.score)}) on ${fmt(l.created_at.toISOString())}`]); });
    (data.trackers || []).forEach((t) => {
      const free = t.days.filter((d) => d.status === 'free').length, lapse = t.days.filter((d) => d.status === 'lapse').length;
      rows.push([`${S.CATEGORIES[t.category]?.name || t.category}`, `${free} free day(s), ${lapse} day(s) used, ${t.urges.length} urge(s) logged in this period`]);
    });
    table(doc, [{ label: 'Measure', w: 0.38 }, { label: 'This period', w: 0.62 }], rows);
  }

  if (want.has('mood')) {
    heading(doc, 'Mood diary');
    para(doc, 'Daily check-ins on a 1-5 scale (1 = very low, 5 = very good).', { color: '#666' });
    const byDay = {};
    checkins.forEach((c) => { byDay[c.day] = byDay[c.day] || { moods: [], energy: [] }; if (c.mood) byDay[c.day].moods.push(c.mood); if (c.energy) byDay[c.day].energy.push(c.energy); });
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    // Over a month, plot weekly averages — daily points become an unreadable zigzag.
    let buckets = Object.entries(byDay);
    const span = buckets.length ? (new Date(buckets[buckets.length - 1][0]) - new Date(buckets[0][0])) / 86400000 : 0;
    if (span > 31) {
      const wk = {};
      buckets.forEach(([d, v]) => { const dt = new Date(d + 'T12:00:00Z'); dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); const k = dt.toISOString().slice(0, 10);
        wk[k] = wk[k] || { moods: [], energy: [] }; wk[k].moods.push(...v.moods); wk[k].energy.push(...v.energy); });
      buckets = Object.entries(wk);
      para(doc, 'Chart shows weekly averages; every day is listed in the table below.', { color: '#666' });
    }
    chart(doc, { yMin: 1, yMax: 5, series: [
      { label: 'Mood', color: '#5f9a4c', points: buckets.map(([d, v]) => ({ x: d, y: mean(v.moods) })) },
      { label: 'Energy', color: '#e8a24a', points: buckets.map(([d, v]) => ({ x: d, y: mean(v.energy) })) } ] });
    const emo = {};
    checkins.forEach((c) => (c.emotions || []).forEach((e) => { emo[e] = (emo[e] || 0) + 1; }));
    if (Object.keys(emo).length) para(doc, `Feelings named most often: ${Object.entries(emo).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([e, n]) => `${e} (${n})`).join(', ')}.`);
    table(doc, [{ label: 'Date', w: 0.15 }, { label: 'When', w: 0.11 }, { label: 'Mood', w: 0.12 }, { label: 'Energy', w: 0.09 }, { label: 'Feelings', w: want.has('notes') ? 0.2 : 0.53 }, ...(want.has('notes') ? [{ label: 'Notes', w: 0.33 }] : [])],
      checkins.map((c) => [fmt(c.day), c.kind, c.mood ? `${c.mood} ${MOOD[c.mood]}` : '-', c.energy ?? '-', (c.emotions || []).join(', '),
        ...(want.has('notes') ? [[c.note, c.gratitude ? `Good thing: ${c.gratitude}` : ''].filter(Boolean).join(' | ')] : [])]));
  }

  if (want.has('questionnaires')) {
    heading(doc, 'Questionnaires');
    const ids = [...new Set(quizzes.map((r) => r.quiz))];
    if (!ids.length) para(doc, 'None completed in this period.', { color: '#777' });
    ids.forEach((qz) => {
      const def = C.QUIZZES[qz];
      const rs = quizzes.filter((r) => r.quiz === qz);
      const max = def.questions.length * (def.options.length - 1);
      para(doc, `${def.name}`, { bold: true, size: 11 });
      para(doc, `${rs.length} completion(s). Score range 0-${max}${def.higherIsBetter ? ' (higher is better)' : ' (higher = more symptoms)'}.`, { color: '#666' });
      if (rs.length > 1) chart(doc, { yMin: 0, yMax: max, bands: def.bands, series: [{ label: 'Score', color: '#3f6fa0', points: rs.map((r) => ({ x: r.created_at, y: r.score })) }] });
      table(doc, [{ label: 'Date', w: 0.22 }, { label: 'Score', w: 0.12 }, { label: 'Band', w: 0.26 }, { label: 'Notes', w: 0.4 }],
        rs.map((r) => [fmt(r.created_at.toISOString()), `${r.score}/${max}`, bandOf(qz, r.score),
          def.safetyItem != null && r.answers[def.safetyItem] > 0 ? `Item ${def.safetyItem + 1} (thoughts of being better off dead or self-harm): "${def.options[r.answers[def.safetyItem]]}"` : '']));
    });
  }

  if (want.has('sobriety')) {
    heading(doc, 'Substance / behaviour tracking');
    if (!(data.trackers || []).length) para(doc, 'No trackers.', { color: '#777' });
    (data.trackers || []).forEach((t) => {
      const cat = S.CATEGORIES[t.category] || {};
      const free = t.days.filter((d) => d.status === 'free').length, lapse = t.days.filter((d) => d.status === 'lapse');
      para(doc, `${cat.name || t.category}: "${t.label}"`, { bold: true, size: 11 });
      para(doc, `Goal: ${t.goal === 'quit' ? 'stop' : 'cut down'}${t.goal === 'quit' ? `, ${t.target_days} days` : ''}. Started ${fmt(t.start_date)}. In this period: ${free} free day(s), ${lapse.length} day(s) used${lapse.some((l) => l.amount) ? ` (total ${lapse.reduce((a, l) => a + Number(l.amount || 0), 0)} ${cat.unit})` : ''}, ${t.days.length ? '' : 'no days logged, '}${t.urges.length} urge(s) logged.`);
      if (t.screens.length) para(doc, `Screening: ${t.screens.map((s) => `${s.kind.toUpperCase()} ${s.score} on ${fmt(s.created_at.toISOString())}`).join('; ')}.`);
      if (t.urges.length) {
        const trig = {}; t.urges.forEach((u) => u.triggers.forEach((x) => { trig[x] = (trig[x] || 0) + 1; }));
        const rated = t.urges.filter((u) => u.before != null && u.after != null);
        para(doc, `Urges: most common triggers ${Object.entries(trig).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} (${n})`).join(', ') || '-'}; ${t.urges.filter((u) => u.outcome === 'passed').length} passed without use${rated.length ? `; average intensity ${(rated.reduce((a, u) => a + u.before, 0) / rated.length).toFixed(1)} before -> ${(rated.reduce((a, u) => a + u.after, 0) / rated.length).toFixed(1)} after urge-surfing` : ''}.`);
      }
      if (t.lapses.length) table(doc, [{ label: 'Date', w: 0.16 }, { label: 'Amount', w: 0.1 }, { label: 'Situation', w: 0.24 }, { label: 'What happened', w: 0.25 }, { label: 'Plan for next time', w: 0.25 }],
        t.lapses.map((l) => [fmt(l.day), l.amount ?? '-', (l.situation || []).join(', '), l.what_happened || '', l.next_time || '']));
    });
  }

  if (want.has('habits')) {
    heading(doc, 'Habits');
    const today = game.localDay(data.user.tz);
    table(doc, [{ label: 'Habit', w: 0.3 }, { label: 'Plan', w: 0.36 }, { label: 'Target', w: 0.1 }, { label: 'Done in period', w: 0.12 }, { label: 'Strength', w: 0.12 }],
      (data.habits || []).map((h) => {
        const logs = Object.fromEntries(h.logs.map((l) => [l.day, l.status]));
        const done = h.logs.filter((l) => l.day >= from && l.day <= to && (l.status === 'done' || l.status === 'mini')).length;
        return [h.title, `${h.anchor ? `After ${h.anchor}, ` : ''}${h.tiny || ''}`, `${h.per_week}/week`, `${done}`, `${strength(new Date(h.created_at).toISOString().slice(0, 10), today, logs, h.per_week)}%`];
      }));
  }

  if (want.has('reflections') && data.reflections?.length) {
    heading(doc, 'Reflections');
    data.reflections.forEach((r) => { para(doc, `${fmt(r.day)}${r.prompt ? ` - ${r.prompt}` : ''}`, { bold: true }); para(doc, r.body); doc.moveDown(0.3); });
  }
  if (want.has('journal') && data.journal?.length) {
    heading(doc, 'Journal entries');
    data.journal.forEach((m) => { para(doc, `${fmt(m.created_at.toISOString())} - ${m.title}`, { bold: true }); para(doc, m.body); doc.moveDown(0.3); });
  }

  // Page numbers
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#999').fontSize(8).text(`${name} · self-reported wellbeing record · page ${i + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - 36, { width: doc.page.width - 100, align: 'center', lineBreak: false });
  }
}

function params(req) {
  const user = req.query;
  const to = isDay(user.to) ? user.to : new Date().toISOString().slice(0, 10);
  const from = isDay(user.from) ? user.from : (() => { const d = new Date(to + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 90); return d.toISOString().slice(0, 10); })();
  const want = new Set(String(user.s || 'summary,mood,questionnaires,sobriety,habits').split(',').filter((x) => SECTIONS.includes(x)));
  if (!want.size) want.add('summary');
  return { from, to, want };
}

router.get('/sections', (req, res) => res.json({ ok: true, sections: SECTIONS }));

router.get('/pdf', async (req, res) => {
  const { from, to, want } = params(req);
  const data = await gather(req.uid, from, to, want);
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, lang: 'en-GB',
    info: { Title: `Wellbeing record ${from} to ${to}`, Author: txt(data.user.name), Creator: APP_NAME } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.inline ? 'inline' : 'attachment'}; filename="wellbeing-record-${from}-to-${to}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);
  try { build(doc, data, from, to, want); } catch (e) { console.error('[report]', e.message); doc.text('Sorry — part of this report could not be generated.'); }
  doc.end();
});

module.exports = router;
