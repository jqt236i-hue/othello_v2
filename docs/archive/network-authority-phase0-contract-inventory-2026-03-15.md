# ネット対戦 authority 再配置 Phase 0 契約棚卸し

作成日: 2026-03-15
親計画: 整理済み
状態: Phase 0 初回棚卸し完了

## 0. この文書の役割

- この文書は、旧 authority 再配置計画の Phase 0 棚卸し実装物である。
- 目的は、現行 network mode がどの field を publish し、server が何を検証し、どこで local server と worker の契約が分岐しているかを固定することにある。
- 以後の Phase 1 以降は、この棚卸し結果を前提に authority 共通化と command publish 化を進める。

## 1. 対象正本

- client publish 入口: [ui/network-client.js](..\..\ui\network-client.js)
- client snapshot apply / publish snapshot 生成: [ui/network/snapshot.js](..\..\ui\network\snapshot.js)
- local backend: [scripts/local-match-server.js](..\..\scripts\local-match-server.js)
- production backend: [workers/match-worker.mjs](..\..\workers\match-worker.mjs)
- 現行 smoke 契約: [scripts/match-network-smoke.js](..\..\scripts\match-network-smoke.js)

## 2. 現行 publish contract

### 2.1 client から送っている payload

client は [ui/network-client.js](..\..\ui\network-client.js) の publishSnapshot(...) で次の payload を送る。

```json
{
  "roomId": "ABC",
  "seatKey": "black",
  "seatToken": "...",
  "playerKey": "black",
  "actionType": "place",
  "playbackEvents": [],
  "operationId": "op_black_000001",
  "baseVersion": 12,
  "snapshot": {
    "gameState": { "...": true },
    "cardState": { "...": true }
  }
}
```

publish 用 snapshot は [ui/network/snapshot.js](..\..\ui\network\snapshot.js) で current global gameState / cardState を clone して作られる。つまり現行 contract は command publish ではなく next snapshot publish である。

### 2.2 field ごとの責務

| field | 現在の送信元 | 現在の役割 | 現状の問題 | Phase 1 以降の扱い |
| --- | --- | --- | --- | --- |
| roomId | client | 対象 room 指定 | 問題なし | 維持 |
| seatKey | client | 座席名申告 | playerKey と二重表現 | 維持。ただし seat identity の意味を固定 |
| seatToken | client | 座席認証 | local/worker とも必要だが state/stream では差がある | 維持 |
| playerKey | client | 操作主体申告 | seatKey と二重表現 | 維持。ただし actor 概念へ整理候補 |
| baseVersion | client | optimistic concurrency | 問題なし | 維持 |
| operationId | client | publish 単位の追跡 | local server では未使用、worker では idempotency に使用 | 維持 |
| actionType | client | 行動種別のヒント | 任意文字列を通せる。worker だけ reset_game を特別扱い | 整理対象 |
| snapshot | client | canonical next state の持ち込み | authority 分散の主因 | 互換層を経て縮退対象 |
| playbackEvents | client | 演出イベント持ち込み | server 派生物であるべきものを client が持ち込んでいる | 互換層を経て縮退対象 |

## 3. client 内の責務分散

### 3.1 publish 直前の client 責務

- snapshot を自前で組み立てる
- playbackEvents を sanitize して送る
- operationId を発行して tracked publish を作る
- baseVersion を現在の local stateVersion から取る

現状では client が「次状態」と「演出イベント」の両方を publish 入力として持っている。この時点で authority が server 専任ではない。

### 3.2 snapshot apply 側の client 責務

- remote snapshot を gameState / cardState に差し替える
- local presentation queue を保存 / 復元 / 破棄する
- busy flag を維持 / 解除する
- self-originated stream snapshot では playback を suppress する

つまり client は authoritative state apply と presentation queue 調停を同じ入口で扱っている。これは Phase 4 で切り離す対象である。

## 4. local server と worker の publish 差分

| 観点 | local server | worker | 結論 |
| --- | --- | --- | --- |
| seatToken 検証 | あり | あり | 一見同じだが state/stream では差が出る |
| baseVersion 検証 | あり | あり | 共通化候補 |
| turn ownership 検証 | あり | あり | 共通化候補 |
| operationId idempotency | なし | あり | worker だけ強い |
| snapshot 必須 | 常に必須 | reset_game 系を除き必須 | rematch で差がある |
| hidden hand validation | なし | validatePublishedHands(...) あり | worker だけ強い |
| hidden hand rehydrate | なし | rehydrateSnapshotForPublish(...) あり | worker だけ強い |
| turn-start reconcile | なし | reconcileTurnStartIfNeeded(...) あり | worker だけ強い |
| turn timer 更新 | なし | あり | worker だけ強い |
| publish success response | seats + snapshot + stateVersion | seats + seatNames + roomDeck + snapshot + turnTimer + serverTime + stateVersion | response 契約差あり |

### 4.1 publish reject response の差分

| 観点 | local server | worker |
| --- | --- | --- |
| seatNames 同梱 | なし | あり |
| turnTimer 同梱 | なし | あり |
| serverTime 同梱 | なし | あり |
| viewer-specific snapshot | なし | seatKey を使って projection |

## 5. state endpoint の差分

| 観点 | local server | worker | 結論 |
| --- | --- | --- | --- |
| seatToken 必須 | 不要 | 必須 | 契約差が大きい |
| seatKey 必須 | 不要 | 不要（あれば viewer 明示に使う） | 認証の本体は seatToken |
| hidden hand projection | なし | あり | local は再現価値が低い |
| seatNames | なし | あり | worker 側のみ |
| roomDeck | なし | あり | worker 側のみ |
| turnTimer | なし | あり | worker 側のみ |
| serverTime | なし | あり | worker 側のみ |

現行 smoke script でも [scripts/match-network-smoke.js](..\..\scripts\match-network-smoke.js) は worker 契約寄りの確認をしており、local server の state 契約は本番相当に揃っていない。

## 6. stream endpoint の差分

| 観点 | local server | worker | 結論 |
| --- | --- | --- | --- |
| 認証 | roomId だけで接続可能 | seatToken 必須 | 契約差が大きい |
| viewer projection | なし | seatKey ごとにあり | worker が正本 |
| snapshot event id | なし | あり | worker が強い |
| heartbeat | なし | あり | worker が強い |
| initial snapshot payload | seats + snapshot + playbackEvents | seats + seatNames + roomDeck + snapshot + turnTimer + serverTime + playbackEvents + operationId/playerKey/actionType nullable | worker が強い |
| chat history payload | seats + messages | seats + seatNames + roomDeck + messages | worker が強い |

## 7. actionType 棚卸し

### 7.1 client publish 側で現実に使われている actionType

| actionType | 主な送信元 | 現状の意味 | 現状で server が本当に使っている入力 |
| --- | --- | --- | --- |
| place | [game/move-executor.js](..\..\game\move-executor.js), [game/card-effects/selection-flow.js](..\..\game\card-effects\selection-flow.js), [game/cpu-decision.js](..\..\game\cpu-decision.js) | 盤面配置、selection 確定、movement handoff を含む広い意味 | ほぼ snapshot 本体 |
| pass | [game/pass-handler.js](..\..\game\pass-handler.js) | パス | ほぼ snapshot 本体 |
| use_card | [ui/network-client.js](..\..\ui\network-client.js) の action bridge 経由 | card use の通知 | ほぼ snapshot 本体 |
| reset_game | [ui/network-client.js](..\..\ui\network-client.js) | rematch/reset | worker は actionType だけで special-case、local は snapshot 必須 |
| action | [ui/network-client.js](..\..\ui\network-client.js) fallback | action.type が無い時の曖昧な fallback | 任意文字列で意味が弱い |
| smoke_condemn_projection | [scripts/match-network-smoke.js](..\..\scripts\match-network-smoke.js) | smoke 用の検証ラベル | 任意文字列としてそのまま通る |

### 7.2 server 側が emit している actionType

| actionType | 送信元 | 用途 |
| --- | --- | --- |
| timeout_pass | [workers/match-worker.mjs](..\..\workers\match-worker.mjs) | turn timer timeout を snapshot event として通知 |
| join_room | [workers/match-worker.mjs](..\..\workers\match-worker.mjs) | rebased initial snapshot を stream へ通知 |

### 7.3 Phase 0 時点の結論

- 現状の actionType は command schema ではなく「文字列ラベル」に近い。
- server 側で本当に必要な semantic input は actionType ではなく snapshot に埋まっている。
- reset_game だけ worker が先に command 的 special-case を持ち、local server は追随していない。
- Phase 2 では actionType を任意文字列のまま延命せず、command schema に再定義する必要がある。

## 8. keep と deprecate の切り分け

### 8.1 互換維持で残す field

- roomId
- seatKey
- seatToken
- playerKey
- baseVersion
- operationId

### 8.2 互換層を経て縮退させる field

- snapshot
- client-authored playbackEvents
- 任意文字列の actionType
- action bridge の fallback action

### 8.3 server-owned output に寄せる field

- snapshot
- playbackEvents
- stateVersion
- seatNames
- roomDeck
- turnTimer
- serverTime

## 9. Phase 1 への引き継ぎ

- local server と worker の publish validation 契約を先に揃える。
- local server に operationId idempotency、seatToken 必須の state/stream、viewer projection を入れる方向で進める。
- worker にしかない rehydrate / reconcile を helper 化できる粒度まで分解する。
- client 側はまだ command publish に切り替えない。Phase 1 では authority 共通化を先にやる。

## 10. Phase 0 完了判定

- 現行 publish payload の項目が固定された。
- local server と worker の publish/state/stream 差分が表になった。
- actionType ごとの現状 input 依存が整理された。
- 何を残し、何を縮退させるかを次フェーズへ渡せる状態になった。

