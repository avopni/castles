# Cascading Castles

A playable, browser-only adaptation of a published woodland movement game, using the approved Market & Orchard board and original medieval Otter, Badger, Rat and Rabbit artwork.

Install Node.js 22.12 or later, then run:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4186/** to play. Run `npm run build` to create the static site in `dist/`.

The game includes a walkthrough of thirteen implemented screens: setup, table, card/target choices, confirmation, capture, six-unit roofs, arrivals, dice, spells, rescue, private handoff, ten-high stacks and victory.

## Playing

Choose human or bot seats, then begin. Play a card, select a piece or turret level, and confirm its destination. Dice cards offer rerolls before target selection. Dual cards offer either traveller or turret movement.

Click a clearing or castle, or use the header's space selector, to inspect its exposed roof and selectable levels. Six animals use fixed slots, with larger painted figures available for inspection. Click the keep's Home badge for completed animals; the keep has no six-animal limit.

The active player's exposed animals pulse in their house colour. Open Houses and click another player to highlight their exposed animals too. Peek is an optional shared-screen aid: it shows every on-board animal, including buried ones, with layer details in the inspector. Switching it off removes those details; it also resets on turn changes. It does not change rules or bot knowledge.

Houses and spells slide over the board. Spell targets and costs are shown when needed. A rescue spends its potion before revealing eligible choices. Refresh discards the whole hand and replaces both card actions with a turret move. A final spell window appears only when a usable spell remains.

Settings includes autosave, JSON export/import, reduced motion, bot pace, private handoff, partner exchange and a new gathering. Every action is saved before animation, so reloading resumes at its resolved checkpoint. Pausing stops further actions while an already committed animation settles.

Solo/cooperation use twelve shared travellers and one card per turn, with zero or three spells. Partnerships use opposite-seat pairs and card/potion exchanges. Interrupts provide before/during/after priority windows. Bots use legal moves and remembered public observations, and pass interrupt priority.

## Presentation

Sixteen measured landing areas follow the approved painting's winding closed route. Turrets, bases, shadows and stacking are Three.js geometry. Animals are original transparent painted figures on 3D bases. They hop along the route and ride their supporting turrets; entry precedes keep relocation.

The board fills the screen below the header. Its continuous loop leaves a meadow for the floating bottom-right hand, which can collapse. All 23 movement faces, eight spells and the raven reverse have finished artwork. Dice tumble in 3D and settle on the saved result before acceptance or another reroll is enabled.

The camera angle adapts to tall stacks and the canvas aspect; overlays never resize the board. Animal planes stay within the six-slot footprint at every camera angle. Without WebGL, the painted board, accessible cells and action controls remain usable. Four distinct houses are the normal focus; five/six-seat configurations reuse artwork with distinct seat names. Landscape sizes down to 740 × 600 have been checked.

## Development

Node.js 22.12 or later:

```sh
npm ci
npm test
npm run build
npm run dev
npm run test:playable
npm run test:flow
npm run test:fullscreen
```

43 automated tests passed. 54 playable browser checks include five landscape sizes, actual six-unit geometry, all eight spells, dice, capture, entry, private handoff, partnerships, ten-high stacks and complete two/four-player bot games. Additional checks cover human turns, file export/import, interrupt timing, repository-prefix hosting and the WebGL fallback. The production build passed.

Browser scripts use installed Chrome. Set CHROME_PATH and CASTLES_ORIGIN for another installation/server. `npm run test:flow` also expects a preview at `http://127.0.0.1:4188/castles/`; run Vite preview with `--port 4188 --base /castles/` for that check.

## Architecture

The independent immutable rules, exact ninety-card manifest, variants, bots and replay are in src/engine. Game.tsx and session.ts control live play and persistence. GameBoard.tsx, sceneLayout.ts and surfaceLayout.ts align the painting, render 3D pieces, animate and preserve six-slot geometry.

See [rules](docs/rules.md), [sources](docs/sources.md), [physics](docs/physics.md) and [attribution](docs/attribution.md). All eight base spells and printed variants are included. Expansions and promotional spells remain outside the base-game scope.

## GitHub Pages

The production build is static, with relative asset paths verified under /castles/. The GitHub Actions workflow tests, builds and publishes dist after a push to main.

The GitHub Actions workflow builds and publishes `dist/` to GitHub Pages after a push to `main`.

React and Three.js are MIT licensed. The artwork and implementation are original to this personal project.
