---
name: 'worker-public-sync-workflow'
description: 'root を正本にしたまま worker-public mirror, prepare, verify, deploy を安全に扱うワークフロー。Use when syncing root files into worker-public, touching scripts/prepare-worker-assets.js, changing script paths/order, or preparing Cloudflare worker deploys in this card-othello repository.'
argument-hint: 'worker-public のどこを扱いたいか。prepare, sync, path, load order, deploy, size limit なども書く'
---

# Worker Public Sync Workflow

このスキルは、root を正本にしたまま `worker-public/` mirror、prepare、verify、deploy を安全に扱う時の手順です。

## When to Use

- root の変更を `worker-public/` へ反映したい時
- `scripts/prepare-worker-assets.js` を触る時
- script path や load order が root と mirror でずれる時
- Cloudflare worker へ配布する asset や deploy 手順を確認したい時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `scripts/prepare-worker-assets.js`
- `worker-public/*`
- `wrangler.toml`
- `docs/network-worker-deploy.md`
- `package.json` の `worker:*` scripts と path / order test

## Common Traps

- `worker-public/` を直編集して root より先に進めること
- `npm run worker:prepare` を飛ばして mirror を手で合わせること
- path / order 変更後の verify を省くこと
- deploy と mirror 同期を同じ意味で扱い、前提をぼかすこと

## Procedure

1. root のどの file が正本かを先に決める。
2. 正本を直し、`worker-public/` は generate / mirror として最後に扱う。
3. `scripts/prepare-worker-assets.js` と `wrangler.toml` の契約を確認する。
4. path / order 変更時は verify を先に通し、deploy はその後に限定する。
5. tutorial / story のような二重配置は、正本を決めてから同期する。

## Validation Bundle

- `npm run worker:prepare`
- `test/index.card-module-scripts.test.js`
- `test/index.local-script-paths.test.js`
- 必要時だけ deploy 前確認を追加する

## Completion Checklist

- root を正本として維持している
- `worker-public/` を直編集で分岐させていない
- prepare / verify / deploy の実行有無を報告している
- `01-rulebook.md` 更新有無を報告している
