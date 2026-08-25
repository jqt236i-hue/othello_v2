# PROJECT KNOWLEDGE BASE

## OVERVIEW

カードリバーシは、ブラウザ UI・headless game logic・network Worker・selfplay/CPU training を同じ repo で扱う JavaScript/TypeScript 中心のゲームです。仕様正本は `01-rulebook.md`、内部構造の正本は `docs/architecture-contracts.md`、root 実装が正本で `worker-public/` は mirror です。

人間 (非技術ユーザー) 向けの判断軸・運用ルールは `docs/HUMAN-DEV-GUIDE.md` に分離してあります。AI エージェントはこのファイルを直接編集せず、ユーザー (= 人間) の運用判断材料としてのみ参照してください。

## MISSION / DEFINITION OF DONE

- Work as a long-term maintainer of this game. Prefer changes that keep future behavior changes localized, and do not add speculative features or abstractions for possible future use.
- A change is complete only when the requested behavior is implemented and verified through the relevant real execution path in proportion to its risk; editing code alone is not completion.
- Do not leave task-created temporary paths, unresolved TODOs, duplicate authorities, or undocumented compatibility behavior. Keep player-facing specs, stable architecture contracts, runtime data, tests, generated outputs, and mirrors synchronized where the change affects them.
- Distinguish checks that were run from checks that were not run. Report any unverified area, known limitation, or residual risk without describing it as confirmed safe.
- Before completion, inspect the final task-owned diff and `git status --short`, and confirm that no unrelated or accidental file is included.

## STRUCTURE

```text
othello_v2/
├── 01-rulebook.md              # ゲーム仕様・カード仕様・UI表示仕様の一次情報
├── index.html                  # main browser entry
├── entry-browser.js            # classic browser bootstrap / module loading
├── browser-vite/               # Vite bootstrap, optional runtime loading, and generated startup registry
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
| Browser boot | `index.html`, `entry-browser.js`, `browser-vite/main.ts`, `browser-vite/pixi-runtime-loader.ts`, `ui/bootstrap.ts`, `ui/bootstrap/init-*.ts` | Load order, optional Pixi runtime injection, and DI are fragile. |
| Board visual / PixiJS | `ui/board-visual/*`, `ui/pixi/*`, `ui/board-dom-compat/*` | `ui/board-visual/controller.ts` owns the writer. Pixi is normal; DOM is lazy, mutually exclusive compatibility fallback. |
| Game progression | `game/turn/*`, `game/turn-manager.ts`, `game/move-executor.ts` | Keep headless; UI bridge is explicit. |
| Card logic | `cards/catalog.json`, `game/logic/cards/*`, `game/logic/card-resolution/*`, `game/card-effects/*` | Catalog display, pure logic, card-resolution modules, and pending/UI bridge are separate layers. |
| CPU runtime | `game/cpu-decision.ts`, `game/cpu-turn-handler.ts`, `game/ai/*` | `cpu/` is compatibility/read-only; runtime policy lives under `game/`. |
| Network client | `ui/network-client.ts`, `ui/network/*` | Server snapshot is authoritative; UI reconciles/presents. |
| Network backend | `workers/match-worker.ts`, `scripts/local-match-server.ts`, `utils/match-authority.ts` | Keep Worker and local server contracts aligned. |
| Local play server | `scripts/serve-with-fallback.ts` | Canonical browser URL is `http://127.0.0.1:8000/` via `npm run serve`. Keep it running; see LOCAL DEV SERVER. |
| Shared helpers | `shared/*`, `utils/owner-helpers.ts`, `shared-constants.ts`, `constants/*` | Avoid local copies of normalization/constants. |
| Browser integration tests | `test/e2e/*`, `tests/visual-regression/*` | `test/e2e/` is Playwright-on-Jest with local static server; `tests/` is harness/visual tooling. |
| Worker mirror | `scripts/prepare-worker-assets.ts`, `worker-public/*` | Sync via `npm run worker:prepare`; never source-edit mirror. |
| Training | `scripts/run-selfplay-*.js`, `training/scripts/run-selfplay-*.ts`, `src/engine/selfplay-runner.ts`, `training/python/*` | Root `scripts/*.js` are CLI entries/wrappers; TS orchestration lives under `training/scripts/`; Python trains model artifacts. |
| Tests | `test/*.test.ts`, `game/ai/__tests__`, `scripts/__tests__` | Main suite is `test/`; `tests/` is setup/visual tooling. |

## CODE MAP

| Symbol / file | Type | Role |
| --- | --- | --- |
| `entry-browser.js` | browser bootstrap | Large classic loader for runtime modules and compatibility globals. |
| `browser-vite/pixi-runtime-loader.ts` | Vite runtime boundary | Loads and injects Pixi behind a catchable optional boundary so boot can select DOM compatibility on failure. |
| `ui/bootstrap.ts` | DI/bootstrap module | Installs UI/game/network dependency bridges. |
| `ui/board-visual/controller.ts` | board visual controller | Owns the Single Visual Writer claim, backend lifecycle, committed-frame application, and recovery. |
| `ui/pixi/board-backend.ts` | normal board backend | Renders the board, stones, input feedback, and board-owned playback through the single Pixi application. |
| `ui/board-dom-compat/*` | compatibility backend | Lazy fallback for explicit debug selection, Pixi/WebGL initialization failure, or unrecoverable context loss only. |
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

- Authority is scoped by topic: player-visible behavior follows `01-rulebook.md`; internal architecture follows `docs/architecture-contracts.md`; repository-wide work rules follow this file; the closest nested `AGENTS.md` or `AGENTS.override.md` adds directory-specific guidance. Read every applicable instruction file before acting. Keep shared rules at root and local rules in the closest nested file instead of duplicating them across layers. If two sources conflict within the same topic and the intended behavior is not clear, stop and ask the user.
- Root files are source of truth; `dist/` and `worker-public/` are generated or mirrored surfaces.
- Prefer `.ts` when a `.ts`/`.js` pair exists. Adjacent `.js` is usually a dist wrapper; check `docs/typescript-migration-js-allowlist.md` before editing `.js`.
- UI preview, busy flags, playback locks, and animation state are settlement/presentation state, not canonical gameplay state.
- The normal board is a Pixi canvas plus the DOM semantic accessibility layer. DOM cells/discs and `#board-expansion-layer` belong only to the selected DOM compatibility backend.
- Hand, card, HUD, text, modal, chat, fullscreen, and cross-surface presentation remain DOM-owned unless a separate approved design changes that boundary; they are not board writers.
- Debug behavior is gated by explicit flags such as `?debug=1`; normal play must not get debug side effects.
- `owner` / `player` / color forms are normalized at boundaries; do not mix internal representations.
- Generated catalogs and manifests come from scripts, not hand edits.

## WORK AUTHORIZATION

- Explanation, investigation, diagnosis, review, and planning requests authorize relevant read-only inspection and reporting, not unrequested product edits.
- Implementation, fixes, and refactors authorize in-scope local edits, focused or broad checks, typechecks, builds, local server use under LOCAL DEV SERVER, browser operation, and cleanup of temporary verification artifacts created by the current task. Do not treat the play server as a temporary artifact or stop a healthy `npm run serve` as cleanup.
- Obtain explicit user direction before irreversible data or asset deletion, operations involving secrets or billing, intentional compatibility breaks to public APIs, saved data, network contracts, asset keys, or model formats, or a material expansion beyond the requested scope.
- Commits follow this repository's `COMMIT POLICY`; do not replace it with a separate per-task approval rule.

## LOCAL DEV SERVER

Keep the local play server running across file edits and rebuilds. `ERR_CONNECTION_REFUSED` means nothing is listening; it is not a page-content failure.

Canonical local play:

- Command: `npm run serve` (`scripts/serve-with-fallback.ts`)
- URL: `http://127.0.0.1:8000/`
- Role: static root server for classic `index.html` and Vite `index.vite.html`
- Rebuilds write files in place. Do not stop this server for `npm run build:ts`, `npm run build:browser`, tests, or source edits. Reload the browser after a browser-facing rebuild.

Other local listeners are not substitutes for that play URL:

- `npm run dev` / `npm run dev:vite`: Vite delivery on 5174
- `npm run match:server`: local match authority on 8787
- `npm run worker:dev`: Wrangler Worker

Invariants:

1. Leave at most one play server for this repository. Reuse a healthy `npm run serve` on 8000 instead of starting another.
2. Do not start a play server that exits when a tool call or temporary terminal ends. Prefer an already-running persistent terminal, and leave that process running at task end.
3. If 8000 is occupied, inspect the owning PID and command line. Reuse it when it is this repository's `serve-with-fallback` / `http-server`. If it belongs to another project or is unknown, do not treat a fallback port such as 8001 as the stable play URL; report the conflict. `serve-with-fallback` may still pick the next free port for a human-started process; agents must not start a second copy that lands there.
4. Use 5174 only when Vite delivery itself must be confirmed. Do not run `npm run build:vite` while this repository is serving `vite-dist/` on 5174. Stop that Vite serve first, rebuild, then restart Vite only if still needed. Restore `npm run serve` on 8000 as the leftover play server.
5. Do not stop, replace, or bulk-kill Node processes that do not belong to this repository, including other projects on 5173.
6. Focused Jest, `test/e2e/`, and visual-regression helpers may start ephemeral servers on OS-assigned ports. Those belong to the test lifecycle and must be torn down by the test. They are not the play server; do not keep them as the leftover 8000 process and do not reuse their random ports as the canonical URL.
7. Any task that edits, fixes, or implements the playable game has the following mandatory completion gate, regardless of whether the browser was used during the task:
   - After the final game change and the relevant tests, run at least `npm run build:browser` so the local play server can serve the finished changes. Also run any more specific build or generation command required elsewhere in this file. If a game source file changes afterward, rebuild before completing the task.
   - Confirm that this repository's persistent `npm run serve` process is running on `http://127.0.0.1:8000/`. If it is stopped, start it persistently. A server that exists only while a temporary command or test is running does not count.
   - After the final build, confirm that `http://127.0.0.1:8000/` returns HTTP 200 and that port 8000 belongs to this repository's play server.
   - Leave the play server running after the final response. Do not stop it as cleanup.
   - Do not mark the task complete or send the final response until the build, reflection, and server checks above have passed. If any check cannot be completed, report the task as incomplete and explain the blocker.
   - State the successful final build and the running local play server in the completion report.

When a browser check needs a server, inspect listeners first:

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 8000, 5174, 8787 } |
  Select-Object LocalPort, OwningProcess
```

## AUTHORITY / PRESENTATION CONTRACT

- Game decides canonical results; UI presents those results.
- `game/`, CPU logic, pure card logic, and `shared/` may compute canonical state, validate actions, emit `events[]`, and return presentation metadata. They must not directly call browser UI, DOM, sound, animation, network clients, or global UI handlers.
- `ui/` may consume public game APIs, canonical state, snapshots, injected hooks, and `events[]` to render board state, play animation/sound, collect input, and publish network actions through UI/network bridges.
- Presentation and settlement state such as preview, animation locks, busy flags, playback locks, hover/highlight state, and sound state must not become canonical gameplay authority.
- Violations include `game/` or `shared/` discovering `NetworkMatchClient`, reading `window` / `document` / `globalThis` UI state directly, invoking UI handler names, deciding results from animation/sound/playback state, or using normal-play debug side effects as control flow.
- Valid bridges are explicit DI hooks, public game APIs, canonical snapshots, and ordered `events[]`. If a new bridge is needed, add it at the boundary layer and keep the core logic headless.
- All board frames, board input, and board-owned playback enter through `ui/board-visual/controller.ts` and the active `BoardVisualBackend`; do not write board pixels or settle a board phase through a parallel path.
- Pixi and DOM compatibility backends must not mount, write, or accept input concurrently. Keep at most one board writer; the active Pixi lane has exactly one application/canvas/WebGL context, while the DOM compatibility lane has none.
- A trajectory whose source and target are both board coordinates is board-owned phase work. Hand/card/HUD-to-board trajectories and fullscreen/global UI remain global DOM presentation and may only read board geometry through the public board-visual API.
- `ui/board-dom-compat/` is fallback as a whole, never a per-effect fallback for an active Pixi phase. Do not make the normal Pixi import/caller graph evaluate DOM compatibility runtime modules.
- When auditing this contract, start with `npm run check:window` and a focused search such as `rg -n "window\\.|document\\.|globalThis\\.|self\\.|NetworkMatchClient" game shared --glob "*.ts"`.

## WORK RULES

- Before editing, confirm whether the target is source of truth, generated output, or a mirror. Change root source first, then regenerate or mirror through the existing scripts.
- For rules, card behavior, UI timing, visible text, or player-facing display changes, check `01-rulebook.md` before implementation and update it when the behavior changes.
- For card behavior, turn order, animation, sound, highlight, or network-visible gameplay changes, also check the relevant `正本/` document. Update `正本/` only when the intended player-visible spec changes, is clarified, or would otherwise become stale; do not touch it for internal-only refactors, generated/mirror sync, or test-only changes.
- Keep headless layers headless: do not introduce DOM, `window`, audio, timer, or network dependencies into `game/`, `shared/`, CPU logic, or pure card logic.
- For UI changes, preserve `events[]` playback order and the Single Visual Writer contract. Add presentation through the existing UI bridge instead of creating another board writer.
- For board rendering or board-local animation changes, inspect `docs/architecture-contracts.md` section 7.3, `ui/board-visual/effect-branch-inventory.ts`, and the active backend before implementing. Extend the existing backend/timeline/resource lifecycle instead of adding a second canvas, animation clock, or settlement path.
- Normal Pixi behavior and tests must not infer board state or geometry from compatibility-only `.cell`, `.disc`, or `#board-expansion-layer` DOM. Use the render model, public board-visual geometry/diagnostics, or semantic layer appropriate to the task.
- For network changes, treat Worker/local-server snapshots and authority helpers as canonical. Client runtime, preview, and reconciliation state must not become authority.
- Pending selection network publish must stay behind the UI/network signal bridge. Do not make `game/card-effects/selection-flow.ts` discover or publish through a root `NetworkMatchClient` global.
- Do not let Worker, local server, browser, and headless behavior drift through parallel implementations. Prefer shared contracts, codecs, and authority helpers, and keep runtime-specific differences at the boundary layer.
- Use existing helpers for owner/player/color normalization, card target/cost checks, constants, Lv6 decision-mode parsing, and training profile handling. Do not add local duplicate parsing.
- ブラウザ表示に影響する root ソース変更（カード説明文、UI ラベル、タグ定義、表示テキスト、アイコン名など）では、focused test の後に `npm run build:browser` を実行し、完了報告に記載する。`npm run build:ts` だけでは `public/module-registry.js` と browser 用 bundle / cachebuster が更新されない。Do not stop `npm run serve` on 8000 to run that rebuild.
- Local browser confirmation follows LOCAL DEV SERVER. Keep `http://127.0.0.1:8000/` listening; do not start a second play server or a server that dies with a temporary terminal.
- Choose verification by blast radius. Prefer the smallest check that can reasonably catch regressions in the touched area; verification is required, but adding new tests is not the default outcome.
- Use this verification scale before deciding whether to add tests:

| Level | Typical changes | Appropriate verification | New test guidance |
| --- | --- | --- | --- |
| 0 | Docs, comments, typo fixes, trivial text, tiny CSS-only tweaks, reference-only updates, script-produced generated-manifest diffs | `git diff`, `git diff --check`, source inspection, targeted file/path checks | Do not add tests. |
| 1 | Localized UI display adjustments, narrow config changes, small helper edits with obvious existing coverage | Smallest relevant existing check, focused typecheck/build/preflight, or non-game source/visual inspection when visual | Usually do not add tests. |
| 2 | Gameplay rules, card logic, turn flow, owner/player normalization, CPU decisions, shared helpers, public APIs, confirmed regressions | Focused Jest or existing contract tests for the touched behavior | Add or update tests when focused coverage is missing or a regression should stay fixed. |
| 3 | Worker/local/browser/headless contract changes, network publish/snapshot/reconnect, authority boundaries, root-to-worker mirror impact | Contract/parity checks such as `npm run test:network:parity`; use `npm run worker:prepare` when generating or verifying the mirror without `worker:dev` / `worker:deploy`; use E2E or real game UI operation when it materially improves confidence. | Add or update tests for durable cross-runtime contracts or uncovered failure modes. |

- Level 0 generated-manifest diffs are review-only outputs from existing scripts; do not hand-edit generated or mirrored files just because their verification level is low.
- If existing focused coverage already proves the changed behavior, run that coverage instead of adding duplicate tests. If no practical automated check exists, state the manual/source inspection performed and the residual risk.
- Do not delete, skip, or weaken a failing test merely to obtain a passing result. Change test expectations only when the intended behavior has changed and the source-of-truth spec or contract is updated as needed. If a retry passes after an initial failure, report both results and the suspected reason for the instability.
- 実機ゲーム検証（ブラウザでのプレイ・操作確認、Playwright などの自動操作を含む）は、変更のリスクに応じて事前承認なしで実行できる。ユーザーが実行しないよう指定した場合はそれに従う。
- `test/e2e/*`, `npm run test:visual`, and Playwright/browser-driven game UI checks are Level 3 or visual verification tools. Run the smallest relevant scenario and report what was exercised.
- When browser-driven verification is run, record the URL, entry lane (classic or Vite), active board backend (Pixi or DOM compatibility), network mode when relevant, exercised actions/scenario, console or page errors, and the screenshot or public diagnostics used as evidence. Test only the combinations relevant to the change, but do not treat HTTP 200 or the presence of shell DOM alone as proof that gameplay is ready. HTTP 200 on `http://127.0.0.1:8000/` is still required to prove the play server is up.
- For Pixi board changes, run the smallest focused board/Pixi Jest coverage first. Add `npm run match:pixijs-board-playback-check`, `npm run match:pixi-runtime-fallback-check`, `npm run match:cross-platform-smoke:vite`, and selector/visual checks in proportion to playback, recovery, delivery, and browser risk.
- Do not run long selfplay or training jobs unless explicitly requested. Use a focused preflight or small sample before any expensive run.

## LARGE CHANGES AND PLANS

- Create or update a durable design and implementation plan in the location selected under `docs/AGENTS.md` (normally `docs/implementation/` for cross-system product work) when a change crosses multiple major subsystems or runtimes; changes a public API, network contract, saved-data or model-artifact format; requires migration or staged cutover; has enough technical uncertainty to need a prototype or milestones; or substantially reorganizes authority or dependency direction.
- Record the source of truth, non-goals, affected ownership boundaries, phases, completion criteria, verification bundle, progress, discoveries, decisions, and actual verification results. A plan must let the next executor continue without reconstructing the investigation.
- Do not force a formal plan on a small, well-understood localized change. When implementation is requested, planning does not replace implementation and verification unless the user explicitly asks for planning only.

## IMPLEMENTATION QUALITY

- Before implementing, inspect the nearby source, ownership boundary, and existing helpers. Prefer the smallest design that fits the current architecture over a parallel local pattern.
- Prefer the smallest coherent change that solves the real problem without weakening architecture boundaries. Do not force a local patch when the correct fix requires a broader refactor or documented design change.
- When a direct implementation would duplicate logic, mix responsibilities, or weaken a documented boundary, expand the scope enough to fix the underlying structure instead of layering another workaround.
- Before adding a new public API, cross-runtime helper, bridge, or dependency direction, confirm that an existing shared helper, DI hook, event, snapshot contract, or authority helper cannot cover the need.
- Before adding or upgrading an npm or Python dependency, confirm that the platform or an existing dependency cannot reasonably cover the need. Keep manifest and lock/requirements files aligned, avoid unrelated bulk upgrades, and report the reason and impact of the dependency change.
- Choose implementations that keep behavior localized, deterministic, and testable. If multiple approaches are plausible, prefer the one with the smallest future blast radius and note the reason in the final report when it matters.
- Gameplay-relevant randomness follows `docs/architecture-contracts.md` section 8.6. Do not add an implicit `Math.random()` fallback to a canonical path; use the existing injected or authority-owned random source, and keep presentation-only randomness explicitly noncanonical.
- Timers, listeners, observers, subscriptions, Workers, object URLs, and asynchronous callbacks must have an owner and a teardown or cancellation path. Reset, reconnect, backend replacement, and destruction must prevent stale callbacks from an old generation from mutating the current runtime.
- Busy, input, animation, and playback locks must have explicit terminal or recovery transitions for success, failure, cancellation, reset, reconnect, and backend replacement as applicable. A timeout or failure must not bypass authoritative visual settlement; release a lock only through its owning recovery contract.
- Do not perform broad performance work without comparable before/after evidence. In hot paths, avoid unnecessary per-frame allocation, whole-state scans, synchronous I/O, repeated scene/DOM reconstruction, and unbounded queues without trading away correctness, determinism, or maintainability.
- Avoid temporary workarounds, broad `catch`, silent no-op paths, and success-shaped fallbacks. If a compromise is unavoidable, document the reason, risk, and follow-up in the final report.

## GIT HYGIENE

- Start every session or task by running `git status --short` before editing.
- Do not create git branches, tags, or worktrees unless the user explicitly asks for them in the current task.
- If pre-existing changes are present, classify them before editing as related to the requested task, unrelated user/work-in-progress changes, generated or mirror output, or unknown changes that need explanation.
- Do not stage, commit, revert, delete, or overwrite pre-existing unrelated changes.
- Never print, expose, copy into logs or documentation, or commit secrets such as API keys, access tokens, passwords, `.env` values, or Wrangler secrets. Refer to the secret by its environment/configuration name and use the appropriate secret store when configuration is required.
- If pre-existing changes are related to the task, inspect the relevant diff and continue from it instead of duplicating or undoing it.
- If the task cannot be completed safely because of existing changes, report the exact files involved and ask how to proceed.
- At the end of every implementation or documentation task, run `git status --short` and inspect the relevant diff. Stage only task-owned files, and only when preparing an intended commit.
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

- When a requested implementation, fix, or documentation update produces a verified task-owned diff at a coherent stopping point, create a commit without waiting for an explicit user prompt.
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
- Creating a second board writer, Pixi application/canvas/WebGL context, animation clock, or backend-specific settlement path; mounting Pixi and DOM compatibility together; or reordering `events[]`.
- Using `ui/board-dom-compat/` as a normal-path implementation or making default Pixi behavior depend on compatibility-only board DOM selectors.
- Stopping or replacing `npm run serve` on 8000 to rebuild browser assets, starting a second play server on a fallback port, or launching the play server in a disposable tool terminal.
- Editing `worker-public/`, `dist/`, generated catalog files, or `public/module-registry.js` as source.
- Duplicating constants, Lv6 decision-mode parsing, owner/player normalization, or card target/cost checks.

## COMMANDS

```powershell
npm run typecheck
npm run build:ts
npm run checkall
npm run build:browser    # public/module-registry.js と index.html のキャッシュバスターを再生成。Worker 経路の worker:prepare のような自動連結はないので、ブラウザ表示に影響する root ソース変更後はテスト通過後に手動で実行する。Do not stop npm run serve to run this.
npm run serve            # local static play server on 8000; keep running across edits
npm run build:vite
npm run test:jest
npm run test:network:parity
npm run test:visual       # Visual / browser verification; run the smallest relevant scenario
npm run match:pixijs-board-playback-check
npm run match:pixi-runtime-fallback-check
npm run match:cross-platform-smoke:vite
npm run check:board-test-selectors
npm run match:check
npm run worker:prepare    # Standalone mirror generation/verification, or before direct npx wrangler use
```

## NOTES

- `npm test` runs `pretest` → `npm run checkall` before Jest.
- Network parity has an explicit package script; prefer it over ad-hoc broad runs for publish/snapshot/reconnect changes.
- Docs-only changes require `git diff --check`, reference and file-existence checks, and inspection of the rendered Markdown when layout matters. Validate frontmatter or `applyTo` only for document types that actually use those fields.
- `npm run worker:dev` / `npm run worker:deploy` already run `worker:prepare`; do not run it a second time immediately beforehand. Run `worker:prepare` by itself when the task is mirror generation/verification or before invoking `npx wrangler dev` / `npx wrangler deploy` directly.
- User-facing reports should use Japanese display names from the screen or `01-rulebook.md` first; code IDs are secondary.
- When a user decision is required, end the report with a short recommendation in plain language, explain choices by their player-visible effect, and keep the number of choices to the minimum needed.
