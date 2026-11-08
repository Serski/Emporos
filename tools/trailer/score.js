// The trailer's sound, rendered offline with the game's own sound engine: its plucked lyre, its coins, the thump of
// cargo going into the hold, the pirates' horn, and its sea and wind. The music follows the shot list in shots.js:
// it is written against where each shot starts (CUES), a bar to each long shot at the shots' BEAT, and a hit on each
// quick cut, in the game's own mode (E to E on the white notes, which the Greeks called Dorian). Sound cues the shots
// logged (clicks, drops, the horn) are played where they happened.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SR = 48000;

// Runs inside the page. Returns the mix as interleaved 32-bit float stereo, base64.
async function compose({ events, duration, SR, cues, beat }) {
  const Snd = window.__emp.T.Snd;
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  // Point the game's sound engine at the offline context: init() makes its output, its noise and its sea.
  const RealAC = window.AudioContext;
  window.AudioContext = function () { return ctx; };
  Snd.ctx = null; Snd.muted = false; Snd.cache = new Map();
  Snd.init();
  window.AudioContext = RealAC;

  // Buses: the game's own output (sea, wind and effects), the music, a room for the music, and a gentle limiter.
  const master = ctx.createGain(), hp = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor();
  hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.7;
  comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.18;
  const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 4000; air.gain.value = 3;
  master.connect(hp); hp.connect(air); air.connect(comp); comp.connect(ctx.destination);
  // The game's output carries the sea, whose brown noise is mostly rumble a laptop cannot play; keep it out of the bass.
  const seaHp = ctx.createBiquadFilter(); seaHp.type = 'highpass'; seaHp.frequency.value = 65; seaHp.Q.value = 0.7;
  Snd.out.disconnect(); Snd.out.connect(seaHp); seaHp.connect(master);
  const music = ctx.createGain(); music.gain.value = 1; music.connect(master);
  const room = ctx.createConvolver(), wet = ctx.createGain(); wet.gain.value = 0.32;
  { // a small stone courtyard: two seconds of decaying noise, darker as it fades
    const n = Math.floor(SR * 2.2), ir = ctx.createBuffer(2, n, SR);
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296 * 2 - 1;
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const k = i / n, e = Math.pow(1 - k, 2.6) * (i < SR * 0.012 ? i / (SR * 0.012) : 1); lp += (rnd() - lp) * (0.55 - 0.45 * k); d[i] = lp * e; } }
    room.buffer = ir;
  }
  room.connect(wet); wet.connect(master);
  // The sea fades in with the picture; everything fades out with it at the end.
  Snd.out.gain.setValueAtTime(0, 0); Snd.out.gain.linearRampToValueAtTime(0.85, 0.5);
  master.gain.setValueAtTime(1, duration - 0.45); master.gain.linearRampToValueAtTime(0, duration);

  const B = beat, E8 = B / 2, S16 = B / 4, C = cues;   // a beat, an eighth, a sixteenth, and where each shot starts
  const steps = (t0, t1, n) => Array.from({ length: n }, (_, k) => t0 + (t1 - t0) * k / n);   // n even strokes from t0 up to t1
  const hz = name => { const m = /^([A-G])(#|b)?(\d)$/.exec(name), s = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return 440 * Math.pow(2, s / 12 + (+m[3] - 4)); };
  const out = (node, pan, send) => {
    const p = ctx.createStereoPanner(); p.pan.value = pan || 0; node.connect(p); p.connect(music);
    if (send) { const s = ctx.createGain(); s.gain.value = send; p.connect(s); s.connect(room); }
  };
  // The lyre: the game's own plucked string.
  const lyre = (note, v, t, pan = 0, send = 0.45) => {
    const src = ctx.createBufferSource(); src.buffer = Snd.pluckBuf(typeof note === 'number' ? note : hz(note));
    const g = ctx.createGain(); g.gain.value = v; src.connect(g); out(g, pan, send); src.start(t);
  };
  const strum = (notes, v, t, spread = 0.018, pan = 0) => notes.forEach((n, i) => lyre(n, v * (1 - i * 0.06), t + i * spread, pan + (i - notes.length / 2) * 0.08));
  // The frame drum: a deep "dum" in the middle, a dry "tek" at the rim, and ghost strokes between.
  const tone = (f0, f1, v, dur, t, send = 0.25, pan = 0) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); out(g, pan, send); o.start(t); o.stop(t + dur + 0.02);
  };
  const hiss = (f, q, v, dur, t, type = 'bandpass', send = 0.2, pan = 0) => {
    const n = ctx.createBufferSource(); n.buffer = Snd.white; n.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(fl); fl.connect(g); out(g, pan, send); n.start(t, Math.random() * 0.2); n.stop(t + dur + 0.02);
  };
  const dum = (t, v = 1) => { tone(150, 58, 0.38 * v, 0.38, t); hiss(320, 0.8, 0.12 * v, 0.07, t, 'lowpass', 0.1); };
  const tek = (t, v = 1) => { hiss(3300, 2.4, 0.2 * v, 0.055, t, 'bandpass', 0.22, 0.12); tone(820, 640, 0.05 * v, 0.03, t, 0.1, 0.12); };
  const ka = (t, v = 1) => hiss(2100, 1.6, 0.075 * v, 0.035, t, 'bandpass', 0.15, -0.15);
  // maqsum, the old rhythm of the eastern Mediterranean: dum tek - tek dum - tek -, with ghost strokes, a bar long
  const maqsum = (t0, v = 1) => [[0, dum], [1, tek], [1.5, ka], [3, tek], [4, dum], [5, ka], [6, tek], [7, ka], [7.5, ka, 0.7]].forEach(([e, hit, k = 1]) => hit(t0 + e * E8, v * k));
  // A drone like an aulos: buzzing reeds, held under the tune.
  const drone = (notes, t0, t1, v, att = 0.4, rel = 0.4, cutoff = 760) => {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.8;
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 115; hpf.Q.value = 0.7;   // the reeds' buzz, without the boom
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + att); g.gain.setValueAtTime(v, Math.max(t0 + att, t1 - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t1);
    lp.connect(hpf); hpf.connect(g); out(g, 0, 0.35);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2; const lg = ctx.createGain(); lg.gain.value = 5; lfo.connect(lg); lfo.start(t0); lfo.stop(t1 + 0.05);
    for (const n of notes) for (const d of [-5, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = d; lg.connect(o.detune); o.connect(lp); o.start(t0); o.stop(t1 + 0.05); }
  };
  // A bronze bell, with the inharmonic partials the game uses for its coins.
  const bell = (note, v, t, dur) => {
    for (const [m, k] of [[1, 1], [2.76, 0.45], [5.4, 0.2], [0.5, 0.2]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(note) * m;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * k, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur / Math.sqrt(m));
      o.connect(g); out(g, 0, 0.5); o.start(t); o.stop(t + dur + 0.05);
    }
  };
  // The game's own effects, at a given time.
  const fx = {
    coin: t => { Snd.ping(2093, 0.16, t, 0.3); Snd.ping(2637, 0.12, t + 0.06, 0.35); },
    coins: t => { Snd.ping(1976, 0.14, t, 0.3); Snd.ping(2349, 0.12, t + 0.07, 0.3); Snd.ping(2637, 0.11, t + 0.15, 0.4); },
    lift: t => Snd.noise(2400, 2, 0.1, 0.04, 'bandpass', t),
    place: t => { Snd.thump(140, 70, 0.4, 0.12, t); Snd.noise(900, 1, 0.1, 0.05, 'bandpass', t); },
    splash: t => Snd.noise(500, 0.7, 0.3, 0.5, 'lowpass', t),
    horn: t => {   // Snd.horn, played at t
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.2, t + 0.12); env.gain.setValueAtTime(0.2, t + 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(env); env.connect(Snd.out);
      for (const [f, v] of [[220, 1], [221.2, 0.6], [330, 0.35]]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.94, t); o.frequency.linearRampToValueAtTime(f, t + 0.1);
        const g = ctx.createGain(); g.gain.value = v * 0.25; o.connect(g); g.connect(lp); o.start(t); o.stop(t + 1.5);
      }
    },
  };
  // The sea and the wind, as the game sets them for each place (Snd.mood), here moved on cue.
  const mood = (t, [wv, wf, nv, nf], tau = 0.25) => {
    Snd.waves.g.gain.setTargetAtTime(wv, t, tau); Snd.waves.f.frequency.setTargetAtTime(wf, t, tau);
    Snd.wind.g.gain.setTargetAtTime(nv, t, tau); Snd.wind.f.frequency.setTargetAtTime(nf, t, tau);
  };
  const PORT = [0.05, 700, 0.03, 380], SEA = [0.09, 900, 0.06, 420], STORM = [0.15, 1400, 0.22, 950], DUSK = [0.05, 520, 0.02, 300];

  // ---- the sea under everything ----
  Snd.waves.g.gain.setValueAtTime(PORT[0], 0); Snd.wind.g.gain.setValueAtTime(PORT[2], 0);
  mood(C.sail, SEA, 0.4); mood(C.storm, STORM, 0.12); mood(C.piraeus, PORT, 0.15); mood(C.end, DUSK, 0.6);

  // ---- Rhodes, 290 BC. The tune, alone on the lyre. ----
  const theme = (t, v, oct = 4) => {   // E B E G A . G F | (E), in eighths
    const o = n => n.replace(/\d/, d => String(+d + oct - 4));
    [['E4', 0], ['B3', 1], ['E4', 2], ['G4', 3], ['A4', 4], ['G4', 6], ['F4', 7]].forEach(([n, e], i) => lyre(o(n), v * (i === 4 ? 1.15 : 1), t + e * E8, 0, 0.5));
  };
  lyre('E3', 0.14, C.rhodes, -0.2); theme(C.rhodes, 0.19);
  drone(['E2', 'B2'], C.rhodes + 0.3, C.buy + 0.2, 0.035, 1.2, 0.3);
  for (let k = 3; k >= 1; k--) tek(C.buy - k * S16, 1.1 - k * 0.2);

  // ---- buy, pack, sail: a bar each. The drum comes in under a turning figure on the lyre. ----
  const ost = (t0, notes, v = 0.085, pan = -0.25, count = 8) => { for (let k = 0; k < count; k++) lyre(notes[k % notes.length], v * (k % 2 ? 0.8 : 1), t0 + k * E8, pan, 0.3); };
  for (const [id, v] of [['buy', 0.9], ['hold', 0.9], ['sail', 1.1]]) maqsum(C[id], v);
  lyre('E4', 0.2, C.buy); lyre('E3', 0.12, C.buy, -0.2);
  ost(C.buy, ['E3', 'B3', 'E4', 'B3']);
  lyre('D4', 0.12, C.buy + 7 * E8, 0.15); lyre('E4', 0.13, C.buy + 7.5 * E8, 0.15);
  ost(C.hold, ['C3', 'G3', 'C4', 'G3'], 0.085, -0.25, 4); ost(C.hold + 2 * B, ['D3', 'A3', 'D4', 'A3'], 0.085, -0.25, 4);
  lyre('G4', 0.13, C.hold, 0.2); lyre('A4', 0.12, C.hold + 2 * B, 0.2); lyre('B4', 0.1, C.hold + 7 * E8, 0.2);
  // sailing: the tune again, an octave of strings under it, and the reeds.
  strum(['E3', 'B3', 'E4'], 0.13, C.sail); theme(C.sail, 0.21); theme(C.sail + 0.004, 0.08, 5);
  ost(C.sail, ['E3', 'B3', 'E4', 'B3'], 0.075);
  drone(['E2', 'B2'], C.sail, C.pirates + 0.05, 0.05, 0.5, 0.05);

  // ---- pirates, then the gale. The drone slips up a half step; the drum strikes four times to each cut. ----
  drone(['F2', 'C3'], C.pirates, C.piraeus + 0.05, 0.06, 0.08, 0.05, 900);
  const strokes = [...steps(C.pirates, C.storm, 4), ...steps(C.storm, C.piraeus, 4)];
  strokes.forEach((t, k) => {
    const next = k < strokes.length - 1 ? strokes[k + 1] : C.piraeus;
    dum(t, k % 2 ? 0.6 : 1); tek((t + next) / 2, 0.8); lyre(k % 2 ? 'F3' : 'E3', 0.1, t, -0.3, 0.25);
  });
  steps(C.pirates, C.storm, 8).forEach((t, k) => lyre(k % 2 ? 'E4' : 'F4', 0.08, t, 0.3, 0.3));
  steps(C.storm, C.piraeus, 4).forEach((t, k) => lyre(['B4', 'A4', 'G4', 'F4'][k], 0.17, t, 0.1));
  hiss(160, 0.6, 0.35, C.piraeus - C.storm + 0.1, C.storm, 'lowpass', 0.3);   // the sea hits the hull

  // ---- nine voyages. A strummed chord on every cut, climbing. ----
  const ports = ['piraeus', 'syracuse', 'tyre', 'alexandria'];
  [['E3', 'B3', 'E4', 'G4'], ['G3', 'D4', 'G4', 'B4'], ['A3', 'E4', 'A4', 'C5'], ['C4', 'G4', 'C5', 'E5']].forEach((ch, i) => {
    const t = C[ports[i]], len = (i < ports.length - 1 ? C[ports[i + 1]] : C.sell) - t;
    strum(ch, 0.15, t); dum(t, 1.1); tek(t + len / 2, 0.8); ka(t + len * 0.75, 0.6);
    lyre(ch[0].replace(/\d/, d => String(+d - 1)), 0.12, t, -0.2);
  });
  drone(['E2', 'B2'], C.piraeus, C.sell + 0.05, 0.045, 0.06, 0.05);

  // ---- sell high. Coins on the beat, and the old cadence, F falling to E. ----
  maqsum(C.sell, 1);
  ost(C.sell, ['D3', 'A3', 'D4', 'A3'], 0.08, -0.25, 4); ost(C.sell + 2 * B, ['F3', 'C4', 'F4', 'C4'], 0.08, -0.25, 4);
  [['A4', 4], ['G4', 5], ['F4', 6], ['G4', 7]].forEach(([n, e]) => lyre(n, 0.16, C.sell + e * E8, 0.1));
  drone(['D2', 'A2'], C.sell, C.sell + 2 * B + 0.05, 0.04, 0.06, 0.05); drone(['F2', 'C3'], C.sell + 2 * B, C.end + 0.05, 0.05, 0.06, 0.05);
  for (let k = 0; k < 4; k++) tek(C.end - B + k * S16, 0.5 + k * 0.18);
  dum(C.end - S16, 0.7);

  // ---- the god has his head. A bell of bronze, the strings, and the tune, quietly. ----
  dum(C.end, 1.4); bell('E3', 0.24, C.end, 4.2); bell('E2', 0.12, C.end, 3.2); bell('B3', 0.08, C.end + 0.01, 3);
  strum(['B2', 'E3', 'B3', 'E4', 'B4', 'E5'], 0.15, C.end, 0.022);
  drone(['E2', 'B2'], C.end, duration, 0.05, 0.08, 0.6, 640);
  [['E4', 2], ['B4', 3], ['E5', 4], ['G4', 6], ['F4', 7], ['E4', 8]].forEach(([n, e], i) => lyre(n, i === 5 ? 0.17 : 0.13, C.end + e * E8, 0, 0.6));
  lyre('E3', 0.1, C.end + 8 * E8, -0.2);

  // ---- what happened in the shots ----
  for (const e of events) {
    if (fx[e.kind]) fx[e.kind](e.t);
    if (e.kind === 'storm') fx.splash(e.t);
  }

  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1), inter = new Float32Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { inter[2 * i] = L[i]; inter[2 * i + 1] = R[i]; }
  const bytes = new Uint8Array(inter.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function wav(float32Interleaved, channels, rate) {
  const data = Buffer.from(float32Interleaved.buffer, float32Interleaved.byteOffset, float32Interleaved.byteLength);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * 4, 28); h.writeUInt16LE(channels * 4, 32); h.writeUInt16LE(32, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv); let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(err) : reject(new Error(cmd + ' failed: ' + err.slice(-800))));
  });
}

// Render the mix, then master it: gain to -15 LUFS, with a lookahead limiter holding the drum hits under -2 dBFS.
async function renderScore(browser, { harness, events, out, duration, cues, beat }) {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('emporos-muted', '1'); } catch (e) { /* ignore */ }
    let a = 99; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  });
  await page.goto('file://' + harness);
  const b64 = await page.evaluate(compose, { events, duration, SR, cues, beat });
  await page.close();
  const bytes = Buffer.from(b64, 'base64');
  const pcm = new Float32Array(Uint8Array.from(bytes).buffer);   // a copy, so the floats start on a 4-byte boundary
  const dry = out.replace(/\.wav$/, '-raw.wav');
  fs.writeFileSync(dry, wav(pcm, 2, SR));
  const measure = async f => {
    const log = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    const sum = log.slice(log.lastIndexOf('Summary'));
    return { I: parseFloat(/I:\s+(-?[\d.]+) LUFS/.exec(sum)[1]), TP: parseFloat(/Peak:\s+(-?[\d.inf]+) dBFS/.exec(sum)[1]) };
  };
  const TARGET = -15, raw = await measure(dry);
  let gain = TARGET - raw.I, got = null;
  for (let pass = 0; pass < 4; pass++) {
    await run('ffmpeg', ['-hide_banner', '-y', '-i', dry, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=${Math.pow(10, -2 / 20).toFixed(4)}:attack=4:release=60:level=disabled,aresample=${SR}`, '-c:a', 'pcm_s24le', out]);
    got = await measure(out);
    if (Math.abs(got.I - TARGET) < 0.25) break;
    gain += TARGET - got.I;   // the limiter costs a little loudness; ask for that much more
  }
  return { raw, got, gain };
}

module.exports = { renderScore };
if (require.main === module) {   // render the score alone: node tools/trailer/score.js
  const { chromium } = require('playwright');
  const { SHOTS, CUES, BEAT, DURATION } = require('./shots');
  const WORK = path.resolve(process.env.TRAILER_WORK || path.join(__dirname, '..', '..', 'trailer-work'));
  (async () => {
    const events = SHOTS.flatMap(s => { const f = path.join(WORK, 'shots', s.id + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
    const browser = await chromium.launch();
    const r = await renderScore(browser, { harness: path.join(WORK, 'harness.html'), events, out: path.join(WORK, 'score.wav'), duration: DURATION, cues: CUES, beat: BEAT });
    await browser.close();
    console.log(`score.wav written: ${events.length} cues; mix ${r.raw.I} LUFS / ${r.raw.TP} dBTP, mastered ${r.got.I} LUFS / ${r.got.TP} dBTP (+${r.gain.toFixed(1)} dB)`);
  })().catch(e => { console.error(e); process.exit(1); });
}
