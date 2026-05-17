---
name: 'worker-public-sync-workflow'
description: 'root を正本にしたまま worker-public mirror, prepare, verify, deploy を安全に扱うワークフロー。Use when syncing root files into worker-public, touching scripts/prepare-worker-assets.ts / .js shim, changing script paths/order, or preparing Cloudflare worker deploys in this card-othello repository.'
argument-hint: 'worker-public のどこを扱いたいか。prepare, sync, path, load order, deploy, size limit なども書く'
---

# Worker Public Sync Workflow

このスキルは、root を正本にしたまま `worker-public/` mirror、prepare、verify、deploy を安全に扱う時の手順です。

## When to Use

- root の変更を `worker-public/` へ反映したい時
- `scripts/prepare-worker-assets.ts / .js shim` を触る時
- script path や load order が root と mirror でずれる時
- Cloudflare worker へ配布する asset や deploy 手順を確認したい時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `scripts/prepare-worker-assets.ts / .js shim`
- `worker-public/*` と mirror 対象の root file（`index.html` など）
- `wrangler.toml`
- `docs/network-worker-deploy.md`
- `package.json` の `worker:*` scripts と path / order test

## Common Traps

- `worker-public/` を直編集して root より先に進めること
- `npm run worker:prepare` を飛ばして mirror を手で合わせること
- root 側の classic-script / DI 問題までこの skill で抱え込み、`ui-bootstrap-load-order-workflow` と境界をぼかすこと
- path / order 変更後の verify を省くこと
- deploy と mirror 同期を同じ意味で扱い、前提をぼかすこと

## Procedure

1. root のどの file が正本かを先に決める。
2. 正本を直し、`worker-public/` は generate / mirror として最後に扱う。
3. `scripts/prepare-worker-assets.ts / .js shim` と `wrangler.toml` の契約を確認する。
4. root 側の classic-script / DI 問題は `ui-bootstrap-load-order-workflow` で扱い、この skill では mirror / prepare / deploy の整合に集中する。
5. path / order 変更時は verify を先に通し、deploy はその後に限定する。
6. root 側に mirror 対象 page がある時は、正本を決めた上で page test と prepare をセットで確認する。

## Validation Bundle

- `npm run worker:prepare`
- `test/scripts.prepare-worker-assets.test.js`
- `test/index.card-module-scripts.test.js`
- `test/index.local-script-paths.test.js`
- 必要時だけ deploy 前確認を追加する

## Completion Checklist

- root を正本として維持している
- `worker-public/` を直編集で分岐させていない
- prepare / verify / deploy の実行有無を報告している
- `01-rulebook.md` 更新有無を報告している
