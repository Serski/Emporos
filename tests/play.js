// Plays Chapters I to IV in a phone-sized browser through the real buttons, fast-forwarded,
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
  async function voyage(label) {
    for (let guard = 0; guard < 3000; guard++) {
      const s = await st();
      if (s.phase === 'port') return s;
      const sheet = await page.evaluate(() => { const ui = window.__emp.ui; return ui.sheet && ui.sheet.kind === 'event' ? (ui.outcome ? 'outcome' : window.__emp.state().pending) : null; });
      if (sheet === 'outcome') { if (!seen.has(label + 'out')) { seen.add(label + 'out'); await snap(label + '-outcome'); } await page.click('#sheetCard button[data-act="continue"]'); continue; }
      if (sheet) {
        const risk = await page.evaluate(() => window.__emp.fns.atRisk(window.__emp.state()).length);
        const pick = sheet === 'squall' ? (risk ? 'shelter' : 'ride') : sheet === 'flotsam' ? 'haul' : sheet === 'warship' ? 'argue' : sheet === 'storm3' || sheet === 'malea' ? 'hold' : sheet === 'survivors' ? 'take' : 'fight';
        await snap(label + '-event-' + sheet);
        await page.click(`#sheetCard button[data-c="${pick}"]`);
        continue;
      }
      if (s.phase === 'camp') {
        if (!seen.has(label + s.stop)) { seen.add(label + s.stop); await page.waitForTimeout(400); await snap(label + '-camp-' + s.stop); }
        for (const id of ['spring', 'fish', 'sponge', 'oracle', 'cave']) {
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
  for (const m of ['korinna', 'bank', 'shipwright', 'thras', 'works']) await sellHere(m);
  await tab('ledger'); await snap('151-ch4-ledger'); await tab('crew'); await snap('152-ch4-crew'); await tab('main');
  await open('.person[data-m="bank"]'); await page.click('#sheetCard button[data-act="repay"]');
  await page.waitForSelector('#theater:not([hidden]) button[data-t="again"]');
  await page.waitForTimeout(500);
  await snap('153-ch4-summary');
  const hint = await page.textContent('#tHint');
  if (!/Chapter V,/.test(hint)) throw new Error('summary hint should point at Chapter V: ' + hint);
  console.log('chapter IV:', JSON.stringify(await page.evaluate(() => window.__emp.state().summary)));
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  console.log('screenshots:', shots.join(', '));
  await browser.close();
  if (errors.length) process.exit(1);
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
