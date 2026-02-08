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

## 3) Train policy table (Python side)

```powershell
.\.venv\Scripts\python.exe .\ai\train\train_policy_table.py --input data/selfplay.train.ndjson --model-out data/models/policy-table.json --min-visits 3
```

## 4) Evaluate

```powershell
.\.venv\Scripts\python.exe .\ai\train\evaluate_policy_table.py --input data/selfplay.eval.ndjson --model data/models/policy-table.json
```

## Output

- Model file: `data/models/policy-table.json`
- Data files: `data/selfplay.*.ndjson`

Browser CPU loads `data/models/policy-table.json` by default.
Replace this file with the latest trained model to apply learned policy in browser matches.
