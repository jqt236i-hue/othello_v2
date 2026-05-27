# PROJECT KNOWLEDGE BASE

## OVERVIEW

カードリバーシは、ブラウザ UI・headless game logic・network Worker・selfplay/CPU training を同じ repo で扱う JavaScript/TypeScript 中心のゲームです。仕様正本は `01-rulebook.md`、内部構造の正本は `docs/architecture-contracts.md`、root 実装が正本で `worker-public/` は mirror です。

## STRUCTURE

```text
othello_v2/
├── 01-rulebook.md              # ゲーム仕様・カード仕様・UI表示仕様の一次情報
├── index.html                  # main browser entry
├── entry-browser.js            # classic browser bootstrap / module loading
├── 正本/                       # detailed desired behavior notes for cards, turn flow, presentation, sound, and audit status
├── cards/                      # display catalog and card UI surfaces
├── game/                       # headless rules, turn flow, CPU runtime helpers
├── ui/                         # browser UI, playback, input, DI, network client
├── shared/                     # browser/worker/headless portable helpers and codecs
├── constants/                  # single-source constants
├── utils/                      # authority / normalization helpers shared across runtimes
├── workers/                    # Cloudflare Worker authority entry
├── scripts/                    # build, check, codegen, local server, selfplay orchestration
├── training/                    # selfplay/training scripts, Python trainers, and docs
├── test/                       # main Jest tests
├── tests/                      # Jest setup and visual-regression tooling
└── worker-public/              # generated/mirrored deploy surface; do not edit first
```

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Player-visible behavior | `01-rulebook.md` | Update before implementation when rules, cards, UI timing, or visible text change. |
| Detailed desired behavior / audit notes | `正本/*.md` | Use for card-specific behavior, turn order, animation, sound, and confidence/audit notes. Update only when a player-visible spec is changed or clarified and the existing note would become stale. |
| Hard rules / completion | `AGENTS.md` | Repo-wide must-follow constraints. |
| Architecture boundary | `docs/architecture-contracts.md` | Module contracts, authority, DI, runtime equivalence. |
| Browser boot | `index.html`, `entry-browser.js`, `ui/bootstrap.ts`, `ui/bootstrap/init-*.ts` | Load order and DI are fragile. |
| Game progression | `game/turn/*`, `game/turn-manager.ts`, `game/move-executor.ts` | Keep headless; UI bridge is explicit. |
| Card logic | `cards/catalog.json`, `game/logic/cards/*`, `game/logic/card-resolution/*`, `game/card-effects/*` | Catalog display, pure logic, card-resolution modules, and pending/UI bridge are separate layers. |
| CPU runtime | `game/cpu-decision.ts`, `game/cpu-turn-handler.ts`, `game/ai/*` | `cpu/` is compatibility/read-only; runtime policy lives under `game/`. |
| Network client | `ui/network-client.ts`, `ui/network/*` | Server snapshot is authoritative; UI reconciles/presents. |
| Network backend | `workers/match-worker.ts`, `scripts/local-match-server.ts`, `utils/match-authority.ts` | Keep Worker and local server contracts aligned. |
| Shared helpers | `shared/*`, `utils/owner-helpers.ts`, `shared-constants.ts`, `constants/*` | Avoid local copies of normalization/constants. |
| Browser integration tests | `test/e2e/*`, `tests/visual-regression/*` | `test/e2e/` is Playwright-on-Jest with local static server; `tests/` is harness/visual tooling. |
| Worker mirror | `scripts/prepare-worker-assets.ts`, `worker-public/*` | Sync via `npm run worker:prepare`; never source-edit mirror. |
| Training | `scripts/run-selfplay-*.js`, `training/scripts/run-selfplay-*.ts`, `src/engine/selfplay-runner.ts`, `training/python/*` | Root `scripts/*.js` are CLI entries/wrappers; TS orchestration lives under `training/scripts/`; Python trains model artifacts. |
| Tests | `test/*.test.ts`, `game/ai/__tests__`, `scripts/__tests__` | Main suite is `test/`; `tests/` is setup/visual tooling. |

## CODE MAP

| Symbol / file | Type | Role |
| --- | --- | --- |
| `entry-browser.js` | browser bootstrap | Large classic loader for runtime modules and compatibility globals. |
| `ui/bootstrap.ts` | DI/bootstrap module | Installs UI/game/network dependency bridges. |
| `workers/match-worker.ts` | Worker source | Canonical server-authoritative match state. |
| `workers/match-worker.mjs` | Worker shim | Thin entry over built worker output. |
| `game/logic/cards.ts` | rules hub | Central card rule registry / resolution surface. |
| `game/turn/turn_pipeline.ts` | turn pipeline | Headless turn sequence entry. |
| `ui/network/snapshot-canonical.ts` | network helper | Snapshot normalization/version inspection. |
| `utils/owner-helpers.ts` | shared utility | Canonical owner/player/layout normalization implementation. |
| `utils/match-authority.ts` | authority helper | Canonical seat token / operationId / projection / SSE helper. |
| `shared/player-encoding.ts` | shared codec | Pure black/white player codec. |
| `scripts/build-module-registry.ts` | generator | Source for `public/module-registry.js`. |

## CONVENTIONS

- Priority order: `01-rulebook.md` → `docs/architecture-contracts.md` → this file → nested `AGENTS.md` → `SKILLS.md` / local `README.ai.md`.
- Root files are source of truth; `dist/` and `worker-public/` are generated or mirrored surfaces.
- Prefer `.ts` when a `.ts`/`.js` pair exists. Adjacent `.js` is usually a dist wrapper; check `docs/typescript-migration-js-allowlist.md` before editing `.js`.
- `game/` stays headless. `ui/` consumes public APIs, events, and DI hooks only.
- `events[]` playback order and Single Visual Writer are part of the UI contract.
- Animation, effects, and sound are presentation/playback consumers. They may react to state, snapshots, and `events[]`, but must not decide gameplay results or be called directly from `game/`.
- `events[]` are presentation-time replay instructions. They must preserve playback order, but they are not stronger authority than canonical game state or network snapshots.
- UI preview, busy flags, playback locks, and animation state are settlement/presentation state, not canonical gameplay state.
- Debug behavior is gated by explicit flags such as `?debug=1`; normal play must not get debug side effects.
- `owner` / `player` / color forms are normalized at boundaries; do not mix internal representations.
- Generated catalogs and manifests come from scripts, not hand edits.

## WORK RULES

- Before editing, confirm whether the target is source of truth, generated output, or a mirror. Change root source first, then regenerate or mirror through the existing scripts.
- For rules, card behavior, UI timing, visible text, or player-facing display changes, check `01-rulebook.md` before implementation and update it when the behavior changes.
- For card behavior, turn order, animation, sound, highlight, or network-visible gameplay changes, also check the relevant `正本/` document. Update `正本/` only when the intended player-visible spec changes, is clarified, or would otherwise become stale; do not touch it for internal-only refactors, generated/mirror sync, or test-only changes.
- Keep headless layers headless: do not introduce DOM, `window`, audio, timer, or network dependencies into `game/`, `shared/`, CPU logic, or pure card logic.
- For UI changes, preserve `events[]` playback order and the Single Visual Writer contract. Add presentation through the existing UI bridge instead of creating another board writer.
- For network changes, treat Worker/local-server snapshots and authority helpers as canonical. Client runtime, preview, and reconciliation state must not become authority.
- Pending selection network publish must stay behind the UI/network signal bridge. Do not make `game/card-effects/selection-flow.ts` discover or publish through a root `NetworkMatchClient` global.
- Do not let Worker, local server, browser, and headless behavior drift through parallel implementations. Prefer shared contracts, codecs, and authority helpers, and keep runtime-specific differences at the boundary layer.
- Use existing helpers for owner/player/color normalization, card target/cost checks, constants, Lv6 decision-mode parsing, and training profile handling. Do not add local duplicate parsing.
- Make failures diagnosable. Avoid broad `catch`, silent return, or success-shaped fallback unless the caller has an explicit, tested recovery path.
- Choose verification by blast radius. Prefer focused tests/preflights first; use `npm run test:network:parity` for network contracts and `npm run worker:prepare` for root-to-worker mirror impact.
- Do not run long selfplay or training jobs unless explicitly requested. Use a focused preflight or small sample before any expensive run.

## COMMIT POLICY

- When an implementation, fix, documentation update, or verification pass reaches a coherent stopping point, the agent may create a commit without waiting for an explicit user prompt.
- Before committing, inspect `git status` and the relevant diff, and stage only files changed for the current task.
- Do not include unrelated user changes, generated artifacts, mirror files, deleted assets, or work-in-progress changes unless they are required for the current task and were intentionally produced as part of it.
- Keep commit messages short and concrete, in Japanese or English, so the completed work unit is clear from `git log`.
- If tests or checks were run, report the commands and results in the final response.
- If the change set is large, mixes unrelated edits, requires a product/rules decision, or cannot be separated safely, ask the user before committing.

## ANTI-PATTERNS (THIS PROJECT)

- Treating client-authored state, `snapshot-runtime.ts`, or preview state as authority.
- Adding DOM/window/sound/timer dependencies to `game/`, `shared/`, CPU logic, or card logic.
- Creating a second board DOM writer during playback or reordering `events[]`.
- Editing `worker-public/`, `dist/`, generated catalog files, or `public/module-registry.js` as source.
- Hiding failures with broad catch, silent return, or success-shaped fallback.
- Duplicating constants, Lv6 decision-mode parsing, owner/player normalization, or card target/cost checks.
- Running long selfplay/training jobs when a focused preflight or test is enough.

## COMMANDS

```powershell
npm run typecheck
npm run build:ts
npm run checkall
npm run test:jest
npm run test:network:parity
npm run test:visual
npm run match:check
npm run worker:prepare
```

## NOTES

- `npm test` runs `pretest` → `npm run checkall` before Jest.
- Network parity has an explicit package script; prefer it over ad-hoc broad runs for publish/snapshot/reconnect changes.
- Docs-only changes still need role-overlap, reference, frontmatter / `applyTo`, and file-existence checks.
- After root model deployment or any root-to-worker mirror impact, run `npm run worker:prepare`.
- User-facing reports should use Japanese display names from the screen or `01-rulebook.md` first; code IDs are secondary.
