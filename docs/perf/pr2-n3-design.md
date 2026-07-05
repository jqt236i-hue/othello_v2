# PR2 設計: N3 syncBoardPixelSizing dirty gate

## 目的

`ui/board-renderer.ts:691` の `syncBoardPixelSizing()` は **renderBoard ごとに毎回** 走っており、その中で:

- `getComputedStyle` 2 回 (`_getBoardBoxMetricsForPixelSizing`, `_getBoardFrameMetricsForPixelSizing`)
- `getBoundingClientRect` 2 回 + DOM mutation を含む `_measureBoardFrameBaseOuterSize`
- `boardElement.style.{width, height, left, top}` 書き込み + 5 個の `setProperty('removeProperty')`
- `applyBoardFramePixelSizing` 内 style 書き込み
- `getBoundingClientRect` snap-to-whole-pixel のための追加呼び出し
- `syncBoardExpansionLayerGeometry` 呼び出し

典型 render で **layout thrash** を起こし得る (style 書き込み → 強制 layout → 次の layout)。これを **signature + dirty flag** で skip する。

## 既存挙動 (signature 入力)

`syncBoardPixelSizing(boardElement, shapeInput)` の入力のうち **render ごとに変化しない安定した部分**:

| 入力 | 由来 | 安定性 |
|---|---|---|
| `boardElement` (board DOM ref) | 呼び出し元から | frame 入れ替わり時まで同一 |
| frame element | `_getBoardFrameElementForPixelSizing` | boardElement と同じ |
| `shape.rows` / `shape.cols` | `_normalizeBoardShapeForPixelSizing(shapeInput)` | shape 変化まで同一 |

**不安定だが dirty gate の判断材料に使ってはいけないもの**:

- `boxMetrics.boxSizing` - `getComputedStyle` 由来、ブラウザ実装で変化し得る
- `baseSize.width` / `baseSize.height` - `getBoundingClientRect` 由来、window resize や zoom で変化
- `devicePixelRatio` - 別経路で変化し得る
- 全ての `boardElement.style.*` 現在の値 - 上記依存

→ dirty gate の signature は **shape + frame availability** のみで構成する。

## 設計

### Module-level state

```typescript
// 既存 (line 232 周辺):
let boardPixelSizingObserver: any = null;

// PR2 で追加:
let _boardPixelSizingSignature: string | null = null;  // 安定入力 fingerprint
let _boardPixelSizingDirty = true;                     // 初回 + dirty trigger で true
```

### Signature 計算

```typescript
function _computeBoardPixelSizingSignature(boardElement: any, shape: any): string {
    const frameEl = _getBoardFrameElementForPixelSizing(boardElement);
    return `${shape.rows}|${shape.cols}|${frameEl ? '1' : '0'}`;
}
```

shape と frame 存在のみ。`getComputedStyle` / `getBoundingClientRect` を **絶対** 入れない。

### Dirty gate 本体

```typescript
function syncBoardPixelSizing(boardElement: any, shapeInput?: any) {
    if (PerfBenchmarks) PerfBenchmarks.perfStart('syncBoardPixelSizing');
    try {
        const shape = _normalizeBoardShapeForPixelSizing(shapeInput);
        if (!boardElement || !boardElement.style) return shape;

        _ensureBoardPixelSizingObserver(boardElement);

        // PR2 (N3 dirty gate): skip body when signature unchanged and no force-dirty.
        const currentSig = _computeBoardPixelSizingSignature(boardElement, shape);
        if (!_boardPixelSizingDirty && currentSig === _boardPixelSizingSignature) {
            return shape;  // skip the expensive getComputedStyle / getBoundingClientRect / style writes
        }

        // ---- 元の本体 ----
        const boxMetrics = _getBoardBoxMetricsForPixelSizing(boardElement);
        const baseSize = _getBoardBaseSizeForPixelSizing(boardElement);
        // ...
        syncBoardExpansionLayerGeometry(boardElement, shape);
        // ---- 本体終わり ----

        // Commit new signature + clear dirty flag.
        _boardPixelSizingSignature = currentSig;
        _boardPixelSizingDirty = false;
        return shape;
    } finally {
        if (PerfBenchmarks) PerfBenchmarks.perfEnd('syncBoardPixelSizing');
    }
}
```

### Dirty trigger

(a) **ResizeObserver / window resize callback** で必ず dirty を立てる:

```typescript
function _handleBoardPixelSizingViewportChange() {
    if (!boardPixelSizingObservedElement) return;
    _boardPixelSizingDirty = true;  // PR2: re-sync despite same signature
    syncBoardPixelSizing(boardPixelSizingObservedElement);
}
```

(b) **frame element swap** (boardEl 切り替え時) で dirty を立てる:

```typescript
function _ensureBoardPixelSizingObserver(boardElement: any) {
    // ... 既存 ...
    if (boardPixelSizingObserver && boardPixelSizingObservedFrame === frameElement) return;

    if (boardPixelSizingObserver && typeof boardPixelSizingObserver.disconnect === 'function') {
        try { boardPixelSizingObserver.disconnect(); } catch (e: any) { /* ignore */ }
    }

    boardPixelSizingObservedFrame = frameElement;
    try {
        boardPixelSizingObserver = new ResizeObserver(_handleBoardPixelSizingViewportChange);
        boardPixelSizingObserver.observe(frameElement);
    } catch (e: any) {
        boardPixelSizingObserver = null;
    }
    // PR2: observed frame swap (or first-time attach) -> force re-sync.
    _boardPixelSizingDirty = true;
}
```

(c) **初回**: `_boardPixelSizingDirty = true` (module-load 時の初期値) → 必ず実行。

## 既存挙動不変の保証

| シナリオ | 既存挙動 | PR2 後挙動 |
|---|---|---|
| module load 直後の初回 render | sync 全実行 | `_boardPixelSizingDirty=true` で全実行 (同一) |
| 通常の render (shape / frame 同じ) | sync 全実行 | 早期 return、style 書き込みスキップ (**N3 効果**) |
| shape rows/cols 変化 (board 拡大) | sync 全実行 | signature 変化 → 全実行 (同一) |
| boardEl ref / frame ref 差し替え | sync 全実行 | `_ensureBoardPixelSizingObserver` で dirty 立て → 全実行 (同一) |
| window resize / frame resize | sync 全実行 (callback から) | callback で `_boardPixelSizingDirty=true` → 全実行 (同一) |
| `!boardElement` 早期 return (defensive) | shape のみ return | 同一 (gate を通さない) |
| `baseSize` 無効時 early return | `_clearBoardPixelSizingVars` + return | 同一 (gate 内の通常 early return 経路) |

→ ボードの **見た目変化ゼロ** を保証。`othello:syncBoardPixelSizing` measure は PR1 instrumentation で残るので、効果測定は後で可能。

## ロールバック手順

PR2 commit を 1 commit に集約:

```bash
git revert <PR2-commit-hash>
# または
git reset --hard <PR2-base-commit>
```

PR1 instrumentation (`othello:syncBoardPixelSizing` 自体) は **そのまま残る** ため、ロールバック後も measure は見える。

## テスト戦略

| レベル | 確認 |
|---|---|
| `npm run typecheck` | 型整合 |
| `npm run build:browser` | build 成功 + module-registry に反映 |
| `git diff --check` | 空白エラーなし |
| ゲーム内で resize | ウィンドウリサイズしても盤面セルサイズが追従する |
| ゲーム内で board 拡大 / 縮小 | shape 変化時に再計算される (CSS var が正しく更新) |
| 通常 render (CPU 連発) | `othello:syncBoardPixelSizing` duration が減少 (PR1 instrumentation で measure) |
| 通常 render (flip 連発) | 体感の "flip 後のもたつき" が軽減 |

## 関連コミット

- `9370d4bbf` PR1.5 instrumentation gating (renderBoardDiff)
- `6fc3cc0b0` build: refresh after PR1.5
- `570234096` PR1 instrumentation
- `6d0e34cd6` perf-benchmarks helper
