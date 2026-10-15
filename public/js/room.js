/* The sprig's home: a little room with furniture slots. All art original, drawn as SVG. */
(function () {
  // Each piece is drawn in its own box; `at` places it in the 360×250 room.
  const ART = {
    'rug-round': { at: [90, 196, 180, 44], svg: `<ellipse cx="90" cy="22" rx="88" ry="20" fill="#d9a066"/><ellipse cx="90" cy="22" rx="66" ry="14" fill="#e8bb86"/><ellipse cx="90" cy="22" rx="40" ry="8" fill="#d9a066"/>` },
    'rug-stripe': { at: [80, 198, 200, 40], svg: `<rect x="0" y="4" width="200" height="34" rx="6" fill="#8ec5e0"/><rect x="0" y="12" width="200" height="6" fill="#fff"/><rect x="0" y="24" width="200" height="6" fill="#fff"/>` },
    'event-picnic-rug': { at: [80, 198, 200, 40], svg: `<rect x="0" y="4" width="200" height="34" rx="4" fill="#fff"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<rect x="${i * 20}" y="4" width="10" height="34" fill="#e97a7a" opacity=".7"/>`).join('')}<rect x="0" y="16" width="200" height="10" fill="#e97a7a" opacity=".5"/>` },
    'plant-monstera': { at: [14, 120, 70, 110], svg: `<rect x="18" y="74" width="34" height="34" rx="5" fill="#c9774d"/>${[[35, 60, -30], [20, 40, -60], [48, 36, 40], [30, 20, 0], [55, 58, 60]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="15" ry="22" fill="#4f8f5c" transform="rotate(${r} ${x} ${y})"/>`).join('')}` },
    'lamp-floor': { at: [26, 88, 60, 140], svg: `<rect x="28" y="30" width="4" height="100" fill="#6b5a45"/><ellipse cx="30" cy="132" rx="18" ry="5" fill="#6b5a45"/><path d="M8 34 L18 4 L42 4 L52 34 Z" fill="#f5da7e"/><ellipse cx="30" cy="36" rx="30" ry="10" fill="#f5da7e44"/>` },
    'event-lights-lantern': { at: [26, 110, 60, 110], svg: `<rect x="29" y="0" width="2" height="30" fill="#6b5a45"/><ellipse cx="30" cy="56" rx="26" ry="28" fill="#e05a4f"/><path d="M8 50 Q30 58 52 50 M8 62 Q30 70 52 62" stroke="#f5b0a8" stroke-width="2" fill="none"/><ellipse cx="30" cy="56" rx="26" ry="28" fill="#fff3" />` },
    'shelf-books': { at: [270, 104, 76, 126], svg: `<rect x="2" y="0" width="72" height="124" rx="4" fill="#9a6b43"/><rect x="8" y="6" width="60" height="112" fill="#7d5635"/>${[8, 44, 80].map((y) => `<rect x="8" y="${y + 32}" width="60" height="4" fill="#9a6b43"/>` + [0, 1, 2, 3, 4].map((i) => `<rect x="${11 + i * 11}" y="${y + 6 + (i % 2) * 4}" width="9" height="${26 - (i % 2) * 4}" fill="${['#d0784f', '#4a9abf', '#f2c14e', '#6f9f5c', '#b597dc'][i]}"/>`).join('')).join('')}` },
    'chair-bean': { at: [262, 168, 86, 64], svg: `<path d="M6 60 Q0 20 40 12 Q84 8 82 58 Z" fill="#6f9f5c"/><path d="M20 30 Q40 22 64 30" stroke="#5f8a4e" stroke-width="3" fill="none"/>` },
    'event-harvest-pumpkin': { at: [286, 186, 56, 48], svg: `<ellipse cx="28" cy="30" rx="26" ry="18" fill="#e8892f"/><ellipse cx="28" cy="30" rx="10" ry="18" fill="#f09a44"/><rect x="25" y="6" width="6" height="10" rx="2" fill="#5f7a3a"/>` },
    'event-bloom-pots': { at: [276, 176, 72, 58], svg: `${[6, 30, 52].map((x) => `<rect x="${x}" y="34" width="16" height="20" rx="3" fill="#c9774d"/><path d="M${x + 8} 34 L${x + 8} 18" stroke="#4f8f5c" stroke-width="2"/><ellipse cx="${x + 4}" cy="20" rx="5" ry="3" fill="#6fb35c"/><ellipse cx="${x + 12}" cy="16" rx="5" ry="3" fill="#6fb35c"/>`).join('')}` },
    'art-sun': { at: [236, 30, 64, 52], svg: `<rect x="0" y="0" width="64" height="52" rx="3" fill="#9a6b43"/><rect x="5" y="5" width="54" height="42" fill="#fdf1d6"/><circle cx="32" cy="26" r="10" fill="#f2c14e"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((r) => `<rect x="31" y="6" width="2" height="7" fill="#f2c14e" transform="rotate(${r} 32 26)"/>`).join('')}` },
    'art-map': { at: [226, 28, 84, 58], svg: `<rect x="0" y="0" width="84" height="58" rx="3" fill="#e8d2b0"/><path d="M10 44 Q26 20 42 34 T74 14" stroke="#c0564b" stroke-width="2.5" stroke-dasharray="4 4" fill="none"/><text x="66" y="20" font-size="14" fill="#c0564b">✕</text><circle cx="14" cy="44" r="4" fill="#6f9f5c"/>` },
    'window-round': { at: [44, 24, 76, 76], svg: `<circle cx="38" cy="38" r="36" fill="#9a6b43"/><circle cx="38" cy="38" r="30" fill="#bfe3f2"/><circle cx="50" cy="26" r="7" fill="#fff8d6"/><path d="M8 38 L68 38 M38 8 L38 68" stroke="#9a6b43" stroke-width="4"/>` },
    'lights-fairy': { at: [10, 0, 340, 40], svg: `<path d="M0 6 Q85 34 170 10 Q255 34 340 6" stroke="#6b5a45" stroke-width="1.5" fill="none"/>${Array.from({ length: 13 }, (_, i) => { const x = 12 + i * 26; const y = 8 + Math.abs(Math.sin((i / 12) * Math.PI * 2)) * 18; return `<circle cx="${x}" cy="${y}" r="4.5" fill="${['#f7e27a', '#f7b2c4', '#bfe3f2'][i % 3]}"/>`; }).join('')}` },
    'mobile-stars': { at: [150, 0, 60, 60], svg: `<path d="M30 0 L30 14 M8 14 L52 14 M8 14 L8 30 M52 14 L52 38 M30 14 L30 46" stroke="#6b5a45" stroke-width="1.5"/><text x="1" y="42" font-size="15" fill="#f2c14e">★</text><text x="45" y="52" font-size="15" fill="#f2c14e">★</text><text x="23" y="60" font-size="15" fill="#f2c14e">★</text>` },
    'furn-tall-books': { at: [272, 96, 74, 134], svg: `${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${6 + (i % 2) * 6}" y="${118 - i * 14}" width="${58 - (i % 3) * 6}" height="12" rx="2" fill="${['#d0784f', '#4a9abf', '#f2c14e', '#6f9f5c', '#b597dc', '#e97a9a'][i % 6]}"/><rect x="${10 + (i % 2) * 6}" y="${121 - i * 14}" width="${20}" height="2" fill="#fff8"/>`).join('')}<text x="22" y="2" font-size="16">⭐</text>` },
    'furn-piggy': { at: [20, 168, 70, 62], svg: `<ellipse cx="36" cy="36" rx="30" ry="22" fill="#f2a7b8"/><ellipse cx="62" cy="34" rx="8" ry="7" fill="#e88aa0"/><circle cx="60" cy="33" r="1.6" fill="#a8465c"/><circle cx="64" cy="33" r="1.6" fill="#a8465c"/><circle cx="48" cy="26" r="2.4" fill="#3b3a36"/><path d="M28 14 L34 22 L22 22 Z" fill="#e88aa0"/><rect x="26" y="15" width="16" height="3" rx="1.5" fill="#a8465c"/><rect x="14" y="52" width="8" height="10" rx="3" fill="#e88aa0"/><rect x="44" y="52" width="8" height="10" rx="3" fill="#e88aa0"/><text x="22" y="44" font-size="14" fill="#a8465c">£</text>` },
    'furn-trophy': { at: [232, 26, 92, 62], svg: `<rect x="0" y="52" width="92" height="8" rx="2" fill="#9a6b43"/><path d="M30 8 L62 8 L58 30 Q46 42 34 30 Z" fill="#f2c14e"/><path d="M30 12 Q16 14 22 26 Q26 30 32 28 M62 12 Q76 14 70 26 Q66 30 60 28" stroke="#e0a92e" stroke-width="3" fill="none"/><rect x="42" y="36" width="8" height="10" fill="#e0a92e"/><rect x="34" y="44" width="24" height="8" rx="2" fill="#c98f1c"/><text x="40" y="26" font-size="12" fill="#fff">£</text>` },
  };

  function piece(id) {
    const a = ART[id];
    if (!a) return '';
    const [x, y, w, h] = a.at;
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible">${a.svg}</svg>`;
  }

  /** home = {slot: itemId}; sprigSvg = Sprig.sprig({size:150}); companionSvg = Sprig.companion(id, 44). */
  function room(home = {}, sprigSvg = '', companionSvg = '', { width = '100%' } = {}) {
    const order = ['window', 'wall', 'ceiling', 'rug', 'floorL', 'floorR'];
    return `<svg class="room" viewBox="0 0 360 250" width="${width}" role="img" aria-label="Your sprig's home">
      <rect width="360" height="250" fill="#f3e3cc"/>
      <rect y="0" width="360" height="176" fill="#f6ead7"/>
      <path d="M0 176 L360 176 L360 250 L0 250 Z" fill="#dcc3a0"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${i * 72} 176 L${i * 72 - 40} 250" stroke="#cdb28c" stroke-width="1.5"/>`).join('')}
      <rect y="170" width="360" height="8" fill="#cfb38d"/>
      ${order.map((sl) => (home[sl] ? piece(home[sl]) : '')).join('')}
      <g transform="translate(105 78)"><g class="bob">${sprigSvg}</g></g>
      ${companionSvg ? `<g transform="translate(246 196)"><g class="hop">${companionSvg}</g></g>` : ''}
    </svg>`;
  }

  function furniturePreview(id, size = 72) {
    const a = ART[id];
    if (!a) return '';
    const [, , w, h] = a.at;
    return `<svg viewBox="0 0 ${w} ${h}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet">${a.svg}</svg>`;
  }

  window.Room = { room, furniturePreview };
})();
