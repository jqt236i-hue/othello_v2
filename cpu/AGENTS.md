# cpu/ AGENTS.md

Legacy/browser CPU compatibility boundary. Read `.github/instructions/cpu.instructions.md` first.

## Where to edit

| Task | Start here | Notes |
| --- | --- | --- |
| Current CPU decision path | `../game/cpu-decision.ts`, `../game/cpu-turn-handler.ts`, `../game/ai/*` | Prefer these for new decision logic. |
| Browser policy controls | `../ui/handlers/cpu-policy.ts` | UI/runtime selection only; keep logic shared. |
| Legacy compatibility | `*` | Read-only helper/compat layer. Avoid new policy forks here. |
| Shared capability defaults | `../shared/cpu-lv6-runtime-capability.js`, `../constants/cpu-lv6-shared-profile.js` | Do not duplicate decision-mode parsing. |

## Rules

- Treat `cpu/` as read-only with respect to gameplay state.
- Do not touch DOM, UI, sound, or timers from here.
- Inject randomness/time from callers to keep decisions reproducible.
- Keep browser and headless behavior aligned unless the difference is explicitly documented.

## Common traps

- Adding a new browser-only policy branch in `cpu/` instead of the `game/ai` path.
- Re-parsing Lv6 mode or ONNX fallback rules outside the shared resolver.
- Hiding expensive search with an unbounded fallback.

## Verification

- Focused CPU tests usually match `test/cpu.*`, `test/game.cpu*`, or `test/game.ai*`.
- For runtime capability changes, include browser/headless parity coverage when available.
- `.ts` changes require `npm run typecheck` and `npm run build:ts`.
