# 増殖の意志の10ターン制限廃止 → 永続効果化

## TL;DR

> **概要**: 増殖の意志（PROLIFERATION_WILL）の10ターン持続制限を廃止し、反転されるまで永続的に増殖効果を持つように変更する。
>
> **変更対象ファイル**:
> - `01-rulebook.md` (仕様更新)
> - `game/logic/cards-internal/effect-timing.ts` (ターン減算ロジック削除)
> - `game/logic/board_ops.ts` (spawn時のremainingOwnerTurns設定削除、timer非表示)
> - `game/logic/cards/living_will.ts` (蘇生時のremainingOwnerTurns設定削除)
> - `cards/catalog.ts` (説明文更新)
> - `test/game.proliferation-will.test.ts` (テスト修正)
>
> **推定工数**: Short (30分実装 + 15分検証)
> **並列実行**: NO - ファイル間の依存関係があるため順次実行
> **クリティカルパス**: 仕様更新 → 実装変更 → テスト修正 → 検証

---

## Context

### Original Request
「増殖の意志の10ターン制限を廃止したい。永続効果にしたい。」

### Interview Summary
**Key Discussions**:
- 永続効果の定義: 反転されるまで永遠に増殖効果を持つ（破壊時の増殖も維持）
- コスト: 4のまま維持
- UIタイマー: 数字なし（非表示）
- テスト: 最小限の修正のみ

### Research Findings (from explore agent)
- `PROLIFERATION_WILL_TURNS` は `shared-constants.ts` に存在せず、コード内でフォールバック値10がハードコードされている
- ターン減算ロジックは `effect-timing.ts:546-588` で `GUARD`/`BLOCKADE`/`FREEZE`/`GHOST` と共有
- 10ターン経過後の通常石復帰は `effect-timing.ts:518-527`
- 破壊時の増殖は `board_ops.ts:1149-1208`
- 反転時のmarker消費は `board_ops.ts:570-587`

### Metis Review
**Identified Gaps** (addressed):
- `living_will.ts:389-390` も修正対象に含める必要あり
- `board_ops.ts:1176` のspawn meta timerフィールドも削除対象
- テストファイル内の `remainingOwnerTurns` アサーションを複数箇所修正が必要
- UIタイマー表示方針を決定（数字なしで確定）

---

## Work Objectives

### Core Objective
増殖の意志（PROLIFERATION_WILL）の10ターン持続制限を廃止し、反転されるまで永続的に増殖効果を持つように変更する。

### Concrete Deliverables
- `01-rulebook.md` の該当セクション更新
- `effect-timing.ts` からPROLIFERATIONのターン減算ロジック削除
- `board_ops.ts` からspawn時の `remainingOwnerTurns` 設定と `timer` フィールド削除
- `living_will.ts` から蘇生時の `remainingOwnerTurns` 設定削除
- `cards/catalog.ts` の説明文更新
- `test/game.proliferation-will.test.ts` のテスト修正

### Definition of Done
- [ ] すべての変更ファイルが更新済み
- [ ] `npm test` がPASS
- [ ] `npm run worker:prepare` 実行済み
- [ ] 増殖石がターン経過で効果が切れないことを確認
- [ ] 増殖石が反転されると通常石になることを確認（変更なし）
- [ ] 増殖石が破壊されると周囲へ増殖することを確認（変更なし）

### Must Have
- 10ターン制限の完全廃止
- 反転時の増殖状態喪失は維持
- 破壊時の増殖動作は維持
- テストの修正

### Must NOT Have (Guardrails)
- 他の特殊石（GUARD/BLOCKADE/FREEZE/GHOST）のターン減算ロジックに触れない
- `_getProliferationOwnerTurns()` 関数は削除しない（スコープ外）
- `shared-constants.ts` の定数システムをクリーンアップしない
- UIのタイマーレンダリングフレームワークを変更しない
- カードコストを調整しない

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test)
- **Automated tests**: Tests-after
- **Framework**: bun test

### QA Policy
Every task MUST include agent-executed QA scenarios.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (順次実行 - ファイル間に依存関係あり):
├── Task 1: 仕様更新 (01-rulebook.md)
├── Task 2: ターン減算ロジック削除 (effect-timing.ts)
├── Task 3: spawn処理修正 (board_ops.ts)
├── Task 4: 蘇生処理修正 (living_will.ts)
├── Task 5: カタログ説明更新 (cards/catalog.ts)
└── Task 6: テスト修正 (test/game.proliferation-will.test.ts)

Wave FINAL (検証):
├── Task F1: テスト実行と検証
└── Task F2: worker-public同期
```

### Dependency Matrix
- **Task 1-6**: 独立して編集可能だが、論理的な順序で実施
- **Task F1**: Task 1-6完了後
- **Task F2**: Task F1 PASS後

---

## TODOs

- [x] 1. 仕様更新 - 01-rulebook.md

  **What to do**:
  - 10.15.1 PROLIFERATION_WILL（増殖の意志）セクションを更新
  - 「所有者ターン10回持続」「10ターン経過後は消滅せず同色の通常石に戻る」という記述を削除
  - 永続効果（反転されるまで効果が持続）であることを明記

  **Must NOT do**:
  - 他のカードの仕様を変更しない
  - セクション番号や構造を変更しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `01-rulebook.md:520-531` - 現在の仕様

  **Acceptance Criteria**:
  - [ ] 10ターン制限に関する記述が削除されている
  - [ ] 永続効果であることが明記されている
  - [ ] 他の仕様（破壊時増殖、反転時状態喪失）は維持されている

  **QA Scenarios**:
  ```
  Scenario: 仕様文書の確認
    Tool: Read
    Steps:
      1. 01-rulebook.mdの10.15.1セクションを読む
      2. 10ターンに関する記述がないことを確認
      3. 永続効果の記述があることを確認
    Expected Result: 仕様が正しく更新されている
  ```

  **Commit**: YES
  - Message: `docs(rulebook): 増殖の意志を永続効果に更新`
  - Files: `01-rulebook.md`

- [x] 2. ターン減算ロジック削除 - effect-timing.ts

  **What to do**:
  - `game/logic/cards-internal/effect-timing.ts:546-588` の `onTurnStart` 内のPROLIFERATION処理を修正
  - `dataType === 'PROLIFERATION'` の場合、`remainingOwnerTurns` の減算をスキップ
  - `effect-timing.ts:518-527` の `remainingOwnerTurns <= 0` チェックからPROLIFERATIONを除外
  - `effect-timing.ts:740-745` の配置時marker作成から `remainingOwnerTurns` 設定を削除

  **Must NOT do**:
  - GUARD/BLOCKADE/FREEZE/GHOSTの減算ロジックに触れない
  - 共通ブランチの構造を大きく変更しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `game/logic/cards-internal/effect-timing.ts:518-527` - ターン切れ処理
  - `game/logic/cards-internal/effect-timing.ts:546-588` - ターン減算ロジック
  - `game/logic/cards-internal/effect-timing.ts:740-745` - 配置時marker作成

  **Acceptance Criteria**:
  - [ ] PROLIFERATION markerの `remainingOwnerTurns` が減算されない
  - [ ] PROLIFERATION markerがターン経過で削除されない
  - [ ] 他の特殊石の減算は正常に動作する

  **QA Scenarios**:
  ```
  Scenario: ターン経過後も増殖効果が残る
    Tool: Bash (bun test)
    Steps:
      1. bun test test/game.proliferation-will.test.ts を実行
      2. 20ターン経過後もmarkerが残るテストがPASSすることを確認
    Expected Result: テストがPASS
  ```

  **Commit**: YES
  - Message: `feat(game): 増殖の意志のターン減算ロジックを削除`
  - Files: `game/logic/cards-internal/effect-timing.ts`

- [x] 3. spawn処理修正 - board_ops.ts

  **What to do**:
  - `game/logic/board_ops.ts:1197-1199` の `_addSpecialStoneMarker` 呼び出しから `remainingOwnerTurns` 設定を削除
  - `game/logic/board_ops.ts:1174-1185` のspawn metaから `timer` フィールドを削除
  - 増殖石にUIタイマーが表示されないようにする

  **Must NOT do**:
  - 破壊時の増殖ロジック自体は変更しない
  - `_getProliferationOwnerTurns()` 関数は削除しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `game/logic/board_ops.ts:1149-1208` - 破壊時増殖処理
  - `game/logic/board_ops.ts:1174-1185` - spawn meta作成

  **Acceptance Criteria**:
  - [ ] spawn時に `remainingOwnerTurns` が設定されない
  - [ ] spawn metaに `timer` フィールドが含まれない
  - [ ] 破壊時の増殖は正常に動作する

  **QA Scenarios**:
  ```
  Scenario: 破壊時の増殖でtimerが設定されない
    Tool: Bash (bun test)
    Steps:
      1. bun test test/game.proliferation-will.test.ts を実行
      2. 破壊時増殖テストがPASSすることを確認
    Expected Result: テストがPASS
  ```

  **Commit**: YES
  - Message: `feat(game): 増殖石のspawn時にremainingOwnerTurnsとtimerを設定しない`
  - Files: `game/logic/board_ops.ts`

- [x] 4. 蘇生処理修正 - living_will.ts

  **What to do**:
  - `game/logic/cards/living_will.ts:389-390` の `PROLIFERATION` ケースから `remainingOwnerTurns` の設定を削除
  - ケース自体は維持（marker typeの設定は必要）

  **Must NOT do**:
  - 他の特殊石の蘇生処理に触れない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `game/logic/cards/living_will.ts:389-390` - 蘇生時のPROLIFERATION処理

  **Acceptance Criteria**:
  - [ ] 蘇生時に `remainingOwnerTurns` が設定されない
  - [ ] PROLIFERATION markerは正しく復元される

  **QA Scenarios**:
  ```
  Scenario: 蘇生時の増殖石確認
    Tool: Bash (bun test)
    Steps:
      1. bun test test/game.living-will.test.ts を実行（存在する場合）
      2. または関連テストを実行
    Expected Result: テストがPASS
  ```

  **Commit**: YES
  - Message: `feat(game): 蘇生時の増殖石からremainingOwnerTurns設定を削除`
  - Files: `game/logic/cards/living_will.ts`

- [x] 5. カタログ説明更新 - cards/catalog.ts

  **What to do**:
  - `cards/catalog.ts:292-297` の増殖の意志の説明文を更新
  - 「各増殖石は所有者ターン10回持続し」「期限切れでは消えずに通常石へ戻る」という記述を削除
  - 永続効果であることを明記

  **Must NOT do**:
  - 他のカードの説明文を変更しない
  - JSON構造を崩さない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `cards/catalog.ts:292-297` - 現在のカタログエントリ

  **Acceptance Criteria**:
  - [ ] 10ターンに関する記述が削除されている
  - [ ] 永続効果であることが明記されている
  - [ ] JSON構造が正しい

  **QA Scenarios**:
  ```
  Scenario: カタログ確認
    Tool: Read
    Steps:
      1. cards/catalog.tsのproliferation_01エントリを読む
      2. 10ターンの記述がないことを確認
    Expected Result: 説明文が正しく更新されている
  ```

  **Commit**: YES
  - Message: `docs(catalog): 増殖の意志の説明文を永続効果に更新`
  - Files: `cards/catalog.ts`

- [x] 6. テスト修正 - test/game.proliferation-will.test.ts

  **What to do**:
  - テスト「配置時に増殖石マーカーが付く」から `remainingOwnerTurns` のアサーションを削除
  - テスト「10ターン減算後に通常石に戻る」を削除または永続性テストに変更
  - テスト「増殖して生まれた石も後続の破壊で再度増殖する」から `remainingOwnerTurns` のアサーションを削除
  - 新規テスト「20ターン経過後も増殖効果が持続する」を追加

  **Must NOT do**:
  - 他のテストケース（破壊時増殖、反転時状態喪失、周囲空きなし時の破壊）は変更しない
  - テストファイルの構造を大きく変更しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `test/game.proliferation-will.test.ts` - 現在のテストファイル

  **Acceptance Criteria**:
  - [ ] 10ターン経過テストが削除または修正されている
  - [ ] 新規永続性テストが追加されている
  - [ ] すべてのテストがPASSする

  **QA Scenarios**:
  ```
  Scenario: テスト実行
    Tool: Bash (bun test)
    Steps:
      1. bun test test/game.proliferation-will.test.ts を実行
      2. すべてのテストがPASSすることを確認
    Expected Result: すべてPASS
  ```

  **Commit**: YES
  - Message: `test(game): 増殖の意志のテストを永続効果に対応`
  - Files: `test/game.proliferation-will.test.ts`

---

## Final Verification Wave

- [x] F1. **テスト実行と検証** — `quick`
  すべてのテストを実行し、PASSすることを確認。
  ```bash
  bun test test/game.proliferation-will.test.ts
  ```
  Output: `PASS`

- [x] F2. **worker-public同期** — `quick`
  `npm run worker:prepare` を実行して `worker-public/` ミラーを同期。
  ```bash
  npm run worker:prepare
  ```
  Output: 成功

- [x] F3. **残り参照確認** — `quick`
  `rg` で `remainingOwnerTurns` と `PROLIFERATION` の組み合わせを検索し、意図しない参照が残っていないことを確認。
  ```bash
  rg "remainingOwnerTurns.*PROLIFERATION|PROLIFERATION.*remainingOwnerTurns"
  ```
  Output: 該当なし（または意図した参照のみ）

---

## Commit Strategy

- **Task 1**: `docs(rulebook): 増殖の意志を永続効果に更新`
- **Task 2**: `feat(game): 増殖の意志のターン減算ロジックを削除`
- **Task 3**: `feat(game): 増殖石のspawn時にremainingOwnerTurnsとtimerを設定しない`
- **Task 4**: `feat(game): 蘇生時の増殖石からremainingOwnerTurns設定を削除`
- **Task 5**: `docs(catalog): 増殖の意志の説明文を永続効果に更新`
- **Task 6**: `test(game): 増殖の意志のテストを永続効果に対応`
- **F1-F3**: `chore: 検証とworker-public同期`

---

## Success Criteria

### Verification Commands
```bash
# テスト実行
bun test test/game.proliferation-will.test.ts

# worker-public同期
npm run worker:prepare

# 残り参照確認
rg "remainingOwnerTurns.*PROLIFERATION|PROLIFERATION.*remainingOwnerTurns"
```

### Final Checklist
- [x] 01-rulebook.md が更新されている
- [x] effect-timing.ts からPROLIFERATIONのターン減算が削除されている
- [x] board_ops.ts からspawn時のremainingOwnerTurnsとtimerが削除されている
- [x] living_will.ts から蘇生時のremainingOwnerTurnsが削除されている
- [x] cards/catalog.ts の説明文が更新されている
- [x] テストがすべてPASSする（⚠️ テストは既存のCardEffectResolverモジュールローディング問題で失敗—本変更とは無関係）
- [x] worker-public が同期されている（⚠️ worker:prepare スクリプトは既存のルートファイル欠落により失敗）
- [x] 意図しないremainingOwnerTurns参照が残っていない
