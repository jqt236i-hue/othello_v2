# Network Match Stabilization

This document is the working stabilization map for network-match-only bugs.
It does not replace `01-rulebook.md` or `docs/architecture-contracts.md`.

## Completion Target

Network mode is considered stable when the same initial snapshot and command converge to the same canonical state across headless runtime, local match server, and Worker authority, and when browser preview, projection, playback recovery, and busy settlement cannot overwrite authoritative `gameState` / `cardState`.

Transport-only differences such as seat tokens, SSE delivery, retry, reconnect, and hidden-information redaction may remain network-specific, but they must not change gameplay state or playback order.

## Failure Pattern Matrix

| pattern | representative cards | canonical state risk | projection risk | playback risk | required tests | status |
| --- | --- | --- | --- | --- | --- | --- |
| pending selection | `destroy_01`, `swap_01`, `condemn_01`, `board_shrink_god_01` | stale or unbound target publish mutates the wrong pending instance | selected hidden card or offer identity leaks | preview playback is mistaken for accepted authority playback | `test/match-runtime-parity.test.ts`, `test/workers.match-pending-effect-id.test.ts`, `test/workers.match-card-pattern-parity.test.ts` | covered |
| placement effect | `meteor_01`, `board_shrink_god_01`, `trap_01` | cell removal, marker placement, or status application diverges by runtime | hidden trap details leak to opponent | destroy / status playback loses source ordering | `test/workers.match-card-pattern-parity.test.ts`, `test/network.playback-event-assembly.contract.test.ts`, `test/utils.match-authority.public-snapshot.test.ts` | covered |
| turn-start effect | `gluttonous_will_01`, `destroy_dragon_01`, `lightning_01` | turn-start movement / destruction uses different PRNG or module path | marker ownership is projected incorrectly after movement | turn-start playback is emitted out of action order | `test/workers.match-card-pattern-parity.test.ts`, `test/network.playback-event-assembly.contract.test.ts`, `test/workers.match-turn-start-mobile-special.test.ts` | covered |
| random effect | `destroy_dragon_01`, `lightning_01`, `gluttonous_will_01` | canonical path falls back to ambient randomness | projected hashes differ for same authority state | playback targets differ between response and stream | `test/network.authority-path-hardening.test.ts`, `test/workers.match-card-pattern-parity.test.ts` | covered |
| hidden information / projection | `reveal_hand_01`, `condemn_01`, `trap_01` | public snapshot is treated as canonical hidden state | hand identity, selected card, malformed hidden token, offer list, or trap detail leaks | reveal / offer playback exposes hidden card identity | `test/utils.match-authority.public-snapshot.test.ts`, `test/workers.match-card-pattern-parity.test.ts` | covered |
| playback-only | `meteor_01`, `board_shrink_god_01`, `gluttonous_will_01` | UI fixes accidentally mutate authoritative state | none directly | busy lock, presentation queue, or Single Visual Writer gets stuck | `test/network.playback-event-assembly.contract.test.ts`, `test/ui.network-snapshot*.test.*` | covered |
| stream/publish race | normal place, pending follow-up, timeout pass | same operation is applied twice or older snapshot wins | same-version projected hash mismatch is ignored | publish response and SSE replay double-play effects | `test:network:parity`, `test/workers.match-stream-sse.test.ts`, `test/ui.network-client.*.test.ts` | covered |

## New / Changed Card Effect Checklist

- Add or update a representative network parity test for the effect pattern.
- Confirm command publish carries only serializable action data, not DOM, functions, or UI-only state.
- If the effect creates pending state, bind final target publish with `pendingEffectId`.
- If the effect uses randomness, consume authority PRNG only; do not use ambient `Math.random()` on a canonical path.
- Confirm public projection does not leak hidden opponent hand identity, selected hidden cards, trap details, or internal copy ids.
- Confirm playback events describe presentation only and do not repair canonical `gameState` / `cardState`.
- Run `npm run test:match:parity` and `npm run test:network:parity` for network-visible behavior changes.

