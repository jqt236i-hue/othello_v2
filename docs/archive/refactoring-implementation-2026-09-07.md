# リポジトリ横断リファクタリング実装計画

役割: 2026-09-07に実施したリファクタリングの履歴。現在の設計の正本ではない。
対象は調査で挙げた7箇所。仕様の正本は `../../01-rulebook.md`、内部契約は `../architecture-contracts.md`。
ゲーム仕様、CPUの評価値、通信形式、外観、学習の既定値は変更しない。

## フェーズと完了条件

- [x] 通信: 状態の構築と領域別アクセスを分離し、再接続処理に状態全体を渡さない。
- [x] CPU: 共通評価とカード別評価を分離し、評価順序と結果を保持する。
- [x] カード: 公開APIの型と互換引数変換を整理し、依存構築を分離する。
- [x] CSS: 画面ごとの累積上書きを整理し、カスケードの結果を維持する。
- [x] サーバー: Worker/localの送信応答を共通化し、既存の環境差を明示する。
- [x] 学習: 単純なCLIオプションの解析と既定値を宣言的に管理する。
- [x] Pixi: 独立した描画リソースのライフサイクルを分離する。
- [x] 統合: 型・関連テスト・境界・生成物・ブラウザを検証し、通常配信へ反映する。既存問題による未通過は下記に記録。

## 検証

変更ごとに既存の関連Jestテストと挙動保持の回帰テストを実行する。
統合時は typecheck、checkall、必要なruntime/parity検査、build:viteを実行する。
描画・操作は8000の通常配信で確認する。サーバーの所有者と継続稼働も確認する。
既存のAGENTS.md・asset-manifest・未追跡アセットは今回のコミットに含めない。

## 実行記録

- 開始時: 既存変更を確認。前回調査の7スイート301テストは成功済み。
- 通信: `ui/network/client-state.ts` が6領域を構築。既存の平坦な状態は同じ値への互換ビューとし、再接続とストリームには必要な項目だけを公開。
- CPU: 56個のカード評価ブロックを4分野に分離。実装前に固定した99カード×96状況の9,504判断のSHA-256は、分割後も `74e3cc875322d050f961132ebdf9c535c2a6128bd3c02313ae6fedcc86f1c134` のまま。
- カード: 公開の使用・コスト・種類APIの型、2種類の互換引数変換、8個の遅延ドメイン構築を分離。公開facadeのidentity検査は成功。86個のモジュール状態所有者に増減はなく、構造スナップショットは新規モジュールと移動した参照行だけ追従。
- CSS: 4ファイルから後続に上書きされる519宣言・717行を削除。1440/390px、盤面・デッキ・ガチャ・ランキングの8ケースで、同一DOMの全要素・疑似要素の算出スタイルを変更前後で比較し、差分0。
- サーバー: `utils/match-publish-payload.ts` で送信応答を共通化。Workerのカード定義preloadより先にauthorityを初期化しないよう、初期化済み機能もDIにし、独立importの回帰テストを追加。
- 学習: 155個の単純なCLIオプションをschemaに移動。パス処理、複数項目更新、相互検証は既存parserに残す。既存の引数・cycleテストは成功。長時間学習は実行していない。
- Pixi: viewport maskとsource trajectory poolを専用所有者に移動。sceneと軌跡の既存テストは成功。

## 検証結果と制限

- 全Jestは1,054スイート・7,997テストを実行。当初の9失敗スイートのうち、今回の構造変更に関係する5スイートは修正・再実行で成功。残る4スイート・6テストは、HEADのソースを一時領域へ展開して同じ失敗を再現した。
- 最後の初期化順序修正後、通信・構造・依存境界の5スイート52テスト成功。追加のimport回帰テストを含む。CPUの挙動スナップショットは更新していない。
- `typecheck`、`build:vite`、`worker:prepare` が成功。Worker mirrorは1,610ファイルを検査。
- `checkall` は依存境界、カードruntime境界、盤面境界、生成物鮮度、アセットcase、Worker mirror等を通過。ただし既存の `data/runs/cpu_improvement_audit_20260907/retired-index.vite-DX2H90RH.js` と `data/runs/cpu_movement_feasible_20260907/previous-index.vite-BHJPpVHJ.js` がJS inventoryに検出され、総合結果は未通過。利用者の保存物なので削除しない。
- UI操作smoke、Pixi runtime fallback検査は成功。`http://127.0.0.1:8000/` のVite/PixiとVite/DOM、および `/index.classic.html` のclassic/Pixiで、実際のマウス着手・リセット成功。検証時は `debug=1&boardRenderer=pixi|dom&noanim=1` を使用し、設定パネル閉鎖完了後にクリックした。
- 詳細Pixi盤面検査は、既存の画像寸法基準、canvas backing store上限、custom Blob leaseの54エラーで未通過。変更前のbuildでも同一の54エラー文字列を再現。今回の変更による増分はなかった。
- `check-card-runtime-dist-parity` は既存のlocal authority digest基準で未通過。変更前後の実測digestは同じ `afd0549a839db154402148d7c52204e21342d16e51ea8bcc5493c6f81992cb84`。
- 通常のWorker bundle smokeは作業前からの `observer_will_reference/blender_model_v2/Observer_Will.glb` (28.9 MiB) が25 MiB制限に抵触して未通過。元のアセットや配信設定は変えず、一時configで空のアセット領域を指定した通信コード検証は成功。バンドル内カード処理、runtime失敗時の原子性、実ローカルDurable Objectの作成・参加・状態取得・V3着手・再送の冪等性・退出を確認。本番配信の検証ではない。

変更前にも失敗したJestは `network.room-deck-runtime-parity`（デッキコードの期待値）、`ui.global-board-effect-presenter`（2演出のdeadline）、`scripts.inventory-js-legacy`（2保守スクリプトの参照）、`utils.match-authority.public-api`（既存turn-limit APIの一覧）。これらは今回のリファクタリングに含めて仕様変更や検査の弱体化を行わない。

検証ログは作業環境の `%TEMP%/card-reversi-refactor-*.log` に保存。通常配信の既存サーバーはこのrepoを指すPID 29900、親は `scripts/serve-with-fallback.js` のPID 36796で、作業中の複数ビルドを越えて継続稼働。本番デプロイは行っていない。
