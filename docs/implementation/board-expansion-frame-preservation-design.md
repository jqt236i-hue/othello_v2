# 盤面拡張後のフレーム保持 修正設計

- Status: implemented and verified
- Date: 2026-07-23
- Scope: 8x8通常盤面に対する「盤面拡張」「盤面拡張神」後の盤面フレーム表示
- Source of truth: `01-rulebook.md`、`docs/architecture-contracts.md`、root `AGENTS.md`

## 1. 結論

8x8の欠けのない通常盤面では、盤面拡張後も選択中の画像フレームを表示し続ける。

画像フレームを外してCSS輪郭だけを使う条件は「現在の描画矩形に空きがあること」ではなく、「初期盤面マスク自体に欠けがあること」とする。円形盤面など初期盤面が非矩形のケースは従来どおり画像フレームを表示しない。

## 2. 根本原因

`ui/board-visual/frame-presenter.ts` は現在、次の式で `board-has-void-cells` を `#board` と `#board-frame` の両方へ付与している。

```text
model.cells.length < topology.renderRows * topology.renderCols
```

盤面拡張は、現在盤面の外側に必要なマスだけを追加する。たとえば上辺へ1マス追加すると描画境界は9行×8列になるが、追加される実在マスは1つだけである。このため残り7座標が描画用の一時的な `void` となり、上式は常に真になる。

`styles-layout.css` は `#board-frame.board-has-void-cells` の背景、影、画像疑似要素をすべて無効化するため、盤面拡張が正常に描画されていてもフレームだけが消える。

一方、Pixi scene は初期8x8領域の欠けだけを基準に surface mode を選んでおり、初期盤面が矩形ならDOMの画像フレームを保持する前提で描画する。この分類差が直接原因である。

## 3. 設計原則

次の2概念を分離する。

| 概念 | 意味 | 利用先 |
| --- | --- | --- |
| render void | 現在の描画境界内に存在しない座標がある | `#board` のDOM互換用セル表面・輪郭処理 |
| base void | 初期盤面マスクが `baseRows × baseCols` の矩形を満たさない | `#board-frame` の画像フレーム表示方針 |

クラス契約は次のようにする。

- `board-has-void-cells`: render void を表し、`#board` だけに付与する。
- `board-has-base-void-cells`: base void を表し、`#board-frame` だけに付与する。
- `styles-layout.css` の画像フレーム無効化セレクタは `board-has-base-void-cells` だけを見る。
- 旧状態からの復旧時に `#board-frame.board-has-void-cells` が残らないよう、frame presenter が明示的に除去する。

これにより、8x8通常盤面の部分拡張では `#board` に render void クラスが付いてもフレーム画像は残る。円形盤面では `#board-frame` に base void クラスが付き、従来どおり画像フレームを外す。

## 4. トポロジー契約

canonical な `shared/board/topology.ts` はすでに次を分離している。

- `baseKeys`: 初期盤面マスク
- `expansionKeys`: 拡張で追加されたマス
- `existingKeys`: 現在存在する全マス

表示モデルの `BoardRenderTopologyModel` に `baseKeys` を必須フィールドとして追加し、`ui/board-visual/model-builder.ts` で canonical topology からそのまま投影する。

frame presenter は `baseKeys.length < baseRows * baseCols` だけで base void を判定する。`existingKeys` から初期盤面を推測しない。これは、拡張マスが初期盤面の欠け座標と同じ座標へ追加された場合にもフレーム方針が誤って変化しないためである。

`createBoardRenderModel()` は `baseKeys` を他のkey配列と同じくソート・重複除去・freezeし、frame revision fingerprintにも含める。

## 5. 所有境界

- `ui/board-visual/frame-presenter.ts` がフレームskin/layoutとフレーム表示クラスを所有する。
- `ui/board-dom-compat/renderer.ts` は `#board` のrender voidクラスだけを更新し、`#board-frame` を直接変更しない。
- Pixi/DOM互換のどちらも canonical game stateやカード結果を変更しない。
- canvas、ticker、settlement、network authority、`events[]` 順序は変更しない。
- board renderer のframe transaction rollbackは新しいフレームクラスも復元対象にする。

## 6. 仕様書の扱い

`01-rulebook.md` はすでに次を定めている。

- 欠けのない通常盤面は選択中の画像フレームを表示する。
- 円形など欠けのある特殊盤面はCSS輪郭を使う。
- 盤面拡張は選択方向へ盤面を延長し、既存マスの位置や縮尺を変えない。

今回の変更はこの既存仕様への復元であり、カード効果、表示文言、演出タイミングの変更ではない。したがって `01-rulebook.md` と `正本/*.md` は変更しない。

## 7. 回帰防止

最低限、次を自動検証する。

1. 初期8x8が完全で描画境界だけが疎な場合、`#board` はrender void、`#board-frame` はbase voidなしになる。
2. 初期盤面自体が疎な場合、`#board-frame` はbase voidになる。
3. 旧 `#board-frame.board-has-void-cells` はframe適用時に除去される。
4. CSSは `board-has-base-void-cells` のときだけ画像フレームを隠す。
5. 実ブラウザで「盤面拡張」を確定した後も、疑似要素の画像、frame fill、shadowが有効である。
6. PixiとDOM互換の双方でフレーム方針が一致し、Pixi laneのcanvas/context数が増えない。

「盤面拡張神」は同じcanonical `baseKeys` とframe presenterを通るため、複数方向・複数セルの疎な拡張モデルをfocused testで覆い、実ブラウザでも少なくとも一度確認する。

## 8. 代替案と不採用理由

- 描画境界を常に矩形で埋める: ゲーム上存在しないマスをcanonicalまたはsemantic cellとして扱う危険があり不採用。
- 拡張中だけCSSを例外上書きする: カード名や一時状態へ表示方針が依存し、再接続・snapshot復元・DOM fallbackで乖離するため不採用。
- `existingKeys` のうち0〜base範囲だけを数える: expansionが初期欠け座標へ入ると初期形状を誤判定するため不採用。
- フレーム画像をPixiへ移す: Single Visual Writerの現行境界を不必要に広げ、修正範囲が過大になるため不採用。

## 9. 自己レビュー

- 初期盤面形状と現在の描画境界を別フィールドから判定するため、拡張方向・回数・負座標に依存しない。
- DOM互換rendererからframe書き込みを外すため、frame presenterとの二重所有を解消できる。
- base voidの判定はcanonical topology由来で、UIが盤面ルールを再計算しない。
- 既存の円形盤面、穴マス、盤面縮小、oversize layout、skin選択はそれぞれ別の契約を維持する。
- player-visible仕様を変えず、生成物はroot sourceの検証後に既存build/mirror手順で同期する。
