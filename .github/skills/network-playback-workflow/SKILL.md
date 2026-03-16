---
name: 'network-playback-workflow'
description: 'network snapshot, reconnect, publish, playback queue の崩れを、この repo の snapshot/presentation 特性に合わせて安全に直すワークフロー。Use when editing ui/network-client.js, ui/network/snapshot.js, session-seat handling, reconnect sync, stale publish rollback, or related network playback tests in this card-othello repository.'
argument-hint: 'network のどこを直したいか。snapshot, reconnect, publish, playback, stale rollback, trap defer なども書く'
---

# Network Playback Workflow

このスキルは、network client 側の snapshot apply、reconnect、publish、playback queue の噛み合わせを安全に直す時の手順です。

## When to Use

- reconnect 後に盤面、手札、busy lock がずれる時
- `force` snapshot で演出や local presentation queue が落ちる時
- stale publish response が新しい local state を巻き戻す時
- trap や pending selection で publish が二重に走る時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `ui/network-client.js`
- `ui/network/snapshot.js`
- `ui/network/session-seat.js`
- `workers/match-worker.mjs` の public snapshot projection
- 関連 test: `test/ui.network-client.result-sync.test.js`, `test/ui.network-client.action-bridge-next-snapshot.test.js`, `test/ui.network-client.trap-deferred-publish.test.js`, `test/ui.network-client.publish-base-version.test.js`, `test/ui.network-client.reconnect-sync.test.js`

## Common Traps

- incoming `playbackEvents` が無い `force` snapshot で local queue を消すこと
- stale response で新しい local state を巻き戻すこと
- `deferNetworkPublish` が立つ action と auto publish を二重に走らせること
- busy lock 解除をタイミング依存で雑に消すこと

## Procedure

1. 壊れ方を snapshot apply、local presentation queue、publish timing、stale rollback、trap defer のどこかに分類する。
2. root 側の `ui/network-client.js` と `ui/network/snapshot.js` を正本として調べる。
3. remote snapshot と local presentation queue を別物として扱い、片方の都合をもう片方へ押し込まない。
4. 早すぎる unlock や二重 publish は state manager / defer flag の責務で止める。
5. worker 側 projection まで影響するかを最後に確認する。

## Validation Bundle

- `test/ui.network-client.result-sync.test.js`
- `test/ui.network-client.action-bridge-next-snapshot.test.js`
- `test/ui.network-client.trap-deferred-publish.test.js`
- `test/ui.network-client.publish-base-version.test.js`
- `test/ui.network-client.reconnect-sync.test.js`

## Completion Checklist

- snapshot と local presentation queue の責務が混ざっていない
- stale rollback と二重 publish を抑えられている
- 実行した network test と root / mirror の扱いを報告している
- `01-rulebook.md` 更新有無を報告している
