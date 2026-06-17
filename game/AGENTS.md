# game/ AGENTS.md

Headless gameplay layer. This file is the navigation map for easy-to-miss internal splits; use it with the root `AGENTS.md`.

## Where to edit

| Task | Start here | Notes |
| --- | --- | --- |
| Turn progression / pending flow | `turn/turn_pipeline.ts`, `turn/turn_pipeline_phases.ts`, `turn/pending-coordinator.ts` | Keep `turn_pipeline.ts` headless. `pipeline_ui_adapter.ts` is the UI bridge, not the rule authority. |
| CPU move/card choice | `cpu-decision.ts`, `cpu-turn-handler.ts`, `ai/*` | `cpu-decision.ts` is the orchestrator; `ai/` holds algorithms/runtime helpers. |
| Card effect implementation | `logic/cards/<effect>.ts`, `logic/card-resolution/<effect>.ts` | Headless implementation layer. Pass dependencies via `deps`; do not add DOM/global fallbacks. |
| Pending target / card selection UI bridge | `card-effects/<effect>.ts`, `card-effects/selection-flow.ts` | This layer coordinates pending selection and network handoff; do not put pure effect rules here if `logic/cards/` owns them. |
| Card state / timing orchestration | `cards/state-manager.ts`, `cards/timing-processor.ts`, `cards/target-resolver.ts` | `cards/effects/*` are often compatibility wrappers over `logic/cards/*`. |
| Marker / special stone effects | `special-effects/*` | Known boundary-risk area: animation/playback references are legacy compatibility seams, not a pattern to copy. |

## Card effect split

```
card-effects/<name>.ts            # pending selection / UI-network bridge
cards/effects/<name>.ts           # compatibility facade; delegates only
logic/cards/<name>.ts             # canonical headless card logic (core domains)
logic/card-resolution/<name>.ts   # canonical headless card-resolution modules
```

- `game/card-effects/` and `game/cards/effects/` are different layers despite similar names.
- If behavior changes, update `01-rulebook.md` first, then catalog/presentation/CPU/tests as needed.
- When adding dependencies to `logic/cards/*`, extend the injected deps object; do not `require()` UI modules.

## Boundary traps

- Do not add new `window` / `globalThis` / DOM / sound / timer dependencies in `game/`.
- Existing `globalThis` or animation calls in `special-effects/*`, `move-executor*`, `presentation*`, or `selection-flow*` are migration debt. Isolate or remove when touching nearby code.
- `move-executor.ts` is the canonical source; `move-executor.js` is now a wrapper. Some other legacy `.js` files may still carry real code, so prefer `.ts` when it exists and state explicitly when a `.js` file still owns behavior.

## Verification

- `npm run check:window` for browser API boundary changes.
- Focused Jest usually lives under `test/game.*.test.*`, `test/cpu.*.test.*`, or card-specific names.
- `.ts` changes require `npm run typecheck` and `npm run build:ts`; root mirror paths require `npm run worker:prepare`.
