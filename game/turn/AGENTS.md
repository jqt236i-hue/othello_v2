# game/turn/ AGENTS.md

Turn pipeline and pending-flow boundary. Read `../AGENTS.md` and the root `AGENTS.md` first.

## WHERE TO LOOK

| Task | Start here | Notes |
| --- | --- | --- |
| Main turn sequence | `turn_pipeline.ts` | Headless orchestration entry; no UI/DOM shortcuts. |
| Phase implementation | `turn_pipeline_phases.ts` | Preserve fixed phase order and canonical state transitions. |
| Phase helpers | `turn_pipeline_phase_helpers.ts` | Shared helpers only; do not create caller-local duplicates. |
| Pending coordination | `pending-coordinator.ts` | Pending card flow is gameplay state, not UI memory. |
| UI bridge | `pipeline_ui_adapter.ts` | Adapter only; it emits/presents events but is not rule authority. |

## CONVENTIONS

- Prefer `.ts` sources; paired `.js` files are runtime/dist wrappers unless proven otherwise.
- Keep `gameState` and `cardState` mutations explicit and phase-owned.
- Player/owner normalization belongs at boundaries; reuse shared helpers instead of local variants.
- If visible turn timing, card timing, or turn-start behavior changes, update `01-rulebook.md` before code.

## ANTI-PATTERNS

- Importing `ui/` or touching DOM/window/sound/timers from this directory.
- Treating `pipeline_ui_adapter.ts` as rule authority.
- Hiding pending selection state only in presentation or network compatibility hints.
- Reordering turn phases to satisfy a local test without updating the specification and callers.
- Leaving `.ts` / `.js` runtime pairs stale after a canonical change.

## VERIFICATION

- Focused tests usually start with `test/game.*`, `test/cpu.*pending*`, `test/cards.*`, or turn/pending-specific files.
- Boundary changes need `npm run check:window`.
- TypeScript changes need `npm run typecheck` and `npm run build:ts`.
- Mirror-impacting root runtime changes finish with `npm run worker:prepare`.
