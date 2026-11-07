# Othonoi

A small pixel-art game about a week at the Kalogerou artist residency in Chorio, on Othonoi, the westernmost inhabited island in Greece. It is drawn in the style of [Emporos](../README.md) and borrows some of the logic of [Vinland 1021](https://github.com/Serski/vinland-1021): things take time, the island tells you its stories when you go to see it, and a checklist keeps the week on track.

You are an artist. You come on the morning boat from Corfu, and Dionysis, who wears glasses and explains things, meets you on the quay at Ammos and shows you the island. Then he asks what you are going to make.

## Play

Open `index.html` in a browser. It is a single file with nothing to install, and progress saves in the browser. With GitHub Pages switched on for this repository, it is at `https://serski.github.io/Emporos/othonoi/`.

## The three chapters

Each chapter is the same week, Monday to Sunday, and ends with the open studio on Sunday evening, when everyone on the island comes to see what you made. You can play them in any order.

| Chapter | What you make | What the week asks |
| --- | --- | --- |
| I · The Installation | Something out in the landscape | Choose a site (Imerovigli, Aspri Ammos, the cape at Kastri, or the olive grove at Kalogerou). Gather driftwood, stones, old net from the fishermen and broken roof tiles. Decide what it is about, from the stories you have heard. Build it over three days, and watch for the afternoon wind on Friday. |
| II · The Song | A song made of the island | Record its sounds: waves, the echo in Calypso’s cave, cicadas, the scops owl, the goat bells at Dafni, the wind at Kastri, the harbour, the taverna, and the bell of Agios Georgios on Sunday morning. Write verses from the island’s stories, find the melody, rehearse, and sing it. The game plays the song you made, with the sounds you recorded underneath. |
| III · The Beach | Honestly, nothing | Swim in four places, swim into the cave, eat at the taverna three times, have a siesta, watch the sun go down into the sea, sleep one night on a beach, and find something, anything, to leave for the collection. |

## How it plays

- **The map.** The island is drawn after its real coastline, with its villages, roads, footpaths and landmarks. Tap a place to see how long it takes to get there. Walking times are close to the real ones: the old stone path from Ammos up to Chorio takes about an hour.
- **The day.** The clock runs from eight in the morning to midnight, and only moves while you are doing something or going somewhere. Activities take time and energy, and give you ideas, materials, sounds or swims.
- **Eating.** Lunch and dinner at the taverna in Ammos, or cook at the house with food from the shop, or take a picnic. Miss a meal and everything tires you more. The money is a week’s budget, not a fortune.
- **Heat.** In the afternoons the sun costs you energy, unless you have swum recently or bought a hat.
- **Getting about.** You walk. Dionysis will give you one lift a day. Aspri Ammos and the cave can only be reached by boat from Ammos, in the morning, and the boat comes back for you until six.
- **Stories.** The first time you go to a landmark, the island tells you about it. Where a story is local tradition rather than record, the game says so. Stories become what the installation is about, or the verses of the song.
- **Dionysis.** He shows you the island on the first day, eats at the taverna on some evenings, comes to see how you are doing on Thursday, and knows a great deal.

## The island in the game

The landmarks are real: the harbour at Ammos and its school of 1912, Kalogerou (built in 1844), Chorio and the church of Agios Georgios, Imerovigli (393 m), Aspri Ammos and the cave of Calypso, the cross at Stavros, Fyki bay and the wreck of the *Sara*, Xylosermoi, Dafni, and the Kastri lighthouse (first lit in 1872, a flash every ten seconds, which the game keeps in real time at night).

Dionysis also tells you about Block 2, the stretch of sea west of Corfu where Energean, ExxonMobil and HELLENiQ Energy plan an exploratory gas well, Asopos-1, in 2027, and about the cultural associations of Othonoi and Mathraki, which have opposed it. In Chapter I it can be what the installation is about, and in Chapter II a verse.

The islanders in the game are invented, and the game is not an official product of Kalogerou.

## Project layout

- `src/game.html` is the whole game: HTML, CSS and JavaScript in one file. It is a page fragment, with no `<html>` or `<body>` tags, so it can be published as a claude.ai artifact as it is.
- `index.html` is the same game wrapped as a standalone page. It is generated, so don't edit it by hand.
- `tools/build.mjs` creates `index.html` from `src/game.html`.
- `tests/bot.js` is a bot that plays the game, with a plan for each chapter.
- `tests/sim.js` runs the bots through every chapter on the rules alone, to check that every week can be finished and nothing gets stuck. It has no dependencies.
- `tests/play.js` plays all three chapters in a phone-sized Chromium through the real buttons, with the same bot deciding what to do, and saves screenshots to `tests/shots/`. It needs Playwright.

As in Emporos, the rules inside `src/game.html` sit between `// ===== ENGINE START =====` and `// ===== ENGINE END =====` and never touch the page. All the art and sound is drawn and synthesized in code.

## Working on it

From the root of the repository. After editing `othonoi/src/game.html`, regenerate the standalone page:

```bash
node othonoi/tools/build.mjs
```

Check that every chapter can be finished (takes a few seconds):

```bash
node othonoi/tests/sim.js
```

Play all three chapters in a headless browser (takes a few minutes; needs `npm install` and `npx playwright install chromium` once):

```bash
node othonoi/tests/play.js
```

## Sources

- [Visit Corfu: Othonoi](https://visit.corfu.gr/beaches/othoni-island-fano/), for geography, harbours and paths.
- [Kalogerou](https://www.kalogerou.org/): the house, the island, the Ano Panta programme and the artist residency.
- [Ionian University, Department of Audio and Visual Arts: the art station at Othonoi](https://avarts.ionio.gr/gr/department/art-station/).
- [Othonoi.org: the lighthouse of Othoni](https://othonoi.org/en/blog/the-lighthouse-of-othoni), and the list of Greek lighthouses, for the Kastri light.
- [Golden Greece: Othonoi history](https://golden-greece.gr/en/islands/ionio/othonoi/history), for 1383, 1537 and the resettlement after Lepanto, which are local histories.
- [Archontology: the Ionian Islands, 1816–1864](https://www.archontology.org/nations/greece/ionian_islands/01_polity.php).
- On Block 2: [Offshore Technology](https://www.offshore-technology.com/news/exxonmobil-offshore-block-2-greece/), [Greek Reporter](https://greekreporter.com/2025/11/06/historic-deal-between-energean-helleniq-energy-exxonmobil-offshore-drilling-greece/), [iefimerida](https://iefimerida.gr/oikonomia/ydrogonanthrakes-ton-aprilio-i-geotrisi-sto-ionio) and [enimerosi](https://www.enimerosi.com/social/110515/oi-othonoi-kai-to-mathraki-lene-oxi-sti-geotrisi-tou-block-2) on the joint resolution of the associations of Othonoi and Mathraki.
