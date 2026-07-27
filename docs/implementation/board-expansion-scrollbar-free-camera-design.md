# 盤面拡張のスクロールバー非表示・中心保持 修正設計

- Status: implemented and verified
- Date: 2026-07-23
- Updated: 2026-07-27
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

## 10. 2026-07-27 追補 — 通常盤面レイヤーの枠外露出

### 10.1 追加で確認した問題と根本原因

拡張回数が増えた状態では、論理盤面のセルが物理8x8 viewportの外側にあるHUD、手札、カード検索表示へ露出する。cameraとcanvas backing storeの寸法は固定されたままであり、ページlayoutやlogical surfaceの再拡大が原因ではない。

Pixi canvasは、盤面端を起点にする爆発、軌跡、トポロジー演出を描けるよう、物理viewportの四辺へbounded effect gutterを持ち、DOM上でもその範囲を表示する。一方、静的盤面、セル、marker、石、hintの通常レイヤーには物理viewport maskがなかった。materializationのoverscanとeffect gutterへ保持した論理セルが、そのまま演出余白へ描画されたことが直接原因である。

### 10.2 選択した設計

`ui/pixi/board-scene.ts` が、通常盤面を所有する次の各レイヤーへ、物理viewportと同一矩形の永続Pixi maskを設定する。

- `surface`
- `cell`
- `marker`
- `stone`
- `hint`

mask矩形は各frameの `canvasViewport.sceneOffsetX/Y` を左上とし、`camera.viewportWidth/Height` を寸法に使う。これにより上/左gutterを含むcanvas座標系でも、通常盤面pixelだけを物理viewportへ限定できる。

mask DisplayObjectは既存の `interaction` layer配下の専用containerで所有する。rootの固定layer順を変えず、別canvas、別writer、別tickerを追加しない。maskは入力を受けず、reset時に形状を消去し、scene destroyで既存resource lifecycleと一緒に破棄する。

`playback` と `effect` はmask対象にしない。盤面端を起点にするboard-local演出は従来どおりbounded effect gutterまで描画でき、演出のclip契約を維持する。

### 10.3 不採用案

- canvas layerまたは `#board` 全体を `overflow: hidden` にする案は、正規のboard-local演出まで物理viewportで切るため不採用。
- overscanやeffect gutterのmaterializationを削る案は、端をまたぐ演出、移動中ghost、camera再配置時の再利用を壊すため不採用。
- 論理盤面全体に合わせてframe/canvasを拡大する案は、HUD衝突とbacking store増大を再導入するため不採用。

### 10.4 検証と完了条件

1. scene unit testで通常5レイヤーだけが、scene offsetを含む物理viewport矩形へmaskされることを固定する。
2. 同じtestで `playback` / `effect` がmaskされず、固定root layer順とeffect gutterが維持されることを確認する。
3. 盤面拡張神E2Eで、拡張セルの論理materializationを維持したまま、backend diagnosticsのmask契約を確認する。
4. focused Pixi tests、typecheck、browser build、Pixi browser/playback/fallback checkを通す。
5. 実ブラウザの拡張状態をスクリーンショットで確認し、通常セルが盤面枠外へ露出しない。

### 10.5 追補Self-review

- player-visible仕様は既に「物理viewportを維持し、論理盤面だけを拡張する」と定義済みであり、今回は仕様変更ではなく実装の契約違反修正である。`01-rulebook.md` と `正本/` の再変更は不要。
- canvas全体を切らず通常レイヤーだけを切るため、Single Visual Writerとbounded effect gutterの両方を維持する。
- mask矩形をcell数や論理盤面範囲から再計算せずcameraの物理viewportから得るため、拡張回数に依存しない。
- maskをレイヤーごとに分離し、1つのmask DisplayObjectを複数対象で共有するPixi実装依存を避ける。
