# Unemploydle

A daily puzzle clubhouse for friends. Open `index.html` in a browser; no build step is needed.

The frontend uses the existing Lunch Break and Night Owls sample scores. Groups, games, the shared Pieces/List board, personal cheers, player-week dialogs, and group history filters work locally. Cheers and the last group are saved in localStorage. Historical results are illustrative sample history, not live game integrations.

## Design

The UI UX Pro Max skill was read and its local search tools were used to select and adapt the design direction. The verified recommendations, decisions, tokens, layout, and motion rules are recorded in [the design system](design-system/unemploydle/MASTER.md).

The design combines Fredoka/Nunito typography, a clean blue-white canvas, electric blue/citrus controls, vivid teal/coral/violet game pieces, a group rail, and a shared board. First-place-day badges on the score pieces connect to a friendly race directly inside that board. It names the leaders, shared leads, and exact catch-up gaps, with 7/28-day and current-puzzle/all-game controls. Shared daily activity is an optional drill-down. Solve-rate, average-score, and face-off interfaces have been removed. Individual histories remain available from score tiles. SVG artwork and browser-native animations keep it buildless. Google Fonts have local system fallbacks.

## Previews

Open [the preview gallery](previews/index.html) for desktop/mobile screenshots and an opt-in animated walkthrough, or open `index.html` to try the actual controls.

## Browser checks

Requires Node 22+ and Chrome running with a DevTools endpoint on localhost:9234. Use a separate temporary Chrome profile for testing.

```sh
node scripts/browser-check.mjs
```

The checks cover scores, group/game switching, game retention/fallback, rapid selections, keyboard activation, local persistence, synced cheers, dialogs and focus return, stats calculations, first-place counts, tied leaders, catch-up gaps, synchronized board badges, shared calendars, reduced motion, semantic color contrast pairs, enlarged text spacing, landscape, and widths from 320 to 1440px.

To refresh the PNG states and interaction frames:

```sh
CAPTURE_PREVIEWS=1 node scripts/browser-check.mjs
```

Set `BROWSER_DEBUG_URL` to use another DevTools endpoint. Captures write final PNG previews under `previews/` and temporary animation frames under `/private/tmp/unemploydle-capture/`. Animated GIFs are presentation artifacts made from those frames; they are not loaded by the app.
