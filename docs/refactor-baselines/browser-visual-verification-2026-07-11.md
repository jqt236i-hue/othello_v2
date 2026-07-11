# Authorized browser verification — 2026-07-11

Status: passed

## Scope and initial finding

The user explicitly authorized playable-browser verification. The initial
`npm run test:visual` run failed because its baseline captured a maintenance
notice removed from the current UI, and the runner only authorized debug mode
with `?debug=1` instead of activating it. It therefore captured nondeterministic
startup UI rather than the documented visual fixture. No game source or
player-visible rule was changed to resolve this.

The visual runner now activates the fixture through the real debug controls,
waits for its 15 markers, closes the modal side panel with Escape, and captures
only then. The reviewed replacement baseline is the resulting fixed board.
`current-board.png` and `diff-board.png` are failure diagnostics, not test
inputs, and are ignored rather than tracked.

## Passing evidence

| Coverage | Command / result |
| --- | --- |
| Fixed board rendering at 1440×1024 | `npm run test:visual` passed three consecutive normal runs; each had 0 differing pixels (threshold 4,000). |
| Browser boot and reset on mirrored deploy surface | `npx tsx scripts/browser-boot-smoke.ts` passed: visible board, current labels, settings state, and reset. |
| Main modal controls at 1366×900 | `npx tsx scripts/browser-ui-control-smoke.ts` passed: debug, hand skin, gacha, leaderboard, network, and rated-match open/close; 0 page and console errors. |
| Card interaction and tablet layout | `test/e2e/card_effects.e2e.test.ts` and `test/e2e/tablet-opponent-deck-layout.e2e.test.ts` passed: 4 tests. |
| Browser network flow | `test/e2e/network-battle-complete-smoke.test.ts` passed: two clients, normal moves, reconnect, and continuation. |
| Browser network authority boundary | `test/e2e/network_special_cards.e2e.test.ts` passed: a browser client cannot inject a special-card hand into a network room. |
| Special-card authority and parity | `npm run test:network:parity` passed: 34 suites, 516 tests. |

## Conclusion

The authorized browser checks found and removed stale test-harness assumptions,
not a player-visible regression. Fixed board presentation, primary overlays,
card input, responsive deck layout, network synchronization/reconnect, and the
network special-card authority boundary all pass. This completes the visual
verification gate; the remaining program gate is the separately authorized
Git-history repair phase.
