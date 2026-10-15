/*
 * 🌾 The village: a low-poly town (three.js, the same approach as Hermes Village) that the sprig and its neighbours
 * walk around. Villagers do their jobs (watering, fishing, sweeping). The bus takes 5 🌰 into town, where the
 * townsfolk share a bit of real information in speech bubbles. The day runs on London time.
 *   F.village.open(el, { base, mode: 'self' | 'visit', uid, back })
 *     base — '/api/village' (grown-ups) or '/api/kids/village' (children)
 *     mode — 'self' (my village: bus, chat, privacy) or 'visit' (a family member's public village, read-only)
 */
(function () {
  const esc = F.esc;
  let THREE = null;
  const loadThree = async () => THREE || (THREE = await import('/vendor/three/three.module.min.js'));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  async function call(url, body) {
    const r = await fetch(url, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || 'Something went wrong');
    return j;
  }

  /** Hour of the day in London, as a decimal (14.5 = half two). */
  function londonHour() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    return (parseInt(p.hour, 10) % 24) + parseInt(p.minute, 10) / 60;
  }

  // ------------------------------------------------------------------ the world
  const C = { grass: 0x9ad17a, path: 0xe9d6a4, cobble: 0xcbb9a0, trunk: 0x8b5e3c, leaves: 0x5fae5a, soil: 0x8a6a4a, crop: 0x7bc957,
    pond: 0x7fc8e8, wall: 0xf6e7c8, wall2: 0xf8d9b0, roof: 0xd9674f, roof2: 0x9c6b4e, shop: 0xf3c98b, bake: 0xf2b8a0, red: 0xe8473f,
    skin: 0xf5d2b0, sprig: 0xffd27a, dark: 0x3b2d2a, glass: 0xbfe6ff, stone: 0xbdb6aa };

  /** Build everything for 'home' (my village) or 'town'. Returns the parts the loop needs. */
  function build(THREE, scene, kind) {
    const mats = {};
    const m = (c) => (mats[c] = mats[c] || new THREE.MeshLambertMaterial({ color: c }));
    const add = (mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); scene.add(mesh); return mesh; };
    const box = (w, h, d, c, x, y, z) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)), x, y, z);
    const cyl = (r1, r2, h, c, x, y, z, seg = 8) => add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m(c)), x, y, z);
    const cone = (r, h, c, x, y, z, seg = 4) => add(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m(c)), x, y, z);
    const ball = (r, c, x, y, z) => add(new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m(c)), x, y, z);
    const parts = { villagers: [], spots: [], bus: null, sun: null, moon: null, sprig: null };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), m(kind === 'town' ? C.cobble : C.grass));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);

    if (kind === 'home') {
      // paths
      box(1.2, 0.02, 22, C.path, -0.5, 0.01, -2); box(16, 0.02, 1.2, C.path, -4, 0.01, 2.5);
      // houses
      const house = (x, z, wall) => { box(3, 2.2, 3, wall, x, 1.1, z); cone(2.5, 1.6, C.roof, x, 2.9, z, 4).rotation.y = Math.PI / 4;
        box(0.7, 1.1, 0.1, C.roof2, x, 0.55, z + 1.52); };
      house(-6, -5, C.wall); house(-1, -7, C.wall2);
      // shop & pond & plots
      box(3, 2, 2.6, C.shop, 5, 1, -5); cone(2.2, 1.4, C.roof2, 5, 2.7, -5, 4).rotation.y = Math.PI / 4;
      cyl(2.2, 2.2, 0.1, C.pond, 6, 0.05, 4, 20);
      for (const [x, z] of [[-7, 4], [-4, 4]]) { box(2, 0.12, 1.2, C.soil, x, 0.06, z); for (let i = -2; i <= 2; i++) ball(0.18, C.crop, x + i * 0.35, 0.3, z); }
      // trees & bus stop
      for (const [x, z] of [[-10, -2], [-9, 6], [10, -4], [11, 3], [2, -10], [-3, 9], [9, 9]]) { cyl(0.18, 0.22, 1, C.trunk, x, 0.5, z, 6); ball(0.9, C.leaves, x, 1.6, z); }
      parts.stopAt = [0, 8.2];
      cyl(0.07, 0.07, 1.6, C.dark, 0, 0.8, 8.2, 6); box(1.1, 0.5, 0.08, C.wall, 0, 1.7, 8.2);
      parts.bus = null;
      // the sprig's wandering spot is in front of its house
      parts.sprigHome = [-4, 0, -1.5];
      // villagers: each follows a route of [x, z, task, seconds]
      parts.routes = [
        { c: 0xe88fa0, hat: 0xfff0f5, route: [[-7, 2.8, 'water', 7], [-3, -1.5, 'idle', 3], [-6, -2.8, 'sweep', 6]] },
        { c: 0x8fb8e8, hat: 0x2c5fa8, route: [[6, 2.4, 'fish', 10], [2.5, -1.2, 'idle', 3], [-2, -1.5, 'idle', 3]] },
        { c: 0xf0c674, hat: 0xd9674f, route: [[-4, 6, 'idle', 4], [0, 6.2, 'idle', 3], [-9, 0.5, 'sweep', 5]] },
      ];
    } else {
      // town: stalls & buildings
      const shop = (x, z, wall, awning, label) => { box(3, 2.3, 2.6, wall, x, 1.15, z); box(3.2, 0.4, 0.9, awning, x, 2.2, z + 1.3); parts.spots.push({ id: label, at: [x, 0.4, z + 2.1] }); };
      cyl(0.09, 0.09, 4.5, C.dark, -6, 2.25, -4.5, 6); ball(0.5, 0xffffff, -6, 4.9, -4.5); box(1.8, 1.2, 1.2, C.wall, -6, 0.6, -2.4);
      shop(-1, -6, C.wall2, C.red, 'mabel');
      cyl(0.5, 0.5, 2.6, C.stone, 3.5, 1.3, -6, 8); cyl(0.5, 0.5, 2.6, C.stone, 6.5, 1.3, -6, 8); box(4.5, 0.4, 2.2, C.stone, 5, 2.8, -6); cone(2.8, 1.2, C.stone, 5, 3.9, -6, 4).rotation.y = Math.PI / 4;
      shop(-5, 3, C.bake, 0xffffff, 'gus');
      box(0.6, 0.2, 2, C.path, 5, 0.1, 2);
      parts.spots.push({ id: 'barnaby', at: [-6, 0.4, -2.5] }, { id: 'fig', at: [5, 0.4, -3.6] }, { id: 'pip', at: [3.1, 0.4, 6.3] });
      parts.stopAt = [0, 0];
      parts.routes = [{ c: 0xb4e0a0, hat: 0x7a4e2d, route: [[-2, 1, 'idle', 4], [1, 4, 'idle', 3], [-1, 1.5, 'idle', 2]] },
        { c: 0xd9b3f0, hat: 0x5c3b8a, route: [[2, -2, 'idle', 3], [4, 2, 'idle', 4], [-4, -1, 'idle', 3]] }];
      parts.bus = null;
    }
    // bus (parked in town, or the one that drives up)
    const bus = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 1.1), m(C.red)); body.position.y = 0.8; bus.add(body);
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.45, 1.12), m(C.glass)); win.position.y = 1.05; bus.add(win);
    for (const x of [-0.8, 0.8]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 8), m(C.dark)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.3, 0.55); bus.add(w); }
    bus.position.set(kind === 'town' ? 0.6 : -22, 0, kind === 'town' ? 7 : 8.2);
    scene.add(bus); parts.busMesh = bus;

    // the sprig (its own pet) — home only
    if (kind === 'home') {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), m(C.sprig)); b.scale.set(1, 0.9, 1); b.position.y = 0.4; g.add(b);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 4), m(C.sprig)); e.position.set(s * 0.22, 0.85, 0); e.rotation.z = -s * 0.3; g.add(e); }
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), m(C.dark)); e.position.set(s * 0.13, 0.46, 0.31); g.add(e); }
      scene.add(g); parts.sprig = g;
    }
    // the sun and moon
    parts.sun = ball(0.9, 0xfff3a0, 0, 10, -12); parts.moon = ball(0.7, 0xe8ecff, 0, -10, -12);
    // villagers
    for (const v of parts.routes || []) parts.villagers.push(person(THREE, scene, v.c, v.hat, v.route));
    return parts;
  }

  function person(THREE, scene, body, hat, route) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.7, 8), new THREE.MeshLambertMaterial({ color: body })); b.position.y = 0.45; g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: C.skin })); h.position.y = 1.08; g.add(h);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), new THREE.MeshLambertMaterial({ color: hat })); t.position.y = 1.26; g.add(t);
    scene.add(g);
    const v = { g, route, i: 0, wait: 0, task: 'idle', x: route[0][0], z: route[0][1] };
    g.position.set(v.x, 0, v.z);
    return v;
  }

  // ------------------------------------------------------------------ the page
  async function open(el, opts) {
    const { base, mode = 'self', uid, back } = opts;
    el.innerHTML = `<div class="vil"><div class="vil-stage" id="vilStage"><p class="vil-load">Waking up the village…</p></div>
      <div class="vil-top" id="vilTop"></div><div class="vil-spots" id="vilSpots"></div><div class="vil-say" id="vilSay" hidden></div></div>`;
    const stage = el.querySelector('#vilStage');
    let THREE_;
    try { THREE_ = await loadThree(); } catch { stage.innerHTML = '<p class="vil-load">The village needs a modern browser with 3D graphics.</p>'; return; }
    let webgl;
    try { webgl = new THREE_.WebGLRenderer({ antialias: true, powerPreference: 'low-power' }); } catch { stage.innerHTML = '<p class="vil-load">The village needs 3D graphics, which this browser has turned off.</p>'; return; }

    const world = { info: null, me: null, kind: 'home', parts: null, spots: [], talking: null, busy: false };
    const topEl = el.querySelector('#vilTop'), spotsEl = el.querySelector('#vilSpots'), sayEl = el.querySelector('#vilSay');
    stage.innerHTML = '';
    stage.appendChild(webgl.domElement);
    webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const scene = new THREE_.Scene();
    const camera = new THREE_.PerspectiveCamera(36, 1, 0.1, 200);
    const size = () => {
      const w = stage.clientWidth || 360, h = stage.clientHeight || 520;
      webgl.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 52 : 36; camera.updateProjectionMatrix();
    };
    camera.position.set(0, 16, 20); camera.lookAt(0, 0.5, 0);
    scene.add(new THREE_.AmbientLight(0xffffff, 0.7));
    const sunLight = new THREE_.DirectionalLight(0xffffff, 0.8); scene.add(sunLight);

    // ---- top bar
    async function loadMe() {
      if (mode === 'visit') {
        const v = await call(`${base}/of/${encodeURIComponent(uid)}`);
        world.info = { name: v.name, pet: v.pet, visit: true };
      } else {
        const me = await call(`${base}/me`);
        world.me = me;
        world.info = { name: me.name, pet: me.pet, fare: me.fare, public: me.public, characters: me.characters };
      }
    }
    async function ambient() { try { world.amb = (await call(`${base}/ambient`)); } catch { world.amb = null; } }
    function drawTop() {
      const i = world.info;
      topEl.innerHTML = mode === 'visit'
        ? `<div class="vil-title">${esc(i.name)}’s village 🌾</div>${back ? '<button class="vil-btn" id="vilBack">← Back</button>' : ''}`
        : `<div class="vil-title">${world.kind === 'town' ? '🏙️ Town' : '🌾 ' + esc(i.pet ? i.pet.name + '’s village' : 'My village')}</div>
           <div class="vil-row">${i.pet ? `<span class="vil-pill" title="Acorns — the bus costs ${i.fare}">🌰 ${i.pet.acorns}</span>` : ''}
           <label class="vil-switch" title="Family can see my village"><input type="checkbox" id="vilPub" ${i.public ? 'checked' : ''}><span>${i.public ? 'Family can see' : 'Private'}</span></label></div>`;
      if (back) { const b = topEl.querySelector('#vilBack'); if (b) b.onclick = back; }
      const p = topEl.querySelector('#vilPub');
      if (p) p.onchange = async () => {
        try { const r = await call(`${base}/privacy`, { public: p.checked }); world.info.public = r.public; drawTop(); F.toast?.(r.public ? 'Your family can visit your village now 🌾' : 'Your village is private again 🔒'); }
        catch (e) { F.toast?.(e.message); p.checked = !p.checked; }
      };
    }

    // ---- scene
    function sceneFor(kind) {
      while (scene.children.length > 2) { const o = scene.children.pop(); o.traverse?.((x) => x.geometry?.dispose?.()); }   // keep the two lights
      world.kind = kind;
      world.parts = build(THREE_, scene, kind);
      world.spots = [];
      spotsEl.innerHTML = '';
      const amb = world.amb || {};
      if (kind === 'home') {
        if (mode === 'self') world.spots.push({ key: 'bus', at: [0, 1.7, 8.2], html: `<button class="vil-spot-b" data-go="town">🚌 Town${world.info.pet ? ` · ${world.info.fare} 🌰` : ''}</button>` });
        world.spots.push({ key: 'sprig', follow: 'sprig', at: [-4, 1.2, -1.5], html: `<button class="vil-spot-b" data-hi="1">${esc(world.info.pet ? world.info.pet.name : (mode === 'visit' ? 'Their sprig' : 'Your sprig'))}</button>` });
        world.spots.push({ key: 'oat', follow: 0, at: [-3, 1.5, -1.5], html: '<button class="vil-spot-b" data-line="oat">🧺 Oat</button>' });
        world.spots.push({ key: 'ruby', follow: 1, at: [2.5, 1.5, -1.2], html: '<button class="vil-spot-b" data-line="ruby">🎣 Ruby</button>' });
        world.spots.push({ key: 'finn', follow: 2, at: [0, 1.5, 6], html: '<button class="vil-spot-b" data-line="finn">🪣 Finn</button>' });
      } else {
        const names = { barnaby: '🌦️ Barnaby', mabel: '🗞️ Mabel', fig: '🦉 Prof Fig', gus: '🥐 Gus', pip: '🚌 Pip' };
        for (const s of world.parts.spots) world.spots.push({ key: s.id, at: [s.at[0], 2.2, s.at[2]], html: `<button class="vil-spot-b" data-npc="${s.id}">${names[s.id]}</button>` });
        world.spots.push({ key: 'home', at: [3.1, 2.2, 7.6], html: '<button class="vil-spot-b" data-go="home">🏡 Home (free)</button>' });
      }
      spotsEl.innerHTML = world.spots.map((s) => `<div class="vil-spot" data-k="${s.key}">${s.html}</div>`).join('');
      spotsEl.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => (b.dataset.go === 'town' ? rideToTown() : rideHome()); });
      spotsEl.querySelectorAll('[data-npc]').forEach((b) => { b.onclick = () => talkTo(b.dataset.npc); });
      spotsEl.querySelectorAll('[data-line]').forEach((b) => { b.onclick = () => say(villagerLine(b.dataset.line, amb)); });
      spotsEl.querySelectorAll('[data-hi]').forEach((b) => { b.onclick = () => say(sprigLine()); });
    }
    function sprigLine() {
      const name = world.info.pet ? world.info.pet.name : 'Your sprig';
      const lines = [`${name} does a happy wiggle.`, `${name} is trying to catch a butterfly.`, `${name} thinks you should go and say hello to the ducks.`];
      return [lines[Math.floor(Math.random() * lines.length)]];
    }
    function villagerLine(who, amb) {
      const w = amb && amb.weather;
      if (who === 'oat') return [`Oat: “Watering the carrots. It’s ${amb?.day || 'a lovely day'}!”`];
      if (who === 'ruby') return [w ? `Ruby: “${w.tempC}°C and ${w.sky}, perfect fishing weather.”` : 'Ruby: “Shh. I’m fishing.”'];
      return [`Finn: “${w ? (w.rainChance >= 40 ? 'Brolly time, friend!' : 'No brolly needed today.') : 'Sweeping the path, one leaf at a time.'}”`];
    }

    // ---- talking
    async function talkTo(npc) {
      if (mode !== 'self' || world.busy) return;
      world.busy = true;
      try {
        const r = await call(`${base}/talk/${encodeURIComponent(npc)}`, {});
        F.toast?.(r.messages?.[0] || '');
        showDialogue(r);
      } catch (e) { F.toast?.(e.message); }
      finally { world.busy = false; }
    }
    function showDialogue(r) {
      let i = 0;
      sayEl.hidden = false;
      const draw = () => {
        if (i < r.lines.length) {
          sayEl.innerHTML = `<div class="vil-card"><div class="vil-who">${esc(r.emoji)} ${esc(r.name)} <small>${esc(r.job)}</small></div>
            <p>${esc(r.lines[i])}</p><button class="vil-btn" id="vilNext">${i < r.lines.length - 1 ? 'Next ▸' : 'Thanks!'}</button></div>`;
          sayEl.querySelector('#vilNext').onclick = () => { i++; if (i >= r.lines.length) { sayEl.hidden = true; } else draw(); };
        } else sayEl.hidden = true;
      };
      draw();
    }
    function say(lines) { showDialogue({ name: '', emoji: '💬', job: '', lines }); }

    // ---- bus
    async function rideToTown() {
      if (world.busy || world.kind !== 'home' || mode !== 'self') return;
      if (!world.info.pet) return F.toast?.('Hatch your sprig first, then it can catch the bus.');
      world.busy = true;
      try {
        const r = await call(`${base}/bus`, { to: 'town' });
        world.info.pet.acorns = r.acorns; drawTop();
        world.drive = { from: -22, to: 0.6, t: 0, dur: 2.2, then: () => { sceneFor('town'); world.busy = false; F.toast?.('Arrived in town! 🚌'); } };
        F.toast?.(`The bus costs ${r.cost} 🌰. Hop on!`);
      } catch (e) { world.busy = false; F.toast?.(e.message); }
    }
    function rideHome() {
      if (world.busy || world.kind !== 'town') return;
      world.busy = true;
      world.drive = { from: world.parts.busMesh.position.x, to: -22, t: 0, dur: 2.0, then: () => { sceneFor('home'); world.busy = false; } };
      call(`${base}/bus`, { to: 'home' }).catch(() => {});
    }

    // ---- loop
    let raf = 0, last = performance.now(), skyAt = 0;
    const DAY = new THREE_.Color(0xa9dcff), DUSK = new THREE_.Color(0xffb38a), NIGHT = new THREE_.Color(0x1b2540);
    const sky = new THREE_.Color();
    function applySky(now) {
      if (now - skyAt < 4000) return; skyAt = now;
      const h = londonHour();
      const sunAng = ((h - 6) / 24) * Math.PI * 2;
      const sunY = Math.sin(sunAng);
      const dayness = clamp(sunY * 1.6 + 0.25, 0, 1);
      const dusk = clamp(1 - Math.abs(sunY) * 3, 0, 1) * 0.6;
      sky.copy(NIGHT).lerp(DAY, dayness).lerp(DUSK, dusk);
      scene.background = sky.clone();
      sunLight.intensity = 0.2 + 0.8 * dayness;
      sunLight.position.set(Math.cos(sunAng) * 20, Math.max(4, sunY * 20), 8);
      if (world.parts) { world.parts.sun.position.set(Math.cos(sunAng) * 22, sunY * 22, -12); world.parts.moon.position.set(-Math.cos(sunAng) * 22, -sunY * 22, -12); }
    }
    function step(dt, now) {
      const P = world.parts; if (!P) return;
      // villagers
      for (const v of P.villagers) {
        if (v.wait > 0) {
          v.wait -= dt; const s = Math.sin(now / 200 + v.x);
          if (v.task === 'water') v.g.rotation.x = 0.2 + Math.abs(s) * 0.35;
          else if (v.task === 'sweep') v.g.rotation.z = s * 0.15;
          else if (v.task === 'fish') v.g.position.y = Math.sin(now / 500) * 0.05;
          if (v.wait <= 0) { v.g.rotation.set(0, v.g.rotation.y, 0); v.g.position.y = 0; }
          continue;
        }
        const [tx, tz, task, secs] = v.route[v.i];
        const dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { v.task = task; v.wait = secs; v.i = (v.i + 1) % v.route.length; continue; }
        const sp = 1.2 * dt, k = Math.min(1, sp / d);
        v.x += dx * k; v.z += dz * k; v.g.position.set(v.x, Math.abs(Math.sin(now / 150)) * 0.06, v.z);
        v.g.rotation.y = Math.atan2(dx, dz);
      }
      // the sprig wanders its patch, bouncing
      if (P.sprig) {
        const [bx, , bz] = P.sprigHome;
        const a = now / 2600;
        P.sprig.position.set(bx + Math.sin(a) * 1.4, Math.abs(Math.sin(now / 240)) * 0.22, bz + Math.cos(a * 0.7) * 0.9);
        P.sprig.rotation.y = Math.atan2(Math.cos(a) * 1.4, -Math.sin(a * 0.7) * 0.9);
      }
      // the bus driving in or out
      if (world.drive) {
        const dv = world.drive; dv.t += dt;
        const f = clamp(dv.t / dv.dur, 0, 1), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        P.busMesh.position.x = dv.from + (dv.to - dv.from) * e;
        if (f >= 1) { const then = dv.then; world.drive = null; then(); }
      }
    }
    function placeSpots() {
      const w = stage.clientWidth, h = stage.clientHeight;
      const v = new THREE_.Vector3();
      spotsEl.querySelectorAll('.vil-spot').forEach((n) => {
        const s = world.spots.find((x) => x.key === n.dataset.k); if (!s) return;
        // labels follow their character (the sprig, or a villager by index) and sit just above its head
        const P = world.parts, who = s.follow === 'sprig' ? P.sprig : (s.follow != null && P.villagers[s.follow] ? P.villagers[s.follow].g : null);
        if (who) v.set(who.position.x, who.position.y + 1.7, who.position.z); else v.set(s.at[0], s.at[1], s.at[2]);
        v.project(camera);
        const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
        n.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        n.style.opacity = v.z > 1 ? 0 : 1;
      });
    }
    function frame(now) {
      if (!el.isConnected) { webgl.dispose(); window.removeEventListener('resize', size); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      applySky(now);
      if (!document.hidden) { step(dt, now); webgl.render(scene, camera); placeSpots(); }
      raf = requestAnimationFrame(frame);
    }

    // ---- start
    try {
      await loadMe();
      await ambient();
      size();
      window.addEventListener('resize', size);
      sceneFor('home');
      drawTop();
      if (mode === 'visit' && !world.info.visit) throw new Error('That village is private');
      raf = requestAnimationFrame(frame);
      if (mode === 'self' && world.info.pet === null) F.toast?.('Hatch your sprig to take the bus into town 🌾');
    } catch (e) {
      stage.innerHTML = `<p class="vil-load">${esc(e.message)}</p>`;
    }
    // weather bubbles refresh every 20 min
    const timer = setInterval(() => { if (!el.isConnected) return clearInterval(timer); ambient(); }, 20 * 60e3);
  }

  F.village = { open };
})();
