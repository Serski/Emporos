// Plays each chapter of Othonoi with bots that follow different plans, over many seeds, and reports how the week went.
// Reads the rules straight out of the game file. No dependencies.
// Usage: node othonoi/tests/sim.js [path/to/game.html] [games per bot]
const fs = require('fs');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'src', 'game.html');
const GAMES = +process.argv[3] || 40;
const html = fs.readFileSync(file, 'utf8');
const code = html.split('// ===== ENGINE START =====')[1].split('// ===== ENGINE END =====')[0];
const E = new Function(code + `
return { newGame, startChapter, actsHere, actView, ACT, startAct, goTo, tick, resolveEvent, EVENTS, wake, endWeek, goalsOf, summarize, tripInfo, canLift,
  PLACES, OUT, skipTour, mealNow, matTotal, soundsN, swimsN, keepsN, unlockedList, LAST_DAY };`)();

const { BOTS, CHOICE, decide } = require('./bot.js').makeBot(E);

function play(ch, bot, seed, skip) {
  const s = E.newGame(seed); E.startChapter(s, ch); s.bot = bot;
  if (skip) E.skipTour(s);
  let guard = 0, idle = 0;
  const problems = [];
  while (s.phase !== 'summary' && guard++ < 20000) {
    if (!(s.energy >= 0 && s.energy <= 100) || !(s.eur >= 0) || !Number.isFinite(s.clock)) { problems.push(`bad numbers: energy ${s.energy} eur ${s.eur} clock ${s.clock}`); break; }
    if (s.pending) { const ev = E.EVENTS[s.pending], cs = ev.choices(s); const want = CHOICE[s.pending], c = cs.find(x => x.id === want) || cs[0]; if (!c) { problems.push('event with no choices: ' + s.pending); break; } E.resolveEvent(s, c.id); continue; }
    if (s.phase === 'night') { E.wake(s); continue; }
    if (s.phase === 'finale') { E.endWeek(s); break; }
    if (s.busy || s.travel) { E.tick(s, 0.6); continue; }
    if (decide(s)) { idle = 0; continue; }
    if (++idle > 3) { problems.push(`stuck: day ${s.day} ${s.clock.toFixed(2)} at ${s.place}, energy ${Math.round(s.energy)}: ` + E.actsHere(s).map(a => a.id + (a.why ? '(' + a.why.slice(0, 24) + ')' : '')).join(', ')); break; }
  }
  if (s.phase !== 'summary') problems.push('did not finish: phase ' + s.phase + ' day ' + s.day);
  E.OUT.length = 0;
  return { s, problems };
}

let failures = 0;
for (const ch of ['inst', 'song', 'beach']) {
  for (const bot of BOTS[ch]) {
    const res = [], ratings = {}, probs = [];
    for (let g = 0; g < GAMES; g++) {
      const { s, problems } = play(ch, bot, 1000 + g * 7919, g % 4 === 3);
      if (problems.length) probs.push(...problems.slice(0, 1));
      if (!s.summary) continue;
      res.push(s);
      ratings[s.summary.rating] = (ratings[s.summary.rating] || 0) + 1;
    }
    const avg = f => res.length ? (res.reduce((a, s) => a + f(s), 0) / res.length) : 0;
    const goals = res.length ? E.goalsOf(res[0]).map((g, i) => Math.round(100 * res.filter(s => E.goalsOf(s)[i].done).length / res.length) + '%') : [];
    console.log(`${ch.padEnd(5)} ${bot.name.padEnd(9)} finished ${res.length}/${GAMES}  score ${avg(s => s.summary.score).toFixed(1)}  money ${avg(s => s.eur).toFixed(0)}€  km ${avg(s => s.km).toFixed(1)}  ideas ${avg(s => s.ideas).toFixed(0)}  stories ${avg(s => s.facts.length).toFixed(1)}`);
    console.log(`      goals done: ${goals.join(' ')}`);
    console.log(`      ratings: ${Object.entries(ratings).map(([k, v]) => v + '× ' + k).join('; ')}`);
    if (probs.length) { failures += probs.length; console.log('      PROBLEMS (' + probs.length + '): ' + [...new Set(probs)].slice(0, 3).join(' | ')); }
  }
}
if (failures) { console.log(`\n${failures} games had problems.`); process.exit(1); }
console.log('\nAll games finished cleanly.');
