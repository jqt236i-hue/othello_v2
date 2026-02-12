# Python Training Setup

This folder provides a local Python workflow for training from self-play data.

## 1) Setup

Run from repository root:

```powershell
.\ai\train\setup.ps1
```

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

- `train_policy_onnx.py` prints epoch-level `avg_loss`, `train_acc`, and optional validation metrics (`val_loss`, `val_acc`).
- Optional step-level logs: `--log-interval-steps 100`
- Optional JSONL metrics: `--metrics-out data/runs/train.metrics.jsonl`
- Early stopping (optional): `--val-split 0.1 --early-stop-patience 3 --early-stop-min-delta 0.0005 --early-stop-monitor val_loss`

PowerShell tail:

```powershell
Get-Content data/runs/train.metrics.jsonl -Wait
```
