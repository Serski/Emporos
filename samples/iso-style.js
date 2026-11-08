// Emporos drawn isometric, black outlines and bright flat colours, inside the real game: Rhodes, the voyage, and the title page.
// tools/build-iso-preview.mjs bakes this into samples/game-iso.html, a copy of the game drawn this way.
// The way eBoy does it: the picture is full, the water is one flat bright colour with little drawn ripples,
// and every corner holds something: houses, a stoa, ships, boats, people. There is no horizon and no sky: the world runs off every edge,
// and the hour of the day shows in the colour laid over all of it.
(() => {
'use strict';
const INK = '#16141c';
const h3 = (x, y, z) => hash(x * 12.9898 + y * 78.233 + z * 37.719);
const pm = (a, n) => ((a % n) + n) % n;
const mat = (top, k1, k2) => ({ t: top, l: mix(top, '#2a2850', k1 == null ? 0.16 : k1), r: mix(top, '#2a2850', k2 == null ? 0.34 : k2) });
const M = {
  stone: mat('#f2dca8'), stoneD: mat('#d8bc84'), quay: mat('#ead6a6'), quay2: mat('#e2cc98'), rock: mat('#d6c49c', 0.18, 0.36), grass: mat('#b8d878', 0.18, 0.36),
  white: mat('#ffffff', 0.1, 0.24), cream: mat('#fff2d4', 0.12, 0.26), ochre: mat('#ffd890', 0.14, 0.3), pink: mat('#ffc8b4', 0.14, 0.3), blueW: mat('#c8e4ff', 0.12, 0.28),
  roof: mat('#ee6a3a', 0.14, 0.3), roofB: mat('#e05a30', 0.14, 0.3), roofD: mat('#c8522c', 0.12, 0.28), marble: mat('#ffffff', 0.08, 0.2), bronze: mat('#ffb44a', 0.2, 0.4),
  wood: mat('#c88a4e', 0.18, 0.36), woodD: mat('#8a5a32', 0.2, 0.38), hull: mat('#7a4a2a', 0.18, 0.36), band: mat('#e8483a', 0.16, 0.32), wet: mat('#3a2e34', 0.1, 0.2),
  deck: mat('#d8a868', 0.12, 0.3), cypress: mat('#2e8a4a', 0.2, 0.38), linen: mat('#fffaf0', 0.1, 0.22), iron: mat('#6a6a7a', 0.14, 0.3), earth: mat('#b8865a', 0.2, 0.38),
  kerb: mat('#fffaf0', 0.12, 0.28), pave: mat('#f4e4bc'), pave2: mat('#e0c894'), street: mat('#ecdcb4'), street2: mat('#dcc69a'),
  leaf: mat('#6ac850', 0.2, 0.42), leafD: mat('#3ea048', 0.2, 0.42), olive: mat('#a8c860', 0.2, 0.42), oliveD: mat('#7aa848', 0.2, 0.42),
  tileR: mat('#e8483a'), tileB: mat('#3a6ac8'), tileW: mat('#fff8e8'), sail: mat('#fffaf0', 0.06, 0.16), sailR: mat('#e8483a', 0.06, 0.16),
  blue: mat('#3a8ad8', 0.16, 0.32), yellow: mat('#ffd040', 0.14, 0.3), green: mat('#5ab84a', 0.16, 0.34), grey: mat('#b8b4b0', 0.18, 0.36), greyD: mat('#8a8684', 0.18, 0.36),
};
const WALL_M = [M.white, M.white, M.cream, M.ochre, M.pink, M.blueW, M.white, mat('#ffe8a0', 0.12, 0.28), mat('#ffd8c8', 0.12, 0.28), M.cream];
const AWN = ['#e8483a', '#3a8ad8', '#ffd040', '#5ab84a', '#ff7ab0', '#e8763a'];
const WATER = '#3cbcee';

// ---------- the plan of the town ----------
const QB = 32, CITY = -31;          // the back edge of the quay, where the water starts; and the edge of the old town along the water
const STALL_X = i => 28 + i * 8;
const STOA_Y = QB + 18;             // the long stoa that closes the quay, its back wall
const BY = STOA_Y + 10;             // the first row of town blocks behind the street in front of the stoa
const PLAZA = [-37, 46];            // the square with the fountain, at the west end of the quay
const isCity = (x, y) => x <= CITY && y < QB;
const level = (x, y) => Math.min(4, Math.floor((CITY - x) / 12) + Math.floor((QB - 1 - y) / 30));
const isHead = (x, y) => (x >= 12 && x < 27 && y >= 8 && y < QB) || (x >= 15 && x < 24 && y >= -18 && y < 8);
const isMole = (x, y) => x > CITY && x <= -2 && y >= -36 && y <= -32;
const topAt = (x, y) => y >= QB ? 0 : isCity(x, y) ? level(x, y) * 2 : (isHead(x, y) || isMole(x, y)) ? 0 : -3;
const horizon = H => 0;   // no sky: an isometric world has no horizon
function camera(W, H) { const ax = 30, ay = QB + 4; return { OX: Math.round(W * 0.5 - (ax - ay) * 2), OY: Math.round(H * 0.84 - (ax + ay) - 30) }; }

function makeWd() {
  const V = new Map(); let NEXT = 1;
  const vk = (x, y, z) => ((x + 700) * 1400 + (y + 700)) * 512 + (z + 64);
  const put = (x, y, z, m, id) => V.set(vk(x, y, z), { x, y, z, t: m.t, l: m.l, r: m.r, id });
  const get = (x, y, z) => V.get(vk(x, y, z));
  const box = (x0, y0, z0, w, d, h, m, id) => { id = id || NEXT++; for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + d; y++) for (let z = z0; z < z0 + h; z++) put(x, y, z, typeof m === 'function' ? m(x, y, z) : m, id); return id; };
  const face = (x, y, z, side, c) => { const v = get(x, y, z); if (v) v[side] = c; };
  return { V, put, get, box, face, del: (x, y, z) => V.delete(vk(x, y, z)), newId: () => NEXT++ };
}

// ---------- the world in cubes, built for the part of it a picture of this size can see ----------
function buildWorld(hullKind, stage, W, H, robes) {
  const { OX, OY } = camera(W, H), hz = horizon(H), K = hz - OY;
  const Wd = makeWd(), { put, get, box, face } = Wd;
  const on = (x, y, z, pad) => { const X = OX + (x - y) * 2, Y = OY + x + y - 2 * z; pad = pad == null ? 12 : pad; return X > -4 - pad && X < W + pad && Y > -4 - pad && Y < H + pad; };
  const seen = (x0, y0, w, d, z0, h) => { for (const [x, y] of [[x0, y0], [x0 + w - 1, y0], [x0, y0 + d - 1], [x0 + w - 1, y0 + d - 1], [x0 + (w >> 1), y0 + (d >> 1)]]) for (const z of [z0, z0 + h]) if (on(x, y, z)) return true; return false; };
  const beyond = (x, y, z) => x + y - 2 * z < K - 8;   // off the top of the picture
  const umin = Math.floor((-12 - OX) / 2), umax = Math.ceil((W + 12 - OX) / 2), vmin = K - 2, vmax = H - OY + 16;
  const xLo = Math.floor((umin + vmin) / 2), xHi = Math.ceil((umax + vmax) / 2), yLo = Math.floor((vmin - umax) / 2), yHi = Math.ceil((vmax - umin) / 2);
  const ships = [], lights = {};

  // the ground: the old town in terraces on the left, the quay, the lower town in front, the headland and the two moles
  const flat = Wd.newId(), city = Wd.newId();
  const groundMat = (x, y) => {
    if (y >= QB) {
      if (y === QB) return M.kerb;
      const dx = x - PLAZA[0], dy = y - PLAZA[1], ring = Math.max(Math.abs(dx), Math.abs(dy));
      if (ring <= 10 && x < -24) return Math.abs(dx) === Math.abs(dy) ? M.tileB : ring % 3 === 0 ? M.tileR : M.tileW;
      if (y < STOA_Y) return pm(x, 6) === 0 || pm(y - QB, 6) === 0 ? M.pave2 : M.pave;
      return pm(x + 2 * y, 5) === 0 ? M.street2 : M.street;
    }
    if (isCity(x, y)) return pm(x * 7 + y * 3, 13) === 0 ? mat('#8ac85a') : pm(Math.floor(x / 5) + Math.floor(y / 5), 3) ? M.quay : M.grass;
    return pm(x, 3) === 0 || pm(y, 3) === 0 ? M.quay2 : M.quay;
  };
  for (let v = vmin; v <= vmax; v++) for (let u = umin; u <= umax; u++) {
    if ((u + v) & 1) continue;
    const x = (u + v) / 2, y = (v - u) / 2, top = topAt(x, y);
    if (top < -2 || beyond(x, y, top)) continue;
    const low = Math.min(topAt(x + 1, y), topAt(x, y + 1), top), m = groundMat(x, y), id = isCity(x, y) ? city : flat;
    for (let z = Math.min(top, Math.max(-2, low + 1)); z <= top; z++) put(x, y, z, z === top ? m : pm(Math.floor((x + y + (z % 2 ? 2 : 0)) / 4) + z, 2) ? M.stone : M.stoneD, id);
  }

  // the old town: a wall along the water with towers, Apollo on his rock, and houses packed onto the terraces
  for (let y = yLo; y < QB; y++) { const t = topAt(CITY, y); if (beyond(CITY, y, t) || !on(CITY, y, t)) continue; for (let z = t + 1; z <= t + 2; z++) if (z === t + 1 || pm(y, 2)) put(CITY, y, z, M.stoneD, city); }
  for (let ty = 22; ty > yLo - 8; ty -= 16) { const t = topAt(CITY, ty); if (beyond(CITY - 3, ty, t) || !seen(CITY - 3, ty, 4, 4, t, 8)) continue; box(CITY - 3, ty, t + 1, 4, 4, 7, (x, y, z) => z % 2 ? M.stone : M.stoneD); }
  const ax = -52, ay = 4, at = topAt(ax, ay);
  const acro = (x0, y0, w, d) => x0 + w > ax - 2 && x0 < ax + 20 && y0 + d > ay - 2 && y0 < ay + 16;
  if (seen(ax, ay, 18, 14, 0, 26) && !beyond(ax, ay, at + 9)) {
    box(ax, ay, 1, 18, 14, at + 9, (x, y, z) => pm(x * 3 + y + z * 5, 7) === 0 ? mat('#c8b48a') : M.rock, city);
    temple(Wd, ax + 2, ay + 2, at + 10);
    for (const [x, y, h] of [[ax + 17, ay + 1, 6], [ax + 16, ay + 12, 5]]) box(x, y, at + 10, 1, 1, h, M.cypress);
  }
  for (let cy = Math.floor(yLo / 8) - 1; cy * 8 < QB - 2; cy++) for (let cx = Math.floor(xLo / 8) - 1; cx * 8 < CITY; cx++) {
    const R = k => h3(cx, cy, k), w = 6 + (R(1) < 0.5 ? 0 : 1), d = 6 + (R(2) < 0.5 ? 0 : 1);
    const x0 = cx * 8 + Math.floor(R(3) * (9 - w)), y0 = cy * 8 + Math.floor(R(4) * (9 - d));
    if (x0 + w > CITY || y0 + d > QB - 1 || !isCity(x0, y0)) continue;
    const lv = level(x0, y0), lo = level(x0 + w - 1, y0 + d - 1);   // a house across a step in the terraces stands on the lower one
    if (!isCity(x0 + w - 1, y0 + d - 1) || acro(x0, y0, w, d) || beyond(x0 + w - 1, y0 + d - 1, lo * 2) || !seen(x0, y0, w, d, lo * 2, 16)) continue;   // on the skyline, a roof may stand against the sky
    const z0 = lo * 2 + 1, kind = R(5), up = (lv - lo) * 2;
    if (up && kind < 0.14) continue;
    if (kind < 0.09) { tree(Wd, x0 + 2, y0 + 2, z0, R(6)); tree(Wd, x0 + w - 2, y0 + d - 2, z0, R(7)); continue; }
    if (kind < 0.14) { box(x0 + 1, y0 + 2, z0, 1, 1, 6 + Math.floor(R(6) * 3), M.cypress); box(x0 + 4, y0 + 4, z0, 1, 1, 5, M.cypress); tree(Wd, x0 + 3, y0 + 1, z0, R(8)); continue; }
    house(Wd, x0, y0, z0, w, d, up + 5 + Math.floor(R(7) * 5), WALL_M[Math.floor(R(8) * WALL_M.length)], { flat: R(9) < 0.3, alongY: R(10) < 0.4, door: R(11) < 0.5 ? '#3a6ab4' : '#c8483a', awning: R(12) < 0.3 ? AWN[Math.floor(R(13) * AWN.length)] : null, seed: R(14) });
  }

  // the god's works on the headland, and the tower at the end of its mole, with rocks heaped on the seaward side
  const god = colossus(Wd, 13, 13, stage);
  const tw = box(15, -18, 1, 9, 9, 16, (x, y, z) => ((x + y) % 4 < 2) === (z % 2 === 0) ? M.stone : M.stoneD);
  for (let x = 15; x < 24; x++) for (let y = -18; y < -9; y++) if ((x === 15 || y === -18 || x === 23 || y === -10) && (x + y) % 2 === 0) put(x, y, 17, M.stone, tw);
  for (const z of [6, 11]) { face(19, -10, z, 'l', INK); face(23, -14, z, 'r', INK); }
  for (const z of [1, 2]) { face(18, -10, z, 'l', '#4a3a3a'); face(19, -10, z, 'l', '#4a3a3a'); }
  rocks(Wd, 24, 27, -21, 7, (x, y) => 0.8 - (x - 24) * 0.22); rocks(Wd, 15, 23, -31, -19, (x, y) => 0.55 - Math.abs(x - 19) * 0.04);
  for (const [x, y] of [[16, -3], [22, 4], [16, 6]]) box(x, y, 1, 1, 1, 1, M.stoneD);

  // the second mole, from the town: a long store, bollards, and a lighthouse at its end
  if (seen(-30, -36, 29, 5, 0, 14)) {
    const st = box(-29, -36, 1, 20, 3, 4, (x, y, z) => z === 4 ? M.ochre : M.cream);
    for (let x = -29; x < -9; x++) { put(x, -36, 5, M.roof, st); put(x, -35, 5, M.roofB, st); put(x, -34, 5, M.roof, st); }
    for (let x = -27; x < -10; x += 4) { face(x, -34, 1, 'l', '#4a3030'); face(x, -34, 2, 'l', '#4a3030'); face(x + 1, -34, 1, 'l', '#4a3030'); face(x + 1, -34, 2, 'l', '#4a3030'); }
    for (const x of [-27, -21, -15]) { box(x, -33, 1, 2, 1, 2, M.wood); put(x + 2, -33, 1, mat('#e8763a')); }
    const lh = box(-7, -36, 1, 5, 5, 3, M.stone); box(-6, -35, 4, 3, 3, 8, (x, y, z) => z % 3 === 0 ? M.stoneD : M.white, lh); box(-7, -36, 12, 5, 5, 1, M.stoneD, lh);
    lights.fire = [-5, -34, 13];
    for (const x of [-26, -18, -10, -4]) put(x, -32, 1, M.stoneD);
    ships.push(ship(Wd, { kind: 'tri', xs: -28, xe: -6, yc: -26, hw: 2, zt: 1, hull: mat('#3a3440', 0.1, 0.2), band: mat('#3a8ad8'), deck: M.deck, oars: true, ram: true, eye: true, post: true, yard: true, mast: 9 }));
  }

  // the harbour: Elpis at the quay, a merchantman next to her, ships at anchor, boats along the town wall
  const elpis = buildShip(Wd, hullKind); ships.push(elpis);
  ships.push(ship(Wd, { xs: 31, xe: 52, yc: 25, hw: 4, zt: 2, hull: mat('#5a3a2a', 0.18, 0.36), band: M.yellow, post: true, mast: 13, yard: true, cargo: '#c8a060' }));
  ships.push(ship(Wd, { xs: 30, xe: 45, yc: 0, hw: 3, zt: 2, hull: mat('#6a4a3a', 0.18, 0.36), band: M.green, post: true, mast: 11, yard: true, cargo: '#e8763a' }));
  ships.push(ship(Wd, { xs: -21, xe: -5, yc: -10, hw: 3, zt: 2, hull: mat('#7a5a3a', 0.18, 0.36), band: mat('#ff7ab0'), post: true, mast: 11, yard: true, cargo: '#ffd040' }));
  for (const [y, c] of [[-20, '#e8483a'], [-12, '#ffd040'], [-2, '#3a8ad8'], [6, '#ffffff'], [13, '#5ab84a']]) smallBoat(Wd, -29, y, c, true);
  if (seen(46, -17, 19, 9, -1, 14)) ships.push(ship(Wd, { xs: 46, xe: 64, yc: -13, hw: 4, zt: 2, hull: mat('#6a4a2a', 0.18, 0.36), band: mat('#e8483a'), post: true, mast: 12, yard: true, cargo: '#f0d8a0' }));
  if (seen(-24, -48, 17, 7, -1, 12)) ships.push(ship(Wd, { xs: -24, xe: -8, yc: -45, hw: 3, zt: 2, hull: mat('#5a3a2a', 0.18, 0.36), band: M.blue, post: true, mast: 10, yard: true, cargo: '#e8763a' }));
  if (seen(4, -43, 15, 7, -1, 12)) ships.push(ship(Wd, { xs: 4, xe: 18, yc: -40, hw: 3, zt: 2, hull: mat('#7a5a3a', 0.18, 0.36), band: M.yellow, post: true, mast: 10, yard: true }));
  for (const [x, y, c] of [[30, -10, '#ffd040'], [36, -24, '#3a8ad8'], [48, 5, '#ff7ab0'], [-6, -58, '#ffffff'], [8, -52, '#e8483a'], [28, -34, '#5ab84a']]) if (on(x, y, 0, 20)) smallBoat(Wd, x, y, c, false);

  // a wooden jetty for the fishermen, east of the stalls
  if (seen(58, 2, 6, 30, 0, 6)) {
    const jt = Wd.newId(), plank = mat('#c89a62', 0.18, 0.36), plank2 = mat('#b48450', 0.18, 0.36);
    for (let y = 6; y < QB; y++) for (const x of [60, 61]) { put(x, y, 0, y % 2 ? plank : plank2, jt); if (y % 4 === 0) { put(x, y, -1, M.woodD, jt); put(x, y, -2, M.woodD, jt); } }
    const sh = box(59, 2, 0, 4, 4, 1, plank, jt); box(59, 2, 1, 4, 3, 3, M.wood, sh); for (let x = 59; x < 63; x++) { put(x, 2, 4, M.roofD, sh); put(x, 3, 4, M.roof, sh); put(x, 4, 4, M.roofD, sh); }
    face(60, 4, 1, 'l', '#3a2820'); face(60, 4, 2, 'l', '#3a2820');
    box(62, 8, 1, 1, 1, 1, mat('#c89a52')); box(59, 12, 1, 1, 1, 1, mat('#c89a52')); box(62, 18, 1, 1, 1, 2, M.woodD);
    for (const [x, y, c] of [[63, 10, '#3a8ad8'], [63, 20, '#e8483a'], [56, 15, '#ffd040'], [56, 24, '#ffffff']]) smallBoat(Wd, x, y, c, true);
  }

  // the quay itself: kerb and bollards, stacks of goods off Elpis, a cart, and the stalls
  for (let x = -20; x < 110; x += 10) if (!(x >= 26 && x < 92)) box(x, QB, 1, 1, 1, 1, M.stoneD);
  const crates = Wd.newId(); box(9, QB + 1, 1, 3, 3, 3, M.wood, crates); box(12, QB + 2, 1, 2, 2, 2, M.wood, crates); box(10, QB + 2, 4, 2, 2, 2, mat('#e8c47a'), crates);
  const jars = Wd.newId(), jar = mat('#e8763a', 0.16, 0.34);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { put(-16 + i * 2, QB + 3 + j * 2, 1, jar, jars); put(-16 + i * 2, QB + 3 + j * 2, 2, mat('#c85a2a'), jars); }
  for (let i = 0; i < 3; i++) put(-15 + i * 2, QB + 4, 3, jar, jars);
  const sacks = Wd.newId(); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) box(-6 + i * 2, QB + 3 + j * 2, 1, 2, 2, 1 + ((i + j) % 2), mat('#f0d8a0', 0.14, 0.3), sacks);
  const cart = box(17, QB + 3, 1, 6, 3, 2, M.wood); for (let i = 0; i < 3; i++) put(18 + i * 2, QB + 4, 3, jar, cart);
  face(18, QB + 5, 1, 'l', INK); face(21, QB + 5, 1, 'l', INK);
  const crates2 = Wd.newId(); box(23, QB + 1, 1, 3, 3, 3, M.wood, crates2); box(23, QB + 1, 4, 2, 2, 2, mat('#e8c47a'), crates2);
  robes.forEach((robe, i) => stall(Wd, STALL_X(i), QB + 3, robe, i));
  { const fx = STALL_X(robes.length) + 2; if (seen(fx, QB + 1, 8, 6, 0, 4)) {   // a fish stand past the last stall
    const fs = box(fx, QB + 4, 1, 5, 2, 2, M.wood); for (let x = fx; x < fx + 5; x++) put(x, QB + 4, 3, x % 2 ? mat('#c8d8e8') : mat('#9ab0c8'), fs);
    for (const [x, y] of [[fx + 6, QB + 2], [fx + 6, QB + 5], [fx - 1, QB + 1]]) box(x, y, 1, 2, 2, 1, mat('#c89a52'));
    box(fx + 9, QB + 1, 1, 3, 3, 3, M.wood); } }
  // trees along the quay, in front of the stoa
  for (let x = -16; x < 120; x += 12) if (on(x, QB + 14, 4)) tree(Wd, x, QB + 14, 1, h3(x, 1, 2));

  // the west square: a mosaic, a fountain, a statue, trees, nets drying
  if (seen(PLAZA[0] - 12, PLAZA[1] - 12, 24, 24, 0, 10)) {
    const [px_, py] = PLAZA, fo = box(px_ - 3, py - 3, 1, 6, 6, 1, M.stone); box(px_ - 2, py - 2, 2, 4, 4, 1, M.stone, fo);
    for (let x = px_ - 2; x < px_ + 2; x++) for (let y = py - 2; y < py + 2; y++) put(x, y, 2, mat('#5ac0f0', 0.1, 0.2), fo);
    box(px_ - 1, py - 1, 3, 2, 2, 3, M.marble, fo); put(px_ - 1, py - 1, 6, M.bronze, fo); put(px_, py, 6, M.bronze, fo);
    lights.fountain = [px_ - 0.5, py - 0.5, 7];
    const sta = box(px_ + 6, py + 4, 1, 3, 3, 4, M.marble); box(px_ + 7, py + 5, 5, 1, 1, 5, M.bronze, sta); put(px_ + 7, py + 4, 8, M.bronze, sta); put(px_ + 7, py + 6, 8, M.bronze, sta);
    for (const [dx, dy] of [[-9, -9], [9, -9], [-9, 9], [-11, 0], [0, 11]]) tree(Wd, px_ + dx, py + dy, 1, h3(dx, dy, 5));
    for (const [dx, dy] of [[-6, 6], [5, -7]]) box(px_ + dx, py + dy, 1, 3, 1, 1, M.stoneD);
    const nets = Wd.newId(); for (const x of [px_ - 14, px_ - 8]) box(x, QB + 2, 1, 1, 1, 5, M.woodD, nets);
    for (let x = px_ - 13; x < px_ - 8; x++) for (let z = 2; z < 6; z++) if ((x + z) % 2 === 0) put(x, QB + 2, z, mat('#8a6a4a', 0.1, 0.2), nets);
  }

  // the long stoa, open to the street, with passages through it; and the lower town in blocks behind
  stoa(Wd, Math.max(-22, umin + STOA_Y - 2), Math.min(150, umax + STOA_Y + 8));
  for (let by = 0; BY + by * 13 <= yHi + 2; by++) for (let bx = Math.floor((xLo - 20) / 14); bx * 14 <= xHi; bx++) {
    const x0 = bx * 14 + 2, y0 = BY + by * 13;
    if (seen(x0, y0, 12, 11, 0, 14)) block(Wd, x0, y0, bx, by);
  }
  for (let bx = Math.floor((xLo - 20) / 14); bx * 14 + 14 <= -24; bx++) { const x0 = bx * 14 + 2; if (x0 + 12 <= PLAZA[0] - 12 && seen(x0, STOA_Y - 2, 12, 10, 0, 14)) block(Wd, x0, STOA_Y - 2, bx, -1); }

  return { V: Wd.V, god, ships, elpis, lights, tower: [19, -14, 18], view: { umin, umax, vmin, vmax, xLo, xHi, yLo, yHi } };
}

function house(Wd, x0, y0, z0, w, d, h, wall, o) {
  const { put, get, box, face } = Wd, id = box(x0, y0, z0, w, d, h, wall), yF = y0 + d - 1, xF = x0 + w - 1;
  for (let z = z0 + 2; z < z0 + h - 1; z += 3) {
    for (let x = x0 + 1; x < xF; x += 2) if (h3(x, yF, z) < 0.75) { face(x, yF, z, 'l', '#2a3050'); if (z + 1 < z0 + h - 1) face(x, yF, z + 1, 'l', '#3a4a78'); }
    for (let y = y0 + 1; y < yF; y += 2) if (h3(xF, y, z) < 0.7) { face(xF, y, z, 'r', '#2a3050'); if (z + 1 < z0 + h - 1) face(xF, y, z + 1, 'r', '#1e2440'); }
  }
  const dx = x0 + 1 + Math.floor(h3(x0, y0, 9) * Math.max(1, w - 3));
  face(dx, yF, z0, 'l', o.door); face(dx, yF, z0 + 1, 'l', o.door);
  if (o.awning) { const a = mat(o.awning, 0.14, 0.3); for (let x = dx - 1; x <= dx + 1; x++) if (x >= x0 && x <= xF && !get(x, yF + 1, z0 + 2)) put(x, yF + 1, z0 + 2, (x - dx) % 2 ? M.linen : a, id); }
  if (o.flat) {
    for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + d; y++) if (x === x0 || y === y0 || x === xF || y === yF) put(x, y, z0 + h, wall, id);
    if (o.seed < 0.35) { for (let x = x0 + 1; x < xF; x++) put(x, y0 + 1, z0 + h, mat('#5ab84a', 0.2, 0.4), id); }
    else if (o.seed < 0.6) { put(x0 + 1, yF - 1, z0 + h, mat('#e8763a'), id); put(xF - 1, yF - 1, z0 + h, mat('#e8763a'), id); put(xF - 1, yF - 1, z0 + h + 1, M.leaf, id); }
    return;
  }
  const tile = h3(x0, y0, 4) < 0.5 ? [M.roof, M.roofB] : [M.roofB, M.roofD];
  if (!o.alongY) for (let k = 0; y0 + k <= yF - k; k++) for (let x = x0; x <= xF; x++) for (let y = y0 + k; y <= yF - k; y++) {
    put(x, y, z0 + h + k, tile[(y - y0) % 2], id);
    if (x === xF && y > y0 + k && y < yF - k) face(x, y, z0 + h + k, 'r', wall.r);
  }
  else for (let k = 0; x0 + k <= xF - k; k++) for (let x = x0 + k; x <= xF - k; x++) for (let y = y0; y <= yF; y++) {
    put(x, y, z0 + h + k, tile[(x - x0) % 2], id);
    if (y === yF && x > x0 + k && x < xF - k) face(x, y, z0 + h + k, 'l', wall.l);
  }
}
function tree(Wd, x, y, z, r) {   // a plane or an olive: a trunk and a lumpy crown
  const id = Wd.newId(), a = r < 0.55 ? M.leaf : M.olive, b = r < 0.55 ? M.leafD : M.oliveD;
  Wd.box(x, y, z, 1, 1, 2, M.woodD, id);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = 0; dz < 2; dz++) if (Math.abs(dx) + Math.abs(dy) + dz < 3 || h3(x + dx, y + dy, dz + r) < 0.4) Wd.put(x + dx, y + dy, z + 2 + dz, pm(dx + dy + dz, 2) ? a : b, id);
  Wd.put(x, y, z + 4, a, id);
}
function rocks(Wd, xa, xb, ya, yb, keep) {   // loose stones heaped in the sea, each lump its own shape
  const ids = new Map();
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const r = h3(x, y, 3); if (r > keep(x, y)) continue;
    const k = (x >> 1) + ',' + (y >> 1); if (!ids.has(k)) ids.set(k, Wd.newId());
    const id = ids.get(k); Wd.put(x, y, -1, pm(x + y, 2) ? M.grey : M.greyD, id); if (r < keep(x, y) * 0.45) Wd.put(x, y, 0, M.grey, id);
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
function stoa(Wd, xA, xB) {   // the street side of the quay, in pieces twelve long with passages between: colonnades, houses, a garden with a shrine
  for (let sg = Math.floor(xA / 14); sg * 14 <= xB; sg++) {
    const x0 = sg * 14 + 2, kind = h3(sg, 7, 1), R = k => h3(sg, 11, k);
    if (x0 < -26) continue;
    if (kind < 0.5) colonnade(Wd, x0, sg);
    else if (kind < 0.8) {
      house(Wd, x0, STOA_Y + 1, 1, 7, 6, 6 + Math.floor(R(1) * 4), WALL_M[Math.floor(R(2) * WALL_M.length)], { flat: R(3) < 0.5, alongY: true, door: '#3a6ab4', awning: AWN[Math.floor(R(4) * AWN.length)], seed: R(5) });
      house(Wd, x0 + 7, STOA_Y + 2, 1, 5, 5, 4 + Math.floor(R(6) * 4), WALL_M[Math.floor(R(7) * WALL_M.length)], { flat: R(8) < 0.4, alongY: R(9) < 0.5, door: '#c8483a', awning: AWN[Math.floor(R(10) * AWN.length)], seed: R(11) });
    } else {
      const g = Wd.newId(); for (let x = x0; x < x0 + 12; x++) for (let y = STOA_Y; y < STOA_Y + 7; y++) Wd.put(x, y, 0, pm(x + y, 2) ? M.grass : mat('#a8d068', 0.18, 0.36), g);
      tree(Wd, x0 + 1, STOA_Y + 1, 1, R(1)); tree(Wd, x0 + 10, STOA_Y + 2, 1, R(2)); Wd.box(x0 + 3, STOA_Y + 6, 1, 1, 1, 5, M.cypress); Wd.box(x0 + 8, STOA_Y + 6, 1, 1, 1, 4, M.cypress);
      const sh = Wd.box(x0 + 4, STOA_Y + 1, 1, 4, 4, 1, M.marble); for (const [dx, dy] of [[0, 0], [3, 0], [0, 3], [3, 3]]) Wd.box(x0 + 4 + dx, STOA_Y + 1 + dy, 2, 1, 1, 3, M.marble, sh);
      Wd.box(x0 + 4, STOA_Y + 1, 5, 4, 4, 1, M.marble, sh); for (let x = x0 + 4; x < x0 + 8; x++) { Wd.put(x, STOA_Y + 2, 6, M.roof, sh); Wd.put(x, STOA_Y + 3, 6, M.roof, sh); Wd.face(x, STOA_Y + 4, 5, 'l', x % 2 ? '#3a64c8' : '#e8483a'); }
      Wd.box(x0 + 5, STOA_Y + 2, 2, 2, 2, 2, M.bronze, sh);
    }
  }
}
function colonnade(Wd, x0, sg) {   // a stoa: shops along the back wall, columns along the street, banners between them
  const { put, face } = Wd, y0 = STOA_Y, id = Wd.newId(), back = mat(['#e8a05a', '#f0c070', '#e88a6a'][pm(sg, 3)], 0.14, 0.3), roofs = pm(sg, 2) ? [M.roof, M.roofB] : [M.roofB, M.roofD];
  const shop = ['#e8763a', '#ffd040', '#3a8ad8', '#5ab84a', '#e8c47a', '#ff7ab0'];
  for (let x = x0; x < x0 + 12; x++) {
    for (let y = y0; y <= y0 + 6; y++) put(x, y, 1, M.marble, id);
    for (let z = 2; z <= 6; z++) put(x, y0, z, back, id);
    if (pm(x, 4) === 1) { face(x, y0, 2, 'l', '#3a2428'); face(x, y0, 3, 'l', '#3a2428'); put(x + 1, y0 + 1, 2, mat(shop[pm(x >> 2, 6)]), id); }
    if (pm(x, 2) === 0) for (let z = 2; z <= 5; z++) put(x, y0 + 5, z, M.marble, id);
    else if (pm(x, 4) === 3) put(x, y0 + 5, 5, mat(AWN[pm(x >> 2, AWN.length)], 0.1, 0.2), id);
    put(x, y0 + 5, 6, M.marble, id); face(x, y0 + 5, 6, 'l', pm(x, 2) ? '#3a64c8' : '#e8483a');
    for (const [y, top] of [[y0, 9], [y0 + 1, 9], [y0 + 2, 8], [y0 + 3, 8], [y0 + 4, 7], [y0 + 5, 7]]) for (let z = 7; z <= top; z++) { put(x, y, z, z === top ? roofs[(y - y0) % 2] : M.roofD, id); if (x === x0 + 11) face(x, y, z, 'r', '#f4ece0'); }
  }
}
function block(Wd, x0, y0, bx, by) {   // a block of the lower town: four houses, or two, or a garden with a well
  const R = k => h3(bx * 3.1 + 0.5, by * 5.7 + 0.25, k), kind = R(0);
  if (kind < 0.12) {
    const g = Wd.newId(); for (let x = x0; x < x0 + 12; x++) for (let y = y0; y < y0 + 11; y++) Wd.put(x, y, 0, pm(x + y, 2) ? M.grass : mat('#a8d068', 0.18, 0.36), g);
    tree(Wd, x0 + 3, y0 + 3, 1, R(1)); tree(Wd, x0 + 8, y0 + 7, 1, R(2)); tree(Wd, x0 + 9, y0 + 2, 1, R(3));
    const wl = Wd.box(x0 + 4, y0 + 7, 1, 2, 2, 2, M.stone); Wd.put(x0 + 4, y0 + 7, 2, mat('#3a6ac8'), wl);
    return;
  }
  const cells = kind < 0.32 ? [[0, 0, 7, 11], [7, 0, 5, 11]] : [[0, 0, 6, 5], [6, 0, 6, 5], [0, 5, 6, 6], [6, 5, 6, 6]];
  cells.forEach(([dx, dy, w, d], k) => house(Wd, x0 + dx, y0 + dy, 1, w, d, (dy ? 4 : 6) + Math.floor(R(10 + k) * 5), WALL_M[Math.floor(R(20 + k) * WALL_M.length)],
    { flat: R(30 + k) < 0.3, alongY: d > 6 || R(40 + k) < 0.5, door: R(50 + k) < 0.5 ? '#3a6ab4' : '#c8483a', awning: R(60 + k) < 0.5 ? AWN[Math.floor(R(70 + k) * AWN.length)] : null, seed: R(80 + k) }));
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
  const heap = Wd.newId(); for (let y = y0 + 4; y < y0 + 10; y++) for (let k = 0; k < 6 - (y - y0 - 4); k++) put(x0 + 12 + k, y, 1, M.earth, heap);
  const cr = Wd.newId(), ch = top + 10;
  box(x0 + 15, y0 + 4, 1, 1, 1, ch, M.woodD, cr);
  for (let x = x0 + 4; x <= x0 + 15; x++) put(x, y0 + 4, ch, M.woodD, cr);
  box(x0 + 13, y0 + 1, 1, 2, 3, 3, M.wood, cr);
  const fu = box(x0 - 1, y0 + 15, 1, 3, 3, 3, mat('#c8724a', 0.18, 0.36)); box(x0, y0 + 16, 4, 1, 1, 3, mat('#a85a3a'), fu);
  Wd.face(x0, y0 + 17, 1, 'l', '#ffb030'); Wd.face(x0, y0 + 17, 2, 'l', '#ff7a20');
  return { crane: [x0 + 4, y0 + 4, ch], chimney: [x0, y0 + 16, 7] };
}
// A hull along x, bow towards +x: Elpis, merchantmen, a warship, little boats. Returns where the rigging goes.
function ship(Wd, o) {
  const { put, box, face } = Wd, id = Wd.newId(), xs = o.xs, xe = o.xe, yc = o.yc, L = xe - xs, zt = o.zt == null ? 2 : o.zt;
  const hw = x => Math.max(0, Math.round(o.hw * Math.min(1, (x - xs) / Math.max(1.5, L * 0.16), (xe - x) / Math.max(2, L * 0.25))));
  for (let x = xs; x <= xe; x++) { const w = hw(x); for (let y = yc - w; y <= yc + w; y++) for (let z = -1; z <= zt; z++) {
    const edge = Math.abs(y - yc) === w || x === xs || x === xe;
    if (!edge && z !== zt - 1) continue;
    put(x, y, z, z === zt ? M.wood : z === zt - 1 ? (edge ? o.band : o.deck || M.deck) : z === -1 ? M.wet : o.hull || M.hull, id);
  } }
  const out = { kind: o.kind, top: null, bow: [xe + 1, yc, zt + 1], stern: [xs, yc, zt + 1], deck: [[xs + 3, yc], [Math.round(xs + L * 0.7), yc]] };
  if (o.post) { const s = L > 12 ? [[xs, zt + 1], [xs, zt + 2], [xs - 1, zt + 3], [xs - 1, zt + 4], [xs, zt + 5], [xs + 1, zt + 5]] : [[xs, zt + 1], [xs - 1, zt + 2]]; for (const [x, z] of s) put(x, yc, z, M.wood, id); put(xe + 1, yc, zt, M.wood, id); put(xe + 1, yc, zt + 1, M.wood, id); out.stern = [xs, yc, zt + 5]; out.bow = [xe + 1, yc, zt + 1]; }
  if (o.ram) { put(xe + 1, yc, -1, M.bronze, id); put(xe + 2, yc, -1, M.bronze, id); }
  if (o.eye) { face(xe - 2, yc + hw(xe - 2), zt - 1, 'l', '#ffffff'); face(xe - 3, yc + hw(xe - 3), zt - 1, 'l', INK); }
  if (o.oars) for (let x = xs + 3; x <= xe - 4; x += 2) for (const s of [-1, 1]) { const w = hw(x); put(x, yc + s * (w + 1), zt - 1, M.woodD, id); put(x, yc + s * (w + 2), zt - 2, M.woodD, id); put(x, yc + s * (w + 3), -1, M.woodD, id); }
  if (o.cargo) for (let x = xs + 3; x < xe - 3; x += 2) { const c = mat(o.cargo, 0.16, 0.34); put(x, yc - 1, zt - 1 + 1, c, id); put(x, yc + 1, zt, c, id); }
  if (o.mast) {
    const mx = Math.round(xs + L * 0.48);
    box(mx, yc, zt, 1, 1, o.mast, M.woodD, id); out.top = [mx, yc, zt + o.mast];
    if (o.yard) { const half = Math.max(3, Math.round(L * 0.3)); for (let x = mx - half; x <= mx + half; x++) { put(x, yc, zt + o.mast - 1, M.wood, id); if (Math.abs(x - mx) < half) put(x, yc, zt + o.mast - 2, M.linen, id); } }
    if (o.sail) {   // set and drawing, seen along the hull so it reads as a sail
      const sw = Math.max(3, Math.round(L * 0.22)), z0 = zt + 3, z1 = zt + o.mast - 1;
      for (let x = mx - sw; x <= mx + sw; x++) { put(x, yc - 1, z1 + 1, M.wood, id); for (let z = z0; z <= z1; z++) if (Math.abs(x - mx) <= sw - (z === z0 ? 1 : 0)) put(x, yc - 1, z, (z1 - z) % 3 === 1 && o.stripe ? M.sailR : M.sail, id); }
    }
  }
  return out;
}
function buildShip(Wd, kind) {   // Elpis, or a bigger hull with a cabin aft, moored along the quay
  const { put, box, face } = Wd, big = kind !== 'small', xs = big ? -27 : -24, xe = big ? 12 : 8, yc = QB - 6, id = Wd.newId();
  const hw = x => Math.max(0, Math.round((big ? 4.8 : 4.2) * Math.min(1, (x - xs) / 5, (xe - x) / 8)));
  for (let x = xs; x <= xe; x++) {
    const w = hw(x);
    for (let y = yc - w; y <= yc + w; y++) for (let z = -1; z <= 2; z++) {
      const edge = Math.abs(y - yc) === w || x === xs || x === xe;
      if (!edge && z !== 1) continue;
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
  return { top: [mx, yc, 17], bow: [xe + 2, yc, 4], stern: [xs - 1, yc, 8], deck: [[mx - 6, yc], [mx + 9, yc - 2]], quay: true };
}
function smallBoat(Wd, x, y, c, alongY) {   // a little boat tied up, five long, painted along the side
  const id = Wd.newId(), rim = { t: '#d8a060', l: c, r: mix(c, '#2a2850', 0.3) }, L = 5;   // a wooden gunwale, the sides painted
  for (let k = 0; k < L; k++) for (let s = -1; s <= 1; s++) {
    const end = k === 0 || k === L - 1; if (end && s) continue;
    const [X, Y] = alongY ? [x + s, y + k] : [x + k, y + s];
    if (!end && !s) { Wd.put(X, Y, -1, k === 2 ? M.wood : M.woodD, id); continue; }
    Wd.put(X, Y, -1, M.wet, id); Wd.put(X, Y, 0, rim, id);
  }
  const [X, Y] = alongY ? [x, y + L] : [x + L, y]; Wd.put(X, Y, 0, M.wood, id);
}
function stall(Wd, x0, y0, robe, i) {   // two posts at the back, a striped awning over the keeper, a counter in front with the wares
  const { put, face } = Wd, id = Wd.newId(), wd = mat('#b47a44', 0.18, 0.36), stripe = mat(robe, 0.16, 0.32);
  for (const x of [x0, x0 + 6]) for (let z = 1; z < 10; z++) put(x, y0, z, wd, id);
  for (let x = x0; x <= x0 + 6; x++) for (let y = y0 - 1; y <= y0 + 2; y++) put(x, y, 10, (x - x0 + 10) % 4 < 2 ? stripe : M.linen, id);
  for (let x = x0; x <= x0 + 6; x++) if ((x - x0 + 10) % 4 < 2) face(x, y0 + 2, 10, 'l', mix(robe, '#2a2850', 0.3));
  for (let x = x0 + 1; x <= x0 + 5; x++) { put(x, y0 + 4, 1, wd, id); put(x, y0 + 4, 2, stripe, id); put(x, y0 + 4, 3, M.deck, id); face(x, y0 + 4, 2, 'l', x % 2 ? mix(robe, '#ffffff', 0.4) : robe); }
  const wares = [[mat('#e8763a'), 2], [mat('#ffd040'), 1], [mat('#3a3440'), 1], [mat('#9a6a3a'), 1], [mat('#e8c47a'), 2], [M.marble, 2], [mat('#e0e4ec'), 1]][i % 7];
  for (let x = x0 + 1; x <= x0 + 5; x++) if ((x - x0) % 2 === 1) for (let z = 4; z < 4 + wares[1]; z++) put(x, y0 + 4, z, wares[0], id);
}

// ---------- drawing cubes: the town for a picture, and small models (boats) that move ----------
function raster(V, W, H, OX, OY, model) {
  const N = W * H, rgba = new Uint8ClampedArray(N * 4), depth = new Float32Array(N).fill(-1e9), idb = new Uint16Array(N), rgb = new Map();
  const col = c => { let n = rgb.get(c); if (n === undefined) { n = parseInt(c.slice(1), 16); rgb.set(c, n); } return n; };
  const vs = [];
  for (const v of V.values()) { const X = OX + (v.x - v.y) * 2, Y = OY + v.x + v.y - 2 * v.z; if (X > -5 && X < W + 1 && Y > -5 && Y < H + 1) vs.push(v); }
  vs.sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z) || a.z - b.z);
  const plot = (x, y, n, d, id) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x; if (d < depth[i]) return;
    depth[i] = d; idb[i] = id; rgba[i * 4] = n >> 16 & 255; rgba[i * 4 + 1] = n >> 8 & 255; rgba[i * 4 + 2] = n & 255; rgba[i * 4 + 3] = 255;
  };
  for (const v of vs) {
    const X = OX + (v.x - v.y) * 2, Y = OY + v.x + v.y - 2 * v.z, d = v.x + v.y + v.z, t = col(v.t), l = col(v.l), r = col(v.r), id = v.id & 65535 || 1;
    plot(X + 1, Y, t, d, id); plot(X + 2, Y, t, d, id);
    for (let i = 0; i < 4; i++) plot(X + i, Y + 1, t, d, id);
    for (let j = 2; j < 4; j++) { plot(X, Y + j, l, d, id); plot(X + 1, Y + j, l, d, id); plot(X + 2, Y + j, r, d, id); plot(X + 3, Y + j, r, d, id); }
  }
  const mark = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let best = -1e9;
    if (x + 1 < W) { const j = i + 1; if (idb[j] && idb[j] !== idb[i] && depth[j] > depth[i] + 0.5 && depth[j] > best) best = depth[j]; }
    if (x > 0) { const j = i - 1; if (idb[j] && idb[j] !== idb[i] && depth[j] > depth[i] + 0.5 && depth[j] > best) best = depth[j]; }
    if (y + 1 < H) { const j = i + W; if (idb[j] && idb[j] !== idb[i] && depth[j] > depth[i] + 0.5 && depth[j] > best) best = depth[j]; }
    if (y > 0) { const j = i - W; if (idb[j] && idb[j] !== idb[i] && depth[j] > depth[i] + 0.5 && depth[j] > best) best = depth[j]; }
    if (best > -1e9) mark.push(i, best);
  }
  for (let k = 0; k < mark.length; k += 2) {
    const i = mark[k]; rgba[i * 4] = 22; rgba[i * 4 + 1] = 20; rgba[i * 4 + 2] = 28; rgba[i * 4 + 3] = 255;
    if (!idb[i]) depth[i] = model ? mark[k + 1] - 0.5 : -1e8;   // an outline drawn over nothing: on water for the town, at the edge for a model
  }
  return { rgba, depth };
}
function renderWorld(world, W, H) { const { OX, OY } = camera(W, H), R = raster(world.V, W, H, OX, OY, false); return { W, H, OX, OY, rgba: R.rgba, depth: R.depth }; }
function model(build) {
  const Wd = makeWd(); build(Wd);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const v of Wd.V.values()) { const X = (v.x - v.y) * 2, Y = v.x + v.y - 2 * v.z; x0 = Math.min(x0, X); x1 = Math.max(x1, X + 3); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y + 3); }
  const ox = 1 - x0, oy = 1 - y0, w = x1 - x0 + 3, h = y1 - y0 + 3, R = raster(Wd.V, w, h, ox, oy, true);
  return { w, h, ox, oy, rgba: R.rgba, depth: R.depth, V: Wd.V };
}
function mirrored(Wd0, L) {   // the same builder, with x turned round: a boat built bow to +x comes out bow to -x
  const f = x => L - x;
  return { ...Wd0, put: (x, y, z, m, id) => Wd0.put(f(x), y, z, m, id), get: (x, y, z) => Wd0.get(f(x), y, z), face: (x, y, z, s, c) => Wd0.face(f(x), y, z, s, c),
    box: (x0, y0, z0, w, d, h, m, id) => Wd0.box(L - x0 - w + 1, y0, z0, w, d, h, typeof m === 'function' ? (x, y, z) => m(f(x), y, z) : m, id) };
}
function boatModel(kind, dir) {   // the same boat facing either way along x
  const m = model(Wd0 => {
    const L = { row: 6, fish: 7, sail: 10, tri: 28 }[kind], Wd = dir > 0 ? Wd0 : mirrored(Wd0, L);
    if (kind === 'row') ship(Wd, { xs: 0, xe: L, yc: 0, hw: 1, zt: 1, band: mat('#e8483a'), hull: M.wood });
    if (kind === 'fish') ship(Wd, { xs: 0, xe: L, yc: 0, hw: 1, zt: 1, band: mat('#3a8ad8'), hull: M.wood, post: true });
    if (kind === 'sail') ship(Wd, { xs: 0, xe: L, yc: 0, hw: 1, zt: 1, band: mat('#ffd040'), hull: M.wood, post: true, mast: 8, sail: true, stripe: true });
    if (kind === 'tri') ship(Wd, { xs: 0, xe: L, yc: 0, hw: 2, zt: 1, band: mat('#e8483a'), hull: mat('#3a3440', 0.1, 0.2), post: true, oars: true, ram: true, eye: true, mast: 11, sail: true, stripe: true });
  });
  m.L = { row: 6, fish: 7, sail: 10, tri: 28 }[kind]; return m;
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
const CAT = [sprite(['K...KK.', 'K..KooK', 'KK.KoeK', '.KKoooK', '.KoooK.', '.KoKoK.'], { K: INK, o: '#ff9a3a', e: INK }), sprite(['.....KK', '....KooK', 'K..KoeK.', 'KKKoooK.', '.KoooK..', '.KoKoK..'], { K: INK, o: '#ff9a3a', e: INK })];
const DOG = [sprite(['.....KK.', 'K...KddK', 'KKKKKdeK', '.KdddddK', '.KdKKdK.', '.KK..KK.'], { K: INK, d: '#e8e0d0', e: INK }), sprite(['.....KK.', 'K...KddK', 'KKKKKdeK', '.KdddddK', '..KdKdK.', '..KK.KK.'], { K: INK, d: '#e8e0d0', e: INK })];
const DONKEY = [0, 1].map(f => sprite(['KK..........', 'KgK.........', 'KggKKKKKKK..', '.KggggggggK.', '.KgwwwwwwgK.', '..KwwwwwwK..', '..KggggggK..', f ? '..KgK..KgK..' : '..KgK..gKK..', f ? '..KK...KK...' : '..KK..KK....'], { K: INK, g: '#9a8a7a', w: '#e8b45a' }));
const HENS = sprite(['.K....K..', 'KwK..KrK.', 'KwwK.KwwK', '.KK...KK.'], { K: INK, w: '#ffffff', r: '#e8483a' });
const AMPH = sprite(['.KK.', 'KaaK', 'KaaK', 'KaaaK', 'KaaK', '.KaK', '..K.'], { K: INK, a: '#e8763a' });
const GULL = [sprite(['K.....K', 'KK...KK', '.KKKKK.'], { K: INK }), sprite(['.......', 'KKKKKKK', '..KKK..'], { K: INK })];
const WANT = sprite(['.KKK.', 'KyyyK', 'KyKyK', 'KyyyK', '.KKK.', '..K..'], { K: INK, y: '#ffd040' });
const SWIM = [sprite(['..KKK..', '.KhhhK.', 'wKsssKw', '.wwKww.'], { K: INK, h: '#2a1d14', s: '#d8985e', w: '#ffffff' }), sprite(['.......', '..KKK..', 'wKhhhKw', 'wwKKKww'], { K: INK, h: '#2a1d14', w: '#ffffff' })];
const GUARD = person({ skin: '#c88a58', hair: '#2a1d14', robe: '#c8324a', style: 'short', hat: 'pilos' }, 'stand');
const MARINE = person({ skin: '#d8985e', hair: '#1b130e', robe: '#c8324a', style: 'short', hat: 'pilos', hatC: '#ffb44a' }, 'stand');
let BOATS = null;   // built on first use: the game's mix() must exist by then
const boats = () => BOATS || (BOATS = { row: [boatModel('row', 1), boatModel('row', -1)], fish: [boatModel('fish', 1), boatModel('fish', -1)], sail: [boatModel('sail', 1), boatModel('sail', -1)], tri: [boatModel('tri', 1), boatModel('tri', -1)] });

// Who is where. Walkers keep to lanes clear of the stalls and the goods; boats keep to lanes clear of the ships.
const LANES = [
  { y: QB + 9, n: 8, a: -24 }, { y: QB + 11, n: 8, a: -24 }, { y: STOA_Y + 8, n: 7, a: -80 }, { y: BY + 11, n: 5, a: -80 }, { y: BY + 24, n: 5, a: -80 },
];
const ACROSS = [   // people going up and down the streets of the lower town, through the stoa's passages
  { x: 0, n: 2 }, { x: 28, n: 2 }, { x: 56, n: 2 }, { x: -14, n: 1 }, { x: 14, n: 1 }, { x: 42, n: 1 }, { x: 70, n: 1 }, { x: 84, n: 2 },
];
const IDLE = (() => {   // [x, y, z, look, carry, facing left]
  const L = [], [px_, py] = PLAZA;
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + 0.4, r = 5 + (k % 3); L.push([Math.round(px_ + Math.cos(a) * r), Math.round(py + Math.sin(a) * r), 1, 100 + k, k % 4 === 0 ? 'basket' : null, Math.cos(a) > 0]); }
  for (let x = -20; x < 130; x += 5) L.push([x + (x % 3), STOA_Y + 3, 1, 200 + x, null, x % 2 === 0]);
  for (let x = -18; x < 130; x += 9) L.push([x, STOA_Y + 7, 1, 300 + x, x % 3 ? null : 'amphora', x % 2 !== 0]);
  for (let i = 0; i < 9; i++) if (i % 2 === 0) L.push([STALL_X(i) + 5, QB + 8, 1, 400 + i, i % 3 ? 'basket' : null, true]);
  for (let x = -26; x < 130; x += 7) L.push([x, QB + 13, 1, 500 + x, null, x % 2 === 0]);
  L.push([-25, QB + 2, 1, 601, null, false], [-22, QB + 6, 1, 602, 'sack', true], [-2, QB + 8, 1, 603, null, false], [7, QB + 6, 1, 604, 'amphora', true], [14, QB + 6, 1, 605, null, false]);
  L.push([-24, -33, 1, 610, null, false], [-17, -33, 1, 611, 'sack', true], [-12, -32, 1, 612, null, false], [-3, -32, 1, 613, null, true]);
  L.push([61, 9, 1, 620, null, false], [60, 16, 1, 621, null, true], [61, 27, 1, 622, 'basket', false]);
  L.push([20, 2, 1, 630, null, true], [18, -6, 1, 631, null, false], [25, 30, 1, 632, null, false]);
  return L;
})();

// ---------- the water: flat and bright, with little ripples drawn on it ----------
function waterFrames(Rw, W, H, hz, water) {
  const N = W * H, isW = new Uint8Array(N), d = Rw.depth;
  for (let y = hz; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (d[i] === -1e9) isW[i] = 1; }
  const c3 = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const WA = c3(water), LI = c3(mix(water, '#ffffff', 0.42)), DK = c3(mix(water, '#1a4a9a', 0.2)), WH = [255, 255, 255];
  const base = new Uint8ClampedArray(Rw.rgba);
  const set = (buf, i, c) => { buf[i * 4] = c[0]; buf[i * 4 + 1] = c[1]; buf[i * 4 + 2] = c[2]; buf[i * 4 + 3] = 255; };
  for (let i = 0; i < N; i++) if (isW[i]) set(base, i, WA);
  const free = (x, y) => x > 0 && x < W - 1 && y > hz && y < H - 1 && isW[y * W + x] && isW[y * W + x - 1] && isW[y * W + x + 1] && isW[(y - 1) * W + x] && isW[(y + 1) * W + x];
  const frames = [new Uint8ClampedArray(base), new Uint8ClampedArray(base)];
  // a light line of foam where the water meets a wall, a rock or a hull
  for (let y = hz + 2; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!isW[i] || isW[i - W] || d[i - W] !== -1e8 || isW[i - 2 * W]) continue;
    frames[0][i * 4 + 3] = 255; if (pm(x, 4) < 3) set(frames[0], i, LI); if (pm(x + 2, 4) < 3) set(frames[1], i, LI);
  }
  const SH = [[[0, 0], [1, 0], [2, 1], [3, 1]], [[0, 1], [1, 0], [2, 0], [3, 1]], [[0, 0], [1, 0], [2, 0], [3, 1], [4, 1]], [[0, 0], [1, 0]]];
  for (let cy = Math.floor(hz / 6); cy * 6 < H; cy++) for (let cx = -1; cx * 11 < W + 11; cx++) {
    const r = k => hash(cx * 31.7 + cy * 57.3 + k * 11.1), kind = r(3);
    const shape = kind < 0.5 ? SH[0] : kind < 0.72 ? SH[1] : kind < 0.88 ? SH[2] : SH[3], colr = kind < 0.72 ? LI : kind < 0.88 ? DK : WH;
    const x0 = cx * 11 + (cy % 2) * 5 + Math.floor(r(1) * 6), y0 = cy * 6 + Math.floor(r(2) * 3);
    for (let f = 0; f < 2; f++) {
      const dx = f ? (r(4) < 0.5 ? 1 : -1) : 0, dy = f && r(5) < 0.3 ? 1 : 0;
      if (f && r(6) < 0.15) continue;   // some ripples come and go
      if (!shape.every(([a, b]) => free(x0 + a + dx, y0 + b + dy))) continue;
      for (const [a, b] of shape) set(frames[f], (y0 + b + dy) * W + x0 + a + dx, colr);
    }
  }
  return { frames, isW, LI, WH };
}

// ---------- the scene, as the game calls it ----------
const CACHE = { key: null };
function drawRhodesIso(W, H, t, o) {
  const pal = dayPal(o.clock), hz = horizon(H), stage = o.stage || 1, hullKind = (S && S.hull) || 'small';
  const ids = merchantsAt('rhodes', S ? S.ch : 1).filter(id => !MERCHANTS[id].noStall).sort((a, b) => MERCHANTS[a].at - MERCHANTS[b].at);
  const dusk = Math.max(0, Math.min(1, (o.clock - 0.72) / 0.2), Math.min(1, (0.12 - o.clock) / 0.12));
  // the town, built once for this size
  const key = W + 'x' + H + ':' + stage + ':' + hullKind + ':' + ids.join(',');
  if (CACHE.key !== key) {
    const world = buildWorld(hullKind, stage, W, H, ids.map(id => MERCHANTS[id].look.robe));
    CACHE.key = key; CACHE.world = world; CACHE.R = renderWorld(world, W, H); CACHE.traders = ids.map(id => person(MERCHANTS[id].look, 'stand')); CACHE.waterKey = null;
    CACHE.cv = document.createElement('canvas'); CACHE.cv.width = W; CACHE.cv.height = H; CACHE.ctx = CACHE.cv.getContext('2d'); CACHE.img = CACHE.ctx.createImageData(W, H); CACHE.dep = new Float32Array(W * H);
  }
  const water = mix(WATER, pal.seaTop, dusk * 0.7);
  if (CACHE.waterKey !== water) { CACHE.water = waterFrames(CACHE.R, W, H, hz, water); CACHE.waterKey = water; }
  const Rw = CACHE.R, out = CACHE.img.data, dep = CACHE.dep, { OX, OY } = Rw, Wt = CACHE.water, view = CACHE.world.view;
  out.set(Wt.frames[Math.floor(t * 1.5) % 2]); dep.set(Rw.depth);
  const sx = (x, y) => OX + (x - y) * 2, sy = (x, y, z) => OY + x + y - 2 * z;
  const paint = (k, c) => { out[k * 4] = c[0]; out[k * 4 + 1] = c[1]; out[k * 4 + 2] = c[2]; out[k * 4 + 3] = 255; };
  const drawAt = (sp, x, y, z, flip) => {
    const X = Math.round(sx(x, y)) + 2 - (sp.w >> 1), Y = Math.round(sy(x, y, z)) + 2 - sp.h, base = x + y + z + 0.6;
    for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) {
      const si = (j * sp.w + (flip ? sp.w - 1 - i : i)) * 4; if (!sp.data[si + 3]) continue;
      const px_ = X + i, py = Y + j; if (px_ < 0 || py < 0 || px_ >= W || py >= H) continue;
      const k = py * W + px_, d = base + (sp.h - 1 - j) / 2;
      if (d < dep[k] - 0.3) continue;
      dep[k] = Math.max(dep[k], d); out[k * 4] = sp.data[si]; out[k * 4 + 1] = sp.data[si + 1]; out[k * 4 + 2] = sp.data[si + 2]; out[k * 4 + 3] = 255;
    }
  };
  const drawVox = (m, x, y, z, dir) => {
    const X0 = Math.round(sx(x, y)) - m.ox, Y0 = Math.round(sy(x, y, z)) - m.oy, base = x + y + z;
    for (let j = 0; j < m.h; j++) { const py = Y0 + j; if (py < 0 || py >= H) continue;
      for (let i = 0; i < m.w; i++) { const s = j * m.w + i; if (!m.rgba[s * 4 + 3]) continue; const px_ = X0 + i; if (px_ < 0 || px_ >= W) continue;
        const k = py * W + px_, d = base + m.depth[s]; if (d < dep[k] - 0.3) continue;
        dep[k] = d; out[k * 4] = m.rgba[s * 4]; out[k * 4 + 1] = m.rgba[s * 4 + 1]; out[k * 4 + 2] = m.rgba[s * 4 + 2]; out[k * 4 + 3] = 255; } }
    if (!dir) return;   // a wake behind a moving boat, and foam at the bow
    for (let k = 1; k < 9; k++) for (const s of [-1, 1]) {
      const wx = x - dir * k * 0.9 + (dir > 0 ? 0 : m.L), wy = y + s * (1.2 + k * 0.35), X = Math.round(sx(wx, wy)) + 2, Y = Math.round(sy(wx, wy, 0)) + 2;
      for (let q = 0; q < 2; q++) { const xx = X + q, i = Y * W + xx; if (xx >= 0 && xx < W && Y >= 0 && Y < H && Wt.isW[i] && dep[i] < -1e8 + 1 && (k + q + Math.floor(t * 6)) % 3) paint(i, k < 4 ? Wt.WH : Wt.LI); }
    }
  };
  const all = [];
  const span = (y, a, b) => [Math.max(a, view.umin + y - 4), Math.min(b, view.umax + y + 4)];
  ids.forEach((id, i) => all.push(['p', CACHE.traders[i], STALL_X(i) + 3, QB + 6, 1, i % 2 === 1]));
  LANES.forEach((ln, li) => { const [a, b] = span(ln.y, ln.a, 400); if (b <= a) return;
    for (let n = 0; n < ln.n; n++) { const k = li * 40 + n, dir = n % 2 ? -1 : 1, v = 1.3 + hash(k * 3.3) * 1.4, d = (t * v + hash(k * 1.7) * (b - a)) % (b - a), x = dir > 0 ? a + d : b - d, y = ln.y + (n % 3 === 2 ? 1 : 0);
      const carry = ['amphora', null, 'basket', null, 'sack', null][Math.floor(hash(k * 5.1) * 6)];
      all.push(['p', folk(k, carry)[Math.floor(t * 4 + n) % 2], x, y, 1, dir < 0]); } });
  ACROSS.forEach((ac, ai) => { const a = Math.max(QB + 12, view.vmin - ac.x - 2), b = Math.min(view.yHi, 400); if (b <= a) return;
    for (let n = 0; n < ac.n; n++) { const k = 900 + ai * 10 + n, dir = n % 2 ? -1 : 1, v = 1.2 + hash(k * 3.3), d = (t * v + hash(k * 1.7) * (b - a)) % (b - a), y = dir > 0 ? a + d : b - d;
      all.push(['p', folk(k, n % 2 ? 'basket' : null)[Math.floor(t * 4 + n) % 2], ac.x + 0.5, y, 1, dir > 0]); } });
  for (const [x, y, z, k, carry, flip] of IDLE) all.push(['p', folk(k, carry)[0], x, y, z, flip]);
  const W0 = CACHE.world, sh = W0.elpis, god = W0.god;
  all.push(['p', folk(41, null)[0], sh.deck[0][0], sh.deck[0][1], 2, false], ['p', folk(42, 'sack')[0], sh.deck[1][0], sh.deck[1][1], 2, true]);
  W0.ships.forEach((s, i) => { if (s === sh || !s.top) return; if (s.kind === 'tri') all.push(['p', MARINE, s.deck[0][0], s.deck[0][1], 1, false], ['p', MARINE, s.deck[1][0], s.deck[1][1], 1, true], ['p', MARINE, s.deck[0][0] + 6, s.deck[0][1], 1, false]); else all.push(['p', folk(60 + i, null)[0], s.deck[0][0], s.deck[0][1], 2, i % 2 === 0]); });
  all.push(['p', GUARD, 19, -14, 18, true]);
  all.push(['p', folk(51, null)[0], 15, 12, god.crane[2] - 10, false], ['p', folk(52, null)[0], 22, 12, god.crane[2] - 10, true]);
  { const x = -6 + Math.sin(t * 0.25) * 8; all.push(['p', DONKEY[Math.floor(t * 3) % 2], x, QB + 7, 1, Math.cos(t * 0.25) < 0]); }
  all.push(['p', CAT[Math.floor(t * 0.8) % 2], 24, QB + 6, 1, false]);
  { const x = -34 + ((t * 3) % 40); all.push(['p', DOG[Math.floor(t * 6) % 2], x, PLAZA[1] + 9, 1, false]); }
  all.push(['p', HENS, -44, 40, 1, false], ['p', HENS, 10, BY - 1, 1, true]);
  for (const [ax, ay] of [[0, QB + 1], [1, QB + 1], [2, QB + 2]]) all.push(['p', AMPH, ax, ay, 1, false]);
  for (const [x, y, ph] of [[28, 14, 0], [29, 19, 1.3], [27.5, 9, 2.1], [57.5, 9, 0.7], [-26, 18, 1.7]]) all.push(['p', SWIM[Math.floor(t * 2 + ph) % 2], x, y, -1, ph > 1]);
  // boats on the move: they go to and fro inside the harbour, and pass by outside it
  const B = boats(), tri = u => { const f = u % 2; return f < 1 ? f : 2 - f; }, dirOf = u => (u % 2) < 1 ? 1 : -1;
  for (const [kind, y, a, b, v, rider] of [['row', -17, -27, 4, 1.4, 71], ['fish', 8, -26, 2, 1.0, 72], ['sail', 11, 28, 52, 1.6, 0], ['row', 15, 67, 92, 1.2, 73], ['row', -22, 27, 50, 1.1, 74], ['fish', -5, 47, 70, 0.9, 75]]) {
    const u = t * v / (b - a), x = a + (b - a) * tri(u), dir = dirOf(u), m = B[kind][dir > 0 ? 0 : 1];
    all.push(['v', m, x, y, 0, dir]); if (rider) all.push(['p', folk(rider, null)[0], x + 3, y, 1, dir < 0]);
  }
  const K = hz - OY - 8;   // a boat comes out from behind the town, or in over the edge of the picture
  for (const [kind, y, v, off, dir] of [['tri', -54, 2.2, 0, 1], ['sail', -64, 1.6, 50, -1], ['fish', -72, 1.2, 20, 1]]) {
    const [a, b] = span(y, Math.max(-70, K + 3 - y), 400), L = b - a + 10, d = (t * v + off) % L, x = dir > 0 ? a + d : b + 10 - d;
    if (b - a < 8) continue;
    all.push(['v', B[kind][dir > 0 ? 0 : 1], x, y, 0, dir]);
  }
  all.sort((p, q) => (p[2] + p[3] + p[4]) - (q[2] + q[3] + q[4]));
  for (const e of all) if (e[0] === 'v') drawVox(e[1], e[2], e[3], e[4], e[5]); else drawAt(e[1], e[2], e[3], e[4], e[5]);
  CACHE.ctx.putImageData(CACHE.img, 0, 0);
  if (dusk > 0) { const c = CACHE.ctx; c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.4 * dusk; c.fillStyle = mix(pal.skyBot, '#3a2a6a', 0.55); c.fillRect(0, 0, W, H); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  G.drawImage(CACHE.cv, 0, 0);
  // rigging, pennants, flags, the crane's rope, the lighthouse fire, smoke, gulls, and the marks over stalls that want what you carry
  const dot = (x, y, c) => { G.fillStyle = c; G.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const ln = (a, b, c) => { const x0 = sx(a[0], a[1]) + 2, y0 = sy(a[0], a[1], a[2]) + 1, x1 = sx(b[0], b[1]) + 2, y1 = sy(b[0], b[1], b[2]) + 1, n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) dot(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); };
  for (const s of W0.ships) if (s.top) { ln(s.top, s.bow, '#5a4a40'); ln(s.top, s.stern, '#5a4a40'); }
  ln([sh.bow[0], sh.bow[1], 3], [7, QB, 2], '#5a4a40'); ln([sh.stern[0] + 2, sh.stern[1], 3], [-19, QB, 2], '#5a4a40');
  W0.ships.forEach((s, i) => { if (!s.top) return; const X = sx(s.top[0], s.top[1]) + 2, Y = sy(s.top[0], s.top[1], s.top[2]); const c = s === sh ? ['#ff5a3a', '#c83a2a'] : [['#3a8ad8', '#2a5aa8'], ['#ffd040', '#c8a020'], ['#5ab84a', '#3a8a3a'], ['#ff7ab0', '#c84a80']][i % 4];
    for (let k = 0; k < 6; k++) dot(X - 1 - k, Y - 2 + Math.round(Math.sin(t * 5 - k + i) * (k / 6)), k < 3 ? c[0] : c[1]); });
  { const X = sx(19, -14) + 2, Y = sy(19, -14, 18); G.fillStyle = '#5a4a40'; G.fillRect(X + 3, Y - 12, 1, 12); for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) dot(X + 2 - i, Y - 12 + j + Math.round(Math.sin(t * 4 - i) * (i / 6)), j === 1 ? '#ffffff' : '#e8483a'); }
  { const [x, y, z] = god.crane, X = sx(x, y) + 2, Y = sy(x, y, z) + 3, sw = Math.round(Math.sin(t * 0.8)); for (let k = 0; k < 16; k++) dot(X + sw * k / 16, Y + k, '#5a4a40'); G.fillStyle = INK; G.fillRect(X - 3 + sw, Y + 16, 7, 5); G.fillStyle = '#ffffff'; G.fillRect(X - 2 + sw, Y + 17, 5, 3); }
  if (W0.lights.fire) { const [x, y, z] = W0.lights.fire, X = sx(x, y) + 2, Y = sy(x, y, z), f = Math.floor(t * 6) % 3; G.fillStyle = INK; G.fillRect(X - 2, Y - 5, 5, 6); G.fillStyle = '#ff7a20'; G.fillRect(X - 1, Y - 4, 3, 4); G.fillStyle = '#ffd040'; G.fillRect(X - (f === 1 ? 1 : 0), Y - 3 - (f === 2 ? 1 : 0), 1 + (f === 1 ? 1 : 0), 2); }
  if (W0.lights.fountain) { const [x, y, z] = W0.lights.fountain, X = sx(x, y) + 2, Y = sy(x, y, z); for (let k = 0; k < 4; k++) { const a = (t * 2 + k / 4) % 1; dot(X + (k < 2 ? -1 : 2) * Math.round(a * 3), Y - 3 + Math.round(a * a * 8), '#ffffff'); } dot(X, Y - 3, '#ffffff'); dot(X + 1, Y - 4, '#ffffff'); }
  { const [x, y, z] = god.chimney, X0 = sx(x, y) + 2, Y0 = sy(x, y, z), puffs = [];
    for (let k = 0; k < 5; k++) { const a = (t * 0.25 + k / 5) % 1; puffs.push([X0 + Math.round(a * 10), Y0 - Math.round(a * 26), 1.6 + a * 3]); }
    for (const [X, Y, r] of puffs) for (let j = -Math.ceil(r) - 1; j <= Math.ceil(r) + 1; j++) for (let i = -Math.ceil(r) - 1; i <= Math.ceil(r) + 1; i++) if (i * i + j * j <= (r + 1) * (r + 1)) dot(X + i, Y + j, INK);
    for (const [X, Y, r] of puffs) for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) if (i * i + j * j <= r * r) dot(X + i, Y + j, j > r * 0.35 ? '#d8dce8' : '#ffffff'); }
  for (let k = 0; k < 5; k++) { const x = ((t * (9 + k * 3) + k * 100) % (W + 20)) - 10, y = hz + 8 + k * 13 + Math.round(Math.sin(t * 1.5 + k) * 3), g = GULL[Math.floor(t * 3 + k) % 2]; for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.data[(j * g.w + i) * 4 + 3]) dot(x + i, y + j, INK); }
  // where to tap: each stall, and a coin over those who want what is in the hold
  const spots = [];
  ids.forEach((id, i) => {
    const x0 = STALL_X(i), X0 = sx(x0, QB + 7) - 1, X1 = sx(x0 + 7, QB + 2) + 5, Y0 = sy(x0, QB + 2, 10) - 4, Y1 = sy(x0 + 7, QB + 7, 0) + 4;
    spots.push({ id, kind: 'merchant', x0: X0, x1: X1, y0: Y0, y1: Y1 });
    if (o.wants && o.wants.has(id)) { const X = sx(x0 + 3, QB + 4), Y = sy(x0 + 3, QB + 4, 12) - 8 - Math.floor(t * 2) % 2; for (let j = 0; j < WANT.h; j++) for (let ii = 0; ii < WANT.w; ii++) { const si = (j * WANT.w + ii) * 4; if (WANT.data[si + 3]) dot(X + ii, Y + j, '#' + ((1 << 24) | (WANT.data[si] << 16) | (WANT.data[si + 1] << 8) | WANT.data[si + 2]).toString(16).slice(1)); } }
  });
  if (o.spots) o.spots.push(...spots);
}

// ---------- at sea: the voyage, and the title page ----------
// The ship sails along x, bow down and to the right; the water, the islands and the other boats slide past her up and to the left.
const SEAKIT = { ships: new Map(), isles: new Map(), foes: null };
const SAIL = { t: '#fffaf0', l: '#f8eedc', r: '#efe2c8' }, SAIL2 = { t: '#f4e8d0', l: '#ece0c6', r: '#e2d4b8' };
const SHIPS = {
  elpis: { L: 30, hw: 4, zt: 2, mast: 16, sw: 8, band: '#e8483a', hull: '#7a4a2a' },
  tyche: { L: 36, hw: 5, zt: 2, mast: 18, sw: 9, band: '#3a8ad8', hull: '#6a4022', cabin: true },
  grain: { L: 44, hw: 6, zt: 3, mast: 22, sw: 11, band: '#ffd040', hull: '#5a3620', cabin: true, fore: true, swan: true },
};
const shipKind = () => S && S.hull === 'large' ? 'grain' : S && bigShip(S) ? 'tyche' : 'elpis';
function voyShip(kind, sail, row, ph) {   // our ship, built once for each way her sail can be set, and for each stroke of the oars
  const key = kind + ':' + sail + ':' + row + ':' + ph; let m = SEAKIT.ships.get(key); if (m) return m;
  const P = SHIPS[kind], { L, hw: HW, zt, mast, sw } = P, mx = Math.round(L * 0.52), meta = { L, zt, HW, mx };
  const hw = x => { const f = Math.min(1, x / (L * 0.24), (L - x) / (L * 0.34)); return Math.max(0, Math.round(HW * Math.sqrt(Math.max(0, f)))); };
  m = model(Wd => {
    const { put, box, face } = Wd, hull = Wd.newId(), rig = Wd.newId(), sl = Wd.newId(), hm = mat(P.hull, 0.18, 0.36), band = mat(P.band, 0.16, 0.32), plank = mat('#c89a5c', 0.12, 0.3);
    for (let x = 0; x <= L; x++) { const w = hw(x); for (let y = -w; y <= w; y++) for (let z = -1; z <= zt; z++) {
      const edge = Math.abs(y) === w || x === 0 || x === L;
      if (!edge && z !== zt - 1) continue;
      put(x, y, z, z === zt ? M.wood : z === zt - 1 ? (edge ? band : x % 2 ? M.deck : plank) : z === -1 ? M.wet : hm, hull);
    } }
    for (const [x, z] of [[L + 1, zt], [L + 1, zt + 1], [L + 2, zt + 2]]) put(x, 0, z, M.wood, hull);
    face(L - 3, hw(L - 3), zt - 1, 'l', '#ffffff'); face(L - 4, hw(L - 4), zt - 1, 'l', INK);   // an eye on the bow, to see the way
    const neck = P.swan ? [[0, zt + 1], [0, zt + 2], [-1, zt + 3], [-1, zt + 4], [-1, zt + 5], [0, zt + 6], [1, zt + 6], [2, zt + 5]] : [[0, zt + 1], [0, zt + 2], [-1, zt + 3], [-1, zt + 4], [0, zt + 5], [1, zt + 5]];
    neck.forEach(([x, z], i) => put(x, 0, z, P.swan && i >= neck.length - 2 ? M.white : M.wood, hull));
    for (const s of [-1, 1]) { const w = hw(3); put(3, s * (w + 1), zt - 1, M.woodD, rig); put(2, s * (w + 2), 0, M.woodD, rig); put(2, s * (w + 2), -1, M.woodD, rig); }   // the steering oars
    if (P.cabin) { const cw = HW - 2; box(2, -cw, zt, 6, 2 * cw + 1, 3, M.wood, hull); for (let x = 1; x <= 8; x++) for (let y = -cw - 1; y <= cw + 1; y++) put(x, y, zt + 3, M.woodD, hull); face(4, cw, zt, 'l', '#3a2418'); face(4, cw, zt + 1, 'l', '#3a2418'); face(6, cw, zt + 1, 'l', INK); }
    box(mx, 0, zt, 1, 1, mast + 1, M.woodD, rig);
    for (let y = -sw - 1; y <= sw + 1; y++) put(mx + 1, y, zt + mast, M.wood, rig);
    const z1 = zt + mast - 1, z0 = sail === 'reef' ? z1 - 3 : zt + 3;
    if (sail === 'furled') for (let y = -sw; y <= sw; y++) put(mx + 1, y, z1, M.linen, sl);
    else {
      for (let y = -sw; y <= sw; y++) for (let z = z0; z <= z1; z++) {
        if (sail === 'slack' && z < z0 + 2 && Math.abs(y) > sw - 2) continue;
        const belly = sail === 'full' && Math.abs(y) < sw - 1 && z > z0 && z < z1 ? 1 : 0;   // a sail with the wind in it bellies forward
        put(mx + 1 + belly, y, z, pm(y, 3) === 0 ? SAIL2 : SAIL, sl);
      }
      if (sail !== 'reef') {   // the rose of Rhodes on the sail
        const zc = z0 + Math.round((z1 - z0) * 0.58), xr = mx + 1 + (sail === 'full' ? 1 : 0), red = { t: '#e0403c', l: '#d83a36', r: '#c8322e' };
        for (const [y, z] of [[0, zc], [-1, zc], [1, zc], [0, zc + 1], [0, zc - 1]]) put(xr, y, z, red, sl);
        put(xr, 0, zc, { t: '#8a1e22', l: '#8a1e22', r: '#7a1a1e' }, sl);
        for (const [y, z] of [[0, zc - 2], [1, zc - 3]]) if (z >= z0) put(xr, y, z, { t: '#5ab84a', l: '#4aa83a', r: '#3a9a32' }, sl);
      }
    }
    // cargo lashed on deck, forward of the mast: crates on one side, a cluster of amphorae on the other, a sack between
    { const x0 = mx + 4, crate = { t: '#f0c878', l: '#a0602e', r: '#7a4422' }, band = '#5a3018', jar = mat('#ee7a3a', 0.16, 0.34), neck = mat('#b84e24', 0.16, 0.34);
      for (const [dx, dy, dz] of [[0, -2, 0], [2, -2, 0], [1, -2, 2]]) {   // three crates, two below and one on top, each with a dark band round it
        const c = Wd.newId(); box(x0 + dx, dy, zt + dz, 2, 2, 2, crate, c);
        for (let i = 0; i < 2; i++) { face(x0 + dx + i, dy + 1, zt + dz, 'l', band); face(x0 + dx + 1, dy + i, zt + dz, 'r', band); }
      }
      for (const [dx, dy] of [[0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [3, 1]]) {   // amphorae, a body two high and a narrower dark neck
        if (Math.abs(dy) > hw(x0 + dx) - 1) continue; const j = Wd.newId(); put(x0 + dx, dy, zt, jar, j); put(x0 + dx, dy, zt + 1, jar, j); put(x0 + dx, dy, zt + 2, neck, j);
      }
      if (hw(x0 + 5) > 1) { const sk = Wd.newId(); put(x0 + 5, 0, zt, mat('#f0d8a0', 0.14, 0.3), sk); put(x0 + 5, -1, zt, mat('#e4c88c', 0.14, 0.3), sk); }
      meta.cargo = [x0, x0 + 6];   // (kept clear of the crew below)
    }
    if (P.fore) {   // a small sail on a mast leaning out over the bow
      for (let k = 0; k < 6; k++) put(L - 2 + Math.floor(k * 0.7), 0, zt + 1 + k, M.woodD, rig);
      if (sail !== 'furled') for (let y = -2; y <= 2; y++) for (let z = zt + 3; z <= zt + 5; z++) put(L + 2, y, z, SAIL, sl);
    }
    if (row) for (let x = 5; x <= L - 5; x += 2) for (const s of [-1, 1]) { const w = hw(x), d = ph ? -1 : 1; for (let k = 0; k <= zt; k++) put(x + d * Math.floor((k + 1) / 2), s * (w + 1 + k), zt - 1 - k, M.woodD, rig); }
  });
  m.meta = { ...meta, top: [mx, 0, zt + mast + 1], bow: [L + 2, 0, zt + 2], stern: [-1, 0, zt + (P.swan ? 6 : 5)], yard: [[mx + 1, -sw - 1, zt + mast], [mx + 1, sw + 1, zt + mast]],
    deck: Array.from({ length: 16 }, (_, k) => [3.5 + k * 2.6, k % 2 ? -(1 + k % 3) : 1 + (k % 3)]).filter(([x, y]) => x < L - 4 && Math.abs(x - mx) > 1.2 && Math.abs(y) < hw(Math.round(x)) && !(P.cabin && x > 1 && x < 9) && !(x > mx + 3 && x < mx + 11)) };   // the crew keep off the cargo
  SEAKIT.ships.set(key, m);
  return m;
}
function foes() {   // pirates, Illyrian raiders and the king's patrol, all coming the other way, bow to -x
  if (SEAKIT.foes) return SEAKIT.foes;
  const dark = mat('#2a1e1a', 0.1, 0.2);
  SEAKIT.foes = {
    hemi: model(W0 => ship(mirrored(W0, 32), { xs: 0, xe: 30, yc: 0, hw: 2, zt: 1, hull: dark, band: mat('#a83a2a'), deck: mat('#5a4030'), post: true, ram: true, eye: true, oars: true, mast: 7, yard: true })),
    lemb: model(W0 => { const Wd = mirrored(W0, 22); ship(Wd, { xs: 0, xe: 14, yc: 0, hw: 1, zt: 1, hull: dark, band: mat('#5a3a2a'), deck: mat('#4a3428'), oars: true, ram: true }); ship(Wd, { xs: 6, xe: 20, yc: -6, hw: 1, zt: 1, hull: dark, band: mat('#5a3a2a'), deck: mat('#4a3428'), oars: true, ram: true }); }),
    patrol: model(W0 => { const Wd = mirrored(W0, 46); const o = { hw: 2, zt: 2, hull: mat('#1e2430', 0.1, 0.2), band: mat('#c9ced3'), deck: mat('#8a7a62'), post: true, ram: true, eye: true, oars: true, mast: 9, yard: true }; ship(Wd, { ...o, xs: 0, xe: 34, yc: 0 }); ship(Wd, { ...o, xs: 10, xe: 44, yc: -9 }); }),
  };
  return SEAKIT.foes;
}
// ---------- the open sea: light wandering over the water in a net of bright lines, as it does through ripples ----------
const SEATEX = { w: 128, h: 64, n: 30, pw: 160, ph: 80 };
function seaTex() {   // a seamless, looping water surface, made once: 30 frames of moving light lines, and broad patches to hide the repeat
  if (SEATEX.frames) return SEATEX;
  const { w, h, n, pw, ph } = SEATEX, gx = 6, gy = 3, cw = w / gx, ch = h / gy, base = [], TAU = 6.2832;
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) base.push([(i + 0.25 + hash(i * 7.1 + j * 3.3) * 0.5) * cw, (j + 0.25 + hash(i * 2.9 + j * 8.7) * 0.5) * ch, hash(i * 5.3 + j * 1.1), 2 + hash(i + j * 9.1) * 2.5]);
  SEATEX.frames = [];
  for (let f = 0; f < n; f++) {
    const a = f / n * Math.PI * 2, pts = base.map(([x, y, q, r]) => [x + Math.cos(a + q * 6.283) * r, y + Math.sin((q < 0.5 ? a : -a) + q * 6.283) * r * 0.5]);
    const T = new Uint8Array(w * h);
    for (let y0 = 0; y0 < h; y0++) for (let x0 = 0; x0 < w; x0++) {
      // bend the cells, so their edges run in waves rather than straight lines (every bend repeats exactly across the tile)
      const x = pm(x0 + 2.6 * Math.sin(TAU * 2 * y0 / h + 0.5 + a) + 1.4 * Math.sin(TAU * 3 * x0 / w + 1.2 - a), w), y = pm(y0 + 1.3 * Math.sin(TAU * 2 * x0 / w + a) + 0.6 * Math.sin(TAU * 3 * y0 / h + 2.1), h);
      const ci = Math.floor(x / cw), cj = Math.floor(y / ch); let f1 = 1e9, f2 = 1e9;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const c = ci + di, r = cj + dj, ii = pm(c, gx), jj = pm(r, gy), pt = pts[jj * gx + ii];
        const dx = x - (pt[0] + (c - ii) * cw), dy = (y - (pt[1] + (r - jj) * ch)) * 2, d = Math.sqrt(dx * dx + dy * dy);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      // the light lines come and go along their length, as they do on real water
      const e = f2 - f1, fade = Math.sin(TAU * 2 * x0 / w + TAU * y0 / h + a * 2) * 0.5 + Math.sin(TAU * 3 * y0 / h - TAU * x0 / w + 0.8) * 0.5;
      T[y0 * w + x0] = fade < -0.45 ? 1 : e < 0.8 && fade > 0.1 ? 3 : e < 1.9 ? 2 : 1;
    }
    SEATEX.frames.push(T);
  }
  SEATEX.patch = new Int8Array(pw * ph);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const u = x / pw * 6.283, v = y / ph * 6.283, s = Math.sin(u * 2 + Math.sin(v) * 1.5) * 0.5 + Math.sin(v * 3 + u + 1.3) * 0.35 + Math.sin(u * 5 - v * 2 + 0.7) * 0.2;
    SEATEX.patch[y * pw + x] = s < -0.55 ? -1 : s > 0.62 ? 1 : 0;
  }
  return SEATEX;
}
function shadowOf(m, svx, svy) {   // where a model's shadow falls on the water: each cube slid along the sunlight down to the surface
  const key = svx.toFixed(1) + ',' + svy.toFixed(1); m.shadows = m.shadows || new Map();
  let s = m.shadows.get(key); if (s) return s;
  const cells = new Set();
  for (const v of m.V.values()) if (v.z >= 0) cells.add(Math.round(v.x + v.z * svx) + ',' + Math.round(v.y + v.z * svy));
  const pts = [...cells].map(k => k.split(',').map(Number));
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [a, b] of pts) { const X = (a - b) * 2, Y = a + b; x0 = Math.min(x0, X); x1 = Math.max(x1, X + 3); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y + 1); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, ox = -x0, oy = -y0, mask = new Uint8Array(Math.max(1, w * h));
  for (const [a, b] of pts) { const X = (a - b) * 2 + ox, Y = a + b + oy; mask[Y * w + X + 1] = mask[Y * w + X + 2] = 1; for (let i = 0; i < 4; i++) mask[(Y + 1) * w + X + i] = 1; }
  s = { w, h, ox, oy, mask }; m.shadows.set(key, s);
  return s;
}
let CLOUDS = null;
const cloudModels = () => CLOUDS || (CLOUDS = [0, 1, 2].map(k => {   // simple clouds of cubes, long along the ship's course: a few round lobes in three tiers, white on top, pale blue sides, no outline
  const m = model(Wd => {
    const id = Wd.newId(), n = 2 + (k % 2), L = 8 + k * 4, blobs = [];
    for (let j = 0; j < n; j++) { const mid = n > 2 && j === 1 ? 1 : 0; blobs.push([j * L / (n - 1), (hash(k * 3.7 + j) - 0.5) * 2, 4.2 + mid * 1.2 + hash(k + j * 5.1) * 1.2, 3.4 + mid, 2 + mid]); }
    const top = { t: '#ffffff', l: '#e4ecf8', r: '#c6d4ea' };
    for (let x = -7; x <= L + 7; x++) for (let y = -6; y <= 6; y++) {
      let h = 0;
      for (const [cx, cy, rx, ry, hm] of blobs) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < 1) h = Math.max(h, d < 0.4 ? hm + 1 : d < 0.78 ? hm : 1); }
      for (let z = 0; z < h; z++) Wd.put(x, y, z, top, id);
    }
  });
  for (let i = 0; i < m.w * m.h; i++) if (m.rgba[i * 4] === 22 && m.rgba[i * 4 + 1] === 20 && m.rgba[i * 4 + 2] === 28) m.rgba[i * 4 + 3] = 0;   // take the outline off
  return m;
}));
const DOLPHIN = sprite(['....KK...', '...KggK..', '.KKgggKKK', 'KgggwwggK', '.KKK.KKK.'], { K: INK, g: '#6a8aa8', w: '#dce8f0' });
const PIRATE = [person({ skin: '#c88a58', hair: '#1b130e', robe: '#3a3440', style: 'short', beard: 2, hat: 'pilos', hatC: '#a8aeb4' }, 'stand'), person({ skin: '#d8985e', hair: '#2a1d14', robe: '#8a3a2a', style: 'curly', beard: 1 }, 'stand')];
const ARCHER = person({ skin: '#c88a58', hair: '#1b130e', robe: '#e8e0d0', style: 'short', hat: 'pilos', hatC: '#c9ced3' }, 'stand');
const SEACACHE = { key: null };
function drawSeaIso(W, H, t, o) {
  const title = G.canvas === els.tcanvas, pal = dayPal(o.clock, o.storm), storm = o.storm || 0;
  const hz = 0, kind = shipKind(), P = SHIPS[kind];   // no sky, no horizon: the sea and the land run off every edge
  const sail = o.night ? 'furled' : storm > 0.3 || o.wind === 'gale' ? 'reef' : o.wind === 'head' ? 'furled' : o.calm ? 'slack' : 'full', rowing = !!o.row, ph = rowing ? Math.floor(t * 2.5) % 2 : 0;
  const ship = voyShip(kind, sail, rowing, ph), mt = ship.meta;
  // where the ship sits on the screen, and the camera that puts her there
  const cx = Math.round(W * (title ? 0.3 : 0.44)), cy = Math.round(H * (title ? 0.8 : 0.6)), OX = cx - mt.L, OY = cy - Math.round(mt.L / 2);
  const sx = (x, y) => OX + (x - y) * 2, sy = (x, y, z) => OY + x + y - 2 * z;
  if (SEACACHE.key !== W + 'x' + H) { SEACACHE.key = W + 'x' + H; SEACACHE.cv = document.createElement('canvas'); SEACACHE.cv.width = W; SEACACHE.cv.height = H; SEACACHE.ctx = SEACACHE.cv.getContext('2d'); SEACACHE.img = SEACACHE.ctx.createImageData(W, H); SEACACHE.dep = new Float32Array(W * H); }
  const out = SEACACHE.img.data, dep = SEACACHE.dep;
  const dusk = Math.max(0, Math.min(1, (o.clock - 0.72) / 0.2), Math.min(1, (0.12 - o.clock) / 0.12));
  const water = mix('#4aa2b6', pal.seaTop, Math.min(0.85, dusk * 0.5 + storm * 0.6));
  const c3 = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const tones = [mix(water, '#1a3a5a', 0.14), water, mix(water, '#ffffff', 0.17), mix(water, '#ffffff', 0.4)].map(c3);
  const LI = c3(mix(water, '#ffffff', 0.42)), WH = [255, 255, 255];
  const paint = (k, c) => { out[k * 4] = c[0]; out[k * 4 + 1] = c[1]; out[k * 4 + 2] = c[2]; out[k * 4 + 3] = 255; };
  const shade = (k, f) => { out[k * 4] = out[k * 4] * f; out[k * 4 + 1] = out[k * 4 + 1] * f; out[k * 4 + 2] = out[k * 4 + 2] * (f + 0.06); };
  const isWater = k => dep[k] === -1e9;
  // the water, sliding past: the speed of the ship over it, from the wind
  const sp = o.calm ? (rowing ? 0.7 : 0.08) : ({ fair: 1.6, light: 1.1, head: rowing ? 0.7 : 0.35, gale: 2.4, storm: 1.2 }[o.wind] || 1.2) * (title ? 0.7 : 1);
  SEACACHE.flow = (SEACACHE.flow || 0) + Math.max(0, Math.min(0.1, t - (SEACACHE.t == null ? t : SEACACHE.t))) * sp * 2; SEACACHE.t = t;   // so a change of wind changes the speed, not the place
  const flow = SEACACHE.flow, rough = storm > 0.3 || o.wind === 'gale' || o.wind === 'head';
  // the sun: its glitter on the water goes from left in the morning to right in the evening, and every shadow falls away from it, long early and late
  // a shadow falls, for each step up, this far across the picture: to the right in the morning, down at noon, to the left in the evening
  const sunC = clamp(o.clock, 0, 1), sunLen = 1 + 2 * Math.abs(sunC - 0.5) * 2, dsx = Math.cos(Math.PI * sunC) * sunLen, dsy = (0.3 + 0.7 * Math.sin(Math.PI * sunC)) * sunLen * 0.6;
  const svx = (dsx / 2 + dsy) / 2, svy = (dsy - dsx / 2) / 2, shine = storm < 0.6 && !o.night;   // the same, as steps across the sea
  const S5 = Math.sqrt(5), mn = Math.min(W, H), gD = mn * 1.25 * (sunC - 0.5), gx = W * 0.5 + gD * 2 / S5, gy = H * (title ? 0.3 : 0.34) + gD / S5, ru = mn * 0.36, rv = mn * 0.11;
  const ST = seaTex(), T = ST.frames[Math.floor(t * 12) % ST.n], fxo = Math.round(2 * flow), fyo = Math.round(flow);
  for (let y = 0; y < H; y++) {
    const rowT = pm(y + fyo, ST.h) * ST.w, rowP = pm((y + fyo) >> 1, ST.ph) * ST.pw, dy = y - gy;
    for (let x = 0; x < W; x++) {
      let tn = T[rowT + pm(x + fxo, ST.w)] + ST.patch[rowP + pm((x + fxo) >> 1, ST.pw)];
      if (shine) { const dx = x - gx, u = (dx * 2 + dy) / S5 / ru, v = (dy * 2 - dx) / S5 / rv; if (u * u + v * v < 0.35) tn++; }
      const col = tones[tn < 0 ? 0 : tn > 3 ? 3 : tn], k = (y * W + x) * 4; out[k] = col[0]; out[k + 1] = col[1]; out[k + 2] = col[2]; out[k + 3] = 255;
    }
  }
  dep.fill(-1e9);
  if (shine) {   // the glitter itself, twinkling
    const gc = c3(mix('#fffbe0', pal.sun, dusk * 0.8)), f8 = Math.floor(t * 8);
    for (let k = 0; k < 260; k++) {
      const a = hash(k * 1.37) * 6.283, r = Math.sqrt(hash(k * 2.71)), u = Math.cos(a) * r * ru, v = Math.sin(a) * r * rv, X = Math.round(gx + (2 * u - v) / S5), Y = Math.round(gy + (u + 2 * v) / S5);
      if (hash(k * 0.73 + f8 * 3.1) > 0.75 - r * 0.35) continue;
      const len = r < 0.35 ? 4 : r < 0.7 ? 3 : 2;   // each glint a little dash along the same slant
      for (let q = 0; q < len; q++) { const xx = X + q, yy = Y + (q >> 1); if (xx >= 0 && xx < W && yy >= 0 && yy < H) paint(yy * W + xx, r < 0.3 && q === 1 ? WH : gc); }
    }
  }
  if (rough) {   // white horses when the wind is up
    const ox = -2 * flow, oy = -flow, j0 = Math.floor(-oy / 6) - 1, j1 = Math.ceil((H - oy) / 6) + 1, SH = [[0, 1], [1, 0], [2, 0], [3, 1], [4, 1], [5, 0]];
    for (let j = j0; j <= j1; j++) { const st = pm(j, 2) * 5, i0 = Math.floor((-8 - ox - st) / 11) - 1, i1 = Math.ceil((W - ox) / 11) + 1;
      for (let i = i0; i <= i1; i++) { const r = k => hash(i * 31.7 + j * 57.3 + k * 11.1); if (r(3) < 0.55) continue; const X = Math.round(i * 11 + st + Math.floor(r(1) * 6) + ox), Y = Math.round(j * 6 + Math.floor(r(2) * 3) + oy);
        for (const [a2, b2] of SH) { const x = X + a2, y = Y + b2; if (x >= 0 && x < W && y >= 0 && y < H) paint(y * W + x, WH); } } }
  }
  // things on the water, each a model or a sprite placed in the world: only the sea out here, no land
  const all = [], umin = Math.floor(-OX / 2) - 4, umax = Math.ceil((W - OX) / 2) + 4;
  const drift = title ? pm((o.scroll || 0) * 0.12, 600) : (o.scroll || 0) * 0.12;
  // other boats about their business, and further out, ships
  const B = boats(), lanes = title || o.night ? [] : [['fish', mt.HW + 8, 0.5, 30, -1, 81], ['sail', -(mt.HW + 20), 0.6, 150, 1, 0], ['sail', mt.HW + 30, 0.8, 200, 1, 0]];   // on the title page, only our own ship
  for (const [kd, y, v, off, dir, rider] of lanes) {
    const span = umax - umin + 90, x = pm(t * v * dir - drift + off, span) + umin + y - 40;
    all.push(['v', B[kd][dir > 0 ? 0 : 1], x, y, 0, dir, false]); if (rider) all.push(['p', folk(rider, null)[0], x + 3, y, 1, dir < 0]);
  }
  // our ship, rising and falling a little, with her crew and whatever is on deck
  const bob = reduceMotion ? 0 : Math.sin(t * 1.8) * (storm ? 0.7 : 0.3);
  all.push(['v', ship, 0, 0, bob, 0, true]);
  const crew = mt.deck.slice(0, Math.max(1, o.crew == null ? 6 : o.crew));
  crew.forEach(([x, y], i) => all.push(['p', folk(150 + i, null)[i % 2], x, y, mt.zt + bob, i % 3 === 0]));
  // dolphins playing at the bow
  if (o.dolphins > 0 || title) for (let k = 0; k < 3; k++) { const a = (t * 0.6 + k * 0.33) % 1, z = Math.sin(a * Math.PI) * 3 - 0.6; if (z > -0.2) all.push(['p', DOLPHIN, mt.L + 4 + k * 4 + a * 6, 6 + k * 2, z, false]); }
  // trouble: pirates, raiders, the king's patrol, coming up alongside
  if (o.pirate) { const F = foes(), near = o.pirate.near, x = mt.L * 0.4 + (1 - near) * 90, y = mt.HW + 9, m = o.raiders ? F.lemb : F.hemi;
    all.push(['v', m, x, y, 0, -1, true]);
    const men = o.raiders ? [[3, 0], [6, 0], [9, 0], [12, 0], [9, -6], [12, -6], [15, -6]] : [[6, 0], [9, 0], [12, 0], [15, 0], [18, 0], [21, 0]];
    men.forEach(([dx, dy], i) => all.push(['p', PIRATE[i % 2], x + dx, y + dy, 1 + (o.pirate.fight ? Math.abs(Math.sin(t * 9 + i)) * 0.6 : 0), true])); }
  if (o.patrol) { const near = o.patrol.near, x = mt.L * 0.3 + (1 - near) * 90, y = mt.HW + 9;
    all.push(['v', foes().patrol, x, y, 0, -1, true]);
    for (let i = 0; i < 6; i++) all.push(['p', ARCHER, x + 8 + i * 4, y, 2, true], ['p', ARCHER, x + 16 + i * 4, y - 9, 2, true]); }
  // the wake behind her, and the bow wave
  const wake = !o.calm && o.wind !== 'head', fr = Math.floor(t * 8);
  if (wake || rowing) for (let k = 1; k < 40; k++) for (const s of [-1, 0, 1]) {   // two arms spreading back, and churned water down the middle
    if (s === 0 && (k > 14 || (k + fr) % 2)) continue;
    const wx = -k * 0.9, wy = s * (mt.HW * 0.6 + k * 0.3), X = Math.round(sx(wx, wy)) + 2, Y = Math.round(sy(wx, wy, 0)) + 3;
    if (s && ((k + fr) % 4 === 0 || k > 30 && (k + fr) % 2)) continue;
    for (let q = 0; q < 3; q++) { const xx = X + q - 1, yy = Y + (q === 2 ? 1 : 0); if (xx >= 0 && xx < W && yy >= hz && yy < H) paint(yy * W + xx, k < 12 ? WH : LI); }
  }
  // draw everything, nearest last
  const drawAt = (sp_, x, y, z, flip) => {
    const X = Math.round(sx(x, y)) + 2 - (sp_.w >> 1), Y = Math.round(sy(x, y, z)) + 2 - sp_.h, base = x + y + z + 0.6;
    for (let j = 0; j < sp_.h; j++) for (let i = 0; i < sp_.w; i++) {
      const si = (j * sp_.w + (flip ? sp_.w - 1 - i : i)) * 4; if (!sp_.data[si + 3]) continue;
      const px_ = X + i, py = Y + j; if (px_ < 0 || py < 0 || px_ >= W || py >= H) continue;
      const k = py * W + px_, d = base + (sp_.h - 1 - j) / 2; if (d < dep[k] - 0.3) continue;
      dep[k] = Math.max(dep[k], d); out[k * 4] = sp_.data[si]; out[k * 4 + 1] = sp_.data[si + 1]; out[k * 4 + 2] = sp_.data[si + 2]; out[k * 4 + 3] = 255;
    }
  };
  const drawVox = (m, x, y, z, foam) => {
    const X0 = Math.round(sx(x, y)) - m.ox, Y0 = Math.round(sy(x, y, z)) - m.oy, base = x + y + z;
    for (let i = 0; i < m.w; i++) { const px_ = X0 + i; if (px_ < 0 || px_ >= W) continue; let low = -1;
      for (let j = 0; j < m.h; j++) { const s = j * m.w + i; if (!m.rgba[s * 4 + 3]) continue; low = j; const py = Y0 + j; if (py < 0 || py >= H) continue;
        const k = py * W + px_, d = base + m.depth[s]; if (d < dep[k] - 0.3) continue;
        dep[k] = d; out[k * 4] = m.rgba[s * 4]; out[k * 4 + 1] = m.rgba[s * 4 + 1]; out[k * 4 + 2] = m.rgba[s * 4 + 2]; out[k * 4 + 3] = 255; }
      if (foam && low >= 0) { const py = Y0 + low + 1; if (py >= hz && py < H) { const k = py * W + px_; if (isWater(k) && pm(px_ + fr, 4) !== 0) paint(k, pm(px_ + fr, 7) < 3 ? WH : LI); } }
    }
  };
  for (const e of all) if (e[0] === 'v') {   // each hull, sail and mast lays its shadow on the water, away from the sun
    const sh = shadowOf(e[1], svx, svy), X0 = Math.round(sx(e[2], e[3])) - sh.ox, Y0 = Math.round(sy(e[2], e[3], 0)) + 1 - sh.oy;
    for (let j = 0; j < sh.h; j++) { const py = Y0 + j; if (py < 0 || py >= H) continue; for (let i = 0; i < sh.w; i++) { if (!sh.mask[j * sh.w + i]) continue; const px_ = X0 + i; if (px_ >= 0 && px_ < W) shade(py * W + px_, 0.62); } }
  }
  all.sort((p, q) => (p[7] != null ? p[7] : p[2] + p[3] + p[4]) - (q[7] != null ? q[7] : q[2] + q[3] + q[4]));
  for (const e of all) if (e[0] === 'v') drawVox(e[1], e[2], e[3], e[4], e[6]); else drawAt(e[1], e[2], e[3], e[4], e[5]);
  // spray at the bow
  if (wake) for (let k = 0; k < 6; k++) { const a = (t * 2 + k / 6) % 1, X = Math.round(sx(mt.L + 1, (k % 2 ? 1 : -1) * (1 + a * 2))) + 2, Y = Math.round(sy(mt.L + 1, 0, bob)) + 2 - Math.round(Math.sin(a * Math.PI) * 3); if (X >= 0 && X < W && Y >= 0 && Y < H) paint(Y * W + X, WH); }
  // rigging and the pennant, drawn in so the clouds can pass over them
  const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) paint(y * W + x, c3(c)); };
  const rope = (a, b, c) => { const x0 = sx(a[0], a[1]) + 2, y0 = sy(a[0], a[1], a[2] + bob) + 1, x1 = sx(b[0], b[1]) + 2, y1 = sy(b[0], b[1], b[2] + bob) + 1, n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) put(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); };
  rope(mt.top, mt.bow, '#5a4a40'); rope(mt.top, mt.stern, '#5a4a40');
  { const X = sx(mt.top[0], mt.top[1]) + 2, Y = sy(mt.top[0], mt.top[1], mt.top[2] + bob); for (let i = 0; i < 7; i++) put(X - 1 - i, Y - 1 + Math.round(Math.sin(t * 6 - i) * (i / 7)), i < 4 ? P.band : mix(P.band, '#2a2850', 0.3)); }
  if (o.patrol) { const x = mt.L * 0.3 + (1 - o.patrol.near) * 90 + 34, y = mt.HW + 9, X = sx(x, y) + 2, Y = sy(x, y, 8); for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) put(X + 1 + i, Y + j + Math.round(Math.sin(t * 4 + i) * (i / 5)), j === 1 && i > 1 ? '#c9a040' : '#efe3cc'); }
  // gulls, each with a little shadow on the water
  const lane = (c, s) => c >= 0 ? [c + 2 * s, s] : [2 * s, -c / 2 + s];   // a point on the line X - 2Y = c, s steps down it to the right
  for (let k = 0; k < (o.night ? 0 : title ? 5 : 4); k++) {
    const c = -2 * H + (k + 0.5) / (title ? 5 : 4) * (W + 2 * H), Ls = (c >= 0 ? (W - c) / 2 : Math.min(W / 2, H + c / 2)) + 20, dir = k % 2 ? -1 : 1, s = pm(t * (4 + k) * dir + k * 37, Ls) - 10;
    const [gx0, gy0] = lane(c, s), x = Math.round(gx0), y = Math.round(gy0) + Math.round(Math.sin(t * 1.5 + k) * 2), g = GULL[Math.floor(t * 3 + k) % 2];
    const dxs = Math.round((svx - svy) * 2 * 8), dys = 16 + Math.round((svx + svy) * 8);
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.data[(j * g.w + i) * 4 + 3]) { const X = x + i + dxs, Y = y + j + dys; if (X >= 0 && Y >= 0 && X < W && Y < H) shade(Y * W + X, 0.7); }
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.data[(j * g.w + i) * 4 + 3]) put(x + i, y + j, INK);
  }
  // clouds drifting over, their shadows sliding across the sea and over the ship
  // the wind carries them the way the ship goes (back the other way in a head wind), high over the water: each drops its own shadow away from the sun
  if (!o.night) { const CL = cloudModels(), nC = storm > 0.3 ? 5 : title ? 3 : 4, A = 22, wdir = o.wind === 'head' ? -1 : 1, v = (o.calm ? 0.25 : 0.5 + sp * 0.5) * wdir, grey = storm > 0.3, list = [];
    for (let k = 0; k < nC; k++) {
      let c = -2 * H + (k + 0.35 + hash(k * 4.1) * 0.3) / nC * (W + 2 * H);
      // a cloud's path keeps clear of the ship (her hull and mast, and the cloud's own width and height); its shadow may still cross her
      const c0 = cx - 2 * cy, lo = c0 - 16 - 56, hi = c0 + 16 + 4 * mt.zt + 2 * (mt.top[2] - mt.zt) + 28; if (c > lo && c < hi) c = c - lo < hi - c ? lo : hi;
      const m = CL[k % 3], y = (OX - 2 * OY + 4 * A - c) / 4;
      const a = Math.max((-90 - OX) / 2 + y, -70 - OY - y + 2 * A), b = Math.min((W + 30 - OX) / 2 + y, H + 40 - OY - y + 2 * A);
      if (b - a < 10) continue;
      list.push([m, a + pm(t * v + k * 61 + hash(k) * 200, b - a), y]);
    }
    for (const [m, x, y] of list) {
      const sh = shadowOf(m, svx, svy), gx2 = x + A * svx, gy2 = y + A * svy, X0 = Math.round(sx(gx2, gy2)) - sh.ox, Y0 = Math.round(sy(gx2, gy2, 0)) + 1 - sh.oy;
      for (let j = 0; j < sh.h; j++) { const py = Y0 + j; if (py < 0 || py >= H) continue; for (let i = 0; i < sh.w; i++) { if (!sh.mask[j * sh.w + i]) continue; const px_ = X0 + i; if (px_ >= 0 && px_ < W) shade(py * W + px_, 0.76); } }
    }
    for (const [m, x, y] of list) {
      const X0 = Math.round(sx(x, y)) - m.ox, Y0 = Math.round(sy(x, y, A)) - m.oy;
      for (let j = 0; j < m.h; j++) { const py = Y0 + j; if (py < 0 || py >= H) continue; for (let i = 0; i < m.w; i++) { const si = (j * m.w + i) * 4; if (!m.rgba[si + 3]) continue; const px_ = X0 + i; if (px_ < 0 || px_ >= W) continue; const k = py * W + px_;
        out[k * 4] = grey ? m.rgba[si] * 0.7 : m.rgba[si]; out[k * 4 + 1] = grey ? m.rgba[si + 1] * 0.72 : m.rgba[si + 1]; out[k * 4 + 2] = grey ? m.rgba[si + 2] * 0.76 : m.rgba[si + 2]; out[k * 4 + 3] = 255; } }
    }
  }
  if (o.night) {   // dark everywhere but round the stern lamp, and the moon laying a path on the water
    const LX = sx(mt.stern[0], mt.stern[1]) + 2, LY = sy(mt.stern[0], mt.stern[1], mt.stern[2] + bob) - 1, r = Math.min(W, H) * 0.24 * (0.96 + Math.sin(t * 7) * 0.04), nC = [0.42, 0.48, 0.8], wC = [1.12, 0.96, 0.76];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - LX) / r, dy = (y - LY) / (r * 0.62); const f = Math.floor(Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)) * 5) / 5, k = (y * W + x) * 4; for (let c = 0; c < 3; c++) out[k + c] = Math.min(255, out[k + c] * (nC[c] + (wC[c] - nC[c]) * f)); }
    const S5 = Math.sqrt(5), mx = W * 0.72, my = H * 0.3, ru = Math.min(W, H) * 0.34, rv = Math.min(W, H) * 0.09, f8 = Math.floor(t * 6);
    for (let k = 0; k < 170; k++) { const a = hash(k * 1.37) * 6.283, rr = Math.sqrt(hash(k * 2.71)), u = Math.cos(a) * rr * ru, v = Math.sin(a) * rr * rv, X = Math.round(mx + (2 * u - v) / S5), Y = Math.round(my + (u + 2 * v) / S5); if (hash(k * 0.73 + f8 * 3.1) > 0.7 - rr * 0.3) continue; for (let q = 0; q < (rr < 0.5 ? 3 : 2); q++) { const xx = X + q, yy = Y + (q >> 1); if (xx >= 0 && xx < W && yy >= 0 && yy < H && isWater(yy * W + xx)) paint(yy * W + xx, c3(rr < 0.4 && q === 1 ? '#ffffff' : '#c8d8f0')); } }
    for (const [dx, dy, c] of [[0, 0, '#ffd27a'], [0, -1, '#ffe7a0'], [1, 0, '#ffb04a'], [-1, 0, INK], [2, 0, INK], [0, 1, INK], [1, 1, INK]]) { const xx = Math.round(LX + dx), yy = Math.round(LY + dy); if (xx >= 0 && xx < W && yy >= 0 && yy < H) paint(yy * W + xx, c3(c)); }
  }
  SEACACHE.ctx.putImageData(SEACACHE.img, 0, 0);
  const tint = Math.max(dusk * 0.4, storm * 0.35);
  if (tint > 0) { const c = SEACACHE.ctx; c.globalCompositeOperation = 'source-atop'; c.globalAlpha = tint; c.fillStyle = storm > dusk ? '#4a5660' : mix(pal.skyBot, '#3a2a6a', 0.55); c.fillRect(0, 0, W, H); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  G.drawImage(SEACACHE.cv, 0, 0);
  // wind and rain
  if (o.wind === 'head' || o.wind === 'gale') for (let k = 0; k < 9; k++) { const x = Math.floor(pm(hash(k * 3) * W - t * (o.wind === 'gale' ? 40 : 24), W + 10)) - 5, y = hz + 6 + Math.floor(hash(k + 4) * (H - hz - 10)); G.fillStyle = '#ffffff'; G.fillRect(x, y, 4, 1); G.fillRect(x + 4, y + 1, 2, 1); }
  if (storm > 0.3) { G.fillStyle = 'rgba(220,228,236,0.6)'; for (let k = 0; k < 60; k++) { const x = (hash(k) * W + t * 40) % W, y = (hash(k + 9) * H + t * 120) % H; G.fillRect(Math.floor(x), Math.floor(y), 1, 3); } }
}

// ---------- nights ashore: the ship drawn up on a beach, the crew round a fire, and whatever each place has ----------
function vn(x, y, s) {   // smooth value noise
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, h = (a, b) => hash(a * 12.99 + b * 78.23 + s * 37.7), u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}
PERSON.sit = ['..KKK..', '.KhhhK.', '.KhssK.', '.KsseK.', '..KsK..', '.KrrrK.', 'KsrrrsK', 'KrRrRrK', 'KrrrrrK', '.KKKKK.'];
const SPONGE = () => [mat('#e0b050', 0.2, 0.4), mat('#c89838', 0.2, 0.4), mat('#d8a848', 0.2, 0.4)];
function spring(c, u, dv) {   // a spout in a little wall, a stone basin, jars waiting
  const { Wd, at, top } = c, { put, box, face } = Wd, [x, y] = at(u, dv), z = top(x, y) + 1, sp = box(x - 2, y - 1, z, 5, 1, 3, M.stoneD);
  box(x - 1, y, z, 3, 2, 1, M.stone, sp); for (let i = -1; i < 2; i++) put(i + x, y, z + 1, mat('#5ac0f0', 0.1, 0.2), sp); face(x, y - 1, z + 2, 'l', INK);
  for (const [dx, dy] of [[3, 1], [4, 0], [3, -1]]) { const jz = top(x + dx, y + dy) + 1, j = Wd.newId(); put(x + dx, y + dy, jz, mat('#e8763a', 0.16, 0.34), j); put(x + dx, y + dy, jz + 1, mat('#c85a2a'), j); }
}
function slopeTrees(c, from, density) {   // olives, carobs and the odd cypress on the hillside, with dry-stone terrace walls
  const { Wd, hts, dist, used } = c;
  for (const [k, h] of hts) {
    const [x, y] = k.split(',').map(Number), u = x - y, d = dist(x, y);
    if (d > from + 1 && !c.rocky(u) && pm(Math.round(d), 9) === 0 && hash(x * 0.9 + y * 1.7) < 0.85 && !used.has(k)) { Wd.put(x, y, h + 1, pm(x, 2) ? M.stone : M.stoneD, Wd.newId()); used.add(k); }
  }
  for (const [k, h] of hts) {
    const [x, y] = k.split(',').map(Number), d = dist(x, y), r = hash(x * 0.37 + y * 1.91 + c.seed);
    if (d < from || pm(x, 5) || pm(y, 4) || used.has(k) || r > density || vn(x / 12, y / 9, 77 + c.seed) < 0.45) continue;
    if (r < 0.05) Wd.box(x, y, h + 1, 1, 1, 4, M.cypress); else tree(Wd, x, y, h + 1, 0.6 + r * 0.9);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) used.add((x + i) + ',' + (y + j));
  }
}
function flatten(c, x0, y0, w, d, pad) {   // a level terrace cut into the hill at its average height: returns that height
  const { Wd, top, hts } = c; pad = pad || 0; let sum = 0, n = 0;
  for (let x = x0 - pad; x < x0 + w + pad; x++) for (let y = y0 - pad; y < y0 + d + pad; y++) { sum += top(x, y); n++; }
  const zb = Math.max(1, Math.round(sum / n)), ter = Wd.newId();
  for (let x = x0 - pad; x < x0 + w + pad; x++) for (let y = y0 - pad; y < y0 + d + pad; y++) {
    for (let z = zb + 1; z <= top(x, y) + 1; z++) Wd.del(x, y, z);
    for (let z = Math.max(0, Math.min(zb, top(x, y) + 1)); z <= zb; z++) Wd.put(x, y, z, z === zb ? M.rock : M.stoneD, ter);
    hts.set(x + ',' + y, zb); c.used.add(x + ',' + y);
  }
  return zb;
}
const CAMPSPEC = {
  symi: {
    seed: 41, high: 15, rocky: u => Math.abs(u - 4) > 38, cove: u => Math.max(0, Math.round((Math.abs(u - 4) - 44) * 0.9)),
    ship: [-36, 7], fire: [10, 6], glaukos: [-46, 2], swimmer: [36, -12],
    dress(c) {
      const { Wd, at, top, hts } = c, { put, box, face } = Wd, sponge = SPONGE();
      spring(c, -14, 17);
      const [hx, hy] = at(40, 13), hz_ = top(hx, hy) + 1;
      house(Wd, hx, hy, hz_, 5, 4, 4, M.cream, { flat: true, door: '#5a3a2a', seed: 0.2 });
      for (let k = 0; k < 7; k++) { const [x, y] = at(20 + k * 4, 2 + (k % 3)), z = Math.max(0, top(x, y)) + 1, rk = box(x, y, z, 2 + (k % 2), 2, 1, k % 2 ? M.grey : M.greyD); for (let i = 0; i < 2 + (k % 2); i++) if (hash(k * 3 + i) < 0.8) put(x + i, y + (i % 2), z + 1, sponge[(k + i) % 3], rk); }
      const [bx, by] = at(52, -6); smallBoat(Wd, bx, by, '#3a8ad8', false);
      slopeTrees(c, 13, 0.3);
      for (const [u, dv, w2] of [[30, 20, 4], [50, 9, 4], [-24, 34, 3]]) { const [x, y] = at(u, dv); if (hts.has(x + ',' + y)) house(Wd, x, y, top(x, y) + 1, w2, 3, 3 + (u % 2 ? 1 : 0), u > 40 ? M.white : M.cream, { flat: true, door: '#5a3a2a', seed: 0.5 }); }
      { const [x, y] = at(30, 9), z = top(x, y) + 1, rack = Wd.newId(); for (const dx of [0, 6]) box(x + dx, y, z, 1, 1, 4, M.woodD, rack); for (let dx = 0; dx <= 6; dx++) { put(x + dx, y, z + 4, M.woodD, rack); if (dx > 0 && dx < 6) put(x + dx, y, z + 3, sponge[dx % 3], rack); } }
      { const [x, y] = at(14, 44); if (hts.has(x + ',' + y)) { const z = top(x, y) + 1, sh = box(x, y, z, 3, 3, 3, M.white); put(x + 1, y + 1, z + 3, M.roof, sh); face(x + 1, y + 2, z, 'l', '#3a2418'); } }
      return { lights: [[hx + 2, hy + 4, hz_ + 1, 22, 0.75]], goats: [[-20, 26], [-6, 40], [40, 30], [18, 34]], people: [[24, 6, 'diver1'], [32, 5, 'diver2']] };
    },
  },
  triopion: {   // under the cape, below the walls of Knidos: fishermen and their boats on the beach, lamps in the town, a beacon on the cape
    seed: 53, high: 12, rocky: u => u > 30 || u < -50, cove: u => u > 34 ? Math.round((u - 34) * 1.1) : Math.max(0, Math.round((-54 - u) * 0.8)), lift: u => u > 26 ? Math.round((u - 26) * 0.9) : 0,
    ship: [-30, 7], fire: [-4, 6], glaukos: null, swimmer: null,
    dress(c) {
      const { Wd, at, top, hts } = c, { put, box, face } = Wd, lights = [];
      // the walls of Knidos across the slope, towers along them, and the town above with its lamps lit
      const wallDv = u => 24 + Math.round(3 * Math.sin(u / 9));
      for (let u = -90; u <= 24; u++) { const [x, y] = at(u, wallDv(u)); if (!hts.has(x + ',' + y)) continue; const z = top(x, y), id = Wd.newId(); for (let k = 1; k <= 3; k++) put(x, y, z + k, pm(u, 4) < 2 ? M.stone : M.stoneD, id); if (pm(u, 2) === 0) put(x, y, z + 4, M.stone, id); c.used.add(x + ',' + y); }
      for (let u = -84; u <= 20; u += 18) { const [x, y] = at(u, wallDv(u)); if (!hts.has(x + ',' + y)) continue; const z = top(x, y) + 1, tw = box(x - 1, y - 1, z, 3, 3, 6, (xx, yy, zz) => zz % 2 ? M.stone : M.stoneD); for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(x + dx, y + dy, z + 6, M.stone, tw); face(x, y + 1, z + 3, 'l', INK); lights.push([x, y + 2, z + 4, 10, 0.55]); }
      for (let dv = 30, r = 0; dv < 70; dv += 7, r++) for (let u = -88 + (r % 2) * 4; u < 28; u += 8) {
        const [x, y] = at(u, dv); if (!hts.has(x + ',' + y) || c.used.has(x + ',' + y)) continue;
        const k = hash(u * 3.1 + dv * 7.3); if (k < 0.15) continue;
        const z = top(x, y) + 1; let ok = true; for (let i = 0; i < 4 && ok; i++) for (let j = 0; j < 4; j++) if (Math.abs(top(x + i, y + j) - top(x, y)) > 2 || c.used.has((x + i) + ',' + (y + j))) { ok = false; break; }
        if (!ok) continue;
        house(Wd, x, y, z, 4, 4, 4 + Math.floor(k * 3), [M.white, M.cream, M.ochre, M.pink][Math.floor(k * 4)], { flat: k < 0.5, alongY: k > 0.7, door: '#5a3a2a', seed: k });
        for (let i = -1; i <= 4; i++) for (let j = -1; j <= 4; j++) c.used.add((x + i) + ',' + (y + j));
        if (k > 0.6) lights.push([x + 2, y + 4, z + 2, 8, 0.55]);
      }
      // the round temple of Aphrodite, up on the height, columns in a ring under a cone of a roof
      { const [x, y] = at(-30, 58); if (hts.has(x + ',' + y)) { const z = flatten(c, x - 4, y - 4, 9, 9, 0) + 1, id = Wd.newId();
        for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { const r = Math.hypot(i, j); if (r <= 4.3) put(x + i, y + j, z, M.marble, id); if (r > 3.2 && r <= 4.3 && pm(i + j, 2) === 0) for (let k = 1; k <= 4; k++) put(x + i, y + j, z + k, M.marble, id); if (r <= 2) for (let k = 1; k <= 4; k++) put(x + i, y + j, z + k, mat('#f0e4d0', 0.3, 0.5), id); }
        for (let k = 0; k < 4; k++) for (let i = -4 + k; i <= 4 - k; i++) for (let j = -4 + k; j <= 4 - k; j++) if (Math.hypot(i, j) <= 4.3 - k) put(x + i, y + j, z + 5 + k, k === 3 ? M.bronze : M.roof, id);
        lights.push([x, y + 4, z + 2, 10, 0.5]); } }
      // a beacon on the cape
      { const [x, y] = at(52, 18); if (hts.has(x + ',' + y)) { const z = top(x, y) + 1, b = box(x, y, z, 2, 2, 4, M.stoneD); put(x, y, z + 4, M.iron, b); c.beacon = [x + 1, y + 1, z + 5]; lights.push([x + 1, y + 1, z + 5, 18, 0.8]); } }
      // the fishermen: two boats pulled up, nets drying on poles, baskets of fish
      for (const [u, dv, col] of [[18, 3, '#e8483a'], [26, 2, '#3a8ad8']]) { const [x, y] = at(u, dv); smallBoat(Wd, x, y, col, false); }
      { const [x, y] = at(8, 9), z = top(x, y) + 1, nets = Wd.newId(); for (const dx of [0, 6]) box(x + dx, y, z, 1, 1, 5, M.woodD, nets); for (let dx = 1; dx < 6; dx++) for (let k = 1; k < 5; k++) if ((dx + k) % 2 === 0) put(x + dx, y, z + k, mat('#8a6a4a', 0.1, 0.2), nets); }
      for (const [u, dv] of [[22, 7], [24, 8]]) { const [x, y] = at(u, dv), z = top(x, y) + 1, b = Wd.newId(); put(x, y, z, mat('#c89a52', 0.16, 0.34), b); put(x, y, z + 1, mat('#c8d8e8', 0.1, 0.2), b); }
      slopeTrees(c, 12, 0.22);
      const lamp = at(23, 6); lights.push([lamp[0], lamp[1], top(lamp[0], lamp[1]) + 3, 16, 0.7]);
      return { lights, people: [[20, 6, 'fisher1'], [27, 5, 'fisher2'], [24, 9, 'fisher3']] };
    },
  },
  loryma: {   // a harbour on the mainland across from Rhodes, a Rhodian fort on the height, soldiers glad of company, a spring
    seed: 67, high: 9, rocky: u => u < -58 || u > 46, cove: u => u < -60 ? Math.round((-60 - u) * 1.0) : Math.max(0, Math.round((u - 48) * 0.8)),
    ship: [-6, 7], fire: [22, 6], glaukos: null, swimmer: null,
    dress(c) {
      const { Wd, at, top, hts } = c, { put, box, face } = Wd, lights = [];
      // the fort: four walls with a walk along the top, a tower at each corner, a gate looking down on the beach, a barracks inside
      let fort = null;
      { const [x0, y0] = at(-30, 34), w = 18, d = 14;
        if (hts.has(x0 + ',' + y0)) {
          const zb = flatten(c, x0 - 1, y0 - 1, w + 2, d + 2, 1) + 1, id = Wd.newId(), wallM = (x, y, z) => pm(x + y + z, 3) === 0 ? M.stoneD : M.stone;
          for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + d; y++) {
            const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + d - 1; if (!edge) continue;
            const gate = y === y0 + d - 1 && Math.abs(x - (x0 + w / 2)) < 1.5;
            for (let z = zb + (gate ? 3 : 0); z < zb + 5; z++) put(x, y, z, wallM(x, y, z), id);
            if (pm(x + y, 2) === 0) put(x, y, zb + 5, M.stone, id);
          }
          for (const [x, y] of [[x0 - 1, y0 - 1], [x0 + w - 2, y0 - 1], [x0 - 1, y0 + d - 2], [x0 + w - 2, y0 + d - 2]]) { const tw = box(x, y, zb, 3, 3, 8, wallM); for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) put(x + dx, y + dy, zb + 8, M.stone, tw); face(x + 1, y + 2, zb + 5, 'l', INK); face(x + 2, y + 1, zb + 5, 'r', INK); }
          house(Wd, x0 + 3, y0 + 3, zb, 9, 5, 5, M.ochre, { alongY: false, door: '#5a3a2a', seed: 0.7 });
          const gx = Math.round(x0 + w / 2), gy = y0 + d - 1;
          lights.push([gx - 2, gy + 1, zb + 3, 14, 0.8], [gx + 2, gy + 1, zb + 3, 14, 0.8], [x0 + w - 1, y0 + d - 1, zb + 9, 12, 0.6]);
          fort = { gate: [gx, gy + 2, zb], torches: [[gx - 2, gy + 1, zb + 3], [gx + 2, gy + 1, zb + 3]], flag: [x0 + w - 1, y0 + d - 1, zb + 9], wall: [x0 + 6, y0 + d - 1, zb + 5] };
        } }
      spring(c, 2, 16);
      for (const [u, dv, col] of [[40, -8, '#e8483a'], [52, -4, '#ffffff']]) { const [x, y] = at(u, dv); smallBoat(Wd, x, y, col, false); }
      { const [x, y] = at(34, 12), z = top(x, y) + 1; house(Wd, x, y, z, 4, 4, 4, M.cream, { flat: true, door: '#5a3a2a', seed: 0.3 }); }
      slopeTrees(c, 12, 0.3);
      return { lights, fort, people: [[26, 9, 'soldier'], [18, 9, 'soldier2'], [34, 7, 'soldier3']] };
    },
  },
};
// The beach runs straight across the picture: a tile is (u, v) = (x - y, x + y) on the screen, and the shore is a line of v.
function campWorld(W, H, stop) {
  const P = CAMPSPEC[stop], seed = P.seed, OX = Math.round(W * 0.5), OY = Math.round(H * 0.5), vs0 = Math.round(H * (H > W * 0.8 ? 0.74 : 0.64)) - OY;   // on a phone the story text covers the top, so the beach sits lower
  const sv = u => vs0 + Math.round(1.6 * Math.sin(u / 11 + seed) + 1.1 * Math.sin(u / 4.7 + 1)) + P.cove(u);
  const dist = (x, y) => sv(x - y) - (x + y), lift = P.lift || (() => 0);
  const hAt = (x, y) => { const d = dist(x, y); if (d < 0) return null; const u = x - y, r = P.rocky(u); if (!r && d < 11) return d < 6 ? 0 : 1; return Math.min(Math.floor((d - (r ? 0 : 9)) / (r ? 1.5 : 2.6)) + 1, 2 + Math.floor(vn(x / 15, y / 11, seed) * P.high) + lift(u)); };
  const at = (u, dv) => { let v = sv(u) - dv; if ((u + v) & 1) v--; return [(u + v) / 2, (v - u) / 2]; };
  const Wd = makeWd(), { put } = Wd, g = Wd.newId(), hts = new Map();
  const sand = mat('#f0dcb0', 0.14, 0.3), sand2 = mat('#e4cc9c', 0.14, 0.3), peb = mat('#c8c0b0', 0.16, 0.32), rock = mat('#d0c4a8', 0.18, 0.38), rock2 = mat('#bcae94', 0.18, 0.38), cliff = mat('#b4a68a', 0.2, 0.42);
  const scrub = mat('#8aa858', 0.2, 0.42), scrub2 = mat('#6a9048', 0.2, 0.42), thyme = mat('#a87ab8', 0.16, 0.34), path = mat('#e8d8b4', 0.14, 0.3);
  const umin = Math.floor(-OX / 2) - 4, umax = Math.ceil((W - OX) / 2) + 4, vmin = -OY - 40;
  for (let u = umin; u <= umax; u++) for (let v = vmin; v <= sv(u) + 3; v++) {
    if ((u + v) & 1) continue;
    const x = (u + v) / 2, y = (v - u) / 2, d = dist(x, y);
    if (d < 0) { if (d >= -3 && P.rocky(u) && hash(x * 1.3 + y * 7.1) < 0.5) { const id = Wd.newId(); put(x, y, -1, pm(x + y, 2) ? M.grey : M.greyD, id); if (hash(x * 3.1 + y) < 0.3) put(x, y, 0, M.grey, id); } continue; }
    const h = hAt(x, y); if (OY + v - 2 * h < -10) continue;
    hts.set(x + ',' + y, h);
    const f = (dx, dy) => { const q = hAt(x + dx, y + dy); return q == null ? -2 : q; }, low = Math.min(f(1, 0), f(0, 1), h);
    const r = P.rocky(u), sc = vn(x / 7, y / 6, seed + 3), zig = pm(Math.round(u + Math.sin(v / 5) * 6), 31) === 0 && d > 12;
    const tp = h === 0 ? (hash(x * 0.7 + y * 1.9) < 0.18 ? peb : pm(x + y, 3) ? sand : sand2) : h === 1 && !r ? (hash(x + y * 3.3) < 0.4 ? peb : sand2)
      : zig ? path : sc > 0.6 ? (hash(x * 2.3 + y) < 0.07 ? thyme : pm(x * 3 + y, 4) ? scrub : scrub2) : pm(x + 2 * y, 5) ? rock : rock2;
    for (let z = Math.min(h, Math.max(-1, low + 1)); z <= h; z++) put(x, y, z, z === h ? tp : z < 1 ? M.grey : cliff, g);
  }
  const top = (x, y) => hts.has(x + ',' + y) ? hts.get(x + ',' + y) : 0;
  const c = { Wd, at, top, hts, dist, rocky: P.rocky, seed, used: new Set() };
  // keep the beach clear where the ship lies and the crew sit
  for (const [u, dv, r] of [[P.ship[0], P.ship[1], 14], [P.fire[0], P.fire[1], 5]]) for (let du = -r; du <= r; du++) for (let dd = -4; dd <= 4; dd++) { const [x, y] = at(u + du, dv + dd); c.used.add(x + ',' + y); }
  const extra = P.dress(c);
  const pos = ([u, dv]) => { const [x, y] = at(u, dv); return [x, y, top(x, y) + 1]; };
  return { V: Wd.V, OX, OY, at, top, sv, stop, ...extra, beacon: c.beacon,
    fire: (() => { const [x, y] = at(P.fire[0], P.fire[1]); return [x, y, top(x, y)]; })(), ship: at(P.ship[0], P.ship[1]),
    glaukos: P.glaukos && pos(P.glaukos), swimmer: P.swimmer && at(P.swimmer[0], P.swimmer[1]),
    goats: (extra.goats || []).map(pos), people: (extra.people || []).map(([u, dv, who]) => [...pos([u, dv]), who]) };
}
const CAMPC = { key: null };
const CAMPFOLK = {
  diver1: () => person({ skin: '#9a6a42', hair: '#1a1210', robe: '#9a6a42', style: 'short' }, 'stand', 'sack'), diver2: () => person({ skin: '#a87448', hair: '#2a1d14', robe: '#7a5034', style: 'curly' }, 'stand'),
  fisher1: () => person({ skin: '#a87448', hair: '#e8e8e8', robe: '#6a7a8a', style: 'short', beard: 2 }, 'stand', 'basket'), fisher2: () => person({ skin: '#9a6a42', hair: '#1a1210', robe: '#8a5a3a', style: 'curly', beard: 1 }, 'stand'), fisher3: () => person({ skin: '#b87a4a', hair: '#3a281c', robe: '#c8b89a', style: 'short' }, 'sit'),
  soldier: () => person({ skin: '#c88a58', hair: '#2a1d14', robe: '#c8324a', style: 'short', hat: 'pilos', hatC: '#ffb44a' }, 'stand'), soldier2: () => person({ skin: '#d8985e', hair: '#1b130e', robe: '#c8324a', style: 'short', beard: 1, hat: 'pilos', hatC: '#ffb44a' }, 'stand'), soldier3: () => person({ skin: '#b87a4a', hair: '#3a281c', robe: '#c8324a', style: 'curly', hat: 'pilos', hatC: '#ffb44a' }, 'sit'),
};
const GOATS = () => CAMPC.goat || (CAMPC.goat = [sprite(['.KK.....', 'KwhK....', '.KwKKKK.', '.KwwwwwK', '..KwwwwK', '..K.K.K.'], { K: INK, w: '#f0ece0', h: '#c8b8a0' }), sprite(['.KK.....', 'KbhK....', '.KbKKKK.', '.KbbbbbK', '..KbbbbK', '..K.K.K.'], { K: INK, b: '#8a5a3a', h: '#c8b8a0' })]);
function drawCampIso(W, H, t, stop) {
  const kind = shipKind(), key = W + 'x' + H + ':' + kind + ':' + stop;
  if (CAMPC.key !== key) {
    const w = campWorld(W, H, stop); CAMPC.key = key; CAMPC.w = w; CAMPC.R = raster(w.V, W, H, w.OX, w.OY, false); CAMPC.lmap = null;
    CAMPC.cv = document.createElement('canvas'); CAMPC.cv.width = W; CAMPC.cv.height = H; CAMPC.ctx = CAMPC.cv.getContext('2d'); CAMPC.img = CAMPC.ctx.createImageData(W, H); CAMPC.dep = new Float32Array(W * H);
    CAMPC.folk = {}; for (const [, , , who] of w.people) CAMPC.folk[who] = CAMPC.folk[who] || CAMPFOLK[who]();
  }
  const w = CAMPC.w, Rw = CAMPC.R, out = CAMPC.img.data, dep = CAMPC.dep, { OX, OY } = w;
  const sx = (x, y) => OX + (x - y) * 2, sy = (x, y, z) => OY + x + y - 2 * z;
  // the water first, the same living surface as at sea, then the land over it
  const ST = seaTex(), T = ST.frames[Math.floor(t * 8) % ST.n], c3 = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const water = '#3a8aa8', tones = [mix(water, '#1a3a5a', 0.14), water, mix(water, '#ffffff', 0.17), mix(water, '#ffffff', 0.4)].map(c3), drift = Math.round(t * 1.5);
  for (let y = 0; y < H; y++) { const rowT = pm(y + drift, ST.h) * ST.w, rowP = pm((y + drift) >> 1, ST.ph) * ST.pw; for (let x = 0; x < W; x++) { let tn = T[rowT + pm(x + 2 * drift, ST.w)] + ST.patch[rowP + pm((x + 2 * drift) >> 1, ST.pw)]; const c = tones[tn < 0 ? 0 : tn > 3 ? 3 : tn], k = (y * W + x) * 4; out[k] = c[0]; out[k + 1] = c[1]; out[k + 2] = c[2]; out[k + 3] = 255; } }
  for (let i = 0; i < W * H; i++) if (Rw.depth[i] > -1e9) { out[i * 4] = Rw.rgba[i * 4]; out[i * 4 + 1] = Rw.rgba[i * 4 + 1]; out[i * 4 + 2] = Rw.rgba[i * 4 + 2]; }
  dep.set(Rw.depth);
  const drawAt = (sp, x, y, z, flip) => {
    const X = Math.round(sx(x, y)) + 2 - (sp.w >> 1), Y = Math.round(sy(x, y, z)) + 2 - sp.h, base = x + y + z + 0.6;
    for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) { const si = (j * sp.w + (flip ? sp.w - 1 - i : i)) * 4; if (!sp.data[si + 3]) continue; const px_ = X + i, py = Y + j; if (px_ < 0 || py < 0 || px_ >= W || py >= H) continue; const k = py * W + px_, d = base + (sp.h - 1 - j) / 2; if (d < dep[k] - 0.3) continue; dep[k] = Math.max(dep[k], d); out[k * 4] = sp.data[si]; out[k * 4 + 1] = sp.data[si + 1]; out[k * 4 + 2] = sp.data[si + 2]; }
  };
  const drawVox = (m, x, y, z) => {
    const X0 = Math.round(sx(x, y)) - m.ox, Y0 = Math.round(sy(x, y, z)) - m.oy, base = x + y + z;
    for (let j = 0; j < m.h; j++) { const py = Y0 + j; if (py < 0 || py >= H) continue; for (let i = 0; i < m.w; i++) { const s = j * m.w + i; if (!m.rgba[s * 4 + 3]) continue; const px_ = X0 + i; if (px_ < 0 || px_ >= W) continue; const k = py * W + px_, d = base + m.depth[s]; if (d < dep[k] - 0.3) continue; dep[k] = d; out[k * 4] = m.rgba[s * 4]; out[k * 4 + 1] = m.rgba[s * 4 + 1]; out[k * 4 + 2] = m.rgba[s * 4 + 2]; } }
  };
  // the ship drawn up on the sand; the crew round the fire; Glaukos apart; the people of the place
  const all = [], ship = voyShip(kind, 'furled', false, 0), [fx, fy, fz] = w.fire;
  all.push(['v', ship, w.ship[0], w.ship[1], 0]);
  [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, 1.6], [1.6, -1.5]].forEach(([dx, dy], i) => all.push(['p', person(look(150 + i), 'sit'), fx + dx, fy + dy, fz + 1, dx > 0 || dy < 0]));
  if (w.glaukos) { const GL = CAMPC.gl || (CAMPC.gl = person({ skin: '#c88a58', hair: '#e8e8e8', robe: '#8a6a4a', style: 'short', beard: 2 }, 'stand')); all.push(['p', GL, w.glaukos[0], w.glaukos[1], w.glaukos[2], true]); }
  w.people.forEach(([x, y, z, who], i) => all.push(['p', CAMPC.folk[who], x, y, z, i % 2 === 1]));
  if (w.fort) all.push(['p', CAMPC.folk.soldier || (CAMPC.folk.soldier = CAMPFOLK.soldier()), w.fort.wall[0], w.fort.wall[1], w.fort.wall[2], false]);
  w.goats.forEach(([x, y, z], i) => all.push(['p', GOATS()[i % 2], x + (Math.floor(t * 0.3 + i) % 3 === 0 ? 0.5 : 0), y, z, i % 2 === 1]));
  all.sort((p, q) => (p[2] + p[3] + p[4]) - (q[2] + q[3] + q[4]));
  for (const e of all) if (e[0] === 'v') drawVox(e[1], e[2], e[3], e[4]); else drawAt(e[1], e[2], e[3], e[4], e[5]);
  const put = (a, b, c) => { a = Math.round(a); b = Math.round(b); if (a >= 0 && b >= 0 && a < W && b < H) { const k = (b * W + a) * 4, v = c3(c); out[k] = v[0]; out[k + 1] = v[1]; out[k + 2] = v[2]; } };
  if (w.swimmer) {   // a diver coming up out of the water, and the rings he makes
    const [x, y] = w.swimmer, up = Math.sin(t * 0.7) > 0.2, X = Math.round(sx(x, y)), Y = Math.round(sy(x, y, 0)), r = 2 + Math.floor(t * 3) % 4;
    for (let i = -r * 2; i <= r * 2; i++) { const yy = Math.round(Math.sqrt(Math.max(0, r * r - (i / 2) * (i / 2)))); put(X + i, Y - yy + 1, '#cfeaf2'); put(X + i, Y + yy + 1, '#cfeaf2'); }
    if (up) { put(X, Y - 1, INK); put(X + 1, Y - 1, INK); put(X - 1, Y, INK); put(X, Y, '#1a1210'); put(X + 1, Y, '#1a1210'); put(X + 2, Y, INK); put(X, Y + 1, '#9a6a42'); put(X + 1, Y + 1, '#9a6a42'); }
  }
  // night over everything, except where the fire and the lamps reach
  const flick = 0.92 + Math.sin(t * 9) * 0.04 + Math.sin(t * 23) * 0.03, FX = sx(fx, fy) + 2, FY = sy(fx, fy, fz + 1) + 1, rF = Math.min(W, H) * 0.36 * flick;
  if (!CAMPC.lmap) {   // the lamps' light, worked out once
    const lm = CAMPC.lmap = new Float32Array(W * H);
    for (const [x, y, z, r, s] of (w.lights || [])) { const lx = sx(x, y) + 2, ly = sy(x, y, z); for (let yy = Math.max(0, Math.floor(ly - r)); yy < Math.min(H, ly + r); yy++) for (let xx = Math.max(0, Math.floor(lx - r)); xx < Math.min(W, lx + r); xx++) { const dx = (xx - lx) / r, dy = (yy - ly) / (r * 0.62), q = 1 - Math.sqrt(dx * dx + dy * dy); if (q > 0) lm[yy * W + xx] = Math.max(lm[yy * W + xx], q * s); } }
  }
  const night = [0.5, 0.56, 0.84], warm = [1.14, 0.98, 0.76], lm = CAMPC.lmap;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - FX) / rF, dy = (y - FY) / (rF * 0.62);
    let f = Math.max(lm[y * W + x], 1 - Math.sqrt(dx * dx + dy * dy));
    f = Math.floor(f * 5) / 5;   // light in bands, as pixel art does it
    const k = (y * W + x) * 4; for (let c = 0; c < 3; c++) out[k + c] = Math.min(255, out[k + c] * (night[c] + (warm[c] - night[c]) * f));
  }
  { const onW = (a, b) => dep[Math.round(b) * W + Math.round(a)] === -1e9, mx = W * 0.22, my = H * 0.9, f8 = Math.floor(t * 6), S5 = Math.sqrt(5), ru = Math.min(W, H) * 0.3, rv = Math.min(W, H) * 0.08;   // the moon's path on the water
    for (let k = 0; k < 150; k++) { const a = hash(k * 1.37) * 6.283, r = Math.sqrt(hash(k * 2.71)), u = Math.cos(a) * r * ru, v = Math.sin(a) * r * rv, X = Math.round(mx + (2 * u - v) / S5), Y = Math.round(my + (u + 2 * v) / S5); if (hash(k * 0.73 + f8 * 3.1) > 0.7 - r * 0.3) continue; for (let q = 0; q < (r < 0.5 ? 3 : 2); q++) if (X + q >= 0 && X + q < W && Y + (q >> 1) >= 0 && Y + (q >> 1) < H && onW(X + q, Y + (q >> 1))) put(X + q, Y + (q >> 1), r < 0.4 && q === 1 ? '#ffffff' : '#c8d8f0'); } }
  const flame = (X, Y, big) => { const f = Math.floor(t * 8 + X) % 3; for (let i = -big; i <= big; i++) for (let j = 0; j < big + 2 - Math.abs(i); j++) put(X + i, Y - j, j > 1 ? '#ffcf5a' : '#ff8a2a'); put(X - (f === 1 ? 1 : 0), Y - big - 2, '#fff2c0'); put(X + (f === 2 ? 1 : 0), Y - big - 3, '#ffe7a0'); };
  for (let i = -3; i <= 3; i++) { put(FX + i, FY + 1, '#3a2418'); put(FX + i, FY + 2, i % 2 ? '#5a3420' : '#3a2418'); }
  flame(FX, FY, 2);
  for (let k = 0; k < 4; k++) { const a = (t * 0.8 + k / 4) % 1; put(FX + Math.round(Math.sin(t * 3 + k * 2) * 3), FY - 7 - Math.round(a * 22), a < 0.5 ? '#ffb04a' : '#c86a3a'); }
  for (const [x, y, z, r] of (w.lights || [])) { const X = sx(x, y) + 2, Y = sy(x, y, z); if (r >= 14) flame(X, Y, 1); else { put(X, Y - 1, '#ffd27a'); put(X, Y - 2, '#ffe7a0'); } }
  CAMPC.ctx.putImageData(CAMPC.img, 0, 0);
  G.drawImage(CAMPC.cv, 0, 0);
  if (w.fort) { const [x, y, z] = w.fort.flag, X = sx(x, y) + 2, Y = sy(x, y, z); G.fillStyle = '#3a2a20'; G.fillRect(X, Y - 10, 1, 10); for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { G.fillStyle = j === 0 || j === 3 ? '#7a5a4a' : i > 1 && i < 4 && j > 0 && j < 3 ? '#c8a050' : '#a03a3a'; G.fillRect(X + 1 + i, Y - 10 + j + Math.round(Math.sin(t * 4 + i) * (i / 6)), 1, 1); } }
}
// a night at anchor off a rocky shore: the open sea in the dark, the ship riding to her anchor with the stern lamp lit
function drawAnchorIso(W, H, t) { drawSeaIso(W, H, t, { clock: 0.5, storm: 0, calm: true, wind: 'calm', row: false, crew: 3, seed: 5, scroll: 0, open: true, night: true }); }

// ---------- Halicarnassus: a town rising round its harbour like a theatre, the Mausoleum in the middle of it, and the theatre itself up the hill ----------
const HB = [20, QB, 40];   // the harbour basin, a half-round against the quay: centre and radius
const hInMole = (x, y) => x >= 60 && x <= 63 && y >= -2 && y <= 21;
const hWater = (x, y) => y < QB && !hInMole(x, y) && ((x - HB[0]) ** 2 + (y - HB[1]) ** 2 < HB[2] * HB[2] || (x >= 64 && y > -14) || (x >= 56 && y > 21));
const hLevel = (x, y) => {
  const d = Math.sqrt((x - HB[0]) ** 2 + (y - HB[1]) ** 2) - HB[2];
  const ds = x >= 64 ? -14 - y : y > -14 ? 64 - x : Math.hypot(64 - x, -14 - y);   // how far from the open sea on the right
  return Math.max(0, Math.min(7, Math.floor(d / 6), Math.floor((QB - 1 - y) / 3), Math.floor(ds / 4)));
};
const hTop = (x, y) => y >= QB ? 0 : hInMole(x, y) ? 0 : hWater(x, y) ? -3 : hLevel(x, y) * 2;
const H_MAUS = [-21, -9, 13], H_THEA = [-40, -16, 10.5], H_PAL = [22, -34, 13, 8], H_TOWER = [60, 17];
function hReserved(x0, y0, w, d) {
  const hit = (ax, ay, aw, ad) => x0 < ax + aw && x0 + w > ax && y0 < ay + ad && y0 + d > ay;
  return hit(H_MAUS[0] - 2, H_MAUS[1] - 2, H_MAUS[2] + 4, H_MAUS[2] + 4) || hit(H_THEA[0] - 12, H_THEA[1] - 12, 24, 24) || hit(H_PAL[0] - 1, H_PAL[1] - 1, H_PAL[2] + 2, H_PAL[3] + 4);
}
function mausoleum(Wd, x0, y0, z0) {   // a tall podium, a ring of columns round the tomb, a stepped pyramid, and the king's chariot on top
  const { put, box, face } = Wd, id = Wd.newId(), N = 13, pod = mat('#f4e8cc', 0.14, 0.3), podB = mat('#e2cea4', 0.14, 0.3);
  const band = (z, a, b) => { for (let i = 0; i < N; i++) { face(x0 + i, y0 + N - 1, z, 'l', i % 2 ? a : b); face(x0 + N - 1, y0 + i, z, 'r', i % 2 ? mix(a, '#2a2850', 0.2) : mix(b, '#2a2850', 0.2)); } };
  box(x0 - 1, y0 - 1, z0, N + 2, N + 2, 1, M.marble, id);
  box(x0, y0, z0 + 1, N, N, 8, (x, y, z) => z === z0 + 8 ? M.marble : (z - z0) % 3 === 0 ? podB : pod, id);
  band(z0 + 7, '#3a64c8', '#e8483a');
  const zc = z0 + 9;
  box(x0 + 2, y0 + 2, zc, N - 4, N - 4, 6, mat('#efe2cc', 0.32, 0.52), id);
  for (let i = 0; i < N; i += 2) for (const [x, y] of [[x0 + i, y0], [x0 + i, y0 + N - 1], [x0, y0 + i], [x0 + N - 1, y0 + i]]) box(x, y, zc, 1, 1, 6, M.marble, id);
  box(x0, y0, zc + 6, N, N, 1, M.marble, id); band(zc + 6, '#e8483a', '#3a64c8');
  for (let k = 0; k < 6; k++) box(x0 + k, y0 + k, zc + 7 + k, N - 2 * k, N - 2 * k, 1, k % 2 ? mat('#e8dcc4') : M.marble, id);
  const zt = zc + 13, br = Wd.newId(), cx = x0 + 6, cy = y0 + 6;   // the chariot and its four horses, in bronze
  put(cx - 1, cy, zt, M.bronze, br); put(cx - 1, cy, zt + 1, M.bronze, br); put(cx - 1, cy - 1, zt, M.bronze, br);
  for (const dy of [-1, 0, 1]) { put(cx + 1, cy + dy, zt, M.bronze, br); put(cx + 1, cy + dy, zt + 1, M.bronze, br); put(cx + 2, cy + dy, zt + 2, M.bronze, br); }
  return { top: [cx, cy, zt + 3], steps: [[x0 + 3, y0 + N + 1, z0 + 1], [x0 + 9, y0 + N + 1, z0 + 1], [x0 + N + 1, y0 + 6, z0 + 1]] };
}
function theatre(Wd, cx, cy, zb, fx, fy, topAt) {   // seats in half-rings facing the harbour and rising away from it, an orchestra, a stage building
  const id = Wd.newId(), seat = mat('#f4e6c4', 0.16, 0.34), seat2 = mat('#e2cca0', 0.16, 0.34), seats = [];
  for (let x = cx - 11; x <= cx + 11; x++) for (let y = cy - 11; y <= cy + 11; y++) {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), along = (dx * fx + dy * fy) / Math.max(0.01, r);
    if (r > 10.5) continue;
    let z;
    if (r < 3) z = zb;   // the orchestra
    else if (along > 0.2) continue;
    else z = zb + Math.floor(r - 2);
    for (let zz = Math.min(z, Math.max(0, topAt(x, y) + 1)); zz <= z; zz++) Wd.put(x, y, zz, zz < z ? M.stoneD : r < 3 ? M.marble : Math.floor(r - 2) % 2 ? seat : seat2, id);
    if (r >= 3 && Math.floor(r - 2) % 2 === 0) seats.push([x, y, z + 1]);
  }
  const sk = Wd.newId();   // the stage building, between the orchestra and the harbour
  for (let k = -5; k <= 5; k++) { const x = Math.round(cx + fx * 4 - fy * k), y = Math.round(cy + fy * 4 + fx * k); for (let z = Math.max(0, topAt(x, y) + 1); z <= zb + 3; z++) Wd.put(x, y, z, z === zb + 3 ? M.roof : pm(k, 3) === 0 && z < zb + 3 ? M.marble : mat('#e8c8a0', 0.14, 0.3), sk); }
  return seats;
}
function buildHalic(hullKind, W, H, robes) {
  const { OX, OY } = camera(W, H), K = -OY;
  const Wd = makeWd(), { put, get, box, face } = Wd;
  const on = (x, y, z, pad) => { const X = OX + (x - y) * 2, Y = OY + x + y - 2 * z; pad = pad == null ? 12 : pad; return X > -4 - pad && X < W + pad && Y > -4 - pad && Y < H + pad; };
  const seen = (x0, y0, w, d, z0, h) => { for (const [x, y] of [[x0, y0], [x0 + w - 1, y0], [x0, y0 + d - 1], [x0 + w - 1, y0 + d - 1], [x0 + (w >> 1), y0 + (d >> 1)]]) for (const z of [z0, z0 + h]) if (on(x, y, z)) return true; return false; };
  const beyond = (x, y, z) => x + y - 2 * z < K - 8;
  const umin = Math.floor((-12 - OX) / 2), umax = Math.ceil((W + 12 - OX) / 2), vmin = K - 2, vmax = H - OY + 16;
  const xLo = Math.floor((umin + vmin) / 2), xHi = Math.ceil((umax + vmax) / 2), yLo = Math.floor((vmin - umax) / 2), yHi = Math.ceil((vmax - umin) / 2);
  const ships = [];
  // the ground
  const flat = Wd.newId(), city = Wd.newId(), earth = mat('#e8cc98', 0.16, 0.34), earth2 = mat('#dcbc86', 0.16, 0.34), green = mat('#a8c868', 0.18, 0.38);
  const groundMat = (x, y) => {
    if (y >= QB) return y === QB ? M.kerb : y < STOA_Y ? (pm(x, 6) === 0 || pm(y - QB, 6) === 0 ? M.pave2 : M.pave) : pm(x + 2 * y, 5) === 0 ? M.street2 : M.street;
    if (hInMole(x, y)) return pm(x + y, 3) ? M.quay : M.quay2;
    return pm(x * 7 + y * 3, 11) === 0 ? green : pm(Math.floor(x / 4) + Math.floor(y / 4), 3) ? earth : earth2;
  };
  for (let v = vmin; v <= vmax; v++) for (let u = umin; u <= umax; u++) {
    if ((u + v) & 1) continue;
    const x = (u + v) / 2, y = (v - u) / 2, top = hTop(x, y);
    if (top < -2 || beyond(x, y, top)) continue;
    const low = Math.min(hTop(x + 1, y), hTop(x, y + 1), top), m = groundMat(x, y), id = y >= QB || hInMole(x, y) ? flat : city;
    for (let z = Math.min(top, Math.max(-2, low + 1)); z <= top; z++) put(x, y, z, z === top ? m : pm(Math.floor((x + y + (z % 2 ? 2 : 0)) / 4) + z, 2) ? M.stone : M.stoneD, id);
  }
  // a low wall along the water all round the harbour
  for (let x = -26; x < 64; x++) for (let y = -10; y < QB; y++) { if (hWater(x, y) || !(hWater(x + 1, y) || hWater(x, y + 1)) || hInMole(x, y)) continue; const t = hTop(x, y); if (t > 0 && on(x, y, t)) put(x, y, t + 1, pm(x + y, 2) ? M.stone : M.stoneD, city); }
  // the Mausoleum, on a terrace of its own above the harbour
  let maus = null;
  { const [x0, y0, N] = H_MAUS; let zb = 0; for (let x = x0 - 2; x < x0 + N + 2; x++) for (let y = y0 - 2; y < y0 + N + 2; y++) zb = Math.max(zb, hTop(x, y));
    const ter = Wd.newId(); for (let x = x0 - 2; x < x0 + N + 2; x++) for (let y = y0 - 2; y < y0 + N + 2; y++) for (let z = Math.max(0, hTop(x, y) + 1); z <= zb; z++) put(x, y, z, z === zb ? (pm(x + y, 2) ? M.pave : M.pave2) : M.stoneD, ter);
    if (seen(x0, y0, N, N, zb, 26)) maus = mausoleum(Wd, x0, y0, zb + 1); }
  // the theatre up the hill to the left, facing the harbour
  let seats = [];
  { const [cx, cy] = H_THEA, dx = HB[0] - cx, dy = HB[1] - cy, n = Math.hypot(dx, dy), zb = hTop(cx, cy) + 1;
    if (seen(cx - 10, cy - 10, 20, 20, zb, 12)) seats = theatre(Wd, cx, cy, zb, dx / n, dy / n, hTop); }
  // the king's palace, by the sea on the right
  { const [x0, y0, w, d] = H_PAL; let zb = 0; for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + d + 3; y++) zb = Math.max(zb, hTop(x, y));
    if (seen(x0, y0, w, d + 3, zb, 12) && !beyond(x0 + w, y0 + d, zb)) {
      const ter = Wd.newId(); for (let x = x0 - 1; x <= x0 + w; x++) for (let y = y0 - 1; y <= y0 + d + 3; y++) for (let z = Math.max(0, hTop(x, y) + 1); z <= zb; z++) put(x, y, z, z === zb ? M.pave : M.stoneD, ter);
      house(Wd, x0, y0, zb + 1, w, d, 7, mat('#f0c8a0', 0.14, 0.3), { alongY: false, door: '#5a3a2a', seed: 0.9, tile: true });
      const pc = Wd.newId(); for (let x = x0; x < x0 + w; x++) { if (pm(x - x0, 2) === 0) for (let z = zb + 1; z < zb + 7; z++) put(x, y0 + d + 1, z, M.marble, pc); put(x, y0 + d + 1, zb + 7, M.marble, pc); put(x, y0 + d, zb + 7, M.marble, pc); face(x, y0 + d + 1, zb + 7, 'l', x % 2 ? '#3a64c8' : '#e8483a'); }
    } }
  // the mole across the harbour mouth, and its tower
  { const [tx, ty] = H_TOWER, tw = box(tx, ty, 1, 4, 4, 13, (x, y, z) => ((x + y) % 4 < 2) === (z % 2 === 0) ? M.stone : M.stoneD);
    for (let x = tx; x < tx + 4; x++) for (let y = ty; y < ty + 4; y++) if ((x === tx || y === ty || x === tx + 3 || y === ty + 3) && (x + y) % 2 === 0) put(x, y, 14, M.stone, tw);
    for (const z of [5, 9]) { face(tx + 1, ty + 3, z, 'l', INK); face(tx + 3, ty + 1, z, 'r', INK); }
    for (const y of [2, 8, 14]) box(60, y, 1, 1, 1, 1, M.stoneD); }
  // houses everywhere else on the hill, packed onto the terraces
  for (let cy = Math.floor(yLo / 7) - 1; cy * 7 < QB - 2; cy++) for (let cx = Math.floor(xLo / 7) - 1; cx * 7 < xHi; cx++) {
    const R = k => h3(cx * 1.7 + 3, cy * 2.3 + 1, k), w = 5 + (R(1) < 0.5 ? 0 : 1), d = 5 + (R(2) < 0.5 ? 0 : 1);
    const x0 = cx * 7 + Math.floor(R(3) * (8 - w)), y0 = cy * 7 + Math.floor(R(4) * (8 - d));
    if (y0 + d > QB - 1 || hReserved(x0, y0, w, d)) continue;
    let ok = true, lo = 99, hi = -9;
    for (let x = x0 - 1; x <= x0 + w && ok; x++) for (let y = y0 - 1; y <= y0 + d; y++) { if (hWater(x, y) || hInMole(x, y) || y >= QB) { ok = false; break; } const t = hTop(x, y); lo = Math.min(lo, t); hi = Math.max(hi, t); }
    if (!ok || hi - lo > 4 || beyond(x0 + w - 1, y0 + d - 1, lo) || !seen(x0, y0, w, d, lo, 14)) continue;
    const z0 = lo + 1, up = hi - lo, kind = R(5);
    if (kind < 0.1 && !up) { tree(Wd, x0 + 1, y0 + 1, z0, R(6)); tree(Wd, x0 + w - 2, y0 + d - 2, z0, R(7)); box(x0 + w - 1, y0, z0, 1, 1, 5, M.cypress); continue; }
    house(Wd, x0, y0, z0, w, d, up + 4 + Math.floor(R(7) * 4), WALL_M[Math.floor(R(8) * WALL_M.length)], { flat: R(9) < 0.35, alongY: R(10) < 0.45, door: R(11) < 0.5 ? '#3a6ab4' : '#c8483a', awning: R(12) < 0.25 ? AWN[Math.floor(R(13) * AWN.length)] : null, seed: R(14) });
  }
  // the harbour: our ship at the quay, merchantmen, a warship at anchor outside, little boats along the mole
  const elpis = buildShip({ ...Wd, put: (x, y, z, m, id) => put(x + 14, y, z, m, id), box: (x0, y0, z0, w, d, h, m, id) => box(x0 + 14, y0, z0, w, d, h, m, id), face: (x, y, z, s, c) => face(x + 14, y, z, s, c), get: (x, y, z) => get(x + 14, y, z) }, hullKind);
  const sh = p => [p[0] + 14, p[1], p[2]]; elpis.top = sh(elpis.top); elpis.bow = sh(elpis.bow); elpis.stern = sh(elpis.stern); elpis.deck = elpis.deck.map(([x, y]) => [x + 14, y]);
  ships.push(elpis);
  ships.push(ship(Wd, { xs: 24, xe: 42, yc: 10, hw: 3, zt: 2, hull: mat('#5a3a2a', 0.18, 0.36), band: M.yellow, post: true, mast: 12, yard: true, cargo: '#c8a060' }));
  ships.push(ship(Wd, { xs: -2, xe: 14, yc: 8, hw: 3, zt: 2, hull: mat('#6a4a3a', 0.18, 0.36), band: M.green, post: true, mast: 11, yard: true, cargo: '#e8763a' }));
  ships.push(ship(Wd, { kind: 'tri', xs: 67, xe: 93, yc: 2, hw: 2, zt: 1, hull: mat('#3a3440', 0.1, 0.2), band: mat('#3a8ad8'), deck: M.deck, oars: true, ram: true, eye: true, post: true, yard: true, mast: 9 }));
  for (const [x, y, c] of [[48, 12, '#e8483a'], [52, 18, '#ffd040'], [-16, 20, '#3a8ad8'], [-12, 14, '#ffffff'], [67, 24, '#5ab84a']]) smallBoat(Wd, x, y, c, true);
  // the quay: bollards, goods, a cart, the stalls, trees, and the street of shops behind
  for (let x = -20; x < 110; x += 10) if (!(x >= 26 && x < 92)) box(x, QB, 1, 1, 1, 1, M.stoneD);
  const jar = mat('#e8763a', 0.16, 0.34), jars = Wd.newId();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { put(4 + i * 2, QB + 3 + j * 2, 1, jar, jars); put(4 + i * 2, QB + 3 + j * 2, 2, mat('#c85a2a'), jars); }
  const sacks = Wd.newId(); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) box(14 + i * 2, QB + 3 + j * 2, 1, 2, 2, 1 + ((i + j) % 2), mat('#f0d8a0', 0.14, 0.3), sacks);
  const blocks = Wd.newId(); box(-8, QB + 2, 1, 4, 3, 3, M.marble, blocks); box(-3, QB + 3, 1, 3, 3, 2, M.marble, blocks); box(-7, QB + 2, 4, 2, 2, 1, mat('#e8e0d4'), blocks);   // marble from the yard
  const cart = box(-16, QB + 4, 1, 6, 3, 2, M.wood); box(-15, QB + 5, 3, 3, 1, 1, M.marble, cart); face(-15, QB + 6, 1, 'l', INK); face(-12, QB + 6, 1, 'l', INK);
  robes.forEach((robe, i) => stall(Wd, STALL_X(i), QB + 3, robe, i));
  for (let x = -16; x < 120; x += 12) if (on(x, QB + 14, 4)) tree(Wd, x, QB + 14, 1, h3(x, 3, 2));
  stoa(Wd, Math.max(-22, umin + STOA_Y - 2), Math.min(150, umax + STOA_Y + 8));
  for (let by = 0; BY + by * 13 <= yHi + 2; by++) for (let bx = Math.floor((xLo - 20) / 14); bx * 14 <= xHi; bx++) { const x0 = bx * 14 + 2, y0 = BY + by * 13; if (seen(x0, y0, 12, 11, 0, 14)) block(Wd, x0, y0, bx + 40, by + 9); }
  return { V: Wd.V, ships, elpis, maus, seats, tower: [H_TOWER[0] + 2, H_TOWER[1] + 2, 15], view: { umin, umax, vmin, vmax, xLo, xHi, yLo, yHi } };
}
const HCACHE = { key: null };
function drawHalicIso(W, H, t, o) {
  const pal = dayPal(o.clock), hullKind = (S && S.hull) || 'small';
  const ids = merchantsAt('halic', S ? S.ch : 1).filter(id => !MERCHANTS[id].noStall).sort((a, b) => MERCHANTS[a].at - MERCHANTS[b].at);
  const dusk = Math.max(0, Math.min(1, (o.clock - 0.72) / 0.2), Math.min(1, (0.12 - o.clock) / 0.12));
  const key = W + 'x' + H + ':' + hullKind + ':' + ids.join(',');
  if (HCACHE.key !== key) {
    const world = buildHalic(hullKind, W, H, ids.map(id => MERCHANTS[id].look.robe));
    HCACHE.key = key; HCACHE.world = world; HCACHE.R = renderWorld(world, W, H); HCACHE.traders = ids.map(id => person(MERCHANTS[id].look, 'stand')); HCACHE.waterKey = null;
    HCACHE.cv = document.createElement('canvas'); HCACHE.cv.width = W; HCACHE.cv.height = H; HCACHE.ctx = HCACHE.cv.getContext('2d'); HCACHE.img = HCACHE.ctx.createImageData(W, H); HCACHE.dep = new Float32Array(W * H);
    const sp = world.seats.filter((s, i) => hash(i * 2.17) < 0.55); HCACHE.crowd = sp.map((s, i) => [person(look(1000 + i), 'sit'), s, i % 2 === 0]);
  }
  const water = mix(WATER, pal.seaTop, dusk * 0.7);
  if (HCACHE.waterKey !== water) { HCACHE.water = waterFrames(HCACHE.R, W, H, 0, water); HCACHE.waterKey = water; }
  const Rw = HCACHE.R, out = HCACHE.img.data, dep = HCACHE.dep, { OX, OY } = Rw, Wt = HCACHE.water, W0 = HCACHE.world, view = W0.view;
  out.set(Wt.frames[Math.floor(t * 1.5) % 2]); dep.set(Rw.depth);
  const sx = (x, y) => OX + (x - y) * 2, sy = (x, y, z) => OY + x + y - 2 * z;
  const paint = (k, c) => { out[k * 4] = c[0]; out[k * 4 + 1] = c[1]; out[k * 4 + 2] = c[2]; out[k * 4 + 3] = 255; };
  const drawAt = (sp, x, y, z, flip) => {
    const X = Math.round(sx(x, y)) + 2 - (sp.w >> 1), Y = Math.round(sy(x, y, z)) + 2 - sp.h, base = x + y + z + 0.6;
    for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) {
      const si = (j * sp.w + (flip ? sp.w - 1 - i : i)) * 4; if (!sp.data[si + 3]) continue;
      const px_ = X + i, py = Y + j; if (px_ < 0 || py < 0 || px_ >= W || py >= H) continue;
      const k = py * W + px_, d = base + (sp.h - 1 - j) / 2; if (d < dep[k] - 0.3) continue;
      dep[k] = Math.max(dep[k], d); out[k * 4] = sp.data[si]; out[k * 4 + 1] = sp.data[si + 1]; out[k * 4 + 2] = sp.data[si + 2]; out[k * 4 + 3] = 255;
    }
  };
  const drawVox = (m, x, y, z, dir) => {
    const X0 = Math.round(sx(x, y)) - m.ox, Y0 = Math.round(sy(x, y, z)) - m.oy, base = x + y + z;
    for (let j = 0; j < m.h; j++) { const py = Y0 + j; if (py < 0 || py >= H) continue;
      for (let i = 0; i < m.w; i++) { const s = j * m.w + i; if (!m.rgba[s * 4 + 3]) continue; const px_ = X0 + i; if (px_ < 0 || px_ >= W) continue;
        const k = py * W + px_, d = base + m.depth[s]; if (d < dep[k] - 0.3) continue;
        dep[k] = d; out[k * 4] = m.rgba[s * 4]; out[k * 4 + 1] = m.rgba[s * 4 + 1]; out[k * 4 + 2] = m.rgba[s * 4 + 2]; out[k * 4 + 3] = 255; } }
    if (!dir) return;
    for (let k = 1; k < 9; k++) for (const s of [-1, 1]) {
      const wx = x - dir * k * 0.9 + (dir > 0 ? 0 : m.L), wy = y + s * (1.2 + k * 0.35), X = Math.round(sx(wx, wy)) + 2, Y = Math.round(sy(wx, wy, 0)) + 2;
      for (let q = 0; q < 2; q++) { const xx = X + q, i = Y * W + xx; if (xx >= 0 && xx < W && Y >= 0 && Y < H && Wt.isW[i] && dep[i] < -1e8 + 1 && (k + q + Math.floor(t * 6)) % 3) paint(i, k < 4 ? Wt.WH : Wt.LI); }
    }
  };
  const all = [], span = (y, a, b) => [Math.max(a, view.umin + y - 4), Math.min(b, view.umax + y + 4)];
  ids.forEach((id, i) => all.push(['p', HCACHE.traders[i], STALL_X(i) + 3, QB + 6, 1, i % 2 === 1]));
  LANES.forEach((ln, li) => { const [a, b] = span(ln.y, ln.a, 400); if (b <= a) return;
    for (let n = 0; n < ln.n; n++) { const k = 2000 + li * 40 + n, dir = n % 2 ? -1 : 1, v = 1.3 + hash(k * 3.3) * 1.4, d = (t * v + hash(k * 1.7) * (b - a)) % (b - a), x = dir > 0 ? a + d : b - d, y = ln.y + (n % 3 === 2 ? 1 : 0);
      all.push(['p', folk(k, ['amphora', null, 'basket', null, 'sack', null][Math.floor(hash(k * 5.1) * 6)])[Math.floor(t * 4 + n) % 2], x, y, 1, dir < 0]); } });
  ACROSS.forEach((ac, ai) => { const a = Math.max(QB + 12, view.vmin - ac.x - 2), b = Math.min(view.yHi, 400); if (b <= a) return;
    for (let n = 0; n < ac.n; n++) { const k = 2900 + ai * 10 + n, dir = n % 2 ? -1 : 1, v = 1.2 + hash(k * 3.3), d = (t * v + hash(k * 1.7) * (b - a)) % (b - a), y = dir > 0 ? a + d : b - d;
      all.push(['p', folk(k, n % 2 ? 'basket' : null)[Math.floor(t * 4 + n) % 2], ac.x + 0.5, y, 1, dir > 0]); } });
  for (let x = -20; x < 130; x += 7) all.push(['p', folk(2500 + x, x % 3 ? null : 'basket')[0], x, QB + 13, 1, x % 2 === 0]);
  for (let i = 0; i < 9; i += 2) all.push(['p', folk(2600 + i, i % 3 ? 'basket' : null)[0], STALL_X(i) + 5, QB + 8, 1, true]);
  for (const [x, y, k, c] of [[-10, QB + 6, 1, null], [-5, QB + 7, 2, 'sack'], [0, QB + 2, 3, null], [9, QB + 7, 4, 'amphora'], [20, QB + 8, 5, null], [-14, QB + 2, 6, null]]) all.push(['p', folk(2700 + k, c)[0], x, y, 1, k % 2 === 0]);
  for (const [p, f, x, y, z] of HCACHE.crowd.map(([p, s, f]) => [p, f, ...s])) all.push(['p', p, x, y, z, f]);   // the whole town watching from its seats
  if (W0.maus) W0.maus.steps.forEach(([x, y, z], i) => all.push(['p', folk(2800 + i, null)[0], x, y, z, i % 2 === 0]));
  const sh = W0.elpis; all.push(['p', folk(41, null)[0], sh.deck[0][0], sh.deck[0][1], 2, false], ['p', folk(42, 'sack')[0], sh.deck[1][0], sh.deck[1][1], 2, true]);
  W0.ships.forEach((s, i) => { if (s === sh || !s.top) return; if (s.kind === 'tri') all.push(['p', MARINE, s.deck[0][0], s.deck[0][1], 1, false], ['p', MARINE, s.deck[1][0], s.deck[1][1], 1, true]); else all.push(['p', folk(2860 + i, null)[0], s.deck[0][0], s.deck[0][1], 2, i % 2 === 0]); });
  all.push(['p', GUARD, W0.tower[0], W0.tower[1], W0.tower[2] - 1, true], ['p', GUARD, H_PAL[0] + 3, H_PAL[1] + H_PAL[3] + 2, hTop(H_PAL[0] + 3, H_PAL[1] + H_PAL[3]) + 1, false]);
  { const x = 30 + Math.sin(t * 0.25) * 10; all.push(['p', DONKEY[Math.floor(t * 3) % 2], x, QB + 10, 1, Math.cos(t * 0.25) < 0]); }
  all.push(['p', CAT[Math.floor(t * 0.8) % 2], 24, QB + 5, 1, false], ['p', DOG[Math.floor(t * 6) % 2], -2 + ((t * 3) % 30), QB + 11, 1, false]);
  for (const [x, y, ph] of [[34, 24, 0], [44, 20, 1.3], [28, 18, 2.1], [67, 18, 0.7]]) all.push(['p', SWIM[Math.floor(t * 2 + ph) % 2], x, y, -1, ph > 1]);
  const B = boats(), tri = u => { const f = u % 2; return f < 1 ? f : 2 - f; }, dirOf = u => (u % 2) < 1 ? 1 : -1;
  for (const [kind, y, a, b, v, rider] of [['row', 16, 28, 54, 1.4, 2871], ['fish', 21, 26, 50, 1.0, 2872], ['sail', 14, 67, 100, 1.2, 0], ['row', 24, 67, 94, 1.1, 2873]]) {
    const u = t * v / (b - a), x = a + (b - a) * tri(u), dir = dirOf(u), m = B[kind][dir > 0 ? 0 : 1];
    all.push(['v', m, x, y, 0, dir]); if (rider) all.push(['p', folk(rider, null)[0], x + 3, y, 1, dir < 0]);
  }
  all.sort((p, q) => (p[2] + p[3] + p[4]) - (q[2] + q[3] + q[4]));
  for (const e of all) if (e[0] === 'v') drawVox(e[1], e[2], e[3], e[4], e[5]); else drawAt(e[1], e[2], e[3], e[4], e[5]);
  HCACHE.ctx.putImageData(HCACHE.img, 0, 0);
  if (dusk > 0) { const c = HCACHE.ctx; c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.4 * dusk; c.fillStyle = mix(pal.skyBot, '#3a2a6a', 0.55); c.fillRect(0, 0, W, H); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  G.drawImage(HCACHE.cv, 0, 0);
  const dot = (x, y, c) => { G.fillStyle = c; G.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const ln = (a, b, c) => { const x0 = sx(a[0], a[1]) + 2, y0 = sy(a[0], a[1], a[2]) + 1, x1 = sx(b[0], b[1]) + 2, y1 = sy(b[0], b[1], b[2]) + 1, n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) dot(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); };
  for (const s of W0.ships) if (s.top) { ln(s.top, s.bow, '#5a4a40'); ln(s.top, s.stern, '#5a4a40'); }
  ln([sh.bow[0], sh.bow[1], 3], [sh.bow[0] - 1, QB, 2], '#5a4a40'); ln([sh.stern[0] + 2, sh.stern[1], 3], [sh.stern[0] + 5, QB, 2], '#5a4a40');
  W0.ships.forEach((s, i) => { if (!s.top) return; const X = sx(s.top[0], s.top[1]) + 2, Y = sy(s.top[0], s.top[1], s.top[2]), c = s === sh ? ['#ff5a3a', '#c83a2a'] : [['#3a8ad8', '#2a5aa8'], ['#ffd040', '#c8a020'], ['#5ab84a', '#3a8a3a'], ['#ff7ab0', '#c84a80']][i % 4];
    for (let k = 0; k < 6; k++) dot(X - 1 - k, Y - 2 + Math.round(Math.sin(t * 5 - k + i) * (k / 6)), k < 3 ? c[0] : c[1]); });
  { const [x, y, z] = W0.tower, X = sx(x, y) + 2, Y = sy(x, y, z); G.fillStyle = '#5a4a40'; G.fillRect(X + 3, Y - 12, 1, 12); for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) dot(X + 2 - i, Y - 12 + j + Math.round(Math.sin(t * 4 - i) * (i / 6)), j === 1 ? '#ffd040' : '#3a64c8'); }
  if (W0.maus) { const [x, y, z] = W0.maus.top, X = sx(x, y) + 2, Y = sy(x, y, z); for (let k = 0; k < 2; k++) { const gx = X + Math.round(Math.sin(t * 0.7 + k * 3) * 14), gy = Y - 10 - k * 6 + Math.round(Math.cos(t * 0.9 + k) * 3), g = GULL[Math.floor(t * 3 + k) % 2]; for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.data[(j * g.w + i) * 4 + 3]) dot(gx + i, gy + j, INK); } }
  for (let k = 0; k < 3; k++) { const x = ((t * (9 + k * 3) + k * 100) % (W + 20)) - 10, y = 20 + k * 30 + Math.round(Math.sin(t * 1.5 + k) * 3), g = GULL[Math.floor(t * 3 + k) % 2]; for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.data[(j * g.w + i) * 4 + 3]) dot(x + i, y + j, INK); }
  const spots = [];
  ids.forEach((id, i) => {
    const x0 = STALL_X(i), X0 = sx(x0, QB + 7) - 1, X1 = sx(x0 + 7, QB + 2) + 5, Y0 = sy(x0, QB + 2, 10) - 4, Y1 = sy(x0 + 7, QB + 7, 0) + 4;
    spots.push({ id, kind: 'merchant', x0: X0, x1: X1, y0: Y0, y1: Y1 });
    if (o.wants && o.wants.has(id)) { const X = sx(x0 + 3, QB + 4), Y = sy(x0 + 3, QB + 4, 12) - 8 - Math.floor(t * 2) % 2; for (let j = 0; j < WANT.h; j++) for (let ii = 0; ii < WANT.w; ii++) { const si = (j * WANT.w + ii) * 4; if (WANT.data[si + 3]) dot(X + ii, Y + j, '#' + ((1 << 24) | (WANT.data[si] << 16) | (WANT.data[si + 1] << 8) | WANT.data[si + 2]).toString(16).slice(1)); } }
  });
  if (o.spots) o.spots.push(...spots);
}

// ---------- hooking into the game ----------
PORT_SCENES.rhodes = drawRhodesIso;
drawRhodes = drawRhodesIso;
drawSea = drawSeaIso;
PORT_SCENES.halic = drawHalicIso;
const drawCamp0 = drawCamp;
drawCamp = function (W, H, t, stop) { return CAMPSPEC[stop] ? drawCampIso(W, H, t, stop) : drawCamp0(W, H, t, stop); };
drawAnchor = drawAnchorIso;
const fit0 = fitPixels;
fitPixels = function (cv, cssW, cssH, cols) {   // Rhodes, the sea and the title want more, smaller pixels: about 280 across, never bigger than 3 points, each a whole number of screen pixels
  const camp = cv === els.scene && S && S.phase === 'camp' && S.camp && !!CAMPSPEC[S.camp.stop];
  const ours = camp || (cv === els.scene && S && ((S.phase === 'port' && ['rhodes', 'halic'].includes(S.port || 'rhodes')) || (S.phase === 'sea' && S.voyage) || (S.phase === 'camp' && S.camp && S.camp.stop === 'atsea'))) || cv === els.tcanvas;
  if (!ours) return fit0(cv, cssW, cssH, cols);
  const across = camp ? 200 : 280, dpr = window.devicePixelRatio || 1, dev = Math.max(1, Math.min(Math.round(cssW * dpr / across), Math.round((camp ? 4 : 3) * dpr))), P = dev / dpr, W = Math.ceil(cssW / P), H = Math.ceil(cssH / P);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const sw = W * P + 'px', sh = H * P + 'px';
  if (cv.style.width !== sw) cv.style.width = sw;
  if (cv.style.height !== sh) cv.style.height = sh;
  return { W, H, P, ox: (W * P - cssW) / 2 };
};
})();
