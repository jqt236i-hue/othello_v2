# Python Training Setup

This folder provides a local Python workflow for training from self-play data.

## 1) Setup

Run from repository root:

```powershell
.\ai\train\setup.ps1
```

Foundation prep (safe reset + preflight):

```powershell
npm run selfplay:prepare-foundation
```

- Cleans training artifacts under `data/runs` and `data/models`
- Checks Python/Torch environment and static guard checks before long training

DeepCFR/CFR+ foundation prep (keeps deployed browser model files):

```powershell
npm run selfplay:prepare-foundation:deepcfr
```

- Cleans old training artifacts while keeping `policy-table.json` / `policy-net.onnx` / `policy-net.onnx.meta.json`
- Initializes `data/deepcfr/*` working folders
- Writes active config: `data/deepcfr/deepcfr_config.active.yaml`
- Runs DeepCFR environment diagnostics and emits report JSON under `data/runs`

## 2) Generate self-play data (JS side)

```powershell
npm run selfplay:generate -- --games 5000 --seed 1 --max-plies 220 --with-cards --card-usage-rate 0.2 --out data/selfplay.train.ndjson
npm run selfplay:generate -- --games 1000 --seed 100001 --max-plies 220 --with-cards --card-usage-rate 0.2 --out data/selfplay.eval.ndjson
```

Previous model can be used to guide self-play:

```powershell
npm run selfplay:generate -- --games 5000 --seed 1 --max-plies 220 --with-cards --card-usage-rate 0.2 --policy-model data/models/policy-table.json --out data/selfplay.train.ndjson
```

## 3) Train policy net (PyTorch -> ONNX, with compatibility table)

```powershell
.\.venv\Scripts\python.exe .\ai\train\train_policy_onnx.py --input data/selfplay.train.ndjson --onnx-out data/models/policy-net.onnx --meta-out data/models/policy-net.onnx.meta.json --policy-table-out data/models/policy-table.json --min-visits 12 --shape-immediate 0.4
```

Resume from a previous checkpoint:

```powershell
.\.venv\Scripts\python.exe .\ai\train\train_policy_onnx.py --input data/selfplay.train.ndjson --onnx-out data/models/policy-net.onnx --meta-out data/models/policy-net.onnx.meta.json --policy-table-out data/models/policy-table.json --resume-checkpoint data/models/policy-net.prev.checkpoint.pt --checkpoint-out data/models/policy-net.next.checkpoint.pt --min-visits 12 --shape-immediate 0.4
```

DeepCFR/CFR+ distillation trainer (keeps browser-compatible outputs):

```powershell
npm run selfplay:train-deepcfr -- --input data/selfplay.train.ndjson --onnx-out data/models/policy-net.onnx --meta-out data/models/policy-net.onnx.meta.json --policy-table-out data/models/policy-table.json --report-out data/runs/deepcfr.report.json --metrics-out data/runs/deepcfr.metrics.jsonl --checkpoint-out data/models/policy-net.deepcfr.checkpoint.pt --cfr-iterations 12 --max-samples 600000 --epochs 24 --val-split 0.1 --early-stop-patience 4 --early-stop-min-delta 0.0002 --early-stop-monitor val_loss --min-visits 12 --shape-immediate 0.25
```

Card specialist ONNX trainer:

```powershell
npm run selfplay:train-card -- --input data/selfplay.train.ndjson --onnx-out data/models/policy-card.onnx --meta-out data/models/policy-card.onnx.meta.json --metrics-out data/runs/train.card.metrics.jsonl --checkpoint-out data/models/policy-card.checkpoint.pt
```

## 4) Evaluate

```powershell
.\.venv\Scripts\python.exe .\ai\train\evaluate_policy_table.py --input data/selfplay.eval.ndjson --model data/models/policy-table.json
```

## Output

- ONNX model: `data/models/policy-net.onnx`
- Card specialist ONNX: `data/models/policy-card.onnx`
- Card specialist metadata: `data/models/policy-card.onnx.meta.json`
- ONNX metadata: `data/models/policy-net.onnx.meta.json`
- ONNX checkpoint (optional): `data/models/*.checkpoint.pt`
- Model file: `data/models/policy-table.json`
- Data files: `data/selfplay.*.ndjson`

Browser CPU tries `data/models/policy-net.onnx` first, then falls back to `data/models/policy-table.json`.
Replace these files with the latest trained outputs to apply learned policy in browser matches.

## Realtime loss monitoring

- `train_policy_onnx.py` prints epoch-level `avg_loss`, `train_acc`, `train_place_acc`, and `train_card_acc` (when card samples exist).
- Validation logs also include `val_place_acc` / `val_card_acc` when available.
- Optional step-level logs: `--log-interval-steps 100`
- Optional JSONL metrics: `--metrics-out data/runs/train.metrics.jsonl`
- Early stopping (optional): `--val-split 0.1 --early-stop-patience 3 --early-stop-min-delta 0.0005 --early-stop-monitor val_loss`
- Card head emphasis (optional): `--card-loss-weight 2.0`

PowerShell tail:

```powershell
Get-Content data/runs/train.metrics.jsonl -Wait
```

## Preset Long-Run Command

Card-focused preset run (override options after `--`):

```powershell
npm run selfplay:train-preset:cards -- --max-hours 6 --seed 1
```

## Profile-based isolated long run

新しい学習環境では、既存の `data/models` を直接上書きせず、
プロファイルごとの隔離ディレクトリで 100 時間ループを起動できる。

解決済み設定だけ先に出力する:

```powershell
npm run selfplay:resolve-profile -- --profile production_v2
```

本番主線の 100 時間ループを起動する:

```powershell
npm run selfplay:train-profile:production
```

研究線の設定だけ解決して確認する:

```powershell
npm run selfplay:resolve-profile -- --profile research_deepcfr_v1
```

hardcase 採掘線の設定だけ解決して確認する:

```powershell
npm run selfplay:resolve-profile -- --profile hardcase_mining_v1
```

主な出力先:

- 実行設定: `data/runs/production_v2/<runTag>/config.resolved.json`
- preflight レポート: `data/runs/production_v2/<runTag>/preflight.json`
- 学習サマリ: `data/runs/production_v2/<runTag>/training-cycle.summary.json`
- 隔離モデル置き場: `data/models/production_v2/`

`adoption_v2` gate profile では quick gate の後に quality gate、その後に final adoption と browser ONNX gate を順番に実行する。browser ONNX gate では、必要に応じて平均 / p95 / 最大推論レイテンシの閾値も使える。

必要なら末尾に `-- --max-hours 12` のような上書きを追加できる。

`cards_v1` preset now includes:

- multi-seed adoption checks with average/min/per-seed-pass gates
- independent seed stream for final adoption
- browser ONNX gate before promotion, including latency thresholds when configured

Standalone ONNX gate:

```powershell
npm run selfplay:onnx-gate -- --candidate-onnx data/models/policy-net.candidate.example.onnx --candidate-onnx-meta data/models/policy-net.candidate.example.onnx.meta.json --seed 1 --seed-count 3 --games 8 --threshold 0.52 --min-seed-score 0.45 --min-seed-pass-count 2 --max-average-latency-ms 18 --max-p95-latency-ms 28 --max-max-latency-ms 45 --out data/runs/adoption.onnx.example.json
```

## Teacher-solution export from hardcases

研究線で分離保存した hardcase NDJSON から、固定形式の `teacher_solution.v1` を生成できる。
出力は元レコードの学習互換フィールドを保持するため、そのまま既存の ONNX 学習入力へ渡せる。

```powershell
npm run selfplay:export-teacher -- --input data/runs/hardcase_mining_v1/selfplay.train.hardcase.sample.ndjson --out data/runs/hardcase_mining_v1/teacher_solution.sample.ndjson
```

生成した teacher-solution を蒸留元として使う例:

```powershell
npm run selfplay:train-deepcfr -- --input data/runs/hardcase_mining_v1/teacher_solution.sample.ndjson --onnx-out data/models/research_deepcfr_v1/policy-net.teacher.onnx --meta-out data/models/research_deepcfr_v1/policy-net.teacher.onnx.meta.json --policy-table-out data/models/research_deepcfr_v1/policy-table.teacher.json
```

`teacher_solution.v1` には次が含まれる:

- 元の `board` / `player` / `legalMoves` / `handCards` / `usableCardIds` など学習互換フィールド
- `teacherSolution.method = selfplay.committee_hardcase.v1`
- `teacherSolution.decisionKind = place/use/destroy/sell/keep`
- `teacherSolution.candidates` と `selectedActionKey`
- `hardcaseTags` / `hardcasePrimaryTag` / `actorView`

## DeepCFR/CFR+ Foundation Files

- Base config template: `ai/train/deepcfr_config.base.yaml`
- Active config (generated): `data/deepcfr/deepcfr_config.active.yaml`
- Environment check script: `ai/train/check_deepcfr_env.py`
- Init command: `npm run selfplay:init-foundation:deepcfr`
- Preflight command: `npm run selfplay:preflight:deepcfr`
