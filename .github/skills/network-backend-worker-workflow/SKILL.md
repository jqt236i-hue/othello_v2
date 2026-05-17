---
name: 'network-backend-worker-workflow'
description: 'local match server、Durable Object worker、seat token、SSE、heartbeat、leaderboard を、この repo の backend authority / projection 前提で安全に直すワークフロー。Use when editing scripts/local-match-server.ts / .js shim, scripts/match-network-smoke.ts / .js shim, workers/match-worker.mjs, docs/network-worker-deploy.md, or related network backend tests in this card-othello repository.'
argument-hint: 'backend のどこを直したいか。worker, local server, seat token, SSE, heartbeat, leaderboard なども書く'
---

# Network Backend Worker Workflow

このスキルは、local match server と Durable Object worker の authority、projection、seat token、SSE、heartbeat を安全に直す時の手順です。

## When to Use

- local match server と worker の契約差が疑われる時
- seat token, SSE, heartbeat, room state, leaderboard の挙動を直す時
- worker deploy 前に authority / projection を整理したい時
- network smoke や backend test が落ちる時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `workers/match-worker.mjs`
- `scripts/local-match-server.ts / .js shim`
- `shared/network-action-schema.ts / .js shim`
- `shared/playback-event-helpers.ts / .js shim`
- `utils/match-authority.ts / .js shim`
- `scripts/match-network-smoke.ts / .js shim`
- `docs/network-worker-deploy.md`

## Common Traps

- local server と worker を別契約のまま進化させること
- client-authored authority を backend に混ぜ戻すこと
- seat token, heartbeat, SSE 初回 snapshot の扱いを片側だけ変えること
- 同じ seat の再参加と leave 後の token rotation / stale token revoke を join, stream, leave で別契約にすること
- hidden hand や viewer projection の漏れを smoke なしで出荷すること

## Procedure

1. authority を持つ場所と projection を返す場所を先に固定する。
2. worker と local server のどちらが正本の契約かを決め、片方だけ先行しないようにする。
3. seat token の新規 join、同 seat への rejoin、leave 後の rotated token、stale token revoke を join / stream / leave 全部で同じ契約にそろえる。
4. seat token, SSE, heartbeat, reconnect, leaderboard の波及を同時に見る。
5. `shared/network-action-schema.ts / .js shim`, `shared/playback-event-helpers.ts / .js shim`, `utils/match-authority.ts / .js shim` を先に見て、contract の分岐や event 組み立ての重複を増やさない。
6. backend smoke と関連 worker / local server test で契約を確認してから deploy 面を見る。

## Validation Bundle

- `npm run match:check -- --base <url>`
- `npm run test:network:parity`
- `test/workers.match-heartbeat-stateversion.test.js`
- `test/workers.match-turn-timer.test.js`
- `test/workers.match-publish-sanitize.test.js`
- `test/workers.match-stream-sse.test.js`
- `test/workers.match-leave-token-revocation.test.js`
- `test/workers.match-leaderboard.test.js`
- `test/local-match-server.publish-contract.test.js`
- `test/local-match-server.leave-contract.test.js`
- `test/utils.match-authority.publish-response.test.js`
- `test/scripts.match-network-smoke.test.js`
- public asset まで触る時だけ `npm run worker:prepare`

## Completion Checklist

- authority と projection の役割が整理されている
- local server と worker の契約差を広げていない
- smoke / worker test の結果を報告している
- `01-rulebook.md` と deploy 文書の更新有無を報告している
