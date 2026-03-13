---
name: cpu-onnx-gate-workflow
description: 'browser ONNX gate, runtime guard, benchmark script, fallback 判定を、この repo の shared profile と browser runtime 前提に合わせて安全に直すワークフロー。Use when editing scripts/benchmark-policy-onnx-gate.js, ui/handlers/cpu-policy.js, game/ai/policy-onnx-runtime.js, game/cpu-decision.js, or related ONNX gate tests in this card-othello repository.'
argument-hint: 'ONNX gate のどこを直したいか。load, runtime, latency, benchmark, fallback, pending target のどれかも書く'
---

# CPU ONNX Gate Workflow

このスキルは、このリポジトリで browser ONNX gate と runtime degrade を安全に直すための実務手順です。

## When to Use

- browser ONNX gate が待ち続ける
- ONNX runtime は loaded なのに gate が fail する
- latency guard が強すぎて browser ONNX がすぐ fallback する
- candidate artifact の差し替えや restore が壊れる
- chooseMove / chooseCard / choosePendingTarget のどこかだけ ONNX が不安定

## Default Stance

- benchmark script、browser handler、runtime、decision の 4 点を一体で見る
- root 側を正本にし、UI の query 注入と shared profile を先に確認する
- loop 回数や seed は整数化を前提に扱う
- fallback 条件は `game/cpu-decision.js` と `game/ai/policy-onnx-runtime.js` に寄せる
- gate が落ちるからといって UI 側だけに場当たり対応を足さない

## Repo-specific Facts

- `scripts/benchmark-policy-onnx-gate.js` は browser proof のために `run-ui-level-match` を使う
- browser 側 ONNX の入口は `ui/handlers/cpu-policy.js`
- runtime 状態と latency summary は `game/ai/policy-onnx-runtime.js` から取る
- shared profile parity だけで browser ONNX が無効になることがある
- browser proof では `?cpuOnnx=1` が必須で、card capability を見る時は `?cardSpecialist=1` も必要になりやすい
- `buildSeedList` と `buildMatchTasks` は直接呼び出しでも整数化されている前提で扱う

## Procedure

1. 先にルールを読む
   - `AGENTS.md` と `.github/copilot-instructions.md` を確認する
   - `cpu/`, `game/`, `constants/` に効く instruction を確認する
   - repo memory の ONNX gate 系メモを確認する

2. 読む順を固定する
   - `constants/cpu-lv6-shared-profile.js` で shared profile を確認する
   - `ui/handlers/cpu-policy.js` で browser load 条件と query 注入を確認する
   - `scripts/benchmark-policy-onnx-gate.js` で args / seed / loop / candidate 差し替えを確認する
   - `scripts/run-ui-level-match.js` で browser 起動条件を確認する
   - `game/ai/policy-onnx-runtime.js` の `getStatus()` と latency summary を確認する
   - `game/cpu-decision.js` の degrade guard と hold 判定を確認する

3. 壊れ方を分類する
   - browser runtime が load しない問題か
   - gate の wait 条件が厳しすぎる問題か
   - latency threshold が現実に合っていない問題か
   - candidate / target artifact restore の問題か
   - pending target や card head だけ使えない問題か

4. 小さく編集する
   - browser proof の query 注入は `?cpuOnnx=1` を基準に確認する
   - card capability は `cardModelLoaded` だけでなく card head の有無も考慮する
   - loop 回数と seed 系引数は整数化を維持する
   - degrade 判定は shared profile と runtime status から一貫して決める
   - fallback の都合で target/value の load 条件を勝手に広げない

5. 直接の根本原因を確認する
   - `runtime.loaded` 待ちなのか
   - `AUTO_MODE_ACTIVE` や CPU handoff 側で詰まっているのか
   - latency summary の読み方なのか
   - candidate artifact 差し替えと restore なのか

6. 検証する
   - `npx jest test/selfplay.policy-onnx-gate.test.js --runInBand`
   - `npx jest test/game.cpu-policy-onnx-runtime.test.js --runInBand`
   - `npx jest test/cpu.turn-handler.onnx-hold.test.js --runInBand`
   - 必要なら `npm run selfplay:onnx-gate -- --candidate-onnx ...`
   - browser path 変更時だけ `npm run check:window` を追加する

7. 最後に報告を固定する
   - load / gate / latency / fallback のどこが根本原因だったかを書く
   - 実行した test と結果を書く
   - `01-rulebook.md` を更新したか必ず書く
   - 最後に専門用語を避けた短い説明を付ける

## Branching Guide

- gate が永遠に待つ
  - `?cpuOnnx=1` の注入、shared profile parity、`runtime.loaded` 条件を先に見る

- card 系だけ browser ONNX が使われない
  - `?cardSpecialist=1` と card head 判定を確認する

- しきい値が厳しすぎて fallback する
  - latency の average / p95 / max のどれで落ちているかを先に分ける

- ベンチの試行回数が変
  - args だけでなく `buildSeedList` と `buildMatchTasks` の整数化を確認する

## Guardrails

- browser proof で `?cpuOnnx=1` を抜かない
- card capability を specialist model の有無だけで判定しない
- loop 回数と seed 列は整数化を崩さない
- degrade 条件は shared profile / runtime status から一貫して決める
- candidate と target artifact の restore を壊さない

## Stop And Clarify Only If

- benchmark の合格条件そのものを変える必要がある
- shared profile の方針を変える必要があるが、期待する新挙動が曖昧
- 既存の未コミット変更と同じ ONNX 関連ファイルで衝突している

## Good Prompts

- browser ONNX gate が待ち続けるので、query 注入と runtime loaded 条件を安全に確認して直して
- latency guard が厳しすぎるので、runtime summary を見ながら最小差分で調整して
- benchmark の games/seed-count が静かにずれるので、整数化経路を崩さずに修正して
- choosePendingTarget だけ ONNX が不安定なので、cpu-decision と runtime guard の責務を守って直して