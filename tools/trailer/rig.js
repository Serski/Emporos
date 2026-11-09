// The stage the trailer is filmed on: the real game page (index.html, or with --eboy the isometric preview samples/game-iso.html), plus a handle on a few of its internals,
// CSS that can frame the picture without the ledger, and an overlay for captions and a mouse pointer.
// None of it changes the rules; it only lets the recorder load a state, frame it, and light it.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const FW = 1920, FH = 1080;   // the frame

function replaceOnce(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`expected exactly one "${from.slice(0, 60)}" in index.html, found ${n}`);
  return src.replace(from, to);
}

function buildHarness(workDir, pageFile) {
  let src = fs.readFileSync(path.join(ROOT, pageFile || 'index.html'), 'utf8');
  src = replaceOnce(src, 'window.__emp = { state: () => S,', 'window.__emp = { T: { Snd, openSheet, renderPanel, setTab, closeTheater, COIN, scaledURL }, state: () => S,');
  // How many art pixels across the picture is. The game picks this for the screen; a 16:9 frame sometimes needs more rows.
  src = replaceOnce(src, 'fitPixels(els.scene, els.stage.clientWidth, els.stage.clientHeight, 140)', 'fitPixels(els.scene, els.stage.clientWidth, els.stage.clientHeight, window.__trCols || 140)');
  src = replaceOnce(src, 'fitPixels(els.tcanvas, view.clientWidth, view.clientHeight, 150)', 'fitPixels(els.tcanvas, view.clientWidth, view.clientHeight, window.__trCols || 150)');
  src = replaceOnce(src, '</head>', `<style id="trailer-css">${CSS}</style>\n</head>`);
  src = replaceOnce(src, '</body>', `<div id="tr-overlay"></div>\n<script>(${overlay.toString()})(${FW}, ${FH});</script>\n</body>`);
  fs.mkdirSync(workDir, { recursive: true });
  const file = path.join(workDir, 'harness.html');
  fs.writeFileSync(file, src);
  return file;
}

const CSS = `
*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }
html.tr-scenic #app { max-width: none !important; display: block !important; height: 100%; }
html.tr-scenic .stage { position: fixed !important; inset: 0 !important; height: 100% !important; }
html.tr-scenic .hud, html.tr-scenic .panel, html.tr-scenic .tabs, html.tr-scenic .meander, html.tr-scenic .hotspots,
html.tr-scenic .banner, html.tr-scenic #sheet { display: none !important; }
html.tr-tview .t-bottom, html.tr-tview .t-top { display: none !important; }
#tr-overlay { position: fixed; inset: 0; z-index: 1000; pointer-events: none; overflow: hidden; }
#tr-box { position: absolute; left: 0; top: 0; transform-origin: 0 0; overflow: hidden; }
#tr-box .cap { position: absolute; left: 0; top: 0; text-align: center; white-space: nowrap; }
#tr-box .big { font: 700 116px/1 "Pixelify Sans"; letter-spacing: 0.06em; text-transform: uppercase; color: #f2e6cb; text-shadow: 8px 8px 0 #16100c; }
#tr-box .small { font: 600 36px/1 "Pixelify Sans"; letter-spacing: 0.2em; text-transform: uppercase; color: #eac05a; text-shadow: 4px 4px 0 #16100c; }
#tr-box .small + .big, #tr-box .big + .small { margin-top: 22px; }
#tr-box .logo { font: 700 170px/0.9 "Pixelify Sans"; letter-spacing: 0.06em; color: #f2e6cb; text-shadow: 12px 12px 0 #16100c; }
#tr-box .tr-meander { height: 28px; margin: 26px auto 0; background-repeat: repeat-x; background-size: 24px 28px; image-rendering: pixelated; filter: drop-shadow(4px 4px 0 #16100c); }
#tr-box .scrim { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: -1; pointer-events: none;
  background: radial-gradient(closest-side, rgba(16, 11, 8, 0.3), rgba(16, 11, 8, 0.16) 60%, rgba(16, 11, 8, 0)); }
#toast { display: none !important; }   /* the game's toasts would cover the merchant's name */
#tr-box .cta { display: inline-block; font: 600 40px/1 "Pixelify Sans"; letter-spacing: 0.04em; color: #1c0f07; background: #d97b46; padding: 22px 40px 20px;
  border: 4px solid #9e4f28; border-top-color: #f2a36d; border-left-color: #f2a36d; box-shadow: 8px 8px 0 #16100c; }
#tr-box .pco { position: absolute; left: 30px; top: 26px; display: flex; align-items: center; gap: 18px; padding: 14px 28px 14px 18px;
  background: rgba(16, 11, 8, 0.92); border: 3px solid #4b3727; font: 700 92px/1 "Pixelify Sans"; color: #f2e6cb; text-shadow: 6px 6px 0 #16100c; font-variant-numeric: tabular-nums; }
#tr-box .pco img { width: 77px; height: 77px; image-rendering: pixelated; }
#tr-box .pco span { font: 500 44px/1 "Pixelify Sans"; color: #bba887; align-self: flex-end; padding-bottom: 6px; }
#tr-box .band { position: absolute; left: 0; width: 100%; pointer-events: none; }
#tr-box .ptr { position: absolute; left: 0; top: 0; width: 48px; height: 76px; }
#tr-box .ptr svg { width: 100%; height: 100%; shape-rendering: crispEdges; display: block; }
#tr-box .burst { position: absolute; border: 5px solid #eac05a; box-shadow: 4px 4px 0 rgba(22, 16, 12, 0.85); }
#tr-box .fade { position: absolute; inset: 0; background: #000; }
`;

// Runs inside the page. Captions are laid out in frame pixels (1920 x 1080) and scaled to the viewport,
// so a caption looks the same whether the shot is filmed at 1920 x 1080 or at 1280 x 720 and 1.5x.
function overlay(FW, FH) {
  const POINTER = [
    'X...........', 'XX..........', 'XoX.........', 'XooX........', 'XoooX.......', 'XooooX......', 'XoooooX.....', 'XooooooX....', 'XoooooooX...',
    'XooooooooX..', 'XoooooooooX.', 'XooooooXXXXX', 'XoooXooX....', 'XooXXooX....', 'XoX.XooX....', 'XX...XooX...', 'X....XooX...', '......XooX..', '......XooX..', '.......XX...',
  ];
  const svg = () => {
    let r = '';
    POINTER.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${row[x] === 'X' ? '#16100c' : '#f2e6cb'}"/>`; });
    return `<svg viewBox="0 0 12 20">${r}</svg>`;
  };
  let box = null, caps = [], ptr = null, fade = null, purse = null, bursts = new Map();
  const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3);
  window.__ov = {
    init(spec) {
      const root = document.getElementById('tr-overlay');
      root.innerHTML = '';
      box = document.createElement('div'); box.id = 'tr-box';
      box.style.width = FW + 'px'; box.style.height = FH + 'px'; box.style.transform = `scale(${innerWidth / FW})`;
      root.appendChild(box);
      const meander = getComputedStyle(document.getElementById('meander')).backgroundImage;
      for (const b of spec.bands || []) {
        const el = document.createElement('div'); el.className = 'band';
        el.style.top = b.y + 'px'; el.style.height = b.h + 'px'; el.style.background = b.bg;
        box.appendChild(el); caps.push({ el, from: b.from, to: b.to, inT: b.inT ?? 0.15, outT: b.outT ?? 0.15, rise: 0, x: null });
      }
      for (const c of spec.captions || []) {
        const el = document.createElement('div'); el.className = 'cap';
        el.innerHTML = (c.scrim ? `<div class="scrim" style="width:${c.scrim[0]}px;height:${c.scrim[1]}px${c.scrimBg ? ';background:' + c.scrimBg : ''}"></div>` : '') + c.html;
        for (const m of el.querySelectorAll('.tr-meander')) { m.style.backgroundImage = meander; if (!m.style.width) m.style.width = '384px'; }
        box.appendChild(el);
        caps.push({ el, x: c.x, y: c.y, from: c.from, to: c.to, inT: c.inT ?? 0.14, outT: c.outT ?? 0.12, rise: c.rise ?? 18, align: c.align || 'center' });
      }
      // The purse, enlarged: the game's coin and number, read live from the state. Like the game's own purse,
      // it turns olive while the silver goes up and clay while it goes down.
      if (spec.purse) {
        const T = window.__emp.T;
        purse = { el: document.createElement('div'), shown: null, hold: 0, dir: 0 };
        purse.el.className = 'pco';
        purse.el.innerHTML = `<img src="${T.scaledURL(T.COIN, 7)}" alt=""><b></b><span>dr</span>`;
        box.appendChild(purse.el);
      }
      ptr = document.createElement('div'); ptr.className = 'ptr'; ptr.innerHTML = svg(); ptr.style.display = 'none'; box.appendChild(ptr);
      fade = document.createElement('div'); fade.className = 'fade'; fade.style.opacity = 0; box.appendChild(fade);
    },
    // st: { t, ptr: { x, y, down } | null, bursts: [{ id, x, y, age }], fade }
    set(st) {
      for (const c of caps) {
        const a = Math.min(ease((st.t - c.from) / c.inT), 1 - ease((st.t - (c.to - c.outT)) / c.outT));
        c.el.style.opacity = Math.max(0, a);
        c.el.style.visibility = a > 0 ? 'visible' : 'hidden';
        if (c.x != null) {
          const dy = Math.round((1 - ease((st.t - c.from) / c.inT)) * c.rise);
          const ax = c.align === 'left' ? '0' : c.align === 'right' ? '-100%' : '-50%';
          c.el.style.transform = `translate(${c.x}px, ${c.y + dy}px) translate(${ax}, -50%)`;
        }
      }
      if (st.ptr) { ptr.style.display = 'block'; ptr.style.transform = `translate(${Math.round(st.ptr.x) - 4}px, ${Math.round(st.ptr.y) - 4 + (st.ptr.down ? 3 : 0)}px)`; } else ptr.style.display = 'none';
      const live = new Set();
      for (const b of st.bursts || []) {
        live.add(b.id);
        let el = bursts.get(b.id);
        if (!el) { el = document.createElement('div'); el.className = 'burst'; box.insertBefore(el, ptr); bursts.set(b.id, el); }
        const k = ease(b.age / 0.32), s = Math.round(18 + k * 64);
        el.style.width = el.style.height = s + 'px';
        el.style.transform = `translate(${Math.round(b.x - s / 2)}px, ${Math.round(b.y - s / 2)}px)`;
        el.style.opacity = Math.max(0, 1 - k);
      }
      for (const [id, el] of bursts) if (!live.has(id)) { el.remove(); bursts.delete(id); }
      if (purse) {
        const v = window.__emp.state().silver;
        if (purse.shown == null) purse.shown = v;
        const d = v - purse.shown;
        if (Math.abs(d) >= 1) { purse.dir = Math.sign(d); purse.hold = 16; purse.shown += Math.sign(d) * Math.max(1, Math.round(Math.abs(d) * 0.2)); }
        else { purse.shown = v; if (purse.hold > 0) purse.hold--; else purse.dir = 0; }
        const b = purse.el.querySelector('b');
        b.textContent = Math.round(purse.shown);
        b.style.color = purse.dir > 0 ? '#b8c468' : purse.dir < 0 ? '#f2a36d' : '#f2e6cb';
      }
      fade.style.opacity = st.fade || 0;
    },
  };
}

// Open the stage with a saved game (or none), the sound muted, a seeded Math.random, and a fake clock that only moves when told.
async function openPage(browser, { w = FW, h = FH, dsf = 1, state = null, statesDir, harness, seed = 7, cols = 0 } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  page.on('pageerror', e => console.log('  pageerror:', e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) console.log('  console:', m.text()); });
  await page.clock.install({ time: new Date('2026-06-01T08:00:00Z') });
  const json = state ? fs.readFileSync(path.join(statesDir, state + '.json'), 'utf8') : null;
  await page.addInitScript(([json, seed, cols]) => {
    try { localStorage.clear(); if (json) localStorage.setItem('emporos-save-v1', json); localStorage.setItem('emporos-muted', '1'); } catch (e) { /* ignore */ }
    if (cols) window.__trCols = cols;
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, [json, seed, cols]);
  await page.goto('file://' + harness);
  // The game's fonts come from Google Fonts. Load every face the game and the captions use before the first frame.
  const faces = ['700 40px "Pixelify Sans"', '600 40px "Pixelify Sans"', '500 40px "Pixelify Sans"', '400 40px "Pixelify Sans"', '400 40px "Literata"', '600 40px "Literata"', 'italic 400 40px "Literata"'];
  await page.evaluate(faces => Promise.all(faces.map(f => document.fonts.load(f))).then(() => document.fonts.ready), faces);
  const missing = await page.evaluate(() => ['Pixelify Sans', 'Literata'].filter(fam => ![...document.fonts].some(f => f.family.replace(/["']/g, '') === fam && f.status === 'loaded')));
  if (missing.length) throw new Error('fonts did not load (is fonts.googleapis.com reachable?): ' + missing.join(', '));
  return page;
}

module.exports = { ROOT, FW, FH, buildHarness, openPage, chromium };
