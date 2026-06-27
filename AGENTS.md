# PROJECT KNOWLEDGE BASE

## OVERVIEW

カードリバーシは、ブラウザ UI・headless game logic・network Worker・selfplay/CPU training を同じ repo で扱う JavaScript/TypeScript 中心のゲームです。仕様正本は `01-rulebook.md`、内部構造の正本は `docs/architecture-contracts.md`、root 実装が正本で `worker-public/` は mirror です。

人間 (非技術ユーザー) 向けの判断軸・運用ルールは `docs/HUMAN-DEV-GUIDE.md` に分離してあります。AI エージェントはこのファイルを直接編集せず、ユーザー (= 人間) の運用判断材料としてのみ参照してください。

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
- UI preview, busy flags, playback locks, and animation state are settlement/presentation state, not canonical gameplay state.
- Debug behavior is gated by explicit flags such as `?debug=1`; normal play must not get debug side effects.
- `owner` / `player` / color forms are normalized at boundaries; do not mix internal representations.
- Generated catalogs and manifests come from scripts, not hand edits.

## AUTHORITY / PRESENTATION CONTRACT

- Game decides canonical results; UI presents those results.
- `game/`, CPU logic, pure card logic, and `shared/` may compute canonical state, validate actions, emit `events[]`, and return presentation metadata. They must not directly call browser UI, DOM, sound, animation, network clients, or global UI handlers.
- `ui/` may consume public game APIs, canonical state, snapshots, injected hooks, and `events[]` to render board state, play animation/sound, collect input, and publish network actions through UI/network bridges.
- Presentation and settlement state such as preview, animation locks, busy flags, playback locks, hover/highlight state, and sound state must not become canonical gameplay authority.
- Violations include `game/` or `shared/` discovering `NetworkMatchClient`, reading `window` / `document` / `globalThis` UI state directly, invoking UI handler names, deciding results from animation/sound/playback state, or using normal-play debug side effects as control flow.
- Valid bridges are explicit DI hooks, public game APIs, canonical snapshots, and ordered `events[]`. If a new bridge is needed, add it at the boundary layer and keep the core logic headless.
- When auditing this contract, start with `npm run check:window` and a focused search such as `rg -n "window\\.|document\\.|globalThis\\.|self\\.|NetworkMatchClient" game shared --glob "*.ts"`.

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
- Choose verification by blast radius. Prefer the smallest check that can reasonably catch regressions in the touched area; verification is required, but adding new tests is not the default outcome.
- Use this verification scale before deciding whether to add tests:

| Level | Typical changes | Appropriate verification | New test guidance |
| --- | --- | --- | --- |
| 0 | Docs, comments, typo fixes, trivial text, tiny CSS-only tweaks, reference-only updates, script-produced generated-manifest diffs | `git diff`, `git diff --check`, source inspection, targeted file/path checks | Do not add tests. |
| 1 | Localized UI display adjustments, narrow config changes, small helper edits with obvious existing coverage | Smallest relevant existing check, focused typecheck/build/preflight, or browser/manual inspection when visual | Usually do not add tests. |
| 2 | Gameplay rules, card logic, turn flow, owner/player normalization, CPU decisions, shared helpers, public APIs, confirmed regressions | Focused Jest or existing contract tests for the touched behavior | Add or update tests when focused coverage is missing or a regression should stay fixed. |
| 3 | Worker/local/browser/headless contract changes, network publish/snapshot/reconnect, authority boundaries, root-to-worker mirror impact | Contract/parity/e2e checks such as `npm run test:network:parity`; use `npm run worker:prepare` for mirror impact | Add or update tests for durable cross-runtime contracts or uncovered failure modes. |

- Level 0 generated-manifest diffs are review-only outputs from existing scripts; do not hand-edit generated or mirrored files just because their verification level is low.
- If existing focused coverage already proves the changed behavior, run that coverage instead of adding duplicate tests. If no practical automated check exists, state the manual/source inspection performed and the residual risk.
- Do not run long selfplay or training jobs unless explicitly requested. Use a focused preflight or small sample before any expensive run.

## IMPLEMENTATION QUALITY

- Before implementing, inspect the nearby source, ownership boundary, and existing helpers. Prefer the smallest design that fits the current architecture over a parallel local pattern.
- Prefer the smallest coherent change that solves the real problem without weakening architecture boundaries. Do not force a local patch when the correct fix requires a broader refactor or documented design change.
- When a direct implementation would duplicate logic, mix responsibilities, or weaken a documented boundary, expand the scope enough to fix the underlying structure instead of layering another workaround.
- Before adding a new public API, cross-runtime helper, bridge, or dependency direction, confirm that an existing shared helper, DI hook, event, snapshot contract, or authority helper cannot cover the need.
- Choose implementations that keep behavior localized, deterministic, and testable. If multiple approaches are plausible, prefer the one with the smallest future blast radius and note the reason in the final report when it matters.
- Avoid temporary workarounds, broad `catch`, silent no-op paths, and success-shaped fallbacks. If a compromise is unavoidable, document the reason, risk, and follow-up in the final report.

## GIT HYGIENE

- Start every session or task by running `git status --short` before editing.
- Do not create git branches, tags, or worktrees unless the user explicitly asks for them in the current task.
- If pre-existing changes are present, classify them before editing as related to the requested task, unrelated user/work-in-progress changes, generated or mirror output, or unknown changes that need explanation.
- Do not stage, commit, revert, delete, or overwrite pre-existing unrelated changes.
- If pre-existing changes are related to the task, inspect the relevant diff and continue from it instead of duplicating or undoing it.
- If the task cannot be completed safely because of existing changes, report the exact files involved and ask how to proceed.
- At the end of every implementation or documentation task, run `git status --short`, inspect the relevant diff, and stage only files intentionally changed for the current task.
- Never use `git add -A` unless all changed files were intentionally produced for the current task.
- Never use destructive cleanup commands such as `git reset --hard`, `git checkout --`, or deleting untracked files unless the user explicitly asks for that exact operation.
- If unrelated dirty files remain after committing the current task, report them clearly in the final response.

## PARALLEL CODEX WORK

- Codex cannot reliably know whether another Codex session is actively working in this repository.
- Treat unrelated dirty working-tree changes as possibly belonging to another active task.
- Do not start implementation work in a checkout with unrelated dirty changes unless the task is clearly isolated or the user explicitly approves.
- Do not create a separate git worktree for new implementation tasks unless the user explicitly asks for it.
- Do not run multiple Codex implementation tasks in the same physical checkout unless the user explicitly asks to do so.
- Use the root checkout for inspection, explanation, planning, and small clearly isolated edits.
- If the current checkout has unrelated dirty changes and a worktree would normally be useful, report the dirty files and ask how to proceed instead of creating one.
- `01-rulebook.md` and `正本/*.md` are shared source-of-truth documents. When the user explicitly approves parallel feature work with worktrees, update them in the main checkout first, commit the spec-only change, then bring that main update into feature worktrees before implementation continues.
- Do not let multiple worktrees independently edit `01-rulebook.md` or `正本/*.md` for the same feature. If a feature worktree discovers that a spec update is needed, pause implementation, make the documentation change on `main`, then resume from the updated spec.
- When integrating a feature worktree, prefer carrying back implementation and test changes only. Do not merge stale `01-rulebook.md` or `正本/` edits from a worktree unless they were intentionally made after syncing from the latest `main`.

## COMMIT POLICY

- When an implementation, fix, documentation update, or verification pass reaches a coherent stopping point, create a commit without waiting for an explicit user prompt.
- Treat the task as incomplete until the intended changes are either committed or a concrete blocker is reported.
- Prefer small, coherent commits over leaving completed changes uncommitted in the working tree.
- After each focused implementation or documentation unit, commit the isolated diff once verification appropriate to that unit has run.
- If a larger task naturally splits into independent steps, commit each verified step separately.
- Do not keep completed work in the working tree merely to reduce commit count.
- Commit automatically for small and medium scoped changes when the diff can be cleanly separated from unrelated work.
- Do not commit broken intermediate states unless the user explicitly asks for checkpoint commits.
- Do not commit automatically when unrelated dirty files exist and the current task's diff cannot be clearly separated.
- Do not commit automatically for investigation, review, explanation, or planning-only tasks.
- Before committing, inspect `git status` and the relevant diff, and stage only files changed for the current task.
- Do not include unrelated user changes, generated artifacts, mirror files, deleted assets, or work-in-progress changes unless they are required for the current task and were intentionally produced as part of it.
- Keep commit messages short and concrete, in Japanese or English, so the completed work unit is clear from `git log`.
- If tests or checks were run, report the commands and results in the final response.
- Verification appropriate to a unit does not automatically mean adding new tests; follow the blast-radius guidance in WORK RULES.
- If the change set is large, mixes unrelated edits, requires a product/rules decision, cannot be separated safely, or verification failed in a way that should block landing, do not commit; report the exact reason and ask how to proceed.

## ANTI-PATTERNS (THIS PROJECT)

- Treating client-authored state, `snapshot-runtime.ts`, or preview state as authority.
- Adding DOM/window/sound/timer dependencies to `game/`, `shared/`, CPU logic, or card logic.
- Creating a second board DOM writer during playback or reordering `events[]`.
- Editing `worker-public/`, `dist/`, generated catalog files, or `public/module-registry.js` as source.
- Duplicating constants, Lv6 decision-mode parsing, owner/player normalization, or card target/cost checks.

## COMMANDS

```powershell
npm run typecheck
npm run build:ts
npm run checkall
npm run test:jest
npm run test:network:parity
npm run test:visual
npm run match:check
npm run worker:prepare     # 自動: npm run worker:dev / npm run worker:deploy に && で連結済み。直接 wrangler を叩く時のみ個別実行
```

## NOTES

- `npm test` runs `pretest` → `npm run checkall` before Jest.
- Network parity has an explicit package script; prefer it over ad-hoc broad runs for publish/snapshot/reconnect changes.
- Docs-only changes still need role-overlap, reference, frontmatter / `applyTo`, and file-existence checks.
- `npm run worker:dev` / `npm run worker:deploy` は内部で `npm run worker:prepare` を走らせるため、root 変更後に手動で `worker:prepare` を呼ぶ必要はない。`npx wrangler dev` / `npx wrangler deploy` を直接叩く時のみ個別実行する。
- User-facing reports should use Japanese display names from the screen or `01-rulebook.md` first; code IDs are secondary.
