# Plan: 背景スキン選択の配線修復

## TL;DR

> **Quick Summary**: `entry-browser.js` と `worker-public/entry-browser.js` において、background-skin の selection/runtime モジュールが `window` に登録されていないため `setupBackgroundSkinControls()` が `null` を返し、「背景」タブが無効になっている。hand-skin と同じパターンでモジュール登録を追加する。

> **Deliverables**:
> - `entry-browser.js` — 3箇所に `window.BackgroundSkinSelectionModule` / `window.BackgroundSkinRuntimeModule` の代入を追加
> - `worker-public/entry-browser.js` — 同上

> **Estimated Effort**: Quick（1ファイルあたり3行×3箇所 = 9行追加、全18行）
> **Parallel Execution**: NO — 2ファイルだが独立しているため並行可能
> **Critical Path**: 全タスク独立（同時実行可能）

---

## Context

### Original Request
「昔はハンドスキンのほかに背景スキンも選べたが、今は何もない。実装はあるが回路が繋がれていない。」

### Interview Summary
- 背景スキンの実装（catalog/selection/runtime/controller）は `ui/background-skin/` に完全に存在する
- HTML にも `#backgroundSkinSection` / `#backgroundSkinOptions` / `#appearanceTabBackground` の要素が存在する
- hand-skin の「手」タブは正常動作している
- 根本原因は entry-browser.js でのモジュール登録漏れ
- classic.js / augmented.js はスコープ外（hand-skin も同様に未登録のため、別途対応）

### Metis Review
- ルート原因の確認：**正しい**
- 追加発見：`entry-browser-classic.js` / `entry-browser-augmented.js` は全モジュールの `window.*Module` 代入が欠落（hand-skin 含む）。これらの修正は本プランのスコープ外と合意済み
- `worker-public/entry-browser.js` は root と同一構造であることを確認済み

---

## Work Objectives

### Core Objective
background-skin selection/runtime モジュールを `window` に登録し、`setupBackgroundSkinControls()` が正常にモジュールを解決できるようにする。

### Concrete Deliverables
1. `entry-browser.js` に3箇所のモジュール登録追加
2. `worker-public/entry-browser.js` に同内容のモジュール登録追加
3. `ui/background-skin/catalog.ts` + `dist/ui/background-skin/catalog.js` の画像パス修正（`background-skin/` → `background/`）

### Definition of Done
- [ ] `entry-browser.js` の初期ロードブロックで `window.BackgroundSkinSelectionModule` / `window.BackgroundSkinRuntimeModule` が代入されている
- [ ] `entry-browser.js` の遅延ロードフォールバックブロックで両モジュールが try/catch require されている
- [ ] `entry-browser.js` の最終アサーションブロックで両モジュールが代入されている
- [ ] `worker-public/entry-browser.js` に上記3箇所全ての修正が反映されている（同じ内容）

### Must Have
- background-skin controller が `window.BackgroundSkinSelectionModule` と `window.BackgroundSkinRuntimeModule` を解決できること

### Must NOT Have (Guardrails)
- hand-skin の既存のモジュール登録行を変更・移動・削除しない
- `module-registry.js` を編集しない
- `entry-browser-classic.js` を編集しない（本スコープ外）
- `entry-browser-augmented.js` を編集しない（本スコープ外）
- `scripts/augment-entry*.js`（生成スクリプト）を編集しない

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES（Jest）
- **Automated tests**: None（ユーザー合意済み）
- **Agent-Executed QA**: Playwright でブラウザ動作確認

### QA Policy
Agent-Executed QA Scenarios により、修正後にブラウザで実際に「背景」タブが動作することを確認する。

---

## Execution Strategy

### Parallel Execution

```
Wave 1 (独立タスク、同時実行):
├── Task 1: entry-browser.js 修正 (3箇所)
├── Task 2: worker-public/entry-browser.js 修正 (3箇所、内容同一)
└── Task 3: 背景スキンカタログの画像パス修正

Wave FINAL (QA 確認):
└── Task F1: Playwright でブラウザ動作確認
```

---

## TODOs

> 各タスクは独立して同時実行可能。

- [x] 1. `entry-browser.js` に window モジュール登録を追加

  **What to do**:
  以下の3箇所に、background-skin の selection/runtime モジュールを `window` に登録する行を追加する。

  **箇所1 — 初期ロードブロック（L1840-1854 付近）**:
  ```javascript
  // dist/ui/background-skin/selection
  try {
    var _mod222 = require("./dist/ui/background-skin/selection");
    if (_mod222) Object.assign(window, _mod222);
    if (_mod222) window.BackgroundSkinSelectionModule = _mod222;  // ← 追加
  } catch (e) {
    console.warn("[boot] skip " + "dist/ui/background-skin/selection: " + e.message);
  }

  // dist/ui/background-skin/runtime
  try {
    var _mod223 = require("./dist/ui/background-skin/runtime");
    if (_mod223) Object.assign(window, _mod223);
    if (_mod223) window.BackgroundSkinRuntimeModule = _mod223;  // ← 追加
  } catch (e) {
    console.warn("[boot] skip " + "dist/ui/background-skin/runtime: " + e.message);
  }
  ```

  **箇所2 — 遅延ロードフォールバックブロック（L2015-2018 付近）**:
  ```javascript
  // Background skin
  try { window.BackgroundSkinCatalogModule = window.BackgroundSkinCatalogModule || require("./dist/ui/background-skin/catalog"); } catch (e) {}
  try { window.BackgroundSkinSelectionModule = window.BackgroundSkinSelectionModule || require("./dist/ui/background-skin/selection"); } catch (e) {}  // ← 追加
  try { window.BackgroundSkinRuntimeModule = window.BackgroundSkinRuntimeModule || require("./dist/ui/background-skin/runtime"); } catch (e) {}  // ← 追加
  try { window.BackgroundSkinControllerModule = window.BackgroundSkinControllerModule || require("./dist/ui/background-skin/controller"); } catch (e) {}
  ```

  **箇所3 — 最終アサーションブロック（L2085-2086 付近）**:
  ```javascript
  if (typeof _mod221 !== "undefined" && _mod221) window.BackgroundSkinCatalogModule = _mod221;
  if (typeof _mod222 !== "undefined" && _mod222) window.BackgroundSkinSelectionModule = _mod222;  // ← 追加
  if (typeof _mod223 !== "undefined" && _mod223) window.BackgroundSkinRuntimeModule = _mod223;  // ← 追加
  if (typeof _mod224 !== "undefined" && _mod224) window.BackgroundSkinControllerModule = _mod224;
  ```

  **Must NOT do**:
  - 既存の hand-skin モジュール行（`_mod225`〜`_mod229`）を変更しない
  - `module-registry.js` を編集しない

  **Recommended Agent Profile**:
  - **Category**: `quick`（単純な行追加、既存パターンに従うのみ）
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（Task 2 と同時実行）
  - **Blocks**: Task F1
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `entry-browser.js` 編集後、3箇所全ての修正が正しく適用されている（目視または diff 確認）
  - [ ] 構文エラーがない（`node --check entry-browser.js`）

  **QA Scenarios**:
  ```
  Scenario: 修正後のブラウザでコンソール確認
    Tool: Bash（node --check）
    Preconditions: 編集後の entry-browser.js が存在する
    Steps:
      1. node --check entry-browser.js → 構文エラーがないことを確認
      2. grep で window.BackgroundSkinSelectionModule の代入が3箇所存在することを確認
      3. grep で window.BackgroundSkinRuntimeModule の代入が3箇所存在することを確認
    Expected Result: node --check が成功、各モジュールの代入が3箇所ずつ存在
    Evidence: .sisyphus/evidence/task-1-entry-browser-check.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-1-entry-browser-check.txt`

  **Commit**: YES
  - Message: `fix(entry): register BackgroundSkinSelectionModule and BackgroundSkinRuntimeModule on window`
  - Files: `entry-browser.js`, `worker-public/entry-browser.js`

---

- [x] 2. `worker-public/entry-browser.js` に window モジュール登録を追加

- [x] 3. 背景スキンカタログの画像パスを修正

  **What to do**:
  `ui/background-skin/catalog.ts` の `BASE_BACKGROUND_SKINS` で、「観測の机」の `imagePath` が誤ったパスを参照している。
  現在 `'assets/images/background-skin/観測の机.png'` になっているが、正しいパスは `'assets/images/background/観測の机.png'` であるため修正する。
  
  また、コンパイル済みの `dist/ui/background-skin/catalog.js` も同様に修正する（またはビルドを実行する）。

  **修正箇所**:
  `ui/background-skin/catalog.ts` L52:
  ```typescript
  // 修正前:
  imagePath: 'assets/images/background-skin/観測の机.png'
  // 修正後:
  imagePath: 'assets/images/background/観測の机.png'
  ```

  `dist/ui/background-skin/catalog.js` L17（同内容）:
  ```javascript
  // 修正前:
  imagePath: 'assets/images/background-skin/観測の机.png'
  // 修正後:
  imagePath: 'assets/images/background/観測の机.png'
  ```

  **Must NOT do**:
  - `default` スキンの `default.png` パスは変更しない（正しい）
  - `assets/asset-manifest.json` は編集しない（ビルド成果物）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（Task 1, 2 と同時実行）
  - **Blocks**: なし
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `ui/background-skin/catalog.ts` の imagePath が `'assets/images/background/観測の机.png'` に修正されている
  - [ ] `dist/ui/background-skin/catalog.js` の imagePath が `'assets/images/background/観測の机.png'` に修正されている

  **QA Scenarios**:
  ```
  Scenario: 修正後のパス確認
    Tool: Bash（grep）
    Preconditions: 修正後の両ファイルが存在する
    Steps:
      1. grep "観測の机" ui/background-skin/catalog.ts → "assets/images/background/観測の机.png" を確認
      2. grep "観測の机" dist/ui/background-skin/catalog.js → "assets/images/background/観測の机.png" を確認
      3. grep "background-skin/観測の机" で該当ファイルが修正済み（ヒットなし）であることを確認
    Expected Result: 両ファイルのパスが正しく修正され、background-skin/ の旧パスが残っていない
    Evidence: .sisyphus/evidence/task-3-catalog-path-check.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-3-catalog-path-check.txt`

  **Commit**: YES（Task 1-2 と同コミットにグループ）
  - Message: `fix(catalog): correct background skin image path for 観測の机`
  - Files: `ui/background-skin/catalog.ts`, `dist/ui/background-skin/catalog.js`

  **What to do**:
  `entry-browser.js` と全く同じ修正を `worker-public/entry-browser.js` に適用する。
  修正内容（3箇所）は Task 1 と同一。

  **Must NOT do**:
  - 既存の hand-skin モジュール行を変更しない
  - `worker-public/public/module-registry.js` を編集しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（Task 1 と同時実行）
  - **Blocks**: Task F1
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `worker-public/entry-browser.js` 編集後、3箇所全ての修正が正しく適用されている
  - [ ] 構文エラーがない（`node --check worker-public/entry-browser.js`）

  **QA Scenarios**:
  ```
  Scenario: 修正後の構文チェック
    Tool: Bash（node --check）
    Preconditions: 編集後の worker-public/entry-browser.js が存在する
    Steps:
      1. node --check worker-public/entry-browser.js → PASS
      2. grep で BackgroundSkinSelectionModule / BackgroundSkinRuntimeModule が3箇所ずつ存在することを確認
    Expected Result: 構文エラーなし、各モジュール3箇所ずつ登録
    Evidence: .sisyphus/evidence/task-2-worker-entry-check.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-2-worker-entry-check.txt`

  **Commit**: YES（Task 1 と同コミットにグループ）

---

## Final Verification Wave

- [x] F1. **Playwright でブラウザ動作確認**

  **What to do**:
  修正後のファイルで実際にブラウザを開き、背景スキンが選択可能かつ適用されることを確認する。

  **QA Scenarios**:
  ```
  Scenario 1: モジュールが window に登録されている
    Tool: Playwright
    Preconditions: アプリケーションが localhost で稼働中
    Steps:
      1. ブラウザでアプリケーションを開く
      2. コンソールで以下を実行:
         window.BackgroundSkinSelectionModule !== undefined
         window.BackgroundSkinRuntimeModule !== undefined
    Expected Result: 両方とも true（モジュールが解決可能）
    Evidence: .sisyphus/evidence/task-F1-module-registration.txt

  Scenario 2: SKIN ボタン → 「背景」タブが表示される
    Tool: Playwright
    Preconditions: アプリケーションが稼働中
    Steps:
      1. SKIN ボタン（#handSkinBtn）をクリック
      2. 「背景」タブ（#appearanceTabBackground）が visible であることを確認
      3. 「背景」タブをクリック
      4. #backgroundSkinOptions 内に .background-skin-option 要素が存在することを確認
    Expected Result: 背景タブが表示され、オプション（少なくとも「既定背景」と「観測の机」）が選択可能
    Evidence: .sisyphus/evidence/task-F1-background-tab.txt

  Scenario 3: 「手」タブが引き続き動作する（リグレッションチェック）
    Tool: Playwright
    Preconditions: 同上
    Steps:
      1. SKIN ボタン（#handSkinBtn）をクリック
      2. 「手」タブ（#appearanceTabHand）が visible であることを確認
      3. #handSkinOptions 内に .hand-skin-option 要素が存在することを確認
    Expected Result: 手タブが正常に動作、オプションが表示される
    Evidence: .sisyphus/evidence/task-F1-hand-tab-regression.txt
  ```

---

## Commit Strategy

- **1-3**（同一コミット）: `fix(entry): register BackgroundSkin*Module on window and correct catalog image path` — `entry-browser.js`, `worker-public/entry-browser.js`, `ui/background-skin/catalog.ts`, `dist/ui/background-skin/catalog.js`

---

## Success Criteria

### Final Checklist
- [x] `entry-browser.js` 修正完了（3箇所、構文エラーなし）
- [x] `worker-public/entry-browser.js` 修正完了（3箇所、構文エラーなし）
- [x] `ui/background-skin/catalog.ts` の画像パス修正完了
- [x] `dist/ui/background-skin/catalog.js` の画像パス修正完了
- [x] Playwright で「背景」タブが表示・選択可能であることを確認済み
- [x] 「手」タブが引き続き動作することを確認済み（リグレッションなし）
