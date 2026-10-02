/* Soundscapes generated live with Web Audio — no audio files, nothing to license, works offline. */
(function () {
  let ctx = null, master = null, nodes = [], timers = [];

  function noiseBuffer(type) {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else if (type === 'pink') {        // Paul Kellet's refined method
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else d[i] = w;
      }
    }
    return buf;
  }
  function loop(type, gain = 0.5, filter) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(type); src.loop = true;
    const g = ctx.createGain(); g.gain.value = gain;
    let out = src;
    if (filter) { const f = ctx.createBiquadFilter(); Object.assign(f, { type: filter.type }); f.frequency.value = filter.freq; f.Q.value = filter.q || 0.7; src.connect(f); out = f; nodes.push(f); }
    out.connect(g); g.connect(master); src.start();
    nodes.push(src, g);
    return { src, g };
  }
  function lfo(param, rate, depth, base) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = rate; g.gain.value = depth; param.value = base;
    o.connect(g); g.connect(param); o.start(); nodes.push(o, g);
  }
  function every(minMs, maxMs, fn) {
    const t = () => { fn(); timers.push(setTimeout(t, minMs + Math.random() * (maxMs - minMs))); };
    timers.push(setTimeout(t, minMs));
  }
  function blip({ freq, dur, gain = 0.2, type = 'sine', slide }) {
    const o = ctx.createOscillator(), g = ctx.createGain(), now = ctx.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, now);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, now + dur);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gain, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(master); o.start(now); o.stop(now + dur + 0.05);
  }
  function crackle() {
    const len = Math.floor(ctx.sampleRate * 0.02), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1500; g.gain.value = 0.3 + Math.random() * 0.5;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start();
  }

  const SCAPES = {
    rain: { name: 'Rain', emoji: '🌧️', build() { loop('pink', 0.55, { type: 'highpass', freq: 400 }); loop('brown', 0.35);
      every(40, 160, () => blip({ freq: 2500 + Math.random() * 3000, dur: 0.03, gain: 0.04 + Math.random() * 0.05, type: 'triangle' })); } },
    brown: { name: 'Brown noise', emoji: '🟫', about: 'Deep and steady — many ADHD brains focus better with it.', build() { loop('brown', 0.8); } },
    pink: { name: 'Pink noise', emoji: '🩷', build() { loop('pink', 0.6); } },
    ocean: { name: 'Ocean', emoji: '🌊', build() { const { g } = loop('brown', 0.6, { type: 'lowpass', freq: 900 }); lfo(g.gain, 0.08, 0.45, 0.5);
      const { g: g2 } = loop('pink', 0.2, { type: 'highpass', freq: 1200 }); lfo(g2.gain, 0.08, 0.18, 0.18); } },
    wind: { name: 'Wind', emoji: '🍃', build() { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer('pink'); src.loop = true; const g = ctx.createGain(); g.gain.value = 0.9;
      src.connect(f); f.connect(g); g.connect(master); src.start(); nodes.push(src, f, g); lfo(f.frequency, 0.05, 350, 600); } },
    fire: { name: 'Fireplace', emoji: '🔥', build() { loop('brown', 0.5, { type: 'lowpass', freq: 500 }); every(60, 500, crackle); } },
    forest: { name: 'Forest', emoji: '🐦', build() { loop('pink', 0.12, { type: 'lowpass', freq: 2500 });
      every(1500, 6000, () => { const base = 2000 + Math.random() * 2500; const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) setTimeout(() => blip({ freq: base, slide: base * (1.2 + Math.random() * 0.4), dur: 0.12, gain: 0.07 }), i * 170); }); } },
  };

  function stop() {
    timers.forEach(clearTimeout); timers = [];
    nodes.forEach((n) => { try { n.stop && n.stop(); } catch (_) {} try { n.disconnect(); } catch (_) {} });
    nodes = [];
    if (master) { try { master.disconnect(); } catch (_) {} master = null; }
  }
  function play(id, volume = 0.6) {
    stop();
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2);   // gentle fade-in
    SCAPES[id].build();
  }
  function volume(v) { if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1); }
  function chime() {      // soft two-note bell for timers
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const keep = master; master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    blip({ freq: 660, dur: 1.4, gain: 0.25 }); setTimeout(() => blip({ freq: 880, dur: 1.8, gain: 0.2 }), 350);
    const tmp = master; setTimeout(() => tmp.disconnect(), 2500); master = keep;
  }

  window.Sounds = { SCAPES, play, stop, volume, chime };
})();
