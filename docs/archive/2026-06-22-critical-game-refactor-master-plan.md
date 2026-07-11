# Critical Game Refactor Master Plan Implementation Plan

This plan is intended for an agentic worker to execute in order. Each task should be completed and committed before moving to the next task.

## Goal

カードリバーシ本体で「絶対にリファクタリングした方が良い」と判断できる構造的リスクを、挙動を変えずに段階的に潰す。対象は軽量配布物ではなく、`C:\Users\quarr\Desktop\othello_v2` の source-of-truth repository で確認した問題だけに限定する。

この計画は gameplay 仕様書ではない。カード効果、合法手、コスト、ターン順、演出順、ネットワーク authority、表示テキストを変更しない。もし作業中に player-visible behavior の変更が必要だと判明した場合は、その pass を止め、`01-rulebook.md` と該当する `正本/*.md` の仕様判断を先に行う。

## Architecture

リファクタリングの基準は既存の authority / presentation contract に合わせる。

- `game/`, CPU logic, pure card logic, `shared/` は canonical state、validation、`events[]`、presentation metadata までを扱い、DOM、sound、animation、network client、UI global を直接参照しない。
- `ui/` は public game API、canonical snapshot、DI hooks、ordered `events[]` を消費して表示、入力、network publish を行う。
- Worker/local server/browser/headless の挙動差は runtime boundary に閉じ込め、同じ判定を別実装しない。
- `worker-public/`, `dist/`, `public/module-registry.js` は source-of-truth として編集しない。必要な mirror/generated diff は既存 script で生成してから確認する。

## Tech Stack

- TypeScript / JavaScript
- Jest
- Playwright-on-Jest browser integration tests
- Cloudflare Worker source under `workers/`
- Existing scripts: `npm run check:window`, `npm run typecheck`, `npm run build:ts`, `npm run test:network:parity`, `npm run worker:prepare`

---

## Current Evidence

| Priority | Finding | Evidence | Refactor target |
| --- | --- | --- | --- |
| P0 | `game/pass-handler.ts` と `game/cpu-turn-handler.ts` が top-level require cycle を持つ | dependency scan: `game/pass-handler.ts -> game/cpu-turn-handler.ts -> game/pass-handler.ts`; `public/runtime.js` は factory 実行後に cache するため browser runtime で top-level cycle が危険 | CPU/pass runtime injection の一方向化 |
| P0 | network snapshot apply と playback/busy settlement が同じ module に残っている | `ui/network/snapshot.ts` 1239 lines; `ui/playback-state-manager.ts` 1216 lines; snapshot/presentation split は途中段階 | canonical snapshot apply と presentation settlement の責務分離 |
| P1 | `entry-browser.js` の loader は fail-fast metadata があるが、load table と global exposure が手書きで巨大 | `entry-browser.js` 2097 lines; `require("./dist/...")` 224 calls; `Object.assign(window` 225; duplicate `shared/shared-board-utils` 1件; boot classifier tests already pass | declarative load table に寄せ、既存 boot contract を保つ |
| P1 | destroy core が巨大で stage 境界が読めない | `game/logic/board_ops.ts` 2771 lines; `_destroyAtCore` 約342 lines, 7 params, branch 約55 | protection / target / conversion / event emission の stage split |
| P1 | turn pipeline phase 関数が巨大で引数が多い | `game/turn/turn_pipeline_phases.ts` 1701 lines; `applyTurnStartPhase` 約283 lines, 8 params; `applyActionPhase` 約381 lines, 9 params | internal context object と stage helper 化 |
| P1 | board renderer と diff renderer が cycle し、DOM patching module が過大 | cycle: `ui/board-renderer.ts -> ui/diff-renderer.ts -> ui/board-renderer.ts`; `ui/diff-renderer.ts` 4196 lines; `buildCurrentCellState` 約469 lines; `updateCellDOM` 約411 lines | projector / equality / DOM patcher 分割 |
| P2 | match mode handler が UI control、network lobby、chat、leaderboard を抱える | `ui/handlers/match-mode.ts` 3078 lines; `bindNetworkButtons` 約456 lines | facade を保った feature controller 分割 |
| P2 | CSS cascade の責務が崩れており、後続 UI 変更の事故率が高い | CSS total 22966 lines; `!important` 116; `styles-leaderboard.css` は dynamic loader で生存確認済み | visual contract 後に cascade を整理 |
| P2 | compatibility/global exposure 経由の cycle が残る | cycle: `ui/animation-utils.ts -> ui/handlers/hand-skin.ts -> ui/hand-skin/controller.js -> ui/hand-skin/controller.ts -> ui/bootstrap.js -> ui/bootstrap.ts -> ui/animation-utils.ts` | wrapper / global exposure の整理または明示 allow |

## Corrected Assumptions From GPT PRO Review

GPT PRO の調査対象は `C:\Users\quarr\Downloads\カードリバーシ軽量` であり、source-of-truth repository ではない。以下は現 repository で再確認した補正事項として扱う。

- `game/` の direct DOM/window/global UI 参照は現在の P0 ではない。`npm run check:window` は通過しており、`selection-flow.ts` は pending selection network publish を UI/network signal bridge の後ろに置いている。
- `entry-browser.js` の required/optional boot metadata と fail-fast helper は既に存在する。対象は「分類を作ること」ではなく、手書き load/exposure table の縮小と重複排除である。
- `styles-leaderboard.css` は dead file ではない。`ui/handlers/match-mode.ts` の `ensureLeaderboardStylesheet()` が dynamic insert しており、`test/ui.match-mode.leaderboard-limit.test.ts` は通過している。
- 軽量成果物から見える generated / bundled artifact は source-of-truth として編集しない。

## Behavior Preservation Contract

全 pass で次を変えない。

- legal move 判定、pass 判定、CPU decision result、turn owner、PRNG 消費順
- card cost、target validity、destroy/protection/afterimage/gold/silver interaction
- `gameState`, `cardState`, `board` の canonical shape
- raw `events[]` の順序、`actionId`, `effectBlockId`, `phase`, `sequenceIndex`
- presentation event の順序、sound trigger の相対順、board animation timing
- network publish timing、operation id、seat token、server snapshot authority
- public browser global names、互換 wrapper の参照同一性、既存 debug flag の意味
- normal play で debug side effect を control flow に使わないという境界

## Stop Rules

- player-visible behavior の変更が必要になったら、その pass を止めて仕様変更として扱う。
- generated / mirror file を手編集する必要が出たら止め、source と generator の責務を確認する。
- dependency boundary を弱める変更、`game/` から UI/network/window を参照する変更、snapshot runtime を authority にする変更は採用しない。
- focused tests が挙動差を示した場合は、期待値の変更で通さず、差分の原因を先に特定する。
- unrelated dirty files が出て task diff と分離できない場合は commit せず、対象 file を報告して判断を仰ぐ。

## Pass 0: Baseline Boundary Guard

Objective: 今後の pass で cycle を減らしたことを機械的に確認できる static test を先に置く。

Files:

- `test/refactor.dependency-boundary.test.ts`

Steps:

1. `git status --short` が clean か、少なくとも unrelated dirty files がないことを確認する。
2. TypeScript/JavaScript source import graph を読む Jest test を追加する。
3. 初期 allowlist は現時点で確認済みの cycle だけにする。
4. `game/pass-handler.ts -> game/cpu-turn-handler.ts -> game/pass-handler.ts` を named allowlist entry として記録し、Pass 1 で削除できる形にする。
5. `ui/board-renderer.ts -> ui/diff-renderer.ts -> ui/board-renderer.ts` を named allowlist entry として記録し、Pass 6 で削除できる形にする。
6. compatibility wrapper 経由の `ui/animation-utils.ts` cycle は P2 allowlist として記録し、Pass 9 で削除または根拠付きで残す。
7. self-cycle に見える `game/turn-manager.ts -> game/turn-manager.ts` は parser 由来か実 cycle かを test 名で明示する。parser 由来なら ignore reason を comment に残す。

Validation:

```powershell
npx jest --runInBand test/refactor.dependency-boundary.test.ts
npm run check:window
git diff --check -- test/refactor.dependency-boundary.test.ts
```

Expected result:

- Jest は allowlist 内 cycle だけを許可して通る。
- `npm run check:window` は forbidden browser/global access を検出しない。

Commit message:

```text
Add dependency boundary guard
```

## Pass 1: Remove CPU/Pass Top-Level Cycle

Objective: `game/pass-handler.ts` と `game/cpu-turn-handler.ts` の top-level require cycle をなくし、browser runtime の半初期化リスクを消す。

Files:

- `game/cpu-turn-handler.ts`
- `game/pass-handler.ts`
- `ui/bootstrap/pass-runtime-wiring.ts`
- `ui/bootstrap/cpu-runtime-wiring.ts`
- `test/refactor.dependency-boundary.test.ts`

Steps:

1. `test/refactor.dependency-boundary.test.ts` から CPU/pass cycle allowlist entry を外し、現状で失敗することを確認する。
2. `game/cpu-turn-handler.ts` の top-level `passHandler` import/require を除去する。
3. `resolveProcessPassTurn()` は `__uiImpl_cpu.resolveProcessPassTurn()` と `__uiImpl_cpu.processPassTurn` を優先し、`passHandler.processPassTurn` への module fallback を持たない形にする。
4. `game/pass-handler.ts` の top-level `cpuTurnHandlerModule` import/require を除去する。
5. `resolveCpuTurnFnForPass()` は `passHandlerRuntime.processCpuTurn` を第一候補にし、既存 browser compatibility が必要な場合だけ global fallback を境界互換として残す。新しい game-to-game top-level require は追加しない。
6. `ui/bootstrap/pass-runtime-wiring.ts` が `../game/cpu-turn-handler` を pass wiring 中に require している場合は、`processCpuTurn` を lazy resolver で注入する。pass wiring の初期化順で CPU module を強制 load しない。
7. `ui/bootstrap/cpu-runtime-wiring.ts` の既存 `resolveProcessPassTurn` 注入を確認し、pass-handler 側が必要な runtime hook と対になることを test で固定する。
8. dependency boundary test が CPU/pass cycle を検出しなくなることを確認する。

Validation:

```powershell
npx jest --runInBand test/refactor.dependency-boundary.test.ts
npx jest --runInBand test/game.pass-handler.test.ts test/game.pass-clears-pending.test.ts test/cpu.turn-handler.retry.test.ts test/cpu.turn-handler.programmed-card-policy.test.ts
npm run check:window
npm run typecheck
```

Expected result:

- CPU/pass cycle allowlist entry なしで dependency boundary test が通る。
- pass 処理、CPU retry、programmed card policy の既存期待値が変わらない。
- `game/` に forbidden browser/global UI access が増えない。

Commit message:

```text
Remove CPU pass handler cycle
```

## Pass 2: Split Network Snapshot Authority From Playback Settlement

Objective: `ui/network/snapshot.ts` を canonical snapshot application に寄せ、playback lock、busy clear、deferred refresh、presentation reconciliation を presentation modules に移す。

Files:

- `ui/network/snapshot.ts`
- `ui/network/snapshot-presentation.ts`
- `ui/playback-state-manager.ts`
- `ui/network/snapshot-runtime.ts`
- `docs/superpowers/plans/2026-06-22-runtime-bootstrap-and-playback-boundary-refactor.md`

Steps:

1. 既存 plan `2026-06-22-runtime-bootstrap-and-playback-boundary-refactor.md` と現 source の差を確認し、古い記述が実装判断を誤らせる場合はこの pass で plan 文だけ更新する。
2. `ui/network/snapshot.ts` 内の playback dispatch、busy settlement、`requestDeferredBoardRefreshAfterPlayback` 相当の presentation-only decision を列挙する。
3. canonical snapshot parse/apply に必要な処理だけを `ui/network/snapshot.ts` に残す。
4. presentation event handoff、pending selection presentation reconciliation、board refresh scheduling を `ui/network/snapshot-presentation.ts` または `ui/playback-state-manager.ts` に移す。
5. public import surface を維持する必要がある場合は thin wrapper を残し、責務移動先を comment で短く示す。
6. server snapshot authority を client runtime、preview state、playback state から決める path がないことを確認する。

Validation:

```powershell
npx jest --runInBand test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.playback-state-manager.test.ts
npm run test:network:parity
npm run typecheck
```

Expected result:

- Single Visual Writer contract の既存 test が通る。
- pending presentation reconciliation の既存期待値が変わらない。
- network parity が snapshot/publish/reconnect contract の drift を検出しない。

Commit message:

```text
Split snapshot playback settlement
```

## Pass 3: Convert Browser Boot Loader To Declarative Table

Objective: `entry-browser.js` の既存 fail-fast metadata と boot classifier を保ちながら、手書き require/global exposure の塊を declarative table に寄せる。

Files:

- `entry-browser.js`
- `scripts/build-module-registry.ts`
- `test/entry-browser.bootstrap-contract.test.ts`
- `test/scripts.build-module-registry.boot-contract.test.ts`
- new focused test if needed: `test/entry-browser.boot-table-sequence.test.ts`

Steps:

1. `entry-browser.js` の current require order と exposed global names を characterization test で固定する。
2. 既存の `requireBootModule`, `requireBootNamespace`, optional prefix metadata, `handleBootModuleError` を再利用する。
3. module id、required/optional policy、exposed global keys、namespace handling を `BOOT_LOAD_ENTRIES` に集約する。
4. table runner は既存と同じ順序で module を読み、同じ `window` key に同じ値を代入する。
5. duplicate `shared/shared-board-utils` は characterization で side effect がないことを確認できた場合だけ削除する。確認できない場合は table entry に duplicate reason を明示して順序を保つ。
6. `scripts/build-module-registry.ts` の classifier contract を変えない。必要な場合だけ table と registry metadata の対応 test を追加する。

Validation:

```powershell
npx jest --runInBand test/entry-browser.bootstrap-contract.test.ts test/scripts.build-module-registry.boot-contract.test.ts
npx jest --runInBand test/entry-browser.boot-table-sequence.test.ts
npm run build:ts
```

Expected result:

- required boot module failure は throw し、optional boot module failure は warn/continue する。
- generated registry content は `window.__CARD_REVERSI_BOOT_MODULES__` を引き続き持つ。
- browser public global names と load order が characterization と一致する。

Commit message:

```text
Table-drive browser boot loader
```

## Pass 4: Stage-Split Destroy Core

Objective: `_destroyAtCore` を挙動単位の private helper に分け、protection/afterimage/forced destroy/gold/silver interaction の事故率を下げる。

Files:

- `game/logic/board_ops.ts`
- optional private helper module: `game/logic/destroy-stages.ts`
- `test/game.card-effects.destroy.test.ts`
- `test/game.destroy-protection-context.test.ts`
- focused tests for afterimage / gold / silver / absolute protection if existing names differ

Steps:

1. `_destroyAtCore` の current behavior を stage に分解して comment ではなく helper name で表現する。
2. 既存 tests で不足している代表ケースを 1 pass 内で追加する。最低限、protect success、protect bypass、afterimage replacement、gold/silver destroy interaction、event ordering を含める。
3. function signature は public API から変えない。private context object は `_destroyAtCore` 内部または private helper の引数だけに使う。
4. target lookup、protection decision、replacement/conversion、board mutation、event emission を helper 化する。
5. `events[]` の `actionId`, `effectBlockId`, `phase`, `sequenceIndex` を helper 内で再採番しない。既存 caller から渡された metadata を使う。

Validation:

```powershell
npx jest --runInBand test/game.card-effects.destroy.test.ts test/game.destroy-protection-context.test.ts
npm run typecheck
```

Expected result:

- destroy/protection tests の event payload と board state が refactor 前と一致する。
- TypeScript error がない。

Commit message:

```text
Stage-split destroy core
```

## Pass 5: Context-Split Turn Pipeline Phases

Objective: `applyTurnStartPhase` と `applyActionPhase` の多引数・巨大関数を internal context と stage helpers に分ける。

Files:

- `game/turn/turn_pipeline_phases.ts`
- `game/turn/turn_pipeline.ts`
- focused tests under `test/` for turn pipeline and card effect ordering

Steps:

1. public export と call signature を維持したまま、内部で `TurnPhaseContext` を作る。
2. turn-start anchor resolution、pending status settlement、draw/resource update、action execution、post-action cleanup を stage helper に分ける。
3. PRNG、event metadata、cardState mutation order を context constructor で変えない。
4. helper は headless に保ち、UI/network/sound dependency を追加しない。
5. `applyTurnStartPhase` と `applyActionPhase` の wrapper は既存 tests が import しても通る形で残す。

Validation:

```powershell
npx jest --runInBand test/game.turn-pipeline.destroy-hand-card.test.ts test/game.card-effects.destroy.test.ts
npm run check:window
npm run typecheck
```

Expected result:

- turn pipeline の event ordering と cardState mutation が既存期待値と一致する。
- `game/` に forbidden browser/global UI access が増えない。

Commit message:

```text
Context-split turn pipeline phases
```

## Pass 6: Split Diff Renderer And Remove Board Renderer Cycle

Objective: `ui/diff-renderer.ts` を projector/equality/DOM patcher に分け、`ui/board-renderer.ts` との import cycle をなくす。

Files:

- `ui/diff-renderer.ts`
- new modules under `ui/diff-renderer/`
- `ui/board-renderer.ts`
- `test/ui.diff-renderer.*`
- `test/ui.board-renderer.visual-state.test.ts`
- `test/refactor.dependency-boundary.test.ts`

Steps:

1. dependency boundary allowlist から board/diff cycle を外し、現状で失敗することを確認する。
2. `buildCurrentCellState` を pure-ish projector module に移す。DOM read が必要な部分は explicit adapter 引数にする。
3. `cellStatesEqual` を equality module に移し、stable comparison contract を focused test で固定する。
4. `updateCellDOM` を DOM patcher module に移し、Single Visual Writer contract を保つ。
5. `ui/board-renderer.ts` と diff renderer の共有値は一方向 dependency または shared leaf module に移す。
6. board/diff cycle allowlist entry なしで dependency boundary test を通す。

Validation:

```powershell
npx jest --runInBand test/refactor.dependency-boundary.test.ts
npx jest --runInBand test/ui.board-renderer.visual-state.test.ts
npx jest --runInBand test/ui.diff-renderer*.test.ts
npm run typecheck
```

Expected result:

- board/diff cycle が消える。
- visual state, hover/highlight, preview, pending presentation の既存 assertions が変わらない。

Commit message:

```text
Split diff renderer modules
```

## Pass 7: Split Match Mode Handler

Objective: `ui/handlers/match-mode.ts` の public facade を維持しながら、network buttons、lobby state、chat、leaderboard、mode controls を分割する。

Files:

- `ui/handlers/match-mode.ts`
- new modules under `ui/handlers/match-mode/`
- `test/ui.match-mode.network-button.test.ts`
- `test/ui.match-mode.leaderboard-limit.test.ts`

Steps:

1. `setupMatchModeControls` と既存 public exports を facade として残す。
2. `bindNetworkButtons` を network buttons controller に移し、button enabled/disabled logic と publish hooks を同じ順序で実行する。
3. leaderboard rendering と `ensureLeaderboardStylesheet()` を leaderboard controller に移す。`styles-leaderboard.css` は dynamic stylesheet として維持する。
4. chat/lobby status/mode controls を別 module に分け、DOM query の root と lifecycle cleanup を explicit に渡す。
5. existing tests が参照する public function path は wrapper で維持する。

Validation:

```powershell
npx jest --runInBand test/ui.match-mode.network-button.test.ts test/ui.match-mode.leaderboard-limit.test.ts
npm run typecheck
```

Expected result:

- network button state と leaderboard limit の既存期待値が変わらない。
- dynamic leaderboard stylesheet insertion が維持される。

Commit message:

```text
Split match mode controllers
```

## Pass 8: CSS Cascade Responsibility Cleanup

Objective: UI behavior が固定された後で、CSS の責務と cascade order を整理し、後続変更で `!important` を増やさず済む状態に近づける。

Files:

- `styles*.css`
- optional new CSS modules with explicit load order
- existing CSS/visual regression tests under `tests/visual-regression/`

Steps:

1. CSS file load order を `index.html` と dynamic stylesheet insertion の両方から一覧化する。
2. `styles-leaderboard.css` を dead file として削除しない。dynamic load の責務を `match-mode` controller 側 test で固定する。
3. unconditional character layout rules が responsive file に混ざっている場合は、load order を保てる adjacent stylesheet に移す。
4. `!important` は blanket removal しない。1 selector ごとに computed style が維持されることを確認できる場合だけ削る。
5. board, hand, card, network panel, leaderboard の major surfaces で visual inspection または既存 visual regression を行う。

Validation:

```powershell
npm run test:visual
npm run typecheck
git diff --check -- styles*.css
```

Expected result:

- cascade order の意図が file responsibility と一致する。
- visual regression または manual inspection で board/hand/network/leaderboard の崩れがない。

Commit message:

```text
Clean up CSS cascade ownership
```

## Pass 9: Audit Remaining Compatibility Cycles And Globals

Objective: P0/P1 cycle を削除した後、残る compatibility/global exposure cycle を削除するか、必要性を文書化して allowlist を最小化する。

Files:

- `ui/animation-utils.ts`
- `ui/handlers/hand-skin.ts`
- `ui/hand-skin/controller.ts`
- `ui/bootstrap.ts`
- `ui/bootstrap.js`
- `test/refactor.dependency-boundary.test.ts`
- `docs/architecture-contracts.md` if an intentional compatibility exception must be documented

Steps:

1. dependency boundary test の allowlist を残件だけに縮小する。
2. `ui/bootstrap.js` / `.ts` compatibility wrapper が cycle の原因なら、runtime entry と source module の責務を分ける。
3. `animation-utils` と hand-skin controller の shared helper を leaf module に移せる場合は移す。
4. public global exposure が必要な場合は bootstrap boundary に閉じ込め、feature module から bootstrap を import しない。
5. 最終的に allowlist を空にできるか確認する。空にできない場合は `docs/architecture-contracts.md` に exception の範囲と理由を 1 箇所だけ記録する。

Validation:

```powershell
npx jest --runInBand test/refactor.dependency-boundary.test.ts
npm run check:window
npm run typecheck
```

Expected result:

- dependency boundary test の allowlist が空、または architecture document に根拠がある最小例外だけになる。
- bootstrap/global exposure は runtime boundary に閉じる。

Commit message:

```text
Audit compatibility cycles
```

## Execution Rules For Every Pass

1. Start with:

```powershell
git status --short
```

2. Classify dirty files before editing.
3. Edit source-of-truth files only.
4. Run the pass-specific validation.
5. Run:

```powershell
git diff --check
git status --short
```

6. Stage only intentional files for that pass.
7. Commit the pass with the listed message.
8. If generated or mirror files changed, verify the generator command that produced them and mention it in the commit/final report.

## First Safe Execution Slice

The safest first slice is Pass 0 followed by Pass 1.

Reason:

- It attacks the only confirmed P0 import cycle inside `game/`.
- It creates a boundary guard before changing runtime wiring.
- It does not require gameplay spec changes.
- Existing focused tests cover pass handling and CPU retry behavior.

Recommended command sequence for the first slice:

```powershell
git status --short
npx jest --runInBand test/refactor.dependency-boundary.test.ts
npx jest --runInBand test/game.pass-handler.test.ts test/game.pass-clears-pending.test.ts test/cpu.turn-handler.retry.test.ts test/cpu.turn-handler.programmed-card-policy.test.ts
npm run check:window
npm run typecheck
git diff --check
```

## Rollback Strategy

Each pass is one coherent commit. If a regression appears after a pass, revert that pass commit first and rerun the pass validation commands. Do not revert unrelated user work or generated files by broad checkout/reset commands. If a pass produced generated files via script, regenerate from the reverted source state instead of hand-editing the generated output.

## Out Of Scope

- New card behavior
- Balance changes
- UI copy changes
- Rulebook/spec changes not forced by a discovered behavior mismatch
- Full ESM migration
- Dependency upgrades
- Blanket formatting
- Long selfplay or training jobs
