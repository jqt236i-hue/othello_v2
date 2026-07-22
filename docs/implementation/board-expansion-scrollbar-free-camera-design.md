# 盤面拡張のスクロールバー非表示・中心保持 修正設計

- Status: implemented and verified
- Date: 2026-07-23
- Scope: Pixi通常盤面での「盤面拡張」「盤面拡張神」確定後の表示領域
- Source of truth: `01-rulebook.md`、`正本/演出正本.md`、`docs/architecture-contracts.md`、root `AGENTS.md`

## 1. 問題と望ましい結果

Pixi盤面は、拡張後も物理的な8x8 viewportを維持し、論理盤面だけを拡張する。現在の `#board-scroll-viewport` は `overflow: auto` のため、論理盤面がviewportを超えるとブラウザ標準の縦横スクロールバーを表示する。

標準スクロールバーはviewportの内寸を各軸約15px縮めるため、盤面の可視中心、canvasのclip範囲、入力用viewportの寸法が拡張確定と同時に変化する。プレイヤーには盤面が中心からずれ、不要な縦横スクロールが追加されたように見える。

修正後は次を満たす。

- 盤面拡張後もブラウザ標準スクロールバーを表示しない。
- `#board` と盤面フレームの画面上の中心位置を変えない。
- 既存セルのclient座標とセル寸法を変えない。
- 上/左拡張に必要な論理scroll offsetは維持する。
- Pixiのcanvas、入力、semantic accessibility layer、effect gutter、負座標を同じlayout contractで同期する。

## 2. 現在の構造と根本原因

- `ui/board-renderer.ts` はPixiの物理viewportをbase board寸法へ固定する。
- `ui/pixi/camera.ts` は `renderRows × cellSize` / `renderCols × cellSize` のcell-less logical surfaceを作る。
- 上/左へ拡張した場合、cameraは既存セルのclient座標を維持するよう `scrollTop` / `scrollLeft` を増やす。
- `styles-board.css` とcamera mount時のinline styleがviewportを `overflow: auto` にする。

論理scroll offset自体は座標変換に必要であり、問題はそれをユーザー操作可能なネイティブスクロールUIとして公開していることである。

## 3. 選択した設計

`#board-scroll-viewport` をプログラム制御専用のscroll containerとして扱い、overflowを `hidden` にする。

- logical surfaceと `scrollLeft` / `scrollTop` は残す。
- cameraのtopology reconciliation、layout revision、client rect変換は変更しない。
- scrollbar gutterが発生しないため、viewportのclient寸法は拡張前後で安定する。
- ユーザーのwheel/touchによる盤面パンは公開しない。
- canvas backing storeは従来どおりbase viewportとbounded effect gutterだけに制限する。

CSSとmount時inline styleを同じ `overflow: hidden` 契約へ揃え、片方だけが読み込まれた場合にも標準スクロールバーを出さない。

## 4. 代替案

### 拡張盤面全体を固定枠へ縮小する

拡張のたびに既存セルの位置と縮尺が変わり、選択中の視線とポインタ位置がずれるため不採用。

### DOMフレームとcanvasを論理盤面全体まで拡大する

大きな盤面でページoverflow、HUDとの衝突、canvas backing storeの単調増加を起こし、Pixi移行時のviewport virtualization契約を失うため不採用。

### scrollbarだけ透明化し `overflow: auto` を維持する

ブラウザ差によってscrollbar gutterやtouch panが残る。表示上隠すだけではviewport内寸の安定を保証できないため不採用。

## 5. 所有境界と非目標

- 変更所有者は `ui/pixi/camera.ts` とPixi専用CSSである。
- game state、カード解決、pending selection、CPU、network authority、`events[]` は変更しない。
- DOM compatibility backendの表示方式は変更しない。
- canvas application、ticker、writer settlement、fallback lifecycleを追加しない。
- 盤面をユーザーが任意にパンする新操作は追加しない。

## 6. 仕様と内部契約

`01-rulebook.md` と `正本/演出正本.md` に、盤面拡張で標準スクロールバーを表示せず、盤面フレーム中心・既存セル位置・縮尺を維持することを明記する。

`docs/architecture-contracts.md` では、Pixi logical surfaceのscroll値がcamera内部の座標補正であり、ネイティブスクロールUIを公開しないことをSingle Visual Writerの表示契約として明記する。

## 7. 検証戦略

1. camera unit testでviewportのinline overflowが `hidden` であることを固定する。
2. CSS contract testでPixi viewportが `overflow: hidden` であり `auto` へ戻らないことを固定する。
3. camera unit testの既存scroll compensationを維持し、論理scrollが失われていないことを確認する。
4. 実カードE2Eで盤面拡張神の前後について、board/viewportのclient寸法、中心、既存セルrect、computed overflow、scroll offsetを検証する。
5. focused Pixi tests、typecheck、browser build、Pixi playback/fallback smokeを実行する。
6. 実ブラウザで盤面拡張神を操作し、スクリーンショットとlayout metricsを確認する。

## 8. 完了条件

- 盤面拡張後に縦横の標準スクロールバーが出ない。
- viewport client寸法と盤面中心が拡張前後で一致する。
- 既存セルrectとcell sizeが一致する。
- 上/左拡張後も論理scroll offsetが正しく増える。
- 拡張セルが描画・入力できる。
- focused checks、browser build、実ブラウザ確認が成功する。
- task-owned diffだけがcommitされる。

## 9. Self-review

- 根本原因のscrollbar gutterを除去し、座標変換に必要なlogical scrollは残すため、見た目だけを隠す場当たり的な修正ではない。
- Pixi cameraの既存責務内に収まり、game/network/shared authorityへ依存を増やさない。
- CSSとinline styleの二重定義を同じ値へ揃え、load orderやstylesheet failureで契約が反転しない。
- 既存のscroll compensation testを残すため、`overflow: clip` のようにprogrammatic scrollを無効化する案を避けた。
- player-visibleな無スクロール契約を一次仕様と演出正本へ先に反映し、Pixi移行文書だけを根拠にしない。
