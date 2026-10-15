/*
 * Reads: a shelf of articles the owner of this server drops in as Markdown files.
 *  - READS_DIR (default /data/reads, i.e. ./data/reads on the host) holds <slug>.md
 *  - the first "# " line is the title; an *italic* line straight after it is the subtitle
 *  - an optional <slug>.mp3 / .m4a / .ogg / .wav next to it is offered as "Listen"
 * Files are read on every request, so adding one needs no restart.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DIR = process.env.READS_DIR || '/data/reads';
const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
const AUDIO = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

function parse(slug) {
  const file = path.join(DIR, `${slug}.md`);
  const md = fs.readFileSync(file, 'utf8');
  const lines = md.split('\n');
  const t = lines.findIndex((l) => /^#\s+/.test(l));
  const title = t >= 0 ? lines[t].replace(/^#\s+/, '').trim() : slug.replace(/-/g, ' ');
  const next = lines.slice(t + 1).find((l) => l.trim());
  const subtitle = next && /^\*[^*].*\*$/.test(next.trim()) ? next.trim().slice(1, -1) : '';
  const words = md.split(/\s+/).filter(Boolean).length;
  const audio = Object.keys(AUDIO).find((ext) => fs.existsSync(path.join(DIR, slug + ext))) || null;
  return { slug, title, subtitle, minutes: Math.max(1, Math.round(words / 200)), audio: !!audio, audioExt: audio,
    added: fs.statSync(file).mtime.toISOString(), md };
}

function list() {
  let names = [];
  try { names = fs.readdirSync(DIR); } catch { return []; }
  return names.filter((n) => n.endsWith('.md')).map((n) => n.slice(0, -3)).filter((s) => SLUG.test(s))
    .map((s) => { try { const { md, audioExt, ...rest } = parse(s); return rest; } catch { return null; } })
    .filter(Boolean).sort((a, b) => b.added.localeCompare(a.added));
}

router.get('/', (req, res) => res.json({ reads: list() }));

router.get('/:slug', (req, res) => {
  if (!SLUG.test(req.params.slug)) return res.status(404).json({ error: 'Not found' });
  try { const { audioExt, ...r } = parse(req.params.slug); res.json(r); } catch { res.status(404).json({ error: 'Not found' }); }
});

router.get('/:slug/audio', (req, res) => {
  if (!SLUG.test(req.params.slug)) return res.status(404).end();
  const ext = Object.keys(AUDIO).find((e) => fs.existsSync(path.join(DIR, req.params.slug + e)));
  if (!ext) return res.status(404).end();
  res.type(AUDIO[ext]).sendFile(path.join(DIR, req.params.slug + ext)); // sendFile handles Range for seeking
});

module.exports = router;
