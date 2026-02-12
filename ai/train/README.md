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

## 4) Evaluate

```powershell
.\.venv\Scripts\python.exe .\ai\train\evaluate_policy_table.py --input data/selfplay.eval.ndjson --model data/models/policy-table.json
```

## Output

- ONNX model: `data/models/policy-net.onnx`
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

`cards_v1` preset now includes:
- multi-seed adoption checks with average/min/per-seed-pass gates
- independent seed stream for final adoption
- browser ONNX gate before promotion

Standalone ONNX gate:

```powershell
npm run selfplay:onnx-gate -- --candidate-onnx data/models/policy-net.candidate.example.onnx --candidate-onnx-meta data/models/policy-net.candidate.example.onnx.meta.json --seed 1 --seed-count 3 --games 8 --threshold 0.52 --min-seed-score 0.45 --min-seed-pass-count 2 --out data/runs/adoption.onnx.example.json
```

## DeepCFR/CFR+ Foundation Files

- Base config template: `ai/train/deepcfr_config.base.yaml`
- Active config (generated): `data/deepcfr/deepcfr_config.active.yaml`
- Environment check script: `ai/train/check_deepcfr_env.py`
- Init command: `npm run selfplay:init-foundation:deepcfr`
- Preflight command: `npm run selfplay:preflight:deepcfr`
