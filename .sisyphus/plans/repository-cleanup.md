# リポジトリクリーンアップ作業計画

## TL;DR

> **目標**: カードオセロリポジトリの安全なクリーンアップ
> 
> **削除対象**: ~4,200ファイル（Git追跡解除 + 物理削除）
> - Phase 1: ビルド成果物の追跡解除（~4,000ファイル）
> - Phase 2: 重複ディレクトリ削除（108ファイル）
> - Phase 3: ルートJS/TSペア整理（11ファイル）
> - Phase 4: 一時ファイル・ログ削除（~100ファイル）
> 
> **推定削減効果**: 7,112ファイル → ~2,900ファイル（59%削減）
> **並列実行**: Phase 2-4は並列可能
> **Critical Path**: Phase 1 → Phase 2-4並列 → Phase 5（最終確認）

---

## Context

### 調査結果の要約
4並列エージェント調査により以下が特定されました：

| カテゴリ | ファイル数 | リスク |
|---------|----------|--------|
| `dist/`（ビルド出力） | 3,776ファイル追跡中 | 🟢 低（再生成可能） |
| `coverage/`（テストカバレッジ） | 182ファイル追跡中 | 🟢 低（再生成可能） |
| `.wrangler/`（Wranglerキャッシュ） | 76ファイル追跡中 | 🟢 低（自動生成） |
| `tmp/`（一時ファイル） | 42エントリ | 🟢 低（一時的） |
| `ai/train/__pycache__/` | 14ファイル追跡中 | 🟢 低（自動生成） |
| `.playwright-mcp/` PNG | 7ファイル追跡中 | 🟢 低（スクリーンショット） |
| 重複ディレクトリ | 108ファイル | 🟡 中（参照確認要） |
| ルートJS/TSペア | 11ファイル | 🟡 中（参照確認要） |
| 一時ファイル・ログ | ~100ファイル | 🟢 低（不要） |

### Metisレビューによる重要指摘
1. **JS/TSペア削除はルートJS（11ファイル）のみにスコープ限定** - game/以下のJS/TSペアは別計画として分離
2. **dist/追跡解除は単独コミットで実行** - 3,776ファイルの変更を他と混ぜない
3. **削除不可ファイルの明示的除外** - `entry-browser.js`, `ui/layout-stage.js` など（TS版が存在しない）
4. **各Phase完了後にコミット** - 問題切り分けのため

---

## Work Objectives

### Core Objective
リポジトリから安全に削除可能なファイルを特定し、段階的に削除してリポジトリをクリーンアップする。

### Concrete Deliverables
- `.gitignore` の更新（不足パターンの追加）
- Git追跡からのビルド成果物解除（dist/, coverage/, .wrangler/ など）
- 重複ディレクトリの削除（game/logic/game/, game/cards/game/, game/game/）
- ルートJS/TSペアの整理（11ファイル）
- 一時ファイル・ログ・スクリーンショットの削除
- 最終動作確認（build, test, worker:prepare）

### Definition of Done
- [ ] `git status` で予期しない変更がない
- [ ] `npm run build:ts` が成功
- [ ] `npm run test:jest` が成功
- [ ] `npm run worker:prepare` が成功
- [ ] リポジトリサイズが削減されている

### Must Have
- すべての削除は安全（再生成可能または参照なし）
- 各Phaseは独立してコミット可能
- 最終確認でビルド・テストが成功

### Must NOT Have (Guardrails)
- **削除禁止**: `entry-browser.js`, `entry-browser-classic.js`, `entry-browser-augmented.js`, `ui/layout-stage.js`（TS版が存在しない）
- **削除禁止**: `node_modules/`, `01-rulebook.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- **削除禁止**: `cards/catalog.json`, `game/`, `ui/`, `workers/`（コアソース）
- **game/以下のJS/TSペアは削除しない**（別計画として分離）
- **worker-public/全体は削除しない**（ミラーとして定義済み）
- **assets/内の画像は一括削除しない**（個別確認が必要）

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES（Jest, TypeScript）
- **Automated tests**: YES（Tests after）
- **Framework**: Jest（`npm run test:jest`）
- **Agent-Executed QA**: 各Phase完了後にビルド・テストを実行

### QA Policy
すべてのPhaseにAgent-Executed QAシナリオを含める：

- **ビルド確認**: `npm run build:ts` → 成功確認
- **テスト確認**: `npm run test:jest` → 全テストPASS確認
- **Worker確認**: `npm run worker:prepare` → 成功確認
- **Git確認**: `git status` → 予期しない変更がない確認

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - .gitignore更新 + 追跡解除):
├── Task 1: .gitignore更新（dist/, coverage/, .wrangler/, tmp/ 追加）
├── Task 2: dist/追跡解除（単独コミット）
├── Task 3: coverage/追跡解除
├── Task 4: .wrangler/追跡解除
├── Task 5: ai/train/__pycache__/追跡解除
└── Task 6: .playwright-mcp/追跡解除

Wave 2 (Cleanup - 並列実行可能):
├── Task 7: 重複ディレクトリ削除（game/logic/game/, game/cards/game/, game/game/）
├── Task 8: ルートJS/TSペア整理（11ファイル）
├── Task 9: 一時ファイル・ログ削除（~100ファイル）
└── Task 10: worker-public孤児ファイル削除

Wave 3 (Integration + Verification):
├── Task 11: npm run build:ts 実行確認
├── Task 12: npm run test:jest 実行確認
├── Task 13: npm run worker:prepare 実行確認
└── Task 14: git status 最終確認

Wave FINAL (Review):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review
├── Task F3: Real manual QA
└── Task F4: Scope fidelity check
```

### Dependency Matrix

- **1-6**: - → 7-10, 2
- **7**: 1 → 11, 3
- **8**: 1 → 11, 3
- **9**: 1 → 11, 3
- **10**: 1 → 13, 3
- **11**: 7, 8, 9 → 12, 4
- **12**: 11 → 13, 4
- **13**: 10, 12 → 14, 4
- **14**: 13 → F1-F4, 5

---

## TODOs

- [ ] 1. **.gitignore更新 - ビルド成果物パターン追加**

  **What to do**:
  - `.gitignore` に以下のパターンを追加:
    ```
    # Build outputs
    dist/
    coverage/
    
    # Cloudflare Wrangler cache
    .wrangler/
    
    # Playwright MCP artifacts
    .playwright-mcp/page-*.png
    .playwright-mcp/*.txt
    
    # Python cache
    **/__pycache__/
    
    # Temporary files
    tmp/
    
    # Tool runtimes
    .opencode/
    ```
  - 既存の `.gitignore` と重複がないか確認

  **Must NOT do**:
  - `!ai/train/**` の前に `**/__pycache__/` を追加しない（打ち消される）
  - 既存のパターンを削除しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: 単純なファイル編集

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 2-6
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `.gitignore` に新しいパターンが追加されている
  - [ ] `git check-ignore -v dist/` で無視されることを確認
  - [ ] `git check-ignore -v coverage/` で無視されることを確認

  **QA Scenarios**:
  ```
  Scenario: .gitignoreが正しく更新された
    Tool: Bash
    Preconditions: .gitignoreが存在
    Steps:
      1. cat .gitignore | grep "^dist/$"
      2. cat .gitignore | grep "^coverage/$"
      3. cat .gitignore | grep "^\.wrangler/$"
    Expected Result: 各パターンが存在
    Evidence: .sisyphus/evidence/task-1-gitignore-updated.txt
  ```

  **Commit**: YES
  - Message: `chore(gitignore): add build artifact patterns`
  - Files: `.gitignore`

---

- [ ] 2. **dist/ディレクトリのGit追跡解除（単独コミット）**

  **What to do**:
  - `git rm -r --cached dist/` で追跡解除
  - 作業ディレクトリから `dist/` を削除
  - **注意**: 単独コミットとして実行（3,776ファイルの変更を他と混ぜない）

  **Must NOT do**:
  - `dist/` 内のファイルを個別に削除しない（一括で対応）
  - 他の変更と同じコミットにしない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Git操作の単純な実行

  **Parallelization**:
  - **Can Run In Parallel**: NO（Task 1完了後、単独実行）
  - **Parallel Group**: Wave 1（単独）
  - **Blocks**: Task 3-6
  - **Blocked By**: Task 1

  **Acceptance Criteria**:
  - [ ] `git status` で `dist/` が untracked として表示されない（無視される）
  - [ ] `git status` で `dist/` に関する modified/deleted が表示されない
  - [ ] 作業ディレクトリに `dist/` が存在しない

  **QA Scenarios**:
  ```
  Scenario: dist/が追跡解除された
    Tool: Bash
    Preconditions: Task 1完了
    Steps:
      1. git rm -r --cached dist/
      2. rm -rf dist/
      3. git status | grep -c "dist/"
    Expected Result: 0（dist/に関する出力なし）
    Evidence: .sisyphus/evidence/task-2-dist-removed.txt
  ```

  **Commit**: YES（単独コミット）
  - Message: `chore(cleanup): remove dist/ from git tracking`
  - Files: `dist/`（追跡解除）

---

- [ ] 3. **coverage/ディレクトリのGit追跡解除**

  **What to do**:
  - `git rm -r --cached coverage/` で追跡解除
  - 作業ディレクトリから `coverage/` を削除

  **Must NOT do**:
  - テストカバレッジの設定ファイルを削除しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（Task 2完了後）
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: Task 1, Task 2

  **Acceptance Criteria**:
  - [ ] `git status` で `coverage/` が無視される
  - [ ] 作業ディレクトリに `coverage/` が存在しない

  **QA Scenarios**:
  ```
  Scenario: coverage/が追跡解除された
    Tool: Bash
    Steps:
      1. git rm -r --cached coverage/
      2. rm -rf coverage/
      3. git status | grep -c "coverage/"
    Expected Result: 0
    Evidence: .sisyphus/evidence/task-3-coverage-removed.txt
  ```

  **Commit**: YES
  - Message: `chore(cleanup): remove coverage/ from git tracking`

---

- [ ] 4. **.wrangler/ディレクトリのGit追跡解除**

  **What to do**:
  - `git rm -r --cached .wrangler/` で追跡解除
  - 作業ディレクトリから `.wrangler/` を削除

  **Must NOT do**:
  - `wrangler.toml` を削除しない（設定ファイルは必要）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（Task 2完了後）
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: Task 1, Task 2

  **Acceptance Criteria**:
  - [ ] `git status` で `.wrangler/` が無視される
  - [ ] 作業ディレクトリに `.wrangler/` が存在しない

  **QA Scenarios**:
  ```
  Scenario: .wrangler/が追跡解除された
    Tool: Bash
    Steps:
      1. git rm -r --cached .wrangler/
      2. rm -rf .wrangler/
      3. git status | grep -c "\.wrangler/"
    Expected Result: 0
    Evidence: .sisyphus/evidence/task-4-wrangler-removed.txt
  ```

  **Commit**: YES
  - Message: `chore(cleanup): remove .wrangler/ from git tracking`

---

- [ ] 5. **ai/train/__pycache__/のGit追跡解除**

  **What to do**:
  - `git rm -r --cached ai/train/__pycache__/` で追跡解除
  - `git rm -r --cached ai/train/models/__pycache__/` で追跡解除
  - 作業ディレクトリから削除

  **Must NOT do**:
  - Pythonソースファイル（.py）を削除しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（Task 2完了後）
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: Task 1, Task 2

  **Acceptance Criteria**:
  - [ ] `git status` で `__pycache__/` が無視される
  - [ ] Pythonファイルは削除されていない

  **QA Scenarios**:
  ```
  Scenario: __pycache__/が追跡解除された
    Tool: Bash
    Steps:
      1. git rm -r --cached ai/train/__pycache__/
      2. git rm -r --cached ai/train/models/__pycache__/
      3. git status | grep -c "__pycache__/"
    Expected Result: 0
    Evidence: .sisyphus/evidence/task-5-pycache-removed.txt
  ```

  **Commit**: YES
  - Message: `chore(cleanup): remove Python cache from git tracking`

---

- [ ] 6. **.playwright-mcp/ PNGファイルのGit追跡解除**

  **What to do**:
  - `git rm -r --cached .playwright-mcp/page-*.png` で追跡解除
  - 作業ディレクトリから削除

  **Must NOT do**:
  - `.yml` ファイルを削除しない（テスト設定）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（Task 2完了後）
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: Task 1, Task 2

  **Acceptance Criteria**:
  - [ ] PNGファイルが追跡解除されている
  - [ ] `.yml` ファイルは残っている

  **QA Scenarios**:
  ```
  Scenario: Playwright PNGが追跡解除された
    Tool: Bash
    Steps:
      1. git rm -r --cached .playwright-mcp/page-*.png
      2. git status | grep "\.playwright-mcp/"
    Expected Result: 出力なし（または.ymlのみ）
    Evidence: .sisyphus/evidence/task-6-playwright-removed.txt
  ```

  **Commit**: YES
  - Message: `chore(cleanup): remove Playwright screenshots from git tracking`

---

- [x] 7. **重複ディレクトリの削除（game/logic/game/, game/cards/game/, game/game/）**

  **What to do**:
  - `rg` で各ディレクトリへの参照を確認:
    ```bash
    rg "game/logic/game/" --type js --type ts
    rg "game/cards/game/" --type js --type ts
    rg "game/game/" --type js --type ts
    ```
  - 参照がゼロなら各ディレクトリを削除:
    ```bash
    rm -rf game/logic/game/
    rm -rf game/cards/game/
    rm -rf game/game/
    ```

  **Must NOT do**:
  - 参照があるファイルを削除しない
  - `game/logic/`（正本）を削除しない

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 参照確認が必要で、慎重に実行する必要がある

  **Parallelization**:
  - **Can Run In Parallel**: YES（Wave 1完了後）
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 11
  - **Blocked By**: Task 1-6

  **Acceptance Criteria**:
  - [ ] `rg` で参照がゼロであることを確認
  - [ ] 各ディレクトリが削除されている
  - [ ] `npm run build:ts` が成功

  **QA Scenarios**:
  ```
  Scenario: 重複ディレクトリが安全に削除された
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. rg "game/logic/game/" --type js --type ts | wc -l
      2. rg "game/cards/game/" --type js --type ts | wc -l
      3. rg "game/game/" --type js --type ts | wc -l
    Expected Result: すべて0
    Evidence: .sisyphus/evidence/task-7-dup-dirs-removed.txt
  ```

  **Commit**: YES
  - Message: `chore(cleanup): remove duplicate nested directories`

---

- [x] 8. **ルートJS/TSペアの整理（11ファイル）**

  **What to do**:
  - 以下の11ファイルの `.js` を削除（`.ts` は残す）:
    - `analyze-crystal-stone-quiet.js`
    - `analyze-crystal-stone.js`
    - `analyze-destroy-cycle.js`
    - `analyze-selfplay-moves.js`
    - `analyze-trap-will.js`
    - `card-system.js`
    - `game-events.js`
    - `is-env-capable.js`
    - `shared-constants.js`
    - `sound-engine.js`
    - `ui.js`
  - **注意**: `index.html` や他のファイルがこれらの `.js` を直接参照していないか確認

  **Must NOT do**:
  - `.ts` ファイルを削除しない
  - `entry-browser.js`, `ui/layout-stage.js` を削除しない（TS版が存在しない）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 参照確認が必要

  **Parallelization**:
  - **Can Run In Parallel**: YES（Wave 1完了後）
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 11
  - **Blocked By**: Task 1-6

  **Acceptance Criteria**:
  - [ ] `rg "(analyze-crystal-stone|card-system|game-events|is-env-capable|shared-constants|sound-engine|ui)\.js"` で参照がない
  - [ ] `.ts` ファイルは残っている
  - [ ] `npm run build:ts` が成功

  **QA Scenarios**:
  ```
  Scenario: ルートJS/TSペアが整理された
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. rg "card-system\.js" --type html --type js
      2. rg "game-events\.js" --type html --type js
      3. rg "shared-constants\.js" --type html --type js
      4. rg "sound-engine\.js" --type html --type js
      5. rg "is-env-capable\.js" --type html --type js
      6. rg "ui\.js" --type html --type js
      7. ls *.js | grep -c "analyze-"
    Expected Result: すべての参照なし、.jsファイル削除済み
    Evidence: .sisyphus/evidence/task-8-js-ts-pairs-cleaned.txt
  
  Scenario: story-deck-lab.htmlの参照確認
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. rg "shared-constants\.js" story-deck-lab.html
    Expected Result: 参照があれば、story-deck-lab.htmlを修正してから削除
    Evidence: .sisyphus/evidence/task-8-story-deck-lab-check.txt
  ```

  **Commit**: YES
  - Message: `chore(cleanup): remove root JS files with TS counterparts`

---

- [x] 9. **一時ファイル・ログ・スクリーンショットの削除**

  **What to do**:
  - 以下のファイルを削除:
    - ルートの `.txt` ファイル（33ファイル）: `task-*.txt`, `tsc_*.txt`, `network-audit-output.txt`, `trap-output.txt`, etc.
    - ルートの `.png` ファイル（20ファイル）: `hand-*.png`, `playwright-boot-test.png`, etc.
    - ルートの `.json` 分析ファイル: `analysis-output.json`, `selfplay_*.json`, `test-results.json`
    - ルートのログファイル: `bundle-check.log`, `server.log`, `server-err.log`
    - アドホック修正スクリプト: `check_module_registry.js`, `fix_module_registry.js`, `fix_registry_properly.js`
    - その他: `1045`, `4368`, `221451`, `UTF8`, `page-snapshot.yml`

  **Must NOT do**:
  - `package.json` を削除しない
  - `tsconfig.json` を削除しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（Wave 1完了後）
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 11
  - **Blocked By**: Task 1-6

  **Acceptance Criteria**:
  - [ ] リストしたファイルが削除されている
  - [ ] `git status` で予期しない削除がない

  **QA Scenarios**:
  ```
  Scenario: 一時ファイルが削除された
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. ls *.txt 2>/dev/null | wc -l
      2. ls *.png 2>/dev/null | wc -l
      3. ls analysis-output.json 2>/dev/null
    Expected Result: .txt=0, .png=0, analysis-output.json=Not Found
    Evidence: .sisyphus/evidence/task-9-temp-files-removed.txt
  ```

  **Commit**: YES
  - Message: `chore(cleanup): remove temporary files, logs, and screenshots`

---

- [x] 10. **worker-public/孤児ファイルの削除**

  **What to do**:
  - 以下の3ファイルを確認して削除:
    - `worker-public/game/cards/effects/hyperactive.js`
    - `worker-public/game/logic/context.js`
    - `worker-public/shared/types.d.js`
  - 各ファイルについて、root側に同名ファイルが存在しないことを確認

  **Must NOT do**:
  - root側に存在するファイルのworker-public版を削除しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（Wave 1完了後）
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 13
  - **Blocked By**: Task 1-6

  **Acceptance Criteria**:
  - [ ] 各ファイルがroot側に存在しないことを確認
  - [ ] 3ファイルが削除されている

  **QA Scenarios**:
  ```
  Scenario: worker-public孤児ファイルが削除された
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. test -f game/cards/effects/hyperactive.js && echo "EXISTS" || echo "NOT FOUND"
      2. test -f game/logic/context.js && echo "EXISTS" || echo "NOT FOUND"
      3. test -f shared/types.d.js && echo "EXISTS" || echo "NOT FOUND"
    Expected Result: すべて "NOT FOUND"
    Evidence: .sisyphus/evidence/task-10-worker-orphans-removed.txt
  ```

  **Commit**: YES
  - Message: `chore(cleanup): remove orphaned files in worker-public/`

---

- [x] 11. **ビルド確認（npm run build:ts）**

  **What to do**:
  - `npm run build:ts` を実行
  - エラーがないことを確認

  **Must NOT do**:
  - エラーがある場合は先に進まない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 12
  - **Blocked By**: Task 7-10

  **Acceptance Criteria**:
  - [ ] `npm run build:ts` が成功（exit code 0）
  - [ ] `dist/` が再生成されている

  **QA Scenarios**:
  ```
  Scenario: TypeScriptビルドが成功
    Tool: Bash
    Preconditions: Wave 2完了
    Steps:
      1. npm run build:ts
      2. echo $?
    Expected Result: 0
    Evidence: .sisyphus/evidence/task-11-build-success.txt
  ```

  **Commit**: NO

---

- [ ] 12. **テスト確認（npm run test:jest）**

  **What to do**:
  - `npm run test:jest` を実行
  - すべてのテストがPASSすることを確認

  **Must NOT do**:
  - テストがFAILする場合は先に進まない

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 13
  - **Blocked By**: Task 11

  **Acceptance Criteria**:
  - [ ] `npm run test:jest` が成功
  - [ ] すべてのテストがPASS

  **QA Scenarios**:
  ```
  Scenario: Jestテストが全てPASS
    Tool: Bash
    Preconditions: Task 11完了
    Steps:
      1. npm run test:jest
      2. echo $?
    Expected Result: 0
    Evidence: .sisyphus/evidence/task-12-test-success.txt
  ```

  **Commit**: NO

---

- [ ] 13. **Worker準備確認（npm run worker:prepare）**

  **What to do**:
  - `npm run worker:prepare` を実行
  - 成功することを確認

  **Must NOT do**:
  - エラーがある場合は先に進まない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 14
  - **Blocked By**: Task 12

  **Acceptance Criteria**:
  - [ ] `npm run worker:prepare` が成功
  - [ ] `worker-public/` が正しく生成されている

  **QA Scenarios**:
  ```
  Scenario: Worker準備が成功
    Tool: Bash
    Preconditions: Task 12完了
    Steps:
      1. npm run worker:prepare
      2. echo $?
    Expected Result: 0
    Evidence: .sisyphus/evidence/task-13-worker-success.txt
  ```

  **Commit**: NO

---

- [ ] 14. **最終Git確認**

  **What to do**:
  - `git status` を実行
  - 予期しない変更がないことを確認
  - 削除されたファイルが正しいことを確認

  **Must NOT do**:
  - 予期しない変更がある場合は先に進まない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Task 13

  **Acceptance Criteria**:
  - [ ] `git status` で予期しない変更がない
  - [ ] 削除されたファイルが計画通りである

  **QA Scenarios**:
  ```
  Scenario: Git状態が正常
    Tool: Bash
    Preconditions: Task 13完了
    Steps:
      1. git status --short
    Expected Result: 変更が計画通りである
    Evidence: .sisyphus/evidence/task-14-git-status.txt
  ```

  **Commit**: NO

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  計画通りのファイルが削除されているか、予期しないファイルが削除されていないかを確認。
  Output: `削除 [N/N] | 残存 [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  `npm run build:ts` と `npm run test:jest` を再実行し、品質を確認。
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  `npm run worker:prepare` を再実行し、worker-public/が正しく生成されることを確認。
  Output: `Worker Prepare [PASS/FAIL] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  各タスクの「What to do」と実際の差分を比較し、スコープクリープがないことを確認。
  Output: `Tasks [N/N compliant] | VERDICT`

---

## Commit Strategy

各Phase完了後にコミット:

1. `chore(gitignore): add build artifact patterns`
2. `chore(cleanup): remove dist/ from git tracking`
3. `chore(cleanup): remove coverage/ from git tracking`
4. `chore(cleanup): remove .wrangler/ from git tracking`
5. `chore(cleanup): remove Python cache from git tracking`
6. `chore(cleanup): remove Playwright screenshots from git tracking`
7. `chore(cleanup): remove duplicate nested directories`
8. `chore(cleanup): remove root JS files with TS counterparts`
9. `chore(cleanup): remove temporary files, logs, and screenshots`
10. `chore(cleanup): remove orphaned files in worker-public/`

---

## Success Criteria

### Verification Commands
```bash
# ビルド確認
npm run build:ts

# テスト確認
npm run test:jest

# Worker確認
npm run worker:prepare

# Git確認
git status
```

### Final Checklist
- [ ] すべてのPhaseが完了
- [ ] すべてのコミットが完了
- [ ] `npm run build:ts` が成功
- [ ] `npm run test:jest` が成功
- [ ] `npm run worker:prepare` が成功
- [ ] `git status` で予期しない変更がない
- [ ] リポジトリサイズが削減されている

---

## 注意事項

1. **dist/の追跡解除は単独コミット**として実行すること（3,776ファイルの変更を他と混ぜない）
2. **各Phase完了後にコミット**すること（問題切り分けのため）
3. **game/以下のJS/TSペアは削除しない**こと（別計画として分離）
4. **entry-browser.js, ui/layout-stage.js は削除しない**こと（TS版が存在しない）
5. **worker-public/全体は削除しない**こと（ミラーとして定義済み）
6. **予期しない変更がある場合は即座に停止**し、調査すること
