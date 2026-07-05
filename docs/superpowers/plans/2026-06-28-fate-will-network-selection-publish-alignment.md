# FATE_WILL 中の対象選択カード SEAT_MISMATCH 修正 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ネット対戦で「運命の意志」発動中に、所有者のターンを操作する controller が所有者の対象選択カード（超引力/超重力/重力/強風の意志/浮力/超浮力/テレポート/捕食/誘惑/罠/守護/反転意志/タイムボム/盤面拡張神/盤面縮小神/凍結/種/隕石/因果再生/自由配置/終盤/寿命延長 等）の対象マスをクリックしても `SEAT_MISMATCH` / `STALE_PENDING_SELECTION` でサーバに弾かれ、UI が無反応になるバグを修正する。

**Architecture:**
- UI 側: `ui/network/command-payload.ts` の `actor` 解決順を `fallbackPlayerKey` (HTTP seat = 操作者) 優先に変更し、サーバの `builtAction.actor === seatKey` チェックと整合させる。
- サーバ側: `utils/match-authority.ts:validatePendingSelectionPublish` に「HTTP seat (= controller) が現在のターン所有者の FATE_WILL controller なら、所有者側 `pendingEffectByPlayer[ownerKey]` を見にいく」フォールバックを追加する。これは `game/turn/turn_pipeline_factory.ts:184-197` の pipeline 正規化と対称的な処理。
- 正本仕様（`01-rulebook.md` / `正本/カード仕様正本.md` の「相手側の行動として処理」「被操作側の入力を無効にする」）には変更を加えない。

**Tech Stack:** TypeScript, Jest, Cloudflare Workers, wrangler, Node 22+。

---

## 0. この計画の位置づけ

- 既存の詳細調査 plan: `docs/plans/fate-will-network-seat-mismatch-fix-plan-2026-06-27.md`（2 層修正の根拠・影響範囲・リスク・コミット粒度のサマリ）。本計画はそれを TDD の bite-sized タスクに分解した実装手順。
- 既存テスト: `test/network.fate-will-selection.test.ts`（14 ケース、UI 側 6 / サーバ側 6 / applyTurnSafe 2）。本計画の実装で全 14 件 pass させる。
- AGENTS.md WORK RULES の検証スケール: **Level 3**（Worker/local/browser/headless 契約変更）に該当。`test:network:parity` と `worker:prepare` を必須とする。

## 1. 修正対象ファイル

| 用途 | パス |
| --- | --- |
| UI 側 `actor` 解決順の変更 | `ui/network/command-payload.ts:66` |
| サーバ側 pending validation に FATE_WILL controller フォールバック | `utils/match-authority.ts:validatePendingSelectionPublish` (2132-2183) |
| Worker mirror 同期 | `npm run worker:prepare` 経由で `worker-public/**` を自動更新 |
| テスト | `test/network.fate-will-selection.test.ts`（既存、新規追加なし） |
| コミット対象 | 上記 2 ファイル + `worker-public/**` の差分 |

`AGENTS.md` の AUTHORITY/PRESENTATION CONTRACT および WORK RULES（actor 解決の正規化、UI と headless の責務分離）に従う。`game/` / `shared/` に DOM/window/NetworkMatchClient 参照を持ち込まない。

## 2. pre-existing dirty ファイル（本計画スコープ外）

`git status --short` で以下の pre-existing な変更が検出されているが、いずれも deck-builder / CSS / index.html 周辺の UI 改修と思われ、本件と無関係:

- `index.html`, `public/module-registry.js`, `styles-layout-controls.css`, `ui/deck-builder-renderer.ts`
- `worker-public/index.html`, `worker-public/public/module-registry.js`, `worker-public/styles-layout-controls.css`

本計画の実装とコミットはこれらとは分離して扱い、`git status` で dirty 残存時は最終報告で明示する。

---

## Task 1: 現状の失敗テストを再現して UI バグを確定する

**Files:**
- Read: `ui/network/command-payload.ts:60-72`
- Read: `test/network.fate-will-selection.test.ts:60-145`

- [ ] **Step 1: 既存テストを実行して 4 件失敗を確認**

```bash
npx jest test/network.fate-will-selection.test.ts --colors=false
```

期待出力: 14 テスト中 4 件失敗。
- `× owner-built action (action.actor=white) sent by controller (fallback=black) yields actor=black`
- `× when fallback is provided it strictly wins over action.actor`
- `× regression: source line enforces fallbackPlayerKey priority`
- `× FATE_WILL controller publishes a real-shape cell-click action (no useCardId/useCardOwnerKey) and is accepted`

これら 4 件が「未修正の現状で落ちている」ことの確認。

- [ ] **Step 2: 期待する修正後の `actor` 解決順を確認**

`test/network.fate-will-selection.test.ts:142-145` の regex assertion が、新コードの正規形を pin している:

```ts
expect(source).toMatch(/fallbackPlayerKey\s*\|\|\s*action\.actor\s*\|\|\s*action\.playerKey/);
expect(source).not.toMatch(/action\.actor\s*\|\|\s*action\.playerKey\s*\|\|\s*fallbackPlayerKey/);
```

新コードは `fallbackPlayerKey` を最初に置くこと。旧順（`action.actor || action.playerKey || fallbackPlayerKey`）を残さないこと。

---

## Task 2: UI 側 `actor` 解決順を HTTP seat 優先に変更

**Files:**
- Modify: `ui/network/command-payload.ts:66`（`actor:` 行の右辺のみ）

- [ ] **Step 1: 現状の該当行を確認**

```ts
const payload: any = {
    actionType: actionType,
    actor: normalizePlayerKey(action.actor || action.playerKey || fallbackPlayerKey, 'black', opts.normalizePlayerKey),
    params: {}
};
```

- [ ] **Step 2: 1 行だけ書き換え**

`ui/network/command-payload.ts:66` を以下に変更（他は触らない）:

```ts
        actor: normalizePlayerKey(fallbackPlayerKey || action.actor || action.playerKey, 'black', opts.normalizePlayerKey),
```

差分: `action.actor ||` の前に `fallbackPlayerKey ||` を挿入。

- [ ] **Step 3: UI 側テスト 3 件が pass することを確認**

```bash
npx jest test/network.fate-will-selection.test.ts -t "UI publish command-payload" --colors=false
```

期待出力: UI publish command-payload describe の 6 件すべて pass（特に `owner-built action (action.actor=white) sent by controller (fallback=black) yields actor=black` / `when fallback is provided it strictly wins over action.actor` / `regression: source line enforces fallbackPlayerKey priority` の 3 件が pass に転じている）。`server pending validation` describe のうち 1 件（`FATE_WILL controller publishes a real-shape cell-click action`）はまだ fail のままで OK（Task 3 で修正）。

---

## Task 3: サーバ側 `validatePendingSelectionPublish` に FATE_WILL controller フォールバックを追加

**Files:**
- Read: `utils/match-authority.ts:2132-2183` (`validatePendingSelectionPublish`)
- Read: `utils/match-authority.ts:1794-1822` (`isFateWillControllerForCurrentTurn`, `getFateWillControllerKey`)
- Modify: `utils/match-authority.ts:2146-2165`（`expectedPending` 取得〜互換コンテキスト判定の区間）

- [ ] **Step 1: 現状の `expectedPending` ロジックを確認**

```ts
const expectedPending = pendingByPlayer ? asRecord(pendingByPlayer[normalizePlayerKey(playerKey)]) : null;
if (!expectedPending || !expectedPending.type) {
    const hasCompatibilityCardContext = !!( /* ... */ );
    if (hasCompatibilityCardContext) { return { ok: true, pendingEffectId: null }; }
    return { ok: false, rejectedReason: 'STALE_PENDING_SELECTION' };
}
```

現状は `playerKey` (= HTTP seat = controller) 側のみ参照し、FATE_WILL 中に owner 側に格納された pending を見ない。

- [ ] **Step 2: フォールバックロジックを挿入**

`utils/match-authority.ts:2146`（`const expectedPending = ...` の直後、`if (!expectedPending || !expectedPending.type)` の直前）に以下を追加:

```ts
    // FATE_WILL controller publishes a cell-click action on behalf of the owner.
    // The pending effect is stored under the OWNER side per `正本/カード仕様正本.md` 運命の意志
    // ("石置・反転・カード使用・終端消費・手札消費は相手側の行動として処理").
    // When playerKey is the FATE_WILL controller for the current turn owner,
    // fall back to the owner-side pending before falling back to compatibility context.
    let expectedPending = pendingByPlayer ? asRecord(pendingByPlayer[normalizePlayerKey(playerKey)]) : null;
    if (!expectedPending || !expectedPending.type) {
        if (isFateWillControllerForCurrentTurn(snapshotValue, playerKey)) {
            const ownerKey = getCurrentPlayerKey(snapshot && snapshot.gameState as Partial<GameState> | null);
            if (ownerKey) {
                const ownerPending = pendingByPlayer ? asRecord(pendingByPlayer[ownerKey]) : null;
                if (ownerPending && ownerPending.type) {
                    expectedPending = ownerPending;
                }
            }
        }
    }
```

重要: `const expectedPending = ...` の重複宣言を避けるため、Step 2 を入れる前に**既存 2146 行の `const` を `let` に書き換える**か、Step 2 内で `let` 宣言 + 既存行を削除する。最終形は次の通り（既存 2146 行を `let` 宣言に書き換え + Step 2 のフォールバックブロックを追加）:

```ts
    let expectedPending = pendingByPlayer ? asRecord(pendingByPlayer[normalizePlayerKey(playerKey)]) : null;
    // FATE_WILL controller publishes a cell-click action on behalf of the owner.
    // The pending effect is stored under the OWNER side per `正本/カード仕様正本.md` 運命の意志
    // ("石置・反転・カード使用・終端消費・手札消費は相手側の行動として処理").
    // When playerKey is the FATE_WILL controller for the current turn owner,
    // fall back to the owner-side pending before falling back to compatibility context.
    if (!expectedPending || !expectedPending.type) {
        if (isFateWillControllerForCurrentTurn(snapshotValue, playerKey)) {
            const ownerKey = getCurrentPlayerKey(snapshot && snapshot.gameState as Partial<GameState> | null);
            if (ownerKey) {
                const ownerPending = pendingByPlayer ? asRecord(pendingByPlayer[ownerKey]) : null;
                if (ownerPending && ownerPending.type) {
                    expectedPending = ownerPending;
                }
            }
        }
    }
    if (!expectedPending || !expectedPending.type) {
        const hasCompatibilityCardContext = !!( /* 既存の判定を温存 */ );
        if (hasCompatibilityCardContext) { return { ok: true, pendingEffectId: null }; }
        return { ok: false, rejectedReason: 'STALE_PENDING_SELECTION' };
    }
```

- [ ] **Step 3: 既存テストとの整合を確認**

`isFateWillControllerForCurrentTurn` は export 済み（`utils/match-authority.ts:2777`）かつファイル内（2132 より前）で定義済み。追加 import は不要。

- [ ] **Step 4: 全 14 テストが pass することを確認**

```bash
npx jest test/network.fate-will-selection.test.ts --colors=false
```

期待出力: 14 件すべて pass。`FATE_WILL controller publishes a real-shape cell-click action (no useCardId/useCardOwnerKey) and is accepted` が pass に転じていること、`non-FATE_WILL controller seat still requires pending on its own slot or compatibility context` は引き続き pass（FATE_WILL で無い限り owner 側を参照しない）。

---

## Task 4: 既存テスト全実行（Level 3 検証）

- [ ] **Step 1: typecheck**

```bash
npm run typecheck
```

期待: エラー 0 件。

- [ ] **Step 2: build:ts**

```bash
npm run build:ts
```

期待: 成功（dist/ 配下に成果物生成）。

- [ ] **Step 3: check:window（UI 契約: game/shared から window/document/globalThis/self/NetworkMatchClient 参照が無いこと）**

```bash
npm run check:window
```

期待: 違反 0 件。本修正は `ui/network/` と `utils/` 配下のみで、AGENTS.md の AUTHORITY/PRESENTATION CONTRACT に違反しない。

- [ ] **Step 4: test:jest 全件**

```bash
npm run test:jest
```

期待: 既存全件 pass + `test/network.fate-will-selection.test.ts` 14 件 pass。

- [ ] **Step 5: test:network:parity（Worker / local server / headless 契約）**

```bash
npm run test:network:parity
```

期待: pass。`actor` 解決順変更が既存 publish 経路を壊していないこと、`validatePendingSelectionPublish` の所有者側フォールバック追加が通常ターンの挙動に影響していないことを確認。

- [ ] **Step 6: match:check（match authority helper の自己整合）**

```bash
npm run match:check
```

期待: pass。

---

## Task 5: Worker mirror 同期

- [ ] **Step 1: worker:prepare 実行**

```bash
npm run worker:prepare
```

期待: 成功。`worker-public/ui/network/command-payload.js` と `worker-public/utils/match-authority.js` が新実装で再生成される。

- [ ] **Step 2: 差分確認**

```bash
git diff --stat -- worker-public/
```

期待: 2 ファイル分の更新（`command-payload.js`, `match-authority.js`）が検出され、不要な mirror ファイル（index.html, public/module-registry.js, styles-layout-controls.css 等）の差分は**このタスクで生じたものではない**ため、Step 1 の出力にそれらを含めてはならない（pre-existing dirty の混入 = Task 異常、Step 1 をやり直す）。

---

## Task 6: コミット

- [ ] **Step 1: ステージ対象の限定**

```bash
git status --short
```

- pre-existing dirty（deck-builder / CSS / index.html / module-registry）は**ステージしない**。
- 本タスクで変更したファイル（`ui/network/command-payload.ts`, `utils/match-authority.ts`）+ Task 5 で再生成された worker mirror（`worker-public/ui/network/command-payload.js`, `worker-public/utils/match-authority.js`）のみをステージする。

```bash
git add ui/network/command-payload.ts utils/match-authority.ts worker-public/ui/network/command-payload.js worker-public/utils/match-authority.js
```

- [ ] **Step 2: コミット**

```bash
git commit -m "fix(network): align selection publish actor with HTTP seat for FATE_WILL turns

- ui/network/command-payload.ts: actor 解決順を fallbackPlayerKey 優先に変更し、
  FATE_WILL 中の controller seat からの publish で SEAT_MISMATCH が出ないようにする。
- utils/match-authority.ts: validatePendingSelectionPublish に FATE_WILL controller
  → owner 側 pending のフォールバックを追加（turn_pipeline_factory.ts:184-197 と対称）。
- 既存 test/network.fate-will-selection.test.ts 14 ケースで回帰を担保。
- 影響: ネット対戦 × 運命の意志 × 対象選択カード（超重力等）のクリック不発を修正。"
```

- [ ] **Step 3: 事後確認**

```bash
git status --short
```

期待: 本タスク起因のファイルはすべてクリーン。pre-existing dirty 7 ファイル（deck-builder 関連）は dirty のまま残存しているはず — これは本タスクのスコープ外なので触らない旨を最終報告で明示する。

---

## Task 7: 実機 / 任意検証（手動）

- [ ] **Step 1: ローカル 2 ブラウザで再現確認（任意）**

`card-reversi-browser-live-network-check` スキル、または `playwright-local-game-test-workflow` スキルを使い、シナリオ:
1. 黒が「運命の意志」を発動。
2. 白のターンで、黒が操作し白ハンドから「超引力」を発動。
3. ハイライトされた石マスをクリック → 経路先選択モードに遷移。
4. 経路先をクリック → 石が引き寄せられ終端消費・手番交代まで一連動作。

を確認。

- [ ] **Step 2: 通常ターンのリグレッション確認（任意）**

- 通常ターンで同じ「超引力」を使い、所有者の playerKey で動作することを確認。
- 観戦モードでクリックが無効であることも合わせて確認（`resolveNetworkInputPermissions` の `canOperateBoard` 判定と整合）。

---

## 3. リスクとロールバック

| リスク | 影響 | 対応 |
| --- | --- | --- |
| `actor` 解決順変更で通常ターンの他経路が壊れる | 中 | Task 4 の `test:network:parity` で網羅 |
| `validatePendingSelectionPublish` のフォールバック追加で非 FATE_WILL 経路が緩む | 中 | `non-FATE_WILL controller seat still requires pending on its own slot or compatibility context` テスト（既存 14 ケースの 1 件）で回帰防止 |
| Worker mirror 同期忘れ | 低 | Task 5 を必ず実行 |
| pre-existing dirty ファイルの混入 | 低 | Task 6 の Step 1 で `git status` を見ながら限定 add |
| `let expectedPending` 化で他の判定（`requestedType` 等）に副作用 | 低 | 既存の `if (!expectedPending \|\| !expectedPending.type) { ... return ... }` ガードは維持し、フォールバックは「型なしなら所有者側を見にいく」のみ。型ありなら元の判定に進む |

ロールバック: 1 コミットで完結するため `git revert` で安全。`worker-public/` も `worker:prepare` で同期されているため巻き戻し可能。

## 4. 正本への影響

- `01-rulebook.md`: 変更不要
- `正本/カード仕様正本.md`: 変更不要
- `正本/ターン進行正本.md`: 変更不要
- `docs/architecture-contracts.md`: 必要に応じて Task 6 後に `actor` 解決順の境界を明記（任意）

## 5. 検証チェックリスト

- [ ] Task 1: 失敗 4 件を再現
- [ ] Task 2: UI 側 3 件が pass に転じる
- [ ] Task 3: サーバ側 1 件 + 全 14 件 pass
- [ ] Task 4: typecheck / build:ts / check:window / test:jest / test:network:parity / match:check すべて pass
- [ ] Task 5: worker:prepare 成功、差分が mirror 2 ファイルのみ
- [ ] Task 6: 限定 add → コミット → git status で本タスク起因分のみ clean、pre-existing dirty は dirty のまま
- [ ] Task 7: 任意で実機再現確認
