# ネット対戦の入力再開・終局表示順 修正設計

- Status: complete / deployed
- Date: 2026-07-25
- Scope: ネット対戦のカード対象選択、先行盤面クリック、演出後の入力再開、終局結果表示、強制状態同期
- Source of truth: `01-rulebook.md`、`正本/カード仕様正本.md`、`正本/演出正本.md`、`docs/architecture-contracts.md`、root `AGENTS.md`

## 1. 結論

ネット対戦の canonical state は従来どおりサーバーを権威とし、クライアント入力と終局結果の表示だけを、その snapshot に対応する visual settlement の後へ揃える。

初回修正で3つのクライアント側契約漏れを修正したが、strict timeline と session lifecycle の追加監査で次の根因が残っていることを確認した。

1. canonical intake は `presentationFrames` を snapshot apply options から外すため、旧 `playbackEvents` の deferred result だけでは strict frame 経路を待てない。
2. pending settlement は既定1,500msの timeout 結果を成功として扱い、実演出が2,000〜3,000msの場合でも playback/busy を強制解除できる。
3. selection flow の generic idle wait は演出開始を250msだけ観測し、通信・端末負荷で開始が遅れると authoritative settlement 前に完了する。
4. active room 中も server URL を変更でき、既存 SSE と次の HTTP publish の接続先が分離できる。
5. create の guard は HTTP 完了時に外れ、join/spectate は guard を持たない。timeline dispose 後の epoch 再検証もないため、古い応答が session を有効化できる。
6. room-list refresh に世代管理がなく、古い応答が新しい一覧を上書きできる。
7. 保存済み session の自動復帰が room-entry single-flight を通らず、手動 create/join/spectate と競合して古い room を有効化できる。
8. network move のローカル turn handoff にも終局表示経路が残り、authoritative snapshot より先に結果を表示できる。

## 2. 確認できた事実

### 2.1 破壊の意志と拡張マス

- `01-rulebook.md` と `正本/カード仕様正本.md` は、破壊の意志を「盤面上の石1つ」と定義している。
- `game/logic/cards/selectors.ts` の target 列挙、`game/logic/effects/destroy_one_stone.ts`、`BoardOps.destroyAt` は拡張座標を対象にできる。
- 既存の headless test も拡張マス上の石を破壊対象として扱っている。
- したがって canonical rule の欠落ではなく、演出中の UI 入力 handoff が主因である。

### 2.2 部屋作成

- 2026-07-25 の production 実機確認で、Chrome の画面操作から room create API が 200 を返し、黒席として入室できた。
- Edge は room list から同じ部屋へ白席として入室できた。
- 現時点で部屋作成失敗は再現していないため、根拠のない server contract 変更は行わない。create、list、join の focused test と再度の実機確認で回帰の有無を判定する。

### 2.3 次手番の入力

- production の通常着手では、Chrome 黒の着手後に Edge 白、Edge 白の着手後に Chrome 黒へ合法手と入力権が移ることを確認した。
- 一方、pending selection の契約テストでは全対象カードで playback wait が0回となる失敗を確認した。
- 通常着手そのものと、カード使用・先行クリックを伴う入力再開を分けて検証する。

### 2.4 終局表示

- `finalizeSnapshotPresentation` は playback request を開始した直後に `maybeShowResultFromSnapshot` を呼ぶ。
- `正本/演出正本.md` は、server が受理した演出フレームを順番どおり全て再生し、表示が追いつくまで入力を待機する契約を持つ。
- 終局結果も最終演出より後に表示する。

## 3. 設計

### 3.1 selection signal bridge

`ui/network/selection-signal-bridge.ts` に `waitForPlaybackIdle` port を追加する。呼び出し先は注入値を優先し、なければ同じ runtime root の既存 `waitForPlaybackIdle` を使う。

これにより `ui/network-client.ts` が bridge を再設定しても、`game/card-effects/selection-flow.ts` の既存 playback wait 契約を失わない。game layer は window を探索せず、signal bridge の明示 port だけを使う。

### 3.2 server-authored card use の先行クリック

card-use publish 成功後は、`cards/card-interaction-pending-settlement.ts` に既存の `waitForAuthoritativeVisualPlaybackDrain` を使い、publish response の `visualSeq` が settled するまで待つ。

settlement 後にだけ次を行う。

1. pending busy を解除する。
2. buffered click を1回だけ consume する。
3. 選択表示を解除して board/card UI を同期する。
4. 同じ論理座標を `handleCellClick` へ再投入する。

座標は `Math.trunc` された row/col のまま保持し、`col = -1` などの拡張座標を8x8へ丸めない。

publish 失敗時は従来どおり buffer を破棄し、カード選択を維持して再操作可能にする。

### 3.3 終局結果の authoritative visualSeq settlement

terminal snapshot に strict `presentationFrames` がある場合、canonical state は即時適用する一方、result presentation は対象フレーム末尾の `visualSeq` が成功 settlement を返すまで延期する。

- intake は frame 本体を snapshot playback へ渡さず、`deferResultUntilVisualSeq` という内部 marker だけを渡す。
- snapshot controller は `PlaybackStateManager.waitForNetworkVisualSeq()` を通じて既存 tracker を待つ。
- callback は snapshot version、room ID、session epoch を再検証し、旧 session の Promise が新 session の UI を変更しないようにする。
- frame がない snapshot は即時同期する。
- non-terminal snapshot の result state reset は即時のままとする。
- timeout、reset、missing tracker、reject は結果表示成功へ変換せず、timeline/recovery surface に復旧を委ねる。
- 結果の多重表示防止は既存 `result-overlay.ts` の version token / `terminalResultShown` を利用する。

### 3.4 exact visual rebase

`syncVisualCursorForSnapshotNoPlayback` が成功した state sync は、その cursor まで表示基準を正確に再設定済みである。後続の presentation journal catch-up 条件から除外する。

### 3.5 pending selection settlement

accepted publish が `visualSeq` を返す場合は timeout なしでその exact sequence を待つ。テスト/診断用の明示 timeout が設定された場合も `{ok:false}` を成功へ変換しない。

- success 時に `setPlaybackActive(false)` や `setPlaybackStartedAt(null)` を呼ばない。strict playback owner だけが解放する。
- server-authored card use の buffered click は settlement success 後だけ再投入する。
- reset/failure 時は旧 session の busy/selection/input を書き換えない。
- selection-flow は publish result を explicit signal bridge へ渡して exact `visualSeq` を待ち、250msの generic playback-start wait を network authority として使わない。

### 3.6 session and server URL

create/join/spectate と保存済み session の復帰は共通 room-entry single-flight token を使い、activation 完了まで保持する。identity、HTTP、retry、timeline dispose の各 `await` 後に room ID と session epoch を再検証する。

active room の server URL は `setServerUrl` と lifecycle の両方で変更を拒否する。UI input も active 中は無効化する。room-list refresh は request generation を持ち、最新応答だけを表示する。

### 3.7 network terminal handoff

network publish を伴う着手・カード対象確定では、ローカル turn handoff は結果 overlay を表示しない。publish response の authoritative snapshot を先に適用し、その snapshot が指す exact `visualSeq` の settlement 後にだけ結果を表示する。ローカル対戦では従来どおり、同じ turn handoff が全 playback 完了後に結果を表示する。

## 4. 変更しないもの

- Worker/local server の canonical action validation、snapshot schema、seat token、operation id。
- 破壊の意志のルール、保護・復活などの破壊共通処理。
- Pixi/DOM の Single Visual Writer 境界。
- Worker/local server の room create API 契約。修正対象は client session orchestration のみとする。
- `worker-public/` の既存 deploy mirror 差分。

## 5. 検証方針

- selection bridge が全 deferred target card で playback wait を通ること。
- server-authored card use の早押し座標を settlement 前に再投入せず、settlement 後に一度だけ再投入すること。
- 拡張マスの負座標を buffer/replay/publish で保持すること。
- terminal snapshot の結果を playback settlement 前に表示せず、完了後に一度だけ表示すること。
- strict `presentationFrames` の末尾 `visualSeq` 完了まで結果を表示しないこと。
- timeout/reset が pending busy、buffered click、playback flags を成功解除しないこと。
- selection-flow が accepted publish の exact `visualSeq` を待つこと。
- create/join/spectate/保存済み session 復帰の二重実行と dispose 中の session replacement を拒否すること。
- active room の server URL が list refresh/input change で変わらないこと。
- room-list の逆順応答が新しい一覧を上書きしないこと。
- exact visual rebase が不要な journal fetch に依存しないこと。
- create/list/join、通常の黒→白→黒着手、Pixi writer idle、reload/reconnect を focused test と Chrome/Edge で確認すること。

## 6. 失敗時の扱い

- visual settlement の待機が timeout/reject しても canonical state を巻き戻さず、成功したように入力や結果を開放しない。
- strict timeline が pause した場合は既存 retry/recovery surface から回復し、回復後の exact settlement で結果・入力を進める。
- 入力 buffer は publish failure と session change で破棄し、別 room/turn へ持ち越さない。
- 実機で部屋作成失敗が再現した場合は、HTTP status、reason、room/session epoch を採取して別の server/session defect として切り分ける。

## 7. 実施結果

- selection bridge と server-authoritative publish-only 経路の双方で、authoritative visual settlement を待つようにした。
- server-authored card use の buffered click は、settlement 後に一度だけ再投入する。拡張座標 `(5, -1)` を regression case として固定した。
- terminal snapshot の結果同期を、対応する playback request の完了後へ延期した。
- network move/card selection のローカル turn handoff は結果表示を行わず、authoritative snapshot の exact settlement だけを結果表示の所有者にした。
- exact visual rebase 後の不要な presentation journal catch-up を停止した。
- 保存済み session 復帰を create/join/spectate と同じ single-flight・epoch guard に統合した。
- room create の server contract は変更していない。production とローカル修正版の双方で再現せず、Chrome の画面操作による作成と Edge の部屋一覧からの参加に成功した。
- ローカル修正版の Chrome→Edge 着手はリロードなしで成功し、stateVersion 3→4、console error と page error は両ブラウザとも0件だった。破壊の意志、雷撃、狙撃、ロボット掃除機の server-authoritative reason も両ブラウザで一致した。
- network endgame smoke は5試合すべて version 64、60手＋3パスで終局した。
- Pixi/DOM、classic/Vite、通常/低モーション/noanim の12構成・208シナリオで playback settlement を完了した。
- production `https://card.reversi-0.workers.dev` へ Version ID `2f76061d-b2a1-4be5-9ea5-a1197a8d0333` をdeployした。
- production API の create/join/rejoin/SSE/publish/leave/room cleanup を完了した。
- production の実 Chrome/Edge で同一 room を作成・参加し、UIから黒 `(2,3)`、白 `(2,2)` をリロードなしで着手した。両クライアントは stateVersion 3、次の黒手番、playback/selection idle に一致し、console/page error は0件だった。
- production Worker の別 room を API 操作で終局まで進め、version 64、60手＋3パス、最終 `visualSeq=63` を確認した。

## 8. Self-review

- 初回設計の `playbackEvents` Promise だけでは production の strict `presentationFrames` を覆えない問題を修正し、result gate を authoritative `visualSeq` へ統一した。
- timeout 後に canonical state を維持することと、UIを成功解除することを分離した。canonical state は維持しつつ、visual owner 以外はロックを解除しない。
- session競合は create だけの局所guardでは防げないため、create/join/spectate/保存済み復帰の共通single-flightと各await後のepoch guardへ拡張した。
- network terminal overlay の所有者を authoritative snapshot に一本化し、通常着手とカード確定のローカル handoff に残っていた先行表示も除去した。
- Worker authority、projection、Pixi writer、canonical mutationは変更せず、client intake/session境界に限定した。
