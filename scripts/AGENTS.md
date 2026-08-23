# scripts/ AGENTS.md

Build, codegen, checks, local servers, worker sync, and selfplay/training orchestration. Use this file with the root `AGENTS.md` as the local boundary guide.

## Script categories

| Task | Start here | Notes |
| --- | --- | --- |
| TypeScript build/check wrappers | `run-all-checks.ts`, `check-window-usage.ts`, `test-shim-forwarding.ts` | `.js` files usually require `dist/scripts/*`; build before relying on shims after a clean clone. |
| Worker/public mirror | `prepare-worker-assets.ts` | Copies root assets/modules to `worker-public/`, regenerates asset manifest and gacha catalogs, verifies mirror. |
| Local servers/network smoke | `serve-with-fallback.ts`, `local-match-server.ts`, `match-network-smoke.ts` | Play server is `npm run serve` on 8000; keep it running per root `AGENTS.md` LOCAL DEV SERVER. Match-server contracts stay aligned with Worker behavior. |
| Catalog / manifest generation | `generate-catalog.ts`, `generate-observation-gacha-catalog.ts`, `generate-asset-manifest.ts` | Generated outputs are not hand-edit targets. |
| Selfplay/training orchestration | `../training/scripts/run-selfplay-training-cycle.ts`, `../training/scripts/run-selfplay-training-profile.ts`, `../training/scripts/load-training-profile.ts`, `promote-policy-model.ts`, `deploy-lane-model-to-root.ts` | Root `run-selfplay-*.js` entries dispatch to built training scripts; profile/gate/promotion contracts are in `docs/architecture-contracts.md` §5.2. |

## Gotchas

- Many `scripts/*.js` files are thin shims into built output; for training orchestration, edit the source under `training/scripts/` and run `npm run build:ts` before invoking the shim.
- `../training/scripts/run-selfplay-training-cycle.ts` has a large ordered pipeline and a very large `parseArgs`; preserve step order and resume semantics.
- Python training commands expect repo-root `.venv\Scripts\python.exe`; `training/python/setup.ps1` installs Torch separately from `requirements.txt`.
- Lane promotion and root deployment are separate: `promote-policy-model` writes lane-local artifacts; `deploy-lane-model-to-root` copies a lane champion to root `data/models/`; run `npm run worker:prepare` after root deploy.
- `data/` can contain large model/run artifacts. Do not add or commit model outputs unless explicitly requested.
- `serve-with-fallback.ts` prefers 8000 then walks sequential ports. Agents must reuse an existing 8000 listener and must not start a second copy. Do not stop the play server to run `build:browser`. Do not run `build:vite` while this repository is serving `vite-dist/` on 5174.

## Verification

- Changed script entrypoint: `npm run build:ts`, then run the relevant npm script or focused Jest under `test/scripts.*` / `training/tests/selfplay.*`.
- Check scripts: `npm run checkall` and/or `npm run check:window`.
- Worker sync script changes: `npm run worker:prepare`, `npm run check:worker-mirror`, and inspect mirror-related output. The latter is read-only and rejects stale content or manual-only files in the tracked mirror.
