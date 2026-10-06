#!/usr/bin/env node
/*
 * Builds the coach's health library from the pages listed in library/sources.json.
 *   node scripts/update-library.js            (or: docker compose exec app node scripts/update-library.js)
 *
 * It reads the structured content block (JSON-LD) each NHS page publishes, keeps the wording exactly as
 * published, and writes one file per page to library/nhs/. Nothing is rewritten or summarised: the NHS
 * website's terms allow re-use of unchanged content with attribution and the date it was copied
 * (see library/README.md). Re-run it to refresh the copy; the app picks it up on restart.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'library');
const OUT = path.join(ROOT, 'nhs');
const { sources } = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources.json'), 'utf8'));

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', pound: '£' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENTITIES[e.toLowerCase()] ?? m;
});

/** NHS content HTML → plain text with list bullets and paragraph breaks. Wording is untouched. */
function toText(html) {
  return decode(String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|ul|ol|h\d|div|table|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/^- *\n+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sectionsFrom(page) {
  const out = [];
  for (const part of page.hasPart || []) {
    const heading = (part.headline || part.name || '').trim() || 'Overview';
    let current = { heading, sub: '', text: [] };
    const flush = () => { const t = current.text.join('\n\n').trim(); if (t) out.push({ heading: current.heading, sub: current.sub, text: t }); };
    for (const el of part.hasPart || []) {
      const t = toText(el.text);
      if (!t) continue;
      const sub = (el.headline || '').trim();
      // A titled element starts its own sub-section, unless it just repeats the section heading.
      if (sub && sub !== heading && sub !== current.sub) { flush(); current = { heading, sub, text: [] }; }
      current.text.push(t);
    }
    flush();
  }
  return out;
}

/** Some pages publish an empty structured block, so read the article itself: h2 = section, h3 = sub-section. */
function sectionsFromHtml(html) {
  const article = (html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || [])[1];
  if (!article) return [];
  const body = article.replace(/<(nav|aside|form|button|svg)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<div[^>]*nhsuk-review-date[\s\S]*?<\/div>/gi, '');
  const out = [];
  let heading = 'Overview', sub = '', buf = '';
  const flush = () => { const t = toText(buf); if (t) out.push({ heading, sub, text: t }); buf = ''; };
  for (const piece of body.split(/(?=<h[23]\b)/i)) {
    const h = piece.match(/^<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/i);
    if (h) {
      flush();
      const title = toText(h[2]);
      if (h[1] === '2') { heading = title; sub = ''; } else sub = title;
      buf = piece.slice(h[0].length);
    } else buf += piece;
  }
  flush();
  return out;
}

async function fetchOne(src) {
  const res = await fetch(src.url, { headers: { 'User-Agent': 'Pippin health library (self-hosted; github.com/tbusiness25/pippin)' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
  const page = blocks.find((b) => b && Array.isArray(b.hasPart)) || blocks.find((b) => b && b.name) || {};
  let sections = sectionsFrom(page);
  if (!sections.length) sections = sectionsFromHtml(html);
  // Drop the medicine pages' metadata stubs ("Contraindications", "Side effects") that carry no advice.
  sections = sections.filter((s) => s.text.length >= 40);
  if (!sections.length) throw new Error('page had no text');
  return {
    id: src.id,
    group: src.group,
    title: page.name || page.headline || page.about?.name || src.id,
    url: page.url || res.url || src.url,
    publisher: 'NHS website',
    licence: 'Open Government Licence v3.0',
    copied_on: new Date().toISOString().slice(0, 10),
    last_reviewed: Array.isArray(page.lastReviewed) ? page.lastReviewed[0]?.slice(0, 10) : page.lastReviewed?.slice?.(0, 10) || null,
    sections,
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let ok = 0;
  for (const src of sources) {
    try {
      const doc = await fetchOne(src);
      fs.writeFileSync(path.join(OUT, `${src.id}.json`), JSON.stringify(doc, null, 2) + '\n');
      console.log(`✓ ${src.id} — ${doc.title} (${doc.sections.length} sections)`);
      ok++;
    } catch (e) {
      console.error(`✗ ${src.id} — ${e.message} — kept the previous copy, if any`);
    }
    await new Promise((r) => setTimeout(r, 500));   // be polite to nhs.uk
  }
  console.log(`\n${ok}/${sources.length} pages updated in library/nhs/. Restart the app to load them.`);
  process.exit(ok ? 0 : 1);
})();
