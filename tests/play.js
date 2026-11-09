// Plays all nine chapters in a phone-sized browser through the real buttons, fast-forwarded,
// and saves screenshots of the key moments. Needs Playwright.
// Usage: node tests/play.js [path/to/index.html] [screenshot folder]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const file = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const out = path.resolve(process.argv[3] || path.join(__dirname, 'shots'));
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1, hasTouch: false });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shots = [];
  const snap = async name => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, name + '.png') }); shots.push(name); };
  const st = () => page.evaluate(() => { const s = window.__emp.state(); return { phase: s.phase, port: s.port, home: s.home, pending: s.pending, stop: s.camp && s.camp.stop, silver: s.silver, day: s.dayN, dock: window.__emp.fns.dockItems(s).length }; });
  const open = async sel => { await page.click(sel); await page.waitForSelector('#sheet:not([hidden])'); };
  const close = async () => { await page.click('#sheetCard button[data-act="close"]'); await page.waitForSelector('#sheet', { state: 'hidden' }); };
  const buyN = async (m, g, n) => { await open(`.person[data-m="${m}"]`); for (let i = 0; i < n; i++) { const b = await page.$(`#sheetCard button[data-act="buy"][data-g="${g}"]:not([disabled])`); if (!b) break; await b.click(); } await close(); };
  const hireIf = async (h, shot) => { await open(`.person[data-hire="${h}"]`); if (shot) await snap(shot); const b = await page.$('#sheetCard button[data-act="hire"]:not([disabled])'); if (b) await b.click(); await close(); };
  const tab = async t => { await page.click(`#tab-${t}`); await page.waitForTimeout(150); };
  // Drag the first thing on the quay into the first empty hold square that takes it, with the mouse, the way a finger would.
  const dragToHold = async () => {
    const plan = await page.evaluate(() => {
      const S = window.__emp.state(), f = window.__emp.fns, L = window.__emp.hold.lay, it = f.dockItems(S)[0];
      if (!it) return null;
      for (let y = 0; y < L.H.rows; y++) for (let x = 0; x < L.H.cols; x++) if (f.fits(S, it, 'hold', x, y, it.rot)) return { id: it.id, from: [L.dx + it.x * 12 + 6, L.dy + it.y * 12 + 6], to: [L.hx + x * 12 + 6, L.hy + y * 12 + 6], at: [x, y] };
      return null;
    });
    if (!plan) throw new Error('nothing to drag, or nowhere to put it');
    const screen = async ([ax, ay]) => page.evaluate(([ax, ay]) => { const L = window.__emp.hold.lay, r = document.querySelector('#holdCanvas').getBoundingClientRect(); return [r.left + ax / L.wAp * r.width, r.top + ay / L.hAp * r.height]; }, [ax, ay]);
    await page.evaluate(() => { document.querySelector('#holdCanvas').scrollIntoView({ block: 'end' }); });
    let [fx, fy] = await screen(plan.from);
    await page.mouse.move(fx, fy); await page.mouse.down(); await page.mouse.move(fx, fy - 20, { steps: 3 });
    for (let k = 0; k < 60; k++) {   // carry it towards its square; near the edge the panel scrolls by itself
      const [tx, ty] = await screen(plan.to);
      const top = await page.evaluate(() => document.querySelector('#panel').getBoundingClientRect().top);
      if (ty > top + 70) { await page.mouse.move(tx, ty, { steps: 5 }); break; }
      await page.mouse.move(tx, top + 25, { steps: 2 }); await page.waitForTimeout(60);
    }
    await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(150);
    const where = await page.evaluate(id => { const it = window.__emp.state().items.find(i => i.id === id); return it.where + ':' + it.x + ',' + it.y; }, plan.id);
    if (where !== 'hold:' + plan.at.join(',')) throw new Error('drag did not land: ' + where + ' wanted ' + plan.at);
    return where;
  };

  await page.goto(file);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(600);
  await snap('01-title');
  await page.click('button[data-t="begin"]');
  for (let i = 0; i < 7; i++) { if (i === 3) await snap('02-intro'); await page.click('button[data-t="next"]'); }
  await page.click('button[data-t="harbour"]');
  await page.waitForTimeout(700);
  await snap('03-rhodes-quay');

  // Rhodes: provisions, the bolt-thrower, a slinger, and a mixed cargo
  await buyN('stores', 'water', 2); await buyN('stores', 'barley', 1);
  await buyN('arsenal', 'bolt', 1);
  await open('.person[data-m="thras"]'); await page.click('#sheetCard button[data-act="haggle"]'); await snap('04-merchant');
  for (let i = 0; i < 4; i++) await page.click('#sheetCard button[data-act="buy"][data-g="wine"]');
  await close();
  await buyN('korinna', 'sponge', 3); await buyN('korinna', 'figs', 3); await buyN('aristeia', 'cups', 3);
  await hireIf('philon');
  await tab('hold');
  await snap('05-hold-quay');
  console.log('drag in Elpis:', await dragToHold());
  { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); }
  await snap('06-hold-packed');
  await tab('main');
  await open('button[data-act="sail"]');
  await snap('07-sail-check');
  await page.click('#sheetCard button[data-act="sail-yes"]');
  await page.evaluate(() => window.__emp.speed(12));

  const seen = new Set();
  // In every port, go and see the sight worth seeing, take the first choice that can be afforded, and read what happens.
  async function sightsee() {
    await page.waitForTimeout(400);
    const port = await page.evaluate(() => window.__emp.state().port), card = await page.$(`#panel button[data-sight="${port}"]`);
    if (!card || await page.evaluate(p => !!window.__emp.state().sights[p], port)) return;
    await card.click(); await page.waitForSelector('#sheet:not([hidden])');
    await snap('sight-' + port);
    const c = await page.$('#sheetCard button[data-act="sight"]:not([disabled])');
    if (!c) throw new Error('nothing to choose at the sight in ' + port);
    await c.click(); await page.waitForTimeout(200);
    if (!await page.evaluate(p => !!window.__emp.state().sights[p], port)) throw new Error('the sight in ' + port + ' was not seen');
    await snap('sight-' + port + '-done');
    await close();
  }
  async function voyage(label) {
    for (let guard = 0; guard < 3000; guard++) {
      const s = await st();
      if (s.phase === 'port') { await sightsee(); return await st(); }
      const sheet = await page.evaluate(() => { const ui = window.__emp.ui; return ui.sheet && ui.sheet.kind === 'event' ? (ui.outcome ? 'outcome' : window.__emp.state().pending) : null; });
      if (sheet === 'outcome') { if (!seen.has(label + 'out')) { seen.add(label + 'out'); await snap(label + '-outcome'); } await page.click('#sheetCard button[data-act="continue"]'); continue; }
      if (sheet) {
        const risk = await page.evaluate(() => window.__emp.fns.atRisk(window.__emp.state()).length);
        const talk = sheet === 'pirates' && await page.$('#sheetCard button[data-c="talk"]');
        const pick = sheet === 'squall' ? (risk ? 'shelter' : 'ride') : sheet === 'flotsam' ? 'haul' : sheet === 'warship' ? 'argue' : sheet === 'storm3' || sheet === 'malea' || sheet === 'storm6' || sheet === 'storm7' || sheet === 'storm9' || sheet === 'storm9h' ? 'hold' : sheet === 'survivors' ? 'take'
          : sheet === 'becalmed' ? 'row' : sheet === 'campanians' ? 'stand' : sheet === 'blockade' ? (await page.$('#sheetCard button[data-c="search"]') ? 'search' : 'pay')
          : sheet === 'landfall' ? (await page.$('#sheetCard button[data-c="pilot"]') ? 'pilot' : 'tower') : sheet === 'aground' ? 'tow' : talk ? 'talk' : 'fight';
        await snap(label + '-event-' + sheet);
        await page.click(`#sheetCard button[data-c="${pick}"]`);
        continue;
      }
      if (s.phase === 'camp') {
        if (!seen.has(label + s.stop)) { seen.add(label + s.stop); await page.waitForTimeout(400); await snap(label + '-camp-' + s.stop); }
        for (const id of ['spring', 'fish', 'sponge', 'oracle', 'cave', 'pitch']) {
          const sel = `#panel button[data-act="camp"][data-id="${id}"]:not([disabled])`;
          if (await page.$(sel)) { await page.click(sel, { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(200); }
        }
        if (s.dock) { await tab('hold'); await page.click('button[data-act="autopack"]'); await tab('main'); }
        const route = await page.$('#panel button[data-act="sleep"][data-route="coast"]');
        if (route) { await snap(label + '-route'); await route.click(); } else await page.click('#panel button[data-act="sleep"]');
        await page.waitForTimeout(150);
        continue;
      }
      if (s.phase === 'sea') {   // read and act in one step: at this speed the ship can reach port in between
        const r = await page.evaluate(() => { const S = window.__emp.state(); return S.phase === 'sea' && S.voyage ? { late: window.__emp.fns.eta(S, false) > 0.97, rowing: S.voyage.row, clock: S.voyage.clock } : null; });
        if (r && r.late !== r.rowing) await page.click(`#panel button[data-act="row"][data-v="${r.late ? 1 : 0}"]`, { timeout: 1500 }).catch(() => {});
        if (r && r.clock > 0.3 && !seen.has(label + 'sea' + s.day)) { seen.add(label + 'sea' + s.day); await snap(label + '-sea-day' + s.day); }
      }
      await page.waitForTimeout(80);
    }
    throw new Error('voyage did not finish: ' + JSON.stringify(await st()));
  }
  let s = await voyage('out');
  if (s.port !== 'halic') throw new Error('expected Halicarnassus, got ' + JSON.stringify(s));
  await page.waitForTimeout(600);
  await snap('20-halic-quay');

  // Halicarnassus: sell everything to whoever buys it, then load for home
  for (const m of ['dion', 'mania', 'theodote', 'hermon']) {
    await open(`.person[data-m="${m}"]`);
    const h = await page.$('#sheetCard button[data-act="haggle"]:not([disabled])'); if (h) await h.click();
    for (let k = 0; k < 20; k++) { const b = await page.$('#sheetCard .trade button[data-act="sell"]:not([disabled])'); if (!b) break; await b.click(); }
    await close();
  }
  await hireIf('lykos');
  await hireIf('kydas');
  await buyN('uliades', 'marble', 2); await buyN('hermon', 'scent', 3); await buyN('theodote', 'cloth', 1); await buyN('mania', 'honey', 2);
  await open('.person[data-m="hstores"]'); const fill = await page.$('#sheetCard button[data-act="refill"]:not([disabled])'); if (fill) await fill.click(); await page.click('#sheetCard button[data-act="buy"][data-g="barley"]'); await close();
  await tab('hold'); await page.click('button[data-act="autopack"]'); await snap('21-hold-home');
  await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('home');
  if (s.port !== 'rhodes' || !s.home) throw new Error('expected to be home, got ' + JSON.stringify(s));
  await page.waitForTimeout(600);
  await snap('30-home-quay');
  for (const m of ['works', 'korinna', 'thras']) {
    await open(`.person[data-m="${m}"]`);
    for (;;) { const b = await page.$('#sheetCard .trade button[data-act="sell"]:not([disabled])'); if (!b) break; await b.click(); }
    await close();
  }
  await open('.person[data-m="bank"]'); await snap('31-bank');
  await page.click('#sheetCard button[data-act="repay"]');
  await page.waitForSelector('#theater:not([hidden]) button[data-t="nextch"]');
  await page.waitForTimeout(500);
  await snap('32-summary');
  const sum = await page.evaluate(() => window.__emp.state().summary);
  console.log('chapter I:', JSON.stringify(sum));

  // ---- Chapter II: north to Miletus, against the summer wind ----
  await page.click('button[data-t="nextch"]');
  await page.waitForTimeout(300);
  await snap('40-ch2-intro');
  for (let i = 0; i < 12; i++) { const b = await page.$('button[data-t="next"]'); if (!b) break; await b.click(); }
  await page.click('button[data-t="harbour"]');
  await page.waitForTimeout(700);
  await snap('41-ch2-rhodes');
  await open('.person[data-m="bank"]'); await snap('42-ch2-loan'); await page.click('#sheetCard button[data-act="loan"]'); await close();
  await open('.person[data-m="arsenal"]'); await page.click('#sheetCard button[data-act="buy"][data-g="bench"]'); await page.click('#sheetCard button[data-act="buy"][data-g="awning"]'); await snap('43-ch2-arsenal'); await close();
  await hireIf('philon');
  await buyN('stores', 'water', 1); await buyN('stores', 'barley', 1);
  await buyN('thras', 'wine', 3); await buyN('aristeia', 'cups', 2); await buyN('korinna', 'sponge', 1);
  await tab('hold'); await page.click('button[data-act="autopack"]'); await snap('44-ch2-hold'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('n1');
  if (s.port !== 'kos') throw new Error('expected Kos, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('50-kos');
  await hireIf('pythes');
  await buyN('asklep', 'salve', 2);
  await tab('hold'); await page.click('button[data-act="autopack"]'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('n2');
  if (s.port !== 'miletus') throw new Error('expected Miletus, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('60-miletus');
  await open('.person[data-m="thinker"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('61-philosopher'); await close();
  for (const m of ['kallisto', 'glykera']) {
    await open(`.person[data-m="${m}"]`);
    for (let k = 0; k < 20; k++) { const b = await page.$('#sheetCard .trade button[data-act="sell"]:not([disabled])'); if (!b) break; await b.click(); }
    await close();
  }
  await hireIf('seuthes');
  await buyN('leandros', 'purple', 2); await buyN('archelaos', 'couch', 1); await buyN('leandros', 'wool', 1);
  await tab('hold'); await page.click('button[data-act="autopack"]'); await snap('62-ch2-hold-home'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('n3');
  if (s.port !== 'kos') throw new Error('expected Kos on the way home, got ' + JSON.stringify(s));
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('n4');
  if (s.port !== 'rhodes' || !s.home) throw new Error('expected to be home from Miletus, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('70-ch2-home');
  for (const m of ['bank', 'korinna', 'thras', 'works']) {
    await open(`.person[data-m="${m}"]`);
    for (let k = 0; k < 20; k++) { const b = await page.$('#sheetCard .trade button[data-act="sell"]:not([disabled])'); if (!b) break; await b.click(); }
    await close();
  }
  await open('.person[data-m="bank"]'); await snap('71-ch2-bank');
  await page.click('#sheetCard button[data-act="repay"]');
  await page.waitForSelector('#theater:not([hidden]) button[data-t="nextch"]');
  await page.waitForTimeout(500);
  await snap('72-ch2-summary');
  console.log('chapter II:', JSON.stringify(await page.evaluate(() => window.__emp.state().summary)));

  // ---- Chapter III: west across the islands to Athens, in the autumn ----
  const sellHere = async m => {
    await open(`.person[data-m="${m}"]`);
    const h = await page.$('#sheetCard button[data-act="haggle"]:not([disabled])'); if (h) await h.click();
    for (let k = 0; k < 20; k++) { const b = await page.$('#sheetCard .trade button[data-act="sell"]:not([disabled])'); if (!b) break; await b.click(); }
    await close();
  };
  const sellN = async (m, g, n) => { await open(`.person[data-m="${m}"]`); for (let k = 0; k < n; k++) { const b = await page.$(`#sheetCard button[data-act="sell"][data-g="${g}"]:not([disabled])`); if (!b) break; await b.click(); } await close(); };
  const crate = async (m, f) => { await open(`.person[data-m="${m}"]`); await page.click(`#sheetCard button[data-act="freight"][data-f="${f}"]`); await close(); };
  await page.click('button[data-t="nextch"]');
  await page.waitForTimeout(300);
  await snap('80-ch3-intro');
  for (let i = 0; i < 12; i++) { const b = await page.$('button[data-t="next"]'); if (!b) break; await b.click(); }
  await page.click('button[data-t="harbour"]');
  await page.waitForTimeout(700);
  await snap('81-ch3-rhodes');
  if (await page.evaluate(() => window.__emp.state().silver) < 150) { await open('.person[data-m="bank"]'); const b = await page.$('#sheetCard button[data-act="loan"]'); if (b) await b.click(); await close(); }   // broke after a bad season: borrow
  await hireIf('euphron', '82-ch3-carpenter');
  await open('.person[data-m="agent"]'); await page.click('#sheetCard button[data-act="freight"][data-f="rd"]'); await page.click('#sheetCard button[data-act="freight"][data-f="rp"]'); await snap('83-ch3-agent'); await close();
  await buyN('stores', 'wheat', 8); await buyN('korinna', 'sponge', 2); await buyN('thras', 'wine', 2);
  await tab('hold'); await page.click('button[data-act="autopack"]'); await snap('84-ch3-hold'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('a1');
  if (s.port !== 'delos') throw new Error('expected Delos, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('90-delos');
  await sellN('telesilla', 'wine', 2); await buyN('dstores', 'barley', 2);
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('a2');
  if (s.port !== 'piraeus') throw new Error('expected Piraeus, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('91-piraeus');
  await sellHere('warden'); await sellHere('kephis');
  await open('.person[data-m="zeno"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('92-zeno'); await close();
  await open('.person[data-hire="seuthes"]'); await snap('93-seuthes-again'); await close();
  await buyN('nikanor', 'scrolls', 3); await buyN('philinna', 'vase', 3); await buyN('melitta', 'hymhoney', 2); await buyN('timarchos', 'marble', 1);
  await crate('pagent', 'pr'); await buyN('pstores', 'barley', 2);
  await tab('hold'); await page.click('button[data-act="autopack"]'); await snap('94-ch3-hold-home'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('a3');
  if (s.port !== 'delos') throw new Error('expected Delos on the way home, got ' + JSON.stringify(s));
  await hireIf('kydas');
  await buyN('dstores', 'barley', 2);
  await tab('hold'); await page.click('button[data-act="autopack"]'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('a4');
  if (s.port !== 'rhodes' || !s.home) throw new Error('expected to be home from Athens, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('100-ch3-home');
  for (const m of ['works', 'teacher', 'korinna', 'thras']) await sellHere(m);
  await tab('ledger'); await snap('101-ch3-ledger'); await tab('main');
  await open('.person[data-m="bank"]'); await page.click('#sheetCard button[data-act="repay"]');
  await page.waitForSelector('#theater:not([hidden]) button[data-t="nextch"]');
  await page.waitForTimeout(500);
  await snap('102-ch3-summary');
  const shipBtn = await page.$('button[data-t="ship"]');
  if (shipBtn) { await shipBtn.click(); await page.waitForTimeout(400); await snap('103-ch3-ship'); }
  console.log('chapter III:', JSON.stringify(await page.evaluate(() => window.__emp.state().summary)), 'ship ordered:', await page.evaluate(() => window.__emp.state().shipOrdered));

  // ---- Chapter IV: the new ship, west to Corinth and Corcyra ----
  await page.click('button[data-t="nextch"]');
  await page.waitForTimeout(300);
  await snap('110-ch4-intro');
  for (let i = 0; i < 14; i++) { const b = await page.$('button[data-t="next"]'); if (!b) break; await b.click(); }
  await page.click('button[data-t="harbour"]');
  await page.waitForTimeout(700);
  await snap('111-ch4-rhodes');
  if (await page.evaluate(() => window.__emp.state().hull) === 'small') {   // not ordered last autumn: buy her now, if there is silver for it
    await open('.person[data-m="shipwright"]'); await snap('112-ch4-shipwright');
    const buy = await page.$('#sheetCard button[data-act="buyship"]:not([disabled])'); if (buy) await buy.click();
    await close();
  }
  await open('.person[data-m="bank"]'); { const b = await page.$('#sheetCard button[data-act="loan"]'); if (b) await b.click(); } await close();
  for (const h of ['euphron', 'lykos']) { await open(`.person[data-hire="${h}"]`); const b = await page.$('#sheetCard button[data-act="hire"]:not([disabled])'); if (b) await b.click(); await close(); }
  await open('.person[data-m="agent"]'); for (const f of ['rc', 'ry']) { const b = await page.$(`#sheetCard button[data-act="freight"][data-f="${f}"]`); if (b) await b.click(); } await close();
  await buyN('stores', 'wheat', 8); await buyN('stores', 'barley', 2); await buyN('stores', 'water', 1);
  await buyN('alexandrian', 'incense', 4); await buyN('alexandrian', 'papyrus', 4); await buyN('korinna', 'sponge', 2);
  await tab('hold'); await snap('113-ch4-hold-quay'); console.log('drag in ' + await page.evaluate(() => window.__emp.state().hull) + ':', await dragToHold());
  { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('113-ch4-hold'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('d1');
  if (s.port !== 'corinth') throw new Error('expected Corinth, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('120-corinth');
  await sellHere('sitones');
  await open('.person[data-m="oldman"]'); await page.click('#sheetCard button[data-act="talk"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('121-diogenes'); await close();
  await open('.person[data-hire="kallias"]'); await snap('122-kallias'); { const b = await page.$('#sheetCard button[data-act="hire"]:not([disabled])'); if (b) await b.click(); } await close();
  await buyN('smith', 'bronze', 2); await buyN('kostores', 'barley', 1);
  await tab('hold'); await page.click('button[data-act="autopack"]'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('d2');
  if (s.port !== 'corcyra') throw new Error('expected Corcyra, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('130-corcyra');
  for (const m of ['steward', 'eurydike']) await sellHere(m);
  await open('.person[data-hire="neoptolemos"]'); { const b = await page.$('#sheetCard button[data-act="hire"]:not([disabled])'); if (b) await b.click(); } await close();
  await buyN('bato', 'amber', 2); await buyN('admetos', 'hound', 1); await buyN('kraton', 'timber', 1); await buyN('admetos', 'cheese', 4); await buyN('cstores', 'barley', 2);
  await crate('cagent', 'yr');
  await tab('hold'); await page.click('button[data-act="autopack"]'); await snap('131-ch4-hold-home'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('d3');
  if (s.port === 'corinth') { await page.waitForTimeout(500); await snap('140-corinth-home'); await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]'); s = await voyage('d4'); }
  if (s.port !== 'rhodes' || !s.home) throw new Error('expected to be home from Corcyra, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('150-ch4-home');
  const spars = () => page.evaluate(() => window.__emp.fns.countGood(window.__emp.state(), 'timber'));
  const spars4 = await spars();
  for (const m of ['korinna', 'bank', 'shipwright', 'thras', 'works']) await sellHere(m);
  if (spars4 && await spars()) throw new Error('Nausikrates should buy the fir spars brought home from Corcyra: ' + spars4 + ' aboard, ' + await spars() + ' left');
  await tab('ledger'); await snap('151-ch4-ledger'); await tab('crew'); await snap('152-ch4-crew'); await tab('main');
  await open('.person[data-m="bank"]'); await page.click('#sheetCard button[data-act="repay"]');
  await page.waitForSelector('#theater:not([hidden]) button[data-t="nextch"]');
  await page.waitForTimeout(500);
  await snap('153-ch4-summary');
  console.log('chapter IV:', JSON.stringify(await page.evaluate(() => window.__emp.state().summary)));

  // ---- Chapter V: two days across the open sea, to Croton and Taras ----
  await page.click('button[data-t="nextch"]');
  await page.waitForTimeout(300);
  await snap('160-ch5-intro');
  for (let i = 0; i < 14; i++) { const b = await page.$('button[data-t="next"]'); if (!b) break; await b.click(); }
  await page.click('button[data-t="harbour"]');
  await page.waitForTimeout(700);
  await snap('161-ch5-rhodes');
  if (await page.evaluate(() => window.__emp.state().hull) === 'small') {   // Elpis cannot go: no sail button, only the way to the shipwright, who will sell on credit
    if (await page.$('#panel button[data-act="sail"]')) throw new Error('Elpis should not be offered the open sea');
    await open('#panel button[data-m="shipwright"]'); await snap('162-ch5-shipwright');
    await page.click('#sheetCard button[data-act="buyship"]'); await close();
    if (await page.evaluate(() => window.__emp.state().hull) !== 'medium') throw new Error('the new ship should be bought on credit in Chapter V');
  }
  await open('.person[data-m="bank"]'); { const b = await page.$('#sheetCard button[data-act="loan"]'); if (b) await b.click(); } await close();
  await hireIf('lykos'); await hireIf('euphron');
  await open('.person[data-m="arsenal"]'); for (const g of ['awning', 'pithos']) { const b = await page.$(`#sheetCard button[data-act="buy"][data-g="${g}"]:not([disabled])`); if (b) await b.click(); } await close();
  await open('.person[data-m="agent"]'); for (const f of ['rk', 'rt1', 'rt2']) { const b = await page.$(`#sheetCard button[data-act="freight"][data-f="${f}"]`); if (b) await b.click(); } await snap('163-ch5-agent'); await close();
  await buyN('stores', 'water', 2); await buyN('stores', 'barley', 3);
  await buyN('alexandrian', 'incense', 6); await buyN('perfumer', 'scent', 3); await buyN('korinna', 'sponge', 2); await buyN('alexandrian', 'papyrus', 4);
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('164-ch5-hold'); await tab('main');
  await open('button[data-act="sail"]'); await snap('165-ch5-sail-check'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('e1');
  if (s.port !== 'croton') throw new Error('expected Croton, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('170-croton');
  await sellN('kgrain', 'incense', 2); await sellN('kgrain', 'papyrus', 2);
  await open('.person[data-m="pythagorean"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('171-pythagorean'); await close();
  await hireIf('milon', '172-milon');
  await buyN('krstores', 'barley', 1);
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('e2');
  if (s.port !== 'taras') throw new Error('expected Taras, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('180-taras');
  await sellHere('rich');
  await open('.person[data-m="mechanic"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('181-archytas'); await close();
  await hireIf('archippos');
  await buyN('philokles', 'purple', 2); await buyN('lysandros', 'horse', 1); await buyN('philokles', 'tarwool', 2); await buyN('aristeas', 'krater', 2); await buyN('tstores', 'barley', 2);
  await crate('tagent', 'tr1');
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('182-ch5-hold-home'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('e3');
  if (s.port !== 'croton') throw new Error('expected Croton on the way home, got ' + JSON.stringify(s));
  await buyN('daos', 'pitch', 2); await buyN('krstores', 'water', 1);
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await tab('main');
  await open('button[data-act="sail"]'); await snap('183-ch5-sail-home'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('e4');
  if (s.port === 'corinth') { await page.waitForTimeout(500); await snap('190-ch5-corinth'); await buyN('smith', 'bronze', 2); await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await tab('main'); await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]'); s = await voyage('e5'); }
  if (s.port !== 'rhodes' || !s.home) throw new Error('expected to be home from Italy, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('200-ch5-home');
  for (const m of ['korinna', 'aristeia', 'bank', 'shipwright', 'arsenal', 'works', 'thras']) await sellHere(m);
  await tab('ledger'); await snap('201-ch5-ledger'); await tab('crew'); await snap('202-ch5-crew'); await tab('main');
  await open('.person[data-m="bank"]'); await page.click('#sheetCard button[data-act="repay"]');
  await page.waitForSelector('#theater:not([hidden]) button[data-t="nextch"]');
  await page.waitForTimeout(500);
  await snap('203-ch5-summary');
  console.log('chapter V:', JSON.stringify(await page.evaluate(() => window.__emp.state().summary)));

  // ---- Chapter VI: by way of Crete, and three days across the open sea to Syracuse, in the autumn ----
  await page.click('button[data-t="nextch"]');
  await page.waitForTimeout(300);
  await snap('210-ch6-intro');
  for (let i = 0; i < 14; i++) { const b = await page.$('button[data-t="next"]'); if (!b) break; await b.click(); }
  await page.click('button[data-t="harbour"]');
  await page.waitForTimeout(700);
  await snap('211-ch6-rhodes');
  if (await page.evaluate(() => window.__emp.state().silver) < 300) { await open('.person[data-m="bank"]'); const b = await page.$('#sheetCard button[data-act="loan"]'); if (b) await b.click(); await close(); }
  await hireIf('lykos'); await hireIf('euphron');
  await open('.person[data-m="agent"]'); for (const f of ['rky', 'rs1']) { const b = await page.$(`#sheetCard button[data-act="freight"][data-f="${f}"]`); if (b) await b.click(); } await close();
  await buyN('stores', 'water', 2); await buyN('stores', 'barley', 3);
  await buyN('alexandrian', 'incense', 6); await buyN('perfumer', 'scent', 3); await buyN('korinna', 'sponge', 2); await buyN('alexandrian', 'papyrus', 4); await buyN('thras', 'wine', 2);
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('212-ch6-hold'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('f1');
  if (s.port !== 'kydonia') throw new Error('expected Kydonia, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('220-kydonia');
  await sellN('sotades', 'wine', 2); await sellN('lasthenes', 'papyrus', 2);
  await open('.person[data-m="epimenides"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('221-epimenides'); await close();
  await hireIf('kydas', '222-kydas-home'); await hireIf('erginos');
  await buyN('akesto', 'dittany', 4); await buyN('kystores', 'water', 2); await buyN('kystores', 'barley', 2);
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await tab('main');
  await open('button[data-act="sail"]'); await snap('223-ch6-sail-check'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('f2');
  if (s.port !== 'syracuse') throw new Error('expected Syracuse, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('230-syracuse');
  for (const m of ['damarete', 'philistion']) await sellHere(m);
  await open('.person[data-m="veteran"]'); await page.click('#sheetCard button[data-act="talk"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('231-veteran'); await close();
  await open('.person[data-m="campanian"]'); await snap('232-campanians'); { const b = await page.$('#sheetCard button[data-act="fare"]:not([disabled])'); if (b) await b.click(); } await close();
  await buyN('hermokrates', 'kingbronze', 2); await buyN('megakles', 'hybla', 3); await buyN('lykon', 'tunny', 2); await buyN('systores', 'water', 3); await buyN('systores', 'barley', 3);
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('233-ch6-hold-home'); await tab('main');
  await open('button[data-act="sail"]'); await snap('234-ch6-sail-home'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('f3');
  if (s.port !== 'kydonia') throw new Error('expected Kydonia on the way home, got ' + JSON.stringify(s));
  await page.waitForTimeout(500); await snap('240-kydonia-home');
  await buyN('sotades', 'quince', 2); await buyN('kystores', 'barley', 1);
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('f4');
  if (s.port !== 'rhodes' || !s.home) throw new Error('expected to be home from Sicily, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('250-ch6-home');
  for (const m of ['works', 'thras', 'stores', 'korinna', 'perfumer']) await sellHere(m);
  await tab('ledger'); await snap('251-ch6-ledger'); await tab('crew'); await snap('252-ch6-crew'); await tab('main');
  await open('.person[data-m="bank"]'); await page.click('#sheetCard button[data-act="repay"]');
  await page.waitForSelector('#theater:not([hidden]) button[data-t="nextch"]');
  await page.waitForTimeout(500);
  await snap('253-ch6-summary');
  console.log('chapter VI:', JSON.stringify(await page.evaluate(() => window.__emp.state().summary)));

  // ---- Chapter VII: the grain ship, with a deck, along Lycia and across to Cyprus ----
  await page.click('button[data-t="nextch"]');
  await page.waitForTimeout(300);
  await snap('260-ch7-intro');
  for (let i = 0; i < 14; i++) { const b = await page.$('button[data-t="next"]'); if (!b) break; await b.click(); }
  await page.click('button[data-t="harbour"]');
  await page.waitForTimeout(700);
  await snap('261-ch7-rhodes');
  await open('.person[data-m="shipwright"]'); await snap('262-ch7-shipwright');
  { const b = await page.$('#sheetCard button[data-act="buyship"]:not([disabled])'); if (b) await b.click(); } await close();
  const hull7 = await page.evaluate(() => window.__emp.state().hull);
  console.log('ship in Chapter VII:', hull7);
  if (await page.evaluate(() => window.__emp.state().silver) < 400) { await open('.person[data-m="bank"]'); const b = await page.$('#sheetCard button[data-act="loan"]'); if (b) await b.click(); await close(); }
  await hireIf('lykos'); await hireIf('euphron');
  await open('.person[data-m="agent"]'); for (const f of ['rpa', 'rki1']) { const b = await page.$(`#sheetCard button[data-act="freight"][data-f="${f}"]`); if (b) await b.click(); } await close();
  await buyN('stores', 'water', 2); await buyN('stores', 'barley', 3);
  await buyN('alexandrian', 'incense', 6); await buyN('alexandrian', 'papyrus', 6); await buyN('thras', 'wine', 4); await buyN('korinna', 'sponge', 2); await buyN('aristeia', 'cups', 2);
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('263-ch7-hold');
  if (hull7 === 'large') {   // the second page: look at the deck, and send a crate of cups up there with a real tap
    await page.click('button[data-act="page"][data-v="deck"]'); await page.waitForTimeout(300); await snap('264-ch7-deck');
    await page.click('button[data-act="page"][data-v="hold"]'); await page.waitForTimeout(300);
    const spot = await page.evaluate(() => {
      const S = window.__emp.state(), L = window.__emp.hold.lay, it = S.items.find(i => i.where === 'hold' && i.g === 'wine') || S.items.find(i => i.where === 'hold' && i.g !== 'bolt');
      document.querySelector('#holdCanvas').scrollIntoView({ block: 'center' });
      const r = document.querySelector('#holdCanvas').getBoundingClientRect();
      return { id: it.id, x: r.left + (L.hx + it.x * 12 + 6) / L.wAp * r.width, y: r.top + (L.hy + it.y * 12 + 6) / L.hAp * r.height };
    });
    await page.mouse.click(spot.x, spot.y); await page.waitForTimeout(200);
    await page.click('#holdBtns button[data-act="flip"]'); await page.waitForTimeout(300);
    const where = await page.evaluate(id => window.__emp.state().items.find(i => i.id === id).where, spot.id);
    if (where !== 'deck') throw new Error('sending a thing up on deck did not work: ' + where);
    await snap('265-ch7-deck-flip');
    console.log('sent up on deck:', where);
  }
  await tab('main');
  await open('button[data-act="sail"]'); await snap('266-ch7-sail-check'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('g1');
  if (s.port !== 'paphos') throw new Error('expected Paphos, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('270-paphos');
  await sellHere('timo'); await sellN('stasandros', 'wine', 2);
  await open('.person[data-m="sculptor"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('271-pygmalion'); await close();
  await buyN('pfstores', 'barley', 1);
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('g2');
  if (s.port !== 'kition') throw new Error('expected Kition, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('280-kition');
  await sellHere('hanno');
  await open('.person[data-m="captain"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('281-captain'); await close();
  await hireIf('mago');
  await buyN('abdeshmun', 'glass', 3); await buyN('baalyaton', 'cedar', 2); await buyN('eshmun', 'salt', 4); await buyN('kistores', 'barley', 2);
  await crate('kiagent', 'kr1');
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('282-ch7-hold-home'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('g3');
  if (s.port !== 'paphos') throw new Error('expected Paphos on the way home, got ' + JSON.stringify(s));
  await buyN('onasilos', 'copper', 2); await buyN('kypra', 'kyprinon', 2); await buyN('pfstores', 'water', 1);
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('g4');
  if (s.port !== 'rhodes' || !s.home) throw new Error('expected to be home from Cyprus, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('290-ch7-home');
  for (const m of ['works', 'korinna', 'aristeia', 'shipwright', 'stores', 'perfumer', 'thras']) await sellHere(m);
  await tab('ledger'); await snap('291-ch7-ledger'); await tab('crew'); await snap('292-ch7-crew'); await tab('main');
  await open('.person[data-m="bank"]'); await page.click('#sheetCard button[data-act="repay"]');
  await page.waitForSelector('#theater:not([hidden]) button[data-t="nextch"]');
  await page.waitForTimeout(500);
  await snap('293-ch7-summary');
  console.log('chapter VII:', JSON.stringify(await page.evaluate(() => window.__emp.state().summary)));

  // ---- Chapter VIII: across the open sea to Sidon and Tyre, past King Ptolemy's patrol ----
  const refill = async m => { await open(`.person[data-m="${m}"]`); const b = await page.$('#sheetCard button[data-act="refill"]:not([disabled])'); if (b) await b.click(); await close(); };
  await page.click('button[data-t="nextch"]');
  await page.waitForTimeout(300);
  await snap('300-ch8-intro');
  for (let i = 0; i < 14; i++) { const b = await page.$('button[data-t="next"]'); if (!b) break; await b.click(); }
  await page.click('button[data-t="harbour"]');
  await page.waitForTimeout(700);
  await snap('301-ch8-rhodes');
  if (await page.evaluate(() => window.__emp.state().hull) !== 'large') { await open('.person[data-m="shipwright"]'); const b = await page.$('#sheetCard button[data-act="buyship"]:not([disabled])'); if (b) await b.click(); await close(); }
  console.log('ship in Chapter VIII:', await page.evaluate(() => window.__emp.state().hull));
  if (await page.evaluate(() => window.__emp.state().silver) < 400) { await open('.person[data-m="bank"]'); const b = await page.$('#sheetCard button[data-act="loan"]'); if (b) await b.click(); await close(); }
  await hireIf('lykos');
  await open('.person[data-m="agent"]'); for (const f of ['rsi1', 'rty']) { const b = await page.$(`#sheetCard button[data-act="freight"][data-f="${f}"]`); if (b) await b.click(); } await close();
  await buyN('stores', 'water', 4); await buyN('stores', 'barley', 4);
  await buyN('alexandrian', 'incense', 6); await buyN('alexandrian', 'papyrus', 4); await buyN('thras', 'wine', 2);
  await buyN('arsenal', 'pitch', 3); await buyN('stores', 'wheat', 2);   // a little of what a soldier could use, to meet the patrol with
  { const before = await spars(); await buyN('shipwright', 'timber', 1); if (await spars() !== before + 1) throw new Error('Nausikrates should sell fir spars in Chapter VIII'); }
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('302-ch8-hold');
  await tab('main');
  await open('button[data-act="sail"]'); await snap('303-ch8-sail-check');
  if (!/King Ptolemy’s patrol off Tyre/.test(await page.textContent('#sheetCard'))) throw new Error('the sail sheet should warn about the patrol off Tyre');
  await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('h1');
  if (s.port !== 'sidon') throw new Error('expected Sidon, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('310-sidon');
  await sellHere('sidonian');
  await open('.person[data-m="officer"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('311-officer'); await close();
  await refill('sistores');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('h2');
  if (s.port !== 'tyre') throw new Error('expected Tyre, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('320-tyre');
  await sellHere('quartermaster'); await sellHere('ozbaal');
  await open('.person[data-m="melqart"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('321-melqart'); await close();
  await hireIf('philippos', '322-philippos');
  await buyN('murex', 'tyrian', 2); await buyN('balsamseller', 'balsam', 2);
  await refill('tystores');
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('323-ch8-hold-tyre'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('h3');
  if (s.port !== 'sidon') throw new Error('expected Sidon on the way home, got ' + JSON.stringify(s));
  await buyN('abdalonymos', 'glass', 2); await buyN('hiram', 'cedar', 1);
  await crate('siagent', 'sir1');
  await refill('sistores');
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('330-ch8-hold-home'); await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('h4');
  if (s.port !== 'rhodes' || !s.home) throw new Error('expected to be home from Phoenicia, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('340-ch8-home');
  for (const m of ['korinna', 'aristeia', 'bank', 'perfumer', 'shipwright', 'works', 'stores', 'thras']) await sellHere(m);
  await tab('ledger'); await snap('341-ch8-ledger'); await tab('crew'); await snap('342-ch8-crew'); await tab('main');
  await open('.person[data-m="bank"]'); await page.click('#sheetCard button[data-act="repay"]');
  await page.waitForSelector('#theater:not([hidden]) button[data-t="nextch"]');
  await page.waitForTimeout(500);
  await snap('343-ch8-summary');
  console.log('chapter VIII:', JSON.stringify(await page.evaluate(() => window.__emp.state().summary)));

  // ---- Chapter IX: the last voyage, across the open sea to Alexandria in the autumn ----
  await page.click('button[data-t="nextch"]');
  await page.waitForTimeout(300);
  await snap('350-ch9-intro');
  for (let i = 0; i < 14; i++) { const b = await page.$('button[data-t="next"]'); if (!b) break; await b.click(); }
  await page.click('button[data-t="harbour"]');
  await page.waitForTimeout(700);
  await snap('351-ch9-rhodes');
  if (await page.evaluate(() => window.__emp.state().hull) !== 'large') { await open('.person[data-m="shipwright"]'); const b = await page.$('#sheetCard button[data-act="buyship"]:not([disabled])'); if (b) await b.click(); await close(); }
  console.log('ship in Chapter IX:', await page.evaluate(() => window.__emp.state().hull));
  if (await page.evaluate(() => window.__emp.state().silver) < 400) { await open('.person[data-m="bank"]'); const b = await page.$('#sheetCard button[data-act="loan"]'); if (b) await b.click(); await close(); }
  await hireIf('lykos');
  await open('.person[data-hire="petosiris"]'); await snap('352-petosiris'); await close();   // look at the Egyptian pilot, but find the way in without him
  await crate('agent', 'ral1');
  await buyN('stores', 'water', 4); await buyN('stores', 'barley', 4);
  await buyN('teacher', 'scrolls', 3); await buyN('thras', 'wine', 4); await buyN('arsenal', 'pitch', 2);
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('353-ch9-hold');
  await tab('main');
  await open('button[data-act="sail"]'); await snap('354-ch9-sail-check');
  if (!/customs men take a twentieth/.test(await page.textContent('#sheetCard'))) throw new Error('the sail sheet should mention the customs house in Alexandria');
  await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('i1');
  if (s.port !== 'alexandria') throw new Error('expected Alexandria, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('360-alexandria');
  for (const m of ['museum', 'kapelos', 'dockyard', 'palace']) await sellHere(m);
  await open('.person[data-m="architect"]'); await page.click('#sheetCard button[data-act="talk"]'); await snap('361-architect'); await close();
  await buyN('nubian', 'ivory', 1); await buyN('nubian', 'monkey', 1); await buyN('storehouse', 'linen', 2);
  await open('.person[data-m="grainoffice"]'); await snap('362-grainoffice'); for (const f of ['kg1', 'kg2']) { const b = await page.$(`#sheetCard button[data-act="freight"][data-f="${f}"]`); if (b) await b.click(); } await close();
  await refill('alstores');
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await snap('363-ch9-hold-home'); await tab('main');
  await open('button[data-act="sail"]'); await snap('364-ch9-sail-home');
  if (!/king’s grain must be in Rhodes by the end of day/.test(await page.textContent('#sheetCard'))) throw new Error('the sail sheet should give the grain its deadline');
  await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('i2');   // the fork after the first night goes by way of Cyprus, so Paphos comes next
  if (s.port !== 'paphos') throw new Error('expected Paphos on the way home from Egypt, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('370-ch9-paphos');
  await buyN('onasilos', 'copper', 1); await buyN('pfstores', 'water', 1);
  await tab('hold'); { const b = await page.$('button[data-act="autopack"]:not([disabled])'); if (b) await b.click(); } await tab('main');
  await open('button[data-act="sail"]'); await page.click('#sheetCard button[data-act="sail-yes"]');
  s = await voyage('i3');
  if (s.port !== 'rhodes' || !s.home) throw new Error('expected to be home from Egypt, got ' + JSON.stringify(s));
  await page.waitForTimeout(600); await snap('380-ch9-home');
  for (const m of ['korinna', 'aristeia', 'bank', 'works', 'stores', 'thras', 'perfumer']) await sellHere(m);
  await tab('ledger'); await snap('381-ch9-ledger'); await tab('crew'); await snap('382-ch9-crew'); await tab('main');
  await open('.person[data-m="bank"]'); await page.click('#sheetCard button[data-act="repay"]');
  await page.waitForSelector('#theater:not([hidden]) button[data-t="again"]');
  await page.waitForTimeout(500);
  await snap('383-ch9-summary');
  const hint = await page.textContent('#tHint');
  if (!/end of the voyages of Ariston/.test(hint)) throw new Error('the last page should end the voyages: ' + hint);
  const voyages = await page.$$eval('#theater .voyages dt', els => els.length);
  if (voyages < 10) throw new Error('the last page should list all nine voyages and the total: ' + voyages);
  await page.evaluate(() => document.querySelector('#theater .voyages').scrollIntoView()); await snap('384-the-end');
  console.log('chapter IX:', JSON.stringify(await page.evaluate(() => window.__emp.state().summary)));
  const sights = await page.evaluate(() => Object.keys(window.__emp.state().sights));
  console.log('sights seen:', sights.length, sights.join(', '));
  if (sights.length !== 17) throw new Error('every port has something worth seeing, and the voyages pass through all seventeen: ' + sights.length);
  if (!/young man from Cyrene/.test(await page.textContent('#theater .voyages'))) throw new Error('the last page should remember the book of wonders');
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  console.log('screenshots:', shots.join(', '));
  await browser.close();
  if (errors.length) process.exit(1);
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
