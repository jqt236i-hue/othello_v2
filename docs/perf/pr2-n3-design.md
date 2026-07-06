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

---

# Revision 1 (PR2 v2: signature 拡張 + dirty trigger 追加)

## Context (経緯)

PR2 v1 (`75ba6578c`) を CODEX にレビュー投げた結果、**signature が粗すぎるため board skin 切替 / frame skin 切替 / layout-stage scale 変更を取りこぼし、画面崩れリスクがある** と指摘された。revert 不要、signature 拡張 + trigger 追加で修正可、と判定。

加えて「signature 計算では `getComputedStyle()` を使うと dirty gate 自体のコスト削減が打ち消される」点も指摘。代替: dataset 属性 / inline style `getPropertyValue` / devicePixelRatio / WeakMap identity token に絞る。

## v1 → v2 の差分サマリ

| 軸 | v1 | v2 |
|---|---|---|
| signature のキー | `rows\|cols\|frameExists` | `rows\|cols\|boardElTok\|frameElTok\|skinIds\|layoutScale\|framePaddingVars\|dpr` (11 個) |
| 要素 identity | `frameEl ? '1' : '0'` のみ | WeakMap token (`boardElementIdentityToken`, `frameElementIdentityToken`) |
| skin 切替対応 | なし | `documentElement.getAttribute('data-board-skin-id')` / `'data-board-frame-skin-id'` |
| layout scale 対応 | なし | `documentElement.style.getPropertyValue('--layout-stage-scale')` |
| frame padding 変更対応 | なし | 4 つの `--board-frame-padding-{top,right,bottom,left}` を `getPropertyValue` |
| DPR | なし | `window.devicePixelRatio` |
| page-state (visibilitychange / pageshow) | なし | 新設、visible 復帰 / pageshow で dirty |
| early return (ResizeObserver 不在 / frame 無し) | dirty 立てずに return | early return 前に `dirty=true` 強制 (frame 復得時の保険) |
| `getComputedStyle()` | 使ってない | 使わない (dataset / inline style / DPR / token のみ) |

## Signature 拡張 (11 個のキー)

```typescript
function _computeBoardPixelSizingSignature(boardElement: any, shape: any): string {
    const frameEl = _getBoardFrameElementForPixelSizing(boardElement);
    const docEl = (typeof document !== 'undefined' && document.documentElement) || null;
    const rootStyle = (docEl && docEl.style) || null;
    const rootAttrs = (docEl && docEl.dataset) || null;
    const dpr = (typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio))
        ? String(window.devicePixelRatio) : '0';

    const padTop = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-top') : '';
    const padRight = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-right') : '';
    const padBottom = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-bottom') : '';
    const padLeft = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-left') : '';
    const layoutScale = rootStyle ? rootStyle.getPropertyValue('--layout-stage-scale') : '';
    const boardSkinId = rootAttrs ? (rootAttrs.boardSkinId || '') : '';
    const frameSkinId = rootAttrs ? (rootAttrs.boardFrameSkinId || '') : '';

    return [
        shape.rows,
        shape.cols,
        _getBoardElementIdentityToken(boardElement),
        _getFrameElementIdentityToken(frameEl),
        boardSkinId,
        frameSkinId,
        layoutScale,
        padTop, padRight, padBottom, padLeft,
        dpr
    ].join('|');
}
```

### 各キーの由来と「dirty gate 用に有効」な理由

| # | キー | 由来 | 理由 | 読み出しコスト |
|---|---|---|---|---|
| 1 | `shape.rows` | `_normalizeBoardShapeForPixelSizing` | 形が変われば再計算必須 | ゼロ (引数由来) |
| 2 | `shape.cols` | 同上 | 同上 | ゼロ |
| 3 | boardEl token | `WeakMap<HTMLElement, number>` | boardEl 差し替えで再計算必須 | WeakMap lookup 1 回 (O(1)、軽量) |
| 4 | frameEl token | `WeakMap<HTMLElement, number>` | 同上 | 同上 |
| 5 | `data-board-skin-id` | `documentElement.dataset` | ボード skin 切替で cell 描画が変わる (CSS 経由で effect が走る) | 属性読み出し (軽量) |
| 6 | `data-board-frame-skin-id` | 同上 | フレーム skin 切替で frame パディングが変わる (上記 confirm済み、`applyBoardFrameLayoutVars` で `--board-frame-padding-*` 全部更新) | 属性読み出し |
| 7 | `--layout-stage-scale` | `documentElement.style.getPropertyValue` | レイアウトスケール変更で CSS 経由の cell サイズが解決値変化する | **inline style 読み出し (layout read を発生しない)** |
| 8-11 | `--board-frame-padding-{top,right,bottom,left}` | 同上 | frame skin 切替で inline 更新される (上記 confirm済み) | 同上 |
| 12 | `devicePixelRatio` | `window.devicePixelRatio` | OS / ズーム変更で DPR 変われば baseline cell size 計算が変わる | window 値読み出し (軽量) |

### なぜ getComputedStyle() を使わないか

`getComputedStyle()` は **強制 layout (reflow)** を起こり得る。`syncBoardPixelSizing` 自体が dirty gate で削ろうとしているコスト (`getComputedStyle` 2 回 + `getBoundingClientRect` 2 回) を、signature 計算で相殺するのは本末転倒。

代替:
- 属性値 → `.dataset.X` または `.getAttribute(name)` で取得 (layout read 発生なし)
- inline CSS 変数 → `.style.getPropertyValue('--var')` で取得 (CSSStyleDeclaration 宣言値、layout read 発生なし)
- 環境値 → `window.devicePixelRatio` (window 値)

これで v1 と比べて **signature 計算の追加コスト ≈ dataset 5 read + inline style 5 read + DPR 1 read + WeakMap 2 lookup ≈ 数十 μs 未満**。

## WeakMap Token 設計

```typescript
// module-level (v2 で追加):
const _boardElementIdentityToken = new WeakMap<any, number>();
const _frameElementIdentityToken = new WeakMap<any, number>();
let _nextBoardElementIdentity = 1;
let _nextFrameElementIdentity = 1;

function _getBoardElementIdentityToken(el: any): number {
    if (!el) return 0;
    let t = _boardElementIdentityToken.get(el);
    if (t === undefined) {
        t = _nextBoardElementIdentity++;
        _boardElementIdentityToken.set(el, t);
    }
    return t;
}

function _getFrameElementIdentityToken(el: any): number {
    if (!el) return 0;
    let t = _frameElementIdentityToken.get(el);
    if (t === undefined) {
        t = _nextFrameElementIdentity++;
        _frameElementIdentityToken.set(el, t);
    }
    return t;
}
```

特性:
- 同一 ref → 同一 token → signature 一致
- 新規 ref 登場 → 新 token 発行 → signature 変化 → 即 full sync
- WeakMap なので **要素が GC されたら token も自動的に解放** (メモリリーク無し)
- token 0 は null/undefined 専用 (要素 null の場合は signature で `0` 表記、frameEl が null なら `0|...`、boardEl 自体が null なら gate に入る前に early return)

## Page-state Listener 新設

```typescript
let _boardPixelSizingPageStateHandlersInstalled = false;

function _installBoardPixelSizingPageStateHandlers() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    if (_boardPixelSizingPageStateHandlersInstalled) return;
    window.addEventListener('visibilitychange', () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
            _boardPixelSizingDirty = true;
        }
    });
    window.addEventListener('pageshow', () => {
        _boardPixelSizingDirty = true;
    });
    _boardPixelSizingPageStateHandlersInstalled = true;
}
```

設置場所: `_ensureBoardPixelSizingObserver` 内、既存の window resize listener 設置と同じ場所 (= 初回 attach 時に 1 回だけ)。

理由:
- visibilitychange → タブ復帰で `devicePixelRatio` や viewport サイズが変わった可能性があるため dirty
- pageshow → bfcache 復帰時にも同じ

## early return 周辺の Dirty 強制

`ui/board-renderer.ts:685` の early return:

```typescript
const frameElement = _getBoardFrameElementForPixelSizing(boardElement);
if (typeof ResizeObserver !== 'function' || !frameElement) return;  // ← v1: dirty 立てずに return
```

**問題 (v1)**: ResizeObserver 不在 / frame 一時不在 → dirty 立てない → 次回 syncBoardPixelSizing が呼ばれても signature が前回と同じなら skip される。frame 復得時の再 sync が保証されない。

**v2 修正**:

```typescript
if (typeof ResizeObserver !== 'function' || !frameElement) {
    // v2: force-dirty in fallback / frame-detached paths so the next
    // syncBoardPixelSizing() call re-syncs once frame recovers.
    _boardPixelSizingDirty = true;
    return;
}
```

→ fallback 状態でも次回の sync 呼び出しで dirty 評価が走り、frame 復得後に必ず full sync される。

## 不変性表 (Revision 1)

| シナリオ | 既存挙動 | v2 挙動 |
|---|---|---|
| module load 直後の初回 render | sync 全実行 | dirty=true → 全実行 (同一) |
| 通常の render (shape 同 / 要素同 / skin 同 / scale 同 / padding 同 / DPR 同) | sync 全実行 | **skip** (N3 の効果、ここが効く) |
| shape rows/cols 変化 | sync 全実行 | signature 変化 → 全実行 (同一) |
| boardEl ref 差し替え | sync 全実行 | WeakMap token 変化 → 全実行 (同一) |
| frameEl ref 差し替え | sync 全実行 | WeakMap token 変化 → 全実行 (同一) |
| window / frame resize | sync 全実行 (callback から) | callback で `dirty=true` → 全実行 (同一) |
| board skin 切替 | sync 全実行 | `data-board-skin-id` 変化 → 全実行 (同一) |
| frame skin 切替 | sync 全実行 | `data-board-frame-skin-id` + `--board-frame-padding-*` 4 変化 → 全実行 (同一) |
| layout scale 変更 | sync 全実行 | `--layout-stage-scale` 変化 → 全実行 (同一) |
| DPR 変更 (OS / ズーム) | sync 全実行 | signature 変化 → 全実行 (同一) |
| タブ復帰 (visibilitychange → visible) | sync 全実行 | listener で `dirty=true` → 全実行 (同一) |
| bfcache 復帰 (pageshow) | sync 全実行 | listener で `dirty=true` → 全実行 (同一) |
| ResizeObserver 不在 / frame 無し (fallback) | sync 走らない | early return 前にも `dirty=true`、次回 full sync を保証 |
| `!boardElement` 早期 return (defensive) | shape のみ return | 同一 (gate に入らない) |
| `baseSize` 無効時 early return | `_clearBoardPixelSizingVars` + return | 同一 (gate 内の通常 early return 経路) |

→ ボードの **見た目変化ゼロ** を引き続き保証。dirty 強制漏れの経路を潰した結果、v1 に比べて「skip 判定が粗くて画面崩れる」シナリオは無くなった。

## 検証手順 (Revision 1)

### 自動

```bash
cd <repo>
npm run typecheck       # exit 0
npm run build:browser   # exit 0, 814 modules
git diff --check HEAD~2..HEAD  # clean
git status --short      # clean
```

### 手動 (6 シナリオ)

| # | シナリオ | 期待 |
|---|---|---|
| 1 | ウィンドウリサイズ | 盤面セルサイズが追従、フレーム padding 維持 |
| 2 | 盤面拡張 (board を 8x8 → 10x10 等) | セルサイズ再計算、CSS var 更新 |
| 3 | board skin 切替 (emerald → woven) | 背景 + 関連 CSS 即時反映 |
| 4 | frame skin 切替 (brass → black-gold) | フレーム画像 + padding 即時反映 |
| 5 | 別タブに切替 → 戻る (visibilitychange) | 復帰後のサイズが窓幅変化に追従 |
| 6 | ページリロード (pageshow) | 復帰後すぐに正しいサイズ |

### Trace 確認 (?perf=1)

```bash
npm run serve   # → http://127.0.0.1:8080/?perf=1
```

DevTools Performance で 10 秒 trace、`othello:syncBoardPixelSizing` で filter:

- **通常 render 多発時**: duration 分布が **明確に二峰性** に分かれるはず
  - 左の山: skip 経路 (数 μs 〜 数十 μs、`getPropertyValue` x 数回 + WeakMap lookup + 文字列 join コスト)
  - 右の山: full 経路 (v1 baseline と同等、1〜5ms)
- skip 経路の duration: **0.5ms 未満** が目標
- full 経路の duration: v1 baseline と同等 (劣化なし)

## Commit 方針 (要選択)

PR2 v1 は `75ba6578c` で commit 済み。v2 で扱う commit 粒度は 2 案:

### 案 A: v1 を amend して 1 commit に統合

```bash
git add ui/board-renderer.ts docs/perf/pr2-n3-design.md docs/perf/pr2-review-prompt.md public/module-registry.js index.html
git commit --amend --no-edit
# 必要なら履歴保持のため docs/perf/pr2-n3-design.md だけ別 commit に残す
git revert --no-commit 75ba6578c  # 危険なので推奨しない
```

- メリット: PR2 として 1 commit に見える。`git log` がきれい
- デメリット: v1 (粗 signature で画面崩れる可能性があった) を 完全に上書き、レビュー履歴が見えなくなる

### 案 B: v1 を残し、v2 を別 commit で積む

```bash
git add ui/board-renderer.ts docs/perf/pr2-n3-design.md
git commit -m "feat(ui): expand syncBoardPixelSizing signature + page-state triggers (PR2 v2)"
git add public/module-registry.js index.html
git commit -m "build: refresh browser module registry after PR2 v2 signature expansion"
```

- メリット: レビュー対応 commit が明示的に残る。v1 → v2 の差分が見やすい。revert もしやすい
- デメリット: commit 数が 1 → 3 になる (build commit 込みで)

**推奨: 案 B** (Mavis 推奨)

理由: CODEX レビュー対応の commit として明示的に残すことで、後から「なぜここでWeakMap を入れたか」「なぜ visibilitychange 入れたか」をコミットメッセージ / PR 説明で参照できる。v1 が残っていても最終的な挙動は正しいし、`git log` 上も "PR2 v2" で識別できる。

判断はユーザー (リポジトリオーナー) に委ねる。

## ロールバック手順 (Revision 1)

v2 commit だけを revert する案:

```bash
git revert --no-edit <v2-commit-hash>
npm run build:browser
```

→ 75ba6578c の v1 状態に戻る (dirty gate 自体は残るが signature が粗い)。PR1 instrumentation は維持されるため、v1 / v2 の比較 measure は可能。

完全 rollback:

```bash
git revert --no-edit <v2-commit-hash>
git revert --no-edit 75ba6578c  # これで dirty gate 自体を消す
npm run build:browser
```

→ PR2 全面取り消し、PR1 instrumentation のみ残存。
