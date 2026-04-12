---
name: 'selfplay-training-run-ops-workflow'
description: 'selfplay 学習 run の停止、再起動、run-tag 管理、launcher.log / monitor 追跡を、この repo の runsDir / resolved config / summary 生成順に合わせて安全に回すワークフロー。Use when restarting training runs, stopping stale runs, validating active run tags, or giving monitor/tail/stop commands for selfplay training in this card-othello repository.'
argument-hint: 'どの profile / run-tag を起動・停止・監視したいか。設定変更有無も書く'
---

# Selfplay Training Run Ops Workflow

このスキルは、selfplay 学習 run の停止、再起動、run-tag 固定、進捗監視、誤ログ追跡の回避を、安全にそろえて実施する時の手順です。

## When to Use

- 学習 profile を変えた後に run を再起動したい時
- 旧 run を止めて新 run へ切り替えたい時
- 今どの run-tag が生きているか確認したい時
- `launcher.log` や monitor の見方を毎回確実に案内したい時
- 背景実行の selfplay 学習で、正しい log / stop コマンドを即座に出したい時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- `SKILLS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `ai/train/configs/profiles/*.yaml`
- `ai/train/configs/gates/*.yaml`
- `scripts/load-training-profile.js`
- `scripts/run-selfplay-training-profile.js`
- `scripts/run-selfplay-training-cycle.js`
- `scripts/monitor-selfplay-training-run.js`
- `data/runs/<profile>/<run-tag>/config.resolved.json`
- `data/runs/<profile>/<run-tag>/preflight.json`
- `data/runs/<profile>/<run-tag>/launcher.log`
- `data/runs/<profile>/<run-tag>/training-cycle.summary.json`

## Common Traps

- workspace root の `launcher.log`、run 専用 `launcher.log`、再起動後に残る `launcher.*.log` archive を取り違えること
- `training-cycle.summary.json` 未生成の初期段階で monitor を叩き、失敗を run 異常と誤認すること
- 旧 run を止めずに新 run を起動し、どちらの process / log を見ているか分からなくなること
- profile を直したあと、既に起動中の古い run に設定が自動反映されると誤解すること
- run-tag を固定せずに起動し、監視・停止・比較の入口を失うこと
- 起動や再起動を報告したのに、その場で `launcher.log` の tail か monitor コマンドを返さず、利用者が追跡入口を失うこと

## Procedure

1. まず、設定変更の有無、対象 profile、再起動対象の run-tag を固定する。
2. profile / gate / resolved path を変えた時は、実起動前に dry-run と `scripts/load-training-profile.js` / launcher / monitor の近い test を選ぶ。
3. 既存 run を再起動する時は、target run-tag を含む process だけを列挙し、対象以外を巻き込まず停止する。
4. 新 run は必ず明示 run-tag で起動し、起動直後に run directory と `config.resolved.json`, `preflight.json`, `launcher.log` の生成を確認する。
5. 起動後は process 一覧で新 run-tag を含む `run-selfplay-training-cycle.js` が生きていることを確認する。
6. 監視コマンドは必ず run 専用 path を返す。相対 `launcher.log` や再起動で残る `launcher.*.log` archive は current tail の対象にしない。
7. 起動または再起動を報告する時は、完了報告の中で必ずコピペ可能な監視コマンドを 1 つ以上提示する。利用者が明示的に求めない限り、tail / watch 自体を別プロセスで起動しない。
8. `training-cycle.summary.json` がまだ無い初期段階では、`Get-Content <run-dir>/launcher.log -Wait -Tail <n>` を先に案内する。
9. summary 生成後は `npm run selfplay:monitor -- --profile <profile> --run-tag <tag> --watch` を案内し、watch / interval / tail を必要に応じて付ける。
10. 必要に応じて `tail`, `monitor`, `stop` の 3 種類をそろえて提示し、最後に、今どの run が動いているか、どのコマンドで監視・停止できるか、設定変更が次回起動から有効かを明示する。

## Validation Bundle

- `npm run selfplay:train-profile -- --profile <profile> --run-tag <tag> --dry-run`
- `test/selfplay.training-profile-launcher.test.js`
- `test/selfplay.training-monitor.test.js`
- `test/load-training-profile.sync.test.js` は `scripts/load-training-profile.js`、profile 定義、`config.resolved.json` / `preflight.json` / `launcher.log` path 解決を変えた時だけ追加で回す。stop / tail / monitor 案内だけなら必須 green gate にしない。
- `data/runs/<profile>/<run-tag>/config.resolved.json` の生成確認
- `data/runs/<profile>/<run-tag>/preflight.json` の生成確認
- `data/runs/<profile>/<run-tag>/launcher.log` の生成確認
- 再起動後に `launcher.*.log` archive が増えていても、監視コマンドが current `launcher.log` を向いていることを確認
- target run-tag を含む process の存在確認
- launch / resume の返答に `tail`, `monitor`, `stop` の 3 種類が含まれていることを確認
- log tail もしくは monitor で 1 回は進捗を確認

## Completion Checklist

- 起動中 run の `profile` と `run-tag` を報告している
- 起動 / 再起動を報告した時は、その場で少なくとも 1 つのコピペ可能な監視コマンドを提示している
- 正しい run 専用 `launcher.log` path を案内している
- 再起動で `launcher.*.log` archive が残る場合でも、current tail 対象が現行 `launcher.log` だと分かるように案内している
- `tail`, `monitor`, `stop` の 3 種類のコマンドを提示している
- 旧 run を止めた場合は対象 process を報告している
- `01-rulebook.md` 更新有無を報告している
