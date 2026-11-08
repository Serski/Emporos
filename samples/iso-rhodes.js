// Emporos: Rhodes drawn isometric, black outlines and bright flat colours, inside the real game.
// tools/build-iso-preview.mjs bakes this into samples/game-iso.html, a copy of the game where Rhodes is drawn this way.
// The game's own sky, sun, clouds, sea and time of day stay; only the harbour itself is built in cubes.
(() => {
'use strict';
const INK = '#16141c';
const h3 = (x, y, z) => hash(x * 12.9898 + y * 78.233 + z * 37.719);
const mat = (top, k1, k2) => ({ t: top, l: mix(top, '#2a2850', k1 == null ? 0.16 : k1), r: mix(top, '#2a2850', k2 == null ? 0.34 : k2) });
const M = {
  stone: mat('#f2dca8'), stoneD: mat('#d8bc84'), quay: mat('#ead6a6'), quay2: mat('#e2cc98'), rock: mat('#d6c49c', 0.18, 0.36), grass: mat('#b8d878', 0.18, 0.36),
  white: mat('#ffffff', 0.1, 0.24), cream: mat('#fff2d4', 0.12, 0.26), ochre: mat('#ffd890', 0.14, 0.3), pink: mat('#ffc8b4', 0.14, 0.3), blueW: mat('#c8e4ff', 0.12, 0.28),
  roof: mat('#ee6a3a', 0.14, 0.3), roofD: mat('#c8522c', 0.12, 0.28), marble: mat('#ffffff', 0.08, 0.2), bronze: mat('#ffb44a', 0.2, 0.4),
  wood: mat('#c88a4e', 0.18, 0.36), woodD: mat('#8a5a32', 0.2, 0.38), hull: mat('#7a4a2a', 0.18, 0.36), band: mat('#e8483a', 0.16, 0.32), wet: mat('#3a2e34', 0.1, 0.2),
  deck: mat('#d8a868', 0.12, 0.3), cypress: mat('#2e8a4a', 0.2, 0.38), linen: mat('#fffaf0', 0.1, 0.22), iron: mat('#6a6a7a', 0.14, 0.3), earth: mat('#b8865a', 0.2, 0.38),
};
const WALL_M = [M.white, M.white, M.cream, M.ochre, M.pink, M.blueW, M.white];

// ---------- the world in cubes ----------
const QB = 32, CITY = -31;   // the back edge of the quay, where the water starts; and the edge of the city along the water
const STALL_X = i => 28 + i * 8;
function buildWorld(hullKind, stage) {
  const V = new Map(); let NEXT = 1;
  const vk = (x, y, z) => ((x + 160) << 18) | ((y + 160) << 9) | (z + 32);
  const put = (x, y, z, m, id) => V.set(vk(x, y, z), { x, y, z, t: m.t, l: m.l, r: m.r, id });
  const get = (x, y, z) => V.get(vk(x, y, z));
  const box = (x0, y0, z0, w, d, h, m, id) => { id = id || NEXT++; for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + d; y++) for (let z = z0; z < z0 + h; z++) put(x, y, z, typeof m === 'function' ? m(x, y, z) : m, id); return id; };
  const face = (x, y, z, side, c) => { const v = get(x, y, z); if (v) v[side] = c; };
  const Wd = { put, get, box, face, V, newId: () => NEXT++ };
  // the ground: the city rising in terraces on the left, the quay in front, a headland for the god, and a mole running out from it
  const isCity = (x, y) => x <= CITY && y < QB && x + y >= -130;
  const level = (x, y) => isCity(x, y) ? Math.min(4, Math.floor((CITY - x) / 14) + Math.floor((QB - 1 - y) / 14)) : 0;
  const isHead = (x, y) => (x >= 12 && x < 27 && y >= 8 && y < QB) || (x >= 15 && x < 24 && y >= -18 && y < 8);
  const topAt = (x, y) => y >= QB ? 0 : isCity(x, y) ? level(x, y) * 2 : isHead(x, y) ? 0 : -3;
  const ground = NEXT++, city = NEXT++;
  for (let x = -120; x < 130; x++) for (let y = -60; y < 200; y++) {
    const top = topAt(x, y); if (top < -2) continue;
    const low = Math.min(topAt(x + 1, y), topAt(x, y + 1), top), id = y >= QB || !isCity(x, y) ? ground : city;
    const street = isCity(x, y) && ((x + 200) % 16 < 2 || (y + 200) % 16 < 2);
    const m = y >= QB ? ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 ? M.quay : M.quay2) : isCity(x, y) ? (street ? M.quay2 : (x * 7 + y * 3) % 13 === 0 ? mat('#8ac85a') : (Math.floor(x / 5) + Math.floor(y / 5)) % 3 ? M.quay : M.grass) : M.quay;
    for (let z = Math.min(top, Math.max(-2, low + 1)); z <= top; z++) put(x, y, z, z === top ? m : (Math.floor((x + y + (z % 2 ? 2 : 0)) / 4) + z) % 2 ? M.stone : M.stoneD, id);
  }
  // the city wall along the water, with towers
  for (let y = -40; y < QB; y++) { const t = topAt(CITY, y); for (let z = t + 1; z <= t + 2; z++) if (z === t + 1 || y % 2) put(CITY, y, z, M.stoneD, city); }
  for (const ty of [22, 6, -10, -26]) box(CITY - 3, ty, topAt(CITY, ty) + 1, 4, 4, 7, (x, y, z) => z % 2 ? M.stone : M.stoneD);
  // the acropolis rock, and Apollo's temple on it
  const ax = -52, ay = 4, at = topAt(ax, ay);
  box(ax, ay, at + 1, 18, 14, 9, (x, y, z) => (x * 3 + y + z * 5) % 7 === 0 ? mat('#c8b48a') : M.rock, city);
  temple(Wd, ax + 2, ay + 2, at + 10);
  for (const [x, y, h] of [[ax + 17, ay + 1, 6], [ax + 16, ay + 12, 5]]) box(x, y, at + 10, 1, 1, h, M.cypress);
  // houses wherever a whole footprint sits on one terrace
  const r = (k => () => { k = (k * 16807) % 2147483647; return k / 2147483647; })(97);
  for (let y = -70; y < QB - 3; y += 8) for (let x = -118; x < CITY - 2; x += 8) {
    const w = 5 + Math.floor(r() * 3), d = 5 + Math.floor(r() * 3), x0 = x + 1 + Math.floor(r() * 2), y0 = y + 1 + Math.floor(r() * 2);
    if (x0 + w > CITY || y0 + d > QB - 1) continue;
    const lv = level(x0, y0); let ok = true;
    for (const [cx, cy] of [[x0, y0], [x0 + w - 1, y0], [x0, y0 + d - 1], [x0 + w - 1, y0 + d - 1]]) if (!isCity(cx, cy) || level(cx, cy) !== lv) ok = false;
    if (x0 + w > ax - 1 && x0 < ax + 19 && y0 + d > ay - 1 && y0 < ay + 15) ok = false;
    if (!ok) continue;
    if (r() < 0.12) { box(x0 + 2, y0 + 2, lv * 2 + 1, 1, 1, 5 + Math.floor(r() * 3), M.cypress); continue; }
    house(Wd, x0, y0, lv * 2 + 1, w, d, 5 + Math.floor(r() * 4), WALL_M[Math.floor(r() * WALL_M.length)], { flat: r() < 0.25, alongY: r() < 0.4, door: r() < 0.5 ? '#3a6ab4' : '#c8483a' });
  }
  { const lid = NEXT++; for (let x = -46; x <= -39; x++) put(x, 25, 6, mat('#5a4a40', 0.1, 0.2), lid); for (const [x, c] of [[-45, '#ff4a6a'], [-43, '#ffffff'], [-42, '#3a8ad8'], [-40, '#ffd040']]) put(x, 25, 5, mat(c), lid); }
  // the god's works on the headland, and the tower at the end of the mole
  const god = colossus(Wd, 13, 13, stage);
  const tw = box(15, -18, 1, 9, 9, 16, (x, y, z) => ((x + y) % 4 < 2) === (z % 2 === 0) ? M.stone : M.stoneD);
  for (let x = 15; x < 24; x++) for (let y = -18; y < -9; y++) if ((x === 15 || y === -18 || x === 23 || y === -10) && (x + y) % 2 === 0) put(x, y, 17, M.stone, tw);
  for (const z of [6, 11]) { face(19, -10, z, 'l', INK); face(23, -14, z, 'r', INK); }
  for (const z of [1, 2]) { face(18, -10, z, 'l', '#4a3a3a'); face(19, -10, z, 'l', '#4a3a3a'); }
  const ship = buildShip(Wd, hullKind);
  const crates = NEXT++; box(9, QB + 1, 1, 3, 3, 3, M.wood, crates); box(12, QB + 2, 1, 2, 2, 2, M.wood, crates); box(10, QB + 2, 4, 2, 2, 2, mat('#e8c47a'), crates);
  for (const x of [-20, 6]) box(x, QB, 1, 1, 1, 2, M.stoneD);
  // the busy quay in front of the city: jars, sacks, a fountain, nets drying, a statue, a cart
  const jars = NEXT++, jar = mat('#e8763a', 0.16, 0.34);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { put(-16 + i * 2, QB + 3 + j * 2, 1, jar, jars); put(-16 + i * 2, QB + 3 + j * 2, 2, mat('#c85a2a'), jars); }
  for (let i = 0; i < 3; i++) put(-15 + i * 2, QB + 4, 3, jar, jars);
  const sacks = NEXT++; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) box(-6 + i * 2, QB + 3 + j * 2, 1, 2, 2, 1 + ((i + j) % 2), mat('#f0d8a0', 0.14, 0.3), sacks);
  const fo = box(-30, QB + 10, 1, 6, 6, 1, M.stone); box(-29, QB + 11, 2, 4, 4, 1, M.stone, fo);
  for (let x = -29; x < -25; x++) for (let y = QB + 11; y < QB + 15; y++) put(x, y, 2, mat('#5ac0f0', 0.1, 0.2), fo);
  box(-28, QB + 12, 3, 2, 2, 3, M.marble, fo); put(-28, QB + 12, 6, M.bronze, fo); put(-27, QB + 13, 6, M.bronze, fo);
  const nets = NEXT++; for (const x of [-40, -34]) box(x, QB + 2, 1, 1, 1, 5, M.woodD, nets);
  for (let x = -39; x < -34; x++) for (let z = 2; z < 6; z++) if ((x + z) % 2 === 0) put(x, QB + 2, z, mat('#8a6a4a', 0.1, 0.2), nets);
  const st = box(-14, QB + 18, 1, 3, 3, 4, M.marble); box(-13, QB + 19, 5, 1, 1, 5, M.bronze, st); put(-13, QB + 18, 8, M.bronze, st); put(-13, QB + 20, 8, M.bronze, st);
  const cart = box(4, QB + 12, 1, 6, 3, 2, M.wood); for (let i = 0; i < 3; i++) put(5 + i * 2, QB + 13, 3, jar, cart);
  face(5, QB + 14, 1, 'l', INK); face(8, QB + 14, 1, 'l', INK);
  const crates2 = NEXT++; box(14, QB + 8, 1, 3, 3, 3, M.wood, crates2); box(14, QB + 8, 4, 2, 2, 2, mat('#e8c47a'), crates2);
  return { V, god, ship, tower: [19, -14, 18] };
}
function house(Wd, x0, y0, z0, w, d, h, wall, opts) {
  const { put, box, face } = Wd, id = box(x0, y0, z0, w, d, h, wall), yF = y0 + d - 1, xF = x0 + w - 1;
  for (let z = z0 + 2; z < z0 + h - 1; z += 3) {
    for (let x = x0 + 1; x < xF; x += 2 + ((x + z) % 3 === 0 ? 1 : 0)) if (h3(x, yF, z) < 0.75) { face(x, yF, z, 'l', '#2a3050'); if (z + 1 < z0 + h - 1) face(x, yF, z + 1, 'l', '#3a4a78'); }
    for (let y = y0 + 1; y < yF; y += 2 + ((y + z) % 3 === 0 ? 1 : 0)) if (h3(xF, y, z) < 0.7) { face(xF, y, z, 'r', '#2a3050'); if (z + 1 < z0 + h - 1) face(xF, y, z + 1, 'r', '#1e2440'); }
  }
  const dx = x0 + 1 + Math.floor(h3(x0, y0, 9) * Math.max(1, w - 3));
  face(dx, yF, z0, 'l', opts.door); face(dx, yF, z0 + 1, 'l', opts.door);
  if (opts.flat) { for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + d; y++) if (x === x0 || y === y0 || x === xF || y === yF) put(x, y, z0 + h, wall, id); return; }
  const along = opts.alongY ? 'y' : 'x';
  for (let k = 0; ; k++) {
    const a = along === 'x' ? [y0 + k, yF - k] : [x0 + k, xF - k];
    if (a[0] > a[1]) break;
    for (let x = along === 'x' ? x0 - 1 : a[0]; x <= (along === 'x' ? xF + 1 : a[1]); x++) for (let y = along === 'x' ? a[0] : y0 - 1; y <= (along === 'x' ? a[1] : yF + 1); y++) {
      put(x, y, z0 + h + k, M.roof, id);
      if (along === 'x' && x === xF + 1 && y > a[0] && y < a[1]) face(x, y, z0 + h + k, 'r', wall.r);
      if (along === 'y' && y === yF + 1 && x > a[0] && x < a[1]) face(x, y, z0 + h + k, 'l', wall.l);
    }
  }
}
function temple(Wd, x0, y0, z0) {
  const { put, box, face } = Wd, w = 15, d = 10, id = Wd.newId();
  for (let s = 0; s < 2; s++) box(x0 - 2 + s, y0 - 2 + s, z0 + s, w + 4 - 2 * s, d + 4 - 2 * s, 1, M.marble, id);
  const zc = z0 + 2, hc = 6;
  box(x0 + 2, y0 + 2, zc, w - 4, d - 4, hc, mat('#f4e8d8', 0.3, 0.5), id);
  for (let x = x0; x < x0 + w; x += 2) for (const y of [y0, y0 + d - 1]) box(x, y, zc, 1, 1, hc, M.marble, id);
  for (let y = y0; y < y0 + d; y += 2) for (const x of [x0, x0 + w - 1]) box(x, y, zc, 1, 1, hc, M.marble, id);
  box(x0, y0, zc + hc, w, d, 2, M.marble, id);
  for (let x = x0; x < x0 + w; x++) face(x, y0 + d - 1, zc + hc, 'l', x % 2 ? '#3a64c8' : '#e8483a');
  for (let y = y0; y < y0 + d; y++) face(x0 + w - 1, y, zc + hc, 'r', y % 2 ? '#2a4aa0' : '#b83a2e');
  for (let k = 0; k * 2 < d; k++) for (let x = x0 - 1; x <= x0 + w; x++) for (let y = y0 + k; y <= y0 + d - 1 - k; y++) {
    put(x, y, zc + hc + 2 + k, k === Math.floor((d - 1) / 2) ? M.roofD : M.roof, id);
    if (x === x0 + w && y > y0 + k && y < y0 + d - 1 - k) face(x, y, zc + hc + 2 + k, 'r', '#f0f0f8');
  }
}
function colossus(Wd, x0, y0, stage) {   // the Sun-god, as far as he has got: feet, then shins, then knees and up
  const { put, box } = Wd;
  box(x0, y0, 1, 12, 10, 5, M.marble);
  const br = Wd.newId(), legs = Math.min(26, 4 + Math.max(1, stage) * 3);
  for (const fx of [x0 + 2, x0 + 7]) { box(fx, y0 + 3, 6, 3, 6, 1, M.bronze, br); box(fx, y0 + 3, 7, 3, 3, legs, M.bronze, br); put(fx + 1, y0 + 4, 7 + legs, M.iron, br); put(fx + 1, y0 + 4, 8 + legs, M.iron, br); }
  if (stage >= 5) box(x0 + 2, y0 + 3, 7 + legs - 3, 8, 3, 3, M.bronze, br);
  const sc = Wd.newId(), top = 7 + legs + 4;
  for (const [x, y] of [[x0 - 1, y0 - 1], [x0 + 12, y0 - 1], [x0 - 1, y0 + 10], [x0 + 12, y0 + 10]]) box(x, y, 1, 1, 1, top, M.wood, sc);
  for (const z of [Math.round(top * 0.55), top]) { for (let x = x0 - 1; x <= x0 + 12; x++) { put(x, y0 - 1, z, M.wood, sc); put(x, y0 + 10, z, M.wood, sc); } for (let y = y0 - 1; y <= y0 + 10; y++) { put(x0 - 1, y, z, M.wood, sc); put(x0 + 12, y, z, M.wood, sc); } }
  for (let y = y0 + 4; y < y0 + 10; y++) for (let k = 0; k < 6 - (y - y0 - 4); k++) put(x0 + 12 + k, y, 1, M.earth, br + 1000);
  const cr = Wd.newId(), ch = top + 10;
  box(x0 + 15, y0 + 4, 1, 1, 1, ch, M.woodD, cr);
  for (let x = x0 + 4; x <= x0 + 15; x++) put(x, y0 + 4, ch, M.woodD, cr);
  box(x0 + 13, y0 + 1, 1, 2, 3, 3, M.wood, cr);
  const fu = box(x0 - 1, y0 + 15, 1, 3, 3, 3, mat('#c8724a', 0.18, 0.36)); box(x0, y0 + 16, 4, 1, 1, 3, mat('#a85a3a'), fu);
  Wd.face(x0, y0 + 17, 1, 'l', '#ffb030'); Wd.face(x0, y0 + 17, 2, 'l', '#ff7a20');
  return { crane: [x0 + 4, y0 + 4, ch], chimney: [x0, y0 + 16, 7] };
}
function buildShip(Wd, kind) {   // Elpis, or a bigger hull with a cabin aft, moored along the quay
  const { put, box, face } = Wd, big = kind !== 'small', xs = big ? -27 : -24, xe = big ? 12 : 8, yc = QB - 6, id = Wd.newId();
  const hw = x => Math.max(0, Math.round((big ? 4.8 : 4.2) * Math.min(1, (x - xs) / 5, (xe - x) / 8)));
  for (let x = xs; x <= xe; x++) {
    const w = hw(x);
    for (let y = yc - w; y <= yc + w; y++) for (let z = -1; z <= 2; z++) {
      const edge = Math.abs(y - yc) === w || x === xs || x === xe;
      if (!edge && z < 1) continue;
      if (!edge && z === 2) continue;
      put(x, y, z, z === 2 ? M.wood : z === 1 && !edge ? M.deck : z === 1 ? (big ? mat('#3a8ad8') : M.band) : z === 0 ? M.hull : M.wet, id);
    }
  }
  for (const [x, z] of [[xs, 3], [xs, 4], [xs - 1, 5], [xs - 1, 6], [xs - 1, 7], [xs, 8], [xs + 1, 8], [xs + 2, 7]]) put(x, yc, z, M.wood, id);
  put(xe + 1, yc, 2, M.wood, id); put(xe + 1, yc, 3, M.wood, id); put(xe + 2, yc, 4, M.wood, id);
  face(xe - 6, yc + hw(xe - 6), 1, 'l', '#ffffff'); face(xe - 5, yc + hw(xe - 5), 1, 'l', '#16141c');
  const mx = Math.round((xs + xe) / 2) - 2;
  box(mx, yc, 2, 1, 1, 15, M.woodD, id);
  for (let x = mx - 10; x <= mx + 10; x++) { put(x, yc, 16, M.wood, id); if (Math.abs(x - mx) < 10) { put(x, yc, 15, M.linen, id); put(x, yc, 14, M.linen, id); } }
  for (let x = mx - 8; x <= mx + 8; x += 4) { face(x, yc, 14, 'l', '#c8a878'); face(x, yc, 15, 'l', '#c8a878'); }
  if (big) { box(xs + 3, yc - 3, 2, 7, 7, 4, M.wood, id); for (let x = xs + 2; x <= xs + 10; x++) for (let y = yc - 4; y <= yc + 4; y++) put(x, y, 6, M.woodD, id); face(xs + 6, yc + 3, 3, 'l', INK); face(xs + 8, yc + 3, 3, 'l', INK); }
  for (let k = 0; k < 4; k++) put(xs + 3 - Math.floor(k / 2), yc + 5, 2 - k, M.woodD, id);
  for (let x = mx + 3; x < mx + 14; x += 2) { put(x, yc - 1, 2, mat('#e8763a'), id); put(x, yc + 1, 2, mat('#e8763a'), id); put(x, yc + 1, 3, mat('#e8763a'), id); }
  return { top: [mx, yc, 17], bow: [xe + 2, yc, 4], stern: [xs - 1, yc, 8], deck: [[mx - 6, yc], [mx + 9, yc - 2]] };
}

// ---------- drawing the cubes for a given size of picture ----------
function camera(W, H) { const ax = 30, ay = QB + 4; return { OX: Math.round(W * 0.5 - (ax - ay) * 2), OY: Math.round(H * 0.84 - (ax + ay) - 30) }; }
function renderWorld(world, W, H) {
  const { OX, OY } = camera(W, H), N = W * H, rgba = new Uint8ClampedArray(N * 4), depth = new Float32Array(N).fill(-1e9), idb = new Uint16Array(N);
  const plot = (x, y, c, d, id) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x; if (d < depth[i]) return;
    depth[i] = d; idb[i] = id; const n = parseInt(c.slice(1), 16); rgba[i * 4] = n >> 16 & 255; rgba[i * 4 + 1] = n >> 8 & 255; rgba[i * 4 + 2] = n & 255; rgba[i * 4 + 3] = 255;
  };
  const all = [...world.V.values()].filter(v => { const X = OX + (v.x - v.y) * 2, Y = OY + v.x + v.y - 2 * v.z; return X > -6 && X < W + 2 && Y > -6 && Y < H + 2; });
  all.sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z) || a.z - b.z);
  for (const v of all) {
    const X = OX + (v.x - v.y) * 2, Y = OY + v.x + v.y - 2 * v.z, d = v.x + v.y + v.z;
    plot(X + 1, Y, v.t, d, v.id); plot(X + 2, Y, v.t, d, v.id);
    for (let i = 0; i < 4; i++) plot(X + i, Y + 1, v.t, d, v.id);
    for (let j = 2; j < 4; j++) { plot(X, Y + j, v.l, d, v.id); plot(X + 1, Y + j, v.l, d, v.id); plot(X + 2, Y + j, v.r, d, v.id); plot(X + 3, Y + j, v.r, d, v.id); }
  }
  const mark = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const j = Y * W + X;
      if (idb[j] && idb[j] !== idb[i] && depth[j] > depth[i] + 0.5) { mark.push(i); break; }
    }
  }
  for (const i of mark) { rgba[i * 4] = 22; rgba[i * 4 + 1] = 20; rgba[i * 4 + 2] = 28; rgba[i * 4 + 3] = 255; }
  return { W, H, OX, OY, rgba, depth };
}

// ---------- people, as sprites that know how far away they stand ----------
const PERSON = {
  stand: ['..KKK..', '.KhhhK.', '.KhssK.', '.KsseK.', '..KsK..', '.KrrrK.', 'KsrrrsK', 'KsRrRsK', '.KrrrK.', '.KrRrK.', '.KsKsK.', '.KsKsK.', '.KK.KK.'],
  step: ['..KKK..', '.KhhhK.', '.KhssK.', '.KsseK.', '..KsK..', '.KrrrK.', 'KsrrrsK', 'KsRrRsK', '.KrrrK.', '.KrRrK.', '..KsK..', '..KsK..', '..KKK..'],
};
function sprite(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length)), data = new Uint8ClampedArray(w * h * 4);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.' || !pal[ch]) return; const n = parseInt(pal[ch].slice(1), 16), i = (y * w + x) * 4; data[i] = n >> 16 & 255; data[i + 1] = n >> 8 & 255; data[i + 2] = n & 255; data[i + 3] = 255; }));
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
  return sprite(rows.map(r => r.join('')), { K: INK, h: L.hair, s: L.skin, e: INK, r: L.robe, R: mix(L.robe, '#2a2850', 0.25), v: L.veil || L.hair, b: L.hair, a: '#e8763a', w: '#c89a52', x: '#c8925a' });
}
const CAT = [sprite(['K...KK.', 'K..KooK', 'KK.KoeK', '.KKoooK', '.KoooK.', '.KoKoK.'], { K: INK, o: '#ff9a3a', e: INK }), sprite(['.....KK', '....KooK', 'K..KoeK.', 'KKKoooK.', '.KoooK..', '.KoKoK..'], { K: INK, o: '#ff9a3a', e: INK })];
const DONKEY = [0, 1].map(f => sprite(['KK..........', 'KgK.........', 'KggKKKKKKK..', '.KggggggggK.', '.KgwwwwwwgK.', '..KwwwwwwK..', '..KggggggK..', f ? '..KgK..KgK..' : '..KgK..gKK..', f ? '..KK...KK...' : '..KK..KK....'], { K: INK, g: '#9a8a7a', w: '#e8b45a' }));
const AMPH = sprite(['.KK.', 'KaaK', 'KaaK', 'KaaaK', 'KaaK', '.KaK', '..K.'], { K: INK, a: '#e8763a' });
const GULL = [sprite(['K.....K', 'KK...KK', '.KKKKK.'], { K: INK }), sprite(['.......', 'KKKKKKK', '..KKK..'], { K: INK })];
const WANT = sprite(['.KKK.', 'KyyyK', 'KyKyK', 'KyyyK', '.KKK.', '..K..'], { K: INK, y: '#ffd040' });
const SAILBOAT = sprite(['....K....', '...KwK...', '...KwwK..', '..KwwwwK.', '..KwwwwwK', '....K....', 'KKKKKKKKK', 'KbbbbbbbK', '.KbbbbbK.', '..KKKKK..'], { K: INK, w: '#ffffff', b: '#e8483a' });
const ROWBOAT = sprite(['....KK.....', '...KssK....', '...KrrK....', 'KKKKKKKKKKK', 'KbbbbbbbbbK', '.KdddddddK.', '..KKKKKKK..'], { K: INK, s: '#c88a58', r: '#e8483a', b: '#c88a4e', d: '#8a5a32' });
const WALKERS = [
  { L: { skin: '#c88a58', hair: '#1b130e', robe: '#e8d8b8', style: 'short' }, carry: 'amphora', y: QB + 10, v: 2.2, x0: 0, dir: 1 },
  { L: { skin: '#e8b07a', hair: '#2a1d14', robe: '#3a8ad8', style: 'veil', veil: '#ffffff' }, carry: 'basket', y: QB + 8, v: 1.6, x0: 40, dir: -1 },
  { L: { skin: '#d8985e', hair: '#5a3a22', robe: '#e8483a', style: 'short' }, carry: null, y: QB + 10, v: 2.6, x0: 20, dir: 1 },
  { L: { skin: '#c88a58', hair: '#2a1d14', robe: '#6a9a3a', style: 'curly', beard: 1 }, carry: 'amphora', y: QB + 22, v: 1.8, x0: 60, dir: -1 },
  { L: { skin: '#f0b888', hair: '#7a4a22', robe: '#ffcc6a', style: 'long' }, carry: 'basket', y: QB + 16, v: 1.4, x0: 10, dir: 1 },
];
for (const w of WALKERS) w.f = [person(w.L, 'stand', w.carry), person(w.L, 'step', w.carry)];
const SAILORS = [person({ skin: '#c88a58', hair: '#e8e8e8', robe: '#8a6a4a', style: 'short', beard: 2 }, 'stand'), person({ skin: '#d8985e', hair: '#2a1d14', robe: '#e8a03a', style: 'short' }, 'stand')];
const GUARD = person({ skin: '#c88a58', hair: '#2a1d14', robe: '#c8324a', style: 'short', hat: 'pilos' }, 'stand');
const IDLERS = [[person({ skin: '#c88a58', hair: '#e8e8e8', robe: '#f4ead4', style: 'short', beard: 2 }, 'stand'), -25, QB + 17, 1, true], [person({ skin: '#d8985e', hair: '#1b130e', robe: '#3a8ad8', style: 'short' }, 'stand'), -31, QB + 4, 1, false], [person({ skin: '#e8b07a', hair: '#24180f', robe: '#c8324a', style: 'veil', veil: '#ffd040' }, 'stand'), -9, QB + 8, 1, false]];
const WORKERS = [person({ skin: '#c88a58', hair: '#3a281c', robe: '#9a8a7a', style: 'short' }, 'stand'), person({ skin: '#d8985e', hair: '#1b130e', robe: '#e8d8b8', style: 'curly' }, 'stand')];

// ---------- the scene, as the game calls it ----------
const CACHE = { key: null };
function stallSprites(ids) { return ids.map(id => person(MERCHANTS[id].look, 'stand')); }
function drawRhodesIso(W, H, t, o) {
  const pal = dayPal(o.clock), hz = Math.round(H * 0.34), stage = o.stage || 1, hullKind = (S && S.hull) || 'small';
  const ids = merchantsAt('rhodes', S ? S.ch : 1).filter(id => !MERCHANTS[id].noStall).sort((a, b) => MERCHANTS[a].at - MERCHANTS[b].at);
  // the game's own sky, sun, clouds, far shore and sea
  G.drawImage(layer('isoBack' + W + 'x' + H + ':' + Math.round(o.clock * 60), W, H, () => {
    bands(W, 0, hz + 6, pal.skyTop, pal.skyBot, 8);
    sunDisc(Math.round(W * 0.84), Math.round(hz * 0.36), 5, pal.sun);
    ridge(0, W, hz, Math.max(3, hz * 0.2), 30, 3, pal.far);
    bands(W, hz, H - hz, pal.seaTop, pal.seaBot, 6);
  }), 0, 0);
  clouds(W, hz, t, pal.cloud, 7, 3);
  for (let k = 0; k < 40; k++) {   // little crests, slanting the way the picture slants
    const y = hz + 4 + Math.floor(hash(k * 3.7) * (H - hz - 8)), x = ((hash(k * 1.9) * W + t * (1.2 + (k % 3) * 0.6)) % (W + 10)) - 5;
    const c = mix(pal.seaTop, pal.wave, 0.6); px(x, y, c); px(x + 1, y, c); px(x + 2, y + 1, c); px(x + 3, y + 1, c);
  }
  // the harbour, in cubes, built once for this size
  const key = W + 'x' + H + ':' + stage + ':' + hullKind + ':' + ids.join(',');
  if (CACHE.key !== key) {
    const world = buildWorld(hullKind, stage);
    for (let i = 0; i < ids.length; i++) stall(world, STALL_X(i), QB + 3, MERCHANTS[ids[i]].look.robe, i);
    CACHE.key = key; CACHE.world = world; CACHE.R = renderWorld(world, W, H); CACHE.traders = stallSprites(ids);
    CACHE.cv = document.createElement('canvas'); CACHE.cv.width = W; CACHE.cv.height = H; CACHE.ctx = CACHE.cv.getContext('2d'); CACHE.img = CACHE.ctx.createImageData(W, H);
  }
  const Rw = CACHE.R, out = CACHE.img.data, dep = new Float32Array(Rw.depth), { OX, OY } = Rw;
  out.set(Rw.rgba);
  const sx = (x, y) => OX + (x - y) * 2, sy = (x, y, z) => OY + x + y - 2 * z;
  const drawAt = (sp, x, y, z, flip) => {
    const X = Math.round(sx(x, y)) + 2 - (sp.w >> 1), Y = Math.round(sy(x, y, z)) + 2 - sp.h, base = x + y + z + 0.6;
    for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) {
      const si = (j * sp.w + (flip ? sp.w - 1 - i : i)) * 4; if (!sp.data[si + 3]) continue;
      const px_ = X + i, py = Y + j; if (px_ < 0 || py < 0 || px_ >= W || py >= H) continue;
      const k = py * W + px_, d = base + (sp.h - 1 - j) / 2;
      if (d < dep[k] - 0.3) continue;
      out[k * 4] = sp.data[si]; out[k * 4 + 1] = sp.data[si + 1]; out[k * 4 + 2] = sp.data[si + 2]; out[k * 4 + 3] = 255;
    }
  };
  const all = [];
  ids.forEach((id, i) => all.push([CACHE.traders[i], STALL_X(i) + 3, QB + 6, 1, i % 2 === 1]));
  for (const w of WALKERS) { const span = 110, x = w.dir > 0 ? ((t * w.v + w.x0) % span) - 20 : 90 - ((t * w.v + w.x0) % span); all.push([w.f[Math.floor(t * 4 + w.x0) % 2], x, w.y, 1, w.dir < 0]); }
  const sh = CACHE.world.ship;
  all.push([SAILORS[0], sh.deck[0][0], sh.deck[0][1], 2, false], [SAILORS[1], sh.deck[1][0], sh.deck[1][1], 2, true]);
  all.push([GUARD, 19, -14, 18, true]);
  for (const [sp, x, y, z, f] of IDLERS) all.push([sp, x, y, z, f]);
  const god = CACHE.world.god;
  all.push([WORKERS[0], 15, 12, god.crane[2] - 10, false], [WORKERS[1], 22, 12, god.crane[2] - 10, true]);
  { const x = -6 + Math.sin(t * 0.25) * 8; all.push([DONKEY[Math.floor(t * 3) % 2], x, QB + 7, 1, Math.cos(t * 0.25) < 0]); }
  all.push([CAT[Math.floor(t * 0.8) % 2], 20, QB + 8, 1, false]);
  for (const [ax, ay] of [[0, QB + 1], [1, QB + 1], [2, QB + 2]]) all.push([AMPH, ax, ay, 1, false]);
  { const x = 60 - ((t * 2.2 + 10) % 100); all.push([ROWBOAT, x, QB - 4 - 14, -1, true]); }
  { const x = ((t * 1.3 + 20) % 120) - 30; all.push([SAILBOAT, x, -24, -1, false]); }
  all.sort((a, b) => (a[1] + a[2] + a[3]) - (b[1] + b[2] + b[3]));
  for (const [sp, x, y, z, flip] of all) drawAt(sp, x, y, z, flip);
  CACHE.ctx.putImageData(CACHE.img, 0, 0);
  G.drawImage(CACHE.cv, 0, 0);
  // rigging, pennant, the tower's flag, the crane's rope and block, smoke, gulls, and the marks over stalls that want what you carry
  const dot = (x, y, c) => { G.fillStyle = c; G.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const ln = (a, b, c) => { const x0 = sx(a[0], a[1]) + 2, y0 = sy(a[0], a[1], a[2]) + 1, x1 = sx(b[0], b[1]) + 2, y1 = sy(b[0], b[1], b[2]) + 1, n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) dot(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); };
  ln(sh.top, sh.bow, '#5a4a40'); ln(sh.top, sh.stern, '#5a4a40');
  ln([sh.bow[0], sh.bow[1], 3], [7, QB, 2], '#5a4a40'); ln([sh.stern[0] + 2, sh.stern[1], 3], [-19, QB, 2], '#5a4a40');
  { const X = sx(sh.top[0], sh.top[1]) + 2, Y = sy(sh.top[0], sh.top[1], sh.top[2]); for (let i = 0; i < 7; i++) dot(X - 1 - i, Y - 2 + Math.round(Math.sin(t * 5 - i) * (i / 7)), i < 4 ? '#ff5a3a' : '#c83a2a'); }
  { const X = sx(19, -14) + 2, Y = sy(19, -14, 18); G.fillStyle = '#5a4a40'; G.fillRect(X + 3, Y - 12, 1, 12); for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) dot(X + 2 - i, Y - 12 + j + Math.round(Math.sin(t * 4 - i) * (i / 6)), j === 1 ? '#ffffff' : '#e8483a'); }
  { const [x, y, z] = god.crane, X = sx(x, y) + 2, Y = sy(x, y, z) + 3, sw = Math.round(Math.sin(t * 0.8)); for (let k = 0; k < 16; k++) dot(X + sw * k / 16, Y + k, '#5a4a40'); G.fillStyle = INK; G.fillRect(X - 3 + sw, Y + 16, 7, 5); G.fillStyle = '#ffffff'; G.fillRect(X - 2 + sw, Y + 17, 5, 3); }
  { const [x, y, z] = god.chimney, X0 = sx(x, y) + 2, Y0 = sy(x, y, z), puffs = [];
    for (let k = 0; k < 5; k++) { const a = (t * 0.25 + k / 5) % 1; puffs.push([X0 + Math.round(a * 10), Y0 - Math.round(a * 26), 1.6 + a * 3]); }
    for (const [X, Y, r] of puffs) for (let j = -Math.ceil(r) - 1; j <= Math.ceil(r) + 1; j++) for (let i = -Math.ceil(r) - 1; i <= Math.ceil(r) + 1; i++) if (i * i + j * j <= (r + 1) * (r + 1)) dot(X + i, Y + j, INK);
    for (const [X, Y, r] of puffs) for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) if (i * i + j * j <= r * r) dot(X + i, Y + j, j > r * 0.35 ? '#d8dce8' : '#ffffff'); }
  for (let k = 0; k < 3; k++) { const x = ((t * (9 + k * 3) + k * 100) % (W + 20)) - 10, y = 10 + k * 9 + Math.round(Math.sin(t * 1.5 + k) * 3), g = GULL[Math.floor(t * 3 + k) % 2]; for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.data[(j * g.w + i) * 4 + 3]) dot(x + i, y + j, INK); }
  // where to tap: each stall, and a coin over those who want what is in the hold
  const spots = [];
  ids.forEach((id, i) => {
    const x0 = STALL_X(i), X0 = sx(x0, QB + 7) - 1, X1 = sx(x0 + 7, QB + 2) + 5, Y0 = sy(x0, QB + 2, 10) - 4, Y1 = sy(x0 + 7, QB + 7, 0) + 4;
    spots.push({ id, kind: 'merchant', x0: X0, x1: X1, y0: Y0, y1: Y1 });
    if (o.wants && o.wants.has(id)) { const X = sx(x0 + 3, QB + 4), Y = sy(x0 + 3, QB + 4, 12) - 8 - Math.floor(t * 2) % 2; for (let j = 0; j < WANT.h; j++) for (let ii = 0; ii < WANT.w; ii++) { const si = (j * WANT.w + ii) * 4; if (WANT.data[si + 3]) dot(X + ii, Y + j, '#' + ((1 << 24) | (WANT.data[si] << 16) | (WANT.data[si + 1] << 8) | WANT.data[si + 2]).toString(16).slice(1)); } }
  });
  if (o.spots) o.spots.push(...spots);
}
function stall(world, x0, y0, robe, i) {   // two posts at the back, a striped awning over the keeper, a counter in front with the wares
  const { put, face, box } = { put: (x, y, z, m, id) => world.V.set(((x + 128) << 18) | ((y + 128) << 9) | (z + 32), { x, y, z, t: m.t, l: m.l, r: m.r, id }), face: (x, y, z, side, c) => { const v = world.V.get(((x + 128) << 18) | ((y + 128) << 9) | (z + 32)); if (v) v[side] = c; } };
  const id = 400 + i, wd = mat('#b47a44', 0.18, 0.36), stripe = mat(robe, 0.16, 0.32);
  for (const x of [x0, x0 + 6]) for (let z = 1; z < 10; z++) put(x, y0, z, wd, id);
  for (let x = x0; x <= x0 + 6; x++) for (let y = y0 - 1; y <= y0 + 2; y++) put(x, y, 10, (x - x0 + 10) % 4 < 2 ? stripe : M.linen, id);
  for (let x = x0; x <= x0 + 6; x++) if ((x - x0 + 10) % 4 < 2) face(x, y0 + 2, 10, 'l', mix(robe, '#2a2850', 0.3));
  for (let x = x0 + 1; x <= x0 + 5; x++) { put(x, y0 + 4, 1, wd, id); put(x, y0 + 4, 2, stripe, id); put(x, y0 + 4, 3, M.deck, id); face(x, y0 + 4, 2, 'l', x % 2 ? mix(robe, '#ffffff', 0.4) : robe); }
  const wares = [[mat('#e8763a'), 2], [mat('#ffd040'), 1], [mat('#3a3440'), 1], [mat('#9a6a3a'), 1], [mat('#e8c47a'), 2], [M.marble, 2], [mat('#e0e4ec'), 1]][i % 7];
  for (let x = x0 + 1; x <= x0 + 5; x++) if ((x - x0) % 2 === 1) for (let z = 4; z < 4 + wares[1]; z++) put(x, y0 + 4, z, wares[0], id);
}

// ---------- hooking into the game ----------
PORT_SCENES.rhodes = drawRhodesIso;
drawRhodes = drawRhodesIso;
const fit0 = fitPixels;
fitPixels = function (cv, cssW, cssH, cols) {   // Rhodes wants more, smaller pixels: about 280 across, each a whole number of screen pixels
  const rhodes = (cv === els.scene && S && S.phase === 'port' && (S.port || 'rhodes') === 'rhodes') || (cv === els.tcanvas && TH.mode && TH.mode !== 'title');
  if (!rhodes) return fit0(cv, cssW, cssH, cols);
  const dpr = window.devicePixelRatio || 1, dev = Math.max(1, Math.round(cssW * dpr / 280)), P = dev / dpr, W = Math.ceil(cssW / P), H = Math.ceil(cssH / P);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const sw = W * P + 'px', sh = H * P + 'px';
  if (cv.style.width !== sw) cv.style.width = sw;
  if (cv.style.height !== sh) cv.style.height = sh;
  return { W, H, P, ox: (W * P - cssW) / 2 };
};
})();
