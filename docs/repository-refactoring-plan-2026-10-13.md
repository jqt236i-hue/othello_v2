# リポジトリ調査に基づくリファクタリング・整理計画

## 1. この文書の役割

- **役割**: 根拠を確認した改善対象を、次の実装担当者が全件解消するための計画書。新しいゲーム仕様の正本ではない。
- **状態**: 実装中（2026-10-13 着手）。各項目の実装状態は下表、変更内容・検証結果・残件は「9. 実装記録」に記す。
- **対象**: カードリバーシの画面、ゲーム処理、通信サーバー、CPU・学習、ビルド・検査・保守ツール。
- **正本**: [ルールブック](../01-rulebook.md)、[内部契約](architecture-contracts.md)、各対象ディレクトリの `AGENTS.md`。作業・配信方法は [ルートの作業規約](../AGENTS.md)。
- **非目標**: カード効果・CPUの強さ・演出の変更、全面書き直し、フレームワーク変更、互換経路の一括削除、過去の学習結果の書き換え、長時間訓練、本番デプロイ。
- **調査基準**: 2026-10-13、開始時点 `348683e82`。既存の別作業2件（ストーリーHTML、`data/models/model-assets.json`）は変更していない。実装着手時は最新状態を再確認する。

## 2. 結論と調査の範囲

**改善した方がよいと断言できる箇所はある。今回確認した24項目を、すべて本計画の解決対象とする。**

採用したのは、同一規則の二重管理、実際に食い違っている境界、到達不能な実装、検証が見逃す構造など、現在のソース・呼出元・テストで根拠を示せるものに限る。「ファイルが長い」「命名が好みではない」「`any` が多い」だけの改修は含めない。

主要な入口から所有者・利用側・テストを横断した調査であり、全ファイル全行の完全監査や、他に問題が存在しないことの証明ではない。特に、外部保管された大容量データ、凍結した対戦相手、生成物の全内容、独立公開の別ゲーム、学習精度・長時間性能は対象外。ジャンクション先のデータは探索していない。

| 調査領域 | 確認した主な境界 | 対象ID |
| --- | --- | --- |
| 画面・ブラウザ | 通信の非同期処理、遅延生成画面、個人画像保存、Pixiと入力 | R01〜R06 |
| CPU・学習 | 通常CPUと自己対戦、モデル検証、再開、成果物の引き渡し | R07〜R12 |
| ゲーム・共有処理 | 対象選択、pending生成、ラウンド、顕現石、起動登録 | R13〜R17 |
| 通信サーバー | Workerとローカルの共通規則、認証情報の生成 | R18〜R19 |
| ビルド・検査・ツール | 検査の副作用、探索範囲、抑制検出、テスト登録、CLI | R20〜R24 |

### 優先度

- **P1**: 通信・保存・評価条件・再開データの正しさに関わる。単なるコード移動ではなく、不具合修正を伴う。
- **P2**: 特定条件で破綻する構造、二重管理、検証漏れを解消する。
- **P3**: 未使用経路・紛らわしいツール仕様の小さな整理。後回しにはできるが、全件完了には含める。

| ID | 優先度 | 解決対象 | 実装状態 |
| --- | --- | --- | --- |
| R01 | P1 | 古い配信イベントが再接続カーソルを更新する | 完了（Phase 2） |
| R02 | P1 | 再送中に接続先が変わり、旧認証情報を別接続先へ送れる | 完了（Phase 2） |
| R03 | P1 | 古い復旧処理が新しい復旧処理の実行中フラグを解除する | 完了（Phase 2） |
| R04 | P1 | 個人画像の保存成功をDB確定前に通知する | 完了（Phase 2、実ブラウザ確認は Phase 6） |
| R05 | P2 | プロフィールと遅延生成された名前入力の同期漏れ | 未着手 |
| R06 | P2 | 盤面拡張の矢印と透明入力領域の位置定義が不一致 | 未着手 |
| R07 | P1 | Lv13の通常CPUと自己対戦で継続計画・時間予算が異なる | 未着手 |
| R08 | P1 | 学習モデルの検証が通常配信用モデルを一時上書きする | 未着手 |
| R09 | P1 | 再開用chunkが設定・モデル・出力の同一性を確認しない | 未着手 |
| R10 | P1 | chunk再利用時に不正着手の診断記録が統合から漏れ、消える | 未着手 |
| R11 | P2 | 非対応のカード用ONNXを通常ブラウザ検証へ要求する | 未着手 |
| R12 | P2 | 訓練を省略した回の未生成モデルを候補として渡す | 未着手 |
| R13 | P2 | 対象選択registryと手書き分岐・転送一覧の多重管理 | 未着手 |
| R14 | P2 | pending状態の生成規則が二重化し、既に差がある | 未着手 |
| R15 | P2 | ラウンド規則・手番交代の予備実装が二重化 | 未着手 |
| R16 | P2 | 顕現石の所属分類を10箇所で手書き管理 | 未着手 |
| R17 | P3 | 未使用の旧カードresolverが起動経路に残る | 未着手 |
| R18 | P2 | Worker／ローカルでタイマー・演出履歴・チャット規則を重複管理 | 未着手 |
| R19 | P2 | 認証文字列生成の重複とWorker復旧コードの文字分布の偏り | 未着手 |
| R20 | P2 | 読み取り専用と説明された検査が配信物を再生成する | 完了（Phase 1） |
| R21 | P2 | 検査用ファイル探索がリンク先を辿り、同じ木を再走査する | 完了（Phase 1） |
| R22 | P2 | 型検査抑制の検出範囲・認識方法・例外表が不整合 | 完了（Phase 1） |
| R23 | P2 | `return` の後に置かれ、登録されないテスト | 完了（Phase 1） |
| R24 | P3 | プレビューツールの受理されるが効かないオプション | 完了（Phase 1） |

## 3. 今回実施した検証と限界

### 実施結果

1. `npm run typecheck`: **成功**。通常ソースとtrainingの型検査を実施。生成はしていない。
2. 次の限定テスト: **3スイート・25テスト成功**。

   ```powershell
   npm run test:jest -- --runTestsByPath test/checkall.hermetic-bootstrap.test.ts test/scripts.check-worker-mirror.test.ts test/workers.match-worker-turn-timer-helpers.test.ts
   ```

   mirrorテストの生成先はテスト専用の一時ディレクトリ。実際の配信物は更新していない。
3. 現行TypeScriptをメモリ内で変換し、通信・タイマー・DBを合成入力に差し替えた限定再現:

   | 対象 | 再現条件 | 観測結果 |
   | --- | --- | --- |
   | R01 | 同じ部屋・同じsession epochでstreamを2回開き、旧callbackへJSONイベントを渡す | snapshot適用は0回だが、カーソルは旧値に変更、活動時刻更新は1回 |
   | R02 | 1回目503、再送待機中に接続先AをBへ変更 | 2回目はBに旧payloadのまま送信。実ネットワークへの通信なし |
   | R03 | 復旧A開始→close→B開始→A完了→再度復旧要求 | B未完了なのにフラグが解除され、3本目が開始 |
   | R04 | DBのput requestだけ成功させ、transaction完了を発生させない | 書込Promiseが解決。complete／abortのリスナーなし |
   | R22 | コメント8行の後に`@ts-nocheck`を置く合成ソース | TypeScriptは抑制を認識、現行の先頭6行判定は見逃す |

   R04は内部の`putRecord`を監査用にメモリ内で公開して確認したもの。ブラウザの実DB障害を発生させた結果ではない。
4. R19の現行式を全256バイトについて確認。復旧コードの文字集合は30文字で、単純剰余では各文字の割当数が8回／9回に分かれる。実在する認証情報は生成・取得していない。
5. 計画書のリンク先65参照とコード表記のファイル80参照に不存在なし。R01〜R24の一覧・本文の対応、空白検査、Markdownの見出し・6表の表示を確認した。文書プレビューはゲームのブラウザ検証には数えない。

### 未実施

全テスト、`checkall`、ブラウザ／Workerビルド、実画面操作、実際の学習・モデルgate、本番確認は実施していない。特に現在の`checkall`は配信物再生成や広い探索を含むため、この調査では実行していない。既存テストが成功したことを、R01〜R24が解決済みという意味にしない。

## 4. 具体的な解決内容

以下の行番号は調査時点のもの。実装時は関数名と最新の呼出元を再確認する。新設テストは各項目の条件を既存スイートへ追加するのを基本とし、既存の失敗を削除・skipして解決扱いにしない。

### R01 — 古いstreamの副作用を入口で止める

- **根拠**: [stream-session.ts](../ui/network/stream-session.ts):102–164はpayload処理だけをguardする。一方、外側の[transport.ts](../ui/network/transport.ts):179–190は先にカーソル記録・活動通知を行う。[既存テスト](../test/ui.network-stream-session.test.ts):17はこのparserを素通しmockにしている。
- **解決**: stream instance・session epoch・部屋の確認を、parserを含むイベント処理全体より前へ移す。必要ならtransportは純粋parse、session側が有効性判定と副作用を所有する。snapshotだけでなくpresence/chat/heartbeat/transport-healthにも適用する。
- **完了条件・検証**: 同室再接続、別室への切替、退出後に旧callbackを呼んでもカーソル・活動時刻・復旧状態・盤面は一切変わらない。`test/ui.network-stream-session.test.ts` と `test/ui.network-transport.test.ts` を実parserの組合せでも検証する。

### R02 — 再送の接続先・資格情報・寿命を固定する

- **根拠**: [transport.ts](../ui/network/transport.ts):63–66,142–165は各試行で現在の`serverUrl`を読む。payloadは旧値のまま。[publish-flow.ts](../ui/network/publish-flow.ts):214付近の事後guardでは送信そのものを止められない。退出は[session-lifecycle.ts](../ui/network/session-lifecycle.ts):1005–1010でGETだけをcancelする。
- **解決**: 送信開始時に接続先・session識別・部屋・席・operationIdを不変のrequest contextへまとめる。各再試行と待機復帰で所有sessionを確認し、退出・切替時には未開始の再送を中止する。タイムアウトと取消を区別し、取消を一般的な再試行対象にしない。
- **維持・検証**: 同一sessionでの一時障害は同一operationIdで再送し、二重適用を防ぐ。接続先変更時の旧payload送信は0回。`test/ui.network-transport.test.ts`、`test/ui.network-publish-flow.contract.test.ts`、`test/ui.network-client.leave-room-cleanup.test.ts`、`test/ui.network-client.publish-base-version.test.ts`へ待機中切替を追加する。既にサーバーへ届いた操作を取り消せたとは扱わない。

### R03 — 復旧処理の実行権を世代付きにする

- **根拠**: [reconnect-controller.ts](../ui/network/reconnect-controller.ts):29–58の共有booleanを、:216–227のcloseと古い`finally`が無条件に解除する。R03の合成再現で新しい処理との競合を確認した。
- **解決**: 復旧処理に識別子／世代と所有Promiseを持たせ、終了処理は自分が所有する実行権だけを解除する。closeで古い処理を無効化し、旧success/failureも新sessionへ作用させない。
- **完了条件・検証**: reconnect／heartbeatの混在、close→再open、旧処理の成功・失敗の双方で同時実行制約を維持する。`test/ui.network-reconnect-controller.test.ts`にdeferred Promiseによる順序逆転を追加する。

### R04 — 個人画像はtransaction確定後だけ保存成功にする

- **根拠**: [storage.ts](../ui/custom-skin/storage.ts):448–465はput/deleteのrequest成功だけを待ち、:645–663でキャッシュ・URL・通知を確定する。[fake DB](../test/helpers/fake-custom-skin-browser.ts):25–40にはtransaction完了／abortがない。
- **解決**: 共通の書込transaction helperを作り、開始時にcomplete/error/abortを購読する。request成功だけではresolveせず、commit後だけキャッシュ更新・URL解放・保存表示を行う。失敗時には既存表示と保存済みデータを保持する。
- **完了条件・検証**: request成功後abort、put/delete失敗、正常commit、URL lease保持を区別できること。`test/ui.custom-skin-storage.test.ts`、`test/ui.custom-skin-controller.test.ts`、`test/ui.custom-skin-object-url-lease.test.ts`とfake DBを更新。実装時には実ブラウザで保存→再読込→削除も確認する。

### R05 — プロフィールを画面間のDOM参照で同期しない

- **根拠**: [player-profile-panel.ts](../ui/player-profile-panel.ts):128–151,262–271は他画面の入力を初回生成時に固定captureする。ネット対戦の入力は後から[match-mode.ts](../ui/handlers/match-mode.ts):1176–1184で生成され、:1087–1095では空欄しか補完されない。
- **解決**: 保存済みプロフィールを共有データの所有者にし、各遅延画面は生成時とプロフィール変更時に自身の入力へ反映する。購読は画面破棄時に解除する。最低限の修正に留める場合も保存時の最新参照解決を使い、初回captureを残さない。
- **完了条件・検証**: プロフィール先行／ネット対戦先行、画面再生成、名前A→B保存の全順序で表示と参加名がBになる。編集中の未保存入力を無関係な再描画で消さない。`test/ui.player-profile-panel.test.ts`、`test/ui.player-profile.test.ts`、`test/ui.match-mode.network-surface.test.ts`で確認する。

### R06 — 矢印表示と入力位置の定義を共用する

- **根拠**: [board-accessibility-layer.ts](../ui/board-accessibility-layer.ts):15–24は上下左右14%／86%、斜め18%／82%。[hint-view.ts](../ui/pixi/hint-view.ts):76–98は20%／80%。前者:37–39はPixiとの一致を意図しているが、[テスト](../test/ui.board-accessibility-layer.test.ts):92–94は片側の値しか確認しない。
- **解決**: 方向の正規化・glyph・中心位置をUI内の純粋geometryへまとめ、通常Pixiの表示と透明buttonが同じ値を使う。現在のPixi表示位置を維持して入力を合わせる。DOM互換表示に別位置が必要なら明示profileとし、暗黙の別表にしない。
- **完了条件・検証**: 8方向の表示中心とhit中心が一致。盤面拡張、zoom、スクロール、coarse pointer、キーボード操作で別方向を発火しない。`test/ui.board-accessibility-layer.test.ts`、`test/ui.pixi-cell-view.test.ts`、`test/ui.board-input-controller.test.ts`、`test/ui.pixi-board-input.test.ts`に横断比較を追加。実画面での操作不能は今回確認していないため、そうした症状が既知とは記載しない。

### R07 — Lv13の通常判断と自己対戦を同じ方針にする

- **根拠**: [cpu-turn-handler.ts](../game/cpu-turn-handler.ts):186–194はLv13用の4600ms/turn計画メモリを作る。[production-match.ts](../src/engine/production-match.ts):60–61にはそれがなく、[run-production-selfplay.ts](../scripts/run-production-selfplay.ts):73–76は`request.maxMs`も転送しない。[cpu-lv10-turn.ts](../game/cpu-lv10-turn.ts):98–129,158の継続計画・残予算処理が自己対戦で働かない。
- **解決**: 方針側が所有する判断メモリ生成・予算解決をheadless helperへ切り出し、通常画面と自己対戦が利用する。現行Lv13の計画を有効化し、探索上限はrequest残予算と実験上限の小さい方にする。factoryは各policyに所有させ、凍結した旧policyへ外側から新方針のメモリを付与しない。checkpointにも計画を保存する。
- **維持・検証**: 公開観測、canonical適用、Lv10〜12の独立方針、凍結した相手自身の方針を維持。旧runを新方針で再開しないよう実行identityを更新する。`test/selfplay.production-match.test.ts`、`test/cpu.lv13-turn-plan.test.ts`、`test/scripts.production-selfplay.test.ts`、`test/scripts.cpu-experiment-resume.test.ts`でカード→対象→配置の継続、予測不一致、残予算、再開を比較する。過去評価を同等条件の結果として再認定しない。

### R08 — モデルの検証と通常配信を物理的に分離する

- **根拠**: [command-builders.ts](../training/scripts/training-cycle-command-builders.ts):335–337,381–382はgate先にroot配信用ディレクトリを指定する。[ONNX gate](../training/scripts/benchmark-policy-onnx-gate.ts):727–732,764–766はそこへモデルとmanifestを一時書換えする。[契約§5.3](architecture-contracts.md#53-lv6-cpu-trainingruntime-profile-contract):215–220のlane分離と逆行している。
- **解決**: gate専用のモデルbundleとURL／静的配信mappingを明示し、通常と同じブラウザruntimeが当該laneの候補だけを読むようにする。rootへのbackup/copy/restoreを検証から撤去する。パスだけlaneへ変えてブラウザがrootを読み続ける修正では完了にしない。
- **完了条件・検証**: 2lane並行、失敗、中断のすべてでrootと他laneが不変、ページが読んだモデルidentityが指定候補と一致。`training/tests/selfplay.training-cycle.test.ts`、`training/tests/selfplay.policy-onnx-gate.test.ts`、`test/selfplay.ui-level-match.test.ts`、`test/scripts.deploy-lane-model-to-root.test.ts`を使う。rootを期待する旧assertionは隔離を検証するassertionへ置換する。rootへの反映は既存の明示deployだけに限定する。

### R09 — 再利用chunkの完全な同一性を証明する

- **根拠**: [generate-selfplay-data.ts](../training/scripts/generate-selfplay-data.ts):671–722はseed/games/index/countと出力の存在しか照合しない。schemaVersionは保存するが比較しない。:1434–1444が実際の再利用経路。
- **解決**: 正規化した生成条件、ルール・deck・teacher・入力モデル内容digest、schema／producer版、出力digestと件数を持つ版付き完了manifestを定義する。完了manifestを最後に確定し、完全一致だけ再利用する。出力に影響しない実行設定までidentityへ混ぜない。
- **完了条件・検証**: 設定変更、同名モデルの内容変更、別schema、欠損・途中切断を再利用しない。同一条件は再利用できる。旧manifestは誤採用せず診断を出し、既存成果物を保った別attemptで再生成する。`training/tests/selfplay.generate-data.parallel-workers.test.ts`、`training/tests/selfplay.generate-data.test.ts`へ回帰を追加する。

### R10 — 診断sidecarを再開・統合・cleanupまで所有する

- **根拠**: [generate-selfplay-data.ts](../training/scripts/generate-selfplay-data.ts):717–722の再利用結果には`illegalMoveHardcaseOutPath`がない。新規結果には:1462–1467で存在し、:1480–1492では返ってきたpathだけを統合してchunkディレクトリを削除する。
- **解決**: R09のmanifestに全sidecarを列挙し、再利用時も復元・検証する。必要な出力の統合と件数／digest確認が成功してから、そのattemptが所有する一時chunkだけをcleanupする。失敗時は再開用証跡を保持する。
- **完了条件・検証**: 全再利用／新旧混在の双方で診断件数・順序・内容が一致し、cleanup後も最終診断ファイルが残る。発生0件では不要なsidecarを要求しない。`training/tests/selfplay.generate-data.parallel-workers.test.ts`に、summary件数だけでなく実ファイルを確認する回帰を追加する。

### R11 — 通常ブラウザgateの対応能力を一つの契約にする

- **根拠**: [ONNX gate](../training/scripts/benchmark-policy-onnx-gate.ts):410–415,545,632,728はcard-head読込を要求するが、[run-ui-level-match.ts](../scripts/run-ui-level-match.ts):64–110は対応引数を解釈せず、[現行runtime status](../game/ai/policy-onnx-runtime.ts):266–286にもcard-headはない。既定で無効でも、有効構成の経路が残っている。
- **解決**: 通常browser gateの対応headを明示descriptor／型にまとめ、builder→CLI parser→runtime statusの整合を検証する。非対応card-headを通常gateへ要求したら、訓練開始前に明確に拒否する。未知の能力指定を黙って無視しない。
- **維持・検証**: 研究用trainer・旧checkpointは保持し、本番へカードONNXを復活させない。ルールブック§14.1の研究／本番分離を維持する。`training/tests/selfplay.policy-onnx-gate.test.ts`、`training/tests/selfplay.training-cycle.test.ts`、`test/selfplay.ui-level-match.test.ts`、`test/game.cpu-policy-onnx-runtime.test.ts`で引数生成だけでなく実parser／statusまで通す。

### R12 — 実際に得られたモデルbundleを次段へ渡す

- **根拠**: [training cycle](../training/scripts/run-selfplay-training-cycle.ts):1018–1070は周期によって訓練をskipする一方、[command-builders.ts](../training/scripts/training-cycle-command-builders.ts):306–326はenableと予定pathだけで今回の候補を指定する。たとえばevery=2の2回目には未生成のit02モデルをgate／promotionへ渡す。
- **解決**: 各headを「今回生成」「同一条件で再利用」「据置」「無効」として型付きbundleへ一度解決し、gateとpromotionに同じものを渡す。実在しない予定pathを候補扱いしない。据置headを含める場合はlaneの既存資産であることと出所を明示し、今回候補に偽装しない。
- **完了条件・検証**: value／targetの周期2について1・2・3回目をspawn mockで通し、検証したbundleと昇格するbundleが一致する。欠損をcatchで握り潰さず、周期を毎回訓練へ変更しない。`training/tests/selfplay.training-cycle.test.ts`、`training/tests/selfplay.policy-onnx-gate.test.ts`、`training/tests/selfplay.policy-promotion.test.ts`で確認。cardはR11の研究境界に従う。

### R13 — 対象選択の一覧と転送をregistryに集約する

- **根拠**: [prechecks.ts](../game/logic/cards-internal/card-usage-prechecks.ts):292–357はregistry経路でreturnした後に同じ登録済み30種のswitchを持つ。[validation-stage.ts](../game/cards/card-usage-validation-stage.ts):38–70,128–190と[hand-manager.ts](../game/logic/cards-internal/hand-manager.ts):678–712にも32 resolver名を手書きする。[契約テスト](../test/cards.pending-selection-contract.test.ts):144–169は不要な手書き列挙を強制している。
- **解決**: registryからresolver集合／転送を導出する。hand-manager固有の非pendingメソッドだけを明示追加し、到達不能switchと専用helperを除去。source文字列の形を固定するテストを、全entryの実呼出・引数・最小対象数を確認するテストへ置換する。
- **維持・検証**: 判定順、対象数、引数の種類を維持。local/public/module別のselector evidenceやslot/copy単位のcacheは異なる意味なので統合しない。`test/cards.pending-selection-contract.test.ts`、`test/game.card-usage-validation-stage.test.ts`、`test/game.cards.usability-analysis.test.ts`、`test/game.cards.hand-manager-module.test.ts`、`test/game.turn-pipeline-card-usage-guard.test.ts`で確認する。

### R14 — pending生成の本体を一つにする

- **根拠**: [pending-state-manager.ts](../game/logic/cards-internal/pending-state-manager.ts):218–240と[card-usage-pending-stage.ts](../game/cards/card-usage-pending-stage.ts):27–47が同じ状態を構築する。`sourceHandIndex`は前者が整数限定、後者は未正規化という差がある。製品のeffect-resolverはmanagerを静的に渡している。
- **解決**: factoryはcanonical managerに集約する。null／partial依存を支える必要がある呼出は同じfactoryへ委譲し、別のobject本体を置かない。stageには盤面依存の選択数補正、盤界の執行者のnull pending、働き者の意志のarmed更新だけを残す。
- **完了条件・検証**: 消費→犠牲による無効化→即時効果→pending→演出の順序、選択数、pendingEffectIdを維持。`test/game.card-usage-pending-stage.test.ts`のnull依存テストを先に特性化し、正当な互換を無根拠に削除しない。`test/game.card-usage-immediate-stage.test.ts`、`test/game.card-usage-sacrifice-stage.test.ts`、`test/game.card-usage-presentation-stage.test.ts`も確認する。

### R15 — ラウンド規則と手番交代の独立した予備本体をなくす

- **根拠**: [core.ts](../game/logic/core.ts):170–258と[round-state.ts](../game/turn/round-state.ts):23–115はラウンド進行・10ラウンド毎のボーナスを二重実装する。[turn_pipeline_phases.ts](../game/turn/turn_pipeline_phases.ts):429–469にも静的import先への委譲後に手番交代の予備本体があり、[正規handoff](../game/turn/action-phase/turn-handoff.ts):41–43の毒終了処理がないなど既に乖離している。
- **解決**: ラウンドの純粋規則を一箇所へ集約し、Coreとturn adapterが委譲する。必要なCore不在互換も同じ規則を使う。静的必須handoffが欠けた時に別規則で成功させず、変更開始前に既存runtime-unavailable境界で失敗させる。
- **維持・検証**: 両色完了までroundを進めない、同色連続手番、`scheduleBonus:false`、round10の+5を次手番開始に一度だけ付与、毒・時間停止・banner順序を保持。player正規化の受理形、契約上optionalのBoardOps等は別扱い。`test/game.round-bonus.test.ts`、`test/game.turn-runtime-services-compatibility.test.ts`、`test/game.turn-runtime-pass-failure.test.ts`、`test/game.movement-selection-turn-handoff.test.ts`、`test/game.swap-selection-turn-handoff.test.ts`、`test/game.trap-selection-turn-handoff.test.ts`で確認する。

### R16 — 顕現石の所属判定を正本へ委譲する

- **根拠**: 正本は[manifest-stone-registry.ts](../shared/manifest-stone-registry.ts):7–82。しかし以下に同じ3種の直書きがある。
  - `game/logic/cards-internal/card-usage-prechecks.ts`:90–109、`hand-manager.ts`:164–170、`protection-context.ts`:126–132。
  - `game/logic/card-resolution/board-executor.ts`:60–67。
  - `game/logic/cards/living-will-core.ts`:35–41、`markers.ts`:21–27、`utils.ts`:17–23、`selectors-core-utils.ts`:44–50、`selectors.ts`:64–77。
  - `game/cards/target-resolver.ts`:250–263。
- **解決**: typeの所属判定のみregistryへ委譲する。静的依存への手書きfallbackをなくし、必要な注入は明示portとcanonical既定値にする。
- **維持・検証**: type所属、marker種別、活動中判定は別物。残りターン、旧`specialStone`互換、ボムとの分類優先、他の保護効果は混同しない。`test/shared.manifest-stone-registry.test.ts`、`test/shared.manifest-stone-registry.marker-data.test.ts`、`test/game.manifest-random-target-exclusion.test.ts`、`test/game.position-swap-will.test.ts`、`test/game.protection-context.test.ts`、`test/game.board-executor.test.ts`で分類と対象選択を確認する。

### R17 — 使用されなくなったカードresolverを起動対象から除く

- **根拠**: [module-resolver.ts](../game/logic/cards-internal/module-resolver.ts):13–80の動的探索に実行呼出は見つからず、[entry-browser.js](../entry-browser.js):215、[Worker preload](../workers/match-worker-runtime-preload.ts):89と存在／順序テストだけが残る。静的composition移行後の残骸であり、全resolverの廃止を意味しない。
- **解決**: 削除直前に最新の呼出・公開互換契約を再検索し、未使用の本体・隣接wrapper・起動登録・それだけを守るテスト・索引を同時に除去する。生成されたVite／registryは既存スクリプトで更新する。
- **完了条件・検証**: 当該resolverが起動グラフに存在せず、facade identityとVite/classic/Worker起動が維持される。`test/game.cards-api-identity.test.ts`、`test/index.card-module-scripts.test.ts`、`test/game.card-runtime-composition.test.ts`、`test/game.card-runtime-characterization.test.ts`とcard-runtime境界検査を使用。専用`test/game.cards-internal.module-resolver.test.ts`は機能廃止に伴う撤去対象であり、他の起動保証は残す。

### R18 — 通信サーバーの共通規則をruntimeから分離する

単にWorkerとNodeのファイルを一つへ結合するのではない。次の3群を別々の小変更として行う。

| 群 | 確認した二重実装 | 解決単位と完了条件 |
| --- | --- | --- |
| タイマー | [local-match-server.ts](../scripts/local-match-server.ts):695–786／[match-worker-turn-timer.ts](../workers/match-worker-turn-timer.ts):17–85 | 生成・比較・公開残時間の純粋規則を共用。Worker alarmとNode schedulerは各adapterに残し、同じroom/timeなら同じtimerになる |
| 演出履歴 | local:137–202／[match-worker.ts](../workers/match-worker.ts):1062–1125 | cursor、初期viewer snapshot、accepted frame材料の組立を共用。authority/projectionを注入し、viewer別cache・不変履歴・保存順を維持 |
| チャット | local:875–876,2014–2082／[chat-controller.ts](../workers/match-worker-chat-controller.ts):32–37,64–110 | 既存の共通文字列検証へ委譲し、認証／履歴追加の共通規則を抽出。HTTP、保存、配信、既存のruntime別payload装飾はadapterに残す |

- **注意**: 一行の委譲関数まで不要な重複扱いしない。Nodeの同期command実行、Workerのpreload順、save後の配信、公開範囲を変更しない。既存の互換payload差は特性化してから扱い、一括でフィールドや理由コードを消さない。
- **検証**: `test/workers.match-worker-turn-timer-helpers.test.ts`、`test/workers.match-turn-timer.test.ts`、`test/workers.match-presentation-journal.test.ts`、`test/local-match-server.presentation-journal.test.ts`、`test/workers.match-worker-chat-controller.test.ts`、`test/match-runtime-parity.test.ts`。共通fixtureを両adapterへ通す比較を追加し、本文複製を残さず3群すべての同値性を確認する。

### R19 — 認証文字列の生成規則と乱数文字変換を共通化する

- **根拠**: [local-match-server.ts](../scripts/local-match-server.ts):1448–1476は偏りを除く棄却法、[match-worker-player-identity.ts](../workers/match-worker-player-identity.ts):22–56は単純な剰余。復旧コードの30文字に対して256は割り切れず、Workerだけ分布が偏る。書式も別々に管理している。
- **解決**: 文字集合・長さ・書式と、暗号学的乱数バイトを受け取る共通の棄却法helperを一箇所へ置く。Node crypto／Web Cryptoと永続化はadapterに残す。`Math.random`へ置き換えない。
- **完了条件・検証**: 合成バイト0〜255で240〜255を棄却し、受理された各文字の割当が等しい。既存ID・token・復旧コードの形式と旧データの認証互換は維持。`test/shared.player-identity-contract.test.ts`、`test/local-match-server.player-identity.test.ts`、`test/workers.match-player-identity.test.ts`と共通generator単体テストで確認する。偏りを確認したのであり、認証突破や実際の漏洩を確認したという意味ではない。

### R20 — 生成準備と読み取り専用の検査を分ける

- **根拠**: [package.json](../package.json):83–85で`check:worker-mirror`が`build:vite`を実行する一方、[設計資料§11](architecture-contracts.md#11-root-vs-mirror-contracts)はコマンドを読み取り専用と説明する。[run-all-checks.ts](../scripts/run-all-checks.ts):37–38はビルド済みrunnerからさらにbuildを含むnpm scriptを呼ぶ。[bootstrap](../scripts/checkall-bootstrap.js):28にもcompileがある。
- **解決**: 生成・compileの準備と検査本体を明示分離する。検査本体は既に用意したsnapshotだけを読み、古ければ修復せず失敗する。通常入口は必要な準備を明示し、準備済み全検査ではcompile／browser生成を繰り返さない。未buildのcheckoutを古いdistで検査しないfail-fastを残す。
- **完了条件・検証**: 検査前後で配信物の内容・mtimeが変わらず、古いmirror・余分なmirrorファイルは引き続き拒否される。`test/checkall.hermetic-bootstrap.test.ts`、`test/checkall.dependency-boundary-wiring.test.ts`、`test/scripts.browser-build-sync.test.ts`、`test/scripts.check-worker-mirror.test.ts`でspawn回数と非書換えを確認。[CI](../.github/workflows/node-test.yml)、コマンド説明、設計資料を同時更新する。

### R21 — 検査の探索をリンク非追跡・一巡にする

- **根拠**: [inventory-js-legacy.ts](../scripts/inventory-js-legacy.ts):4,75–100,241–248は`statSync`でリンクを辿り、`.`の再帰後に配下を再走査する。`output/`等の除外は部分的。[check-js-syntax.ts](../scripts/check-js-syntax.ts):11–27には除外もリンク判定もなく、root全体を辿る。
- **解決**: 検査用のファイル列挙を、子リンク非追跡・生成物／外部データ除外・訪問一回の共通helperへ寄せる。[check-window-usage.ts](../scripts/check-window-usage.ts):99–117の`lstat`境界は参考になる。inventoryの既存分類対象を維持しつつ、別用途の訓練データ読込まで置き換えない。JS構文検査は対象とCommonJS／ESMの解析方法も明示する。
- **完了条件・検証**: 外部ディレクトリへのjunction、循環リンク、大容量風fixture、凍結資料、同名の通常sourceディレクトリを含む小さい仮設ツリーで境界を確認。`test/scripts.inventory-js-legacy.test.ts`の除外位置の意味を維持し、リンク先を読まないこと、対象fileの検査漏れ・重複がないことを追加検証する。現在の危険なscannerを実repoへ試走しない。

### R22 — 型検査抑制のguardを実際のsource範囲へ合わせる

- **根拠**: [check-ts-migration-safety.ts](../scripts/check-ts-migration-safety.ts):6–19は`shared/`、`constants/`、`browser-vite/`等を対象に含めず、:49–52は先頭6行しか見ない。[check-refactor-safety.ts](../scripts/check-refactor-safety.ts):17–21には撤去済みの3件の許可が残る。[負債文書](refactor-boundary-debt.md):13,104–112は許可0件を説明している。
- **解決**: R21の安全な列挙を利用し、canonical TSとテストの対象を明示する。TypeScriptが有効と認識する先頭コメント領域のdirectiveを行数上限なしで検出する。許可表は空の単一方針へ合わせ、source文字列中の説明をdirectiveと誤認しない。
- **完了条件・検証**: 長いheader、BOM／shebang、各対象root、新規抑制、コメント内の単なる言及を合成fixtureで検証する専用テストを新設する。既存高リスク3件は後続のmigration検査でも守られているため、「3件の抑制が現在すべて通過する」とは主張しない。

### R23 — 実行されないタイマーのテストを正しく登録する

- **根拠**: [workers.match-worker-turn-timer-helpers.test.ts](../test/workers.match-worker-turn-timer-helpers.test.ts):5–20でhelperがreturnした後、:22–35に`test(...)`がある。このroom固有の制限時間を確認するテストは登録されない。
- **解決**: 当該testを`describe`配下へ移し、fixture helperにはfixture生成だけを残す。同種の到達不能登録が周辺のテスト補助関数にないかを構文確認する。
- **完了条件・検証**: 制限時間3秒のpaused／active／publicの試験が実際に列挙・実行され、誤った固定120秒実装なら失敗する。R18のタイマー抽出より先に直す。スキップや単なる総件数の変更で代替しない。

### R24 — ファイルプレビューの無効な引数を解消する

- **根拠**: [preview-file.ts](../scripts/preview-file.ts):12–14,29は`--threshold`を受理・説明するが、:61以降は512KiBの固定上限しか使わない。`THRESHOLD_MB`は表示方法に影響しない。
- **解決**: 既存の安全な自動全文表示上限512KiBを維持し、指定thresholdと上限の小さい方を切替境界として使う。helpに上限を明記する。`--bytes`とthresholdの非数・負数等を入口で拒否する。巨大ファイル全文表示の既定化はしない。
- **完了条件・検証**: 小さなfixtureと入出力mockで指定閾値の前後、固定上限、`--full`明示、binaryを確認するCLIテストを新設する。[大容量ファイルガイド](LARGE_FILES.md)の説明を必要箇所だけ合わせる。

## 5. 実装フェーズと依存関係

一括置換せず、以下の順で小さな完了単位を作る。各フェーズの担当者は本表の状態と検証結果を更新する。並行化する場合も、同じファイル・生成物を同時に編集しない。

| Phase | 作業 | 対象 | 次へ進む条件 | 状態 |
| --- | --- | --- | --- | --- |
| 0 | 最新の作業状態・呼出・仕様を再確認し、問題を検出するfixtureを先に作る | 全項目 | 既存変更と今回分が分離され、未確認の仕様差が明示されている | 完了（9.0） |
| 1 | 検査自体の安全性と有効性を整える | R21→R22、R23、R20 | リンク先非追跡、抑制検出、未登録テスト修正、生成と検査の分離を検証 | 完了（9.1） |
| 2 | 通信の所有権と個人画像保存の確定境界を直す | R01→R02→R03、R04 | 旧処理・中断・失敗の回帰が成功し、通常操作が維持される | 完了（9.2、実画面確認は Phase 6） |
| 3 | CPU評価・訓練の再現性と隔離を直す | R07、R09＋R10、R11→R12→R08 | 同じ判断方針、正しい再利用、全証跡、隔離された実bundleを確認 | 未着手 |
| 4 | ゲーム規則を一つの実装へ集約する | R13→R14→R16、R15、最後にR17 | ルール結果・PRNG・pending・演出順が変わらず、旧本体が残らない | 未着手 |
| 5 | 残る画面同期・サーバー共通規則・保守CLIを整理 | R05、R06、R18、R19、R24 | 各項目の完了条件と横断比較が成功 | 未着手 |
| 6 | 統合検証、生成物更新、通常配信、文書更新 | 全項目 | 下記の最終完了条件を全て満たす | 未着手 |

### 依存と実装上の判断

- R01〜R03は同じsession contextを扱うので、別々の例外フラグを増やさず、一貫した所有権モデルにする。
- R09とR10は同じchunk manifestを使うが、**誤再利用を防ぐこと**と**診断記録を保持すること**を独立した完了条件として扱う。
- R11／R12で対応headと実bundleを確定してからR08の配信mappingへ接続する。訓練や正式評価を回して欠陥を探す順序にはしない。
- R23を先に完了してからR18のタイマーを共通化する。R18はtimer／frame／chatを一度に移動しない。
- R13／R14／R16はカード使用周辺の同じファイルを触る。挙動を確認しながら順に実施する。
- R17の削除判定だけは最新の参照検索を最終前提とする。新しい正当な利用者が見つかった場合は削除せず、役割と隔離先を確認し、本計画の判定を更新する。

## 6. 検証の実行方法

### 各変更単位

1. 各項目で挙げた実在テストを読み、現象を検出する回帰を先に追加／改善する。
2. `npm run test:jest -- --runTestsByPath <関係するテストの実在パス>` で限定実行する。
3. TypeScript変更は `npm run typecheck`。実行入口・生成物へ影響する変更は正本からbuildし、その結果を検査する。Jest成功を型検査成功と混同しない。
4. 失敗時は今回の変更と既存問題を切り分け、原因を直す。assertionの弱体化、fallbackでの成功偽装、診断データ削除で通さない。

### 統合時の検証セット

- **通信**: `npm run test:match:parity`、`npm run test:network:parity`。これらに含まれないR01〜R04、タイマー、chat、identity、journalの限定テストも実行する。
- **ゲーム**: R13〜R17の対象テスト、`check:card-runtime-boundary`、必要な`check:window`、生成されたカードruntimeの同値検査。互換に必要なモジュール欠落時は状態変更前に失敗することも確認する。
- **CPU／訓練**: 上記のmock・小fixtureによるテスト。通常判断とNodeの比較、再開、破損拒否、bundle provenance、root非書換えを確認する。長時間の自己対戦・正式採用試験は本計画の自動実行条件に含めない。
- **生成物**: 既存の`build:vite`／`worker:prepare`で更新し、mirror・Vite entry・module bridgeの対応検査を行う。R20完了後は準備済み検査を使い、不必要な再生成を繰り返さない。
- **全体**: 共有基盤への変更をすべて揃え、必要な生成物を準備してから、最後に`npm test`を1回実行する。`pretest`とR20で変更する準備／検査の関係を明確にし、staleな成果物で成功させない。

### 実ブラウザで確認する操作

| 面 | 操作・期待結果 |
| --- | --- |
| 通常配信 | 8000のVite入口で起動し、対局・カード使用が継続できる。HTTP 200だけで操作成功としない |
| 通信 | 2タブ対戦、再接続、退出→別部屋／別接続先、観戦。旧イベントや旧再送が現sessionへ作用しない |
| 個人画像 | 保存・更新・再読込・削除。失敗時に成功表示せず、既存画像とURL leaseを保持 |
| プロフィール | プロフィール／ネット対戦／ランキングを異なる順で初回表示し、名前変更が一致 |
| 盤面 | 8方向の拡張、zoom／スクロール後の矢印、タッチ相当・キーボード入力が表示と一致 |
| CPU | Lv13のカード→対象→配置、計画不一致時の再判断、通常の入力応答を確認。測定していない強さ向上は主張しない |
| 互換 | R17等が影響するclassic／DOM互換とWorker起動は別途確認。通常Pixiだけの成功で代替しない |

ブラウザ確認の記録にはURL、Vite／classic、Pixi／DOM互換、操作、結果を残す。実装時の最終ソースで`npm run build:vite`を実行し、8000の所有プロセス・継続稼働・HTTP 200を作業規約に従って確認する。本番Workerの公開は別の明示依頼がない限り行わない。

## 7. 今回採用しない整理案

- `.ts`／`.js`の併存、`dist/`、Worker mirror、生成catalogは、それだけで重複ではない。生成物を手編集しない。
- `game/cards/effects/`のfacade、`game/card-effects/`のUI連携、各種一行wrapperは、実処理を委譲している限り撤去対象にしない。
- PixiとDOM互換、Viteとclassic、WorkerとNodeのI/Oは意図した境界。R06／R18は共通規則だけを対象とする。
- Lv10〜Lv13の探索・評価、通常オセロ用エンジン、凍結した相手、研究用Python trainerは目的が異なる。似ていることだけを理由に統合しない。
- 長いselfplay-runner・parser・ネットワークfacadeの全面分割、全`any`除去、catchの一括削除、全資料の移動は根拠不足／範囲過大のため行わない。
- 旧CPU fallback、表示名の別表、特殊な不正入力等は実利用経路・防御の確認が不足しているものがあり、確定不具合には計上しない。
- 既存モデル、凍結資料、履歴・未追跡ファイルを「整理」の名目で削除しない。

## 8. 最終完了条件

- [ ] R01〜R24について、変更箇所・回帰テスト・結果が記録され、全項目の完了条件を満たしている。
- [ ] 不具合修正と挙動維持の整理が区別され、カード仕様・公開情報・PRNG・CPU採用方針を無断で変えていない。
- [ ] 二重管理の旧本体や到達不能分岐を残さず、必要な互換adapterだけが残っている。
- [ ] 再開データ・診断証跡・通常配信用モデル・個人保存を、失敗や中断時にも破壊しない。
- [ ] 変更対象に応じた限定テスト、型検査、parity、生成物検査、全体検査、実画面確認が成功している。未確認を成功扱いしていない。
- [ ] 安定した所有者・runtime契約は`architecture-contracts.md`へ反映し、本計画だけを新しい正本にしていない。現行参照の説明も実際のコマンドと一致する。
- [ ] 実装作業では通常配信へ反映し、作業規約に従って今回分だけを記録・バックアップする。既存の別作業を巻き込まない。

各フェーズで問題が出た場合は、その変更を新しい編集で修正する。履歴の巻き戻しや作業ツリー破棄を復旧手順にしない。型検査や既存テストの成功だけで、本計画の未実装項目を完了へ変更しない。

## 9. 実装記録

各項目の「旧実装で失敗」は、正本ソースだけを着手時点（`348683e82`）の内容へ一時的に戻し、`dist/` を再生成して同じテストを実行した結果（確認後に現行ソースへ戻して再生成）。

### 9.0 着手時の確認（Phase 0）

- 作業 worktree（`Kansoku111/りふぁ`）は開始時に未コミット変更なし。本体 checkout の別作業（ストーリーHTML、`data/models/model-assets.json`）と、本計画書（本体では未追跡）は触っていない。本計画書はこの worktree へ複製して記録している。
- 8000 は本体 `F:\Desktop\othello_v2` の `serve-with-fallback`（PID 9900、親 36808）が配信中で HTTP 200。停止していない。
- 日本語を含む worktree パスでは `build-vite-module-bridge.js`・`vite build`・`prepare-worker-assets.js` が異常終了（0xC0000409）する既知の環境問題を再確認した。配信物の生成と mirror 検査は英字パスの書き出しで行う（Phase 6）。
- 前提の変化: R02 の「接続先変更」は、`setServerUrl` が在室中は拒否するため、実経路は「退出 → 接続先変更 → 新しい部屋」である。回帰テストはこの実経路と、transport 単体での待機中切替の両方で作った。

### 9.1 Phase 1（検査ツール）

- **R23**: `test/workers.match-worker-turn-timer-helpers.test.ts` の room 固有制限時間テストを `describe` 配下へ移した。登録テスト数 3→4。`resolveLimitSeconds` を固定 120 秒にする一時変異で当該テストが失敗することを確認。全テストディレクトリ（`test/`、`tests/`、`training/tests/`）を TypeScript 構文木で走査し、`return`/`throw` の後に置かれた `test`/`describe` 等の登録が他に無いことを確認した。
- **R21**: `scripts/lib/source-file-walk.ts` を新設（子リンク・junction を辿らない、実ディレクトリは一度だけ訪問、開始点の重複を許容）。`inventory-js-legacy.ts` は root を一巡する方式へ変更し、既存の除外位置（`output/battle-package`、`output/godot-source-*`、`data/cpu-lv10/baseline-v1`、`data/cpu-lv11〜13`、`data/runs`）に `othello-ai/data` を加えた。`check-js-syntax.ts` は生成物・外部データを除外し、`.js`/`.cjs` を CommonJS（Node の関数ラッパー）、`.mjs` を `node --check` で解析すると明示。新設 `test/scripts.source-file-walk.test.ts` は外部への junction、root への循環 junction、凍結資料、同名の通常 source ディレクトリ、大きい生成物を含む仮設ツリーで、リンク先を読まないこと・重複/漏れが無いことを検証（3件成功）。この worktree（リンクは node_modules のみ）で新旧 inventory の出力が完全一致することを確認した。
- **R22**: `scripts/lib/ts-nocheck-directive.ts` を新設（先頭コメント領域の単一行コメントだけを対象に、BOM/shebang 後・行数上限なしで検出し、最終判定は TypeScript の `checkJsDirective` に委ねる）。`check-ts-migration-safety.ts` の対象を tsconfig の canonical root 全体（`browser-vite/`、`constants/`、`shared/`、`othello-ai/` 等）、`test/`・`tests/`・`training/`、root 直下 `*.ts` へ拡張。`check-refactor-safety.ts` の撤去済み3件の許可を空にし、文字列中の言及を誤認しない共通判定へ変更。新設 `test/scripts.ts-migration-safety.test.ts`（長いヘッダー、BOM、shebang、ブロックコメント、文字列・後続コメント中の言及、`@ts-check` による再有効化、各 root、重複、古い許可）15件成功。実 repo では 2,285 ファイルを走査し未許可 0。
- **R20**: `checkall` を「準備（`tsc -p tsconfig.build.json` を一度）」と「準備済み snapshot への読み取り専用検査」に分離。`run-all-checks.ts` はビルドを含む npm script（`check:artifact-retention`、`check:worker-mirror`）を呼ばず、`dist/scripts/check-artifact-retention.js`・`check-worker-mirror.js` と、配信入口の鮮度検査 `build-vite-entry.js --check` を直接実行する。`check:worker-mirror` は `node dist/scripts/check-worker-mirror.js` のみ（ビルドしない）。準備済みツリー用に `checkall:prepared`（compile を省き、`tsconfig.build.json` の全 source が `dist/` より新しければ fail-fast）を追加し、CI の check job を `worker:prepare && checkall:prepared` に変更。`test/scripts.check-worker-mirror.test.ts` で検査前後の root/mirror の内容と mtime 不変、古い mirror が修復されず拒否されることを確認。`test/checkall.hermetic-bootstrap.test.ts` で prepared の spawn 回数（runner のみ1回）・stale 時に spawn 0 回で失敗、`test/checkall.dependency-boundary-wiring.test.ts` で runner が呼ぶ npm script にビルド手順が無いことを確認。設計資料 §11、作業規約のコマンド説明、`refactor-boundary-debt.md` を同時更新。
- **R24**: `scripts/preview-file.ts` をテスト可能な `runPreviewFile` に分け、`--threshold`（MB）と 512 KiB 上限の小さい方を全文表示の境界に使うよう修正。`--full` は閾値に関係なく全文、`--bytes`・`--threshold` の非数・負数・値欠落・未知オプションは読込前に拒否。help に上限を明記。新設 `test/scripts.preview-file.test.ts` 15件成功。`docs/LARGE_FILES.md` を更新。
- 実 repo での実行: `check-ts-migration-safety`・`check-refactor-safety`・`check-js-syntax`（594 ファイル）・`inventory-js-legacy` いずれも成功。`checkall:prepared` 全体の実行は Phase 6 の書き出しで行う。

### 9.2 Phase 2（通信・個人画像）

- **R01**: `ui/network/stream-session.ts` で、stream instance・session epoch・部屋の確認を transport の parser（カーソル記録・活動通知を含む）より前へ移した。snapshot/presence/chat/heartbeat/transport-health/onmessage の全経路に適用。`test/ui.network-stream-session.test.ts` に、実 transport parser と実 reconnect controller を組み合わせた回帰（同室再接続・別室切替・退出後の旧 callback でカーソル・活動通知・復旧状態・盤面・session 状態が不変、現行 stream は従来通り適用）を追加。旧実装で 3件失敗。
- **R02**: `publish-flow.ts` が送信開始時に接続先を固定した不変の request context（`serverUrl`・所有確認）を作り、初回・version 衝突再送の両方で transport へ渡す。transport は全試行を固定先へ送り、再送前と待機復帰時に所有 session を確認、外れていれば送信せず `cancelled` を返す（publish-flow は stale として破棄）。退出時は `cancelPendingPublishRetries()` で未送信の再送待ちを即時中止。送信済み POST は中断せず「取り消せた」とは扱わない。`requestJson` はタイムアウトと取消を区別（`REQUEST_TIMEOUT`/`REQUEST_CANCELLED`、名前は従来の `AbortError` を維持）し、取消は publish・state sync の一般的な再試行対象にしない。回帰: `test/ui.network-transport.test.ts`（固定先・待機中切替で送信1回のみ・同一 session の再送は同一 operationId・退出中止・タイムアウト再試行/取消非再試行）、`test/ui.network-publish-flow.contract.test.ts`、`test/ui.network-client.leave-room-cleanup.test.ts`（再送待ち中の退出）、`test/ui.network-client.publish-base-version.test.ts`（再送待ち中に退出→接続先 B→新しい部屋で、旧 payload の B への送信 0 回）。統合2件は旧実装で失敗。
- **R03**: `reconnect-controller.ts` の復旧処理に世代付きの実行権を導入。開始・成功/失敗の報告・in-flight フラグの解除は現在の所有者だけが行い、`closeStream()` は実行中の復旧を無効化する。`turn-timer.ts` の `heartbeatResyncInFlight` 無条件解除も、所有者以外の解除になるため撤去した。`test/ui.network-reconnect-controller.test.ts` に deferred で完了順を逆転させた回帰（close 後の旧処理完了で新処理のフラグが外れない・3本目が始まらない、旧処理の成功/失敗を新 session へ報告しない、現行処理は従来通り報告）を追加。旧実装で 3件失敗。
- **R04**: `ui/custom-skin/storage.ts` に共通の書込 transaction helper を作り、complete/error/abort を購読して commit 後だけ resolve。put/delete とも request 成功だけでは成功扱いにせず、失敗時はキャッシュ・object URL・通知・保存済みデータを変更しない。fake DB（`test/helpers/fake-custom-skin-browser.ts`）を transaction 単位の staging と complete/abort/request-error/pending を再現できる形に更新。`test/ui.custom-skin-object-url-lease.test.ts`（request 成功後 abort で保存データ・表示・lease 保持、初回保存失敗・削除失敗、commit まで未解決）と `test/ui.custom-skin-controller.test.ts`（abort 時に「保存しました」を出さず選択も保存しない）を追加。旧実装で 4件失敗。実ブラウザでの保存→再読込→削除は Phase 6 で確認する。
- 検証: 上記限定テスト、`npm run typecheck` 成功、`npm run test:network:parity` 36 スイート・601件成功、`npm run test:match:parity` 11 スイート・164件成功。
