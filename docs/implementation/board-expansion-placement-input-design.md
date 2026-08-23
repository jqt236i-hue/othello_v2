# 盤面拡張マスへ石を置く入力 修正設計

- Status: active
- Date: 2026-08-22
- Scope: 通常 Pixi 盤で「盤面拡張」「盤面拡張神」後の拡張マスへ、仕様どおり石を置けるようにする
- Source of truth: `01-rulebook.md`（変更しない）、`docs/architecture-contracts.md` §6.1.1 / §7.3、root `AGENTS.md`

## 1. 問題と望ましい結果

ルール層では拡張マスは通常マスと同じく配置・反転に参加する。既存テストもそれを固定している。

通常の Pixi 盤では、物理 viewport（`#board` / `#board-scroll-viewport`）が初期ベース寸法のまま固定され、拡張マスは canvas の effect gutter 上に描かれる。ポインタ入力の対象は viewport だけなので、見えている拡張マスをクリックしても `handleCellClick` に届かない。同じ方向へ effect gutter（既定 2 マス）を超えて伸ばすと、3 マス目以降は canvas からも外れ、描画も入力も消える。

修正後は次を満たす。

- 仕様文面は変えない。
- 既存マスの位置・縮尺、盤面フレーム中心、標準スクロールバー非表示は維持する。
- 存在する拡張マスは描画され、マウス／タッチで合法手なら石を置ける。
- 単一 Visual Writer、canvas / ticker / settlement は増やさない。
- `game/` の合法手・着手適用は変更しない。

## 2. 現在の構造と根本原因

- `ui/board-visual/layout-runtime.ts` は Pixi の `#board` を `baseCols × baseRows` に固定する。
- `ui/pixi/camera.ts` は logical surface を伸ばし、上／左拡張では `scrollLeft` / `scrollTop` で既存セル座標を保つ。canvas は viewport + 対称 2 マス gutter。
- `ui/pixi/board-scene.ts` は viewport clip に、canvas と交差する拡張マス footprint だけを union する。
- `ui/pixi/board-input.ts` は `renderer.events.setTargetElement(viewport)` と viewport 上の native listener だけを持つ。canvas 層は `pointer-events: none`。
- `BoardInputController.hitTestClientPoint` と `getCellClientRect` は拡張座標を扱える。届いていないのはポインタイベントだけである。

DOM 互換盤は `#board-expansion-layer` のセルに直接 listener を付ける。通常プレイの欠落は Pixi 入力である。

## 3. 選択した設計

物理 8x8 viewport を広げず、**描画済み拡張マスの client 座標を document 捕捉で hit-test する**。

1. `.pixi-board-canvas-layer` を `pointer-events: auto` にする。枠外への overflow 描画は残す。
2. 生産経路では `createPixiBoardInput().mount` の native press/move/release を `document` に付ける。拡張マスは木枠クロムや `#card-detail-panel` の下に描かれることがあり、canvas overflow だけではヒットしない。hit-test は既存の client 座標経路を使う。
3. カード本体・使用／詳細／破壊・パス・方向ボタンなど実コントロールは document 捕捉を譲る。パネル空白が拡張マスと重なるクリックは hit-test が当たれば配置する。
4. Federated EventSystem の target は viewport のまま残す。document 捕捉がセルを取った press は `stopPropagation` し、二重 dispatch しない。
5. canvas gutter を「effect gutter」と「初期ベース矩形から外へ出た、現存する拡張セル AABB」の大きい方にする。左右上下は `existingKeys` のうち `baseKeys` に無いセルのワールド座標から求め、180° 視点では画面辺へ写す。`renderCols - baseCols` や logical − viewport では増やさない（カスタム大盤の仮想化を壊すため）。
6. `materializeBoardViewport` は可視窓の dense 範囲に加え、窓の外にある `expansionSide !== null` の既存セルを sparse に含める。void を densify しない。

これにより、1〜2 マスの gutter 内拡張は入力だけで直り、3 マス目以降は canvas が伸びて描画と入力が残る。`#board` 寸法とフレーム中心は変わらない。

## 4. 代替案と不採用理由

### 物理 `#board` を render bounds まで拡大する

一次仕様の「表示領域を伸ばす」には近いが、親がセンタリングすると既存マスが動く。scrollbar-free camera 契約と E2E の boardRect 不変も壊す。今回の欠落は配置入力であり、枠サイズ変更は必要以上に大きい。

### hitArea だけ viewport 外へ伸ばす

Federated の target が viewport のままでは、枠上のクリックが EventSystem に入らない。native 根を canvas へ移す方が原因に直接効く。

### キーボード専用の回避

合法手リスト経由では置ける余地があるが、見えているマスをクリックできないままでは仕様を満たさない。

## 5. 所有境界と非目標

- 所有者は `ui/pixi/board-input.ts`、`ui/pixi/camera.ts`、`ui/pixi/board-backend.ts`、`ui/board-visual/model.ts`、Pixi 用 CSS。
- カード解決、合法手、network authority、`events[]`、DOM 互換のセル生成は変更しない。
- プレイヤーが盤を任意パンする操作は追加しない。
- `01-rulebook.md` と `正本/` は変更しない。

## 6. 内部契約

`docs/architecture-contracts.md` §7.3 に、拡張マスの入力は物理 viewport ではなく native client hit-test（枠クロム向けの document 捕捉を含む）で届くことを追記する。canvas backing store は既存拡張セルの AABB までだけ伸びる。軌跡のために論理盤全体へ伸ばすことはしない。

## 7. 検証戦略

1. Pixi input: canvas 上の viewport 外座標でも native pointer が `handlePointer` に届く。
2. camera: 拡張が 2 マス以内なら gutter 不変。3 マスならその方向の gutter が増える。既存セル client rect は不変。
3. model: 可視窓の外の expansion セルが materialize される。void は densify しない。
4. backend: mount が document を pointer root として渡す。
5. CSS: canvas 層が `pointer-events: auto`。
6. 既存の盤面拡張合法手 Jest、camera cell-rect 不変、focused Pixi tests。
7. typecheck、affected ソースの browser build。

## 8. 完了条件

- 拡張マスの client 中央への pointerdown/up が `handleCellClick` と同じ経路に届く。
- 合法な拡張マスには石を置ける（ルール層は既存のまま）。
- 既存マス位置・縮尺、`#board` ベース寸法、標準スクロールバー非表示が維持される。
- 3 マス以上の同方向拡張でも、そのマスが materialize され canvas に載る。
- focused tests と typecheck が通る。browser-visible 変更後は `npm run build:browser`。

## 9. Self-review

- 根本原因は合法手欠落ではなく、物理 `#board` のヒット箱に縛られたポインタ根である。canvas overflow だけでは枠クロム／前面パネル上の拡張マスに届かないため、document 捕捉 + client hit-test が最小の修正である。
- gutter を logical − viewport で増やすとカスタム大盤の仮想化が壊れる。ベース矩形からの expansion AABB だけを使う。
- 物理枠を広げないため、仕様の「CSS 外周フレームを広げる」は既存のフレーム保持設計のまま残る。今回は配置可能性を復元する。表示枠そのものの拡大は別タスクである。
- 無関係な演出差分（`ui/pixi/effects/move.ts` 等）には触らない。
