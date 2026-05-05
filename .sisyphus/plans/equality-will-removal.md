# 平等の意志 (EQUALITY_WILL) 完全削除

## TL;DR

> **Quick Summary**: カード「平等の意志」（EQUALITY_WILL / equality_will_01）を catalog・ロジック・CPU・UI・テスト・ドキュメント・mirror まで完全削除する。
>
> **Deliverables**:
> - 全 root 正本ファイルから cardId / type / 表示名の参照を削除
> - 専用テストファイル削除、他テストファイルのフィクスチャ修正
> - catalog ファイル再生成、mirror 同期
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 複数 Wave
> **Critical Path**: 01-rulebook.md → catalog.json → game logic → CPU/AI → tests → build → verify

---

## Context

### Original Request
「平等の意志というカードを完全に削除したいです」

### Interview Summary
- **完全削除**：無効化（`enabled: false`）ではなく抹消
- **3軸追跡**：cardId `equality_will_01`（一部テストでは `equality_01`）、type `EQUALITY_WILL`、表示名 `平等の意志`
- **手順**: カード削除ワークフロー（card-removal-workflow skill）に従う

### Research Findings
**3軸grep 結果（root ソースのみ）**：

カタログ・定数:
- `cards/catalog.json`, `cards/catalog.ts` — カード定義エントリ
- `shared-constants.ts` — CARD_DEFS + 種類リスト
- `src/types/card.ts` — CardType union
- `cards/card-interaction.ts`, `cards/card-interaction-effects.js` — 表示テキスト

ゲームロジック:
- `game/logic/cards.ts` — `EQUALITY_WILL_MAX_SPAWNS` 定数＋spawn ロジック
- `game/cards/target-resolver.ts` — コメント
- `game/turn/turn_pipeline_phases.ts` — pending 解決分岐
- `game/turn/pipeline_ui_adapter.ts` — cause
- `game/logic/cards-internal/hand-manager.ts`, `card-usage-prechecks.ts` — 型判定

CPU/AI:
- `game/ai/cpu-policy-core.ts` — 7箇所の型参照・プロファイル
- `game/cpu-decision.ts` — 計画圧プロファイル
- `docs/teacher-cpu-card-usage-buckets.md` — 1行

UI:
- `ui/animation-engine.ts` — spawn 判定2箇所
- `public/module-registry.js` — エントリ14箇所

ドキュメント:
- `01-rulebook.md` — セクション 10.20.2 削除＋後続セクション再番号

テスト:
- `test/game.equality-will.test.ts` — **専用テストファイル削除**
- `test/cards.equality-will-surfaces.test.ts` — **削除**
- 他7テストファイルからフィクスチャ削除

---

## Work Objectives

### Core Objective
カード「平等の意志」をリポジトリから完全に抹消する。

### Concrete Deliverables
- 全 root ソースファイルの該当参照を削除
- catalog ファイル（`cards/catalog.js`, `cards/catalog.generated.js`）再生成
- `worker-public/` mirror 同期
- TypeScript 型チェック通過
- 3軸grep で実参照ゼロ確認

### Definition of Done
- [ ] `npm run typecheck` が通過する
- [ ] 3軸grep（`equality_will_01` / `equality_01` / `EQUALITY_WILL` / `平等の意志`）で root ソースに実参照がゼロ
- [ ] `worker-public/` の mirror が同期済み
- [ ] 01-rulebook.md が更新済み

### Must Have
- 全削除：catalog, 定数, ロジック, UI, CPU/AI, テスト, ドキュメント
- catalog 再生成：`cards/catalog.js`, `cards/catalog.generated.js`
- mirror 同期：`npm run worker:prepare` 実行

### Must NOT Have (Guardrails)
- `enabled: false` で残さない（完全削除）
- `dist/` や `worker-public/` を直接触らない（root 正本を直してから mirror 同期）
- 無関係な掃除を同じ差分に混ぜない

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (jest + ts-jest)
- **Automated tests**: テストファイル削除・修正後、`npm run typecheck` で確認
- **Framework**: jest + ts-jest
- **Agent QA**: 各 Wave の完了条件として typecheck + grep を実行

### QA Policy
- Wave ごとに `npm run typecheck` を実行
- 全タスク完了後に 3-axis grep で実参照ゼロ確認
- 最後に `git status` で変更ファイルのスコープ確認

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (ドキュメント＋カタログ定数 — 独立編集):
├── Task 1: 01-rulebook.md — セクション10.20.2削除＋番号振り直し
├── Task 2: cards/catalog.json — equality_will_01 エントリ削除
├── Task 3: cards/catalog.ts — equality_will_01 エントリ削除
├── Task 4: shared-constants.ts — CARD_DEFS + 種類リストから削除
├── Task 5: src/types/card.ts — CardType union から 'EQUALITY_WILL' 削除
├── Task 6: cards/card-interaction.ts + card-interaction-effects.js — 表示テキスト削除
├── Task 7: docs/teacher-cpu-card-usage-buckets.md — 1行削除

Wave 2 (ゲームロジック — Wave1完了後):
├── Task 8: game/logic/cards.ts — EQUALITY_WILL_MAX_SPAWNS + spawnロジック削除
├── Task 9: game/cards/target-resolver.ts — コメント削除
├── Task 10: game/turn/turn_pipeline_phases.ts — pending解決分岐削除
├── Task 11: game/turn/pipeline_ui_adapter.ts — cause='EQUALITY_WILL'削除
├── Task 12: game/logic/cards-internal/hand-manager.ts — 型判定ifブロック削除
├── Task 13: game/logic/cards-internal/card-usage-prechecks.ts — 型判定ifブロック削除

Wave 3 (CPU/AI + UI — Wave1/2完了後):
├── Task 14: game/ai/cpu-policy-core.ts — 7箇所の参照削除
├── Task 15: game/cpu-decision.ts — EQUALITY_WILL圧プロファイル削除
├── Task 16: ui/animation-engine.ts — spawn判定2箇所削除
├── Task 17: public/module-registry.js — 14箇所のエントリ削除

Wave 4 (テスト — 全Wave完了後):
├── Task 18: test/game.equality-will.test.ts — ファイル削除
├── Task 19: test/cards.equality-will-surfaces.test.ts — ファイル削除
├── Task 20: test/game.cpu-policy-core.test.ts — equality_01参照削除
├── Task 21: test/game.pipeline-ui-adapter.spawn.test.ts — EQUALITY_WILL削除
├── Task 22: test/game.pipeline-ui-adapter.sound-cue.test.ts — EQUALITY_WILL削除
├── Task 23: test/game.pipeline-ui-adapter.normal-logs.test.ts — 平等の意志削除
├── Task 24: test/ui.animation-engine.guard-timer.test.ts — EQUALITY_WILL削除
├── Task 25: test/ui.card-detail-effect-tags.test.ts — 平等の意志削除
├── Task 26: test/ui.card-use-source-element.test.ts — EQUALITY_WILL/平等の意志削除

Wave FINAL (ビルド＋検証):
├── Task F1: npm run generate:catalog 実行
├── Task F2: npm run typecheck 実行
├── Task F3: npm run worker:prepare 実行（mirror同期）
├── Task F4: 3軸grepで実参照ゼロ確認
├── Task F5: git status で変更スコープ確認
```

### Agent Dispatch Summary

- **Wave 1**: 7 tasks — `quick` / `unspecified-high` (catalog編集)
- **Wave 2**: 6 tasks — `unspecified-high` (ゲームロジック編集)
- **Wave 3**: 4 tasks — `unspecified-high` / `visual-engineering` (animation-engine)
- **Wave 4**: 9 tasks — `quick` (テスト編集)
- **FINAL**: 5 tasks — `unspecified-high` (build/verify)

Critical Path: Task 1 → Task 8 → Task 14 → Task 18 → F1 → F4
Max Concurrent: 7 (Wave 1)

---

## TODOs

### Wave 1 — ドキュメント＋カタログ定数 (7 tasks parallel)

- [x] 1. `01-rulebook.md` — EQUALITY_WILL セクション削除＋番号振り直し

  **What to do**:
  - 01-rulebook.md を開く
  - `### 10.20.2 EQUALITY_WILL（平等の意志）` で始まる12行（セクション全体）を削除
  - 後続の `### 10.20.3` を `### 10.20.2` に変更
  - 変更を保存

  **Must NOT do**:
  - 他のカードセクション番号を変えない

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: YES | Wave 1 (with Tasks 2-7)
  **Blocks**: Task 8 (Wave 2 開始条件)

- [x] 2. `cards/catalog.json` — equality_will_01 エントリ削除

  **What to do**:
  - cards/catalog.json を開く
  - `equality_will_01` のカードエントリオブジェクト（id: equality_will_01 のブロック）を削除
  - JSON の整合性を確認（余分なカンマがないか）

  **References**: Wave 1 (Tasks 1, 3-7)
  **Parallelization**: YES | Wave 1

- [x] 3. `cards/catalog.ts` — equality_will_01 エントリ削除（lines 820-830付近）

  **What to do**:
  - cards/catalog.ts を開く
  - `"name_ja": "平等の意志"` を含む catalog 定義ブロックを削除
  - TypeScript のコンパイルが通ることを確認

  **References**: Wave 1 (Tasks 1-2, 4-7)
  **Parallelization**: YES | Wave 1

- [x] 4. `shared-constants.ts` — CARD_DEFS + 種類リストから削除

  **What to do**:
  - shared-constants.ts を開く
  - `// EQUALITY_WILL (平等の意志)` コメント行と次の `{ id: 'equality_will_01', ... }` 行を削除
  - 種類リスト（`type: 'EQUALITY_WILL'` が並ぶ配列）から `'EQUALITY_WILL',` 行を削除

  **References**: Wave 1 (Tasks 1-3, 5-7)
  **Parallelization**: YES | Wave 1

- [x] 5. `src/types/card.ts` — CardType union から削除

  **What to do**:
  - src/types/card.ts を開く
  - `| 'EQUALITY_WILL'` (line 96) を削除
  - union type の構文が壊れないことを確認

  **References**: Wave 1 (Tasks 1-4, 6-7)
  **Parallelization**: YES | Wave 1

- [x] 6. `cards/card-interaction.ts` + `cards/card-interaction-effects.js` — 表示テキスト削除

  **What to do**:
  - card-interaction.ts: `if (cardDef.type === 'EQUALITY_WILL')` のブロックを削除
  - card-interaction-effects.js: `EQUALITY_WILL:` の2つのエントリ（短説明・長説明）を削除

  **References**: Wave 1 (Tasks 1-5, 7)
  **Parallelization**: YES | Wave 1

- [x] 7. `docs/teacher-cpu-card-usage-buckets.md` — 1行削除

  **What to do**:
  - docs/teacher-cpu-card-usage-buckets.md を開く
  - `- 平等の意志 (\`EQUALITY_WILL\`)` の行を削除

  **References**: Wave 1 (Tasks 1-6)
  **Parallelization**: YES | Wave 1

### Wave 2 — ゲームロジック (10 tasks parallel, blocked by Wave 1)

- [x] 8. `game/logic/cards.ts` — `EQUALITY_WILL_MAX_SPAWNS` 定数＋spawn ロジック削除

  **What to do**:
  - `const EQUALITY_WILL_MAX_SPAWNS = 3;` (line 250) を削除
  - 以降で参照している export と spawn への引数指定（~lines 1116-1125）を削除
  - エクスポートリストから `EQUALITY_WILL_MAX_SPAWNS` を除去

  **Parallelization**: YES | Wave 2 (with Tasks 9-13)

- [x] 9. `game/cards/target-resolver.ts` — コメント削除

  **What to do**:
  - `// EQUALITY_WILL spawns on empty cells; return all empty spawnable cells.` (line 1047) を削除

  **Parallelization**: YES | Wave 2

- [x] 10. `game/turn/turn_pipeline_phases.ts` — pending 解決分岐削除

  **What to do**:
  - `if (pendingType === 'EQUALITY_WILL')` のブロック（~lines 2261-2266）を削除
  - 前後の分岐構文が壊れないことを確認

  **Parallelization**: YES | Wave 2

- [x] 11. `game/turn/pipeline_ui_adapter.ts` — cause 削除

  **What to do**:
  - `cause: 'EQUALITY_WILL',` (line 785) を削除
  - 前後の配列/オブジェクト構文が壊れないことを確認

  **Parallelization**: YES | Wave 2

- [x] 11b. `game/turn/pipeline_ui_adapter.ts` — ログメッセージ削除

  **What to do**:
  - `let line = \`平等の意志: 通常石${Number(ev.spawnedCount) || 0}個を生成\`;` (line 3226) のログ分岐を削除
  - 前後の条件分岐構文が壊れないことを確認

  **Parallelization**: YES | Wave 2

- [x] 12. `game/logic/cards-internal/hand-manager.ts` — 型判定削除

  **What to do**:
  - `if (type === 'EQUALITY_WILL')` のブロック（line 586）を削除

  **Parallelization**: YES | Wave 2

- [x] 13. `game/logic/cards-internal/card-usage-prechecks.ts` — 型判定削除

  **What to do**:
  - `if (cardType === 'EQUALITY_WILL')` のブロック（line 53）を削除
  - 前後のif-else構文が壊れないことを確認

  **Parallelization**: YES | Wave 2

### Wave 3 — CPU/AI + UI (4 tasks parallel, blocked by Wave 1-2)

- [x] 14. `game/ai/cpu-policy-core.ts` — 7箇所の参照削除

  **What to do**:
  次の7箇所を削除:
  - Line 62: `'EQUALITY_WILL',` (string配列)
  - Line 233: `'EQUALITY_WILL',` (string配列)
  - Line 380: `'EQUALITY_WILL',` (string配列)
  - Line 418: `EQUALITY_WILL: 4,` (数値マップ)
  - Line 505: `'EQUALITY_WILL',` (string配列)
  - Line 587: `EQUALITY_WILL: { leadBias: ..., }` (オブジェクト)
  - Line 988: `EQUALITY_WILL: { archetype: ..., }` (オブジェクト)

  **Parallelization**: YES | Wave 3 (with Tasks 15-17)

- [x] 15. `game/cpu-decision.ts` — 計画圧プロファイル削除

  **What to do**:
  - `EQUALITY_WILL: makePlanPressureProfile(2, 3, 2, 2),` (line 2084) を削除

  **Parallelization**: YES | Wave 3

- [x] 16. `ui/animation-engine.ts` — spawn 判定削除

  **What to do**:
  - Line 522: `(normalizedCause === 'EQUALITY_WILL' && normalizedReason.indexOf('equality_will_spawn') === 0) ||` を削除
  - Line 626: `cause === 'EQUALITY_WILL' &&` を削除
  - 前後の論理演算式が壊れないことを確認

  **Parallelization**: YES | Wave 3

- [x] 17. `public/module-registry.js` — 14箇所のエントリ削除

  **What to do**:
  - 該当行をすべて削除（equality_will_01 または EQUALITY_WILL または 平等の意志 への参照14箇所）
  - 配列/オブジェクト構文が壊れないことを確認

  **Parallelization**: YES | Wave 3

### Wave 4 — テスト + 残余ファイル (13 tasks parallel, blocked by Wave 1-3)

- [x] 18. `test/game.equality-will.test.ts` — ファイル削除

  **What to do**:
  - `git rm test/game.equality-will.test.ts` を実行
  - このテストファイルは平等の意志専用で、全テストが該当カードに依存

  **Parallelization**: YES | Wave 4 (with Tasks 19-26)

- [x] 19. `test/cards.equality-will-surfaces.test.ts` — ファイル削除

  **What to do**:
  - `git rm test/cards.equality-will-surfaces.test.ts` を実行
  - このファイルは equality_01 の surface テスト専用

  **Parallelization**: YES | Wave 4

- [x] 20. `tmp/playwright-network-verify/all-card-network-selfmatch.js` — EQUALITY_WILL ケース削除

  **What to do**:
  - `case 'EQUALITY_WILL': applyEqualityScenario(...)` のケースブロックを削除
  - `applyEqualityScenario` 関数 (L209) を削除
  - 前後の switch/case 構文が壊れないことを確認

  **Parallelization**: YES | Wave 4

- [x] 21. `tmp/playwright-current-state-2026-05-03.json` — 平等の意志エントリ削除

  **What to do**:
  - 該当JSON内の `"コスト15平等の意志"` 参照行を削除
  - JSON配列構文が壊れないことを確認

  **Parallelization**: YES | Wave 4

- [x] 22. `*.restored` ファイル（3ファイル）— 削除（11ファイル削除済み）

  **What to do**:
  - `shared-constants.js.restored`, `game/logic/cards.js.restored`, `game/cards/target-resolver.js.restored` の各ファイルから EQUALITY_WILL / 平等の意志 参照を削除（またはファイル自体を削除）
  - 各ファイルを確認して適切な処置を判断

  **Parallelization**: YES | Wave 4

- [x] 24. `test/game.cpu-policy-core.test.ts` — `equality_01` 参照削除

  **What to do**:
  - grep で `equality_01` を検索
  - 該当行（テストフィクスチャ）を削除

  **Parallelization**: YES | Wave 4

- [x] 25. `test/game.pipeline-ui-adapter.spawn.test.ts` — EQUALITY_WILL 削除

  **What to do**:
  - grep で `EQUALITY_WILL` を検索
  - 該当フィクスチャ行を削除

  **Parallelization**: YES | Wave 4

- [x] 26. `test/game.pipeline-ui-adapter.sound-cue.test.ts` — EQUALITY_WILL 削除

  **What to do**:
  - grep で `EQUALITY_WILL` を検索
  - 該当フィクスチャ行を削除

  **Parallelization**: YES | Wave 4

- [x] 27. `test/game.pipeline-ui-adapter.normal-logs.test.ts` — 平等の意志 削除

  **What to do**:
  - grep で `平等の意志` を検索
  - 該当フィクスチャ行を削除

  **Parallelization**: YES | Wave 4

- [x] 28. `test/ui.animation-engine.guard-timer.test.ts` — EQUALITY_WILL 削除

  **What to do**:
  - grep で `EQUALITY_WILL` を検索
  - 該当フィクスチャ行を削除

  **Parallelization**: YES | Wave 4

- [x] 29. `test/ui.card-detail-effect-tags.test.ts` — 平等の意志 削除

  **What to do**:
  - grep で `平等の意志` を検索
  - 該当フィクスチャ行を削除

  **Parallelization**: YES | Wave 4

- [x] 30. `test/ui.card-use-source-element.test.ts` — EQUALITY_WILL / 平等の意志 削除

  **What to do**:
  - grep で `EQUALITY_WILL` と `平等の意志` を検索
  - 該当フィクスチャ行を削除

  **Parallelization**: YES | Wave 4

### Wave FINAL — ビルド＋検証 (5 tasks sequential)

- [x] F1. **npm run generate:catalog** 実行

  **What to do**:
  - `npm run generate:catalog` を実行
  - cards/catalog.js と cards/catalog.generated.js が正しく再生成されることを確認
  - 両ファイルに `equality_will_01` / `EQUALITY_WILL` / `平等の意志` が含まれていないことを grep 確認

- [x] F2. **npm run typecheck** 実行

  **What to do**:
  - `npm run typecheck` を実行
  - エラーが出た場合は修正して再実行
  - PASS するまで繰り返す

- [x] F3. **npm run worker:prepare** 実行（mirror 同期）

  **What to do**:
  - `npm run worker:prepare` を実行
  - `worker-public/` に mirror が同期される
  - 同期後に `worker-public/` を 3軸 grep で確認

- [x] F4. **3軸grepで実参照ゼロ確認**

  **What to do**:
  - 3回 grep を実行：
    1. `rg "equality_will_01|equality_01" --include "*.ts" --include "*.js" --include "*.json" --include "*.md"` — root ソースのみ確認
    2. `rg "EQUALITY_WILL" --include "*.ts" --include "*.js" --include "*.json" --include "*.md"` — root ソースのみ確認
    3. `rg "平等の意志" --include "*.ts" --include "*.js" --include "*.json" --include "*.md"` — root ソースのみ確認
  - 許容される残り: `docs/archive/*`, `tmp/*`, `analysis-output.json`, `test-results.json`, `dist/` (stale artifacts)
  - 実参照（root ソース、active `dist/`、`worker-public/`）がゼロであることを確認

- [x] F5. **git status で変更スコープ確認＋報告**

  **What to do**:
  - `git status --short` で変更ファイル一覧を確認
  - 削除ファイルと編集ファイルの数が妥当であることを確認
  - 完了報告を生成

---

## Final Verification Wave

- [ ] F1-F5 を実行 → 全て PASS したら削除完了
- [ ] 完了報告をユーザーに提示

---

## Commit Strategy

1 commit にまとめる:
```
feat: remove 平等の意志 (EQUALITY_WILL) card completely

- Remove catalog entry, constants, types
- Remove game logic (spawn, target-resolver, pipeline, internal handlers)
- Remove CPU/AI policy references and decision profile
- Remove UI animation-engine spawn detection
- Remove module-registry entry
- Remove dedicated test files and fixtures from 7 other test files
- Update 01-rulebook.md (section 10.20.2) and teacher-cpu docs
- Regenerate catalog files, sync worker-public mirror
```

---

## Success Criteria

### Verification Commands
```bash
rg "equality_will_01|equality_01" --include "*.ts" --include "*.js" --include "*.md" . | grep -v dist/ | grep -v worker-public/ | grep -v docs/archive/ | grep -v tmp/
# Expected: no output from root source files

npm run typecheck
# Expected: exit code 0, no errors
```

### Final Checklist
- [ ] 01-rulebook.md 更新 (セクション10.20.2削除)
- [ ] cards/catalog.json からエントリ削除
- [ ] cards/catalog.ts からエントリ削除
- [ ] shared-constants.ts から CARD_DEFS + 種類リスト削除
- [ ] src/types/card.ts から削除
- [ ] cards/card-interaction.ts + card-interaction-effects.js から削除
- [ ] game/logic/cards.ts から EQUALITY_WILL_MAX_SPAWNS 削除
- [ ] game/cards/target-resolver.ts からコメント削除
- [ ] game/turn/turn_pipeline_phases.ts から分岐削除
- [ ] game/turn/pipeline_ui_adapter.ts から cause 削除
- [ ] game/logic/cards-internal/hand-manager.ts から判定削除
- [ ] game/logic/cards-internal/card-usage-prechecks.ts から判定削除
- [ ] game/ai/cpu-policy-core.ts から7参照削除
- [ ] game/cpu-decision.ts からプロファイル削除
- [ ] ui/animation-engine.ts から spawn 判定削除
- [ ] public/module-registry.js から14エントリ削除
- [ ] docs/teacher-cpu-card-usage-buckets.md 更新
- [ ] test/game.equality-will.test.ts 削除
- [ ] test/cards.equality-will-surfaces.test.ts 削除
- [ ] 他7テストファイルのフィクスチャ修正
- [ ] npm run generate:catalog 成功
- [ ] npm run typecheck 成功
- [ ] npm run worker:prepare 成功
- [ ] 3軸grepで実参照ゼロ確認
