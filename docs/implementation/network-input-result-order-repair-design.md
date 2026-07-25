# ネット対戦の入力再開・終局表示順 修正設計

- Status: implemented
- Date: 2026-07-25
- Scope: ネット対戦のカード対象選択、先行盤面クリック、演出後の入力再開、終局結果表示、強制状態同期
- Source of truth: `01-rulebook.md`、`正本/カード仕様正本.md`、`正本/演出正本.md`、`docs/architecture-contracts.md`、root `AGENTS.md`

## 1. 結論

ネット対戦の canonical state は従来どおりサーバーを権威とし、クライアント入力と終局結果の表示だけを、その snapshot に対応する visual settlement の後へ揃える。

今回の不具合は、次の3つのクライアント側契約漏れが重なっている。

1. `ui/network-client.ts` が pending selection の signal bridge を再設定するとき、bootstrap bridge が持つ `waitForPlaybackIdle` を引き継いでいない。
2. server-authored card use の応答後、演出完了前に先行クリックの座標を buffer から消費して `handleCellClick` へ再投入している。再投入先が演出ロック中だと、負座標を含むクリックが再捕捉されず失われる。
3. `ui/network/snapshot.ts` は playback を開始した直後に終局結果を同期し、playback Promise の settlement より先に結果表示を始めている。

加えて、`syncVisualCursorForSnapshotNoPlayback` による強制同期は presentation cursor をその場で正確に再基準化する契約だが、その後にも presentation journal catch-up を試みている。強制同期を不要な journal 応答へ依存させない。

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

### 3.3 終局結果の deferred presentation

terminal snapshot かつ playback request が実際に開始した場合、`maybeShowResultFromSnapshot` は request の `result` settlement 後に呼ぶ。

- playback がない、または開始できなかった場合は即時同期する。
- non-terminal snapshot の result state reset は即時のままとする。
- Promise が reject しても、playback failure telemetry の後で最終 canonical state の結果は表示する。
- 結果の多重表示防止は既存 `result-overlay.ts` の version token / `terminalResultShown` を利用する。

### 3.4 exact visual rebase

`syncVisualCursorForSnapshotNoPlayback` が成功した state sync は、その cursor まで表示基準を正確に再設定済みである。後続の presentation journal catch-up 条件から除外する。

## 4. 変更しないもの

- Worker/local server の canonical action validation、snapshot schema、seat token、operation id。
- 破壊の意志のルール、保護・復活などの破壊共通処理。
- Pixi/DOM の Single Visual Writer 境界。
- room create API 契約。実機・test で再現しない限り変更しない。
- `worker-public/` の既存 deploy mirror 差分。

## 5. 検証方針

- selection bridge が全 deferred target card で playback wait を通ること。
- server-authored card use の早押し座標を settlement 前に再投入せず、settlement 後に一度だけ再投入すること。
- 拡張マスの負座標を buffer/replay/publish で保持すること。
- terminal snapshot の結果を playback settlement 前に表示せず、完了後に一度だけ表示すること。
- exact visual rebase が不要な journal fetch に依存しないこと。
- create/list/join、通常の黒→白→黒着手、Pixi writer idle、reload/reconnect を focused test と Chrome/Edge で確認すること。

## 6. 失敗時の扱い

- visual settlement の待機が timeout/reject しても canonical state を巻き戻さない。
- 終局結果は playback failure 後でも最終 state から表示し、永続的に隠さない。
- 入力 buffer は publish failure と session change で破棄し、別 room/turn へ持ち越さない。
- 実機で部屋作成失敗が再現した場合は、HTTP status、reason、room/session epoch を採取して別の server/session defect として切り分ける。

## 7. 実施結果

- selection bridge と server-authoritative publish-only 経路の双方で、authoritative visual settlement を待つようにした。
- server-authored card use の buffered click は、settlement 後に一度だけ再投入する。拡張座標 `(5, -1)` を regression case として固定した。
- terminal snapshot の結果同期を、対応する playback request の完了後へ延期した。
- exact visual rebase 後の不要な presentation journal catch-up を停止した。
- room create の server contract は変更していない。production とローカル修正版の双方で再現せず、Chrome の画面操作による作成と Edge の部屋一覧からの参加に成功した。
- ローカル修正版の Chrome→Edge→Chrome 着手はリロードなしで成功し、各 publish は HTTP 200、console/page/request failure は0件だった。
- network endgame smoke は5試合すべて60手で終局し、2クライアント browser E2E は通常着手、再接続、継続を完了した。
