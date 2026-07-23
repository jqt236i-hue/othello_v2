# UX保持ランタイム最適化・完全監視 設計書

## 文書の役割

- 役割: 起動・初動・対局中フレーム安定化の全対象を、UXを変えずに実装し、以後の退行を自動検知できる状態へするための設計正本
- プレイヤー向け仕様の正本: `01-rulebook.md`
- 内部アーキテクチャの正本: `docs/architecture-contracts.md`、特に §7.3、§11、§12
- 実装手順: `docs/implementation/ux-preserving-runtime-optimization-observability-plan.md`
- 非目標: ゲームルール、カード効果、盤面演出順、盤面演出時間、ネットワーク権威、CPU方針、通常プレイ中の常時テレメトリ収集

## 問題と期待結果

現状は、対局中の通常シナリオで大きなフレーム停滞が再現しない一方、起動時に不要な画像・CSS・非表示DOMを評価し、盤面ロックだけの変化でも64セルのPixi hint viewを再構築する余地が残っている。最適化候補ごとに個別テストや性能スクリプトは存在するが、「何がいつ読み込まれたか」「表示を保ったまま処理量が減ったか」「フォールバックでも成立するか」を一つの判定体系で追跡できない。

期待結果は次のとおり。

1. 通常Pixi起動では、初期盤面または直近の演出に必要な特殊石だけを読み込む。
2. 盤面の入力ロックだけが変わる場合、64セルのヒントGraphicsを再描画しない。
3. Viteのハッシュ付き画像とroot論理パスを同一資産として扱い、同一画像を二重取得しない。
4. 非表示ヘルプ画像は初期盤面の準備を競合せず、初回表示時または盤面準備後のアイドル時間に読み込む。
5. DOM互換盤面CSSは通常Pixi起動で取得せず、DOM backendのマウント前に一度だけ読み込む。
6. lossless WebPは、容量・可視一致・デコード時間・フォールバックの審査に合格した画像だけを採用する。
7. リザルトは既存の表示時DOM生成を維持して専用CSSを遅延し、プロフィール、ルールヘルプ、デッキ編成、ネットワーク専用UIは小さい外枠を残して内部DOMと専用CSSを初回利用時に一度だけ生成する。
8. 上記を構造契約、ブラウザ実操作、性能計測、配信物検証の四層で監視し、未計測や未対応を成功扱いしない。
9. 計測はdebug/capture時だけ有効で、通常プレイの起動、RAF、canonical state、ネットワーク送信へ負荷やデータを追加しない。

## リポジトリ上の根拠と調査基準値

### 既存境界

- `ui/bootstrap.ts` の `installCoreDI()` は通常Pixiを含む全起動で `preloadSpecialStoneVisuals()` を呼ぶ。
- `ui/pixi/board-backend.ts` は、現在フレームの特殊石を抽出する `collectSpecialStones()`、再生イベントを抽出する `collectPlaybackSpecialStones()`、アニメーション前の `preparePlaybackTextures()`、現在フレームの `prepareResources()` を既に所有する。
- `ui/pixi/hint-view.ts` は `cell.interactionSignature` の変化時にGraphics、方向表示、cursor、hitAreaをまとめて再構築する。`ui/pixi/board-scene.ts` は現在 `updatedHintViews` を一つの診断値として公開するため、重い再描画と軽い入力属性同期を区別できない。
- `ui/pixi/board-input.ts` は親interaction layerで入力イベントと座標hit testを所有し、ゲーム入力可否とは独立した `isInputLocked` を確認する。
- `scripts/build-vite-entry.ts` は `index.classic.html` の全stylesheetをVite起動用metaへ変換するため、`styles-board-dom-compat.css` も通常Pixiで読み込まれる。
- `ui/assets/feature-stylesheet-loader.ts` はfeature stylesheetの一度だけの非同期ロード、失敗時の削除、再試行を既に所有する。
- 実装前の `ui/handlers/rules-help.ts` は大きなヘルプ内容を初回表示時に生成していた一方、`index.classic.html` にはHELP inner DOMと最初のガイド画像・早見表画像が残っていた。Step 2.2で画像取得をDOM非依存cacheへ分離し、Step 4.4でinner DOMと画像要素自体もsurface初回準備へ移す。
- `ui/status-display.ts` と `ui/hand-skin/runtime.ts` はroot論理パスをランタイムで再設定し、ViteがHTMLへ書いたハッシュ付きURLとの同一性を判定できない。
- `ui/board-visual/performance-harness.ts`、`scripts/perf/measure-opponent-action-frame-stall.ts`、`scripts/browser-boot-performance-check.ts`、`scripts/capture-pixijs-playfield-performance.ts` は、RAF、Long Task、resource、Pixi診断、GPU環境、artifact digestを既に収集する。
- `docs/architecture-contracts.md` §4 は、debug性能記録を通常プレイから分離し、盤面内容、手札、seat token、operationId、canonical authorityを性能レポートへ含めることを禁止する。
- `docs/refactor-baselines/artifact-retention-policy.md` は、生の性能出力を `artifacts/` の破棄可能データとし、永続する判定入力を `test/`、人間向け結論を `docs/` に置く。

### 2026-07-23の調査基準値

この値は設計判断のための同一PC上の調査値であり、将来の普遍的な閾値ではない。実装開始時にmonitorの正規スキーマで再取得する。

| 項目 | 調査値 |
| --- | ---: |
| Vite main JS | 3,979,079 bytes、gzip約1,009KB |
| 通常起動のimage response body | 約15.14MB |
| 特殊石先読み | 69件、約1,789,000 bytes |
| 特殊石先読み無効時の削減 | 約1,727,103 bytes |
| CPU 6倍スロットル時のcanvas ready中央値 | 5,090.6ms → 4,543.6ms |
| Vite/root重複画像 | hero + hand、約331,225 bytes |
| 初期非表示ヘルプ画像 | 約325KB |
| DOM互換盤面CSS | 73,776 bytes、通常Pixiで使用率0% |
| 初期CSS全体 | 約1.57MB、代表画面で約28.1%使用 |
| 初期DOM | 約1,078要素、非表示UI系約552要素 |
| opponent-action quick | 25/25有効、アプリ起因Long Task 0、RAF p95/max約16.8ms |
| 通常着手のscene apply | 4回、`sceneUpdatedViewCount=256` |

## スコープ、前提、制約

### スコープ

- 上記7最適化と、非表示UIを5つの縦割り単位へ分けた実装
- cold start、warm start、通常Pixi、明示DOM、Pixi初期失敗、回復不能context lossの監視
- desktop自動計測、CI構造ゲート、任意の物理Android/iPhone診断
- classic/Vite、root/worker mirror、PNG/WebP fallbackの配信検証
- player-visible behavior、アクセシビリティ、first-open UXの回帰確認

### 前提

- Pixiが通常backend、DOMは互換fallbackである。
- root sourceが正本で、`index.html`、`index.vite.html`、`public/module-registry.js`、`worker-public/` は既存生成経路から更新する。
- ゲームルール、カード効果、盤面演出内容は変更しない。遅延UIの初回準備だけはプレイヤーから見える待機状態になり得るため、実装前に `01-rulebook.md` へ「既存ボタンの操作を保ったまま準備し、完了後に同じ操作を継続し、失敗時は再試行できる」共通契約を追記する。カード、ターン、盤面演出の `正本/` は変更しない。
- 物理端末計測は `docs/perf/pixijs-playfield-mobile/README.md` の現行方針どおり任意診断であり、通常のrelease gateへ昇格させない。ただし「実機でも改善した」と報告するには物理証拠を必須とする。

### 制約

- 計測のために第2の盤面writer、canvas、Pixi Application、ticker、settlement経路を追加しない。
- 診断はcanonical state、手札、カード、snapshot、操作内容を記録しない。
- shared CI runnerの絶対時間を厳しいblocking thresholdにしない。
- Long Task APIなどブラウザ非対応の指標は `unsupported` と記録し、`pass`へ変換しない。
- 性能を通す目的で演出を短縮、イベントを間引き、テストを弱体化しない。

## 「完全監視」の定義

対象ごとに次の5面すべてが観測されて初めて「監視済み」とする。

1. **存在契約**: 不要なresource、DOM、再描画が存在しない。
2. **時相契約**: 必要なresource、DOM、CSSが正しいphaseより前後に配置される。
3. **UX契約**: 初回表示、入力、フォーカス、演出、fallbackが従来どおり成立する。
4. **性能契約**: RAF、Long Task、起動ready、転送量、更新数に重大な退行がない。
5. **配信契約**: Vite/classic/root/mirror、形式fallback、生成物が一致する。

各checkの結果は `pass | fail | unsupported | not-applicable` のいずれかとする。blocking checkはすべて `pass` でなければならない。任意物理診断だけは `not-applicable` を許可するが、その場合レポートは `deviceValidated=false` と明示する。

## 選択肢と採用案

### 選択肢A: 既存スクリプトへ個別assertを追加する

変更量は小さいが、同じresourceを異なる名前・phase・集計方法で扱い、全対象の完了状況を一つのレポートで判定できない。新しい最適化のたびに判定が分散するため不採用。

### 選択肢B: 通常プレイへ常時テレメトリを組み込む

実端末の長期データを得られるが、収集backend、同意、プライバシー、通信、電池、RAF負荷を新たに持ち込む。ゲーム状態を誤って送る危険もあり、今回の「UXを損なわない」目的に反するため不採用。

### 選択肢C: 既存debug harness上にmanifest駆動のcapture/validatorを置く

既存のPlaywright、performance timeline、Pixi diagnostics、artifact digest、GPU確認を再利用できる。通常プレイには何も設置せず、構造ゲートと環境依存性能ゲートを分離できるため採用する。

## 採用アーキテクチャ

### 1. 三層の監視

#### 層A: 決定的な構造・契約ゲート

Jestとビルド後のbrowser smokeで毎回判定する。環境速度に依存しない次をblockingにする。

- 不要resourceの有無とphase
- logical assetの重複
- lock-only applyの更新数
- stylesheet/DOMのmount回数と順序
- WebP/PNGのmanifest、画素一致、fallback
- 単一writer、単一backend、入力・ARIA・フォーカス契約
- root/生成物/mirrorの一致

#### 層B: hardware desktop性能ゲート

既存の `browser-performance-environment.ts` でhardware WebGLを確認したChromiumから、fresh process、cold cache、固定viewport、固定capture orderで取得する。起動ready、resource bytes、RAF、Long Task、first-open latencyを測る。production証拠は `worker-public/` を唯一のimmutable artifact rootとし、`worker:prepare` とmirror check後のmanifest全体をartifact digestへ含める。

Phase 0ではbaseline reportだけでなく、そのdigestと一致するbrowser artifact archiveを破棄可能な `artifacts/` に保存する。最終standardは現在candidateだけを連続測定せず、保存baseline artifactとcandidate artifactを同一セッション・同一hardware条件でfresh browser processごとに交互順序で測る。これにより長期実装中の温度、電源、OS/browser更新driftを比較へ混入させない。

#### 層C: 物理端末診断

既存の物理Android Chrome / iPhone Safari手順へ、起動resourceとlazy featureの補助レポートを追加できるようにする。これは任意で、未実施をdesktop passへ偽装しない。

### 2. 共通monitor contract

`scripts/perf/ux-optimization-monitor-contract.ts` を唯一のschema・scenario・gate ID正本とする。少なくとも次を定義する。

- schema version: `ux_preserving_runtime_optimization_report.v1`
- scenario ID、対象lane/backend、blocking種別
- scenarioごとの必須lane/backend matrix。help、fallback、lazy feature、network restore、asset fallbackはVite/classic両laneを要求する
- static resourceの論理分類規則
- phase名と順序
- forbidden report key
- percentile方式: nearest-rank
- gate verdictとoverall verdict
- quick / standard profileのsample数

captureは判定を決めず、生値とcapabilityを記録する。`scripts/perf/validate-ux-optimization-monitor.ts` が生値から集計を再計算し、policyと照合する。capture出力に書かれた自己申告の `pass` は信頼しない。

overall verdictは未完optimizationまたは未capture scenarioが一つでもあれば常にfailとする。一方、各実装単位は `--target <optimization-id>` を使い、target自身がpendingでないこと、targetに必要なscenario/checkがpassすること、残りの既知pendingだけが未完であることをfocused verdictとして判定できるようにする。focused passをoverall passへ読み替えない。

### 3. レポートidentity

レポートは次を必須とする。

- candidate commit、dirty state
- browser artifact SHA-256
- fixture digest、scenario digest
- lane、backend、cache profile
- Chromium/OS/viewport/DPR
- hardware acceleration、GL renderer/vendor
- capture order、sample count
- visibility/focus change、page/console/resource error
- capability support

dirty checkoutでのquick開発計測は許可するが `candidateEligible=false` とする。標準合格証拠はclean exact commitと一致するartifact digestを必須とする。

baselineとcandidateの比較では、各レポートのcommitとartifact digestがそれぞれ自身の配信物に一致することを先に検証する。最適化によりartifact自体は変わるため、baselineとcandidateのartifact digest一致は要求しない。比較互換性として一致を要求するのは、fixture/scenario digest、browser/OS/GPU、viewport/DPR、profile、capture policyである。

起動ready契約はlane別の既存正本に従う。Viteは `data-browser-boot-state="ready"` と `window.__uiInitialized === true` の両方、classicは同属性を設定しないため `window.__uiInitialized === true` を必須条件とする。classicへVite専用属性を強制してtimeoutを合格扱いに変えない。

### 4. 共通phase

全resourceとDOM操作を次のphaseへ帰属させる。

1. `navigation`
2. `styles-ready`
3. `backend-selected`
4. `first-frame-preparing`
5. `first-frame-committed`
6. `board-idle`
7. `idle-prefetch`
8. `feature-opening:<feature>`
9. `feature-ready:<feature>`
10. `playback:<scenario>`
11. `fallback-transition`

phase timestampはcapture page側の単一 `performance.timeOrigin` を用いる。Node時刻との混在で判定しない。

### 5. resource観測モデル

resource entryは完全URLではなく、query/hashを除いた同一origin相対パス、logical asset ID、initiator type、start/end phase、transfer/encoded/decoded size、cache evidence、content typeだけを保持する。

logical asset IDは、HTMLの `data-card-reversi-logical-src`、optimized asset manifest、特殊石visual registry、feature stylesheet registryから解決する。同一logical IDに複数のnetwork response bodyがある場合を重複と判定する。memory/disk cache hitは追加body転送ではないため、resource timingのsizeとrequest interceptionのresponse evidenceを合わせて区別する。

### 6. シナリオ

| ID | 経路 | 主な監視対象 |
| --- | --- | --- |
| `boot.pixi.cold` | Vite/Pixi/cold cache | 特殊石、重複画像、ヘルプ、DOM CSS、初期DOM/CSS、ready |
| `boot.pixi.warm` | Vite/Pixi/warm cache | 再デコード、重複代入、ready |
| `boot.classic-pixi.cold` | classic/Pixi/cold cache | 同じresource契約とclassic配信互換 |
| `board.lock-toggle` | Pixi | lock-only hint更新、入力clear、RAF |
| `board.first-special` | Pixi | 初回特殊石準備、欠落、演出順 |
| `fallback.explicit-dom` | 明示DOM | CSS先行、一度だけmount、Pixi非併存 |
| `fallback.pixi-init-failure` | 初期失敗 | CSS/特殊石準備、reload-required |
| `fallback.context-loss` | 回復不能loss | 入力clear、CSS、単一writer、最終盤面 |
| `help.before-idle` | 即時ヘルプ | first-open画像、予約寸法、focus、CLS |
| `help.after-idle` | idle後ヘルプ | idle prefetch、追加転送なし、即時表示 |
| `feature.result` / `.classic` | 終局表示 | 両laneのCSS/DOM一度だけ、表示・focus、再表示 |
| `feature.profile` / `.classic` | プロフィール | 両laneで同上 |
| `feature.rules-help` / `.classic` | ヘルプ | 両laneで同上、検索・タブ・画像 |
| `feature.deck-builder` / `.classic` | デッキ編成 | 両laneで同上、スクロール・カード一覧 |
| `feature.network` / `.classic` | mode選択 | 両laneで選択前未評価、選択後ready、退出・再表示 |
| `feature.network-restore` | 保存session自動復帰 | 保存session検出後・復帰試行前のsurface ready、状態再投影、snapshot/reconnect |
| `asset.webp-fallback` | WebP失敗注入 | PNG fallback、logical重複なし、可視一致 |
| `playback.opponent-actions` | 既存5シナリオ | RAF、Long Task、Pixi更新数、ticker idle |

contractはscenario IDとcapture laneを別軸で扱い、必須capture keyを `scenarioId + lane + backend` で一意にする。`help.before-idle`、`help.after-idle`、3つのfallback、5つのlazy feature、`feature.network-restore`、`asset.webp-fallback` はVite/classic両laneが必須である。片laneの成功を両laneの成功へ代用しない。

## 対象別の監視契約

### A. 特殊石の需要駆動ロード

- `first-frame-committed` より前にPixi board resource経路（`fetch` / `img` / `other` initiator）で取得した特殊石は、初期frameの `collectSpecialStones()` が列挙したlogical IDの部分集合でなければならない。プロフィールavatar等のDOM/CSS-owned surfaceが同じ画像directoryを使うため、`css` initiatorはboard preload判定から除外し、各lazy featureのresource契約で別に監視する。
- `board.first-special` は、イベントの最初の可視frameより前に対象textureがreadyであること、resource failureがないこと、settlement順が変わらないことを確認する。
- `special-stone-demand-loading` の完了判定には `fallback.context-loss` のVite/classic両captureも含める。回復不能lossだけ特殊石準備の回帰を見逃す構成は、3 fallback経路を同格に扱うStep 1.1の完了条件と矛盾するためである。
- 明示DOMとfallbackは、DOM backend mount前に必要な特殊石画像のload/decode結果をawaitする。既存の同期 `preloadStoneVisualEffectKeys()` を完了通知として扱わず、Document単位Promise cache、成功/失敗結果、同時要求の合流、失敗後retryを持つDOM compatibility preparation APIを新設する。
- normal Pixiで69件一括取得する状態は件数閾値ではなく「必要集合外resourceあり」としてfailにする。初期盤面のランダム性で誤判定しない。

### B. lock-only盤面更新

- lock前後でmodel/layout/appearance/theme、legal/selectable/preview/directionは同一のfixtureを使う。
- hint viewの診断を `hintPaintCount` と `hintInputSyncCount` に分離し、lock-only applyの `hintPaintCount`、`updatedCellViews`、`updatedStoneViews` は0をblocking条件とする。cursor等の軽い同期が必要な段階では `hintInputSyncCount` を別記録し、Graphics再描画と混同しない。
- 親入力ゲートは第1段階の再計測でlock transitionの同期負荷が残った場合だけ導入する。「残る」は、hardware captureでlockまたはunlock apply durationが観測RAF中央値の25%以上、またはlock transitionに帰属するLong Task/50ms RAF stallが1件以上、と定義する。これ未満なら64セルの軽量入力属性同期を残し、親gateは追加しない。導入した場合、transition countは1、press/hover/long-pressは0へ収束する。
- pointer、touch long-press、keyboard、semantic layerの入力がロック中にゲームcommandへ到達しない。
- unlock後の最初の有効入力が一度だけ届く。
- opponent-action計測はfirst-use CPU/playback初期化を1回ウォームアップした後、fresh canonical fixtureから次の同一ターンを測る。navigation・asset decode・CPU初期化を対局中ターンへ誤帰属させず、既存の専用opponent-action harnessと測定境界を一致させる。

### C. logical画像と二重取得

- `hero` とdefault handを含む対象画像は、HTMLのハッシュURLとroot論理パスを同一logical IDとして扱う。
- cold bootでlogical IDごとのresponse body取得は1回以下。
- 同一表示更新で新しい `Image`、`src` mutation、decodeを増やさない。
- CPU肖像・hand skinを別画像へ変更して戻した場合、最初にcaptureした配信URLを再利用し、alt/class/scale/labelは毎回正しく更新する。
- classic laneはroot URLのまま同じ契約を満たす。

### D. ヘルプ画像

- `first-frame-committed` 前にhelp image requestを開始しない。
- `idle-prefetch` は `board-idle` 後だけ開始できる。
- idle待機はinit chainからawaitしないbackground taskとし、イベントlistener登録、保存session復帰、`uiInitialized` を遅らせない。taskの拒否は内部で診断化し、unhandled rejectionにしない。
- help imageのpreload cacheはDOM要素から独立したlogical URL単位とし、後からlazy生成された画像要素も同じin-flight/ready結果を利用する。
- 配信側のHTTP cache設定に依存して同じlogical URLをdetached `Image`と表示`img`へ順に指定するとbodyが再転送され得るため、同一origin画像は1回の`fetch`で得たBlob URLをDocument単位cacheへ保持し、そのBlob URLでdecodeと表示を共有する。cacheはDOM要素を所有せず、失敗時だけ元logical URLへfallbackする。
- 即時openでは画像枠のwidth/heightとaspect-ratioを先に確定してCLSを発生させず、初期画像に`src`がない間だけ画像枠へ`aria-busy`と非テキストのスピナーを付与する。既存実装には専用のローディング表現がないため、この最小表示を追加する。
- idle後openでは追加body転送なしで画像が表示される。
- slide切替の「現画像を保持して次画像をpreloadする」契約を維持する。

### E. DOM互換盤面CSS

- `boot.pixi.*` と `boot.classic-pixi.cold` で `styles-board-dom-compat.css` のrequestと評価は0。
- 3つのDOM経路ではCSSがbackend mount前に一度だけ成功し、元のstylesheet順序スロットへ入る。
- CSS失敗注入時は未装飾DOM盤面をmountせず、既存のreload-required/errorへ伝播する。
- Pixi canvasとcompatibility cellが同時に入力可能な状態を1frameも作らない。

### F. 選別式lossless WebP

optimized asset manifestは各候補について、PNG source hash、WebP hash、寸法、alpha、bytes、削減率、可視一致結果、採用状態を持つ。

採用条件は次をすべて満たすこと。

- alphaが全画素一致する。
- alpha > 0の全画素でRGBが一致する。
- encoded bodyがsource PNGより少なくとも10%小さい。
- desktop標準計測のdecode中央値がPNG比 `+2ms` と `+10%` の大きい方を超えて悪化しない。または当該画像が初期/first-openクリティカル経路外とmanifestで明示される。
- WebP request失敗、decode失敗、MIME不一致でPNGへ一度だけfallbackする。
- fallback後のlogical asset body取得はWebP失敗分とPNG成功分だけで、無限再試行しない。

decode時間は環境依存なのでCIのblocking対象にしない。画素一致、容量、manifest、fallbackはblockingにする。採用判定の最終根拠にはhardware desktop計測を必須とする。

default board frame候補は `ui/board-skin/runtime.ts` がCSS custom propertyへ適用するDOM/CSS資産であり、Pixiのappearance resource配列にはframe画像自体を含めない。したがってframeのWebP選択・fallbackはBoardSkinRuntime/display lease経路に限定し、`ui/pixi/appearance-resolver.ts` に存在しないframe texture roleを追加しない。Pixiは従来どおりframe layout descriptorだけを共有する。

admittedされた初期frameでは、startup CSSからsource PNGを直接参照しない。CSSがPNGを先行取得した後にBoardSkinRuntimeがWebPへ切り替えると、成功時にも同一logical assetを2 body取得するためである。`styles-layout.css` の初期値は画像なしとし、`UIBootstrap.prepareInitialBoardFrameSkin()` が保存済みframe選択を読み、`ui/board-skin/runtime.ts` のgeneration管理とdisplay leaseを通して次の一経路だけを適用する。

- admitted mappingあり: common codecがWebP support、HTTP、MIME、decodeを確認し、成功時は一度取得したWebP Blob URLだけをCSS custom propertyへ適用する。
- WebP非対応: WebP bodyを要求せずsource PNGを一度だけ適用する。
- WebP request/decode/MIME失敗: 失敗したWebP一回とsource PNG一回だけを許可し、同じDocument内の再試行を合流する。
- mappingなし、rejected、custom frame: 従来のsource path/object URLを同期適用し、WebP経路へ入れない。
- 非同期解決中に別frameが選ばれた場合: generation tokenが古い完了を破棄し、現在のframeとdisplay leaseを上書きしない。

初期frame準備はgame system初期化と並行開始し、入力listener、保存session復帰、`__uiInitialized` より前に完了を待つ。これにより盤面準備時間を直列追加せず、app-ready時点ではframe画像とlayoutが確定する。CSS `image-set()` は先頭候補のnetwork失敗時にChromiumが次候補を取得しないことを実機確認したため、決定的なPNG fallbackには使用しない。

### G. 非表示UIの遅延生成

featureは `result → profile → rules-help → deck-builder → network` の順に分割する。result overlay DOMは `ui/result-overlay.ts` が既に表示時生成するため、その契約を維持してCSSだけを遅延する。結果の勝敗・操作を必ず読める最小critical CSSはstartup側へ残し、full CSS失敗時も未装飾または非表示の結果にしない。残る4 featureは、初期HTMLにopen control、外枠、stable ID、ARIA参照、読み込み中表示に必要な最小shellだけを残す。

各featureの共通契約。ただしresultのinner DOM count/保持は既存の表示時生成・close時破棄を正とし、CSSと操作だけを同じmonitorへ参加させる。

- 初期状態でinner DOM count 0、専用stylesheet request 0。
- result以外の初回openは `ensureFeatureStylesheet()` と `ensureFeatureDom()` を同じcontrollerから開始し、両方のready後にinteractive stateへ移る。resultは `showResult()` の既存2秒待機開始時にfull CSSを先行準備し、同期API `showResultOverlay()` のDOM生成をCSS Promiseで遅らせない。
- stylesheetはselector依存と同一property競合を先に監査する。元CSS単位のfragment/slotでcomputed styleが一致する場合だけその境界を採用し、複数sourceから抜いたruleを一つの末尾stylesheetへ集約しない。
- resultのfull stylesheetはclassicの元順序 `styles-layout-info.css → styles-layout-result.css → styles-layout-characters.css` を維持する。Vite生成HTMLではfeature slotと後付けのeager link群が離れるため、slot位置だけでなく `data-card-reversi-feature-style-before="styles-layout-characters.css"` の固定anchorを解決し、両laneで同じcascade順へ挿入する。
- 元ファイル内でfeature/shared ruleが交互にあり単純抽出でcascadeが変わる場合は、抽出境界ごとの複数fragment/slotへ分割するか、その競合ruleをstartup側へ残す。loaderはfeature単位で必要fragmentを一つのPromiseへ合流し、全fragment ready後だけsurface readyにする。代表状態・viewport・focus/disabled/open stateの主要computed property baseline一致をblockingにする。
- rules-helpは `styles-layout-info.css`、`styles-cards.css`、`styles-responsive.css` ごとにfragment/slotを分ける。`styles-base.css` のHELP selectorはすべて他surfaceと共有するmixed ruleであり、startupから抽出しない。
- `styles-layout-info.css` のmixed selectorはstartupに残すだけでは、後段のHELP専用ruleをfragmentへ移した時に元の上書き順を再現できない。この場合は共有ruleを削除せず、HELP selectorだけのprojectionをlayout-info fragment内の元の相対境界にも置く。Vite/classic、desktop/mobileの代表computed styleが一致する場合だけ重複を許可する。
- `.premium-btn` はresult固有に見えるがnetwork再戦申請dialogも使用する共有ruleである。result full CSSへ残さずstartup側の共有critical ruleとして所有し、result未表示のnetwork操作を未装飾にしない。result内では局所custom property、network側では同じfallback値を使う。
- result以外のinner DOMは一度だけcloneし、close時に破棄しない。
- bootstrapの初期DOM取得はopen controlとshellだけを保持する。feature controllerはsurface ready後に自身のrootからinner refsを一度取得してlistenerを配線し、boot時のnull参照を永続的なUI refsとして保持しない。
- profile、deck-builder、networkはinner refsの配線後、DOM外で保持していた保存済みUI model、選択状態、network clientの接続状態を再投影してからinteractive stateへ移る。
- network surfaceは明示的なmode選択だけでなく、`restoreStoredNetworkSessionOnBoot()` が保存sessionを検出した時も復帰試行より先に準備する。既存public APIにはsession有無を秘密情報なしで読む方法がないため、`NetworkMatchClient.hasRestorableStoredSession(): boolean` を追加し、内部 `readStoredSession()` の内容をUIへ公開しない。判定後に別tab等でsessionが消えた場合の `NO_STORED_SESSION` は正常なno-opとする。保存sessionなしではsurfaceを生成せず、surface準備失敗時は復帰を開始せず保存sessionを再試行用に残す。復帰試行後の成功/失敗statusはready済みviewへ投影する。
- 同時open要求は同じPromiseへ合流し、二重listener、二重DOM、二重stylesheetを作らない。
- CSSとDOMは同じsurface attemptとして準備し、attempt contextは `AbortSignal` とLIFO cleanup登録を提供する。stylesheetが `{ ok: false }`、DOM factory、またはready hookのいずれで失敗してもsignalをabortし、途中DOM/listenerをcleanupしたうえで当該feature stylesheet linkとDocument cacheを破棄する。次回操作は新しいattemptと新しいlinkで再試行し、失敗したPromiseや成功形の途中DOMを再利用しない。
- result以外のload失敗は閉じられるエラーshellを表示し、再openで再試行できる。resultは最小critical CSSで終局内容と主要操作を必ず表示する。空、未装飾、操作不能の成功画面を作らない。
- open→close→openでフォーカス返却、ESC、backdrop、tab order、scroll位置、保存済みUI stateを維持する。
- first-open中に50ms以上のアプリ起因Long Taskを作らず、result以外はdesktop local配信のinteractive ready p95を250ms以内とする。resultは意図された2秒表示待機を変えず、stylesheet preparation自体のp95を250ms以内とする。CIでは時間をadvisory、構造と操作をblockingにする。

## 判定ポリシー

### Blocking

- schema、identity、digest、visibility/focusの妥当性
- resource/DOM/update countの決定的契約
- 通常scenarioのpage/console/resource error 0。明示的な失敗注入scenarioだけは、scenario contractと一致する1件のexpected faultを許可し、それ以外のerrorを0とする
- 単一writer/backend、入力、演出順、fallback
- asset可視一致、manifest、PNG fallback
- root/生成物/mirror driftなし
- `playback.opponent-actions` でアプリ起因Long Task 0、RAF stall 50ms 0、ticker idle

### Hardware desktop比較

同じcandidateのquick captureは3 fresh process、standardは5 fresh processを交互順序で取得する。起動時間は中央値、RAFはraw intervalからnearest-rank p95/max、resourceはencoded body合計を用いる。

- candidateのboard ready中央値は、同一環境baselineより `100ms` かつ `5%` を両方超えて悪化してはならない。
- boot encoded bodyは意図した削減対象を除いて増加理由をレポートする。全体がbaselineより1%以上増えた場合はblocking reviewとする。
- RAF p95は観測nominal intervalの1.15倍以内、50ms stall 0。
- API対応時のアプリ起因Long Task 0。非対応時はraw RAFを必須にする。
- profile/rules-help/deck-builder/networkのfirst-open p95とresult stylesheet preparation p95は250ms以内、CLS 0.01以下。

baselineとcandidateのfixture/scenario digest、browser/OS/GPU、viewport/DPR、profile、capture policyが一致しない比較は `invalid` とする。共有CI runnerの時間はこの比較ゲートに使わない。

## 通常プレイからの分離とデータ安全

- monitor harnessは既存どおり `debug=1&boardPerf=1` またはcapture専用queryでだけロードするoptional diagnostics payloadに置く。
- 通常起動でdiagnostics payload、observer、追加RAF、debug globalが存在しないこと自体を構造ゲートにする。
- report key denylistは既存opponent-action計測の思想を継承し、`board`, `hand`, `cardState`, `gameState`, `seatToken`, `operationId`, `snapshot`, `action` を再帰的に拒否する。
- URLは同一origin static pathだけを許可し、query/hash、room ID、tokenを保存しない。
- ネットワークfeature監視はローカルUI選択とshell生成までとし、実ルーム、認証、チャット内容をレポートしない。
- 生レポート、trace、screenshotは `artifacts/` または一時ディレクトリへ出し、コミットしない。永続するのはschema/policy fixtureと人間向け結論だけとする。

## エラー、互換性、並行処理

- resource timingのsizeが0でも即cache hitと断定しない。request/response interceptionと組み合わせ、不明なら `unsupported` にする。
- `PerformanceObserver` 非対応はLong Taskだけをunsupportedにし、RAF raw intervalと構造ゲートを継続する。
- idle prefetchはキャンセル可能とし、ユーザーopenが先に来た場合は同じin-flight Promiseを再利用する。
- stylesheet/DOM/imageの同時要求はDocument単位またはelement単位のPromise/世代管理へ合流させる。
- context loss中のmonitorはwriter ownershipを変更せず、公開diagnosticsとDOM状態を読むだけにする。
- classic/ViteでURL形が異なってもlogical IDを共通にし、配信URLの文字列一致を要求しない。
- WebPを未サポートのbrowserはPNG経路を正常とし、WebP decode比較はnot-applicable、表示と重複契約はpassを要求する。

## 生成物とcross-runtime

- 遅延UIの初回準備はplayer-visible timingなので、実装より先に `01-rulebook.md` のUI仕様を更新する。新しいゲームルール、カード仕様、盤面演出仕様は追加しない。
- root TypeScript、`index.classic.html`、root CSS、asset source/manifest generatorを先に変更する。
- browser-visible root変更後は `npm run build:browser`、Vite chunk/entry変更を含む単位は `npm run build:vite` を実行する。
- browser-visible root source、HTML、CSS、asset、Vite/classic registry入力を変更するすべての単位は `npm run worker:prepare` と `npm run check:worker-mirror` を実行する。static assetだけに限定しない。
- monitor reportへgame/headless/Workerのcanonical stateを追加しない。今回の最適化はpresentation/deliveryに閉じ、headless rulesやnetwork authorityを変更しない。

## 実装・移行方針

最適化と監視を別々に後付けせず、各最適化単位で次を一緒に完成させる。

1. 現行baselineを正規monitor形式で取得する。
2. 対象の決定的monitor checkを先に追加し、現行の未最適状態を正しく検出する。
3. 最適化を実装する。
4. focused test、browser scenario、candidate captureを通す。
5. 当該checkをoverall blocking suiteへ参加させる。
6. task-owned変更と必要な生成物だけをコミットする。

全checkが有効になるまで、CI全体を偽のgreenにする `skip` や既定passは置かない。開発中の未完項目は `pending-optimization` としてoverall readinessをfailにし、最終統合時に0件とする。

## 検証戦略

### Unit/contract

- bootstrap特殊石preload routing
- Pixi current-frame/playback texture準備
- hint paint/input signatureとlock transition
- logical image resolver、世代、Vite/classic URL
- help image idle/open競合
- feature stylesheet/DOM一度だけのloader
- optimized image manifest、pixel equality、fallback
- monitor schema、denylist、phase、集計、threshold

### Browser

- `match:pixijs-board-playback-check`
- `match:pixi-runtime-fallback-check`
- `match:cross-platform-smoke:vite`
- `match:optional-feature-smoke:vite`
- `match:asset-delivery-smoke:vite`
- 新しいUX optimization quick/standard capture

### Build/mirror

- `npm run typecheck`
- `npm run build:ts`
- `npm run build:browser`
- `npm run build:vite`
- `npm run worker:prepare`
- `npm run checkall`

### 実機

- Android ChromeとiPhone Safariの任意診断
- cold boot、first special、help first-open、通常対局のRAF
- 端末を冷却し、電源・refresh・viewport条件を固定
- desktop emulationを物理証拠として扱わない

## リスクと緩和

- **monitor自身が性能を変える**: debug optional payloadへ隔離し、通常起動で不在を検査する。
- **resource件数の固定閾値が初期盤面で揺れる**: 件数ではなくframe/eventから導いた必要logical集合と比較する。
- **CI時間の揺らぎでfalse fail**: CIは決定的契約をblocking、厳しい時間比較は同一hardware desktopに限定する。
- **CSS分割でcascadeが変わる**: 固定slotを使い、順序とcomputed style/visualを監視する。
- **lazy UIでアクセシビリティが壊れる**: shellのstable IDを維持し、focus/ESC/backdrop/ARIAを各feature scenarioで操作する。
- **boot時のnull要素参照がlazy生成後も残る**: bootstrapはstable shell/controlだけを配線し、inner refsは各feature controllerがsurface ready後に再取得する。
- **WebP容量削減がdecode悪化を隠す**: 容量とdecodeを別gateにし、critical assetは両方の合格を必須にする。
- **fallbackを通常Pixiだけの監視が見逃す**: 明示DOM、初期失敗、context lossを独立scenarioにする。
- **レポートに機密やcanonical stateが混入する**: allowlist static resourceと再帰denylistをvalidatorでfail closedにする。
- **大規模一括変更で原因が追えない**: 特殊石、lock、画像、CSS、WebP、5 featureの順に独立commit/rollback境界を置く。

## 完了条件

- 7最適化と5つのlazy feature単位が設計どおり実装されている。
- 全scenarioが正規schemaでcaptureされ、blocking checkがすべてpassし、`pending-optimization` が0である。
- 通常Pixiで必要集合外の特殊石、compat CSS、初期help画像、lazy feature inner DOM/CSSを取得・生成しない。
- lock-only applyのcell/stone更新とhint Graphics再描画が0で、必要な軽量入力同期は別計数され、入力状態が安全にclear/recoverする。
- logical image body重複が0で、classic/Vite両方の画像切替が成立する。
- 採用WebPが可視一致、容量、desktop decode、PNG fallbackを満たす。
- explicit DOM、Pixi初期失敗、context lossで単一writerとstyled fallbackが成立する。
- opponent-action standardでLong Task 0、50ms RAF stall 0、ticker idleを維持する。
- 通常プレイにdiagnostics payload、追加observer、追加RAF、debug global、telemetry送信が存在しない。
- root、browser生成物、worker mirrorが同期し、必要なfocused/browser/build checksが成功する。
- raw outputは `artifacts/` に留まり、永続policy/fixtureと人間向け結論だけが正しい場所へ置かれる。

## Self-review

- 初案では「全指標をCIの時間閾値でblocking」にしていたが、共有runnerの揺らぎで信頼できないため、決定的な構造ゲートと同一hardware比較を分離した。
- 特殊石を固定件数で判定すると初期盤面の特殊石で誤検知するため、frame/eventが要求したlogical集合との差分判定へ修正した。
- ヘルプのidle prefetchは「初期request 0」と矛盾し得るため、`first-frame-committed` より前を禁止し、`board-idle` 後の取得を別phaseとして許可した。
- lossless WebPを一律採用する案は、調査で大画像2件のdecode悪化が出たため撤回し、可視一致・容量・decode・fallbackの個別審査にした。
- lazy DOMをcloseごとに破棄する案は再表示コストとfocus/state消失を招くため、一度だけ生成して保持する設計にした。
- 初回準備を完全に不可視な内部事情として扱う案は、低速端末で待機状態がプレイヤーに見える可能性を隠すため撤回した。既存のガチャ/SKIN初回準備契約と同じ方向で `01-rulebook.md` を先に更新する。
- performance harnessを通常bundleへ戻す案は既存のoptional diagnostics契約を壊すため、capture専用payloadと外部Playwright観測を採用した。
- lock-only変更の全cell入力同期まで直ちにゼロへする案は、pointerleaveや長押しclearを壊す可能性があるため撤回した。重いhint paintと軽い入力属性同期を別計数し、親入力ゲートは再計測で必要性が確認された場合だけ進める。
- lock stage Bの「有意な同期負荷」が定量化されていなかったため、観測RAF中央値の25%または帰属可能なLong Task/50ms stallを導入条件として固定した。stage A計測は約2.1–2.2ms、観測中央値16.7msの約13%で、Graphics paint 0かつ既存opponent-action 25サンプルもLong Task/stall 0だったため、親gateを追加しない。
- 統合monitorのopponent-actionが未ウォームの初回CPU処理を測り、専用harnessの5シナリオ×5サンプルすべてLong Task/stall 0という結果と矛盾したため、専用harnessと同じく1回のfirst-use warmup後にfresh fixtureを再生成して測る境界へ修正した。
- 初期DOM参照をそのまま各featureへ渡す案では、lazy生成後もnull参照が残って操作不能になるため、stable shell/controlだけをbootで取得し、inner refsをsurface ready後にfeature controllerが取得する所有境界を追加した。
- help画像preloadを既存img要素に結び付ける案では、後のrules-help DOM遅延化と矛盾するため、logical URL単位のDOM非依存cacheへ修正した。
- result full CSS失敗時にoverlayを抑止する案は終局操作を失わせるため、最小critical CSSをstartupへ残し、結果表示を必ず成立させる例外を追加した。
- baselineとcandidateでartifact digest自体を一致させる読み方を排除し、各digestと各commitの自己整合を検証したうえで、fixtureと実行環境を比較互換性キーにすることを明記した。
- helpの `waitForIdle()` をinit chainでawaitすると操作listenerと保存session復帰を止めるため、明示controllerを使う非blocking background taskへ限定した。
- network UIにはmode button以外に保存session自動復帰というboot経路があるため、保存session検出、surface ready、復帰試行、状態投影の順序を独立scenarioへ追加した。
- overall pendingと各単位のquick passが両立しなかったため、overall failを維持したまま指定targetだけを完了判定するfocused verdictを追加した。
- production captureの既存正本が `worker-public/` 全manifestであることを確認し、全browser-visible単位のprepare/mirror、baseline artifact archive、最終の同一セッション交互比較へ修正した。
- `readStoredSession()` はpublic APIでなくtoken等を含み得るため、内容を公開しないboolean `hasRestorableStoredSession()` を新設する境界へ修正した。
- Viteだけのlazy UI確認ではclassic regressionsを見逃すため、scenario IDとは別の必須lane matrixを追加した。
- stylesheet単位slotでは元ファイル内部のinterleaveを完全保持できないため、selector依存監査、computed-style blocking、一致しないruleの複数fragment化またはstartup残置へ修正した。
- Phase 4.4の初回抽出で、`styles-layout-info.css` 後端へ単純にHELP fragmentを置くと、元はHELP専用ruleより後ろにあったpremium shared ruleの優先順が逆転し、背景色・title色・角丸が変化した。shared mixed ruleはstartupに残しつつHELP selector projectionをfragment内の元境界へ再配置し、Vite/classicの1440×900と390×844でpanel矩形、padding、border、背景、title、tab、searchの主要computed propertyが変更前と完全一致することを確認した。
- Phase 4.4の実captureで、初回open時にフォーカスをpanelへ強制移動するというmonitor仮定が従来挙動と一致しないことを確認した。open controlへの保持を既存UXとして監視し、ESC・close・backdropではcontrolへ返す契約を分離した。backdropの後続clickでpointerdown時のfocus返却が失われる実不整合だけは、click完了後の再返却で修正した。
- board frame画像はPixi resourceでなくCSS custom property経路であるため、WebP routingをBoardSkinRuntimeへ限定した。
- legacy特殊石preloaderは同期returnでload/decode完了を示さないため、DOM compatibility専用のawaitable preparation APIを設計へ追加した。
- 物理端末を必須release gateにする案は現行の任意診断方針と矛盾するため、device効果を主張する場合だけ必須とした。
- reportへ盤面状態や操作内容を入れる必要はなく、resource logical ID、phase、公開diagnosticsだけで全checkを判定できることを確認した。
- 最適化とmonitorを別タスクにすると未監視期間が生まれるため、実装単位ごとにbaseline、check、最適化、candidate、blocking化を完結させる順序へ改訂した。
- 実装前の独立read-only reviewを実施し、focused/overall verdict、production artifact、classic lane、CSS cascade、network保存session API、WebP routing、DOM preload完了契約の客観的な矛盾を修正した。ゲームルール、`events[]`、network authorityへ新しい仕様分岐は追加していない。
- Phase 0実captureでclassicはVite専用boot-state属性を設定しないことを確認し、lane別ready契約へ修正した。
- Phase 0 validatorがPixi内部の同一origin `blob:` URLを静的resourceとして拒否したため、転送量対象をHTTP(S)配信resourceだけに限定した。
- Phase 1.1の実captureで `ui/bootstrap.ts` 以外に `ui.ts` のWORK/gold/silver/rainbow用legacy preloadが通常起動時の5画像を取得していることを確認した。通常Pixiの唯一準備経路という契約に合わせて自動呼出しだけを除去し、互換用の明示preload APIは残した。
- 初期盤面が特殊石を含む場合までbootstrap requestを固定0件にすると正当な需要を誤検知するため、Pixi diagnosticsのcommitted frameから得るlogical ID集合を許可集合にし、必要集合外だけをfailにした。
- Phase 2.1の再captureで、保存済みプロフィールavatarのCSS backgroundが `assets/images/special-stones/` を共有し、Pixi board preloadとして誤分類されることを確認した。resource timingの `css` initiatorはboard需要駆動判定から除外し、プロフィール遅延化のresource契約へ帰属させた。Pixi resourceの `fetch` / `img` / `other` 判定は維持する。
- logical image resolverの実装レビューで、画像Bのpreload中にCへ切り替えると、Bを示すlogical属性とまだ表示中の旧source Aを誤って対応付け得ることを確認した。elementからの暗黙captureはresolver初回だけに限定し、以後はload完了または直接applyしたsourceだけをDocument cacheへ登録する。
- first-special captureで通常のgame更新とmonitorの直接 `submitFrame()` が競合したため、公開writer settlement経路でfixture frameをcommitし、`frame:prepared`、settlement token、network deltaの順序を観測する形へ修正した。
- 合成 `webglcontextlost` eventはPixi内部の実際のcontext-loss手順を通らず例外だけを発生させたため、既存E2Eと同じ `WEBGL_lose_context` extensionを使う実lossへ修正した。
- Phase 3.2のsource監査でstartup CSSがdefault PNGを即時要求することを確認し、BoardSkinRuntimeだけをWebP化する当初案では成功時にもPNG/WebPの2 bodyになるため、startup CSSの画像参照除去とapp-ready前の初期frame preparationを設計へ追加した。
- CSS `image-set()` は先頭WebPのnetwork failure時にChromiumがPNG候補へfallbackしないことを実機確認したため、common codecによるWebP検証後の単一CSS custom property適用へ限定した。
- forced WebP failureではChromiumの `ERR_FAILED` console error 1件が必然的に発生するため、このfixtureだけは同時にPNG成功、retry 0、expected error 1件を要求し、0件・追加errorのどちらもfailとする。
- Phase 4.2の実装監査で、`.premium-btn` がnetwork再戦申請dialogにも使われ、result CSSを単純にstartupから外すとresult未表示のnetwork操作まで未装飾になることを確認した。共有button ruleを `styles-layout-info.css` のstartup criticalへ移し、result局所変数がない場合のfallback色も明示した。
- Phase 4.2のVite実機確認で、生成entryはfeature slotをhead前方へ保持しつつeager CSS linkを後から末尾へ生成するため、slot直前挿入だけではclassicのcascade順にならないことを確認した。stylesheet loaderに任意のbefore-anchor解決を追加し、両laneで `info → result → characters` をblocking計測する設計へ修正した。
- Phase 4.3のsource監査で、profile固有responsive ruleは `styles-responsive.css` ではなく `styles-profile.css` 内の `@media` に既に集約されていることを確認した。計画書のcanonical component誤記を修正し、profile CSSを一つのfeature stylesheetとして遅延する境界へ整合させた。
- Phase 4.3のcascade監査で、profile CSSは従来 `styles-stone-shadows.css` の後ろにあり、生成entryのslot配置差により単純挿入ではVite/classicの順が一致しないことを確認した。stylesheet loaderへ任意のafter-anchor解決を追加し、両laneの `stone-shadows → profile` をblocking計測する設計へ修正した。
- Phase 4.3の実装レビューで、profile open iconは起動時に見える共有controlであり、overlay shellとCSS失敗案内はfull profile CSSより先に操作可能である必要があることを確認した。これらだけをstartup criticalへ残し、inner DOM、avatar resource、modal full CSSを初回openへ移した。
- Phase 4.3のmonitor実captureで、合成clickはLayoutShiftの `hadRecentInput` を立てずCLSを誤計上し、Playwright actionability待機前の時刻はplayer-visible latencyを過大計上することを確認した。trusted clickを使い、実際のclickをcapture listenerで時刻記録する境界へ修正した。avatarは英語logical IDを日本語labelや画像名へ要求せず、選択radioとresource timingを個別に照合する。
- Phase 4.3の失敗経路レビューで、stable dialogの `aria-labelledby` が通常inner DOM破棄後に参照先を失うことを確認した。CSS失敗画面の見出しにも同じstable IDを与え、エラー時のdialog labelを完了条件へ追加した。
