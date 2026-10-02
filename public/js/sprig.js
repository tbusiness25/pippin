/*
 * The sprig — the app's original companion, drawn as SVG so it scales, animates and can wear things.
 * A round moss creature; it grows extra leaves (then a flower) as it moves through its stages.
 */
(function () {
  const PALETTE = {
    moss:  { body: '#9cc987', shade: '#7fb06a', leaf: '#5f9a4c' },
    sky:   { body: '#9fd0ea', shade: '#7fb8d8', leaf: '#5f9a4c' },
    peach: { body: '#f6c1a2', shade: '#eaa27d', leaf: '#6fa35a' },
    lilac: { body: '#cdb5ea', shade: '#b597dc', leaf: '#6fa35a' },
    sun:   { body: '#f5da7e', shade: '#e8c253', leaf: '#6fa35a' },
    rose:  { body: '#f2b5c4', shade: '#e393a8', leaf: '#6fa35a' },
    mint:  { body: '#b3e6cf', shade: '#8fd1b3', leaf: '#4f8f5c' },
    slate: { body: '#a9b6c4', shade: '#8a99aa', leaf: '#5f9a4c' },
    coral: { body: '#f79d86', shade: '#e97d63', leaf: '#5f9a4c' },
    night: { body: '#5b5f97', shade: '#474a7d', leaf: '#8fd18a' },
    cream: { body: '#f1e6cf', shade: '#dfcfae', leaf: '#6fa35a' },
  };
  // Shop colours map item ids → palette keys.
  const COLOUR_ITEMS = { 'colour-mint': 'mint', 'colour-slate': 'slate', 'colour-coral': 'coral', 'colour-night': 'night', 'colour-cream': 'cream' };

  // Outfits, drawn in the sprig's own 200×200 space (body top ≈ y58, eyes y116, chin ≈ y150).
  const WEAR = {
    'hat-beanie': `<path d="M58 80 Q100 20 142 80 Z" fill="#d0784f"/><rect x="54" y="74" width="92" height="14" rx="7" fill="#b9633d"/><circle cx="100" cy="30" r="9" fill="#f2c14e"/>`,
    'hat-acorn': `<path d="M60 82 Q100 28 140 82 Z" fill="#8a5a33"/><path d="M60 82 Q100 70 140 82" stroke="#6b4424" stroke-width="5" fill="none"/><rect x="96" y="30" width="8" height="14" rx="3" fill="#6b4424"/>`,
    'hat-flower': [0, 1, 2, 3, 4, 5, 6].map((i) => { const x = 60 + i * 13.3, y = 70 - Math.sin((i / 6) * Math.PI) * 10;
      return `<circle cx="${x}" cy="${y}" r="7" fill="#fff"/><circle cx="${x}" cy="${y}" r="3" fill="#f2c14e"/>`; }).join(''),
    'hat-wizard': `<path d="M62 84 L100 4 L138 84 Z" fill="#5b5f97"/><ellipse cx="100" cy="84" rx="52" ry="9" fill="#474a7d"/><text x="92" y="60" font-size="16" fill="#f2c14e">★</text>`,
    'hat-bow': `<path d="M100 66 L72 50 L72 82 Z M100 66 L128 50 L128 82 Z" fill="#e97a9a"/><circle cx="100" cy="66" r="8" fill="#d45f82"/>`,
    'hat-cap': `<path d="M60 80 Q100 36 140 80 Z" fill="#4a9abf"/><path d="M130 78 Q168 78 170 88 L128 86 Z" fill="#3a7fa0"/>`,
    'neck-scarf': `<path d="M50 146 Q100 168 150 146 L150 160 Q100 182 50 160 Z" fill="#d0784f"/><path d="M60 150 L60 164 M80 156 L80 170 M100 158 L100 172 M120 156 L120 170 M140 150 L140 164" stroke="#f2c14e" stroke-width="5"/><rect x="118" y="158" width="14" height="30" rx="4" fill="#d0784f"/>`,
    'neck-bandana': `<path d="M56 146 Q100 166 144 146 L100 184 Z" fill="#c0564b"/><circle cx="92" cy="160" r="2.5" fill="#fff"/><circle cx="108" cy="162" r="2.5" fill="#fff"/><circle cx="100" cy="172" r="2.5" fill="#fff"/>`,
    'neck-bowtie': `<path d="M100 156 L80 146 L80 168 Z M100 156 L120 146 L120 168 Z" fill="#3b3a36"/><circle cx="100" cy="157" r="5" fill="#555"/>`,
    'face-glasses': `<circle cx="82" cy="116" r="13" fill="#ffffff22" stroke="#3b3a36" stroke-width="3"/><circle cx="118" cy="116" r="13" fill="#ffffff22" stroke="#3b3a36" stroke-width="3"/><path d="M95 116 L105 116" stroke="#3b3a36" stroke-width="3"/>`,
    'face-shades': `<rect x="66" y="106" width="30" height="18" rx="7" fill="#2b2b2b"/><rect x="104" y="106" width="30" height="18" rx="7" fill="#2b2b2b"/><path d="M96 112 L104 112" stroke="#2b2b2b" stroke-width="4"/><path d="M72 110 L80 110" stroke="#ffffff66" stroke-width="3"/>`,
    'face-blush': `<ellipse cx="68" cy="132" rx="12" ry="7" fill="#ff8a8a88"/><ellipse cx="132" cy="132" rx="12" ry="7" fill="#ff8a8a88"/>`,
    'event-harvest-scarf': `<path d="M50 146 Q100 168 150 146 L150 160 Q100 182 50 160 Z" fill="#c9782f"/><path d="M50 153 Q100 175 150 153" stroke="#8a4f1c" stroke-width="3" fill="none"/>`,
    'event-lights-hat': `<path d="M58 82 Q100 24 142 82 Z" fill="#c0564b"/><path d="M62 70 Q100 50 138 70" stroke="#fff" stroke-width="5" fill="none"/><rect x="54" y="76" width="92" height="12" rx="6" fill="#fff"/><circle cx="100" cy="28" r="11" fill="#fff"/>`,
    'event-bloom-crown': [0, 1, 2, 3, 4].map((i) => `<circle cx="${66 + i * 17}" cy="${68 - Math.sin((i / 4) * Math.PI) * 8}" r="8" fill="${['#f7b2c4', '#fff', '#f7b2c4', '#fff', '#f7b2c4'][i]}"/>`).join(''),
    'event-picnic-hat': `<ellipse cx="100" cy="80" rx="66" ry="12" fill="#e8c77a"/><path d="M68 80 Q100 36 132 80 Z" fill="#f0d58f"/><rect x="68" y="70" width="64" height="8" fill="#e97a7a"/>`,
  };

  // Tiny companions that sit beside the sprig.
  const COMPANION_ART = {
    snail: `<ellipse cx="22" cy="36" rx="20" ry="6" fill="#c9b27a"/><circle cx="22" cy="24" r="14" fill="#d0784f"/><path d="M22 24 m-8 0 a8 8 0 1 0 8 -8" stroke="#8a4f1c" stroke-width="2.5" fill="none"/><path d="M38 34 L42 18 M42 34 L48 20" stroke="#c9b27a" stroke-width="2.5"/>`,
    ladybird: `<ellipse cx="24" cy="28" rx="16" ry="13" fill="#d94343"/><path d="M24 15 L24 41" stroke="#222" stroke-width="2"/><circle cx="24" cy="15" r="6" fill="#222"/><circle cx="17" cy="26" r="3" fill="#222"/><circle cx="31" cy="30" r="3" fill="#222"/><circle cx="18" cy="35" r="2" fill="#222"/>`,
    frog: `<ellipse cx="24" cy="30" rx="18" ry="12" fill="#6fb35c"/><circle cx="15" cy="18" r="6" fill="#6fb35c"/><circle cx="33" cy="18" r="6" fill="#6fb35c"/><circle cx="15" cy="18" r="3" fill="#222"/><circle cx="33" cy="18" r="3" fill="#222"/><path d="M16 32 q8 5 16 0" stroke="#2f6b25" stroke-width="2" fill="none"/>`,
    firefly: `<ellipse cx="24" cy="30" rx="8" ry="11" fill="#5b5f97"/><circle cx="24" cy="38" r="9" fill="#f7e27a" opacity=".9"/><ellipse cx="14" cy="22" rx="8" ry="5" fill="#ffffffaa"/><ellipse cx="34" cy="22" rx="8" ry="5" fill="#ffffffaa"/>`,
    mushroom: `<rect x="17" y="26" width="14" height="16" rx="5" fill="#f3ead7"/><path d="M4 28 Q24 0 44 28 Z" fill="#d94343"/><circle cx="16" cy="18" r="3" fill="#fff"/><circle cx="30" cy="16" r="3.5" fill="#fff"/>`,
    pebble: `<ellipse cx="24" cy="32" rx="18" ry="11" fill="#a9a39a"/><circle cx="18" cy="30" r="2" fill="#333"/><circle cx="29" cy="30" r="2" fill="#333"/><path d="M20 36 q4 2 8 0" stroke="#333" stroke-width="1.5" fill="none"/>`,
    hedgehog: `<path d="M6 36 Q10 10 30 12 L40 30 Q34 40 6 36 Z" fill="#8a5a33"/><path d="M36 26 Q46 28 44 34 Q40 38 34 34 Z" fill="#e8d2b0"/><circle cx="40" cy="30" r="1.8" fill="#222"/>`,
    robin: `<ellipse cx="22" cy="28" rx="15" ry="13" fill="#8a5a33"/><circle cx="30" cy="30" r="8" fill="#e0633f"/><circle cx="32" cy="22" r="2" fill="#222"/><path d="M36 24 L44 26 L36 28 Z" fill="#e8b33a"/>`,
    bee: `<ellipse cx="24" cy="30" rx="15" ry="11" fill="#f2c14e"/><path d="M18 20 L18 40 M28 20 L28 40" stroke="#222" stroke-width="4"/><ellipse cx="20" cy="16" rx="7" ry="5" fill="#ffffffbb"/><ellipse cx="30" cy="16" rx="7" ry="5" fill="#ffffffbb"/>`,
    butterfly: `<path d="M24 28 Q4 6 8 26 Q4 44 24 30 Q44 44 40 26 Q44 6 24 28 Z" fill="#b597dc"/><rect x="22.5" y="18" width="3" height="20" rx="1.5" fill="#3b3a36"/>`,
  };
  const companion = (id, size = 48) => COMPANION_ART[id]
    ? `<svg viewBox="0 0 48 48" width="${size}" height="${size}" class="companion" aria-label="${id}">${COMPANION_ART[id]}</svg>` : '';
  const STAGE_SCALE = { seedling: 0.72, sprout: 0.82, sapling: 0.9, bloom: 0.97, elder: 1 };

  function leaves(stage, c) {
    const leaf = (x, rot, s = 1) =>
      `<path d="M0 0 C -9 -10 -9 -26 0 -34 C 9 -26 9 -10 0 0 Z" fill="${c.leaf}"
        transform="translate(${x} 58) rotate(${rot}) scale(${s})"/>
       <path d="M0 -2 L0 -28" stroke="#ffffff55" stroke-width="1.5" transform="translate(${x} 58) rotate(${rot}) scale(${s})"/>`;
    const sets = {
      seedling: [leaf(100, 0, 0.7)],
      sprout: [leaf(94, -22, 0.8), leaf(106, 22, 0.8)],
      sapling: [leaf(88, -35, 0.85), leaf(100, 0, 0.95), leaf(112, 35, 0.85)],
      bloom: [leaf(86, -40, 0.85), leaf(114, 40, 0.85)],
      elder: [leaf(80, -55, 0.8), leaf(90, -25, 0.9), leaf(110, 25, 0.9), leaf(120, 55, 0.8)],
    };
    let out = `<path d="M100 60 Q 100 48 100 40" stroke="${c.leaf}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
    out += (sets[stage] || sets.seedling).join('');
    if (stage === 'bloom' || stage === 'elder') {
      const petal = (r) => `<ellipse cx="100" cy="22" rx="6" ry="11" fill="#fff4d6" transform="rotate(${r} 100 32)"/>`;
      out += [0, 72, 144, 216, 288].map(petal).join('') + `<circle cx="100" cy="32" r="5.5" fill="#f2b84b"/>`;
    }
    return out;
  }

  function face(mood) {
    const eyes = mood === 'sleepy'
      ? `<path d="M76 118 q6 5 12 0 M112 118 q6 5 12 0" stroke="#3b3a36" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<g class="sprig-eyes"><ellipse cx="82" cy="116" rx="5.5" ry="7" fill="#3b3a36"/><ellipse cx="118" cy="116" rx="5.5" ry="7" fill="#3b3a36"/>
         <circle cx="84" cy="113" r="2" fill="#fff"/><circle cx="120" cy="113" r="2" fill="#fff"/></g>`;
    const mouths = {
      happy: `<path d="M90 132 q10 10 20 0" stroke="#3b3a36" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      calm: `<path d="M92 134 q8 5 16 0" stroke="#3b3a36" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      sleepy: `<ellipse cx="100" cy="134" rx="4" ry="3" fill="#3b3a36"/>`,
      excited: `<path d="M88 130 q12 16 24 0 z" fill="#3b3a36"/><path d="M94 136 q6 5 12 0" fill="#e97a7a"/>`,
    };
    return `${eyes}<ellipse cx="70" cy="130" rx="8" ry="5" fill="#ff9c9c66"/><ellipse cx="130" cy="130" rx="8" ry="5" fill="#ff9c9c66"/>
            ${mouths[mood] || mouths.happy}`;
  }

  /** opts: {colour, stage, mood: happy|calm|sleepy|excited, size, equipped: {hat, neck, face, colour}} */
  function sprig(opts = {}) {
    const eq = opts.equipped || {};
    const c = PALETTE[COLOUR_ITEMS[eq.colour]] || PALETTE[opts.colour] || PALETTE.moss;
    const stage = opts.stage || 'seedling';
    const s = STAGE_SCALE[stage] || 0.8;
    return `<svg class="sprig" viewBox="0 0 200 200" width="${opts.size || 200}" height="${opts.size || 200}" role="img"
      aria-label="Your sprig, a small round moss creature">
      <ellipse cx="100" cy="186" rx="${52 * s}" ry="8" fill="#00000014"/>
      <g class="sprig-body" transform="translate(${100 - 100 * s} ${200 - 200 * s}) scale(${s})">
        ${eq.hat && !['hat-flower', 'hat-bow', 'event-bloom-crown'].includes(eq.hat) ? '' : leaves(stage, c)}
        <path d="M100 58 C 150 58 170 100 168 138 C 166 172 136 184 100 184 C 64 184 34 172 32 138 C 30 100 50 58 100 58 Z" fill="${c.body}"/>
        <path d="M44 150 C 50 172 72 182 100 182 C 128 182 150 172 156 150 C 140 166 60 166 44 150 Z" fill="${c.shade}"/>
        <ellipse cx="72" cy="86" rx="14" ry="8" fill="#ffffff44" transform="rotate(-25 72 86)"/>
        ${face(opts.mood)}
        <ellipse cx="66" cy="182" rx="12" ry="6" fill="${c.shade}"/><ellipse cx="134" cy="182" rx="12" ry="6" fill="${c.shade}"/>
        ${WEAR[eq.neck] || ''}${WEAR[eq.face] || ''}${WEAR[eq.hat] || ''}
      </g></svg>`;
  }

  function egg(colour, size = 140) {
    const c = PALETTE[colour] || PALETTE.moss;
    return `<svg class="egg" viewBox="0 0 120 150" width="${size}" height="${size * 1.25}" role="img" aria-label="${colour} egg">
      <ellipse cx="60" cy="142" rx="34" ry="6" fill="#00000014"/>
      <path d="M60 8 C 92 8 108 60 108 92 C 108 124 88 140 60 140 C 32 140 12 124 12 92 C 12 60 28 8 60 8 Z" fill="${c.body}"/>
      <circle cx="42" cy="60" r="7" fill="${c.shade}"/><circle cx="76" cy="44" r="5" fill="${c.shade}"/>
      <circle cx="80" cy="96" r="9" fill="${c.shade}"/><circle cx="38" cy="108" r="5" fill="${c.shade}"/>
      <ellipse cx="44" cy="36" rx="9" ry="5" fill="#ffffff55" transform="rotate(-30 44 36)"/></svg>`;
  }

  /** A small preview of one item (outfit on a plain sprig, a colour swatch, or furniture). */
  function itemPreview(it, size = 72) {
    if (it.type === 'colour') { const c = PALETTE[COLOUR_ITEMS[it.id]]; return `<svg viewBox="0 0 40 40" width="${size * 0.7}" height="${size * 0.7}"><circle cx="20" cy="20" r="18" fill="${c.body}"/><circle cx="26" cy="26" r="8" fill="${c.shade}"/></svg>`; }
    if (it.type === 'furniture') return window.Room ? Room.furniturePreview(it.id, size) : '';
    return sprig({ colour: 'cream', stage: 'sprout', mood: 'calm', size, equipped: { [it.type]: it.id } });
  }

  window.Sprig = { sprig, egg, companion, itemPreview, PALETTE, COLOUR_ITEMS };
})();
