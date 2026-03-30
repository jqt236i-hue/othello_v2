---
name: 'selfplay-training-pipeline-workflow'
description: 'selfplay 学習プロファイル、preflight、adoption/quality gate、promotion を、この repo の runs/models/profile 前提に合わせて安全に回すワークフロー。Use when editing scripts/run-selfplay-training-profile.js, scripts/run-selfplay-training-cycle.js, scripts/preflight-selfplay-training.js, scripts/benchmark-policy-adoption.js, scripts/benchmark-policy-quality-gate.js, scripts/promote-policy-model.js, ai/train/*, or related selfplay tests in this card-othello repository.'
argument-hint: '学習パイプラインのどこを直したいか。profile, preflight, gate, promotion, reset なども書く'
---

# Selfplay Training Pipeline Workflow

このスキルは、selfplay 学習 profile、preflight、adoption / quality gate、promotion を、profile ごとの出力分離を保ったまま安全に回す時の手順です。

## When to Use

- 学習 profile や preflight 条件を変えたい時
- adoption / quality gate や benchmark 条件を直したい時
- promotion や model 配置の流れを直したい時
- reset, archive, manifest, rollback まわりを整理したい時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `scripts/run-selfplay-training-profile.js`
- `scripts/run-selfplay-training-cycle.js`
- `scripts/preflight-selfplay-training.js`
- `scripts/benchmark-policy-adoption.js`, `scripts/benchmark-policy-quality-gate.js`, `scripts/promote-policy-model.js`
- `ai/train/*` と関連 selfplay test

## Common Traps

- profile ごとの出力と deploy 済み model の責務を混ぜること
- preflight や quality gate を飛ばして promotion 条件を緩めること
- reset 系の扱いを曖昧にし、必要な artifact まで消すこと
- benchmark 前提の変更を training 側と promotion 側でずらすこと
- 学習 run の起動 / 再起動まで行ったのに、`selfplay-training-run-ops-workflow` 側の run-tag / `launcher.log` / monitor / stop 案内を省くこと

## Procedure

1. まず profile、preflight、gate、promotion のどこを直すかを分ける。
2. profile ごとの output と deploy 面を別責務として保つ。
3. gate や benchmark の前提を変える時は、関連 script を同じタスクでそろえる。
4. reset や cleanup が必要なら、残すものと消すものを先に明確にする。
5. 学習 run の起動 / 再起動まで含む時は、`selfplay-training-run-ops-workflow` に切り替え、run-tag / `launcher.log` / monitor / stop の案内までそろえる。
6. 学習、gate、promotion を 1 本の流れで検証する。

## Validation Bundle

- 関連する preflight script の実行
- adoption / quality gate script の確認
- 近い `test/selfplay.*` や training 関連 test
- profile 出力先と manifest / archive の整合確認

## Completion Checklist

- profile 出力と deploy 面の責務を混ぜていない
- preflight / gate / promotion の流れがそろっている
- run の起動 / 再起動まで行った場合は、`selfplay-training-run-ops-workflow` に沿って監視導線まで返している
- 実行した script / test と結果を報告している
- `01-rulebook.md` 更新有無を報告している
