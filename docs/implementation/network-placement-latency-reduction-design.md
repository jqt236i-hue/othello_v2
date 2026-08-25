# ネット対戦・通常配置の待ち時間短縮 設計

## 文書の役割

この文書は、ネット対戦で通常配置をクリックしてから石が見えるまでの待ち時間を短くする実装設計である。プレイヤー向け表示仕様の正本は `01-rulebook.md`、ネットワークと描画の内部契約は `docs/architecture-contracts.md` とする。

## 問題と目標

現状はクリック直後に水色の送信中リングだけを表示し、サーバー確定フレームの再生まで石を表示しない。さらに Worker は確定状態を保存した後も、接続中の全 SSE writer への送信完了を待ってから配置した本人へ HTTP 応答を返す。遅い接続がある場合、通常配置の応答が SSE writer の最大待機時間まで引き延ばされる。

目標は次の2点である。

1. 通常配置を送信した瞬間、操作した本人の盤面だけに所有者色の半透明な未確定仮石を表示する。
2. サーバー保存が成功した後は、SSE 配信完了を待たずに配置した本人へ確定応答を返す。

## 範囲

- 通常配置のローカル送信中表示
- 仮石の Pixi / DOM 互換表示
- 仮石の operationId・room・session による寿命管理
- accepted publish の保存後 SSE fanout を HTTP 応答の待機対象から外す
- Worker と local server の同じ外部動作
- 表示仕様、契約テスト、ブラウザ成果物、Worker mirror の同期

## 非目標

- ブラウザ状態による先行ルール判定や canonical state の変更
- サーバー検証、盤面効果、projection、永続保存の省略
- 確定演出の順序、速度、効果音、入力再開条件の変更
- pending target selection やカード使用の仮石表示
- 公開環境へのデプロイ

## 現行構造

- `ui/network/action-bridge.ts` は通常配置をローカル実行せず publish へ渡す。
- `ui/network/placement-feedback.ts` は対象マスに presentation-only の preview hint を置く。
- `ui/board-visual/controller.ts` 以下が Single Visual Writer として preview を Pixi または DOM 互換 backend に描画する。
- `utils/match-publish-controller.ts` は accepted transition を組み立て、SSE replay buffer を含む room を保存してから snapshot を broadcast する。
- `workers/match-worker-broadcast-controller.ts` の prepared snapshot は viewer 別 payload と eventId を送信前に固定している。
- `ui/network/intake-coordinator.ts` が受信局面と確定フレームの検証・受理を所有する。

## 選択肢

### ブラウザで盤面を先行更新する

体感は最短になるが、特殊石、反転、ランダム効果、version conflict までブラウザで巻き戻す必要があり、server authority と Single Visual Writer を弱めるため採用しない。

### 送信中リングだけを強調する

安全だが、クリックから石が見えるまでの問題を解決しない。

### 半透明の仮石と保存後 fanout の非待機を組み合わせる

canonical state を変えずに即時反応を作り、遅い SSE writer が本人の HTTP 応答を止める問題も除ける。既存の preview、canonical intake、prepared broadcast を再利用できるため採用する。

## 採用設計

### 1. 仮石は presentation-only overlay とする

placement feedback hint に `owner: black | white` を加える。盤面モデルはこれを `networkPendingPlacementOwner` としてセル interaction に投影し、Pixi と DOM 互換 backend が半透明の石を描く。

仮石は canonical board、stone、marker、playback event、効果音にしない。相手と観戦者へ送信せず、操作したブラウザだけに存在する。

### 2. 仮石は検証済み canonical intake まで保持する

`ui/network-client.ts` は raw envelope を placement feedback へ渡して先に消さない。先に `NetworkIntakeCoordinator.submit()` で room、snapshot、frame、version を検証・受理し、その戻り値が snapshot 適用、frame enqueue、board refresh、同一操作の重複受理のいずれかを示し、かつ room・session・operationId が送信中の操作と一致するときだけ仮石を消す。これにより通信待ちの仮石から、直ちに開始する確定 timeline または確定盤面 refresh へ引き継ぐ。

拒否、通信開始失敗、session 変更、退出、runtime integrity failure は即時消去する。publish response は canonical intake を内部で完了した後に accepted result を返すため、action bridge の accepted settlement は予備の no-op とし、raw response だけを根拠に消さない。古い受信は token、roomId、sessionEpoch、operationId の一致を再確認し、新しい仮石を消さない。

### 3. accepted publish は保存後に応答可能とする

accepted transition では、viewer 別 snapshot、presentation frame、SSE replay record をすべて組み立てて room に stage し、`saveRoom()` を成功させる。ここまでは HTTP 成功応答の必須条件として維持する。

保存後の `broadcastSnapshot()` は直ちに開始して writer queue の順序を確保するが、その完了は HTTP response の待機条件にしない。Worker と local server は開始済み Promise の予期しない controller rejection だけを observer で処理して未処理 rejection にしない。個別 writer の失敗・timeout は既存 `sendSse()` がその stream を閉じて処理するため、この observer の検知対象ではない。受信できなかった client は保存済み SSE replay buffer または `/api/match/state` で回復できる。

### 4. 順序と競合

- prepared snapshot は次の publish が room を変更する前に固定する。
- 各 broadcast は `writer.write()` を publish 順に開始する。同一 writer への連続 publish でも eventId の開始順を逆転させない。
- HTTP response と self-SSE の到着順は既存 intake coordinator が stateVersion と operationId で処理する。
- idempotent replay は保存済み operation と frame を返し、再 mutation・再 version increment を行わない。

## 互換性と失敗時動作

- preview hint の `owner` は省略可能とし、古い caller は従来のリング表示へフォールバックする。
- deferral hook を供給しない controller 利用者は従来どおり broadcast 完了を await する。
- visualSeq がない accepted response でも、検証済み snapshot intake または board refresh への引継ぎ後に仮表示を消す。
- 保存失敗時は accepted response を返さず、仮石を拒否経路で消す。
- broadcast の遅延・失敗は accepted state を取り消さない。保存済み recovery artifact が authority となる。

## 検証

- placement feedback: owner、検証済み intake での引継ぎ、未検証 envelope の無視、拒否、session 変更、古い操作
- board model: owner が overlay から interaction と retained signature へ入ること
- Pixi / DOM: 黒・白の半透明仮石と消去
- publish controller: save 完了前は応答しない、deferred broadcast 完了は応答を止めない、fallback は従来動作
- stream concurrency: 遅い同一 writer へ2件を連続 publish しても両 HTTP 応答が save 後に返り、eventId の開始順が保たれ、timeout close 後に保存済み replay/state から復旧できる
- network parity、typecheck、browser build、Worker mirror / bundle smoke
- Chrome の classic lane / Pixi backend で通常配置を操作し、クリック直後の仮石、確定置換、console/page error なしを確認

## 完了条件

- 通常配置クリック直後に、操作した本人だけへ所有者色の半透明仮石が見える。
- 仮石は検証済みの確定フレームまたは確定盤面を受け付けるまで残り、その確定表示へ引き継がれる。
- 拒否、退出、session 変更で仮石が残らない。
- accepted state は保存完了前に成功応答されない。
- 遅い SSE writer の完了待ちが accepted HTTP response を遅らせない。
- Worker/local、response/SSE、stateVersion/operationId、再接続、Single Visual Writer の契約が維持される。

## Self-review

初稿では仮石を raw server response 到着時に消す案と visual settlement 完了まで残す案を検討した。前者は未検証データを信頼し、後者は確定 playback の上へ仮石を重ね続けるため、検証済み canonical intake から確定表示へ引き継ぐ境界へ修正した。また broadcast を保存前に非同期化すると accepted state を失う危険があるため、replay record を含む保存成功までは必ず await し、その後の writer 完了だけを待機対象から外す設計にした。独立レビューで指摘された用語、受理境界、writer エラーの実際の所有者、連続 publish 検証を反映済みである。
