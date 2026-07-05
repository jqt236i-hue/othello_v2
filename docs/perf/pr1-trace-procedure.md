# PR1 Trace 取得手順 (baseline 記録)

目的: `npm run build:browser` 後の `?perf=1` 起動で **10 秒 Performance trace** を 1 本撮り、PR2 / PR3 / PR5 の判断材料となる baseline 数値 (実測値) を記録する。

この instrumentation は前回の性能調査の推定 (50-100ms / render → 5-10ms) が **実環境で本物か** を確かめることが目的。

## 前提

- `npm install` 済み
- `npm run build:browser` 済み (`public/module-registry.js` に `ui/perf-benchmarks` が含まれている)
- OFF 確認 → ON 切替 の順でチェック

## OFF 確認 (必須)

```powershell
npm run serve
# -> http://127.0.0.1:8080/
# -> DevTools Performance タブ -> Recording 開始 -> 数秒盤面を触る -> Stop
# -> "othello:" 名前空間の mark / measure が一切出ないこと
# -> Console で:
window.PerfBenchmarks.isPerfBenchEnabled()
// -> false
```

**1 件でも othello: mark が出ていれば fail-first。`ui/perf-benchmarks.ts` の `PERF_BENCH_ENABLED` 判定を再確認。**

## ON 切替 (?perf=1)

URL に `?perf=1` を付与:

```
http://127.0.0.1:8080/?perf=1
```

または DevTools console で:

```javascript
window.__DEV_PERF__ = true
// -> reload 必要 (PR1 は reload スコープ)
```

Console で再確認:

```javascript
window.PerfBenchmarks.isPerfBenchEnabled()
// -> true
```

## 10 秒 trace のシナリオ

10 秒の間に以下を含める:

- **盤面状態**: 8×8 で 30 個以上埋まる (中盤以降)
- **特殊石**: 15-20 個 (Bomb / Blockade / Freeze / Seed / Guard / Regen / Manifest Aura などを含む)
- **操作**:
  - カード使用を 3-5 回 (Flip 系、Bomb 系、Blockade 系を 1 回ずつ)
  - flip 連発を数ターン
  - CPU 連発 2-3 手

DevTools Performance タブで **Recording を開始** -> 上記シナリオを進める -> **10 秒で Stop**。

## Performance タブの絞り込み

Filter 入力:

```
othello:
```

または `name` カラムで `othello:` 名前空間を表示。

## 取得する measure

| 区間 | 意味 | PR 候補 |
|---|---|---|
| `othello:renderBoard` | renderBoard() 全体 | (全体 cycle) |
| `othello:renderBoardDiff` | renderBoardDiff() 全体 + outer finally | PR3 (N4 skip), PR4 (N1 patch) |
| `othello:renderBoardDiff.summary` | 1 件 = 1 render のサマリ (mark detail あり) | PR3 / PR4 / PR5 |
| `othello:syncBoardPixelSizing` | N3 候補 measure | PR2 (N3) |
| `othello:reconcileCellHasDiscClasses` | reconcile 1 | PR3 (N4) |
| `othello:reconcileCellHintClasses` | reconcile 2 | PR3 (N4) |
| `othello:_syncBoardShrinkGodDirectionHintsForDiff` | reconcile 3 | PR3 (N4) |
| `othello:buildCurrentCellState` | N2 候補 measure | PR5 (N2) |

## 記録フォーマット

```
PR1 baseline (YYYY-MM-DD, シナリオ名: <記入>):

区間                          p50      p95      件数/10s
othello:renderBoard           ?.?ms    ?.?ms    ?
othello:renderBoardDiff       ?.?ms    ?.?ms    ?   <- flip 後スパイク
othello:syncBoardPixelSizing  ?.?ms    ?.?ms    ?
  -> 通常時 (no resize)       ?.?ms    ?.?ms
  -> resize / shape change 後 ?.?ms    ?.?ms
othello:buildCurrentCellState ?.?ms    ?.?ms    ?
reconcile 3 パス合計          ?.?ms    ?.?ms
  (reconcileCellHasDiscClasses + reconcileCellHintClasses
   + _syncBoardShrinkGodDirectionHintsForDiff)

othello:renderBoardDiff.summary detail (3 件サンプル):
  - { updatedCount: ?, updateCellDOMCount: ?, updateCellDOMDurationMs: ?, totalCells: ? }
  - { ... }
  - { ... }
```

## 数字が出揃った後の判断 (PR 着手順)

- **N3 (syncBoardPixelSizing dirty gate)**: 通常時 (no resize, no shape change) の `othello:syncBoardPixelSizing` duration **p50 / p95 が目立つ** (5ms 以上、または `othello:renderBoardDiff` 全体に対して無視できない割合) なら着手。**1ms 未満で目立たないなら優先度を下げて N4 / N1 を先に見る。** `resize / shape change` 後の spike が見えていれば尚更好材料。
- **N4 (条件付き reconcile skip)**: reconcile 3 パス合計 p50 >= 1ms なら skip の効果あり。p50 < 0.5ms なら効果薄。
- **N1 (cell.innerHTML -> patch path)**: `othello:renderBoardDiff.summary` の `(updateCellDOMDurationMs / updateCellDOMCount)` = 1 cell 平均 DOM 操作コスト。数字が大きいほど N1 の投資対効果が高い。
- **N2 (projector 9 Map -> 1 Map + メモ化)**: `othello:buildCurrentCellState` duration p50 < 1ms、または `(total measure sum) / renderBoardDiff duration` で 10-15% 未満 -> Phase 1 で見送り候補。

## 完了後のアクション

1. baseline 数字をこのファイル (または別途 PR レビュー用 markdown) に記録
2. 数字から PR2 / PR3 / PR5 の着手優先度を最終決定
3. PR2 着手 (N3) -> 単独 PR で計測後、再 trace で比較

## 関連コミット

- `6d0e34cd6` chore(ui): add perf-benchmarks helper (PR1 instrumentation)
- `570234096` chore(ui): instrument board-render functions with perf marks
- `7bdf90b42` build: refresh browser module registry after PR1 instrumentation
