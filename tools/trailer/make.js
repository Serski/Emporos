// Makes the Steam trailer: films the real game, shot by shot, under a fake clock, scores it with the game's own
// sound engine, and encodes a 1920 x 1080, 60 fps H.264 MP4.
//
// Usage: node tools/trailer/make.js [shot ids, comma-separated, to re-film only those] [--film-only] [--no-film] [--no-audio] [--out file.mp4]
// Needs Playwright (npm install) and ffmpeg on the PATH. Work files go to trailer-work/ (or $TRAILER_WORK).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ROOT, FW, FH, buildHarness, openPage, chromium } = require('./rig');
const { makeStates } = require('./states');
const { SHOTS, CUES, BEAT, DURATION } = require('./shots');
const { renderScore } = require('./score');

const FPS = 60;
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(ROOT, 'trailer', 'emporos-trailer.mp4');
const ONLY = (args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out') || '').split(',').filter(Boolean);
const WORK = path.resolve(process.env.TRAILER_WORK || path.join(ROOT, 'trailer-work'));
const STATES = path.join(WORK, 'states');
fs.mkdirSync(path.join(WORK, 'shots'), { recursive: true });

function ffmpeg(argv, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: [opts.stdin ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg exited with ' + code)));
    if (opts.stdin) opts.stdin(p);
  });
}
const write = (stream, buf) => new Promise(res => { if (stream.write(buf)) res(); else stream.once('drain', res); });
const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

// A pointer that glides from wherever it is to a point, over a stretch of time.
function makePointer(x, y) {
  const segs = [];
  return {
    at(t) {
      let p = { x, y };
      for (const s of segs) {
        if (t >= s.t1) p = { x: s.x1, y: s.y1 };
        else if (t >= s.t0) { const k = ease((t - s.t0) / (s.t1 - s.t0)); p = { x: s.x0 + (s.x1 - s.x0) * k, y: s.y0 + (s.y1 - s.y0) * k }; }
      }
      return p;
    },
    glide(x1, y1, t0, t1) { const p = this.at(t0); segs.push({ t0, t1, x0: p.x, y0: p.y, x1, y1 }); },
  };
}

async function film(browser, shot) {
  const ui = !!shot.page.ui, k = ui ? 1.5 : 1;   // frame pixels to a CSS pixel
  const page = await openPage(browser, { w: FW / k, h: FH / k, dsf: k, state: shot.page.state, statesDir: STATES, harness: path.join(WORK, 'harness.html'), cols: shot.page.cols || 0, seed: shot.page.seed || 7 });
  const events = [];
  const H = {   // what a shot's setup and frame hooks can do
    mouse: page.mouse,
    ev: (fn, arg) => page.evaluate(fn, arg),
    run: ms => page.clock.runFor(ms),
    mode: (...cls) => page.evaluate(cls => { document.documentElement.className = cls.join(' '); }, cls),
    at: (t, when) => Math.round(when * FPS) === Math.round(t * FPS),
    sfx: (t, kind, o) => events.push(Object.assign({ t: +(shot.at + t).toFixed(4), kind }, o)),
    async rect(sel) {
      const r = await page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }, sel);
      if (!r) throw new Error(shot.id + ': nothing matches ' + sel);
      return { x: r[0] * k, y: r[1] * k, w: r[2] * k, h: r[3] * k, cx: (r[0] + r[2] / 2) * k, cy: (r[1] + r[3] / 2) * k };
    },
    has: sel => page.evaluate(sel => !!document.querySelector(sel), sel),
    // the middle of a square's first art square in the hold or on the quay, in frame pixels
    async cell(where, x, y) {
      const p = await page.evaluate(([where, x, y]) => {
        const L = window.__emp.hold.lay, r = document.querySelector('#holdCanvas').getBoundingClientRect();
        const ax = (where === 'dock' ? L.dx : L.hx) + x * 12 + 6, ay = (where === 'dock' ? L.dy : L.hy) + y * 12 + 6;
        return [r.left + ax / L.wAp * r.width, r.top + ay / L.hAp * r.height];
      }, [where, x, y]);
      return { x: p[0] * k, y: p[1] * k };
    },
    pointer: null, down: false, makePointer,
    async moveMouse(fx, fy) { await page.mouse.move(fx / k, fy / k); },
    async click(t) { H.clicks.push({ id: 'c' + H.clicks.length, t }); await page.mouse.down(); await page.mouse.up(); },
    clicks: [],
  };
  await page.evaluate(spec => window.__ov.init(spec), { captions: shot.captions || [], bands: shot.bands || [], purse: !!shot.purse });
  const self = Object.create(shot);   // per-take scratch space for the shot's own hooks
  if (shot.setup) await shot.setup.call(self, H);
  const n = Math.round(shot.dur * FPS), out = path.join(WORK, 'shots', shot.id + '.mkv');
  let clock = 0;
  const fadeAt = t => { for (const [a, b, v0, v1] of shot.fade || []) if (t >= a && t <= b) return v0 + (v1 - v0) * ((t - a) / (b - a)); return 0; };
  await ffmpeg(['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-crf', '0', out], {
    async stdin(p) {
      for (let f = 0; f < n; f++) {
        const t = f / FPS;
        if (shot.frame) await shot.frame.call(self, H, f, t);
        let ptr = null;
        if (H.pointer) {
          const p = H.pointer.at(t);
          await H.moveMouse(p.x, p.y);
          ptr = { x: p.x, y: p.y, down: H.down || H.clicks.some(c => t >= c.t && t < c.t + 0.08) };
        }
        const bursts = H.clicks.filter(c => t >= c.t && t < c.t + 0.32).map(c => { const p = H.pointer.at(c.t); return { id: c.id, x: p.x, y: p.y, age: t - c.t }; });
        await page.evaluate(st => window.__ov.set(st), { t, ptr, bursts, fade: fadeAt(t) });
        const next = Math.round((f + 1) * 1000 / FPS);
        await page.clock.runFor(next - clock); clock = next;
        await write(p.stdin, await page.screenshot({ type: 'png' }));
      }
      p.stdin.end();
    },
  });
  fs.writeFileSync(path.join(WORK, 'shots', shot.id + '.json'), JSON.stringify(events));
  await page.close();
}

// Steam asks for up to 1920 x 1080, 30 or 60 fps, a high bit rate (5,000+ kbps), and 44.1 or 48 kHz sound.
// Pixel art needs far fewer bits than that to look perfect, so two passes at 10 Mbps leave room for Steam's own re-encode.
async function encode(audio) {
  const list = path.join(WORK, 'shots.txt');
  fs.writeFileSync(list, SHOTS.map(s => `file '${path.join(WORK, 'shots', s.id + '.mkv')}'`).join('\n') + '\n');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const video = ['-f', 'concat', '-safe', '0', '-i', list, ...(audio ? ['-i', audio] : []), '-map', '0:v', '-t', String(DURATION),
    // Number the frames 0, 1, 2...: the shots' stored timestamps are rounded to the millisecond, and must not cost a frame.
    // Box-average the colour, which cannot ring at the hard edges of pixel art, and convert with the BT.709 matrix the file is tagged with.
    '-vf', `setpts=N/(${FPS}*TB),scale=flags=area+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=limited,format=yuv420p`, '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-b:v', '10M', '-maxrate', '16M', '-bufsize', '20M', '-x264-params', 'keyint=60:min-keyint=60:aq-mode=3',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-passlogfile', path.join(WORK, 'x264pass')];
  await ffmpeg([...video, '-pass', '1', '-an', '-f', 'mp4', '/dev/null']);
  await ffmpeg([...video, '-pass', '2', ...(audio ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2'] : []), '-movflags', '+faststart', OUT]);
  // A thumbnail for the store page: Steam wants a 1920 x 1080 frame from the trailer itself (shots.js marks which).
  const thumb = SHOTS.find(s => s.thumbnail != null);
  if (thumb) await ffmpeg(['-i', path.join(WORK, 'shots', thumb.id + '.mkv'), '-vf', `select=eq(n\\,${Math.round(thumb.thumbnail * FPS)})`, '-frames:v', '1', OUT.replace(/\.mp4$/, '-thumbnail.png')]);
}

(async () => {
  const t0 = Date.now();
  buildHarness(WORK);
  if (!fs.existsSync(path.join(STATES, 'ch9-repaid.json'))) { console.log('Playing nine chapters for states...'); makeStates(STATES); }
  const browser = await chromium.launch();
  try {
    if (!flag('--no-film')) {
      for (const shot of SHOTS) {
        if (ONLY.length && !ONLY.includes(shot.id)) continue;
        const s = Date.now();
        await film(browser, shot);
        console.log(`filmed ${shot.id.padEnd(11)} ${(shot.dur * FPS).toFixed(0).padStart(4)} frames in ${((Date.now() - s) / 1000).toFixed(1)} s`);
      }
    }
    if (flag('--film-only')) return;
    for (const s of SHOTS) if (!fs.existsSync(path.join(WORK, 'shots', s.id + '.mkv'))) throw new Error(`shot ${s.id} has not been filmed yet: run without shot ids to film them all`);
    let audio = null;
    if (!flag('--no-audio')) {
      const events = SHOTS.flatMap(s => { const f = path.join(WORK, 'shots', s.id + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
      audio = path.join(WORK, 'score.wav');
      const r = await renderScore(browser, { harness: path.join(WORK, 'harness.html'), events, out: audio, duration: DURATION, cues: CUES, beat: BEAT });
      console.log(`scored ${events.length} cues: mastered ${r.got.I} LUFS, true peak ${r.got.TP} dBTP`);
    }
    await encode(audio);
    console.log(`Wrote ${path.relative(process.cwd(), OUT)} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
