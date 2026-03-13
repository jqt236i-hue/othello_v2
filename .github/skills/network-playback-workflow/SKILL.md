---
name: network-playback-workflow
description: 'network snapshot, reconnect, publish, playback queue の崩れを、この repo の snapshot/presentation 特性に合わせて安全に直すワークフロー。Use when editing ui/network-client.js, ui/network/snapshot.js, session-seat handling, reconnect sync, stale publish rollback, or related network playback tests in this card-othello repository.'
argument-hint: 'network のどこを直したいか。snapshot, reconnect, publish, playback, stale rollback, trap defer のどれかも書く'
---

# Network Playback Workflow

このスキルは、このリポジトリで network 同期と playback の噛み合わせを安全に直すための実務手順です。

## When to Use

- reconnect 後に盤面や手札がずれる
- `force: true` snapshot で進行中の演出や busy lock が落ちる
- publish の stale response が新しい local state を巻き戻す
- trap 系や pending action で network publish が二重に走る
- network mode だけ UI が古いまま残る、またはクリックが早すぎる

## Default Stance

- 通常は root 側の `ui/network-client.js` と `ui/network/snapshot.js` を正本として扱う
- `worker-public/ui/network/*` は mirror として確認し、直編集しない
- remote snapshot と local presentation queue を別物として扱う
- `game/` や `cpu/` に UI 都合の回避ロジックを逃がさない
- 差分は最小にし、publish / snapshot / playback のどこで壊れたかを先に固定する

## Repo-specific Facts

- network publish / reconnect / heartbeat の入口は `ui/network-client.js`
- snapshot apply の中心は `ui/network/snapshot.js`
- public snapshot projection は `workers/match-worker.mjs`
- reconnect では `force: true` apply が入りやすく、incoming `playbackEvents` が空でも local presentation queue は残ることがある
- trap の target selection には `action.deferNetworkPublish = true` を使う経路があり、action bridge 側の auto publish と二重化しやすい

## Procedure

1. 先にルールを読む
   - `AGENTS.md` と `.github/copilot-instructions.md` を確認する
   - `ui/` に効く `.github/instructions/ui.instructions.md` を確認する
   - repo memory の network 系メモを確認する

2. 正本を先に決める
   - 通常の修正は root 側の `ui/network-client.js` と `ui/network/snapshot.js` を正本にする
   - `worker-public/` は `npm run worker:prepare` で揃える前提で扱う

3. 読む順を固定する
   - `ui/network-client.js` の publish / reconnect / heartbeat / syncLatestState を確認する
   - `ui/network/snapshot.js` の `applySnapshot()` と queue 復元条件を確認する
   - `ui/network/session-seat.js` など seat authority 周りが絡むなら確認する
   - `workers/match-worker.mjs` の public snapshot projection を確認する
   - 最後に関連 test を確認する

4. 壊れ方を分類する
   - remote snapshot apply の問題か
   - local presentation queue / busy lock の問題か
   - publish timing の問題か
   - stale response rollback の問題か
   - trap defer の問題か

5. 小さく編集する
   - incoming snapshot に新しい `playbackEvents` が無い時は local presentation queue を不用意に落とさない
   - stale response を受けても、より新しい local base version を巻き戻さない
   - `deferNetworkPublish` が立つ action では action bridge の auto publish を止める
   - click 解除や busy lock 解除は manager state を先に見てから行う

6. 関連経路を漏らさず確認する
   - reconnect / heartbeat 経路
   - result sync / force sync 経路
   - trap / pending selection 経路
   - `worker-public/` mirror の要否

7. 検証する
   - `npx jest test/ui.network-client.result-sync.test.js --runInBand`
   - `npx jest test/ui.network-client.action-bridge-next-snapshot.test.js --runInBand`
   - `npx jest test/ui.network-client.trap-deferred-publish.test.js --runInBand`
   - `npx jest test/ui.network-client.publish-base-version.test.js --runInBand`
   - `npx jest test/ui.network-client.reconnect-sync.test.js --runInBand`
   - script path まで触った場合だけ `npm run worker:prepare` を追加する

8. 最後に報告を固定する
   - root cause が snapshot / publish / playback のどこだったかを書く
   - root を直したか、`worker-public/` まで同期したかを書く
   - 実行した test と結果を書く
   - `01-rulebook.md` を更新したか必ず書く
   - 最後に専門用語を避けた短い説明を付ける

## Branching Guide

- reconnect した時だけズレる
  - `syncLatestState()` と `applySnapshot()` の `force` 経路を先に見る

- 演出だけ途中で消える
  - incoming `playbackEvents` が無い snapshot apply で local queue を消していないか確認する

- 1 回の操作で network 更新が 2 回走る
  - `deferNetworkPublish` と action bridge 側 auto publish を確認する

- 古い応答で盤面が戻る
  - publish base version と stale rollback 防止を確認する

## Guardrails

- incoming `playbackEvents` が無い `force` snapshot で local `presentationEvents` を落とさない
- stale publish response で新しい local state を巻き戻さない
- trap の place-like action を `row` / `col` だけで auto publish 判定しない
- busy lock 解除を snapshot apply のついでに雑に消さない
- `worker-public/` は直編集せず、必要時に `npm run worker:prepare` で揃える

## Stop And Clarify Only If

- root 側と `worker-public/` 側のどちらを正本にすべきか、タスク文だけでは決められない
- network protocol や snapshot schema 自体を変える必要がある
- 既存の未コミット変更と同じ network ファイルで衝突している

## Good Prompts

- reconnect 後だけ演出が途切れるので、snapshot apply を安全に直して関連 test だけ回して
- stale publish response で盤面が戻るので、network-client の rollback 判定を最小差分で直して
- trap の target selection で publish が二重に走るので、defer flag を含めて安全に修正して
- network mode だけ busy lock が早く消えるので、presentation queue を保つ形で直して