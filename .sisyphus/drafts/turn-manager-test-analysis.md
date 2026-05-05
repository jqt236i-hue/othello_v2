# turn-manager.retry.test.ts — global 依存分析

作成: 2026-05-03
対象ファイル: `test/turn-manager.retry.test.ts` (698行)
ソース: `game/turn-manager.ts` (1139行)

## 1. 現在 test が `global` に設定している全プロパティ

```
※ (B): beforeEach／(T): 個別test内 ／(A): afterEachでdelete対象
```

### beforeEach (L11–23)
| # | プロパティ | 初期値 | 由来 |
|---|-----------|--------|------|
| B1 | `global.timers` | `null` | — |
| B2 | `global.isCardAnimating` | `false` | state flag (free var) |
| B3 | `global.isProcessing` | `false` | state flag (free var) |
| B4 | `global.__uiImpl_turn_manager` | `{}` | DI 設定用 |
| B5 | `global.BLACK` | `1` | 定数 (free var) |
| B6 | `global.WHITE` | `-1` | 定数 (free var) |
| B7 | `global.gameState` | `{ currentPlayer: 1 }` | 状態 (free var) |
| B8 | `global.cardState` | `{ pendingEffectByPlayer: {} }` | 状態 (free var) |
| B9 | `global.getActiveProtectionForPlayer` | `jest.fn(() => [])` | 関数 (free var) |
| B10 | `global.getFlipBlockers` | `jest.fn(() => [])` | 関数 (free var) |
| B11 | `global.findMoveForCell` | `jest.fn(...)` | 関数 (free var) |
| B12 | `global.executeMove` | `jest.fn()` | 関数 (free var) |
| B13 | `global.playHandAnimation` | callback | UI callback (free var) |

### 個別テスト内 (設定のみ)
| # | プロパティ | 設定する test | 用途 |
|---|-----------|--------------|------|
| T1 | `global.MATCH_MODE` | network mode tests | モード判定 |
| T2 | `global.NetworkMatchClient` | network mode tests | ネットワーク client |
| T3 | `global.LOCAL_PLAYER_KEY` | network mode tests | local player |
| T4 | `global.__LOCAL_PLAYER_KEY` | network mode tests | fallback local player |
| T5 | `global.BOARD_VIEWER_KEY` | network mode tests | viewer key |
| T6 | `global.emitPresentationEventViaBoardOps` | network skip test | presentation spy |
| T7 | `global.playHandAnimation` (override) | network skip test | モック |
| T8 | `global.handleGuardSelection` | guard-selection tests | pending 選択 handler |
| T9 | `global.PlaybackStateManager` | playback lock tests | PlaybackStateManager |
| T10 | `global.VisualPlaybackActive` | playback lock tests | visual playback flag |
| T11 | `global.AnimationEngine` | playback lock tests | animation engine |
| T12 | `global.__playbackActiveSince` | stale playback tests | 再生開始時刻 |
| T13 | `global.cpuSmartness` | resetGame tests | CPU 強さ |
| T14 | `global.createGameState` | resetGame tests | game state 生成 |
| T15 | `global.initCardState` | resetGame tests | card state 初期化 |
| T16 | `global.emitLogAdded` | resetGame tests | ログ emit |
| T17 | `global.emitBoardUpdate` | resetGame tests | 盤面更新 emit |
| T18 | `global.emitGameStateChange` | resetGame tests | 状態変更 emit |
| T19 | `global.updateCpuCharacter` | resetGame tests | CPU キャラ更新 |
| T20 | `global.dealInitialCards` | resetGame tests | 初期配布 |
| T21 | `global.__uiImpl` | stale deal test | UI implementation |
| T22 | `global.isGameOver` | CPU retry latch test | ゲーム終了判定 |
| T23 | `global.TurnPipelinePhases` | network reset test | ターンパイプライン |
| T24 | `global.ActionManager` | pending cache clear test | アクション管理 |

### afterEach で delete されるが上記以外 (L38–69)
| # | プロパティ |
|---|-----------|
| A1 | `AnimationEngine` (already T11) |
| A2 | `PlaybackStateManager` (already T9) |
| A3 | `ActionManager` (already T24) |
| A4 | `TurnPipelinePhases` (already T23) |
| A5 | `processBombs` |
| A6 | `processUltimateDestroyGodsAtTurnStart` |
| A7 | `processUltimateReverseDragonsAtTurnStart` |
| A8 | `processBreedingEffectsAtTurnStart` |
| A9 | `processHyperactiveMovesAtTurnStart` |

→ A5–A9 はテストコード内で global に設定した痕跡が無い。afterEach の消し残し対応（防御的 delete）。

---

## 2. 各プロパティの Wave 1 影響分類

### 【不要になる】（Wave 1 で import/DI に置き換え）

ソースが `globalThis` を通して直接書き込み・読み取りを行っている free variable 群。Wave 1 で module-scoped variable または DI 経由に置き換わるため、テストでの global 設定が不要になる。

| global プロパティ | ソース内の使われ方 | 代替手段 |
|------------------|-------------------|---------|
| B2 `isCardAnimating` | `setTurnManagerBusyState()` で globalThis 経由 WRITE／READ | `PlaybackStateManager.setBusyState()` または DI された state |
| B3 `isProcessing` | ↑ 同様 | ↑ 同様 |
| B4 `__uiImpl_turn_manager` | `setUIImpl()` で globalThis 経由 WRITE, 各所で READ | DI 経由の config オブジェクト注入 |
| B5 `BLACK` | モジュール先頭で参照される free var | 定数 import `import { BLACK } from './shared-constants'` |
| B6 `WHITE` | ↑ 同様 | ↑ 同様 |
| B7 `gameState` | 各所で参照される free var (handleCellClick, resetGame, onTurnStart) | `import` で import する |
| B8 `cardState` | ↑ 同様 | ↑ 同様 |
| B9 `getActiveProtectionForPlayer` | free var として呼ばれる関数 | module-scoped で DI 注入 or import |
| B10 `getFlipBlockers` | ↑ 同様 | ↑ 同様 |
| B11 `findMoveForCell` | free var + `globalThis.findMoveForCell` fallback | import + DI |
| B12 `executeMove` | free var として呼ばれる関数 | import + DI |
| T10 `VisualPlaybackActive` | `setTurnManagerBusyState()` L169 で WRITE, `isVisualPlaybackActiveForTurnManager()` L193 で READ | DI 経由 |
| T12 `__playbackActiveSince` | L171–175, L218 | DI 経由 |
| T13 `cpuSmartness` | モジュールトップ L303, resetGame L723–725 | `__uiImpl_turn_manager.readCpuSmartness()` 経由に統一 |
| T14 `createGameState` | resetGame 内で free var として呼び出し | import + DI |
| T15 `initCardState` | ↑ 同様 | ↑ 同様 |
| T16 `emitLogAdded` | ↑ 同様 | ↑ 同様 |
| T17 `emitBoardUpdate` | ↑ 同様 | ↑ 同様 |
| T18 `emitGameStateChange` | ↑ 同様 | ↑ 同様 |
| T19 `updateCpuCharacter` | resetGame L728 で free var として呼び出し | DI 経由 (`__uiImpl_turn_manager`) |
| T20 `dealInitialCards` | resetGame L840 で free var として呼び出し | import + DI |
| A5–A9 `process*` | onTurnStart L989–1003 で free var として呼び出し | import + DI |

### 【DI Mock に置き換え】— `jest.mock()` / `jest.spyOn()` でモック化

ソースが `globalThis.Foo` を直接参照するのではなく、**import されたモジュール** を経由するように Wave 1 で変更した後、テストは `jest.mock()` でそれらのモジュールを差し替える。

| global プロパティ | ソース内の使われ方 | Wave 1 後のモック方法 |
|------------------|-------------------|---------------------|
| T1 `MATCH_MODE` | `isNetworkModeForTurnManager()` で `globalThis.MATCH_MODE` 参照 | `jest.mock('../game/turn/owner-helpers', () => ({ isNetworkMode: jest.fn(() => true) }))` |
| T2 `NetworkMatchClient` | `resolveNetworkLocalPlayerKey()` で `globalThis.NetworkMatchClient.getSeatKey()` | `jest.mock()` で import 時差し替え、または `jest.spyOn()` |
| T3/T4/T5 `LOCAL_PLAYER_KEY`, `__LOCAL_PLAYER_KEY`, `BOARD_VIEWER_KEY` | `resolveNetworkLocalPlayerKey()` で direct-read | `jest.mock()` で owner-helpers 経由に一本化 |
| T9 `PlaybackStateManager` | `getPlaybackStateForTurnManager()` で `globalThis.PlaybackStateManager` | `jest.mock('../ui/playback-state-manager')` |
| T11 `AnimationEngine` | `isPlaybackRunningForTurnManager()` で `globalThis.AnimationEngine.isPlaying` | テスト内で DI 設定、または `jest.mock()` |
| T21 `__uiImpl` | `runTurnStartAfterReset()` で `__uiImpl.onTurnStart()` | DI 経由 (setUIImpl に統合) |
| T22 `isGameOver` | onTurnStart L1016 で free var | import に変更後 `jest.mock()` |
| T23 `TurnPipelinePhases` | onTurnStart L897 で free var, L671 global 設定 | import + `jest.mock()` |
| T24 `ActionManager` | resetGame L784 で free var | import + `jest.mock()` |
| T6 `emitPresentationEventViaBoardOps` | ソース内で local function 定義 (globalThis 未参照) | **この global 設定自体がテスト上の ghost** → test も local function を spy する形に変更 |
| B13 `playHandAnimation` | handleCellClick 内で未使用 (network mode テストのみ参照) | network mode テストで `jest.mock()` via import |

### 【維持】— 変更不要

Wave 1 後もそのまま残るもの、またはテスト内でのみ使われる scaffold 的なもの。

| global プロパティ | 理由 |
|------------------|------|
| B1 `timers` | テスト内のみの scaffold、CPU-turn-handler に渡すため |
| T8 `handleGuardSelection` | pending 選択 handler として free var → DI 経由になる可能性あり（setUIImpl に統合されるか要確認） |

---

## 3. Wave 1 後のテスト構造スケッチ

### 3.1 `jest.mock()` を使う DI 対応パターン

```typescript
// === Wave 1 後のテスト構造案 ===

// ソースが import する依存モジュールを丸ごとモック
jest.mock('../game/turn-manager-deps', () => ({
  createGameState: jest.fn(),
  initCardState: jest.fn(),
  emitLogAdded: jest.fn(),
  emitBoardUpdate: jest.fn(),
  emitGameStateChange: jest.fn(),
  dealInitialCards: jest.fn(() => Promise.resolve()),
  updateCpuCharacter: jest.fn(),
  executeMove: jest.fn(),
  findMoveForCell: jest.fn(),
  getActiveProtectionForPlayer: jest.fn(() => []),
  getFlipBlockers: jest.fn(() => []),
  processBombs: jest.fn(),
  processUltimateDestroyGodsAtTurnStart: jest.fn(),
  processUltimateReverseDragonsAtTurnStart: jest.fn(),
  processBreedingEffectsAtTurnStart: jest.fn(),
  processHyperactiveMovesAtTurnStart: jest.fn(),
  isGameOver: jest.fn(() => false),
  BLACK: 1,
  WHITE: -1,
}));

jest.mock('../game/turn/pending-coordinator', () => ({
  readPendingEffect: jest.fn(),
  resolvePendingSelectionDispatchKey: jest.fn(),
  clearPendingSelectionActionCache: jest.fn(),
}));

jest.mock('../ui/playback-state-manager', () => ({
  getProcessing: jest.fn(() => false),
  getCardAnimating: jest.fn(() => false),
  getPlaybackActive: jest.fn(() => false),
  setBusyState: jest.fn(),
  clearPlaybackLock: jest.fn(),
  abortPlayback: jest.fn(),
  getPlaybackStartedAt: jest.fn(() => null),
  shouldAllowSelectionEntryDuringPlayback: jest.fn(() => false),
}));

// === テスト内では global 設定ではなく、モックの戻り値を制御 ===
beforeEach(() => {
  const deps = require('../game/turn-manager-deps');
  deps.createGameState.mockReturnValue({
    currentPlayer: 1,
    turnNumber: 0,
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
  });
  deps.findMoveForCell.mockReturnValue({ row: 0, col: 0, flips: [] });
});
```

### 3.2 setUIImpl DI パターン（そのまま継続）

```typescript
// setUIImpl は Wave 1 後も DI 窓口として残る（強化される）
// テスト内での使い方は現状と大差ないが、
// global.__uiImpl_turn_manager の直接設定は不要になる

beforeEach(() => {
  const rm = require('../game/turn-manager');
  rm.setUIImpl({
    resetTransientUIState: jest.fn(),
    readCpuSmartness: jest.fn(() => ({ black: 2, white: 3 })),
    clearLogUI: jest.fn(),
    onTurnStart: jest.fn(() => Promise.resolve()),
  });
});
```

### 3.3 network mode テストの新しい書き方

```typescript
// Wave 1 後: global.MATCH_MODE / global.NetworkMatchClient の代わりに
// OwnerHelpersModule.isNetworkMode() を jest.mock() で差し替え

jest.mock('../utils/owner-helpers', () => ({
  isNetworkMode: jest.fn(() => false),
  normalizePlayerKey: jest.fn((player) => {
    if (player === 1 || player === '1') return 'black';
    if (player === -1 || player === '-1') return 'white';
    return String(player).trim().toLowerCase();
  }),
  resolveLocalPlayerKey: jest.fn(() => 'black'),
}));

test('network mode skips hand animation', () => {
  const ownerHelpers = require('../utils/owner-helpers');
  ownerHelpers.isNetworkMode.mockReturnValue(true);
  ownerHelpers.resolveLocalPlayerKey.mockReturnValue('black');

  // NetworkMatchClient はどうする？
  // → ソースを DI に変更: NetworkMatchClient も setUIImpl 経由 or
  //    OwnerHelpersModule.resolveLocalPlayerKey に一本化
  //
  // 案: ソースの resolveNetworkLocalPlayerKey() が
  // OwnerHelpersModule.resolveLocalPlayerKey() だけを見るようになる
  // テストはその戻り値を制御すれば十分

  const rm = require('../game/turn-manager');
  rm.handleCellClick(0, 0);
  expect(executeMove).toHaveBeenCalled();
});
```

### 3.4 VisualPlaybackActive / isCardAnimating の新しい制御方法

```typescript
// Wave 1 後: global.VisualPlaybackActive / isCardAnimating の代わりに
// PlaybackStateManager のモックから値を返す

const mockPlaybackState = {
  getProcessing: jest.fn(() => false),
  getCardAnimating: jest.fn(() => true),
  getPlaybackActive: jest.fn(() => true),
  setBusyState: jest.fn(),
  clearPlaybackLock: jest.fn(),
  getPlaybackStartedAt: jest.fn(() => Date.now()),
  shouldAllowSelectionEntryDuringPlayback: jest.fn(() => false),
};

jest.mock('../ui/playback-state-manager', () => mockPlaybackState);

// AnimationEngine の状態は DI 経由で注入（setAnimationEngine 相当の関数を turn-manager に追加）
// または単純に PlaybackStateManager に統合
```

---

## 4. Wave 1 で不要になる global 設定の削減効果

### 定量的見積もり

| カテゴリ | 件数 | 説明 |
|---------|------|------|
| 完全に不要になる (`global.xxx` 設定行) | ~30 件 | beforeEach の B2–B12 (11件) + 個別テストの T10, T12–T20, T22–T24 (~13件) + A5–A9 (~5件) |
| `jest.mock()` に置き換え | ~8 件 | T1–T5, T9, T11, T21 |
| 維持 | ~2 件 | B1 (timers), T8 (handleGuardSelection) + setUIImll の呼び出し自体は残る |

**効果: テストファイルの global 操作行が約 70～80% 削減される。**

### 追加の副作用

- `afterEach` の `delete global.*` ブロック (L38–69, 32行) はほぼ不要になる
- 各テスト内の `global.xxx = ...` セットアップ (例: L85–91, L198–201, L420–426) も不要に
- テストのセットアップが `beforeEach` での `jest.mock()` + `mockImplementation` に統一される

---

## 5. 注意点・リスク

1. **`gameState`, `cardState` の参照** — 現在ソースは module-scope の free var (`typeof gameState !== 'undefined'`) として参照。これを import に変更すると循環参照リスクがあるため、`Notifier` 経由や DI 経由で受け渡す形が安全。

2. **`PlaybackStateManager` への参照** — ソースは `getPlaybackStateForTurnManager()` で遅延取得している。Wave 1 ではこの遅延取得パターンを置き換えられるか要確認。

3. **`AnimationEngine.isPlaying`** — ソース L225–236 で `globalThis.AnimationEngine.isPlaying` を直接読んでいる。これを DI 経由に変更する必要がある。

4. **`cpuSmartness` の二重経路** — モジュールロード時 (L303) と `resetGame` (L723–725) の 2 箇所。後者は `__uiImpl_turn_manager.readCpuSmartness()` 経由に既になっている。前者の初期化をどうするか要検討。

5. **`emitPresentationEventViaBoardOps` (T6)** — テストで global に設定しているが、ソースは local function 定義を使っている。テストのこの global 設定は実質 No-op に近い可能性あり → Wave 1 で不要になるか要確認。
