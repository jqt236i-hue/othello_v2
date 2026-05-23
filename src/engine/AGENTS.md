# src/engine/ AGENTS.md

Selfplay engine and runner code. This tree is separate from `game/` / `ui/`; use this file with the root `AGENTS.md` as the local boundary guide.

## What lives here

- `selfplay-runner.ts` is the large headless selfplay pipeline: board transforms, heuristics, trace building, pending selection, card decision recording, schema compatibility.
- `engine.ts` is the small engine entrypoint; protocol/types live in sibling `src/protocol/` and `src/types/`.

## Editing rules

- Keep this path headless. Do not add DOM, UI, sound, or browser-global dependencies.
- Preserve output schema compatibility (`selfplay.v1` / `selfplay.v2` paths) unless the training pipeline and tests are updated in the same change.
- Be careful with pending selection recording: gameplay state, card state, and trace records must stay aligned.
- Prefer shared helpers from `shared/` or `game/logic/` over duplicating board/player/card normalization.

## Related operational paths

- Training orchestration starts in `scripts/run-selfplay-training-cycle.ts` and `scripts/run-selfplay-training-profile.ts`.
- Python model training lives under `ai/train/` and is documented in `ai/train/README.md`.
- Model/profile contracts are in `docs/architecture-contracts.md` §5.2.

## Verification

- Focused tests usually use `test/selfplay.*.test.*` and `test/src.*` / engine-related names.
- For training pipeline changes, run the closest selfplay/training Jest test before any long-running profile command.
- `.ts` changes still require `npm run typecheck` and `npm run build:ts`.
