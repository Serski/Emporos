# Emporos

A pixel-art trading game for phones. Ariston, a young trader from Rhodes, sails out in 290 BC with a small ship, a sea loan and a crew that has to eat. *Emporos* is the Greek word for a merchant who travels by sea. It is a working title.

The plan is nine chapters, each a voyage further out from Rhodes. **Chapters I and II are playable now**: Halicarnassus in the spring, and Miletus in the summer.

## Play

Open `index.html` in a browser. It is a single file with nothing to install, and progress saves in the browser.

To put it online for free with GitHub Pages (public repositories only on the free plan): in the repository, go to **Settings → Pages**, choose **Deploy from a branch**, then pick `main` and `/ (root)`. The game appears at `https://serski.github.io/Emporos/` a minute or two later.

## Chapter I: Halicarnassus

Antimachos the banker has lent Ariston 150 drachmas on a sea loan. Bring the ship home and he owes 195. If she sinks, he owes nothing. A round trip takes six days at sea and about fifteen minutes to play.

- **The quay.** Tap a merchant, on the quay or in the picture, to buy, sell and haggle. Prices drop as you sell more of one thing, and haggling too hard makes them worse. A marker over a stall means that merchant buys something you are carrying.
- **The hold.** The ship is a grid, seen from above, with the quay beside it. Everything you take aboard needs squares: cargo, barley, water jars, the bolt-thrower, and the gear of anyone you hire. Drag to move, tap to turn, or turn mid-drag with a second finger. The bolt-thrower fits only in the bow. Fragile cargo breaks in rough water unless it touches something soft.
- **The crew.** Everyone aboard eats and drinks every day. A sack of barley or a jar of water does ten people for a day. Rowing doubles what the rowers drink. Thirsty sailors row badly and fall sick.
- **Hiring.** A Rhodian slinger in Rhodes. A Cretan archer and a doctor from Cos in Halicarnassus. Fighters shoot before pirates can board. With the doctor aboard, nobody dies of their wounds.
- **At sea.** The clock runs from dawn to dusk. Watch the wind, row when you are becalmed, cut the rations if you must, and reach the next beach before dark. Ports and night camps stop the clock.
- **Trouble.** A squall on the way out, and a pirate hemiolia on the way home. Run, pay them off with cargo, or fight.
- **Coming home.** Sell, repay the banker, and see how the season went.

## Chapter II: Miletus

Summer, 290 BC. Miletus is north, and in summer the wind blows from the north every day. Going there you row against it; coming home it is behind you. The round trip takes about eight days at sea, with stops at Kos on the way out and the way back, and about twenty minutes to play.

- **The north wind.** Headwinds most of the way out. Row the calm hours of the early morning, and reach the next beach before dark. A night anchored at sea leaves the crew exhausted, and they row badly the next day.
- **The heat.** In summer the crew drinks a third more, unless the ship has an awning.
- **Fittings.** The arsenal at Rhodes sells an oar bench, which makes rowing a quarter faster and must lie against the side of the hull; a water pithos, which holds three jars of water in two squares; and a deck awning. Fittings stay with the ship.
- **New ports.** Kos, with its wine, its cloth and the sanctuary of Asklepios. Miletus, with its wool, purple dye, carved couches, and a philosopher who will talk to anyone.
- **New hands.** A pilot from Kos, who makes the ship faster, and a Thracian swordsman in Miletus, who is worth three men and frightens pirates. Lykos the doctor is back on Kos, where he is from.
- **On the way.** Jars from a wreck, if you have room for them. A king’s warship that wants a toll: pay it, argue that Rhodes pays no king, or send the officer a jar of wine. The oracle at Didyma will answer one question about the voyage, and it is worth listening to.
- **Money.** Antimachos offers another sea loan, which you can take or refuse. His wife wants a Milesian couch, and he will pay well for one.

Between chapters, your silver, any debt, the ship and everything in her, the crew, your good name in each port, and the friends you made all carry over. Hired hands go home at the end of each voyage.

The history of the period is real and stays in the background: the siege of Rhodes and the bronze Sun-god being built with the money, the tomb of Mausolus above Halicarnassus, Coan wine made with seawater, Cretan archers and Cretan pirates, the summer north wind, the unfinished temple at Didyma, and Miletus laid out in straight streets. Ariston and his crew are invented.

## The nine voyages

| Chapter | Ship | Voyage |
| --- | --- | --- |
| I | Small coastal trader | Halicarnassus (playable) |
| II | Small coastal trader | Miletus (playable) |
| III | Small coastal trader | Athens |
| IV–VI | Medium merchant ship | Corcyra, Taras, Syracuse |
| VII–IX | Large grain ship | Cyprus, Tyre, Alexandria |

## Project layout

- `src/game.html` is the whole game: HTML, CSS and JavaScript in one file. It is a page fragment, with no `<html>` or `<body>` tags, so it can be published as a claude.ai artifact as it is.
- `index.html` is the same game wrapped as a standalone page. It is generated, so don't edit it by hand.
- `tools/build.mjs` creates `index.html` from `src/game.html`.
- `tests/sim.js` plays Chapter I, then Chapter II, with bots that follow different strategies, over many seeds, to check the money and the risks. It has no dependencies.
- `tests/play.js` plays both chapters in a phone-sized Chromium through the real buttons, and saves screenshots to `tests/shots/`. It needs Playwright.

Inside `src/game.html`, the rules sit between `// ===== ENGINE START =====` and `// ===== ENGINE END =====` and never touch the page. That is what lets `tests/sim.js` run them on their own. All the art and sound is drawn and synthesized in code.

## Working on it

After editing `src/game.html`, regenerate the standalone page:

```bash
node tools/build.mjs
```

Check the balance (takes a few seconds):

```bash
node tests/sim.js
```

Play both chapters in a headless browser (takes two or three minutes):

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm test
```
