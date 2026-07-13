# 観測石報酬の遅延ロード修正 設計書

## 文書の役割

- 役割: 観測石報酬のブラウザ初回対戦時の取りこぼしを修正するための実装設計
- プレイヤー向け仕様の正本: `01-rulebook.md`
- 内部契約の正本: `docs/architecture-contracts.md`
- 非目標: 観測石の報酬量、CPU/ネット対戦の対象範囲、保存形式、ガチャ抽選仕様の変更

## 問題と期待結果

`ui/result-overlay.ts` はモジュール評価時にガチャヘルパーと進行保存モジュールを一度だけ解決している。一方、これらはブラウザ起動時には optional registry に登録され、ガチャ画面を初めて開くまで遅延ロードされない。そのため、対戦を先に終えると報酬判定時にも依存参照が `null` のままで、CPU/ネット対戦の観測石報酬が保存されない。

期待結果は、ガチャ画面をまだ開いていない状態で終局しても、既存仕様どおりリザルト表示時に観測石を保存し、表示すること。ガチャ関連ランタイムの遅延ロード自体は維持する。

## リポジトリ上の根拠

- `ui/result-overlay.ts:82-84`: ガチャ依存をモジュール評価時に固定解決している
- `ui/result-overlay.ts:864-907`: 固定参照が未解決だと報酬処理を終了する
- `public/module-registry.optional.js:20-44`: ガチャ依存は optional
- `entry-browser.js:126-135`: optional boot entry は初期ロードでスキップされる
- `ui/handlers/gacha.ts:114-120`: ガチャ操作時に `loadLazyRuntimeGroup('gacha')` を実行する
- `01-rulebook.md:2265-2269`: CPU/ネット対戦は勝敗に関係なく基本100の観測石を獲得し、勝利時のみ追加ドロップがある

## 設計

### 選択肢

1. ガチャヘルパーと保存モジュールを必須ブートへ移動する
   - 修正は単純だが、ガチャ機能の遅延ロードを失い、初期ロード範囲を広げる。
2. `result-overlay` の報酬処理時に依存を再解決する
   - 起動時の遅延ロードを維持し、終局時にだけ必要な依存を取得できる。既存の `require`/global fallback 境界も再利用できる。
3. ガチャロード完了イベントで `result-overlay` の依存を差し替える
   - イベント順序と状態を新たに管理する必要があり、報酬処理との競合面が増える。

### 採用案

選択肢2を採用する。`resolveObservationStoneModules()` を報酬処理側から呼び、毎回 `require` と global namespace を確認する。解決できない場合は従来どおり報酬を付与せず、成功条件を満たすモジュール（ヘルパー、`getObservationStones`、`awardObservationStones`）が揃った場合だけ処理する。

報酬処理の重複防止トークンとローカルストレージ形式は変更しない。既に報酬がキャッシュされている場合も、現在の保存残高を読み直す既存動作を維持する。

### データフロー

1. `showResultOverlay()` が観測石報酬サマリーを要求する。
2. サマリー関数がその時点の `require`/global namespace からガチャ依存を解決する。
3. `cpu` または `network` モードかつ保存APIが利用可能なら、既存のトークンで重複を防止する。
4. 基本報酬と勝利時追加報酬を計算し、`awardObservationStones(window, total)` で保存する。
5. 保存後の残高を読み、既存のリザルト表示へ返す。

## テストと検証

- 既存の `test/ui.result-overlay.network-seat.test.ts` と `test/ui.gacha-progress-storage.test.ts` を実行する。
- `result-overlay` 読み込み時には依存がなく、報酬処理時には global namespace に依存が現れるケースを追加して、遅延解決を直接検証する。
- `npm run typecheck` を実行する。
- `git diff --check` と task-owned diff を確認する。

## リスクと緩和

- optional registry が失敗する環境では依然として報酬は付与できない。依存未ロードを成功扱いにせず、既存の安全な未付与結果を維持する。
- 報酬処理ごとのモジュール解決は終局表示時の一度だけであり、通常プレイのループには追加負荷を入れない。
- 既存の画像・音声・生成ファイルの未コミット変更は無関係なため、変更・コミット対象から除外する。

## 完了条件

- ガチャを開く前のCPU/ネット終局でも、観測石報酬が保存・表示される。
- ガチャを先に開いた場合と、Node/Jest の既存経路の挙動が変わらない。
- 報酬二重付与防止が維持される。
- focused test、typecheck、diff check が成功する。
- task-owned変更だけをコミットする。

## Self-review

- 初期案を「optional依存を必須化する」方向にせず、遅延ロードの目的を維持する設計へ修正した。
- `awardObservationStones` が無い場合に「付与済み」と記録する既存の弱点も確認し、成功条件に保存APIの存在確認を含めた。
- 仕様変更ではなく、既存仕様の実行タイミングと依存解決の不整合を直す内部修正として扱うため、`01-rulebook.md` は変更しない。
