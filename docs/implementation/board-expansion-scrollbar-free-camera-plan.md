# 盤面拡張のスクロールバー非表示・中心保持 実装計画

- Status: complete
- Date: 2026-07-23
- Updated: 2026-07-27
- Design: `docs/implementation/board-expansion-scrollbar-free-camera-design.md`

## Phase 0 — 仕様と契約の明文化

- [x] `01-rulebook.md` に標準スクロールバー非表示、盤面フレーム中心、既存セル位置・縮尺の維持を追記する。
- [x] `正本/演出正本.md` の盤面拡張表示を同じ意図へ揃える。
- [x] `docs/architecture-contracts.md` にprogrammatic logical scrollと非公開native scroll UIの境界を追記する。

Verification: `git diff --check` と対象段落のsource inspection。

Done when: player-visible仕様と内部camera契約が同じ結果を説明する。

## Phase 1 — Pixi cameraをscrollbar-freeにする

- [x] `ui/pixi/camera.ts` のviewport mountを `overflow: hidden` にする。
- [x] `styles-board.css` のPixi viewportも `overflow: hidden` に揃える。
- [x] logical surface、scroll reconciliation、canvas gutter、input targetは変更しない。

Verification: camera focused unit test。

Done when: native scrollbarを生成せず、logical scroll値は従来どおり更新される。

## Phase 2 — 回帰テスト

- [x] camera unit testへscrollbar-free mount assertionを追加する。
- [x] CSS contract testへ `overflow: hidden` assertionを追加する。
- [x] 盤面拡張神E2Eへ中心、viewport寸法、既存セルrect、logical scrollのassertionを追加する。

Verification: 対象Jest/E2Eを個別実行する。

Done when: `overflow: auto` を戻すかscroll compensationを壊すとfocused testが失敗する。

## Phase 3 — ビルドと実機検証

- [x] `npm run typecheck` と `npm run check:window` を通す。
- [x] `npm run build:browser` を実行し、生成物をscriptから同期する。
- [x] 最小のPixi static/fallback/browser checkを通す。
- [x] 実ブラウザで盤面拡張神を確定し、スクリーンショットとlayout metricsを確認する。

Done when: 盤面拡張後もscrollbarなし、中心・寸法・入力が安定している。

## Phase 4 — 最終監査とcommit

- [x] design/planを最終実装へ同期する。
- [x] `git diff --check`、task-owned diff、生成物由来を確認する。
- [x] task-owned fileだけをstageし、検証済みcommitを作成する。

Done when: completion conditionsを満たすcoherent commitが作成され、worktree状態を説明できる。

## Completion checklist

- [x] player-visible仕様と内部契約が更新済み。
- [x] native scrollbarが非表示。
- [x] logical scroll compensationが維持される。
- [x] board/viewport中心と寸法が安定する。
- [x] focused unit/E2E、typecheck、browser build、実機確認が成功する。
- [x] 最終差分に無関係な変更がない。
- [x] commit完了。

## Self-review

- canonical specを先に更新し、root source、tests、生成物の順で進める。
- unitはmount契約とscroll補正、E2Eは実ブラウザのscrollbar gutterと中心を分担して検証する。
- DOM fallback、card rules、network mirrorを変更対象に含めず、変更範囲をPixi presentationへ限定する。
- browser-visible root source変更後の `build:browser` とスクリーンショット確認を完了条件に含めた。

## Verification results

- `npm run typecheck`: pass
- focused Jest（camera / input / accessibility / backend / CSS contract）: 5 suites、72 tests pass
- 実カードE2E（盤面拡張神6マス追加）: pass
- `npm run check:window`: pass
- `npm run check:board-test-selectors`: pass（default/Pixi violations 0）
- `npm run build:browser`: pass
- `npm run build:vite`: pass
- `npm run worker:prepare`: pass（root sourceからWorker mirrorを生成）
- `npm run check:worker-mirror`: pass（916 files verified）
- `node dist/scripts/pixijs-board-browser-check.js`: pass（classic/Vite × DPR 1/2、各19 fixtures）
- `npm run match:pixi-runtime-fallback-check`: pass
- 実ブラウザ: 拡張前後ともboard center `(640, 313)`、viewport `328 × 328`。拡張後logical surface `410 × 410`、logical scroll `(41, 41)`、overflow両軸 `hidden`
- 初回のCSS contract testは否定正規表現が後続ルールまで走査して失敗し、対象CSS blockだけを検査するよう修正後にpass
- 初回の実カードE2Eは生成済みVite配信物が旧 `overflow: auto` のままで失敗し、`npm run build:vite` で正規生成した後にpass

## 2026-07-27 Repair plan — 通常盤面レイヤーのviewport clip

### Phase 5 — 設計補強とscene mask

- [x] ユーザー画像、物理viewport、canvas effect gutter、materialization window、static bakeを照合し、通常レイヤーのclip不足を根本原因として確定する。
- [x] designへ通常レイヤーと演出レイヤーのclip境界、代替案、resource lifecycleを追記してSelf-reviewする。
- [x] `ui/pixi/board-scene.ts` で `surface` / `cell` / `marker` / `stone` / `hint` に個別viewport maskを設定する。
- [x] frame apply、reset、destroy、diagnosticsを既存scene lifecycleへ統合する。

Verification: focused scene unit testとtypecheck。

Done when: 通常pixelだけが物理viewport内へ制限され、`playback` / `effect` はbounded gutterを維持する。

### Phase 6 — 回帰テストと実ブラウザ検証

- [x] scene unit testでmask対象、矩形、非対象レイヤー、reset/reapplyを固定する。
- [x] 盤面拡張神E2Eでlogical materializationとviewport mask diagnosticsを同時に確認する。
- [x] focused Pixi scene/camera/backend/E2Eと実ブラウザのスクリーンショット確認を完了する。

Verification: focused Jest/E2E、`npm run match:pixijs-board-playback-check`、Pixi browser/fallback smoke。

Done when: 拡張セルは論理的に存在・再利用されるが、通常セルpixelは盤面枠外へ露出しない。

### Phase 7 — 生成物、AI code review、commit

- [x] `npm run typecheck`、`npm run check:window`、`npm run build:browser`、必要なmirror生成を完了する。
- [x] task-owned diffをAI code reviewし、actionable findingを修正して関連checkを再実行する。
- [x] design/planを最終実装とverification resultsへ同期する。
- [x] `git diff --check` と最終statusを確認し、task-owned fileだけをcommitする。

Done when: 追補の全完了条件を満たす検証済みcommitが作成される。

### Repair completion checklist

- [x] 通常5レイヤーが物理viewportでclipされる。
- [x] playback/effect gutterとSingle Visual Writerが維持される。
- [x] 盤面拡張のlogical scroll、中心、セル寸法、入力が維持される。
- [x] focused unit/E2E、typecheck、browser build、実機確認が成功する。
- [x] 生成物とroot sourceが同期する。
- [x] actionableなレビュー指摘と未解決事項が残らない。
- [x] commit完了。

### Repair plan Self-review

- canonical scene sourceを先に変更し、tests、browser build、mirrorの順で進める。
- unitはPixi maskの構造と矩形、E2Eは実カード経路のcamera/materialization/diagnostics、スクリーンショットは最終pixel結果を分担して検証する。
- canvas DOM clipやgame/card/network stateへ範囲を広げず、欠陥があるPixi presentation ownership内に変更を限定する。
- reset/reapply/destroyを実装項目に含め、修正でmask DisplayObjectや古い矩形が残る回帰を防ぐ。

### Repair verification results

- `npx jest test/ui.pixi-board-scene.test.ts --runInBand`: 1 suite、34 tests pass
- focused Jest（Pixi camera/backend、盤面拡張game logic）: 4 suites、70 tests pass
- `npm run typecheck`: pass
- 実カードE2E（盤面拡張神6マス追加、912×793）: pass。logical拡張セルを保持したままviewport mask diagnostics、中心、セル寸法、scroll補正、入力を確認
- `npm run check:window`: pass
- `npm run check:board-test-selectors`: default/Pixi violations 0
- `npm run build:browser`: pass
- `npm run build:vite`: pass
- `node dist/scripts/pixijs-board-browser-check.js`: classic/Vite × DPR 1/2、各19 fixtures pass
- `node dist/scripts/pixijs-board-playback-browser-check.js`: 12 reports、208 scenarios pass
- `node dist/scripts/pixijs-runtime-fallback-browser-check.js`: classic/Viteのfallback 4経路 pass
- `node dist/scripts/browser-cross-platform-smoke.js`: Chromium/Firefox/WebKit × desktop/touch × Pixi/DOM、12 probes pass
- `npm run worker:prepare`: pass（925 files mirror verified）
- `npm run check:worker-mirror`: pass
- 実ブラウザ画像: 1280×900と912×793の両方で、通常セルが盤面枠外のHUD/手札へ露出しないことを確認
- AI code review: mask所有、型、reset/destroy、Single Visual Writer、effect gutter、生成物を再確認し、actionable findingなし
- 実カードE2Eの初回実行は生成済みVite bundleが旧sceneのままでdiagnostics assertionに失敗した。`npm run build:vite` で正規生成後、1280×900と912×793の両方で再実行してpass
