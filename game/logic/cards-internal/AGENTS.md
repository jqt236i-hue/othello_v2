# game/logic/cards-internal/ AGENTS.md

Shared internal state/timing/pending helpers for canonical card logic. Read `../AGENTS.md` and `../../AGENTS.md` first.

## WHERE TO LOOK

| Task | Start here | Notes |
| --- | --- | --- |
| Pending selection contracts | `pending-state-manager.ts`, `selector-orchestrator.ts` | Canonical pending-type contract and target-selection internals. |
| Hand / copy / usability state | `hand-manager.ts`, `card-usage-prechecks.ts` | Hand invariants and card-usage validation. |
| Timing / placement sequencing | `effect-timing.ts`, `charge-ledger.ts` | Sequencing-sensitive shared internals. |
| Shared mutable state construction | `state-factory.ts` | Canonical card-state creation/copy path. |
| Random / presentation / module lookup | `random-source.ts`, `presentation-helpers.ts`, `module-resolver.ts` | Shared side-channel helpers; avoid caller-local clones. |

## CONVENTIONS

- This directory owns shared internals, not public UI-facing APIs.
- Keep invariants centralized: pending state, hand visibility/copies, charge accounting, and effect timing should not be reconstructed in callers.
- Prefer pure helper shapes or explicit deps objects over implicit globals.
- If a change alters pending contract shape, audit `game/card-effects/*`, `game/turn/*`, and network publish/replay tests together.

## ANTI-PATTERNS

- Copying pending/hand/timing logic into individual effects.
- Smuggling UI/presentation decisions into state factories or validators.
- Adding hidden global fallbacks where a deps/helper path already exists.
- Changing shared internal state shape without updating the bridge layers that consume it.

## VERIFICATION

- Focused tests usually start with `test/cards.*`, `test/game.*pending*`, `test/cpu.*`, or card-selection/network parity suites.
- TypeScript changes need `npm run typecheck` and `npm run build:ts`.
- Pending/network-adjacent changes often need `npm run test:network:parity`.
