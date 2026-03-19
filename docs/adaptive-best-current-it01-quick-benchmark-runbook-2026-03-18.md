# adaptive_best_current_v1 it01 Quick Benchmark Runbook

作成日: 2026-03-18  
対象: ai/train/configs / scripts / data/runs / data/models / docs  
状態: Execution-ready

## 0. この文書の目的

- run adaptive_best_current_v1_20260318_074057 で gate 対象外だった it01 候補を、it02 の quick 判定と同条件で単独ベンチする。
- profile / gate の次回用変更とは切り分け、今回の run 成果物だけで apples-to-apples 比較できるようにする。
- 次の実行者が、そのまま it01 の quick 判定 JSON を生成して比較まで終えられる状態を作る。

## 1. 今回の前提で確定していること

- run adaptive_best_current_v1_20260318_074057 は 4000 対局 x 2 反復で完走し、quick-only gate のまま終了した。
- iteration 1 は gate-final-iteration-only により quick 判定が実行されず、it01 用の adoption.quick JSON は生成されていない。
- iteration 2 の quick 判定は `benchmark-policy-adoption.js` を `games=100`, `seed=1001`, `seedCount=1`, `jobs=8`, `maxPlies=220`, `tacticalWeight=0.25`, `policyScoreWeight=1.4`, `heuristicWeight=1.05` で実行している。
- iteration 2 の quick 判定結果は baseline 0.540, candidate 0.492, uplift -0.048 で不合格だった。

## 2. この runbook のスコープ

### 2.1 やること

- it01 候補モデルと baseline モデルの存在確認
- it02 と同条件で it01 専用 quick benchmark を 1 回だけ実行
- 生成した it01 quick JSON と既存の it02 quick JSON を比較

### 2.2 やらないこと

- profile / gate / script の追加変更
- 新しい selfplay 学習 run の起動
- promotion 実行や model の差し替え
- `01-rulebook.md` の更新

## 3. 設計

### 3.1 方針

- it02 で実行済みの quick benchmark 条件をそのまま再利用する。
- 変えるのは `candidate-model` と `out` のみとし、比較条件をずらさない。
- 出力先は既存 it02 JSON と衝突しない manual 専用 path に分ける。

### 3.2 使用する主要ファイル

- baseline model:
  - data/models/adaptive_best_current_v1/policy-table.json
- it01 candidate model:
  - data/models/adaptive_best_current_v1/policy-table.candidate.adaptive_best_current_v1_20260318_074057.it01.json
- it02 quick result:
  - data/runs/adaptive_best_current_v1/adoption.quick.adaptive_best_current_v1_20260318_074057.it02.json
- manual it01 quick result:
  - data/runs/adaptive_best_current_v1/adoption.quick.manual.adaptive_best_current_v1_20260318_074057.it01.same-gate.json

## 4. 実行手順

### Step 1. 成果物の存在確認

実行コマンド:

```powershell
$baseline = 'data/models/adaptive_best_current_v1/policy-table.json'
$it01 = 'data/models/adaptive_best_current_v1/policy-table.candidate.adaptive_best_current_v1_20260318_074057.it01.json'
$it02 = 'data/runs/adaptive_best_current_v1/adoption.quick.adaptive_best_current_v1_20260318_074057.it02.json'
Test-Path $baseline
Test-Path $it01
Test-Path $it02
```

完了条件:

- 3 ファイルがすべて `True` を返す

### Step 2. it01 quick benchmark を単独実行する

実行コマンド:

```powershell
node scripts/benchmark-policy-adoption.js `
  --games 100 `
  --seed 1001 `
  --seed-count 1 `
  --seed-stride 1000 `
  --jobs 8 `
  --max-plies 220 `
  --threshold 0 `
  --confidence-level 0.9 `
  --min-lower-bound -1 `
  --min-seed-uplift -1 `
  --min-seed-pass-count 0 `
  --a-rate 0.65 `
  --b-rate 0.65 `
  --tactical-weight 0.25 `
  --tactical-depth-opening 4 `
  --tactical-depth-mid 6 `
  --tactical-depth-end 8 `
  --tactical-beam-width 12 `
  --policy-score-weight 1.4 `
  --heuristic-weight 1.05 `
  --white-priority 0 `
  --quality-weight-corner 0 `
  --quality-weight-edge 0 `
  --quality-weight-corner-recovery 0 `
  --quality-weight-corner-recapture 0 `
  --quality-weight-edge-recovery 0 `
  --quality-weight-corner-hold 0 `
  --quality-weight-corner-hold-turns 0 `
  --quality-weight-edge-hold 0 `
  --quality-weight-final-corner-share 0 `
  --quality-weight-final-edge-share 0 `
  --quality-weight-bonus 0 `
  --quality-weight-card-immediate 0 `
  --quality-weight-card-future 0 `
  --quality-weight-place-delta 0 `
  --baseline-model data/models/adaptive_best_current_v1/policy-table.json `
  --candidate-model data/models/adaptive_best_current_v1/policy-table.candidate.adaptive_best_current_v1_20260318_074057.it01.json `
  --out data/runs/adaptive_best_current_v1/adoption.quick.manual.adaptive_best_current_v1_20260318_074057.it01.same-gate.json
```

完了条件:

- コマンドが exit code 0 で終わる
- manual 用 output JSON が生成される

### Step 3. it01 と it02 の quick 結果を比較する

実行コマンド:

```powershell
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('data/runs/adaptive_best_current_v1/adoption.quick.manual.adaptive_best_current_v1_20260318_074057.it01.same-gate.json','utf8')); const b=JSON.parse(fs.readFileSync('data/runs/adaptive_best_current_v1/adoption.quick.adaptive_best_current_v1_20260318_074057.it02.json','utf8')); const pick=(x)=>({baseline:x.baseline.result.score.APercent,candidate:x.candidate.result.score.APercent,uplift:x.candidate.result.score.APercent-x.baseline.result.score.APercent,pass:x.candidate.result.score.APercent>x.baseline.result.score.APercent}); console.log(JSON.stringify({it01:pick(a),it02:pick(b)},null,2));"
```

完了条件:

- it01 / it02 の `baseline`, `candidate`, `uplift`, `pass` が同じ形式で出る

### Step 4. 判定メモを残す

残す内容:

- it01 uplift
- it02 uplift
- it01 の方が良いかどうか
- 次回 profile / gate 変更に反映するかどうか

完了条件:

- 次の実行者が「it01 が本当に見落としだったか」を再調査なしで判断できる

## 5. 検証束

- Step 1 の 3 ファイル存在確認
- Step 2 の benchmark exit code 0
- manual output JSON の生成確認
- Step 3 の比較コマンド出力

## 6. 完了条件

- it01 専用 quick benchmark JSON が生成されている
- it02 既存 quick JSON と apples-to-apples 比較できている
- profile / gate / script / worker-public の追加変更が入っていない
- `01-rulebook.md` を更新していないことを明示できる