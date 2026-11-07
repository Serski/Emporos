// Balance check: plays Chapters I to V in turn, with simple bots that follow different strategies, over many seeds,
// and reports what each one earns. Reads the rules straight out of the game file. No dependencies.
// Usage: node tests/sim.js [path/to/game.html] [games per strategy] [chapters, e.g. 4 or 1,2]
const fs = require('fs');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'src', 'game.html');
const GAMES = +process.argv[3] || 200;
const ONLY = process.argv[4] ? process.argv[4].split(',').map(Number) : [1, 2, 3, 4, 5];   // which chapters to report
const html = fs.readFileSync(file, 'utf8');
const code = html.split('// ===== ENGINE START =====')[1].split('// ===== ENGINE END =====')[0];
const E = new Function(code + `
return { newGame, begin, buy, sell, haggle, hire, autoPack, setSail, tick, setRow, campAct, sleep, needsRoute, resolveEvent,
  repay, eta, provisions, mouths, holdUsed, holdCells, sellPrice, buyPrice, merchantsAt, MERCHANTS, GOODS, OUT, dockItems,
  atRisk, stockLeft, cargoValue, sailCheck, isCargo, takeLoan, nextChapter, migrate, offer, routeFrom, CHAPTERS, fitted, freeSquares, toll,
  takeFreight, orderShip, jettisonPlan, SHIP_PRICE, hiresAt, shipTerms, buyShip, changeHull, holdCells, feeOf, dockOf, holdInShape, HULLS, DAYS, fitted, tooSmall, bestSpot };`)();

// Each strategy: what to carry out and home, who to hire, and what to do when things go wrong.
const STRATEGIES = {
  careful: { bolt: true, hires: ['philon', 'lykos', 'kydas'], out: ['sponge', 'sponge', 'sponge', 'cups', 'cups', 'cups', 'wine', 'wine', 'wine', 'wine', 'figs', 'figs', 'figs', 'figs'],
    home: ['marble', 'marble', 'scent', 'scent', 'scent', 'cloth', 'honey', 'honey', 'honey', 'honey'], pirates: 'fight', squall: 'auto', route: 'coast', water: 3, barley: 2 },
  fighters: { bolt: false, hires: ['philon', 'kydas'], out: ['wine', 'wine', 'wine', 'wine', 'wine', 'figs', 'figs', 'figs', 'figs', 'sponge', 'sponge'],
    home: ['marble', 'honey', 'honey', 'honey', 'honey', 'cloth', 'cloth', 'honey'], pirates: 'fight', squall: 'ride', route: 'coast', water: 3, barley: 2 },
  greedy: { bolt: false, hires: [], out: ['wine', 'wine', 'wine', 'wine', 'wine', 'wine', 'wine', 'wine', 'cups', 'cups', 'cups', 'cups', 'figs', 'figs', 'figs', 'figs', 'figs'],
    home: ['marble', 'marble', 'scent', 'scent', 'scent', 'scent', 'honey', 'honey', 'honey', 'honey', 'honey', 'honey', 'hermes'], pirates: 'pay', squall: 'ride', route: 'open', water: 2, barley: 1 },
  brave: { bolt: true, hires: [], out: ['wine', 'wine', 'wine', 'wine', 'wine', 'wine', 'figs', 'figs', 'figs', 'figs', 'sponge', 'sponge', 'cups', 'cups'],
    home: ['marble', 'marble', 'honey', 'honey', 'honey', 'honey', 'honey', 'cloth', 'scent', 'scent'], pirates: 'fight', squall: 'auto', route: 'coast', water: 2, barley: 1 },
  runner: { bolt: false, hires: [], out: ['wine', 'wine', 'wine', 'figs', 'figs', 'figs'], home: ['honey', 'honey', 'honey', 'scent', 'scent', 'cloth'],
    pirates: 'run', squall: 'shelter', route: 'coast', water: 2, barley: 1 },
  hungry: { bolt: false, hires: ['philon'], out: ['wine', 'wine', 'wine', 'wine', 'wine', 'wine', 'wine', 'wine', 'figs', 'figs', 'figs', 'figs', 'figs', 'figs'],
    home: ['honey', 'honey', 'honey', 'honey', 'honey', 'honey', 'honey', 'honey', 'marble'], pirates: 'pay', squall: 'ride', route: 'open', water: 0, barley: 0 },
};

// Chapter II strategies. Chapter I is played the careful way first, so every Chapter II game starts from a real save.
const SUMMER = {
  fitted: { loan: 'short', fit: ['bench', 'awning', 'pithos'], hires: { rhodes: ['philon'], kos: ['pythes', 'lykos'], miletus: ['seuthes'] },
    out: ['wine', 'wine', 'wine', 'wine', 'cups', 'cups', 'cups', 'sponge', 'sponge', 'figs', 'figs'], kos: ['salve', 'salve', 'cloth'],
    miletus: ['purple', 'purple', 'purple', 'couch', 'couch', 'wool', 'wool'], kosHome: [], warship: 'argue', flotsam: 'haul', pirates: 'fight', route: 'coast', water: 1, barley: 2 },
  greedy: { loan: true, fit: [], hires: {}, out: ['wine', 'wine', 'wine', 'wine', 'wine', 'wine', 'wine', 'cups', 'cups', 'cups', 'cups', 'figs', 'figs', 'figs', 'figs'],
    kos: ['salve', 'salve', 'salve', 'cloth', 'cloth'], miletus: ['couch', 'couch', 'couch', 'purple', 'purple', 'purple', 'wool', 'wool', 'wool'], kosHome: ['salve', 'salve'],
    warship: 'pay', flotsam: 'haul', pirates: 'pay', route: 'open', water: 2, barley: 2 },
  smart: { loan: 'short', oracle: true, fit: ['bench', 'awning'], hires: { rhodes: ['philon'], miletus: ['seuthes?'] },
    out: ['wine', 'wine', 'wine', 'wine', 'cups', 'cups', 'cups', 'sponge', 'sponge', 'figs', 'figs'], kos: ['salve', 'salve', 'cloth'],
    miletus: ['purple', 'purple', 'purple', 'couch', 'couch', 'couch', 'wool', 'wool'], kosHome: [], warship: 'argue', flotsam: 'haul', pirates: 'fight', route: 'coast', water: 1, barley: 2 },
  oars: { loan: 'short', fit: ['bench', 'bench'], hires: { rhodes: ['philon'], miletus: ['seuthes'] }, out: ['wine', 'wine', 'wine', 'wine', 'figs', 'figs', 'figs', 'sponge', 'sponge'],
    kos: ['cloth', 'cloth'], miletus: ['wool', 'wool', 'couch', 'purple', 'purple'], kosHome: [], warship: 'gift', flotsam: 'leave', pirates: 'fight', route: 'coast', water: 2, barley: 2 },
  bare: { loan: 'short', fit: [], hires: {}, out: ['wine', 'wine', 'wine', 'figs', 'figs', 'figs'], kos: ['cloth'], miletus: ['wool', 'wool', 'couch'], kosHome: [],
    warship: 'argue', flotsam: 'leave', pirates: 'run', route: 'coast', water: 2, barley: 2 },
};

function seller(s, g, dir) {   // the merchant here with the best price for g
  let best = null, bp = dir === 'buy' ? Infinity : 0;
  for (const id of E.merchantsAt(s.port, s.ch)) {
    const p = dir === 'buy' ? E.buyPrice(s, id, g) : E.sellPrice(s, id, g);
    if (!p || (dir === 'buy' && E.stockLeft(s, id, g) <= 0)) continue;
    if (dir === 'buy' ? p < bp : p > bp) { bp = p; best = id; }
  }
  return best;
}
function buyList(s, list) {
  for (const g of list) {
    const m = seller(s, g, 'buy');
    if (!m) continue;
    if (!E.buy(s, m, g).ok) continue;
    E.autoPack(s);
    if (E.dockItems(s).length) { const it = E.dockItems(s)[0]; E.sell(s, m, it.g); }   // it did not fit: hand it back
  }
}
function sellAll(s) {
  const tried = new Set();
  for (let guard = 0; guard < 80; guard++) {
    const it = s.items.find(i => E.isCargo(i) && !tried.has(i.g) && seller(s, i.g, 'sell') && E.offer(s, seller(s, i.g, 'sell')).buys[i.g]);
    if (!it) break;
    const m = seller(s, it.g, 'sell');
    if (!s.visit.tries[m]) E.haggle(s, m);
    if (!E.sell(s, m, it.g).ok) tried.add(it.g);
  }
}
const STORES = { rhodes: 'stores', halic: 'hstores', kos: 'kstores', miletus: 'mstores', delos: 'dstores', piraeus: 'pstores', corinth: 'kostores', corcyra: 'cstores', croton: 'krstores', taras: 'tstores' };
function provision(s, st) {
  for (let k = 0; k < st.water; k++) E.buy(s, STORES[s.port], 'water');
  for (let k = 0; k < st.barley; k++) E.buy(s, STORES[s.port], 'barley');
  for (const it of s.items) if (E.GOODS[it.g].water) it.fill = 10;   // the fountain is free
  E.autoPack(s);
}
function voyage(s, st, notes) {
  for (let guard = 0; guard < 20000 && (s.phase === 'sea' || s.phase === 'camp'); guard++) {
    if (s.pending) {
      const id = s.pending;
      let c = id === 'squall' ? (st.squall === 'auto' ? (E.atRisk(s).length ? 'shelter' : 'ride') : st.squall) : id === 'warship' ? st.warship : id === 'flotsam' ? st.flotsam
        : id === 'storm3' || id === 'malea' ? (typeof st.storm === 'function' ? st.storm(s) : st.storm) : id === 'survivors' ? (st.survivors || 'take')
        : id === 'becalmed' ? (st.calm === 'pour' && !s.items.some(i => i.where === 'hold' && (i.g === 'wine' || i.g === 'coanwine')) ? 'row' : st.calm || 'row') : st.pirates;
      if (id === 'caught') c = st.pirates === 'run' ? 'pay' : st.pirates;
      if (id === 'warship' && c === 'gift' && !s.items.some(i => i.where === 'hold' && (i.g === 'wine' || i.g === 'coanwine'))) c = 'pay';
      E.resolveEvent(s, c);
      notes.push(id + ':' + c);
      continue;
    }
    if (s.phase === 'camp') {
      const stop = s.camp.stop;
      if (stop === 'symi') { E.campAct(s, 'sponge'); E.campAct(s, 'sponge'); E.campAct(s, 'spring'); E.autoPack(s); }
      if (stop === 'triopion') E.campAct(s, 'fish');
      if (stop === 'loryma') E.campAct(s, 'spring');
      if (stop === 'didyma') { E.campAct(s, 'spring'); if (st.oracle) E.campAct(s, 'oracle'); }
      if (stop === 'nisyros' || stop === 'kea') E.campAct(s, 'spring');
      if (stop === 'astypalaia' || stop === 'melos' || stop === 'pylos') { E.campAct(s, 'spring'); if (st.fish !== false) E.campAct(s, 'fish'); }
      if (stop === 'ithaca') { E.campAct(s, 'spring'); if (st.omen) E.campAct(s, 'cave'); }
      if (stop === 'kythera') E.campAct(s, 'spring');
      if (stop === 'zakynthos') { E.campAct(s, 'spring'); if (st.fish !== false) E.campAct(s, 'fish'); for (let k = 0; k < (st.pitch || 0); k++) E.campAct(s, 'pitch'); E.autoPack(s); for (const it of E.dockItems(s)) if (it.g === 'pitch') s.items.splice(s.items.indexOf(it), 1); }
      E.sleep(s, E.needsRoute(s) ? (typeof st.route === 'function' ? st.route(s) : st.route) : undefined);
      continue;
    }
    const D = E.DAYS[s.voyage.day];
    E.setRow(s, D.untilDark ? (s.voyage.wind === 'calm' && st.calm !== 'wait' && s.flags.calm !== 'waited' && s.flags.calm !== 'poured') : E.eta(s, false) > 0.97);   // out of sight of land, row only through a calm
    E.tick(s, 0.5);
  }
}
function play(name, seed) {
  const st = STRATEGIES[name], s = E.newGame(seed), notes = [];
  E.begin(s);
  for (const id of ['thras', 'korinna', 'aristeia']) E.haggle(s, id);
  if (st.bolt) { E.buy(s, 'arsenal', 'bolt'); E.autoPack(s); }
  for (const h of st.hires) if (h === 'philon') { E.hire(s, h); E.autoPack(s); }
  provision(s, st);
  buyList(s, st.out);
  const outCargo = s.items.filter(E.isCargo).length;
  E.setSail(s);
  voyage(s, st, notes);
  if (s.port !== 'halic') throw new Error(name + ' did not reach Halicarnassus: ' + s.phase);
  sellAll(s);
  for (const h of st.hires) if (h !== 'philon') { E.hire(s, h); E.autoPack(s); }
  provision(s, st);
  for (const id of ['mania', 'theodote', 'hermon']) if (!s.visit.tries[id]) E.haggle(s, id);
  buyList(s, st.home);
  const homeCargo = s.items.filter(E.isCargo).length;
  E.setSail(s);
  voyage(s, st, notes);
  if (s.port !== 'rhodes' || !s.home) throw new Error(name + ' did not get home: ' + s.phase);
  sellAll(s);
  E.repay(s);
  E.OUT.length = 0;
  if (!Number.isFinite(s.silver) || s.silver < 0) throw new Error('bad silver ' + s.silver);
  return { sum: s.summary, outCargo, homeCargo, notes, hungry: s.stats.hungry, thirsty: s.stats.thirsty, nights: s.stats.nights };
}

function summer(name, seed) {
  const s = E.newGame(seed), notes = [];
  playChapterOne(s);
  E.nextChapter(s);
  return summerOn(s, SUMMER[name], notes, name);
}
function summerOn(s, st, notes, name) {
  E.begin(s);
  if (st.loan === true || (st.loan === 'short' && s.silver < 120)) E.takeLoan(s);
  for (const f of st.fit) { E.buy(s, 'arsenal', f); E.autoPack(s); }
  for (const h of st.hires.rhodes || []) { E.hire(s, h); E.autoPack(s); }
  for (const id of ['thras', 'korinna', 'aristeia']) E.haggle(s, id);
  provision(s, st);
  buyList(s, st.out);
  E.setSail(s);
  voyage(s, st, notes);
  if (s.port !== 'kos') throw new Error(name + ' did not reach Kos: ' + s.phase);
  for (const h of st.hires.kos || []) { E.hire(s, h); E.autoPack(s); }
  provision(s, { water: 0, barley: 1 });
  buyList(s, st.kos);
  E.setSail(s);
  voyage(s, st, notes);
  if (s.port !== 'miletus') throw new Error(name + ' did not reach Miletus: ' + s.phase + ' ' + s.port);
  sellAll(s);
  for (const h of st.hires.miletus || []) { if (h.endsWith('?') && !s.flags.pirates2) continue; E.hire(s, h.replace('?', '')); E.autoPack(s); }   // '?': only if the oracle warned of pirates
  provision(s, { water: 0, barley: 1 });
  for (const id of ['leandros', 'archelaos']) if (!s.visit.tries[id]) E.haggle(s, id);
  buyList(s, st.miletus);
  E.setSail(s);
  voyage(s, st, notes);
  if (s.port !== 'kos') throw new Error(name + ' did not get back to Kos: ' + s.phase);
  provision(s, { water: 0, barley: 1 });
  buyList(s, st.kosHome);
  E.setSail(s);
  voyage(s, st, notes);
  if (s.port !== 'rhodes' || !s.home) throw new Error(name + ' did not get home in summer: ' + s.phase + ' ' + s.port);
  for (const g of ['couch']) if (s.items.some(i => i.g === g)) E.sell(s, 'bank', g);
  sellAll(s);
  E.repay(s);
  E.OUT.length = 0;
  if (!Number.isFinite(s.silver) || s.silver < 0) throw new Error('bad silver ' + s.silver);
  return { sum: s.summary, start: s.history[0].silver, notes, hungry: s.stats.hungry, thirsty: s.stats.thirsty, nights: s.stats.nights };
}
function playChapterOne(s) {   // the careful way, without the bookkeeping
  const st = STRATEGIES.careful, notes = [];
  E.begin(s);
  for (const id of ['thras', 'korinna', 'aristeia']) E.haggle(s, id);
  E.buy(s, 'arsenal', 'bolt'); E.autoPack(s);
  E.hire(s, 'philon'); E.autoPack(s);
  provision(s, st); buyList(s, st.out); E.setSail(s); voyage(s, st, notes);
  sellAll(s);
  for (const h of ['lykos', 'kydas']) { E.hire(s, h); E.autoPack(s); }
  provision(s, st); buyList(s, st.home); E.setSail(s); voyage(s, st, notes);
  sellAll(s); E.repay(s);
}

// Chapter III strategies. Chapters I and II are played the careful and the smart way first.
// out/piraeus/delosHome: what to buy, in order of preference. sellOut: what to sell at Delos on the way out (the rest goes on to Athens).
const n = (g, k) => Array(k).fill(g);
const AUTUMN = {
  smart: { loan: 200, hires: { rhodes: ['euphron'], delosHome: ['kydas?'] }, freight: ['rd', 'rp', 'pr'],
    out: [...n('wheat', 8), ...n('sponge', 3), ...n('wheat', 4), ...n('wine', 3)], sellOut: { wheat: 4 }, delosOut: [],
    piraeus: [...n('scrolls', 4), ...n('marble', 2), ...n('vase', 4), ...n('hymhoney', 4)], delosHome: [],
    storm: 'hold', pirates: 'fight', route: 'coast', water: 3, barley: 3 },
  greedy: { loan: true, hires: {}, freight: [],
    out: [...n('wheat', 12), ...n('wine', 6)], sellOut: { wheat: 4 }, delosOut: ['marble', 'marble'],
    piraeus: [...n('marble', 2), ...n('scrolls', 4), ...n('vase', 6), ...n('hymhoney', 4), ...n('oil', 4)], delosHome: [],
    storm: 'hold', pirates: 'pay', route: 'open', water: 2, barley: 2 },
  freighter: { loan: 200, hires: { rhodes: ['euphron'] }, freight: ['rd', 'rp', 'pr'],
    out: [...n('wheat', 8), ...n('sponge', 2)], sellOut: {}, delosOut: [],
    piraeus: [...n('scrolls', 4), ...n('vase', 3), ...n('hymhoney', 3)], delosHome: [],
    storm: 'hold', pirates: 'fight', route: 'coast', water: 3, barley: 3 },
  marble: { loan: true, hires: { rhodes: ['euphron'], delosHome: ['kydas'] }, freight: ['rp'],
    out: [...n('wheat', 10), ...n('wine', 2)], sellOut: { wheat: 2 }, delosOut: ['marble', 'marble'],
    piraeus: [...n('marble', 2), ...n('scrolls', 4), ...n('hymhoney', 2)], delosHome: [],
    storm: 'hold', pirates: 'fight', route: 'coast', water: 3, barley: 3 },
  thrower: { loan: 200, hires: {}, freight: ['rd', 'rp', 'pr'],
    out: [...n('wheat', 12), ...n('wine', 3), ...n('sponge', 2)], sellOut: { wheat: 4 }, delosOut: [],
    piraeus: [...n('scrolls', 4), ...n('marble', 1), ...n('vase', 4), ...n('hymhoney', 4)], delosHome: [],
    storm: 'throw', pirates: 'fight', route: 'coast', water: 3, barley: 3 },
  runner: { loan: 200, hires: {}, freight: ['rp'],
    out: [...n('wheat', 12), ...n('wine', 3), ...n('sponge', 2)], sellOut: { wheat: 4 }, delosOut: [],
    piraeus: [...n('scrolls', 4), ...n('marble', 1), ...n('vase', 4), ...n('hymhoney', 4)], delosHome: [],
    storm: 'run', pirates: 'run', route: 'coast', water: 4, barley: 4 },
  careless: { loan: 200, hires: {}, freight: ['rd', 'rp', 'pr'],
    out: [...n('wheat', 12), ...n('wine', 4)], sellOut: { wheat: 4 }, delosOut: [],
    piraeus: [...n('vase', 8), ...n('scrolls', 4), ...n('hymhoney', 4)], delosHome: [],
    storm: 'hold', pirates: 'fight', route: 'open', water: 3, barley: 3 },
};
// Variants of the smart autumn, to measure one choice at a time.
const like = (base, o) => Object.assign({}, AUTUMN[base], o);
Object.assign(AUTUMN, {
  guarded: like('smart', { hires: { rhodes: ['euphron'], piraeus: ['seuthes'], delosHome: ['kydas?'] } }),
  nocarp: like('smart', { hires: { delosHome: ['kydas?'] } }),
  smartthrow: like('smart', { hires: { delosHome: ['kydas?'] }, storm: 'throw' }),
  smartrun: like('smart', { hires: { delosHome: ['kydas?'] }, storm: 'run', water: 4, barley: 4 }),
  nofreight: like('smart', { freight: [] }),
  open: like('smart', { route: 'open' }),
});
function sellSome(s, want) {   // sell up to want[g] of each good here, to the best buyer
  for (const g in want) for (let k = 0; k < want[g]; k++) {
    const m = seller(s, g, 'sell');
    if (!m || !s.items.some(i => i.g === g)) break;
    if (!s.visit.tries[m]) E.haggle(s, m);
    if (!E.sell(s, m, g).ok) break;
  }
}
function hireHere(s, list) {
  for (const h of list || []) { if (h.endsWith('?') && !s.flags['pirates' + s.ch]) continue; if (E.hire(s, h.replace('?', '')).ok) E.autoPack(s); }
}
function freightHere(s, st) {
  for (const id of E.merchantsAt(s.port, s.ch)) for (const f of E.offer(s, id).freight) if (st.freight.includes(f.id)) { E.takeFreight(s, id, f.id); E.autoPack(s); }
  for (const it of E.dockItems(s)) if (it.g === 'freight') E.OUT.length = 0;   // no room: setSail hands it back
}
function trim(s, g, keep) {   // leave spare jars and sacks on the quay
  const all = s.items.filter(i => i.g === g).sort((a, b) => (b.fill || 0) - (a.fill || 0));
  for (const it of all.slice(keep)) s.items.splice(s.items.indexOf(it), 1);
}
function provisionTo(s, water, barley) {   // top up to so many full jars and sacks
  trim(s, 'water', water); trim(s, 'barley', barley);
  while (s.items.filter(i => i.g === 'water').length < water && E.buy(s, STORES[s.port], 'water').ok);
  while (s.items.filter(i => i.g === 'barley').length < barley && E.buy(s, STORES[s.port], 'barley').ok);
  for (const it of s.items) if (E.GOODS[it.g].water) it.fill = E.GOODS[it.g].water;
  E.autoPack(s);
}
function autumn(name, seed) {
  const s = E.newGame(seed);
  playChapterOne(s); E.nextChapter(s);
  summerOn(s, SUMMER.smart, [], 'smart'); E.nextChapter(s);
  return autumnOn(s, AUTUMN[name], name);
}
function autumnOn(s, st, name) {
  const notes = [], start = s.silver, startDebt = s.loan.due;
  E.begin(s);
  if (st.loan === true || (typeof st.loan === 'number' && s.silver < st.loan)) E.takeLoan(s);
  hireHere(s, st.hires.rhodes);
  for (const id of ['thras', 'korinna', 'stores']) E.haggle(s, id);
  provisionTo(s, st.water, st.barley);
  freightHere(s, st);
  buyList(s, st.out);
  const outCargo = s.items.filter(i => E.isCargo(i) || i.g === 'freight').length;
  E.setSail(s);
  voyage(s, st, notes);
  if (s.port !== 'delos') throw new Error(name + ' did not reach Delos: ' + s.phase + ' ' + s.port);
  sellSome(s, st.sellOut);
  provisionTo(s, st.water, st.barley);
  buyList(s, st.delosOut);
  E.setSail(s);
  voyage(s, st, notes);
  if (s.port !== 'piraeus') throw new Error(name + ' did not reach Piraeus: ' + s.phase + ' ' + s.port);
  sellAll(s);
  provisionTo(s, st.water, st.barley);
  for (const id of ['nikanor', 'philinna', 'melitta', 'timarchos']) if (!s.visit.tries[id]) E.haggle(s, id);
  hireHere(s, st.hires.piraeus);
  freightHere(s, st);
  buyList(s, st.piraeus);
  const homeCargo = s.items.filter(i => E.isCargo(i) || i.g === 'freight').length;
  E.setSail(s);
  voyage(s, st, notes);
  if (s.port !== 'delos') throw new Error(name + ' did not get back to Delos: ' + s.phase + ' ' + s.port);
  hireHere(s, st.hires.delosHome);
  provisionTo(s, st.water, st.barley);
  buyList(s, st.delosHome);
  E.setSail(s);
  voyage(s, st, notes);
  if (s.port !== 'rhodes' || !s.home) throw new Error(name + ' did not get home in autumn: ' + s.phase + ' ' + s.port);
  sellAll(s);
  E.repay(s);
  const end = s.silver, T = E.shipTerms(s), ship = !st.noShip && E.orderShip(s).ok ? (T.lent ? 'borrowed' : 'paid') : 'not ordered';
  E.OUT.length = 0;
  if (!Number.isFinite(s.silver) || s.silver < 0) throw new Error('bad silver ' + s.silver);
  return { sum: s.summary, start, startDebt, ship, outCargo, homeCargo, notes, hungry: s.stats.hungry, thirsty: s.stats.thirsty, nights: s.stats.nights, end };
}

// Chapter IV strategies, in the new ship. Chapters I to III are played the careful, smart and smart ways first.
// out: bought at Rhodes. sellCor/corOut: sold and bought at Corinth on the way out. corcyra: bought at Corcyra. corHome: bought at Corinth on the way home.
const SPRING = {
  smart: { loan: 250, buyShip: true, hires: { rhodes: ['euphron', 'lykos'], corinth: ['kallias'], corcyra: ['neoptolemos?'] }, freight: ['rc', 'ry', 'ry2', 'yr', 'yr2'],
    out: [...n('incense', 8), ...n('wheat', 14), ...n('papyrus', 10)], sellCor: { wheat: 14, papyrus: 4 }, corOut: [],
    corcyra: [...n('amber', 2), ...n('hound', 2), ...n('timber', 4), ...n('cheese', 12)], sellCorHome: {}, corHome: n('bronze', 4),
    survivors: 'take', omen: true, route: s => s.flags.gale4 ? 'coast' : 'open', storm: 'hold', pirates: 'fight', water: 4, barley: 4 },
};
const like4 = (base, o) => Object.assign({}, SPRING[base], o);
Object.assign(SPRING, {
  gulf: like4('smart', { route: 'coast', omen: false }),
  malea: like4('smart', { route: 'open', omen: false, corOut: n('bronze', 4), corHome: [] }),
  heartless: like4('smart', { survivors: 'leave' }),
  nopilot: like4('smart', { hires: { rhodes: ['euphron', 'lykos'], corcyra: ['neoptolemos?'] }, survivors: 'leave' }),
  nodoctor: like4('smart', { hires: { rhodes: ['euphron'], corinth: ['kallias'], corcyra: ['neoptolemos?'] } }),
  greedy: { loan: true, buyShip: true, hires: {}, freight: [], out: [...n('wheat', 14), ...n('incense', 8), ...n('papyrus', 10), ...n('wine', 8)], sellCor: { wheat: 10 }, corOut: n('bronze', 4),
    corcyra: [...n('amber', 2), ...n('hound', 2), ...n('timber', 3), ...n('cheese', 14)], sellCorHome: {}, corHome: [],
    survivors: 'leave', route: 'open', storm: 'hold', pirates: 'pay', water: 3, barley: 3 },
  bare: { loan: false, buyShip: true, hires: {}, freight: ['ry'], out: [...n('wheat', 8), ...n('incense', 4)], sellCor: { wheat: 8 }, corOut: [],
    corcyra: [...n('amber', 1), ...n('cheese', 6)], sellCorHome: {}, corHome: [], survivors: 'take', route: 'coast', storm: 'run', pirates: 'run', water: 4, barley: 4 },
  elpis: like4('smart', { noShip: true, buyShip: false, out: [...n('wheat', 6), ...n('incense', 6), ...n('papyrus', 4), ...n('sponge', 1)], corOut: n('bronze', 2),
    corcyra: [...n('amber', 2), ...n('hound', 1), ...n('cheese', 4)], water: 3, barley: 3 }),
  latebuyer: like4('smart', { noShip: true, buyShip: true }),
});
function spring4(name, seed) {
  const st = SPRING[name], s = E.newGame(seed);
  playChapterOne(s); E.nextChapter(s);
  summerOn(s, SUMMER.smart, [], 'smart'); E.nextChapter(s);
  autumnOn(s, Object.assign({}, AUTUMN.smart, { noShip: !!st.noShip }), 'smart'); E.nextChapter(s);
  return springOn(s, st, name);
}
function springOn(s, st, name) {
  const notes = [], start = s.silver, startDebt = s.loan.due, ordered = s.hull === 'medium';
  E.begin(s);
  if (st.buyShip && s.hull === 'small') E.buyShip(s);
  const hull = s.hull;
  if (st.loan === true || (typeof st.loan === 'number' && s.silver < st.loan)) E.takeLoan(s);
  hireHere(s, st.hires.rhodes);
  for (const id of ['thras', 'stores', 'alexandrian']) E.haggle(s, id);
  provisionTo(s, st.water, st.barley);
  freightHere(s, st);
  buyList(s, st.out);
  const outCargo = s.items.filter(i => E.isCargo(i) || i.g === 'freight').length;
  E.setSail(s); voyage(s, st, notes);
  if (s.port !== 'corinth') throw new Error(name + ' did not reach Corinth: ' + s.phase + ' ' + s.port + ' ' + s.pending);
  sellSome(s, st.sellCor);
  hireHere(s, st.hires.corinth);
  provisionTo(s, st.water, st.barley);
  if (!s.visit.tries.smith) E.haggle(s, 'smith');
  buyList(s, st.corOut);
  E.setSail(s); voyage(s, st, notes);
  if (s.port !== 'corcyra') throw new Error(name + ' did not reach Corcyra: ' + s.phase + ' ' + s.port);
  sellAll(s);
  hireHere(s, st.hires.corcyra);
  provisionTo(s, st.water, st.barley);
  for (const id of ['bato', 'admetos', 'kraton']) if (!s.visit.tries[id]) E.haggle(s, id);
  freightHere(s, st);
  buyList(s, st.corcyra);
  const homeCargo = s.items.filter(i => E.isCargo(i) || i.g === 'freight').length;
  E.setSail(s); voyage(s, st, notes);
  if (s.port === 'corinth') { sellSome(s, st.sellCorHome); provisionTo(s, st.water, st.barley); buyList(s, st.corHome); E.setSail(s); voyage(s, st, notes); }
  if (s.port !== 'rhodes' || !s.home) throw new Error(name + ' did not get home in spring: ' + s.phase + ' ' + s.port);
  sellAll(s);
  E.repay(s);
  E.OUT.length = 0;
  if (!Number.isFinite(s.silver) || s.silver < 0) throw new Error('bad silver ' + s.silver);
  return { sum: s.summary, start, startDebt, ordered, hull, outCargo, homeCargo, notes, hungry: s.stats.hungry, thirsty: s.stats.thirsty, nights: s.stats.nights, end: s.silver, debt: s.debt };
}

// Chapter V strategies: across the open sea to Croton and Taras. Chapters I to IV are played the careful, smart, smart and smart ways first.
// out: bought at Rhodes. sellCro/croOut: sold and bought at Croton on the way out. taras: bought at Taras. croHome: bought at Croton on the way home. corHome: at Corinth, if the way home goes through the Gulf.
const SUMMER5 = {
  smart: { loan: 300, fit: ['awning'], hires: { rhodes: ['lykos', 'euphron'], croton: ['milon?'], taras: ['archippos'] }, freight: ['rk', 'rt1', 'rt2', 'tr1', 'tr2'],
    out: [...n('incense', 8), ...n('sponge', 2), ...n('scent', 4), ...n('papyrus', 12), ...n('wine', 2)], sellCro: { incense: 3, papyrus: 5, wine: 2 }, croOut: [],
    taras: [...n('purple', 3), 'horse', ...n('tarwool', 4), ...n('krater', 3)], croHome: [...n('pitch', 4), ...n('timber', 2)], corHome: n('bronze', 4),
    calm: 'row', pitch: 0, route: 'coast', storm: 'hold', pirates: 'fight', water: 3, barley: 5 },
};
const like5 = (base, o) => Object.assign({}, SUMMER5[base], o);
Object.assign(SUMMER5, {
  malea: like5('smart', { route: 'open' }),
  waiter: like5('smart', { calm: 'wait' }),
  pourer: like5('smart', { calm: 'pour', out: ['wine', ...SUMMER5.smart.out] }),
  noawning: like5('smart', { fit: [] }),
  wet: like5('smart', { fit: ['awning', 'pithos'], water: 4 }),
  nomilon: like5('smart', { hires: { rhodes: ['lykos', 'euphron'], taras: ['archippos'] } }),
  nopilot: like5('smart', { hires: { rhodes: ['lykos', 'euphron'], croton: ['milon?'] } }),
  nohorse: like5('smart', { taras: [...n('purple', 3), ...n('tarwool', 4), ...n('krater', 3)], croHome: [...n('timber', 2), ...n('pitch', 4)] }),
  dry: like5('smart', { water: 2 }),
  greedy: { loan: true, fit: [], hires: {}, freight: [], out: [...n('incense', 8), ...n('papyrus', 12), ...n('wine', 8), ...n('scent', 4)], sellCro: { incense: 4, papyrus: 6, wine: 4 }, croOut: [],
    taras: [...n('purple', 3), ...n('tarwool', 4), ...n('krater', 3), 'horse'], croHome: n('timber', 2), corHome: [], calm: 'wait', pitch: 3, route: 'open', storm: 'hold', pirates: 'pay', water: 3, barley: 4 },
  bare: { loan: false, fit: ['awning'], hires: {}, freight: ['rt1'], out: [...n('incense', 6), ...n('wine', 2)], sellCro: { wine: 2 }, croOut: [],
    taras: [...n('purple', 2), ...n('tarwool', 2)], croHome: [], corHome: [], calm: 'wait', pitch: 3, route: 'coast', storm: 'run', pirates: 'run', water: 4, barley: 5 },
  elpis: like5('smart', { fromElpis: true }),
});
function buyRoom(s, list) {   // buy only what the hold has room for
  for (const g of list) {
    if (!E.bestSpot(s, { id: -1, g, where: 'dock', x: 0, y: 0, rot: 0 })) continue;
    const m = seller(s, g, 'buy');
    if (!m || !E.buy(s, m, g).ok) continue;
    E.autoPack(s);
    if (E.dockItems(s).length) { const it = E.dockItems(s)[0]; E.sell(s, m, it.g); }
  }
}
function summer5(name, seed) {
  const st = SUMMER5[name], s = E.newGame(seed);
  playChapterOne(s); E.nextChapter(s);
  summerOn(s, SUMMER.smart, [], 'smart'); E.nextChapter(s);
  autumnOn(s, Object.assign({}, AUTUMN.smart, { noShip: !!st.fromElpis }), 'smart'); E.nextChapter(s);
  springOn(s, st.fromElpis ? SPRING.elpis : SPRING.smart, 'smart'); E.nextChapter(s);
  return summer5On(s, st, name);
}
function summer5On(s, st, name) {
  const notes = [], start = s.silver, startDebt = s.loan.due, came = s.hull;
  E.begin(s);
  if (E.tooSmall(s) !== (came === 'small') || (came === 'small' && E.setSail(s).ok)) throw new Error(name + ': Elpis should be stopped at Rhodes, and only Elpis');   // a coast boat is turned back
  if (s.hull === 'small') E.buyShip(s);
  const hull = s.hull;
  if (st.loan === true || (typeof st.loan === 'number' && s.silver < st.loan)) E.takeLoan(s);
  for (const f of st.fit) { E.buy(s, 'arsenal', f); E.autoPack(s); }
  hireHere(s, st.hires.rhodes);
  for (const id of ['thras', 'stores', 'alexandrian', 'perfumer']) E.haggle(s, id);
  provisionTo(s, st.water, st.barley);
  freightHere(s, st);
  buyRoom(s, st.out);
  const outCargo = s.items.filter(i => E.isCargo(i) || i.g === 'freight').length;
  E.setSail(s); voyage(s, st, notes);
  if (s.port !== 'croton') throw new Error(name + ' did not reach Croton: ' + s.phase + ' ' + s.port + ' ' + s.pending);
  sellSome(s, st.sellCro);
  hireHere(s, st.hires.croton);
  provisionTo(s, st.water, st.barley);
  buyRoom(s, st.croOut);
  E.setSail(s); voyage(s, st, notes);
  if (s.port !== 'taras') throw new Error(name + ' did not reach Taras: ' + s.phase + ' ' + s.port);
  sellAll(s);
  hireHere(s, st.hires.taras);
  provisionTo(s, st.water, st.barley);
  for (const id of ['philokles', 'aristeas', 'lysandros', 'rich']) if (!s.visit.tries[id]) E.haggle(s, id);
  freightHere(s, st);
  buyRoom(s, st.taras);
  E.setSail(s); voyage(s, st, notes);
  if (s.port !== 'croton') throw new Error(name + ' did not get back to Croton: ' + s.phase + ' ' + s.port);
  sellAll(s);
  provisionTo(s, st.water, st.barley);
  if (!s.visit.tries.daos) E.haggle(s, 'daos');
  buyRoom(s, st.croHome);
  const homeCargo = s.items.filter(i => E.isCargo(i) || i.g === 'freight').length;
  E.setSail(s); voyage(s, st, notes);
  if (s.port === 'corinth') { sellSome(s, { timber: 0 }); provisionTo(s, st.water, st.barley); if (!s.visit.tries.smith) E.haggle(s, 'smith'); buyRoom(s, st.corHome); E.setSail(s); voyage(s, st, notes); }
  if (s.port !== 'rhodes' || !s.home) throw new Error(name + ' did not get home from Italy: ' + s.phase + ' ' + s.port);
  sellAll(s);
  E.repay(s);
  E.OUT.length = 0;
  if (!Number.isFinite(s.silver) || s.silver < 0) throw new Error('bad silver ' + s.silver);
  return { sum: s.summary, start, startDebt, came, hull, outCargo, homeCargo, notes, hungry: s.stats.hungry, thirsty: s.stats.thirsty, nights: s.stats.nights, end: s.silver, debt: s.debt,
    sick: notes.filter(x => x === 'sunstroke').length, horse: s.summary.cargo };
}

const pct = (n, d) => Math.round(100 * n / d) + '%';
let failed = false;
for (const name of ONLY.includes(1) ? Object.keys(STRATEGIES) : []) {
  const rs = [];
  for (let k = 0; k < GAMES; k++) rs.push(play(name, 1000 + k * 7919));
  const profits = rs.map(r => r.sum.profit).sort((a, b) => a - b);
  const mean = Math.round(profits.reduce((a, b) => a + b, 0) / rs.length);
  const pir = {};
  for (const r of rs) pir[r.sum.pirates] = (pir[r.sum.pirates] || 0) + 1;
  const lost = rs.reduce((a, r) => a + r.sum.lost.length, 0), broken = rs.reduce((a, r) => a + r.sum.broken, 0);
  const debt = rs.filter(r => r.sum.debt > 0).length;
  console.log(`${name.padEnd(9)} profit mean ${String(mean).padStart(4)}  min ${String(profits[0]).padStart(4)}  median ${String(profits[rs.length >> 1]).padStart(4)}  max ${String(profits[rs.length - 1]).padStart(4)}` +
    `  | cargo out/home ${rs[0].outCargo}/${rs[0].homeCargo}  days ${rs[0].sum.days}  nights at sea ${(rs.reduce((a, r) => a + r.nights, 0) / rs.length).toFixed(2)}` +
    `  hungry ${(rs.reduce((a, r) => a + r.hungry, 0) / rs.length).toFixed(2)}d thirsty ${(rs.reduce((a, r) => a + r.thirsty, 0) / rs.length).toFixed(2)}d`);
  console.log(`          pirates ${Object.keys(pir).map(k => k + ' ' + pct(pir[k], rs.length)).join(', ')}  | crew lost ${(lost / rs.length).toFixed(2)}/game  broken ${(broken / rs.length).toFixed(2)}/game  in debt ${pct(debt, rs.length)}`);
  console.log(`          ratings ${[...new Set(rs.map(r => r.sum.rating))].map(t => t + ' ' + pct(rs.filter(r => r.sum.rating === t).length, rs.length)).join(', ')}`);
  if (name === 'careful' && mean <= 40) { console.log('FAIL: careful play should clear a decent profit'); failed = true; }
}
console.log('-- Chapter II, after a careful Chapter I --');
for (const name of ONLY.includes(2) ? Object.keys(SUMMER) : []) {
  const rs = [];
  for (let k = 0; k < GAMES; k++) rs.push(summer(name, 5000 + k * 7919));
  const profits = rs.map(r => r.sum.profit).sort((a, b) => a - b), mean = Math.round(profits.reduce((a, b) => a + b, 0) / rs.length);
  const count = (key, fn) => { const o = {}; for (const r of rs) { const v = fn(r); o[v] = (o[v] || 0) + 1; } return Object.keys(o).map(k => k + ' ' + pct(o[k], rs.length)).join(', '); };
  console.log(`${name.padEnd(9)} profit mean ${String(mean).padStart(4)}  min ${String(profits[0]).padStart(4)}  median ${String(profits[rs.length >> 1]).padStart(4)}  max ${String(profits[rs.length - 1]).padStart(4)}` +
    `  | started with ${Math.round(rs.reduce((a, r) => a + r.start, 0) / rs.length)} dr  days ${(rs.reduce((a, r) => a + r.sum.days, 0) / rs.length).toFixed(1)}  nights at sea ${(rs.reduce((a, r) => a + r.nights, 0) / rs.length).toFixed(2)}` +
    `  hungry ${(rs.reduce((a, r) => a + r.hungry, 0) / rs.length).toFixed(2)}d thirsty ${(rs.reduce((a, r) => a + r.thirsty, 0) / rs.length).toFixed(2)}d`);
  console.log(`          pirates ${count('p', r => r.sum.pirates)}  | toll ${count('t', r => typeof r.sum.toll === 'number' ? 'paid' : r.sum.toll || 'none')}  | lost ${(rs.reduce((a, r) => a + r.sum.lost.length, 0) / rs.length).toFixed(2)}/game  broken ${(rs.reduce((a, r) => a + r.sum.broken, 0) / rs.length).toFixed(2)}/game  in debt ${pct(rs.filter(r => r.sum.debt > 0).length, rs.length)}`);
  console.log(`          ratings ${count('r', r => r.sum.rating)}`);
  if (name === 'smart' && mean <= 120) { console.log('FAIL: a summer played well should clear a good profit'); failed = true; }
}
console.log('-- Chapter III, after a careful Chapter I and a smart Chapter II --');
for (const name of ONLY.includes(3) ? Object.keys(AUTUMN) : []) {
  const rs = [];
  for (let k = 0; k < GAMES; k++) rs.push(autumn(name, 9000 + k * 7919));
  const profits = rs.map(r => r.sum.profit).sort((a, b) => a - b), mean = Math.round(profits.reduce((a, b) => a + b, 0) / rs.length);
  const count = fn => { const o = {}; for (const r of rs) { const v = fn(r); o[v] = (o[v] || 0) + 1; } return Object.keys(o).map(k => k + ' ' + pct(o[k], rs.length)).join(', '); };
  const avg = fn => (rs.reduce((a, r) => a + fn(r), 0) / rs.length);
  console.log(`${name.padEnd(9)} profit mean ${String(mean).padStart(4)}  min ${String(profits[0]).padStart(4)}  median ${String(profits[rs.length >> 1]).padStart(4)}  max ${String(profits[rs.length - 1]).padStart(4)}` +
    `  | started with ${Math.round(avg(r => r.start))} dr (owing ${Math.round(avg(r => r.startDebt))})  ended with ${Math.round(avg(r => r.end))}  cargo out/home ${avg(r => r.outCargo).toFixed(1)}/${avg(r => r.homeCargo).toFixed(1)}  days ${avg(r => r.sum.days).toFixed(1)}  nights at sea ${avg(r => r.nights).toFixed(2)}  hungry ${avg(r => r.hungry).toFixed(2)}d thirsty ${avg(r => r.thirsty).toFixed(2)}d`);
  console.log(`          ship ${count(r => r.ship)}  | storm ${count(r => r.sum.storm || 'none')}  | pirates ${count(r => r.sum.pirates)}  | freight delivered ${avg(r => r.sum.delivered).toFixed(2)}  lost ${avg(r => r.sum.lost.length).toFixed(2)}/game  broken ${avg(r => r.sum.broken).toFixed(2)}/game  in debt ${pct(rs.filter(r => r.sum.debt > 0).length, rs.length)}`);
  console.log(`          ratings ${count(r => r.sum.rating)}`);
  if (name === 'smart' && mean <= 150) { console.log('FAIL: an autumn played well should clear a good profit'); failed = true; }
}
console.log('-- Chapter IV, after careful, smart and smart: the new ship --');
for (const name of ONLY.includes(4) ? Object.keys(SPRING) : []) {
  const rs = [];
  for (let k = 0; k < GAMES; k++) rs.push(spring4(name, 13000 + k * 7919));
  const profits = rs.map(r => r.sum.profit).sort((a, b) => a - b), mean = Math.round(profits.reduce((a, b) => a + b, 0) / rs.length);
  const count = fn => { const o = {}; for (const r of rs) { const v = fn(r); o[v] = (o[v] || 0) + 1; } return Object.keys(o).map(k => k + ' ' + pct(o[k], rs.length)).join(', '); };
  const avg = fn => (rs.reduce((a, r) => a + fn(r), 0) / rs.length);
  console.log(`${name.padEnd(9)} profit mean ${String(mean).padStart(4)}  min ${String(profits[0]).padStart(4)}  median ${String(profits[rs.length >> 1]).padStart(4)}  max ${String(profits[rs.length - 1]).padStart(4)}` +
    `  | started with ${Math.round(avg(r => r.start))} dr (owing ${Math.round(avg(r => r.startDebt))})  ended with ${Math.round(avg(r => r.end))} (owing ${Math.round(avg(r => r.debt))})  cargo out/home ${avg(r => r.outCargo).toFixed(1)}/${avg(r => r.homeCargo).toFixed(1)}  days ${avg(r => r.sum.days).toFixed(1)}  nights at sea ${avg(r => r.nights).toFixed(2)}  hungry ${avg(r => r.hungry).toFixed(2)}d thirsty ${avg(r => r.thirsty).toFixed(2)}d`);
  console.log(`          ship ${count(r => r.hull)}  | home by ${count(r => r.sum.homeBy || '?')}  | gale ${count(r => r.sum.storm || 'none')}  | pirates ${count(r => r.sum.pirates)}  | rescue ${count(r => r.sum.rescue || 'none')}  | crates ${avg(r => r.sum.delivered).toFixed(2)}  lost ${avg(r => r.sum.lost.length).toFixed(2)}/game  broken ${avg(r => r.sum.broken).toFixed(2)}/game  in debt ${pct(rs.filter(r => r.sum.debt > 0).length, rs.length)}`);
  console.log(`          ratings ${count(r => r.sum.rating)}`);
  if (name === 'smart' && mean <= 200) { console.log('FAIL: a spring played well in the new ship should clear a good profit'); failed = true; }
}
console.log('-- Chapter V, after careful, smart, smart and smart: across the open sea --');
for (const name of ONLY.includes(5) ? Object.keys(SUMMER5) : []) {
  const rs = [];
  for (let k = 0; k < GAMES; k++) rs.push(summer5(name, 17000 + k * 7919));
  const profits = rs.map(r => r.sum.profit).sort((a, b) => a - b), mean = Math.round(profits.reduce((a, b) => a + b, 0) / rs.length);
  const count = fn => { const o = {}; for (const r of rs) { const v = fn(r); o[v] = (o[v] || 0) + 1; } return Object.keys(o).map(k => k + ' ' + pct(o[k], rs.length)).join(', '); };
  const avg = fn => (rs.reduce((a, r) => a + fn(r), 0) / rs.length);
  console.log(`${name.padEnd(9)} profit mean ${String(mean).padStart(4)}  min ${String(profits[0]).padStart(4)}  median ${String(profits[rs.length >> 1]).padStart(4)}  max ${String(profits[rs.length - 1]).padStart(4)}` +
    `  | started with ${Math.round(avg(r => r.start))} dr (owing ${Math.round(avg(r => r.startDebt))})  ended with ${Math.round(avg(r => r.end))} (owing ${Math.round(avg(r => r.debt))})  cargo out/home ${avg(r => r.outCargo).toFixed(1)}/${avg(r => r.homeCargo).toFixed(1)}  days ${avg(r => r.sum.days).toFixed(1)}  nights at sea ${avg(r => r.nights).toFixed(2)}  hungry ${avg(r => r.hungry).toFixed(2)}d thirsty ${avg(r => r.thirsty).toFixed(2)}d`);
  console.log(`          came in ${count(r => r.came)}  | animals died ${avg(r => r.sum.died.length).toFixed(2)}/game  | calm ${count(r => r.sum.calm || 'none')}  | home by ${count(r => r.sum.homeBy || '?')}  | gale ${count(r => r.sum.storm || 'none')}  | pirates ${count(r => r.sum.pirates)}  | crates ${avg(r => r.sum.delivered).toFixed(2)}  lost ${avg(r => r.sum.lost.length).toFixed(2)}/game  broken ${avg(r => r.sum.broken).toFixed(2)}/game  in debt ${pct(rs.filter(r => r.sum.debt > 0).length, rs.length)}`);
  console.log(`          ratings ${count(r => r.sum.rating)}`);
  if (name === 'smart' && mean <= 250) { console.log('FAIL: a summer in Italy played well should clear a good profit'); failed = true; }
}
// A save from before Chapter III existed (no crates, no ship order) must still go on to Chapter III.
{
  const s = E.newGame(4242);
  playChapterOne(s); E.nextChapter(s); summerOn(s, SUMMER.smart, [], 'smart');
  delete s.contracts; delete s.shipOrdered;
  for (const k in s.seen) if (k.startsWith('hired_')) s.seen[k] = true;
  const t = E.migrate(JSON.parse(JSON.stringify(s)));
  const ok = t && E.nextChapter(t).ok && t.ch === 3 && Array.isArray(t.contracts) && t.shipOrdered === false;
  E.OUT.length = 0;
  console.log(ok ? 'An old Chapter II save goes on to Chapter III: ok' : 'FAIL: an old Chapter II save should go on to Chapter III');
  if (!ok) failed = true;
}
// A game that ordered the ship at the end of Chapter III, saved and reloaded, starts Chapter IV in Tyche with a full crew.
{
  let s = null;
  for (const seed of [9000, 777, 13000]) { s = E.newGame(seed); playChapterOne(s); E.nextChapter(s); summerOn(s, SUMMER.smart, [], 'smart'); E.nextChapter(s); autumnOn(s, AUTUMN.smart, 'smart'); if (s.shipOrdered) break; }
  const t = E.migrate(JSON.parse(JSON.stringify(s)));
  const ordered = t.shipOrdered, ok = t && E.nextChapter(t).ok && t.ch === 4 && (!ordered || (t.hull === 'medium' && t.crew.length >= 8 && t.items.every(i => i.where === 'hold' || i.where === 'dock')));
  E.OUT.length = 0;
  console.log(ok ? 'A finished Chapter III goes on to Chapter IV' + (ordered ? ' in Tyche, with ' + t.crew.length + ' hands' : ' in Elpis') + ': ok' : 'FAIL: a finished Chapter III should go on to Chapter IV');
  if (!ok) failed = true;
}
// A Chapter IV save from before the quay moved under the ship, with cargo standing where the old quay was, still loads with everything in reach.
{
  const s = E.newGame(31337);
  s.ch = 4; s.phase = 'title'; E.changeHull(s, 'medium'); s.phase = 'port'; s.port = 'corcyra';
  for (const [g, x, y, rot] of [['amber', 6, 1, 0], ['cheese', 3, 0, 0], ['timber', 0, 1, 0], ['hound', 5, 0, 0]]) s.items.push({ id: s.nextId++, g, where: 'dock', x, y, rot });   // where the quay was, when it ran under the ship
  const t = E.migrate(JSON.parse(JSON.stringify(s)));
  const dock = E.dockItems(t), placed = t.items.filter(i => ['amber', 'cheese', 'timber', 'hound'].includes(i.g));
  const D = E.dockOf(t), inReach = placed.length === 4 && placed.every(i => i.where === 'hold' || i.where === 'dock') && dock.every(i => i.x >= 0 && i.y >= 0 && i.x + (i.rot ? E.GOODS[i.g].h : E.GOODS[i.g].w) <= D.cols && i.y + (i.rot ? E.GOODS[i.g].w : E.GOODS[i.g].h) <= D.rows);
  E.OUT.length = 0;
  console.log(inReach ? 'An old Chapter IV save with cargo on the quay loads with everything in reach: ok' : 'FAIL: cargo on the old quay should be moved somewhere reachable');
  if (!inReach) failed = true;
}
// A save with the first, seven-wide Tyche: loads in the new shape if all her cargo fits, otherwise keeps the old shape until next season, and loses nothing.
for (const fill of [20, 50]) {
  const s = E.newGame(4040 + fill);
  s.ch = 4; s.phase = 'title'; s.hull = 'tyche7'; E.changeHull(s, 'tyche7'); s.phase = 'port'; s.port = 'corcyra';
  const goods = ['cheese', 'amber', 'hound', 'bronze', 'papyrus', 'incense', 'wheat', 'timber'];
  for (let k = 0; E.holdCells(s) - s.items.filter(i => i.where === 'hold').reduce((a, i) => a + E.GOODS[i.g].w * E.GOODS[i.g].h, 0) > 57 - fill && k < 200; k++) {
    const it = { id: s.nextId++, g: goods[k % goods.length], where: 'dock', x: 0, y: 0, rot: 0 }; s.items.push(it);
    let placed = false;
    for (let y = 0; y < 10 && !placed; y++) for (let x = 0; x < 7 && !placed; x++) for (const rot of [0, 1]) if (!placed && (it.where = 'hold', it.x = x, it.y = y, it.rot = rot, true) && E.holdInShape(s)) placed = true;
    if (!placed) s.items.pop();
  }
  s.hull = 'medium';   // what an old save says
  const before = s.items.length, t = E.migrate(JSON.parse(JSON.stringify(s)));
  const ok = t.items.length === before && E.holdInShape(t) && (t.hull === 'medium' || t.hull === 'tyche7');
  E.OUT.length = 0;
  console.log(ok ? 'An old wide-Tyche save with ' + s.items.filter(i => i.where === 'hold').length + ' things aboard loads as ' + (t.hull === 'medium' ? 'the new Tyche' : 'the old shape, for now') + ', with nothing lost: ok' : 'FAIL: an old wide-Tyche save should load without losing cargo');
  if (!ok) failed = true;
}
if (failed) process.exit(1);
