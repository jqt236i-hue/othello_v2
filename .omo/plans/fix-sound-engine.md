# 効果音・BGM 復旧ワークプラン

## TL;DR

> **Quick Summary**: sound-engine と entry-browser 間の配線断絶を修復し、効果音 (SE) と BGM を再び再生可能にする
>
> **Deliverables**:
> - `sound-engine.ts` から重複した `_require` 宣言を削除
> - `entry-browser.js` に `window.SoundEngine` 代入を追加
> - `entry-browser-classic.js` に Object.assign + window.SoundEngine 代入を追加
> - `dist/` を再ビルド & `worker-public/` を同期
> - 全モジュールの重複 `_require` を除去する既存スクリプトを実行
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 4 → Task 6 → Final Verification

---

## Context

### Original Request
> 効果音とBGMが再生されない。昔は再生されていた。

### Interview Summary
**Root Cause Analysis**（ユーザー特定 + 実コード検証で確認）:

1. **`sound-engine.ts` に `const _require` の二重宣言**（lines 4-6 と 14-16）
   - `@ts-nocheck` により TSC が捕捉できず、`dist/sound-engine.js` にそのまま出力される
   - `dist/sound-engine.js` で `SyntaxError: Identifier '_require' has already been declared` が発生
   - `entry-browser.js` の `require("./dist/sound-engine")` が catch に入り、モジュールがロードされない

2. **`entry-browser.js` に `window.SoundEngine` 代入がない**
   - `Object.assign(window, { default: SoundEngine })` では `window.default` が生えるだけ
   - `window.SoundEngine` が undefined → `ui/handlers/sound.ts:13` の `resolveSoundEngine()` が常に null を返す → 全音声処理が early-return → 無音

3. **`entry-browser-classic.js` は Object.assign すら欠落**

4. **これは systemic な問題**: 他に 17 個の `.ts` ソースファイルが同じ `_require` 重複を持つ。`scripts/fix-duplicate-require.js` という既存修正スクリプトがビルドパイプラインに統合されていない。

**Affected files**:
| ファイル | 問題 | 状態 |
|---------|------|------|
| `sound-engine.ts:12-16` | `_require` 二重宣言 (lines 4-6 と 14-16) | **要修正** |
| `entry-browser.js:1134` | `Object.assign` のみ、`window.SoundEngine` なし | **要修正** |
| `entry-browser-classic.js:956-957` | 代入なし | **要修正** |
| `entry-browser-augmented.js:284` | 既に `window.SoundEngine = _mod135.default` あり | ✅ OK |
| `worker-public/entry-browser.js` | ミラー、root と同じ問題 | 自動同期で反映 |
| `dist/sound-engine.js` | ビルド成果物 | 再ビルドで反映 |
| 他の 17 `.ts` ファイル | 同種の `_require` 重複 | 既存スクリプトで対処 |

---

## Work Objectives

### Core Objective
効果音 (SE) と BGM が再び再生される状態に戻す。

### Concrete Deliverables
- `sound-engine.ts` から重複 `_require` ブロックを削除
- `entry-browser.js` に `window.SoundEngine` 適切な代入を追加
- `entry-browser-classic.js` に適切な代入を追加
- 再ビルド & 同期が完了した状態
- 他の全 dist モジュールの `_require` 重複も除去

### Definition of Done
- [x] ブラウザコンソールに `"[boot] skip dist/sound-engine:"` エラーが出ない
- [x] `typeof window.SoundEngine === 'object'`、`typeof window.SoundEngine.init === 'function'` が true
- [x] 石を置いたときに効果音が鳴る
- [x] BGM 再生/停止/音量調整が機能する
- [x] `npm run build:ts` がエラーなしで完了する
- [x] `worker-public/entry-browser.js` に同じ修正が反映されている

### Must Have
- sound-engine モジュールが構文エラーなくロードされる
- `window.SoundEngine` 経由で音声制御が利用可能になる
- SE と BGM の両方が動作する

### Must NOT Have (Guardrails)
- サウンドエンジンの内部動作や API を変更しない
- 新しい BGM トラックや効果音キーを追加しない
- `entry-browser-augmented.js` は変更しない（既に正しい）
- `dist/` ファイルを直接編集しない（ソースを直して再ビルド）
- 音声機能以外のコードに影響を与えない

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES（Jest）
- **Automated tests**: Tests-after
- **Framework**: Jest (bun test)
- **Existing test**: `test/sound-engine.default-bgm.test.ts`

### QA Policy
Agent-executed QA using browser console and curl/Playwright verification.

---

## Execution Strategy

```
Wave 1 (Parallel - source fixes):
├── Task 1: Fix sound-engine.ts - 重複 _require 削除
├── Task 2: Fix entry-browser.js - window.SoundEngine 代入追加
└── Task 3: Fix entry-browser-classic.js - window.SoundEngine 代入追加

Wave 2 (Sequential after Wave 1 - build & verify):
├── Task 4: npm run build:ts (dist 再生成)
├── Task 5: scripts/fix-duplicate-require.js 実行 (全モジュールの重複修正)
└── Task 6: npm run worker:prepare (worker-public 同期)

Wave FINAL (Verification):
└── Task F1: Plan compliance + QA verification
```

---

## TODOs

- [x] 1. `sound-engine.ts` の重複 `_require` 宣言を削除

  **What to do**:
  - `sound-engine.ts` の 12-16 行目（`declare const __non_webpack_require__` から `const _require` まで）のブロックを削除
  - 4-6 行目の `const _require` ブロックだけを残す（こちらが正当な単一宣言）
  - 11 行目の `import type` と 17 行目の空行を直接接続する

  **具体的な編集内容**:
  - lines 12-16 を削除:
    ```
    declare const __non_webpack_require__: NodeRequire | undefined;

    const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
      ? __non_webpack_require__
      : require;
    ```

  **Must NOT do**:
  - 4-6 行目の正当な宣言は削除しない
  - 他のコードは変更しない

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4 (build)
  - **Blocked By**: None

  **References**:
  - `sound-engine.ts:1-17` - 重複ブロックを含む全体像
  - `dist/sound-engine.js:1-8` - 重複が build artifact にどう現れているか

  **Acceptance Criteria**:
  - [ ] `sound-engine.ts` を読み、`declare const __non_webpack_require__` と `const _require` が 1 回だけ出現することを確認
  - [ ] `grep 'const _require' sound-engine.ts` → 1 行だけマッチ
  - [ ] 削除後もファイルが正常に parse できる

  **QA Scenarios**:
  ```
  Scenario: ソースファイルから重複が除去されたことを確認
    Tool: Bash (grep)
    Preconditions: 編集後
    Steps:
      1. grep -n "const _require" sound-engine.ts → 1行のみ出現する
      2. grep -n "declare const __non_webpack_require__" sound-engine.ts → 1行のみ出現する
    Expected Result: 両方とも 1 回だけ出現
    Evidence: .sisyphus/evidence/task-1-grep-result.txt

  Scenario: TypeScript の parse が通ることを確認
    Tool: Bash (npx tsc --noEmit sound-engine.ts または構文検査)
    Preconditions: 編集後
    Steps:
      1. npx tsc --noEmit --skipLibCheck sound-engine.ts 2>&1
    Expected Result: SyntaxError なし
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt
  ```

  **Commit**: YES
  - Message: `fix(sound-engine): remove duplicate const _require declaration`
  - Files: `sound-engine.ts`

- [x] 2. `entry-browser.js` に `window.SoundEngine` 代入を追加

  **What to do**:
  - `entry-browser.js` の 1134 行目 `if (_mod135) Object.assign(window, _mod135);` の直後に以下を追加:
    ```javascript
    if (_mod135 && _mod135.default) window.SoundEngine = _mod135.default;
    ```
  - `entry-browser-augmented.js:284` が既に正しいパターンを持っているので、それと同一にする

  **Must NOT do**:
  - 既存の `Object.assign` 行は削除しない（他の module エクスポート用に必要）
  - `entry-browser-augmented.js` は変更しない
  - `entry-browser-classic.js` とは別タスク

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 6 (worker:prepare の前提)
  - **Blocked By**: None

  **References**:
  - `entry-browser.js:1131-1137` - sound-engine load ブロック全体
  - `entry-browser-augmented.js:284` - 既に正しい実装 (参考パターン)
  - `ui/handlers/sound.ts:13` - この代入のコンシューマ

  **Acceptance Criteria**:
  - [ ] `entry-browser.js` の sound-engine ブロックに `window.SoundEngine = _mod135.default` がある
  - [ ] 構文エラーがない（`node --check entry-browser.js`）

  **QA Scenarios**:
  ```
  Scenario: 修正後の構文チェック
    Tool: Bash (node --check)
    Preconditions: 編集後
    Steps:
      1. node --check entry-browser.js
    Expected Result: exit code 0, no error output
    Evidence: .sisyphus/evidence/task-2-node-check.txt

  Scenario: 正しい代入が追加されたことを確認
    Tool: Bash (grep)
    Preconditions: 編集後
    Steps:
      1. grep -n "SoundEngine" entry-browser.js
    Expected Result: "window.SoundEngine = _mod135.default" を含む行が存在
    Evidence: .sisyphus/evidence/task-2-grep.txt
  ```

  **Commit**: YES (groups with Task 3)
  - Message: `fix(entry): add window.SoundEngine assignment for default export`
  - Files: `entry-browser.js`

- [x] 3. `entry-browser-classic.js` に Object.assign + `window.SoundEngine` 代入を追加

  **What to do**:
  - `entry-browser-classic.js:956` の `var _mod135 = require("./dist/sound-engine");` のあとに Object.assign と window.SoundEngine 代入の両方を追加:
    ```javascript
    if (_mod135) Object.assign(window, _mod135);
    if (_mod135 && _mod135.default) window.SoundEngine = _mod135.default;
    ```

  **Must NOT do**:
  - 他の entry-browser ファイルは変更しない（既に別タスク）

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `entry-browser-classic.js:954-959` - 現在の sound-engine ブロック
  - `entry-browser.js:1131-1137` - 正しいパターン (参考)

  **Acceptance Criteria**:
  - [ ] `entry-browser-classic.js` の sound-engine ブロックに Object.assign + window.SoundEngine がある
  - [ ] `node --check entry-browser-classic.js` が pass

  **QA Scenarios**:
  ```
  Scenario: 構文チェックと代入確認
    Tool: Bash (node --check + grep)
    Preconditions: 編集後
    Steps:
      1. node --check entry-browser-classic.js
      2. grep -n "SoundEngine" entry-browser-classic.js
    Expected Result: exit code 0, "window.SoundEngine = _mod135.default" が存在
    Evidence: .sisyphus/evidence/task-3-check.txt
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `fix(entry-classic): add Object.assign and window.SoundEngine assignment`
  - Files: `entry-browser-classic.js`

- [x] 4. `npm run build:ts` で dist を再ビルド

  **What to do**:
  - `npm run build:ts` を実行し、修正済み `sound-engine.ts` から新しい `dist/sound-engine.js` を生成する
  - 生成された `dist/sound-engine.js` で `const _require` が 1 回だけ出現することを確認
  - エラーなく完了することを確認

  **Must NOT do**:
  - dist ファイルを直接編集しない
  - 他のビルドスクリプトを実行しない

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (先に Task 1 が完了している必要あり)
  - **Blocks**: Task 5, Task 6
  - **Blocked By**: Task 1

  **References**:
  - `package.json` - `"build:ts": "tsc"` スクリプト

  **Acceptance Criteria**:
  - [ ] `npm run build:ts` が exit code 0 で完了
  - [ ] `dist/sound-engine.js` の `const _require` が 1 回だけ出現
  - [ ] `node -e "require('./dist/sound-engine')"` がエラーなく実行できる

  **QA Scenarios**:
  ```
  Scenario: ビルド成功確認
    Tool: Bash (npm run build:ts)
    Preconditions: Task 1 完了
    Steps:
      1. npm run build:ts 2>&1
    Expected Result: exit code 0, No compilation errors
    Evidence: .sisyphus/evidence/task-4-build.txt

  Scenario: dist/sound-engine.js の構文チェック
    Tool: Bash (node -e)
    Preconditions: ビルド完了
    Steps:
      1. node -e "require('./dist/sound-engine')" 2>&1
    Expected Result: SyntaxError なし
    Evidence: .sisyphus/evidence/task-4-require-check.txt

  Scenario: 重複が解消されたことを確認
    Tool: Bash (grep)
    Preconditions: ビルド完了
    Steps:
      1. grep -c "const _require" dist/sound-engine.js
    Expected Result: 1 (1回のみ)
    Evidence: .sisyphus/evidence/task-4-dedup-check.txt
  ```

  **Commit**: YES (groups with Task 5, 6)
  - Message: `chore: rebuild dist after sound-engine.ts fix`
  - Files: `dist/sound-engine.js` (and other rebuilt dist files)

- [x] 5. `scripts/fix-duplicate-require.js` を実行し、全 dist モジュールの重複 `_require` を除去

  **What to do**:
  - `node scripts/fix-duplicate-require.js` を実行
  - このスクリプトは dist/ 以下の全ファイルを走査し、重複した `_require` 宣言と `"use strict"` ディレクティブを除去する
  - これにより、sound-engine 以外のモジュール（ui.ts, status-display.ts 等 17 ファイル由来の dist）の同種のバグも同時に修正される
  - 実行後、`dist/` 下の全 `.js` ファイルで `const _require` の重複がないことをスポットチェック

  **Must NOT do**:
  - スクリプトを変更しない（既存のものをそのまま使う）
  - このスクリプトが dist ファイルを壊していないことを確認する

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (Task 4 の後)
  - **Blocks**: Task 6
  - **Blocked By**: Task 4

  **References**:
  - `scripts/fix-duplicate-require.js` - 既存の修正スクリプト

  **Acceptance Criteria**:
  - [ ] `node scripts/fix-duplicate-require.js` が exit code 0 で完了
  - [ ] `grep -c "const _require" dist/*.js` で 1 を超えるファイルがなくなった（2 回以上出現しなくなった）
  - [ ] `node -e "require('./dist/sound-engine')"` が依然として動作する

  **QA Scenarios**:
  ```
  Scenario: 重複除去スクリプトの実行
    Tool: Bash
    Preconditions: Task 4 完了
    Steps:
      1. node scripts/fix-duplicate-require.js 2>&1
    Expected Result: exit code 0
    Evidence: .sisyphus/evidence/task-5-script-output.txt

  Scenario: 全 dist ファイルで重複が除去されたことを確認
    Tool: Bash (grep -c)
    Preconditions: スクリプト実行後
    Steps:
      1. grep -c "const _require" dist/*.js | grep -v ":1$" | grep -v "\.d\.ts"
    Expected Result: 出力なし（すべてのファイルで 1 回のみ）
    Evidence: .sisyphus/evidence/task-5-global-check.txt
  ```

  **Commit**: YES (groups with Task 4, 6)
  - Message: `fix: remove duplicate _require declarations across all dist modules`
  - Files: (affected dist files)

- [x] 6. `npm run worker:prepare` で worker-public を同期

  **What to do**:
  - `npm run worker:prepare` を実行
  - これにより root の `entry-browser.js` が `worker-public/entry-browser.js` にコピーされる
  - `worker-public/entry-browser.js` に Task 2 で追加した修正が含まれていることを確認

  **Must NOT do**:
  - `worker-public/` を直接編集しない

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (Tasks 4, 5 が完了している必要あり)
  - **Blocks**: Final Verification
  - **Blocked By**: Tasks 4, 5

  **References**:
  - `package.json` - `"worker:dev"` と `"worker:deploy"` が `worker:prepare` に依存
  - `scripts/prepare-worker-assets.ts` - 同期スクリプト本体

  **Acceptance Criteria**:
  - [ ] `npm run worker:prepare` が exit code 0 で完了
  - [ ] `worker-public/entry-browser.js` に `window.SoundEngine = _mod135.default` が存在
  - [ ] `worker-public/entry-browser.js` と `entry-browser.js` の当該セクションが一致

  **QA Scenarios**:
  ```
  Scenario: worker:prepare 実行
    Tool: Bash
    Preconditions: Tasks 4, 5 完了
    Steps:
      1. npm run worker:prepare 2>&1
    Expected Result: exit code 0
    Evidence: .sisyphus/evidence/task-6-prepare.txt

  Scenario: worker-public に修正が反映されたことを確認
    Tool: Bash (grep)
    Preconditions: worker:prepare 完了
    Steps:
      1. grep -n "SoundEngine" worker-public/entry-browser.js
    Expected Result: "window.SoundEngine = _mod135.default" の行が存在
    Evidence: .sisyphus/evidence/task-6-mirror-check.txt
  ```

  **Commit**: YES (groups with Tasks 4, 5)
  - Message: `chore: sync worker-public after entry-browser fix`
  - Files: (worker-public entry-browser.js and other synced files)

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. Verify:
  - Every task's acceptance criteria are met
  - `dist/sound-engine.js` loads without SyntaxError
  - `window.SoundEngine` is properly set in all entry files
  - worker-public is in sync
  Output: `VERDICT: APPROVE/REJECT`

- [x] F2. **Sound Engine QA** — Agent executes browser verification
  - Start dev server
  - Open browser, open console
  - Verify no `"[boot] skip dist/sound-engine:"` error
  - Verify `typeof window.SoundEngine === 'object'` and `typeof window.SoundEngine.init === 'function'`
  - Trigger a sound effect (place a stone)
  - Verify BGM play/pause controls
  Output: `QA [N/N pass] | VERDICT: PASS/FAIL`

---

## Commit Strategy

| Tasks | Message | Scope |
|-------|---------|-------|
| 1 | `fix(sound-engine): remove duplicate const _require declaration` | sound-engine.ts |
| 2, 3 | `fix(entry): add window.SoundEngine assignment for default export` | entry-browser.js, entry-browser-classic.js |
| 4, 5, 6 | `fix: rebuild dist, remove duplicate requires, sync worker-public` | dist/*, worker-public/* |

---

## Success Criteria

### Verification Commands
```bash
# 1. dist/sound-engine.js が構文的に正しいことを確認
node -e "require('./dist/sound-engine')"
# Expected: エラーなし（undefined が返るが問題ない）

# 2. window.SoundEngine が設定されていることを確認（ブラウザコンソール）
# typeof window.SoundEngine → "object"
# typeof window.SoundEngine.init → "function"

# 3. 重複 _require がないことを確認
grep -c "const _require" dist/*.js | grep -v ":1$"
# Expected: 出力なし（すべて 1 回のみ）
```

### Final Checklist
- [x] ブラウザに `"[boot] skip dist/sound-engine:"` エラーが表示されない
- [x] 石を置くと効果音が鳴る
- [x] BGM が再生される（再生/停止/音量調整が機能）
- [x] ミュートトグルが機能する
- [x] `npm run build:ts` がエラーなく完了
- [x] `worker-public/entry-browser.js` に修正が反映されている
