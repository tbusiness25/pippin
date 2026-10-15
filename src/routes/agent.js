/* Agent chat (Talk → Agent): your own agent's conversations, streamed. See src/agent/chat.js. */
const express = require('express');
const agent = require('../agent/chat');

module.exports = (brains) => {
  const router = express.Router();

  // The signed-in person's agent profile, or 404 when they have none.
  async function profile(req, res, next) {
    const b = await brains.forUser(req.uid);
    if (!b.agent) return res.status(404).json({ ok: false, error: 'No agent is connected for you' });
    req.agent = b.agent; req.agentLabel = b.label;
    next();
  }
  const wrap = (fn) => (req, res, next) => fn(req, res).catch((e) => {
    console.error('[agent]', req.method, req.path, e.message);
    res.status(502).json({ ok: false, error: 'Your agent didn’t answer — it may be busy or offline.' });
  });

  router.use(profile);
  router.get('/info', (req, res) => res.json({ ok: true, label: req.agentLabel, kind: req.agent.kind,
    voice: !!process.env.WHISPER_URL, speak: !!process.env.TTS_URL }));
  router.get('/threads', wrap(async (req, res) => res.json({ ok: true, label: req.agentLabel, threads: await agent.list(req.uid, req.agent) })));
  router.post('/threads', wrap(async (req, res) => res.json({ ok: true, thread: await agent.create(req.uid, req.agent) })));
  router.get('/threads/:id', wrap(async (req, res) => {
    const t = await agent.messages(req.uid, req.agent, req.params.id);
    if (!t) return res.status(404).json({ ok: false });
    res.json({ ok: true, label: req.agentLabel, ...t });
  }));
  router.post('/threads/:id/rename', wrap(async (req, res) => { await agent.rename(req.uid, req.agent, req.params.id, (req.body || {}).title); res.json({ ok: true }); }));
  router.delete('/threads/:id', wrap(async (req, res) => { await agent.remove(req.uid, req.agent, req.params.id); res.json({ ok: true }); }));

  // One turn, streamed back as Server-Sent Events: delta / tool / done / error.
  router.post('/threads/:id/message', async (req, res) => {
    const text = String((req.body || {}).text || '').trim().slice(0, 8000);
    if (!text) return res.status(400).json({ ok: false });
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
    res.flushHeaders();
    const out = (type, payload) => { if (!res.writableEnded) res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`); };
    const ping = setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n'); }, 15000);
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    try { await agent.send(req.uid, req.agent, req.params.id, text, out, { signal: ac.signal }); }
    catch (e) { if (!ac.signal.aborted) { console.error('[agent] turn:', e.message); out('error', { message: 'Your agent didn’t answer — it may be busy or offline. Try again.' }); } }
    finally { clearInterval(ping); res.end(); }
  });

  // Speech → text with the local Whisper (the agent then gets plain text).
  router.post('/transcribe', express.raw({ type: () => true, limit: '12mb' }), wrap(async (req, res) => {
    if (!process.env.WHISPER_URL) return res.status(400).json({ ok: false, error: 'Voice not set up' });
    const form = new FormData();
    form.append('file', new Blob([req.body], { type: req.headers['content-type'] || 'audio/webm' }), 'speech.webm');
    form.append('model', process.env.WHISPER_MODEL || 'whisper-1');
    form.append('language', 'en');
    const tr = await fetch(`${process.env.WHISPER_URL.replace(/\/$/, '')}/audio/transcriptions`, { method: 'POST', body: form, signal: AbortSignal.timeout(90000) });
    if (!tr.ok) throw new Error(`whisper ${tr.status}`);
    res.json({ ok: true, text: String((await tr.json()).text || '').trim() });
  }));

  return router;
};
