# Network Match Hardening A Design

## 1. Goal

`A` はネット対戦モードの本番 publish 経路にある信頼境界の欠陥を、仕様と実装の両方で小さく安全に締め直すための hardening 単位である。

この design は次の 4 件だけを対象にする。

- `#1` `networkDebugEnabled` / `debug_fill_hand` の公開対戦経路からの遮断
- `#5` local server の oversized body 検知時の即切断
- `#2` `randomFromChars` の modulo bias 修正
- `#3` room password 比較の定数時間化

## 2. Scope

### In scope

- Worker と local server の公開 match API で、クライアント申告をそのまま信じている境界を締める
- 既存 API surface のうち、危険な挙動だけを fail-closed に変える
- parity を保つため、Worker と local server には lockstep の hardening を入れる
- `01-rulebook.md` のネット対戦 debug 記述を、公開機能として誤読されない形へ修正する

### Out of scope

`A` に含まれない `#4/#6〜#13` は今回触らない。

- `#4` SSE 上限
- `#6` 永続化
- `#7` fail-fast / eager load
- `#8` rematch 同意フロー
- `#9` rejoin token 上書き
- `#10` 観戦境界
- `#11` identity GC
- `#12` 入力検証の薄い所
- `#13` debug out-of-turn 禁止

## 3. Design Principles

- 本番 publish 経路は、クライアントが「debug です」と申告しても特権化しない
- shared で閉じる契約は shared へ寄せるが、今回の `#2` は refactor ではなく lockstep hardening とする
- Worker/local/browser/headless の契約差分を増やさない
- 仕様判断が必要な大きい変更は `B` / `C` に送る

## 4. Approaches Considered

### 4.1 `#1` debug capability

#### Option A

`networkDebugEnabled` を署名付き debug 権限つき capability に置き換える。

- 長所: 将来的に安全な debug 運用へ拡張しやすい
- 短所: 新しい認証・署名・セッション設計が必要で、`A` の hardening 範囲を超える

#### Option B

公開ネット対戦では `networkDebugEnabled` をサーバが有効機能として扱わず、`debug_fill_hand` を public publish 経路で常に拒否する。

- 長所: root cause の「クライアント申告を信じる」を最短で止められる
- 長所: Worker/local の両方で同じ fail-closed にできる
- 短所: 既存の公開 debug room テストは runtime/test helper 経路へ移す必要がある

#### Option C

debug UI と payload shaping も含めて全面削除する。

- 長所: 最も強い遮断
- 短所: UI/テスト/既存デバッグ運用への影響が広く、第一弾として大きすぎる

採用: `Option B`

### 4.2 `#2` shared duplication

#### Option A1

`utils/match-authority.ts` と `scripts/local-match-server.ts` の両方を lockstep で rejection sampling 化し、共通化 refactor は行わない。

- 長所: `A` の目的を hardening に限定できる
- 長所: local server の module 構成変更を避けられる

#### Option A2

local server 側の `randomFromChars` を shared 実装へ寄せて 1 箇所化する。

- 長所: 重複を減らせる
- 短所: 目的が hardening から refactor に広がり、検証面も大きくなる

採用: `Option A1`

## 5. Detailed Design

### 5.1 `#1` debug cheat hardening

#### Intended behavior

- 公開ネット対戦の create/join/state/stream/publish では、room 単位 debug capability を公開機能として扱わない
- `POST /api/match/create` で `networkDebugEnabled: true` が送られても、公開対戦 room state には立てない
- `debug_fill_hand` は Worker/local の public publish 経路で常に拒否する
- `rated` だけでなく通常のネット対戦全体で同じ扱いにする
- 既存の local/test/runtime helper 経路は、公開 API とは別レイヤとして維持してよい

#### Concrete code impact

- [workers/match-worker.ts](/C:/Users/quarr/Desktop/othello_v2/workers/match-worker.ts)
  - create path で `networkDebugEnabled` を room capability として保存しない
  - public payload へ `networkDebugEnabled: true` を返さない
- [scripts/local-match-server.ts](/C:/Users/quarr/Desktop/othello_v2/scripts/local-match-server.ts)
  - create path で同じ fail-closed を入れる
  - `debug_fill_hand` publish を公開 API から受理しない
- [shared/match-entry-payload.ts](/C:/Users/quarr/Desktop/othello_v2/shared/match-entry-payload.ts)
  - create payload shaping は後方互換のため field を残すか、常に無視される入力として扱う
  - `A` では field 削除までは行わない
- [01-rulebook.md](/C:/Users/quarr/Desktop/othello_v2/01-rulebook.md)
  - `ネット対戦` の `デバッグモード有効化` / `DEBUG` に関する記述を、server-authoritative な公開機能ではない形へ修正する

#### Behavior intentionally not changed in `A`

- debug UI の全面撤去
- テスト専用 runtime helper の削除
- signed token を使う新 debug 認証

### 5.2 `#5` oversized body immediate disconnect

#### Intended behavior

- local server は request body が 5MB を超えた時点で、Promise を reject するだけでなく接続を破棄する
- reject 後の追加 chunk を内部バッファへ溜め続けない

#### Concrete code impact

- [scripts/local-match-server.ts](/C:/Users/quarr/Desktop/othello_v2/scripts/local-match-server.ts)
  - `parseBody` の oversize 分岐で `req.destroy(...)` を呼ぶ
  - 二重 reject / end 後処理で例外を増やさないように、destroy 済みフラグまたは一回限りガードを置く

### 5.3 `#2` modulo bias hardening

#### Intended behavior

- `randomFromChars` は `byte % chars.length` を使わず、rejection sampling を使う
- 256 未満の一様な範囲だけを受理し、余りに当たる byte は捨てて引き直す
- room ID / seat token / spectator ID suffix / local player token / recovery code の分布を改善する

#### Concrete code impact

- [utils/match-authority.ts](/C:/Users/quarr/Desktop/othello_v2/utils/match-authority.ts)
  - shared 側 `randomFromChars` を rejection sampling 化
- [scripts/local-match-server.ts](/C:/Users/quarr/Desktop/othello_v2/scripts/local-match-server.ts)
  - local identity 用 `randomFromChars` も同じ algorithm に変更

#### Non-goal

- `A` では両実装の一箇所化は行わない

### 5.4 `#3` constant-time room password compare

#### Intended behavior

- room password 比較は短絡評価の `===` を使わず、長さ一致後に全文字を最後まで比較する
- 空 password room は従来通り open join を許可する

#### Concrete code impact

- [shared/match-room-lobby.ts](/C:/Users/quarr/Desktop/othello_v2/shared/match-room-lobby.ts)
  - `isJoinPasswordAccepted` に shared の定数時間比較 helper を導入する
- Worker/local の join/spectate 経路はこの shared helper をそのまま利用する

## 6. Tests And Verification

`A` は publish/token/input boundary の hardening なので、focused regression と Level 3 parity verification を組み合わせる。

### Focused updates expected

- `#1`
  - create payload に `networkDebugEnabled: true` を入れても公開 room で有効化されないこと
  - `debug_fill_hand` publish が Worker/local の public API で reject されること
  - 既存の debug accepted テストは runtime helper か fail-closed expectation へ更新する
- `#5`
  - oversized body で接続破棄されることを確認する focused test を追加または既存 helper で補強する
- `#2`
  - deterministic な分布テストではなく、reject branch を通る単体テストか helper-level test を優先する
- `#3`
  - 正しい password / 誤った password / empty room の既存 shared test を維持したまま helper 実装を差し替える

### Required verification bundle

- `npx jest` で affected test paths を focused 実行
- `npm run typecheck`
- `npm run build:ts`
- `npm run test:jest`
- `npm run test:network:parity`
- `npm run match:check`
- 必要なら `npm run worker:prepare`

## 7. Risks

- `#1` は既存 debug accepted テストが多数落ちる可能性があるため、公開 API と test/runtime helper の線引きを崩さずに直す必要がある
- `#2` の rejection sampling 実装を誤ると、短い charset では無限ループや偏った draw が起こりうる
- `#5` は request destroy の入れ方を誤ると、通常 request の parse 完了や既存エラーハンドリングを壊す可能性がある
- `#3` は shared helper 化することで Worker/local の join 経路全体へ波及するため、shared test を起点に確認する

## 8. Spec Impact

- [01-rulebook.md](/C:/Users/quarr/Desktop/othello_v2/01-rulebook.md) は `ネット対戦` の debug 記述を更新対象にする
- `正本/` は player-visible gameplay 変更ではないため、`A` 単独では通常不要
- [docs/architecture-contracts.md](/C:/Users/quarr/Desktop/othello_v2/docs/architecture-contracts.md) は stable internal contract が増える場合だけ更新を検討するが、`A` では必須ではない

## 9. Implementation Order

推奨順は次の通り。

1. `#1` debug cheat 遮断
2. `#5` oversized body 即切断
3. `#2` modulo bias 修正
4. `#3` password 比較の定数時間化

この順なら、最も実害の高い exploit を先に止めつつ、各修正の focused verification を段階的に積める。
