// Emporos: Rhodes drawn isometric, black outlines and bright flat colours, inside the real game.
// tools/build-iso-preview.mjs bakes this into samples/game-iso.html, a copy of the game where Rhodes is drawn this way.
// The way eBoy does it: the town fills the whole picture, the water is one flat bright colour with little drawn ripples,
// and every corner holds something: houses, a stoa, ships, boats, people. Only a strip of the game's own sky stays at the top.
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
const horizon = H => Math.round(Math.max(18, H * 0.13));
function camera(W, H) { const ax = 30, ay = QB + 4; return { OX: Math.round(W * 0.5 - (ax - ay) * 2), OY: Math.round(H * 0.84 - (ax + ay) - 30) }; }

function makeWd() {
  const V = new Map(); let NEXT = 1;
  const vk = (x, y, z) => ((x + 700) * 1400 + (y + 700)) * 512 + (z + 64);
  const put = (x, y, z, m, id) => V.set(vk(x, y, z), { x, y, z, t: m.t, l: m.l, r: m.r, id });
  const get = (x, y, z) => V.get(vk(x, y, z));
  const box = (x0, y0, z0, w, d, h, m, id) => { id = id || NEXT++; for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + d; y++) for (let z = z0; z < z0 + h; z++) put(x, y, z, typeof m === 'function' ? m(x, y, z) : m, id); return id; };
  const face = (x, y, z, side, c) => { const v = get(x, y, z); if (v) v[side] = c; };
  return { V, put, get, box, face, newId: () => NEXT++ };
}

// ---------- the world in cubes, built for the part of it a picture of this size can see ----------
function buildWorld(hullKind, stage, W, H, robes) {
  const { OX, OY } = camera(W, H), hz = horizon(H), K = hz - OY;
  const Wd = makeWd(), { put, get, box, face } = Wd;
  const on = (x, y, z, pad) => { const X = OX + (x - y) * 2, Y = OY + x + y - 2 * z; pad = pad == null ? 12 : pad; return X > -4 - pad && X < W + pad && Y > -4 - pad && Y < H + pad; };
  const seen = (x0, y0, w, d, z0, h) => { for (const [x, y] of [[x0, y0], [x0 + w - 1, y0], [x0, y0 + d - 1], [x0 + w - 1, y0 + d - 1], [x0 + (w >> 1), y0 + (d >> 1)]]) for (const z of [z0, z0 + h]) if (on(x, y, z)) return true; return false; };
  const beyond = (x, y, z) => x + y - 2 * z < K - 1;   // past the horizon, where the sky is
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
    if (!isCity(x0 + w - 1, y0 + d - 1) || acro(x0, y0, w, d) || beyond(x0, y0, lv * 2) || !seen(x0, y0, w, d, lo * 2, 16)) continue;
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
  return { w, h, ox, oy, rgba: R.rgba, depth: R.depth };
}
function boatModel(kind, dir) {   // the same boat facing either way along x
  const m = model(Wd0 => {
    const L = { row: 6, fish: 7, sail: 10, tri: 28 }[kind], f = x => dir > 0 ? x : L - x;
    const Wd = { ...Wd0, put: (x, y, z, m, id) => Wd0.put(f(x), y, z, m, id), face: (x, y, z, s, c) => Wd0.face(f(x), y, z, s, c),
      box: (x0, y0, z0, w, d, h, m, id) => Wd0.box(dir > 0 ? x0 : L - x0 - w + 1, y0, z0, w, d, h, typeof m === 'function' ? (x, y, z) => m(f(x), y, z) : m, id) };
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
  // a strip of the game's sky, flat, with its sun, clouds and the far coast of Asia
  G.drawImage(layer('isoSky' + W + 'x' + H + ':' + Math.round(o.clock * 60), W, H, () => {
    R(0, 0, W, hz + 2, mix(pal.skyTop, pal.skyBot, 0.5));
    R(0, Math.round(hz * 0.45), W, hz, mix(pal.skyTop, pal.skyBot, 0.8));
    sunDisc(Math.round(W * 0.84), Math.round(hz * 0.4), 4, pal.sun);
    ridge(0, W, hz + 1, Math.max(3, hz * 0.28), 30, 3, pal.far);
  }), 0, 0);
  clouds(W, hz, t, pal.cloud, 7, 3);
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
  const K = hz - OY;   // nothing sails past the horizon: a boat comes out from behind the town, or over the edge of the sea
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
