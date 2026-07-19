# FPS表示トグル 設計書

## 文書の役割

- 役割: 設定パネルからFPS表示を切り替え、選択中はゲーム画面端へ継続表示するための実装設計
- プレイヤー向け仕様の正本: `01-rulebook.md`
- 内部契約の正本: `docs/architecture-contracts.md`
- 非目標: ゲームロジック、Pixi/DOM盤面バックエンド、ネットワーク権威、描画品質やフレーム上限の変更

## 問題と期待結果

現在の設定パネルにはフレームレートを確認する通常ユーザー向け操作がなく、開発用の盤面性能ハーネスは明示的なdebug queryに限定されている。プレイヤーが設定の `FPS: OFF` を押すと `FPS: ON` へ切り替わり、ゲーム画面の右上端に実測値を `FPS: N` 形式で常時確認できるようにする。もう一度押すと計測と表示を停止する。

「このゲーム中」は現在のブラウザタブのセッションと解釈する。同じタブで再読み込みした場合は選択を復元し、タブを閉じた後の新しいセッションへは持ち越さない。

## スコープ、前提、制約

- FPSトグルはdebug modeに依存せず、通常プレイでも表示する。
- 表示値はブラウザの `requestAnimationFrame` callback頻度を一定区間で平均した整数とする。
- FPS表示は画面端のDOMオーバーレイであり、盤面ピクセル、canonical state、`events[]`、入力ロックを変更しない。
- オーバーレイはクリックを受けず、盤面・手札・設定操作を妨げない。
- 連続更新をスクリーンリーダーへ読み上げさせず、ボタンの `aria-pressed` と文言でON/OFF状態を伝える。
- `sessionStorage` が利用できない環境でも、その場の切替と計測は継続する。

## リポジトリ上の根拠

- `index.classic.html`: 既存ファイルがある場合に `scripts/build-vite-entry.ts` が生成入力として選ぶdual-lane markupの正本。`#control-panel` の先頭 `.control-group` が `DEBUG` とログを含む設定操作を所有する。
- `index.vite.html` / `index.html`: `index.classic.html` からbuildが生成するVite入力と既定配信面であり、先に直接編集しない。
- `ui/bootstrap/init-dom.ts`: 初期化時に設定パネルの要素参照を一括取得する境界。
- `ui/bootstrap/init-events.ts`: 設定ボタンのイベント配線を行う既存境界。
- `styles-layout-controls.css`: 設定パネルの狭幅・折返し・ボタン状態と固定UIのスタイル正本。
- `docs/architecture-contracts.md` 7.3: fullscreen/global UIはDOM presentationとして盤面writerから分離できる。FPS表示は盤面座標も盤面frameも書かないためこの境界に置く。
- `browser-vite/` と `scripts/build-module-registry.ts`: root TypeScriptモジュールと表示ソースは既存buildからbrowser registry/bundleへ生成する。

## 選択肢と採用案

### 1. Pixi tickerのFPS値を盤面上に描く

Pixi利用時の値に近いが、DOM compatibility fallbackでは利用できず、盤面writerへ診断表示を混在させる。バックエンド切替にも追従処理が必要になるため採用しない。

### 2. 常時動くグローバル診断ハーネスを通常プレイへ公開する

既存debug性能ハーネスを再利用できる可能性はあるが、debug専用globalと通常プレイの境界を弱め、必要以上の診断APIを公開するため採用しない。

### 3. UI所有の小さなRAF計測モジュールを追加する

レンダリングバックエンドに依存せず、設定UIのON時だけ1本のRAF loopを動かせる。盤面writer、ゲーム状態、ネットワークを変更せず、単体テストもしやすい。これを採用する。

## 詳細設計

### DOMとスタイル

- `index.classic.html` の設定行へ `#fpsToggleBtn` を追加し、初期文言を `FPS: OFF`、`aria-pressed="false"`、`aria-controls="fpsDisplay"` とする。buildで `index.vite.html` と `index.html` へ反映する。
- `body` 直下へ `#fpsDisplay` を追加し、初期状態は `hidden`、文言は `FPS: --` とする。
- 表示位置はsafe-areaを考慮した右上端とし、固定幅の等幅数字、半透明の暗色背景、高コントラスト文字を使う。
- `pointer-events: none` とし、結果画面を含むゲームUIより上、メンテナンス通知より下のz-indexで表示する。
- 設定ボタンは既存の折返しレイアウトとbutton skinを再利用し、ON時は専用accentと `btn-active` で状態を区別する。

### 計測モジュール

`ui/fps-display.ts` が次を所有する。

- `setupFpsDisplay({ button, display, root })` による配線とcontroller生成
- 500ms以上のsample window内に到着したRAF callback数から `round(frames * 1000 / elapsedMs)` を算出
- background tabから復帰したような長いsample gapでは値を更新せずsampleを再開し、不自然な一桁値を残さない
- OFF時の `cancelAnimationFrame`、表示非表示、sample state初期化
- `sessionStorage` の単一キーによる現在タブ内のON/OFF復元
- 再初期化時に既存controllerを破棄し、click listenerとRAF loopが重複しないcleanup

ブラウザにRAF APIがない場合は計測を開始せず、ボタンをdisabledにして利用不可を明示する。storage read/write失敗だけは計測可否と分離し、例外をUI初期化失敗へ波及させない。

### 初期化とデータフロー

1. `init-dom.ts` がボタンと表示要素を取得する。
2. `init-events.ts` がgame/board初期化後の既存イベント配線時に `setupFpsDisplay` を呼ぶ。
3. モジュールがsession値を読み、ボタン・表示・RAF loopを同期する。
4. クリックのたびに表示状態、ボタン状態、session値を同じcontroller内で更新する。

この状態はUI presentationだけに閉じ、game state、snapshot、Worker、CPU、selfplayへ渡さない。

## 互換性・性能・失敗時挙動

- Pixi通常経路とDOM compatibility経路の双方で同じブラウザRAFを計測する。
- ON時の追加負荷は1本のRAF callbackと500msごとの短いtext updateに限定する。OFF時はloopを停止する。
- 画面端表示はレスポンシブlayoutの座標計算や盤面geometryを参照しない。
- storageが拒否されても現在ページ内のON/OFFは動作する。RAFがない場合だけボタンを無効化する。
- 表示値はブラウザcallback頻度であり、GPU時間や個別のPixi draw-call性能を表す詳細profilerではない。

## テストと検証

- `test/ui.fps-display.test.ts` で初期OFF、クリックON/OFF、RAF平均値、長いgapの再sample、session復元、cleanupを確認する。
- 既存UI markup/layout contractで設定ボタンと画面端オーバーレイの存在・状態属性・スタイルを確認する。
- `npm run typecheck` とfocused Jestを通す。
- player-visible root変更後に `npm run build:vite` を実行し、browser registry、Vite module bridge、bundle、cachebusterを正本から再生成する。
- 実ブラウザで設定を開き、FPS ONで右上表示が継続更新され、OFFで消えることを確認する。
- `git diff --check`、task-owned diff、最終statusを確認する。

## リスクと緩和

- 高リフレッシュレート端末では60を超える値になる。実際のcallback頻度を隠さず整数表示する。
- background復帰直後は長い停止時間を平均へ含めないため、次のsample確定まで `FPS: --` または直前値ではなく再計測状態を表示する。
- 狭い設定パネルではボタンが折り返す。既存の `flex-wrap` を利用し、パネル幅や他設定行の密度を変更しない。
- 右上の他UIと近接する可能性はあるため、小型・クリック透過・safe-area対応とし、実画面で重なりを確認する。

## 完了条件

- 通常プレイの設定パネルに `FPS: OFF/ON` トグルがある。
- ON中は右上端でFPS整数が継続更新され、OFFで表示とRAF loopが停止する。
- 同じタブの再読み込みで状態を復元し、新しいセッションへ永続化しない。
- 表示が盤面writer、ゲーム状態、ネットワーク、入力へ影響しない。
- unit/layout tests、typecheck、browser build、実ブラウザ確認、diff checkが成功する。
- task-owned変更だけをコミットする。

## Self-review

- 「常時表示」を満たしつつ永続設定にしすぎないよう、保存範囲をlocalStorageではなく現在タブのsessionStorageへ限定した。
- Pixi ticker案を退け、DOM compatibilityでも同じ意味になるbrowser RAF計測へ統一した。
- 更新値をaria-liveにしないことで、アクセシブルなボタン状態を維持しながら連続読み上げを避けた。
- 長時間background後の誤った低FPSと再初期化時の複数loopを明示的なedge caseへ追加した。
- 局所的なUI変更でauthorityや複数runtime契約を変更しないため、独立subagent reviewは不要と判断した。
- 初回実装では `index.html` をmarkup正本と判断したが、実ブラウザでボタンが欠落し、`scripts/build-vite-entry.ts` が既存の `index.classic.html` を常に生成入力へ選ぶ証拠を確認した。設計を修正して `index.classic.html` を先に変更し、生成先を直接編集しない順序へ改訂した。
