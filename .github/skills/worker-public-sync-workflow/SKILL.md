---
name: worker-public-sync-workflow
description: 'root を正本にしたまま worker-public mirror, prepare, verify, deploy を安全に扱うワークフロー。Use when syncing root files into worker-public, touching scripts/prepare-worker-assets.js, changing script paths/order, or preparing Cloudflare worker deploys in this card-othello repository.'
argument-hint: 'worker-public のどこを扱いたいか。prepare, sync, path, load order, deploy, size limit のどれかも書く'
---

# Worker Public Sync Workflow

このスキルは、このリポジトリで root 正本を保ったまま `worker-public/` mirror と deploy 準備を安全に扱うための実務手順です。

## When to Use

- root の変更を `worker-public/` に反映したい
- `scripts/prepare-worker-assets.js` を触る
- root と `worker-public/` で script path や load order がずれる
- Cloudflare worker 用の配布物や asset 制限を確認したい
- tutorial / story の二重配置で正本判断が必要

## Default Stance

- root を正本にする
- `worker-public/` は生成物として扱い、直編集しない
- 順番は root 修正 → `npm run worker:prepare` → verify → deploy に固定する
- deploy は verify が通ってから行う
- script order と asset size は prepare のたびに壊れ得る前提で扱う

## Repo-specific Facts

- 同期の中心は `scripts/prepare-worker-assets.js`
- deploy 設定は `wrangler.toml`
- worker entry は `workers/match-worker.mjs`
- 実運用の流れは `docs/network-worker-deploy.md` にまとまっている
- `package.json` の `worker:*` scripts が prepare / verify / deploy の入口
- cards internal の preload 順は root と `worker-public/` の両方で一致している必要がある
- tutorial / story には root と `worker-public/` の二重配置がある

## Procedure

1. 先にルールを読む
   - `AGENTS.md` と `.github/copilot-instructions.md` を確認する
   - 関連する `ui/`, `game/`, `cards/` instruction を確認する
   - repo memory の sync / load order / tutorial source 系メモを確認する

2. 正本と対象を先に決める
   - root 側のどのファイルを正本とするか明確にする
   - `worker-public/` 側は mirror なのか、deploy artifact なのかを整理する
   - tutorial / story のような二重配置は、正本を決めてから触る

3. 読む順を固定する
   - `wrangler.toml` の assets dir と worker entry を確認する
   - `package.json` の `worker:*` scripts を確認する
   - `scripts/prepare-worker-assets.js` の `DIRS`, `ROOT_FILES`, `OPTIONAL_FILES` を確認する
   - `docs/network-worker-deploy.md` の手順と制限を確認する
   - path / order 系の test を確認する

4. 小さく編集する
   - root 側の修正を先に入れる
   - `worker-public/` の差分を手で作らず、prepare で生成する
   - script order 変更があるなら root HTML と mirror 両方を確認する
   - optional assets を増やす時は size limit を先に意識する

5. verify を固定する
   - `npm run worker:prepare`
   - `npx jest test/index.card-module-scripts.test.js test/index.local-script-paths.test.js --runInBand`
   - network worker まで影響するなら `npx jest test/workers.match-stream-sse.test.js --runInBand`
   - tutorial / story 入口を触った場合は関連 page test も追加する

6. deploy は必要時だけ行う
   - deploy が求められている時だけ `npm run worker:deploy` を実行する
   - verify が通っていない状態で deploy しない

7. 最後に報告を固定する
   - root 正本をどこに置いたかを書く
   - `worker-public/` を prepare で同期したかを書く
   - 実行した verify / deploy コマンドと結果を書く
   - `01-rulebook.md` を更新したか必ず書く
   - 最後に専門用語を避けた短い説明を付ける

## Branching Guide

- root だけ直って worker-public が古い
  - 直編集を疑う前に `npm run worker:prepare` と同期対象を確認する

- browser だけカード読み込みが壊れる
  - script path と cards internal preload 順を確認する

- deploy は通るが画面が壊れる
  - prepare 後の verify 不足を疑い、path/order test を先に見る

- tutorial / story の片側だけ直っている
  - 正本判断を先に固定し、もう片側を mirror として扱うか決める

## Guardrails

- `worker-public/` を直接編集しない
- root 修正前に `worker-public/` だけ直さない
- `npm run worker:prepare` を飛ばして deploy しない
- cards internal の preload 順変更時は path/order test を必ず回す
- 二重配置のまま正本を曖昧にして広げない

## Stop And Clarify Only If

- root と `worker-public/` のどちらを正本にすべきか決められない
- deploy 対象や環境の期待状態が曖昧
- 既存の未コミット変更と同じ sync / deploy 関連ファイルで衝突している

## Good Prompts

- root 側で直した network UI を worker-public へ安全に同期して、必要な verify だけ回して
- cards internal の追加で script order がずれたので、prepare と path/order test を含めて直して
- tutorial の正本が曖昧なので、root と worker-public の扱いを整理しながら安全に修正して
- deploy 前に worker-public の同期漏れがないか確認し、必要なら prepare からやり直して