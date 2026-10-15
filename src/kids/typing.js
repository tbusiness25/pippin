/*
 * ⌨️ Typing practice. Drills build speed and accuracy (words a minute = characters ÷ 5, the usual measure).
 * "Explain it" is writing where the child types their own thinking to a question. Nothing is graded; the
 * grown-ups can read the results and explanations in the Family section.
 *   GET  /api/kids/typing            → lessons, the question prompts, recent results
 *   POST /api/kids/typing/drill      { lesson, wpm, accuracy, seconds }
 *   POST /api/kids/typing/explain    { prompt, text }
 */
const LESSONS = [
  { id: 'home', name: 'Home row', text: 'a sad dad had a flask. ask dad as a lad; jolly jam; all fall; ask a salad lad' },
  { id: 'top', name: 'Top row', text: 'quit your pretty yellow pot and write to our tower; I put it at the top of the page' },
  { id: 'bottom', name: 'Bottom row', text: 'zoo box, I can see more cows. Move the van; vex the crab; the zebra can climb' },
  { id: 'capitals', name: 'Capitals and full stops', text: 'I can type. I put a capital letter at the start, and a full stop at the end.' },
  { id: 'numbers', name: 'Numbers', text: 'I am learning to type. A bike has 2 wheels, and I can count to 100 in 2 languages.' },
  { id: 'sentences', name: 'Whole sentences', text: 'Tomorrow I will build a tower with my blocks, then show my family how the bridge holds up.' },
];

const PROMPTS = [
  'How would you split a pizza fairly between four people?',
  'What is your plan for your next Lego build, step by step?',
  'If you found a lost dog, what would you do first, and why?',
  'Describe your favourite place in the world and what makes it special.',
  'Explain how you would make your own breakfast, step by step.',
  'What is something you got better at lately, and how did you do it?',
];

const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };

module.exports = {
  routes(r, { pool }) {
    r.get('/typing', async (req, res) => {
      const { rows } = await pool.query(`SELECT id, kind, lesson, wpm, accuracy, seconds, body, created_at FROM kid_typing
        WHERE child_id=$1 ORDER BY created_at DESC LIMIT 60`, [req.kid.id]);
      res.json({ ok: true, lessons: LESSONS.map(({ id, name, text }) => ({ id, name, text })), prompts: PROMPTS, results: rows });
    });

    r.post('/typing/drill', async (req, res) => {
      if (req.asParent) return res.status(403).json({ ok: false, error: 'Only the child types these' });
      const b = req.body || {};
      const lesson = LESSONS.find((l) => l.id === b.lesson);
      const wpm = num(b.wpm, 0, 300), accuracy = num(b.accuracy, 0, 100), seconds = num(b.seconds, 1, 3600);
      if (!lesson || wpm === null || accuracy === null || seconds === null) return res.status(400).json({ ok: false, error: 'Something went wrong — try that one again' });
      await pool.query(`INSERT INTO kid_typing(child_id, kind, lesson, wpm, accuracy, seconds) VALUES ($1,'drill',$2,$3,$4,$5)`,
        [req.kid.id, lesson.id, wpm, accuracy, Math.round(seconds)]);
      res.json({ ok: true });
    });

    r.post('/typing/explain', async (req, res) => {
      if (req.asParent) return res.status(403).json({ ok: false, error: 'Only the child types these' });
      const b = req.body || {};
      if (!PROMPTS.includes(b.prompt)) return res.status(400).json({ ok: false, error: 'Pick a question first' });
      const text = String(b.text || '').trim().slice(0, 2000);
      if (!text) return res.status(400).json({ ok: false, error: 'Type something first' });
      await pool.query(`INSERT INTO kid_typing(child_id, kind, lesson, body) VALUES ($1,'explain',$2,$3)`, [req.kid.id, b.prompt, text]);
      res.json({ ok: true });
    });
  },
};
