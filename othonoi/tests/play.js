// Plays all three chapters of Othonoi in a phone-sized browser through the real buttons, fast-forwarded,
// and saves screenshots of the key moments. The bot from tests/bot.js decides what to do, from a copy of the
// game state; this script then does it by clicking, the way a player would. Needs Playwright.
// Usage: node othonoi/tests/play.js [path/to/index.html] [screenshot folder]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const file = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const out = path.resolve(process.argv[3] || path.join(__dirname, 'shots'));
fs.mkdirSync(out, { recursive: true });

// The same rules, in Node, so the bot can think about a copy of the state.
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.html'), 'utf8');
const code = html.split('// ===== ENGINE START =====')[1].split('// ===== ENGINE END =====')[0];
const E = new Function(code + `
return { newGame, startChapter, actsHere, actView, ACT, startAct, goTo, tick, resolveEvent, EVENTS, wake, endWeek, goalsOf, summarize, tripInfo, canLift,
  PLACES, OUT, skipTour, mealNow, matTotal, soundsN, swimsN, keepsN, unlockedList, LAST_DAY };`)();
let intent = null;
const thinking = Object.assign({}, E, {
  startAct: (s, id) => { intent = { act: id }; return { ok: true }; },
  goTo: (s, to, mode) => { intent = { go: to, mode }; return { ok: true }; },
});
const { BOTS, CHOICE, decide } = require('./bot.js').makeBot(thinking);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1, hasTouch: false });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shots = new Set();
  const snap = async name => { if (shots.has(name)) return; shots.add(name); await page.waitForTimeout(280); await page.screenshot({ path: path.join(out, name + '.png') }); };
  const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__oth.state())));
  const visible = sel => page.$eval(sel, el => !!(el.offsetParent || el.getClientRects().length)).catch(() => false);
  const click = async sel => { await page.click(sel, { timeout: 4000 }); };

  await page.goto(file);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('othonoi-muted', '1'); });
  await page.reload();
  await page.waitForTimeout(700);
  await snap('01-title');
  await click('button[data-t="begin"]');
  for (let i = 0; i < 4; i++) { if (i === 1) await snap('02-intro'); await click('button[data-t="next"]'); }
  await click('button[data-t="next"]');
  await snap('03-choice');

  for (const [n, ch] of [[1, 'inst'], [2, 'song'], [3, 'beach']]) {
    const bot = BOTS[ch][0], tag = n + '-' + ch;
    await click(`button[data-t="pick"][data-ch="${ch}"]`);
    await snap(tag + '-00-chosen');
    await click('button[data-t="ashore"]');
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__oth.speed(14));
    await snap(tag + '-01-ammos');
    let guard = 0, lastDay = 0, stuck = 0;
    for (; guard < 2500; guard++) {
      if (await visible('#theater')) break;   // the open studio
      const s = await state();
      if (s.day !== lastDay) { lastDay = s.day; if (s.day === 2) await snap(tag + '-02-day2'); }
      if (await visible('#sheet')) {
        const ev = await page.$('#sheetCard button[data-act="choose"]');
        if (ev) {
          await snap(tag + '-ev-' + s.pending);
          const want = CHOICE[s.pending], pick = want && await page.$(`#sheetCard button[data-act="choose"][data-c="${want}"]`);
          await (pick || ev).click();
          await page.waitForSelector('#sheetCard button[data-act="continue"]', { timeout: 4000 });
          await click('#sheetCard button[data-act="continue"]');
          continue;
        }
        const close = await page.$('#sheetCard button[data-act="close"]');
        if (close) { await close.click(); continue; }
      }
      if (s.phase === 'night') { await snap(tag + '-night-' + s.day); await click('#tab-here'); await click('#panel button[data-act="wake"]'); continue; }
      if (s.busy || s.travel) {
        if (s.busy && ['swim', 'eat', 'build', 'record', 'guitar', 'lie', 'nap', 'carry'].includes(E.ACT[s.busy.id].pose)) await snap(tag + '-do-' + E.ACT[s.busy.id].pose);
        if (s.travel) await snap(tag + '-travel');
        await page.waitForTimeout(140); continue;
      }
      // think about it in Node, then do it with the buttons
      s.bot = bot; intent = null;
      const ok = decide(s);
      if (!ok || !intent) { if (++stuck > 12) throw new Error(`${ch}: the bot is stuck on day ${s.day} at ${s.clock.toFixed(2)}, ${s.place}`); await page.waitForTimeout(150); continue; }
      stuck = 0;
      if (intent.act) {
        if (!(await visible('#tab-here[aria-selected="true"]'))) await click('#tab-here');
        await click(`#panel button[data-act="do"][data-id="${intent.act}"]`);
      } else {
        await click('#tab-map');
        if (s.day === 2) await snap(tag + '-map');
        await click(`#panel .prow[data-place="${intent.go}"]`);
        await page.waitForSelector('#sheet:not([hidden])');
        if (s.day === 3) await snap(tag + '-place-sheet');
        const btn = await page.$(`#sheetCard button[data-act="go"][data-mode="${intent.mode}"]`) || await page.$('#sheetCard button[data-act="go"][data-mode="walk"]');
        if (!btn) throw new Error(`${ch}: no way to go to ${intent.go} from ${s.place}`);
        await btn.click();
      }
      await page.waitForTimeout(60);
    }
    // the open studio, and the end of the week
    await page.evaluate(() => window.__oth.speed(1));
    await snap(tag + '-finale');
    for (let i = 0; i < 12 && await page.$('button[data-t="fnext"]'); i++) await click('button[data-t="fnext"]');
    if (await page.$('button[data-t="sing"]')) { await click('button[data-t="sing"]'); await page.waitForTimeout(4200); await snap(tag + '-song'); }
    await click('button[data-t="end"]');
    await snap(tag + '-summary');
    const s = await state();
    console.log(`Chapter ${n}, ${ch}: ${s.summary.rating}. Score ${s.summary.score}, ${s.eur} € left, ${Math.round(s.km * 10) / 10} km walked, goals ${E.goalsOf(s).filter(g => g.done).length}/${E.goalsOf(s).length}.`);
    await click('button[data-t="another"]');
    await page.waitForTimeout(300);
  }
  // a wide screen, too
  await page.setViewportSize({ width: 1280, height: 760 });
  await click('button[data-t="pick"][data-ch="song"]'); await click('button[data-t="skipday"]');
  await page.waitForTimeout(600);
  await snap('90-desktop-house');
  await click('#tab-map'); await page.waitForTimeout(500);
  await snap('91-desktop-map');
  await browser.close();
  console.log(`${shots.size} screenshots in ${out}`);
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('No errors.');
})().catch(e => { console.error(e); process.exit(1); });
