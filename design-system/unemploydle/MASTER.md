# Unemploydle — The Puzzle Club Table

A friendly daily ritual: choose your people, choose a puzzle, bring the day's scores together.

## Guidance actually used

Read `.agents/skills/ui-ux-pro-max/SKILL.md` and ran its local searches:

- `social puzzle games playful --design-system --variance 8 --motion 4 --density 4`: marketing pattern is not applicable to a working puzzle clubhouse.
- One narrower retry, `casual gaming platform --design-system --variance 7 --motion 4 --density 4`: matched gaming, but the esports typography/dark palette and conversion-page composition are not appropriate for this audience. No unverified generated system was persisted.
- Verified `claymorphism --domain style`: low-cost, soft 3D, tactile pieces, rounded shapes, subtle inner/outer shadows, suitable for casual games. Apply to game pieces, not to every surface.
- Verified `playful editorial --domain typography`: Fredoka + Nunito, playful/friendly gaming and entertainment pairing.
- Verified `social community --domain color`: community purple (#7C3AED), lavender (#A78BFA), pale background (#FAF5FF), dark readable foreground. This was the initial exploration; the user-directed Electric Club revision below supersedes that palette.
- Verified `cancellable state transitions --domain ux`: replace motion immediately, set state synchronously, handle cancellation, never block input.
- `responsive keyboard focus --stack html-tailwind`: semantic HTML, consistent breakpoints, focus-visible. The application uses plain CSS, so no Tailwind dependency is introduced.

## Tokens — Electric Club revision

The user requested more vibrant colors and a race attached to today's scores. Use electric blue, vivid teal, coral, violet, magenta, and citrus on a clean, cool canvas. Retain readable dark variants for small white labels. These supersede the previous Ink & Citrus palette.

| Purpose | Value |
| --- | --- |
| Canvas | #F1F4FC |
| Surface | #FFFFFF |
| Ink | #172B45 |
| Secondary ink | #52617A |
| Primary/action | #1652CC |
| On primary | #FFFFFF |
| Primary soft | #E5EDFF |
| Selection / citrus | #DCF139 |
| On selection | #283D21 |
| Maya | #006E59 |
| Aheli | #1B52D9 |
| Sam | #BF3F22 |
| Jordan | #7B33BE |
| Riley | #B62C6A |
| Nina | #006F94 |
| Leo | #B13C56 |
| Coral decoration | #EF512E |
| Bright yellow cover | #FFD12F |

Friend colors are keyed by name across groups, score pieces, rankings, and activity. Decorative game covers can use brighter variants. Small text still needs contrast: #071C2F on the coral date tile; white on deep friend colors; dark ink on citrus leader badges. Hover must preserve contrast.

Primitive colors feed semantic tokens, which feed component tokens. CSS `:root` is the implementation source. Body font Nunito 400/600/700/800, display Fredoka 500/600. Body 16px/1.5; labels 12–14px. Numeric values use tabular figures. Spacing 4, 8, 12, 16, 24, 32, 48. Surface radius 24px; pieces 16px; buttons 12px or pills. Use one soft piece-shadow recipe and one restrained surface shadow.

## Composition

- Compact masthead and daily heading/date. No promotional hero or quotations.
- Desktop: 224px group rail; flexible play area. Daily game tray above the communal board. Progressive stats below.
- Tablet: two-column game tray. Mobile: horizontal group controls, two-column game tray, board below; no page overflow.
- Default puzzle-board mode makes the friends the focus. A list view remains for ranking/scanning.
- Keep the group rail, completion mosaic, board, and historical stats synchronized. Historical standings are integrated into the same shell as today’s scores, with matching first-place-day badges on every score piece. Individual histories and shared activity remain optional drill-downs.

## Behavior

- Group selection retains a shared game; otherwise selects the first game. Remember group locally.
- Immediate score updates; decorative score pieces travel in 420–470ms, stagger 36–42ms. Static real scores remain readable. Cancel prior animation on every selection.
- Native score buttons open a native dialog with labeled seven-day tiles, puzzles played, puzzles solved, and days in first. Escape and close return focus.
- Personal cheers toggle, persist per group/game/day/player, and stay synchronized across board modes. They are clearly device-local.
- Surprise choice selects another game from the current group. Never fake a live score, friend presence, or social reaction.
- Completion mosaic is actual demo plays / possible plays, never invented progress.
- Reduced motion uses immediate semantic state updates, no flight, pulse, dice roll, or confetti.

## Accessibility and review

Semantic buttons; visible keyboard focus; 44px primary targets; 24px minimum compact chart targets with visible values and accessible full dates; SVG icons from one 24px/1.8 stroke family; text accompanies status/color; readable 4.5:1 text contrast. Only one contextual live announcement for board changes; avoid rereading the board on cheers. 320/375/390/768/1024/1440 widths, landscape, zoom/reflow, rapid toggles, dialog keyboard behavior, and reduced motion are part of browser QA. Historical stats are labeled sample history.

## Avoid

No esports aesthetics, giant motivational copy, quote button, invented personal scores, autoplay, jittering table values, interactions available only on hover, tiny low-contrast metadata, or adding an animation framework for native animation needs.

## Connected first-place standings

- The race is visible directly beneath today's scores inside the same board shell. It is not a separate page or independent stats disclosure.
- First-place-day badges on Pieces and List show exactly the counts in the ranking. Mark leaders with a trophy and an explicit count. Clicking a ranking row highlights the same friend on today's board and the shared activity calendar.
- Rank by distinct dates with a group-best solved score. Tied best scores count for every tied friend, but a date counts only once per person. Use competition ranks (1, 1, 3).
- State who leads, who shares the lead, and how many more first-place days the nearest chasers need to draw level. Never fabricate a unique winner when scores tie or everyone has zero.
- Default to the selected puzzle and last seven days. Offer 28 days and explicit All group games scope. Changing games immediately updates the current-puzzle standings and badges.
- Remove solve-rate, average-score, and face-off interfaces. Player-week dialogs show plays, solves, and days in first instead of averages.
- Shared activity remains an optional in-board disclosure with aligned dates and one scroll region for longer periods.
- Preserve the group completion mosaic and sample-history labels. Calculations derive only from the existing sample records.
- Verified skill query: `ranking comparison --domain chart` recommends directly labeled descending bars for a few categories. Use native button rows with counts and catch-up gaps inside the shared board.
