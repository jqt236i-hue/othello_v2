# game/ai/ AGENTS.md

CPU algorithm and runtime helper layer. `game/cpu-decision.ts` and `game/cpu-turn-handler.ts` orchestrate; this directory supplies policies, search, model inference, and commentary helpers.

## Where to look

| Task | Start here | Notes |
| --- | --- | --- |
| Core move/card scoring | `cpu-policy-core.ts` | Keep browser/headless behavior aligned and reusable from orchestrators. |
| CPU level mapping | `level-system.ts`, `cpu-lv6-lookahead-profile.ts` | Shared profile / level defaults belong here or in `constants/`, not UI handlers. |
| Tree search | `mcts-core.ts`, `mcts-policy.ts`, `mcts-temperature.ts`, `mcts-two-layer.ts`, `gumbel-mcts.ts` | Preserve reproducibility; do not add hidden time/random dependencies. |
| Endgame exact play | `endgame-solver.ts` | Keep board/player normalization consistent with shared helpers. |
| Policy model runtime | `policy-table-runtime.ts`, `policy-onnx-runtime.ts`, `policy-onnx-runtime-v2.ts` | Runtime readers only; model artifacts under `data/` are not source. |
| CPU voice/commentary | `cpu-commentary-runtime.ts`, `fixed-commentary-engine.ts` | Commentary failure must not block turn execution. |

## Local conventions

- Adjacent `.js` / `.ts` pairs exist during migration; verify whether the caller imports the shim or TypeScript-built output.
- Prefer injected random/time/config sources for new work. If touching existing direct randomness, avoid expanding the pattern.
- Keep expensive search bounded by level/profile settings; no unbounded fallback loops.
- Training orchestration lives in root CLI wrappers under `scripts/`, TypeScript sources under `training/scripts/`, and Python trainers under `training/python/`; this directory is browser/headless runtime code.

## Anti-patterns

- Do not touch DOM, UI, sound, timers, or debug controls from `game/ai/`.
- Do not duplicate Lv6 mode parsing or ONNX fallback policy outside the shared resolver/profile path.
- Do not hardcode model output paths here when package scripts/profile resolution own deployment.
- Do not hide inference/search failures behind success-shaped fallback without a reported reason.

## Verification

- Focused tests: `test/cpu.*`, `test/game.cpu*`, `test/game.ai*`, and `game/ai/__tests__/*`.
- Runtime/model path changes: include policy-table / ONNX runtime focused tests where present.
- TypeScript changes: `npm run typecheck` and `npm run build:ts`.
- Training-pipeline adjacency: prefer `npm run selfplay:preflight` or focused `training/tests/selfplay.*`; do not start long training jobs as routine verification.
