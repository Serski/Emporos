// Plays all nine chapters with the bots from tests/sim.js and saves real game states at the moments the trailer films:
// in each port before buying, selling and sailing, at each event at sea, at the start of each chapter, and at the very end.
// The trailer loads these into the page as saved games, so every shot shows a state the game can really reach.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function makeStates(outDir, seed = 4242, strategy = 'smart') {
  let sim = fs.readFileSync(path.join(ROOT, 'tests', 'sim.js'), 'utf8');
  sim = sim.replace(/const file = [^\n]+/, `const file = ${JSON.stringify(path.join(ROOT, 'src', 'game.html'))};`);
  const cut = sim.indexOf('const pct = ');   // keep the bots, drop the report that runs them
  if (cut < 0) throw new Error('tests/sim.js has changed shape: no report section to cut off');
  sim = sim.slice(0, cut);
  const snaps = {};
  const snap = (key, s) => { if (!snaps[key]) snaps[key] = JSON.parse(JSON.stringify(s)); };
  const hooks = `
const where = s => 'ch' + s.ch + '-' + s.port + (s.home ? '-home' : '');
for (const [fn, label] of [['setSail', 'leaving'], ['sell', 'selling'], ['buy', 'buying']]) { const f = E[fn]; E[fn] = (s, ...a) => { SNAP(where(s) + '-' + label, s); return f(s, ...a); }; }
{ const f = E.resolveEvent; E.resolveEvent = (s, ...a) => { SNAP('ch' + s.ch + '-event-' + s.pending + '-d' + s.dayN, s); return f(s, ...a); }; }
{ const f = E.repay; E.repay = (s, ...a) => { const r = f(s, ...a); SNAP('ch' + s.ch + '-repaid', s); return r; }; }
return { autumn9, AUTUMN9 };`;
  const fakeProcess = { argv: [], exit() {} };
  const api = new Function('require', '__dirname', 'process', 'SNAP', sim + hooks)(require, path.join(ROOT, 'tests'), fakeProcess, snap);
  if (!api.AUTUMN9[strategy]) throw new Error('no Chapter IX strategy called ' + strategy);
  api.autumn9(strategy, seed);
  fs.mkdirSync(outDir, { recursive: true });
  for (const [k, s] of Object.entries(snaps)) fs.writeFileSync(path.join(outDir, k + '.json'), JSON.stringify(s));
  return Object.keys(snaps).sort();
}

module.exports = { makeStates };
if (require.main === module) console.log(makeStates(process.argv[2] || path.join(ROOT, 'trailer-work', 'states')).join('\n'));
