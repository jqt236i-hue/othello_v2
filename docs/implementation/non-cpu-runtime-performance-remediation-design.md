# 非CPUランタイム負荷の残存対策 設計書

## 目的

CPU思考処理のWorker移行後も残る、相手のカード使用・着手時の瞬間的なフレーム落ちと、2Dゲームとして大きい初期バンドル／反復UI処理を削減する。ゲーム結果、`events[]` の順序、アニメーション時間、Single Visual Writer、DOM互換フォールバックの成立条件は変更しない。

## 根拠

- `artifacts/opponent-action-frame-stall/review-candidate.json` のGPU実測は25/25サンプル有効で、CPU起因の長時間タスクは再現しなかった。一方、各アクションでPixiの `prepareCount` 13～17回に対し `stalePrepareCount` 7～8回が発生した。
- 240Hz実測では待機時240FPSを維持できる一方、通常のプレゼンテーション中に12.5～25msのフレーム間隔が残る。CPU思考以外の同期処理と描画準備が平均FPSを押し下げる余地がある。
- 現行Vite主バンドルは約4.12MB（gzip約1.05MB）で、通常のPixi経路では評価しない `ui/board-dom-compat/*` と、明示的な性能計測時しか使わない `ui/board-visual/performance-harness` のアクセサーを静的に含む。
- `updateCpuCharacter()` は同じ肖像でも `new Image()` を作り直す。カード名のフォントready処理は同じ `document.fonts.ready` が解決済みでも、判定前にrequestAnimationFrameを予約する。

## 対象範囲

1. ローカル再生中に上書きされる盤面フレームのPixiリソース準備を抑止する。
2. Vite経路だけでDOM互換盤面と盤面性能計測器を主バンドルから分離する。
3. CPU肖像の同一ロードと、解決済みフォントサイクルのカード名再調整予約を重複させない。
4. 上記の契約テスト、Vite/ブラウザビルド、Pixi/DOMフォールバック、実ゲーム相当のプレイバックを検証する。

## 対象外

- CPU探索、Workerプロトコル、カードルール、ネットワーク権威、アニメーション演出内容の変更
- Pixiの60HzアニメーションTickerや意図された中間フレームの間引き
- DOM互換盤面の削除、通常経路化、Pixiとの同時マウント
- 長時間selfplay／学習処理

## アーキテクチャ

### 1. 同一revisionのidleフレームをGPUへ再適用しない

追加トレースにより、破棄準備は再生中の `prepareFrame()` 先読みではなく、writer release後に同じ表示内容が別のidle `frameToken` で4～6回送られ、毎回 `backend.applyFrame()` を開始する経路だと判明した。`frameToken` はsettlement identityであり、表示内容の同一性ではない。

`ui/board-visual/controller.ts` は、frame revision composerが保証するmodel/layout/appearance/themeの4 revisionと `renderSessionId` を比較する。すべて同一のidle frameはPixi backendへ再適用せず、`beginApplyFrame` が返すworld-state commitだけを実行する。直前の同一frameがまだsettlement中なら最新1件のmetadataを保持し、元の同一pixel frameがsettleした後にworld-state commitを追従させる。

再生イベント、異なるrevision、異なるrender session、strict network committed-frame、mount/recoveryは従来どおりbackendへ適用する。これによりSingle Visual Writerとboard update contextの消費を保ちながら、同一pixel用のテクスチャ準備・lease・キャンセルを除去する。

### 2. Vite専用の遅延ペイロード

クラシック経路の `public/module-registry.js` は同期フォールバック契約を保つため変更しない。`scripts/build-vite-module-bridge.ts` にVite専用遅延グループを追加し、以下をstartup accessor集合から除外して自己完結ペイロードへ生成する。

- `compatibility`: `ui/board-dom-compat/*`
- `diagnostics`: `ui/board-visual/performance-harness`

通常Pixi起動ではどちらも取得・登録しない。`debug=1&boardRenderer=dom` はViteエントリが起動前に `compatibility` をロードする。Pixi初期化失敗または回復不能なcontext lossでは、既存の非同期フォールバック処理が同ペイロードを待ってからDOM backendを排他的に構築する。`debug=1&boardPerf=1` はハンドラ初期化時に `diagnostics` を待ってから計測器をrequireする。

Viteのモジュールブリッジは遅延グループ内依存を同ペイロードへ、既存startup依存を `window.require` 境界へ変換する。盤面ライター、canvas、WebGL context、settlement経路は追加しない。

### 3. 同一画像ロードの世代管理

CPU肖像要素ごとに、一次URLとfallback列から作るロード署名とロード世代を `WeakMap` で保持する。同一要素・同一署名の更新では既存ロード／結果を再利用し、別の `Image` を生成しない。署名が変わった場合だけ新しいロードを開始し、古いonload/onerrorは世代不一致ならDOMへ反映しない。

alt、network用class、レベルscale、特殊表示、ラベルは画像ロードの有無にかかわらず毎回同期するため、画像キャッシュが表示状態の権威にはならない。

### 4. フォントreadyの早期終了

`scheduleCardNameRefitAfterFontsReady()` は `document.fonts.ready` が前回の解決済みPromiseと同一で、強制指定もpendingもない場合、requestAnimationFrameを予約せず即座に `false` を返す。未解決・切替・強制サイクルの世代管理と再調整動作は維持する。

## 代替案

### Pixi backend内でキャンセルを安くする

キャンセル後のlease解放は既に実装済みであり、準備開始自体のJS処理とPromise連鎖は残るため不採用。

### requestAnimationFrameで準備をdebounceする

同一フレーム内の更新しかまとめられず、非同期の画像準備中に届く同一frameを除去できないため不採用。

### 再生中のlatest準備をsettlement開始まで遅らせる

最初に実装して再計測したが、`prepareCount` と `applyRequestCount` が常に同数で `stalePrepareCount` も変化しなかった。原因が先読みではないことを確認できたため変更を撤回し、idle同一revisionの適用抑止へ置き換えた。

### DOM互換盤面を削除する

WebGL初期化失敗・context lossの回復契約を壊すため不採用。

### 全debugモジュールを一括遅延化する

`debug-card-search` などは既存起動表とテスト用globalに依存し、今回の性能原因に対して変更範囲が大きい。副作用のない盤面性能計測器だけを分離する。

## リスクと対策

- revision誤判定で必要な描画を省略する可能性: 4 channelすべてが有限値かつ一致し、render sessionも一致する場合だけ省略する。いずれかの変更とsession切替はbackend適用をテストする。
- 同一pixelでもworld-state commitが必要な可能性: backend適用だけを省略し、frameごとのcommit callbackとsettled-frame通知は最新metadataで実行する。
- 遅延ペイロード取得失敗でDOM fallbackが作れない可能性: エラーを成功扱いせず既存reload-requiredへ伝播し、初期fallback／context recoveryテストを実行する。
- Viteとクラシックの配信差分: Vite生成器だけで分離し、root/classic registryとWorker mirrorを生成コマンドで検証する。
- 画像コールバックの競合: 要素単位の世代一致を必須にする。
- フォント切替後の再調整漏れ: `ready` Promiseのidentity変更と `forceCurrentCycle` を従来どおり再実行条件にする。

## 検証方針

- Jest: controller settlement、Pixi backend、Vite payload loader/build registry、status display、card renderer
- ビルド: `npm run typecheck`, `npm run build:ts`, `npm run build:vite`, `npm run build:browser`
- 盤面契約: Pixi playback check、Pixi runtime fallback check、cross-platform smoke
- 性能: opponent-action quick captureで `stalePrepareCount` とフレーム指標を再計測し、Vite主バンドルと遅延chunkのサイズを記録
- 最終: `git diff --check`、関連diff、`git status --short`

## 完了条件

- 同一revisionのidle frameが連続しても、Pixiの追加prepare/applyを起動せず、最新metadataのworld-state commitは完了する。
- 通常Vite主バンドルにDOM互換盤面とperformance harnessの実装本体が含まれず、必要時だけロードされる。
- Pixi、明示DOM、Pixi初期fallback、context-loss fallbackが単一ライター契約のまま動作する。
- 同一CPU肖像の連続更新が追加 `Image` を生成せず、同一解決済みフォントサイクルが追加RAFを予約しない。
- 焦点テストと必要なブラウザ生成・実機相当チェックが成功する。

## Self-review

- 最初の案はDOM互換を共通optional groupへ移すものだったが、クラシック経路の同期登録まで変えてしまうため撤回した。Vite専用分離に限定し、既存のclassic fallbackを保持した。
- 描画フレームそのものの間引きは `events[]` と演出時間へ影響し得るため、playback frameには適用せず、revision composerが同一pixelを保証するidle frameだけを対象にした。
- 初回実装後の再計測でstale準備が減らず、先読み原因説を撤回した。診断entryを追跡し、同一revisionのidle再適用が原因だと確認して設計を修正した。
- 肖像キャッシュを表示状態の権威にしないよう、画像以外のclass/label/scale更新は毎回実行する設計へ修正した。
- 主バンドル全体の大幅分割は依存関係と起動表の再設計を伴うため、今回実測で通常未使用と確認できた2領域に限定した。
