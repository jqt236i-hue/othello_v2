# ai/train/ AGENTS.md

Python model training subtree for CPU/selfplay artifacts. This path is operationally tied to `scripts/` and `src/engine/`.

## Where to look

| Task | Start here | Notes |
| --- | --- | --- |
| Python setup | `setup.ps1`, `requirements.txt` | Torch install is environment-specific; do not assume generic pip setup is enough. |
| Policy training | `train_policy_onnx.py`, `train_card_onnx.py`, `train_deepcfr_onnx.py` | Invoked through npm `selfplay:train-*` scripts. |
| Training orchestration | `../../scripts/run-selfplay-training-profile.ts`, `../../scripts/run-selfplay-training-cycle.ts` | JS launcher/profile contract owns run orchestration. |
| Selfplay data | `../../src/engine/selfplay-runner.ts` | Headless gameplay trace producer. |
| Model artifacts | `../../data/models/*`, lane-local run dirs | Large outputs; do not add/commit unless explicitly requested. |

## Rules

- Keep Python training code separate from browser/game runtime code.
- Do not hardcode local absolute paths, secrets, or machine-specific assumptions.
- Preserve profile/gate/promotion contracts in `../../docs/architecture-contracts.md` §5.2.
- Lane promotion and root deployment are separate phases; do not overwrite root bundles just to evaluate a lane candidate.

## Common traps

- Treating generated model files as source.
- Bypassing JS profile resolution and reconstructing command-line precedence in Python.
- Running long training jobs when a focused preflight/test would catch the issue.

## Verification

- Prefer preflight/focused tests before long runs: `npm run selfplay:preflight`, `npm run selfplay:resolve-profile`, focused `test/selfplay.*` / `test/src.*`.
- Python commands use repo-root `.venv\Scripts\python.exe` in package scripts.
- After root model deployment, run `npm run worker:prepare`.
