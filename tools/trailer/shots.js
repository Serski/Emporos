// The trailer, shot by shot. Times are in seconds. The music runs at about 92 beats a minute, so a beat is 0.65 s and
// the long shots are a bar of four beats; clicks and drops in them land on the beat. The pirates, the gale and the four
// ports are cut faster, and the music hits each of those cuts instead of keeping time through them.
//
// Each shot loads a real saved game (made by states.js), frames it, and plays it under a fake clock:
//   page:     the saved state to load. ui: true films the whole game screen at 1280 x 720, scaled 1.5x to 1920 x 1080;
//             otherwise only the picture is filmed, full frame. cols sets how many art pixels across the picture is.
//   dur:      how long the shot lasts. Each shot starts where the one before it ends.
//   setup:    runs once, before the first frame.
//   frame:    runs before each frame; may move the pointer, click, drag, or nudge the state.
//   captions: positions in frame pixels (1920 x 1080), times relative to the start of the shot.
const BEAT = 0.65;
// The isometric town is busier than the game's own picture, so the title card's words get a darker wash behind them there.
const EBOY = process.argv.includes('--eboy');
const BAR = 4 * BEAT;

// The words on screen. "Wishlist now on Steam" suits a store page before release; change it here for launch.
const TEXT = {
  cta: 'Wishlist now on Steam',
  tagline: 'A trading game of the ancient sea',
};

const cap = (big, small, o = {}) => Object.assign({ html: (small ? `<div class="small">${small}</div>` : '') + `<div class="big">${big}</div>` }, o);
// Shots of the game screen keep their caption in a band along the bottom, clear of the game's own text.
const band = (from, to) => ({ y: 944, h: 136, from, to, bg: 'linear-gradient(to bottom, rgba(22,16,12,0.94), rgba(16,11,8,0.97))', inT: 0.1, outT: 0.1 });
const bandCap = (text, from, to) => ({ html: `<div class="big" style="font-size:84px;text-shadow:6px 6px 0 #16100c">${text}</div>`, x: 960, y: 1014, from, to, rise: 0, inT: 0.1, outT: 0.1 });

// Close the title screen and let the picture run a while, so boats and gulls are mid-stride.
async function opening(H, { scenic = true, preroll = 4000, after } = {}) {
  await H.ev(() => { const T = window.__emp.T; T.closeTheater(); T.renderPanel(); });
  if (scenic) await H.mode('tr-scenic');
  if (after) await after();
  await H.run(preroll);
}

// Click a button on the beat: glide to wherever it is now, then press it.
async function clickOnBeat(H, t, when, sel, sfx, glide = 0.36) {
  if (H.at(t, when - glide)) { const b = await H.rect(sel); H.pointer.glide(b.cx, b.cy, t, when - 0.05); }
  if (H.at(t, when)) { await H.click(t); H.sfx(t, sfx); }
}
// After the last click, the pointer drifts out of the way before the cut.
function driftOff(H, t, shot, dx, dy) {
  if (H.at(t, 3.3 * BEAT)) { const p = H.pointer.at(t); H.pointer.glide(p.x + dx, p.y + dy, t, shot.dur); }
}

const BUY = '#sheetCard button[data-act="buy"][data-g="wine"]';
const SELL = g => `#sheetCard button[data-act="sellall"][data-g="${g}"]`;
const ON_THE_BEAT = [1, 2, 3].map(n => n * BEAT);

const SHOTS = [
  {
    id: 'rhodes', dur: BAR,
    page: { state: 'ch1-rhodes-buying' },
    setup: H => opening(H, { preroll: 6200 }),
    fade: [[0, 0.4, 1, 0]],
    captions: [cap('Rhodes', 'Spring · 290 BC', { x: 1290, y: 230, from: 0.45, to: BAR - 0.1, scrim: [900, 380] })],
  },
  {
    id: 'buy', dur: BAR,
    page: { ui: true, state: 'ch1-rhodes-buying' },
    async setup(H) {
      await opening(H, { scenic: false, preroll: 3000, after: () => H.ev(() => window.__emp.T.openSheet('merchant', 'thras')) });
      const b = await H.rect(BUY);
      H.pointer = H.makePointer(b.cx + 260, b.cy + 190);
      H.pointer.glide(b.cx, b.cy, 0.05, ON_THE_BEAT[0] - 0.1);
    },
    async frame(H, f, t) {
      for (const when of ON_THE_BEAT) await clickOnBeat(H, t, when, BUY, 'coin', 0.3);
      driftOff(H, t, this, 50, 80);
    },
    purse: true,
    bands: [band(0.1, BAR)],
    captions: [bandCap('Buy low', 0.1, BAR)],
  },
  {
    id: 'hold', dur: BAR,
    page: { ui: true, state: 'ch5-taras-leaving' },
    async setup(H) {
      await opening(H, { scenic: false, preroll: 2500, after: () => H.ev(() => window.__emp.T.setTab('hold')) });
      // Take three things back out of the hold onto the quay, to pack them again on the beat.
      this.plan = await H.ev(() => {
        const S = window.__emp.state(), f = window.__emp.fns, out = [];
        for (const g of ['horse', 'krater', 'purple']) {
          const it = S.items.find(i => i.g === g && i.where === 'hold');
          if (!it) continue;
          const home = { x: it.x, y: it.y, rot: it.rot };
          let spot = null;
          for (let y = 0; y < 12 && !spot; y++) for (let x = 0; x < 3 && !spot; x++) if (f.fits(S, it, 'dock', x, y, it.rot)) spot = { x, y };
          if (spot && f.moveItem(S, it.id, 'dock', spot.x, spot.y, it.rot)) out.push({ id: it.id, g, home, dock: spot });
        }
        window.__emp.T.renderPanel();
        return out;
      });
      if (this.plan.length !== 3) throw new Error('hold shot: could not set three things out on the quay: ' + JSON.stringify(this.plan));
      await H.run(300);
      this.drags = [];   // picked up a little before the beat, let go on it
      for (const [i, p] of this.plan.entries()) this.drags.push({ ...p, from: await H.cell('dock', p.dock.x, p.dock.y), to: await H.cell('hold', p.home.x, p.home.y), press: ON_THE_BEAT[i] - 0.36, release: ON_THE_BEAT[i] });
      const d0 = this.drags[0];
      H.pointer = H.makePointer(d0.from.x + 170, d0.from.y + 150);
    },
    async frame(H, f, t) {
      for (const d of this.drags) {
        if (H.at(t, d.press - 0.22)) H.pointer.glide(d.from.x, d.from.y, t, d.press - 0.03);
        if (H.at(t, d.press)) { await H.mouse.down(); H.down = true; H.pointer.glide(d.to.x, d.to.y, t, d.release - 0.05); H.sfx(t, 'lift'); }
        if (H.at(t, d.release)) {
          await H.mouse.up(); H.down = false; H.sfx(t, 'place');
          const ok = await H.ev(id => window.__emp.state().items.find(i => i.id === id).where === 'hold', d.id);
          if (!ok) throw new Error('hold shot: the ' + d.g + ' did not land in the hold');
        }
      }
      driftOff(H, t, this, 70, 110);
    },
    captions: [cap('Pack the hold', null, { x: 615, y: 470, from: 0.1, to: BAR, scrim: [1100, 360] })],
  },
  {
    id: 'sail', dur: BAR,
    page: { state: 'ch5-croton-leaving' },
    async setup(H) {
      await opening(H, { preroll: 300 });
      await H.ev(() => { window.__emp.speed(0); const S = window.__emp.state(); window.__emp.fns.setSail(S); S.voyage.wind = 'fair'; S.voyage.row = false; });
      await H.run(400);
    },
    async frame(H, f, t) {
      // A day from dawn to dusk in a bar of music.
      await H.ev(([t, dur]) => {
        const v = window.__emp.state().voyage, k = t / dur;
        v.clock = 0.03 + 0.95 * k; v.prog = 0.05 + 0.55 * k; v.wind = 'fair';
        window.__emp.ui.dolphins = t > 0.5 && t < dur - 0.2 ? 1 : 0;
      }, [t, this.dur]);
    },
    captions: [cap('Sail the wine-dark sea', null, { x: 960, y: 180, from: 0.12, to: BAR - 0.1, scrim: [1500, 300] })],
  },
  {
    id: 'pirates', dur: 1.4,
    page: { state: 'ch1-event-pirates-d4' },
    setup: H => opening(H, { preroll: 120 }),
    async frame(H, f, t) { if (f === 0) H.sfx(0, 'horn'); },
    captions: [cap('Run, pay, or fight', 'Pirates', { x: 960, y: 210, from: 0.08, to: 1.4, scrim: [1300, 360], rise: 12 })],
  },
  {
    id: 'storm', dur: 1.4,
    page: { state: 'ch1-event-squall-d2' },
    setup: H => opening(H, { preroll: 2600 }),
    async frame(H, f, t) { if (f === 0) H.sfx(0, 'storm'); },
    captions: [cap('Weather the storm', 'Gales', { x: 960, y: 210, from: 0.06, to: 1.4, scrim: [1300, 360], rise: 12 })],
  },
  ...[['piraeus', 'ch3-piraeus-buying', 'Athens'], ['syracuse', 'ch6-syracuse-buying', 'Syracuse'], ['tyre', 'ch8-tyre-buying', 'Tyre'], ['alexandria', 'ch9-alexandria-buying', 'Alexandria']]
    .map(([id, state, name], i) => ({
      id, dur: 0.8,
      page: { state },
      setup: H => opening(H, { preroll: 3000 + i * 700 }),
      async frame(H, f, t) { if (f === 0) H.sfx(0, 'port', { i }); },
      // already up on the first frame of each cut, so the title never blinks between ports
      bands: [{ y: 0, h: 400, from: -1, to: 9, bg: 'linear-gradient(to bottom, rgba(16,11,8,0.72), rgba(16,11,8,0.5) 55%, rgba(16,11,8,0))' }],
      captions: [cap(name, 'Nine voyages', { x: 960, y: 170, from: -1, to: 9, rise: 0 })],
    })),
  {
    id: 'sell', dur: BAR,
    page: { ui: true, state: 'ch8-tyre-selling' },
    async setup(H) {
      await opening(H, { scenic: false, preroll: 3000, after: () => H.ev(() => window.__emp.T.openSheet('merchant', 'quartermaster')) });
      for (const g of ['timber', 'cedar', 'pitch']) if (!(await H.has(SELL(g)))) throw new Error('sell shot: the quartermaster has no "All" button for ' + g);
      const b = await H.rect(SELL('timber'));
      H.pointer = H.makePointer(b.cx + 220, b.cy - 170);
      H.pointer.glide(b.cx, b.cy, 0.05, ON_THE_BEAT[0] - 0.1);
    },
    async frame(H, f, t) {
      await clickOnBeat(H, t, ON_THE_BEAT[0], SELL('timber'), 'coins', 0.3);
      await clickOnBeat(H, t, ON_THE_BEAT[1], SELL('cedar'), 'coins', 0.36);
      await clickOnBeat(H, t, ON_THE_BEAT[2], SELL('pitch'), 'coins', 0.36);
      driftOff(H, t, this, 50, 80);
    },
    purse: true,
    bands: [band(0.1, BAR)],
    captions: [bandCap('Sell high', 0.1, BAR)],
  },
  {
    id: 'end', dur: 3.4,
    page: { state: 'ch9-repaid', cols: 175 },
    async setup(H) {
      await H.mode('tr-tview');
      await H.run(5200);
    },
    fade: [[3.4 - 0.45, 3.4, 0, 1]],
    thumbnail: 2.6,   // the frame the store-page thumbnail is cut from: the whole title card, before the fade
    // The god stands left of centre, so the title sits in the open sky to his right.
    captions: [
      { html: '<div class="logo">Emporos</div>', x: 1470, y: 290, from: BEAT, to: 9, inT: 0.3, rise: 24, scrim: EBOY ? [1240, 900] : [960, 440],
        scrimBg: EBOY ? 'radial-gradient(closest-side, rgba(16,11,8,0.78), rgba(16,11,8,0.62) 55%, rgba(16,11,8,0))' : null },
      { html: `<div class="small" style="font-size:28px;letter-spacing:0.16em;color:#f2e6cb">${TEXT.tagline}</div><div class="tr-meander" style="width:432px"></div>`, x: 1470, y: 432, from: 1.7 * BEAT, to: 9, inT: 0.3, rise: 12 },
      { html: `<div class="cta">${TEXT.cta}</div>`, x: 1470, y: 590, from: 2.5 * BEAT, to: 9, inT: 0.25, rise: 12 },
    ],
  },
];

// Each shot starts where the one before it ends.
let clock = 0;
for (const s of SHOTS) { s.at = +clock.toFixed(4); clock += s.dur; }
const DURATION = +clock.toFixed(4);
// Where each shot starts, by id: the score is written against these.
const CUES = Object.fromEntries(SHOTS.map(s => [s.id, s.at]));

module.exports = { SHOTS, BEAT, TEXT, CUES, DURATION };
