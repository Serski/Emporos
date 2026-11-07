// The bots that play Othonoi, shared by tests/sim.js (which runs the rules on their own) and tests/play.js (which clicks the real buttons).
// makeBot(E) takes the engine's functions and returns decide(s), which picks one thing to do and does it through E.startAct or E.goTo.
function makeBot(E) {
  // What each bot wants, in order. [place, act] pairs; the bot goes to the first one it can do, and does it.
  const WANTS = {
    inst: s => {
      const w = [];
      if (!s.site) w.push([s.bot.site, 'site']);
      if (s.mat.net < 4) w.push(['ammos', 'nets']);
      if (s.mat.wood < 8) w.push(['xylo', 'wood']);
      if (s.mat.stone < 6) w.push(['xylo', 'stones']);
      if (s.mat.tile < 3 && s.bot.tiles) w.push(['chorio', 'tiles']);
      if (!s.seen.y1537) w.push(['stavros', 'cross']);
      if (!s.seen.light && s.bot.explore) w.push(['kastri', 'ruins']);
      if (!s.theme && E.unlockedList(s).length) w.push(['kalogerou', 'theme']);
      if (s.site && s.built < 3) w.push([s.site, 'build']);
      const stay = (!s.site && s.bot.site === 'aspri') || (s.site === 'aspri' && s.built < 3) || s.mat.stone < 6;
      if (s.place === 'aspri' && (!stay || s.clock > 16)) w.unshift(['aspri', 'boat_back']);
      if (s.ideas < 16) w.push(['kalogerou', 'sketch'], ['kalogerou', 'veranda'], ['imerovigli', 'view']);
      w.push(['fyki', 'snorkel'], ['xylo', 'swim_xylo'], ['kalogerou', 'sketch']);
      return w;
    },
    song: s => {
      const w = [];
      if (!s.snd.goats) w.push(['dafni', 'rec_goats']);
      if (!s.snd.cicadas) w.push(['kalogerou', 'rec_cicadas']);
      if (!s.snd.waves) w.push(['xylo', 'rec_waves']);
      if (!s.snd.wind && s.bot.explore) w.push(['kastri', 'rec_wind']);
      if (!s.snd.harbour) w.push(['ammos', 'rec_harbour']);
      if (!s.snd.owl) w.push(['kalogerou', 'rec_owl']);
      if (!s.snd.bell && s.day === E.LAST_DAY) w.push(['chorio', 'rec_bell']);
      if (!s.seen.y1537) w.push(['stavros', 'cross']);
      if (!s.seen.sara && s.bot.explore) w.push(['fyki', 'snorkel']);
      if (s.verses.length < E.unlockedList(s).length && s.verses.length < 4) w.push(['kalogerou', 'verse']);
      if (s.melody < 3) w.push(['kalogerou', 'compose']);
      if (s.rehearsed < 2) w.push(['kalogerou', 'rehearse']);
      if (s.ideas < 20) w.push(['kalogerou', 'veranda'], ['imerovigli', 'view'], ['chorio', 'lanes']);
      w.push(['xylo', 'swim_xylo'], ['kalogerou', 'veranda']);
      return w;
    },
    beach: s => {
      const w = [];
      if (s.place === 'aspri') { if (!s.swim.cave) w.push(['aspri', 'to_cave']); if (!s.swim.aspri) w.push(['aspri', 'swim_aspri']); if (!s.keep.sand) w.push(['aspri', 'jar']); w.push(['aspri', 'boat_back']); }
      if (s.place === 'cave') { if (!s.swim.cave) w.push(['cave', 'deep']); w.push(['cave', 'back_aspri']); }
      if (!s.swim.cave || !s.swim.aspri) w.push(['ammos', 'boat_aspri']);
      if (!s.swim.ammos) w.push(['ammos', 'swim_ammos']);
      if (!s.swim.xylo) w.push(['xylo', 'swim_xylo']);
      if (!s.swim.fyki && s.bot.explore) w.push(['fyki', 'snorkel']);
      if (!s.swim.kamini && s.bot.explore) w.push(['kastri', 'swim_kamini']);
      if (!s.naps) w.push(['kalogerou', 'nap']);
      if (!s.sunsets) w.push(['xylo', 'sunset']);
      if (!s.keep.pebble) w.push(['xylo', 'pebble']);
      if (!s.beachNight && s.day >= s.bot.beachNight) w.push(['xylo', 'beachsleep']);
      if (!s.gift && s.day >= 5) w.push(['kalogerou', 'gift']);
      w.push(['xylo', 'sunbathe'], ['kalogerou', 'nothing'], ['kalogerou', 'nap']);
      return w;
    },
  };
  const BOTS = {
    inst: [{ name: 'summit', site: 'imerovigli', tiles: true, explore: true, eatOut: true }, { name: 'grove', site: 'kalogerou', tiles: false, explore: false, eatOut: false }, { name: 'beach', site: 'aspri', tiles: true, explore: true, eatOut: true }, { name: 'cape', site: 'kastri', tiles: false, explore: true, eatOut: false }],
    song: [{ name: 'thorough', explore: true, eatOut: true }, { name: 'homebody', explore: false, eatOut: false }],
    beach: [{ name: 'lazy', explore: true, eatOut: true, beachNight: 3 }, { name: 'lazier', explore: false, eatOut: true, beachNight: 5 }],
  };
  const CHOICE = { newspaper: 'make', checkin: 'help', maistro: 'tie', party: 'play', missedboat: 'call' };

  function can(s, id) { const v = E.actView(s, E.ACT[id]); return v.show && !v.why; }
  function decide(s) {
    const here = s.place, B = s.bot;
    const doAct = id => E.startAct(s, id).ok;
    const go = to => { if (to === here) return false; const mode = E.canLift(s) && E.tripInfo(s, to, 'car').ok && E.tripInfo(s, to, 'car').hours < E.tripInfo(s, to, 'walk').hours - 0.2 ? 'car' : 'walk'; return E.goTo(s, to, mode).ok; };
    // the first day: go with Dionysis
    const tourAct = E.actsHere(s).find(a => a.primary && !a.why && E.ACT[a.id].tour != null);
    if (tourAct) return doAct(tourAct.id);
    if (s.day === E.LAST_DAY && s.clock >= 15.5) { if (can(s, 'wait_studio')) return doAct('wait_studio'); }
    // the end of the day
    if (s.clock >= 21 && s.day < E.LAST_DAY) {
      if (s.ch === 'beach' && !s.beachNight && s.day >= B.beachNight && (here === 'xylo' || here === 'aspri') && can(s, 'beachsleep')) return doAct('beachsleep');
      if (here === 'kalogerou' && can(s, 'sleep')) return doAct('sleep');
      if (s.ch === 'beach' && !s.beachNight && s.day >= B.beachNight && here !== 'xylo' && !E.PLACES[here].boat) return go('xylo');
      if (E.PLACES[here].boat) { if (can(s, 'beachsleep')) return doAct('beachsleep'); if (can(s, 'back_aspri')) return doAct('back_aspri'); }
      if (here !== 'kalogerou') return go('kalogerou');
    }
    // eating
    const m = E.mealNow(s.clock);
    if (m && !s.ate[m] && !(m === 'dinner' && s.ch === 'beach' && !s.sunsets && s.clock < 20.6)) {   // in the beach chapter, the sunset first, then dinner
      if (s.ch === 'beach' && s.meals < 3 && here !== 'ammos' && !E.PLACES[here].boat) { const trip = E.tripInfo(s, 'ammos', 'walk'); if (trip.ok && s.clock + trip.hours < (m === 'lunch' ? 16.5 : 23)) return go('ammos'); }
      if (here === 'ammos' && s.eur >= 15 && (B.eatOut || s.ch === 'beach') && can(s, 'taverna')) return doAct('taverna');
      if (here === 'kalogerou' && can(s, 'cook')) return doAct('cook');
      if (s.food && can(s, 'picnic')) return doAct('picnic');
      if (here === 'ammos' && s.food < 3 && can(s, 'groceries')) return doAct('groceries');
      if (here === 'ammos' && s.eur >= 15 && can(s, 'taverna')) return doAct('taverna');
      if (!E.PLACES[here].boat && s.clock < (m === 'lunch' ? 15.5 : 22.5)) { if (s.food && here !== 'kalogerou') return go('kalogerou'); if (!s.food && here !== 'ammos') return go('ammos'); }
    }
    if (here === 'ammos' && s.food < 2 && s.eur > 30 && can(s, 'groceries')) return doAct('groceries');
    if (here === 'ammos' && !s.hat && s.eur > 40 && can(s, 'hat')) return doAct('hat');
    if (s.energy < 25) {
      for (const id of ['nap', 'coffee', 'nothing', 'veranda']) if (can(s, id)) return doAct(id);
    }
    for (const [place, id] of WANTS[s.ch](s)) {
      if (place === here) { if (can(s, id)) return doAct(id); continue; }
      if (E.PLACES[place].boat) {   // the white beach and the cave: by boat from Ammos, in the morning
        if (E.PLACES[here].boat) continue;
        if (here === 'ammos') { if (can(s, 'boat_aspri')) return doAct('boat_aspri'); continue; }
        if (s.clock < 11.5 && go('ammos')) return true;
        continue;
      }
      const s2 = Object.assign({}, s, { place, busy: null, travel: null });
      const v = E.actView(s2, E.ACT[id]);
      if (!v.show) continue;
      if (v.why && !/too tired|There isn’t time|ideas/.test(v.why)) {
        // a time window: go if it will be open by the time we get there
        const trip = E.tripInfo(s, place, 'walk'); if (!trip.ok) continue;
        const s3 = Object.assign({}, s2, { clock: s.clock + trip.hours }); const v3 = E.actView(s3, E.ACT[id]);
        if (v3.why) continue;
      }
      if (go(place)) return true;
    }
    // nothing wanted here: pass the time usefully
    for (const id of ['veranda', 'view', 'lanes', 'nothing', 'swim_xylo', 'swim_ammos', 'coffee', 'cross', 'dafni_path']) if (can(s, id)) return doAct(id);
    if (here !== 'kalogerou' && !E.PLACES[here].boat) return go('kalogerou');
    if (E.PLACES[here].boat) for (const id of ['boat_back', 'back_aspri', 'swim_aspri', 'echo']) if (can(s, id)) return doAct(id);
    return false;
  }
  return { WANTS, BOTS, CHOICE, decide, can };
}
module.exports = { makeBot };
