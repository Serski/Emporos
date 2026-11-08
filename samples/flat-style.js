// Emporos in its own side view, with eBoy's tricks: every object outlined in black, flat bright colours, no gradients,
// houses as little blocks that show a front, a side and a roof, flat water with drawn ripples, and a picture packed full.
// tools/build-iso-preview.mjs flat-style game-2d bakes this into samples/game-2d.html, a copy of the game drawn this way.
(() => {
'use strict';
const INK = '#16141c', WATER = '#3cbcee';
const pm = (a, n) => ((a % n) + n) % n;
const dk = (c, k) => mix(c, '#2a2850', k), lt = (c, k) => mix(c, '#ffffff', k);
const RGB = new Map();
const rgb = c => { let v = RGB.get(c); if (!v) { const n = parseInt(c.slice(1), 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; RGB.set(c, v); } return v; };
const rnd = (a, b) => hash(a * 12.9898 + b * 78.233);

// ---------- a painter that remembers which object each pixel belongs to, and outlines each object against whatever lies behind it ----------
function Painter(W, H) {
  const N = W * H, rgba = new Uint8ClampedArray(N * 4), ord = new Int32Array(N), ids = new Int32Array(N);
  let id = 0, order = 0, next = 1;
  const p = {
    W, H, rgba, ids,
    obj() { id = next++; order++; return id; },
    bg() { id = 0; order = 0; },
    px(x, y, c) {
      x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x, v = rgb(c); rgba[i * 4] = v[0]; rgba[i * 4 + 1] = v[1]; rgba[i * 4 + 2] = v[2]; rgba[i * 4 + 3] = 255; ord[i] = order; ids[i] = id;
    },
    rect(x, y, w, h, c) { x = Math.round(x); y = Math.round(y); for (let yy = y; yy < y + Math.round(h); yy++) for (let xx = x; xx < x + Math.round(w); xx++) p.px(xx, yy, c); },
    hl(x0, x1, y, c) { for (let x = Math.round(x0); x <= Math.round(x1); x++) p.px(x, y, c); },
    vl(x, y0, y1, c) { for (let y = Math.round(y0); y <= Math.round(y1); y++) p.px(x, y, c); },
    line(x0, y0, x1, y1, c) { const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) p.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); },
    disc(cx, cy, r, c) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) p.px(cx + x, cy + y, c); },
    spr(sp, x, y, flip) { for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) { const s = (j * sp.w + (flip ? sp.w - 1 - i : i)) * 4; if (sp.data[s + 3]) p.px(x + i, y + j, '#' + ((1 << 24) | (sp.data[s] << 16) | (sp.data[s + 1] << 8) | sp.data[s + 2]).toString(16).slice(1)); } },
    outline() {
      const mark = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, me = ids[i], o = ord[i];
        const f = j => ids[j] && ids[j] !== me && ord[j] > o;
        if ((x + 1 < W && f(i + 1)) || (x > 0 && f(i - 1)) || (y + 1 < H && f(i + W)) || (y > 0 && f(i - W))) mark.push(i);
      }
      for (const i of mark) { rgba[i * 4] = 22; rgba[i * 4 + 1] = 20; rgba[i * 4 + 2] = 28; rgba[i * 4 + 3] = 255; }
    },
    sprite() { p.outline(); return { w: W, h: H, data: rgba }; },
  };
  return p;
}
const build = (w, h, f) => { const p = Painter(w, h); f(p); return p.sprite(); };

// ---------- blocks: a front, a side going back up and to the right, and a top ----------
function block(p, x, y, w, h, d, wall, top, o) {   // (x, y) is the bottom-left corner of the front
  o = o || {}; p.obj();
  const side = o.side || dk(wall, 0.3);
  for (let k = 1; k <= d; k++) p.vl(x + w - 1 + k, y - h + 1 - k, y - k, side);
  p.rect(x, y - h + 1, w, h, wall);
  for (let k = 1; k <= d; k++) p.hl(x + k, x + w - 1 + k, y - h + 1 - k, typeof top === 'function' ? top(k) : top);
}
function house(p, x, y, w, h, d, o) {   // a town house: windows, a door, a flat terrace or a tiled roof, now and then an awning or a pot of basil
  const roof = o.tile ? (k => k % 2 ? '#ee6a3a' : '#d2552e') : (k => k === d ? lt(o.wall, 0.4) : lt(o.wall, 0.15));
  block(p, x, y, w, h, d, o.wall, roof);
  if (o.tile) p.hl(x - 1, x + w, y - h + 1, '#b8482a');
  for (let yy = y - h + 3; yy < y - 3; yy += 4) for (let xx = x + 1 + (w % 3 === 0 ? 1 : 0); xx < x + w - 2; xx += 3) if (rnd(xx * 3 + o.seed, yy) < 0.72) { p.rect(xx, yy, 2, 2, '#2a3050'); p.px(xx, yy, '#3a4a78'); }
  const dx = x + Math.max(1, Math.floor(w / 2) - 1);
  p.rect(dx, y - 3, 2, 3, o.door);
  if (o.awning) for (let xx = dx - 2; xx <= dx + 3; xx++) { p.px(xx, y - 5, (xx - dx) % 2 ? '#fffaf0' : o.awning); p.px(xx, y - 4, (xx - dx) % 2 ? '#fffaf0' : o.awning); }
  if (!o.tile && o.pot) { p.px(x + 2 + d, y - h - d + 1, '#e8763a'); p.px(x + 2 + d, y - h - d, '#5ab84a'); p.px(x + 3 + d, y - h - d, '#5ab84a'); }
}
function cypress(p, x, y, h) { p.obj(); for (let j = 0; j < h; j++) { const w = j < 2 || j > h - 3 ? 1 : 2; p.hl(x - w + 1, x + w - 1 + (j % 3 === 0 ? 1 : 0), y - j, j % 2 ? '#2e8a4a' : '#3a9a52'); } }
function olive(p, x, y) { p.obj(); p.vl(x, y - 2, y, '#8a5a32'); for (const [dx, dy, r] of [[0, -5, 3], [-2, -4, 2], [2, -4, 2]]) p.disc(x + dx, y + dy, r, (dx + dy) % 2 ? '#7aa848' : '#9ac060'); p.px(x - 1, y - 6, '#b8d878'); }

// ---------- people ----------
const PERSON = {
  stand: ['..KKK..', '.KhhhK.', '.KhssK.', '.KsseK.', '..KsK..', '.KrrrK.', 'KsrrrsK', 'KsRrRsK', '.KrrrK.', '.KrRrK.', '.KsKsK.', '.KsKsK.', '.KK.KK.'],
  step: ['..KKK..', '.KhhhK.', '.KhssK.', '.KsseK.', '..KsK..', '.KrrrK.', 'KsrrrsK', 'KsRrRsK', '.KrrrK.', '.KrRrK.', '..KsK..', '..KsK..', '..KKK..'],
};
function sprite(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length)), data = new Uint8ClampedArray(w * h * 4);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.' || !pal[ch]) return; const v = rgb(pal[ch]), i = (y * w + x) * 4; data[i] = v[0]; data[i + 1] = v[1]; data[i + 2] = v[2]; data[i + 3] = 255; }));
  return { w, h, data };
}
function person(L, frame, carry) {
  let rows = PERSON[frame].map(r => r.split(''));
  const veil = L.style === 'veil', long = L.style === 'long';
  if (veil || long) { rows[10] = '.KrrrK.'.split(''); rows[11] = 'KrRrRrK'.split(''); rows[12] = '.KKKKK.'.split(''); }
  if (veil) { rows[1] = '.KvvvK.'.split(''); rows[2] = '.KvssK.'.split(''); rows[3] = '.KvseK.'.split(''); rows[4] = '.KvsK..'.split(''); }
  if (long) { rows[3][2] = 'h'; rows[4] = '.KhsK..'.split(''); }
  if (L.style === 'bald') rows[1] = '.KsssK.'.split('');
  if (L.beard) { rows[4] = '..KbK..'.split(''); rows[3][3] = 'b'; }
  if (L.hat === 'pilos') { rows.unshift('..KxK..'.split('')); rows[1] = '.KxxxK.'.split(''); }
  if (L.hat === 'petasos') { rows[0] = 'KKKKKKK'.split(''); rows[1] = 'KxxxxxK'.split(''); }
  if (carry === 'amphora') { rows = rows.map(r => r.concat(['.', '.', '.'])); for (const [j, s] of [[0, 'KKK'], [1, 'KaaK'], [2, 'KaaaK'], [3, 'KaaK'], [4, '.KK']]) for (let i = 0; i < s.length; i++) if (s[i] !== '.') rows[j + 4][4 + i] = s[i]; }
  if (carry === 'basket') rows.unshift('.KKKKK.'.split(''), 'KwwwwwK'.split(''));
  if (carry === 'sack') rows.unshift('.KKKK..'.split(''), 'KccccK.'.split(''));
  return sprite(rows.map(r => r.join('')), { K: INK, h: L.hair, s: L.skin, e: INK, r: L.robe, R: mix(L.robe, '#2a2850', 0.25), v: L.veil || L.hair, b: L.hair, a: '#e8763a', w: '#c89a52', c: '#f0d8a0', x: L.hatC || '#c8925a' });
}
const SKINS = ['#c88a58', '#d8985e', '#e8b07a', '#f0b888', '#a86a42', '#b87a4a'];
const HAIRS = ['#1b130e', '#2a1d14', '#3a281c', '#5a3a22', '#7a4a22', '#e8e8e8', '#24180f'];
const ROBES = ['#e8d8b8', '#f4ead4', '#3a8ad8', '#e8483a', '#ffcc6a', '#6a9a3a', '#c8324a', '#8a6a4a', '#ffffff', '#e8a03a', '#5ab8c8', '#a85ab8', '#ff8a6a', '#4a6ac8'];
const VEILS = ['#ffffff', '#ffd040', '#3a8ad8', '#e8483a', '#5ab84a', '#ff9ab8'];
function look(k) {
  const R = j => hash(k * 7.31 + j * 1.73), style = ['short', 'short', 'veil', 'long', 'curly', 'bald', 'short', 'veil'][Math.floor(R(1) * 8)];
  return { skin: SKINS[Math.floor(R(2) * SKINS.length)], hair: HAIRS[Math.floor(R(3) * HAIRS.length)], robe: ROBES[Math.floor(R(4) * ROBES.length)], style, veil: VEILS[Math.floor(R(5) * VEILS.length)],
    beard: style === 'veil' || style === 'long' ? 0 : R(6) < 0.4 ? 1 + (R(7) < 0.5 ? 1 : 0) : 0, hat: style === 'veil' ? null : R(8) < 0.12 ? 'petasos' : R(8) < 0.18 ? 'pilos' : null };
}
const FOLK = new Map();
function folk(k, carry) { const key = k + ':' + carry; let f = FOLK.get(key); if (!f) { const L = look(k); f = [person(L, 'stand', carry), person(L, 'step', carry)]; FOLK.set(key, f); } return f; }
function trader(L) {   // a stall-keeper, bigger than the crowd: face, hair or veil, a beard, hands down at the sides
  return build(15, 23, p => {
    const skin = L.skin, hair = L.hair, robe = L.robe, trim = L.trim || lt(robe, 0.45);
    p.obj(); for (let y = 12; y < 23; y++) { const s = y < 14 ? 4 : 3; p.hl(s, 14 - s, y, robe); } p.vl(5, 14, 22, dk(robe, 0.25)); p.vl(9, 14, 22, dk(robe, 0.25)); p.hl(6, 8, 12, trim); p.px(7, 13, trim);
    p.obj(); for (const x of [2, 12]) { p.vl(x, 13, 19, robe); p.vl(x, 20, 21, skin); }
    p.obj(); for (let y = 3; y < 12; y++) p.hl(4, 10, y, skin); p.hl(5, 9, 12, skin);
    p.px(5, 7, INK); p.px(9, 7, INK); p.px(6, 7, '#ffffff'); p.px(8, 7, '#ffffff'); p.hl(6, 8, 10, dk(skin, 0.3));
    if (L.style === 'veil') { const v = L.veil || hair; for (let y = 1; y < 13; y++) { p.px(3, y, v); p.px(11, y, v); if (y > 9) { p.px(2, y + 1, v); p.px(12, y + 1, v); } } p.hl(4, 10, 1, v); p.hl(3, 11, 2, v); p.hl(4, 10, 3, v); }
    else if (L.style !== 'bald') { p.hl(4, 10, 2, hair); p.hl(3, 11, 3, hair); p.px(3, 4, hair); p.px(11, 4, hair); if (L.style === 'curly') for (let x = 4; x <= 10; x += 2) p.px(x, 1, hair); if (L.style === 'long') for (let y = 4; y < 13; y++) { p.px(3, y, hair); p.px(11, y, hair); } }
    else p.hl(5, 9, 3, lt(skin, 0.15));
    if (L.beard) { for (let y = L.beard > 1 ? 9 : 10; y < 13; y++) p.hl(5, 9, y, hair); p.hl(6, 8, 10, dk(skin, 0.4)); }
    if (L.hat === 'pilos') { p.obj(); p.hl(4, 10, 2, '#c8925a'); p.hl(5, 9, 1, '#c8925a'); p.hl(6, 8, 0, '#c8925a'); }
    if (L.hat === 'petasos') { p.obj(); p.hl(1, 13, 3, '#c8925a'); p.hl(4, 10, 2, '#b07a4a'); p.hl(5, 9, 1, '#b07a4a'); }
  });
}

// ---------- ships seen from the side ----------
const SHIPS2 = {
  elpis: { L: 38, fb: 5, mast: 26, yw: 13, hull: '#7a4a2a', band: '#e8483a' },
  tyche: { L: 46, fb: 6, mast: 30, yw: 15, hull: '#6a4022', band: '#3a8ad8', cabin: true },
  grain: { L: 56, fb: 8, mast: 36, yw: 18, hull: '#5a3620', band: '#ffd040', cabin: true, fore: true, swan: true },
  merchant: { L: 42, fb: 6, mast: 28, yw: 14, hull: '#6a4a3a', band: '#5ab84a' },
  merchant2: { L: 34, fb: 5, mast: 24, yw: 12, hull: '#7a5a3a', band: '#ff7ab0' },
  tri: { L: 52, fb: 4, mast: 20, yw: 12, hull: '#3a3440', band: '#e8483a', oars: true, ram: true },
};
const kindOf = () => S && S.hull === 'large' ? 'grain' : S && bigShip(S) ? 'tyche' : 'elpis';
// x is the stern end, wl the waterline. Draws sail, crew, then hull, so the bulwark hides the crew's legs.
function sideShip(p, x, wl, P, o) {
  o = o || {};
  const L = P.L, fb = P.fb, mx = x + Math.round(L * 0.5), top = wl - fb, mtop = top - P.mast, sail = o.sail || 'furled';
  const rise = i => i < 6 ? Math.round((6 - i) * 0.9) : i > L - 6 ? Math.round((i - (L - 6)) * 0.8) : 0;
  p.obj(); p.vl(mx, mtop, top, '#5a3a20'); p.hl(mx - P.yw, mx + P.yw, mtop + 1, '#8a5a32');
  if (P.fore) { for (let k = 0; k < 12; k++) p.px(x + L - 6 + Math.floor(k * 0.6), top - k, '#5a3a20'); }
  if (sail === 'furled') { p.obj(); p.hl(mx - P.yw + 1, mx + P.yw - 1, mtop + 2, '#fffaf0'); p.hl(mx - P.yw + 2, mx + P.yw - 2, mtop + 3, '#e8dcc0'); }
  else if (sail !== 'none') {
    p.obj();
    const bot = sail === 'reef' ? mtop + Math.round(P.mast * 0.35) : top - 3;
    for (let y = mtop + 2; y <= bot; y++) {
      const k = (y - mtop) / Math.max(1, bot - mtop), belly = sail === 'full' ? Math.round(Math.sin(k * Math.PI) * 2) : 0, pull = sail === 'slack' ? Math.round(k * 3) : 0;
      const a = mx - P.yw + 1 + pull, b = mx + P.yw - 1 + belly - pull;
      p.hl(a, b, y, '#fffaf0'); p.px(b, y, '#e8dcc0'); for (let xx = a + 3; xx < b - 1; xx += 4) p.px(xx, y, '#f0e4cc');
      if (sail === 'slack' && y % 4 === 0) p.hl(a + 2, b - 3, y, '#e8dcc0');
    }
    if (sail !== 'reef' && o.rose !== false) { const ry = mtop + Math.round((bot - mtop) * 0.45); p.rect(mx - 1, ry - 1, 3, 3, '#d83a36'); p.px(mx - 2, ry, '#d83a36'); p.px(mx + 2, ry, '#d83a36'); p.px(mx, ry - 2, '#d83a36'); p.px(mx, ry, '#8a1e22'); p.px(mx, ry + 2, '#4aa83a'); p.px(mx + 1, ry + 3, '#4aa83a'); }
    if (o.stripe) for (let y = mtop + 4; y <= bot; y += 5) p.hl(mx - P.yw + 2, mx + P.yw - 2, y, '#e8483a');
    if (P.fore && sail !== 'reef') for (let y = top - 11; y < top - 5; y++) p.hl(x + L - 1, x + L + 4 - Math.floor((y - top + 11) / 2), y, '#fffaf0');
  }
  const crew = o.crew || [];
  crew.forEach((sp, i) => { p.obj(); p.spr(sp, x + 6 + Math.round(i * (L - 14) / Math.max(1, crew.length - 1)) - 3, top - sp.h + 5, i % 2 === 1); });
  if (P.cabin) block(p, x + 3, top, 10, 6, 3, '#c88a4e', '#8a5a32');
  p.obj();
  for (let i = 0; i <= L; i++) {
    const t0 = top - rise(i), bt = wl + 2 - (i < 2 || i > L - 2 ? 1 : 0);
    p.vl(x + i, t0, bt, P.hull); p.px(x + i, t0, lt(P.hull, 0.3)); p.px(x + i, t0 + 1, P.band); p.px(x + i, t0 + 2, P.band); p.px(x + i, wl + 1, dk(P.hull, 0.45)); if (bt >= wl + 2) p.px(x + i, wl + 2, dk(P.hull, 0.55));
  }
  const neck = P.swan ? [[0, -7], [-1, -8], [-1, -9], [-1, -10], [0, -11], [1, -11], [2, -10]] : [[0, -7], [-1, -8], [-1, -9], [0, -10], [1, -10]];
  neck.forEach(([dx, dy], i) => p.px(x + dx, top + dy + 1, P.swan && i >= neck.length - 2 ? '#ffffff' : P.hull));
  p.px(x + L + 1, top - 4, P.hull); p.px(x + L + 1, top - 5, P.hull);
  p.px(x + L - 4, top + 2, '#ffffff'); p.px(x + L - 5, top + 2, '#ffffff'); p.px(x + L - 4, top + 2, INK);
  if (P.ram) { p.hl(x + L + 1, x + L + 4, wl + 1, '#ffb44a'); p.hl(x + L + 1, x + L + 3, wl, '#ffb44a'); }
  if (o.row || P.oars) for (let k = 0; k < (P.oars ? 10 : 5); k++) { const ox = x + 8 + k * Math.floor((L - 16) / (P.oars ? 10 : 5)), d = o.ph ? -2 : 2; p.line(ox, top + 3, ox - 3 + d, wl + 4, '#8a5a32'); }
  if (o.cargo) for (let k = 0; k < 4; k++) { p.obj(); p.rect(mx + 3 + k * 3, top - 3, 2, 3, o.cargo); }
  return { mtop, mx, top, bow: [x + L + 1, top - 5], stern: [x - 1, top - 9], yard: [mx - P.yw, mx + P.yw, mtop + 1] };
}
function boatSprite(kind, c) {   // small boats about the harbour, built once each
  return build(26, 22, p => {
    if (kind === 'sail') { p.obj(); p.vl(12, 3, 16, '#5a3a20'); p.obj(); for (let y = 4; y <= 14; y++) p.hl(13, 13 + Math.floor((y - 3) * 0.8), y, y % 4 === 0 ? c : '#fffaf0'); }
    p.obj(); for (let i = 0; i <= 18; i++) { const t0 = 16 - (i < 3 ? 3 - i : i > 15 ? i - 15 : 0); p.vl(3 + i, t0, 19 - (i < 1 || i > 17 ? 1 : 0), c); p.px(3 + i, t0, '#d8a060'); p.px(3 + i, 19, dk(c, 0.45)); }
  });
}

// ---------- Rhodes, from the quay ----------
const R2 = { key: null };
function layout(W, H) {
  const tall = H > W * 0.9, stallH = 44, qh = tall ? 26 : 20, qy = H - stallH - qh;
  const hz = Math.round(Math.min(H * (tall ? 0.42 : 0.4), qy - 56)), hh = Math.round(H * (tall ? 0.26 : 0.3));
  const hillY = x => { const k = x / (W * 0.62); return Math.round(hz + 4 - hh * (1 - smooth(0.12, 1, k))); };
  return { tall, stallH, qh, qy, hz, hh, hillY };
}
function paintRhodes(W, H, stage, kind, ids, pal) {
  const p = Painter(W, H), Lo = layout(W, H), { qy, hz, hh, hillY } = Lo, cityR = Math.round(W * 0.62);
  // sky, flat, in two bands; the sun; the far coast of Asia with its own white towns
  p.bg(); p.rect(0, 0, W, hz, mix(pal.skyTop, pal.skyBot, 0.45)); p.rect(0, Math.round(hz * 0.55), W, hz, mix(pal.skyTop, pal.skyBot, 0.8));
  const far = mix(pal.far, '#8ab0c8', 0.3);
  for (let x = 0; x < W; x++) { const y = Math.round(hz - 2 - Math.max(3, hz * 0.2) * fbm((x + 40) / 26, 3)); p.vl(x, y, hz, far); if (x % 23 === 5) { p.rect(x, y + 2, 2, 2, lt(far, 0.5)); } }
  p.obj(); p.disc(Math.round(W * 0.84), Math.round(hz * 0.3), 5, pal.sun);
  // the sea of the harbour, one flat colour
  p.bg(); p.rect(0, hz, W, qy - hz + 2, WATER);
  // the hill of the town
  p.obj(); for (let x = 0; x < cityR + 8; x++) { const y = hillY(x); p.vl(x, y, hz + 8, x % 7 < 3 ? '#e8d4a0' : '#e0cc98'); if (rnd(x, 3) < 0.25) p.px(x, y + 1 + Math.floor(rnd(x, 4) * 6), '#9ac060'); }
  // the town: rows of houses from the top of the hill down to the water, the farthest first
  const items = [];
  const tx = Math.round(W * 0.12);
  items.push([hillY(tx) + 1, () => {   // Apollo's temple at the top
    const gy = hillY(tx) + 2, w = 26;
    block(p, tx - 3, gy, w + 6, 2, 4, '#ffffff', '#f4ecdc');
    block(p, tx - 1, gy - 2, w + 2, 1, 4, '#ffffff', '#f4ecdc');
    p.obj(); for (let x = tx; x < tx + w; x += 3) p.rect(x, gy - 10, 2, 8, '#ffffff'); for (let x = tx + 2; x < tx + w; x += 3) p.vl(x, gy - 10, gy - 3, '#c8c0b0');
    for (let k = 1; k <= 4; k++) p.vl(tx + w - 1 + k, gy - 10 - k, gy - 3 - k, '#d8d0c0');
    block(p, tx - 1, gy - 10, w + 2, 2, 4, '#ffffff', '#ee6a3a'); for (let x = tx - 1; x < tx + w + 1; x++) p.px(x, gy - 11, x % 2 ? '#3a64c8' : '#e8483a');
    p.obj(); for (let j = 0; j < 6; j++) p.hl(tx - 1 + j * 2, tx + w - j * 2, gy - 12 - j, j === 0 ? '#e8483a' : '#ffffff'); for (let k = 1; k <= 4; k++) for (let j = 0; j < 6; j++) p.px(tx + w - j * 2 + k, gy - 12 - j - k, '#ee6a3a');
    cypress(p, tx - 5, gy, 11); cypress(p, tx + w + 7, gy - 1, 9);
  }]);
  const rows = Math.ceil((hh + 4) / 6);
  for (let r = rows; r >= 0; r--) {
    const base = hz + 3 - r * 6;
    let x = -6 + Math.floor(rnd(r, 1) * 6);
    for (let n = 0; x < cityR && n < 60; n++) {
      const w = 7 + Math.floor(rnd(r * 31 + n, 2) * 6), h = 7 + Math.floor(rnd(r * 31 + n, 3) * 5), d = 3 + Math.floor(rnd(r * 31 + n, 4) * 2), xc = x + (w >> 1);
      if (hillY(xc) <= base - 4 && hillY(x) <= base - 2 && !(xc > tx - 8 && xc < tx + 34 && base < hillY(tx) + 6)) {
        const k = rnd(r * 31 + n, 5), seed = r * 100 + n;
        if (k < 0.07) items.push([base, () => cypress(p, xc, base, 9 + Math.floor(k * 40))]);
        else if (k < 0.13) items.push([base, () => olive(p, xc, base)]);
        else { const hx = x; items.push([base, () => house(p, hx, base, w, h, d, { wall: ['#ffffff', '#ffffff', '#fff2d4', '#ffd890', '#ffc8b4', '#c8e4ff', '#ffe8a0', '#ffffff'][Math.floor(rnd(seed, 6) * 8)], tile: rnd(seed, 7) < 0.55, door: rnd(seed, 8) < 0.5 ? '#3a6ab4' : '#c8483a', awning: rnd(seed, 9) < 0.18 ? ['#e8483a', '#3a8ad8', '#ffd040', '#5ab84a'][Math.floor(rnd(seed, 10) * 4)] : null, pot: rnd(seed, 11) < 0.3, seed })]); }
      }
      x += w + d - 2 + (rnd(r * 31 + n, 12) < 0.15 ? 3 : 0);
    }
  }
  items.sort((a, b) => a[0] - b[0]); for (const [, f] of items) f();
  // the sea wall of the town, with towers
  block(p, -2, hz + 8, cityR + 4, 5, 3, '#e8d4a0', '#f2e2b4'); for (let x = 0; x < cityR; x += 3) p.px(x, hz + 1, '#f2e2b4');
  for (let k = 0; k < 4; k++) { const x = Math.round(k * cityR / 3.3); block(p, x, hz + 9, 8, 13, 3, '#f2dca8', '#e2cc98'); for (let j = 0; j < 8; j += 2) p.px(x + j, hz - 4, '#e2cc98'); p.rect(x + 3, hz + 1, 2, 3, '#4a3a3a'); }
  // the god's works out on the rocks: a base of marble, bronze legs as high as they have got, scaffolding, a crane, a furnace
  const cx = Math.round(W * 0.5), cg = hz + 10, legs = Math.min(40, 6 + Math.max(1, stage) * 4);
  p.obj(); for (let x = cx - 18; x < cx + 22; x++) { const y = cg - 1 + Math.round(rnd(x, 7) * 2); p.vl(x, y, cg + 4, x % 3 ? '#b8b4b0' : '#9a9690'); }
  block(p, cx - 12, cg, 26, 6, 4, '#ffffff', '#f4ecdc');
  block(p, cx - 9, cg - 6, 6, legs, 3, '#ffb44a', '#ffd080', { side: '#c8822a' }); block(p, cx + 4, cg - 6, 6, legs, 3, '#ffb44a', '#ffd080', { side: '#c8822a' });
  if (stage >= 5) block(p, cx - 9, cg - 6 - legs + 6, 19, 6, 3, '#ffb44a', '#ffd080', { side: '#c8822a' });
  p.obj(); const sh = legs + 14; for (const x of [cx - 13, cx + 15]) p.vl(x, cg - sh, cg - 1, '#b47a44'); for (const y of [cg - sh, cg - Math.round(sh * 0.55)]) p.hl(cx - 13, cx + 15, y, '#b47a44'); for (let k = 0; k < 6; k++) p.px(cx - 12 + k * 5, cg - Math.round(sh * 0.55) - 1, '#8a5a32');
  p.obj(); p.vl(cx + 22, cg - sh - 12, cg, '#8a5a32'); p.hl(cx - 2, cx + 22, cg - sh - 12, '#8a5a32'); p.line(cx + 22, cg - sh - 12, cx + 14, cg - sh - 4, '#8a5a32');
  block(p, cx - 22, cg + 2, 6, 6, 3, '#c8724a', '#a85a3a'); p.rect(cx - 21, cg - 1, 2, 2, '#ffb030');
  // the mole across the harbour, with its tower, a long store, boats and ships tied up
  const mx0 = Math.round(W * 0.66), my = hz + 13;
  block(p, mx0, my, W - mx0 + 4, 4, 3, '#e8d4a0', '#f2e2b4');
  block(p, Math.round(W * 0.74), my - 4, Math.round(W * 0.2), 7, 3, '#ffd890', '#ee6a3a'); for (let x = Math.round(W * 0.74) + 3; x < Math.round(W * 0.94) - 2; x += 5) p.rect(x, my - 8, 2, 4, '#4a3030');
  block(p, mx0 - 2, my, 11, 24, 4, '#f2dca8', '#e2cc98'); for (let j = 0; j < 11; j += 2) p.px(mx0 - 2 + j + 1, my - 28, '#e2cc98'); p.rect(mx0 + 2, my - 18, 2, 3, INK); p.rect(mx0 + 2, my - 10, 2, 3, INK);
  for (const x of [Math.round(W * 0.8), Math.round(W * 0.92)]) block(p, x, my - 4, 2, 2, 1, '#d8bc84', '#c8ac74');
  const ships = [];
  ships.push(sideShip(p, Math.round(W * 0.7), my + 12, SHIPS2.merchant, { sail: 'furled', crew: [folk(61)[0]], cargo: '#e8763a' }));
  ships.push(sideShip(p, Math.round(W * 0.06), hz + 22, SHIPS2.tri, { sail: 'furled', crew: [folk(62)[0], folk(63)[0], folk(64)[0]] }));
  ships.push(sideShip(p, Math.round(W * 0.66) + 20, my + 24, SHIPS2.merchant2, { sail: 'furled', crew: [folk(65)[0]], cargo: '#ffd040' }));
  // a jetty for the fishermen, and little boats tied up all along the quay
  const jx = Math.round(W * 0.86), jtop = qy - Math.round((qy - hz) * 0.45);
  for (let y = jtop; y < qy; y += 6) { p.obj(); p.vl(jx - 1, y, y + 4, '#8a5a32'); p.vl(jx + 6, y, y + 4, '#8a5a32'); }
  p.obj(); for (let y = jtop; y <= qy; y++) p.hl(jx - 1, jx + 6, y, y % 2 ? '#d8a868' : '#c89a5c'); p.hl(jx - 1, jx + 6, jtop, '#e8c48a');
  const moored = [[jx - 20, jtop + 8, '#e8483a'], [jx + 8, jtop + 14, '#3a8ad8'], [jx - 20, qy - 10, '#ffd040'], [jx + 8, qy - 6, '#5ab84a'], [Math.round(W * 0.05), qy - 4, '#3a8ad8'], [Math.round(W * 0.14), qy - 6, '#ff7ab0'], [Math.round(W * 0.27), qy - 4, '#e8483a']];
  for (const [bx, by, c] of moored) { p.obj(); for (let i = 0; i <= 14; i++) { const t0 = by - 3 - (i < 2 ? 2 - i : i > 12 ? i - 12 : 0); p.vl(bx + i, t0, by, c); p.px(bx + i, t0, '#d8a060'); p.px(bx + i, by, dk(c, 0.45)); } p.rect(bx + 3, by - 2, 9, 1, '#8a5a32'); }
  // our own ship at the quay, the sail furled, two of the crew aboard
  const P = SHIPS2[kind], ex = Math.round(W * 0.5 - P.L / 2), ew = qy - 4;
  const elpis = sideShip(p, ex, ew, P, { sail: 'furled', crew: [folk(41)[0], folk(42, 'sack')[0]] });
  // the quay: kerb, paving, bollards, goods off the ships
  p.obj(); p.rect(0, qy, W, H - qy, '#f0dcae'); p.hl(0, W, qy, '#fffaf0'); p.hl(0, W, qy + 1, '#e0c894');
  for (let y = qy + 4; y < H; y += 5) for (let x = (y / 5) % 2 ? 0 : 4; x < W; x += 8) { p.px(x, y, '#e0c894'); p.hl(x, x + 3, y + 4 > H ? y : y, '#e6d0a0'); }
  for (let x = 6; x < W; x += Math.round(W / 7)) block(p, x, qy + 3, 3, 3, 1, '#c8ac74', '#b89c64');
  const goods = [[0.08, 'jars'], [0.28, 'sacks'], [0.82, 'crates'], [0.95, 'jars']];
  for (const [f, g] of goods) {
    const gx = Math.round(W * f);
    if (g === 'jars') for (let k = 0; k < 4; k++) { p.obj(); const x = gx + k * 4 - 6, y = qy + 10; p.rect(x, y - 5, 3, 5, '#e8763a'); p.px(x + 1, y - 6, '#c85a2a'); p.px(x, y - 4, '#ffa060'); }
    if (g === 'sacks') for (let k = 0; k < 3; k++) { p.obj(); const x = gx + k * 5 - 6; p.rect(x, qy + 6, 5, 4, '#f0d8a0'); p.hl(x + 1, x + 3, qy + 5, '#f0d8a0'); p.px(x + 2, qy + 4, '#c8a060'); }
    if (g === 'crates') { block(p, gx - 6, qy + 10, 7, 6, 3, '#c88a4e', '#d8a060'); block(p, gx + 2, qy + 10, 5, 4, 2, '#c88a4e', '#d8a060'); block(p, gx - 5, qy + 4, 5, 4, 2, '#e8c47a', '#f0d898'); }
  }
  // the stalls along the front, each keeper behind a counter under a striped awning
  const spots = [], keepers = ids.map(id => trader(MERCHANTS[id].look));
  ids.forEach((id, i) => {
    const m = MERCHANTS[id], cxs = Math.round(7 + m.at * (W - 14)), sw = Math.min(34, Math.max(20, Math.round(W / Math.max(4, ids.length) - 3))), x0 = cxs - (sw >> 1), gy = H - 1;
    const robe = m.look.robe, kp = keepers[i];
    p.obj(); p.rect(x0 + 1, gy - 38, 2, 38, '#8a5a32'); p.rect(x0 + sw - 3, gy - 38, 2, 38, '#8a5a32');
    p.obj(); p.spr(kp, cxs - (kp.w >> 1), gy - 13 - kp.h + 6);
    p.obj(); for (let y = gy - 41; y < gy - 34; y++) for (let x = x0; x < x0 + sw; x++) p.px(x, y, pm(x - x0, 6) < 3 ? robe : '#fffaf0'); for (let x = x0; x < x0 + sw; x += 2) p.px(x, gy - 34, pm(x - x0, 6) < 3 ? robe : '#fffaf0');
    block(p, x0 + 1, gy, sw - 2, 12, 2, '#c88a4e', '#d8a868', { side: '#8a5a32' }); p.hl(x0 + 1, x0 + sw - 2, gy - 9, robe); p.hl(x0 + 1, x0 + sw - 2, gy - 8, lt(robe, 0.4));
    const wares = ['#e8763a', '#ffd040', '#3a3440', '#9a6a3a', '#e8c47a', '#ffffff', '#c8d8e8'][i % 7];
    p.obj(); for (let k = 0; k < Math.floor((sw - 6) / 4); k++) { const x = x0 + 3 + k * 4; p.rect(x, gy - 15, 3, 3, wares); p.px(x + 1, gy - 16, lt(wares, 0.3)); }
    spots.push({ id, kind: 'merchant', x0: x0, x1: x0 + sw + 2, y0: gy - 42, y1: H });
  });
  p.outline();
  // where the water is, for ripples
  const water = new Uint8Array(W * H); for (let y = hz + 1; y < qy; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!p.ids[i]) water[i] = 1; }
  return { rgba: p.rgba, water, spots, Lo, elpis, ships, cx, cg, sh, my, mx0, legs };
}
const WANT = sprite(['.KKK.', 'KyyyK', 'KyKyK', 'KyyyK', '.KKK.', '..K..'], { K: INK, y: '#ffd040' });
const GULL = [sprite(['K.....K', 'KK...KK', '.KKKKK.'], { K: INK }), sprite(['.......', 'KKKKKKK', '..KKK..'], { K: INK })];
let CLOUDS = null, BOATS2 = null;
const clouds2 = () => CLOUDS || (CLOUDS = [0, 1, 2].map(k => build(36, 14, p => { p.obj(); const n = 3 + k; for (let j = 0; j < n; j++) p.disc(6 + j * 6, 8 - (j % 2) * 2 - (j === 1 ? 1 : 0), 4 + (j % 2), '#ffffff'); p.hl(3, 6 + (n - 1) * 6 + 3, 11, '#dce4f0'); p.hl(4, 6 + (n - 1) * 6 + 2, 12, '#dce4f0'); })));
const boats2 = () => BOATS2 || (BOATS2 = { row: boatSprite('row', '#c88a4e'), rowB: boatSprite('row', '#3a8ad8'), sail: boatSprite('sail', '#e8483a'), sailY: boatSprite('sail', '#ffd040'), sailG: boatSprite('sail', '#5ab84a'),
  ship: build(56, 44, p => sideShip(p, 6, 38, SHIPS2.merchant2, { sail: 'full', stripe: true, rose: false, crew: [folk(91)[0], folk(92)[0]] })),
  ship2: build(64, 48, p => sideShip(p, 6, 42, SHIPS2.merchant, { sail: 'full', rose: false, crew: [folk(93)[0]] })) });
function drawRhodes2(W, H, t, o) {
  const pal = dayPal(o.clock), stage = o.stage || 1, kind = kindOf();
  const ids = merchantsAt('rhodes', S ? S.ch : 1).filter(id => !MERCHANTS[id].noStall).sort((a, b) => MERCHANTS[a].at - MERCHANTS[b].at);
  const key = [W, H, stage, kind, ids.join(','), Math.round(o.clock * 30)].join(':');
  if (R2.key !== key) { R2.key = key; R2.s = paintRhodes(W, H, stage, kind, ids, pal); R2.cv = document.createElement('canvas'); R2.cv.width = W; R2.cv.height = H; R2.ctx = R2.cv.getContext('2d'); R2.img = R2.ctx.createImageData(W, H); }
  const s = R2.s, { qy, hz } = s.Lo, out = R2.img.data;
  out.set(s.rgba);
  const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x, v = rgb(c); out[i * 4] = v[0]; out[i * 4 + 1] = v[1]; out[i * 4 + 2] = v[2]; out[i * 4 + 3] = 255; };
  const onWater = (x, y) => x >= 0 && y >= 0 && x < W && y < H && s.water[y * W + x];
  const stamp = (sp, x, y, flip, waterOnly) => { x = Math.round(x); y = Math.round(y); for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) { const si = (j * sp.w + (flip ? sp.w - 1 - i : i)) * 4; if (!sp.data[si + 3]) continue; const X = x + i, Y = y + j; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; if (waterOnly && !s.water[Y * W + X]) continue; const k = (Y * W + X) * 4; out[k] = sp.data[si]; out[k + 1] = sp.data[si + 1]; out[k + 2] = sp.data[si + 2]; out[k + 3] = 255; } };
  // ripples: little light dashes on the flat water, longer nearer the quay
  const LI = lt(WATER, 0.45), DK = dk(WATER, 0.18);
  for (let y = hz + 2, j = 0; y < qy - 1; y += 3 + Math.floor((y - hz) / 30), j++) { const len = 2 + Math.floor((y - hz) / 18); for (let k = 0; k < W / 9; k++) { const r = rnd(j, k), x = Math.round(pm(r * W * 1.3 + t * (1 + r * 2) * (j % 2 ? 1 : -1), W + 10)) - 5; if (r > 0.75) continue; const c = r < 0.08 ? '#ffffff' : r < 0.6 ? LI : DK; for (let q = 0; q < len; q++) if (onWater(x + q, y)) put(x + q, y, c); } }
  // clouds drifting over, gulls, boats about the harbour
  clouds2().forEach((c, k) => stamp(c, pm(t * (1 + k * 0.4) + k * 97, W + 50) - 40, 4 + k * Math.max(6, Math.round(hz * 0.18)), k % 2 === 1));
  const B = boats2();
  const kinds = [[B.ship, 0.9, 0], [B.row, 2.2, 71], [B.sail, 1.4, 0], [B.rowB, 1.7, 72], [B.sailY, 1.1, 0], [B.ship2, 0.7, 0], [B.row, 1.9, 73], [B.sailG, 1.3, 0], [B.rowB, 1.5, 74]];
  const lanes = [];
  for (let y = hz + 30, k = 0; y < qy - 14; y += 13, k++) lanes.push([y, k]);
  for (const [y, k] of lanes) {
    const [b, v, rider] = kinds[k % kinds.length], dir = k % 2 ? -1 : 1, span = W + b.w + 20, x = dir > 0 ? pm(t * v + k * 83, span) - b.w - 10 : W + 10 - pm(t * v + k * 83, span);
    if (b.h > 30) { stamp(b, x, y - b.h + 8, dir < 0); continue; }
    if (rider) { stamp(folk(rider)[0], x + 8, y - 1, dir < 0); if (k % 3 === 0) stamp(folk(rider + 20)[0], x + 13, y - 1, dir < 0); }
    stamp(b, x, y - 6, dir < 0);
    for (let q = 1; q < 6; q++) { const wx = dir > 0 ? x + 2 - q * 2 : x + b.w - 2 + q * 2; if (onWater(wx, y + 13)) put(wx, y + 13, q < 3 ? '#ffffff' : LI); }
  }
  // swimmers off the god's rocks
  for (const [x0, y0] of [[s.cx + 26, s.cg + 10], [s.cx + 35, s.cg + 14], [s.cx + 44, s.cg + 18], [Math.round(W * 0.36), qy - 8], [Math.round(W * 0.4), qy - 12]]) { const x = x0, y = y0 + Math.round(Math.sin(t * 2 + x0)); if (!onWater(x, y)) continue; put(x, y, INK); put(x + 1, y, '#2a1d14'); put(x - 1, y + 1, '#ffffff'); put(x + 2, y + 1, '#ffffff'); put(x, y + 1, '#d8985e'); }
  // people on the quay, walking and standing about
  for (let k = 0; k < 12; k++) {
    const lane = qy + 4 + (k % 3) * Math.max(3, Math.round((s.Lo.qh - 6) / 3)), dir = k % 2 ? -1 : 1, v = 2 + rnd(k, 1) * 3, x = dir > 0 ? pm(t * v + rnd(k, 2) * W, W + 20) - 10 : W + 10 - pm(t * v + rnd(k, 2) * W, W + 20);
    const sp = folk(300 + k, ['amphora', null, 'basket', null, 'sack', null][k % 6])[Math.floor(t * 4 + k) % 2];
    stamp(sp, x - 3, lane - sp.h + 4, dir < 0);
  }
  for (const [f, k] of [[0.18, 1], [0.38, 2], [0.6, 3], [0.72, 4], [0.9, 5]]) { const sp = folk(400 + k, k % 3 ? null : 'basket')[0]; stamp(sp, Math.round(W * f), qy + 3 - sp.h + 7, k % 2 === 0); }
  // the crane's rope swinging, the furnace smoking, the flags
  { const sw = Math.round(Math.sin(t * 0.8) * 2), X = s.cx + 6 + sw, Y0 = s.cg - s.sh - 11; for (let y = Y0; y < Y0 + 14; y++) put(s.cx + 6 + Math.round(sw * (y - Y0) / 14), y, '#5a4a40'); for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) put(X - 3 + i, Y0 + 14 + j, i === 0 || i === 5 || j === 0 || j === 3 ? INK : '#ffffff'); }
  for (let k = 0; k < 4; k++) { const a = (t * 0.3 + k / 4) % 1, X = s.cx - 20 + Math.round(a * 8), Y = s.cg - 4 - Math.round(a * 22), r = 1 + Math.round(a * 3); for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) { const d = i * i + j * j; if (d <= (r + 1) * (r + 1)) put(X + i, Y + j, d <= r * r ? (j > 0 ? '#d8dce8' : '#ffffff') : INK); } }
  { const X = s.mx0 + 4, Y = s.my - 30; for (let y = Y - 8; y < Y; y++) put(X, y, '#5a4a40'); for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) put(X + 1 + i, Y - 8 + j + Math.round(Math.sin(t * 4 - i) * (i / 6)), j === 1 ? '#ffffff' : '#e8483a'); }
  { const e = s.elpis; for (let i = 0; i < 6; i++) put(e.mx + 1 + i, e.mtop - 2 + Math.round(Math.sin(t * 5 - i) * (i / 6)), i < 3 ? '#ff5a3a' : '#c83a2a'); }
  for (let k = 0; k < 3; k++) { const x = pm(t * (9 + k * 3) + k * 100, W + 20) - 10, y = 8 + k * 9 + Math.round(Math.sin(t * 1.5 + k) * 3); stamp(GULL[Math.floor(t * 3 + k) % 2], x, y); }
  // the coin over a stall whose keeper wants what you carry
  for (const sp of s.spots) if (o.wants && o.wants.has(sp.id)) stamp(WANT, Math.round((sp.x0 + sp.x1) / 2) - 2, sp.y0 - 8 - Math.floor(t * 2) % 2);
  R2.ctx.putImageData(R2.img, 0, 0);
  const dusk = Math.max(0, Math.min(1, (o.clock - 0.72) / 0.2), Math.min(1, (0.12 - o.clock) / 0.12));
  if (dusk > 0) { const c = R2.ctx; c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.35 * dusk; c.fillStyle = mix(pal.skyBot, '#3a2a6a', 0.55); c.fillRect(0, 0, W, H); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  G.drawImage(R2.cv, 0, 0);
  if (o.spots) o.spots.push(...s.spots);
}

// ---------- hooking into the game ----------
PORT_SCENES.rhodes = drawRhodes2;
drawRhodes = drawRhodes2;
const fit0 = fitPixels;
fitPixels = function (cv, cssW, cssH, cols) {   // these pictures want more, smaller pixels: about 280 across, never bigger than 3 points, each a whole number of screen pixels
  const ours = (cv === els.scene && S && ((S.phase === 'port' && (S.port || 'rhodes') === 'rhodes') || (S.phase === 'sea' && S.voyage && typeof drawSea2 === 'function'))) || (cv === els.tcanvas && TH.mode !== 'title');
  if (!ours) return fit0(cv, cssW, cssH, cols);
  const dpr = window.devicePixelRatio || 1, dev = Math.max(1, Math.min(Math.round(cssW * dpr / 280), Math.round(3 * dpr))), P = dev / dpr, W = Math.ceil(cssW / P), H = Math.ceil(cssH / P);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const sw = W * P + 'px', sh = H * P + 'px';
  if (cv.style.width !== sw) cv.style.width = sw;
  if (cv.style.height !== sh) cv.style.height = sh;
  return { W, H, P, ox: (W * P - cssW) / 2 };
};
})();
