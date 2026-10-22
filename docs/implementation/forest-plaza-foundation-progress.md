# 森の広場 基盤の進捗・引継ぎ

役割: 基盤担当の作業記録。対象は forest-plaza 共通API。契約は [設計書](forest-plaza-activities-design.md) の「共通のしくみ」、型は `browser-vite/forest-plaza/activities/types.ts`。活動本体・lines-data・rulebook はこの担当の変更対象外。

## 実装

- 新規: `activities/{types,director,pathing,audio,index,sleep,feed,ball,tag,piano,pianoSynth,chat}.ts`。
- 変更: `characters.ts`, `player.ts`, `main.ts`, `lines.ts`, `lines-index.ts`, `forest-plaza.css`。
- 新規テスト: `test/forest-plaza.{pathing,director,lines}.test.ts`。
- 設計書のAPIスケッチを実装済み契約・例へ置換。家具の実測表を追記。
- 活動ひな形は意図的に何もしない。7ファイル中pianoSynthはpianoから使う音源用モジュールで、独立したupdate対象ではない。

## 検証・証拠

- `npm run typecheck`: 成功（本体とtraining）。
- `npm run test:jest -- --runTestsByPath test/forest-plaza.pathing.test.ts test/forest-plaza.director.test.ts test/forest-plaza.lines.test.ts`: 3 suite / 58 test成功。scriptが既に--runInBandを指定するため--maxWorkersは併用しない。
- Vite `http://127.0.0.1:5181/forest-plaza.html?debug=1`、Three.js、Chromium headless + SwiftShader、1920×1080とタッチ430×932で描画・コンソールエラー0。
- 中央→ピアノ/ベッド/キッチンの経路が両端末で取得できる。実座標と不可の候補は設計書の家具表。
- 0.4675mの罠石・1.85mの観測者を呼び、占有・割込解除・実歩行・散歩復帰・座る/横になる・模型の地面クリアランスを確認。横臥の下端は床+約0.02m。
- 共通APIで手持ち→家具→キャラのクリック優先順、両視点の手への付け替え、あいさつ/なで、歩行/ジャンプ/スティック、固定姿勢/見回し制限/入力で解除、Escの先取り、音のunlock/保存を検証。
- ハーネスとすべての画像/JSON/ログ: `F:\othello_v2-data\forest-plaza-harness\`。実行方法は同フォルダREADME.md。
- 計測証拠 `desktop-paths.json`, `mobile-paths.json`。回帰結果 `desktop-regression.json`, `mobile-regression.json`。枕の向きと大小模型の横臥境界 `bed-pose-detail.json`。

## 注意・制限

- 基盤は専用GLBアニメを追加せず手続き動作。着座・横臥中は既存のダンス骨格を止める。
- 家具上面には経路で登らない。家具隣へ歩いてから姿勢を設置。大柄なキャラは到着点の候補を広げる。遠いベッドへ行ったキャラは、活動側で元の場所への戻り経路も管理する（従来の散歩は敷石内の目的地しか選ばない）。
- 音源・小物・登録handle・入力handlerは活動側で破棄する。directorのfinishは占有解除であって活動側の小物/音の終了ではない。
- debug.advanceはシミュレーションだけでperformance.now/音声時計は進めない。
- 時間帯の一時変更自体は即時。睡眠担当はfade中に変更する。音楽・各活動の通し確認は実装後に各担当が行う。
- 画面検証は内部描画倍率0.6・影オフ（通常ゲーム設定はそのまま）。GPU実機のフル品質・酔いの主観評価は未検証。
- 既存Three.jsのClock/PCFSoftShadowMap非推奨警告があるが、コンソールエラーは無い。
- ポインターロック不可時は既存どおりマウス位置で直接クリックするフォールバックを残した。
- 後始末: 検証用5181のVite実プロセス72752を停止し、待受なしを確認。8000は元のrepo配信プロセス73144のままHTTP 200。`git diff --check` 成功。
- 子担当の指示に従い、Gitの書込み・通常配信ビルド・8000の停止は行わない。開始時の別作業 `assets/...html` / `data/models/model-assets.json` に触れていない。セリフ担当のJSON変更にも触れていない。
