# Fast local dev-server startup design

- Document role: reviewed implementation design for the local development startup path.
- Target: make `npm run dev` print the local URL as soon as a usable previous browser bundle can be served, while preserving the current browser delivery and build contracts.
- Sources of truth: `package.json` scripts, `vite.config.ts`, `scripts/serve-with-fallback.ts`, and the generated Vite module-bridge workflow.
- Non-goals: changing gameplay/UI behavior, changing production browser output, introducing a new runtime authority, or migrating the legacy CommonJS browser bridge to a full ESM/HMR architecture.

## Problem and desired outcome

`npm run dev` currently waits for `npm run build:vite` before starting `scripts/serve-with-fallback.js`. The build includes TypeScript compilation, browser code generation, module-bridge generation, and a production Vite bundle. The URL is therefore delayed by work that is unrelated to binding the local HTTP server.

The desired outcome is:

1. On normal repeated development runs, serve the last usable `vite-dist` bundle immediately so the URL appears quickly.
2. Run the existing `build:vite` pipeline in the background so the served bundle is refreshed with the current source.
3. On a clean checkout or missing build output, retain the safe fallback of building before starting the server.
4. Propagate build/server failures and termination signals instead of hiding failed builds behind a still-running stale server.

## Repository evidence

- `package.json` currently defines `dev` as `dev:vite`, and `dev:vite` runs `npm run build:vite && node scripts/serve-with-fallback.js ...`.
- `build:vite` invokes `build:browser`, `build-vite-module-bridge`, `build-vite-entry`, and `vite build`.
- The module-bridge generation measured approximately 17.4 seconds in the current checkout before the server can be reached.
- Direct `vite` development serving was tested after bridge preparation. Browser boot failed at the legacy `ui/layout-stage.js` CommonJS wrapper with `ReferenceError: module is not defined`; therefore a one-line replacement with `vite` would be a broken runtime migration, not a startup optimization.
- The current `dev` path serves a production bundle through `http-server`; it does not provide HMR today. Preserving this delivery model keeps the change narrow and avoids silently changing browser module semantics.

## Alternatives considered

### Direct Vite dev server

Rejected for this task. The browser entry depends on generated CommonJS bridge modules and classic compatibility wrappers. Vite's development transform does not currently convert these source-local CommonJS files into the production bundle's browser-compatible form. A safe solution would require a separate ESM/CJS bridge design and broad browser verification.

### Keep the current foreground build

Safe but does not address the requested startup delay.

### Start a static server before building, then build in the background

Chosen. It removes the repeated build from the critical path when a previous bundle exists, preserves the exact existing build and serving commands, and has a bounded fallback for first-run/missing-artifact cases. The user may briefly see the previous bundle while the current build is finishing; the CLI reports that state explicitly.

## Chosen design

Add the TypeScript process-orchestration implementation at `scripts/dev-vite-fast.ts`, with the standard `scripts/dev-vite-fast.js` Node CLI adapter, and point the `dev` npm script at the adapter. Keep `dev:vite` as the explicit foreground build-and-serve path for callers that require a clean build before the server starts.

The orchestrator will:

1. Detect a reusable bundle using `vite-dist/index.vite.html`, `vite-dist/.vite/manifest.json`, and a non-empty `vite-dist/assets` directory. Detect the compiled `serve-with-fallback` entry as a prerequisite for immediate serving.
2. If both are available, spawn `scripts/serve-with-fallback.js` immediately with the existing host/port defaults, then spawn `npm run build:vite` concurrently.
3. If either prerequisite is missing, run `npm run build:vite` first and only then spawn the server.
4. Keep both children attached to the terminal with inherited stdio. Log whether the server is serving a previous bundle and when the background build completes.
5. On a non-zero build exit, terminate the server and exit non-zero. On server failure or parent termination, terminate the other child and preserve the failure code.
6. Forward optional command-line arguments to `serve-with-fallback.js` so host/port overrides remain available without changing the build command.

The adapter is intentionally runnable before a fresh `build:ts` has produced `dist/scripts/*`; it performs the one-time `build:ts` preparation when the compiled orchestrator is missing or stale, then forwards to the TypeScript implementation. The canonical build and server implementations remain unchanged.

## Compatibility, concurrency, and failure behavior

- The server uses the existing `serve-with-fallback` artifact refresh, port selection, cache policy, and generated catalog behavior.
- The background build writes the same canonical/generated locations as the old command. No generated or mirror files are hand-edited.
- A refresh during the background build can temporarily serve the previous bundle or an incomplete replacement if the browser is refreshed at exactly the build boundary. The CLI makes this explicit; the first-run fallback avoids this state when no usable bundle exists.
- A failed build cannot be mistaken for success: the orchestrator shuts down the server and returns the build's non-zero status.
- SIGINT/SIGTERM cleanup is idempotent and terminates both children without destructive filesystem cleanup.

## Verification strategy

- Static/source checks: package script wiring, argument forwarding, reusable-bundle detection, and child lifecycle code.
- Focused Jest coverage for pure detection/argument helpers if the implementation exposes them without coupling tests to live processes.
- Runtime smoke: invoke `npm run dev` with an existing bundle, confirm the URL is emitted before the build completes, then confirm the background build exits successfully and the HTTP endpoint remains reachable.
- Missing-artifact smoke: use a non-destructive temporary fixture or helper-level test to confirm the foreground fallback decision without deleting repository artifacts.
- `npm run build:ts` and the focused tests required by `scripts/AGENTS.md`.
- Final `git diff --check`, status, and task-scoped diff inspection.

## Completion conditions

- `npm run dev` no longer blocks on `build:vite` when a usable previous bundle exists.
- The existing foreground `dev:vite` path remains available and unchanged in behavior.
- Build, server, signal, and non-zero exit handling are explicit and tested.
- No gameplay/browser runtime contract or generated source-of-truth file is changed.
- Focused verification passes and the task-owned diff is committed.

## Self-review

The initial idea of replacing the command with `vite` was rejected after a real browser smoke test produced `module is not defined` from the existing CommonJS wrapper. The design was revised to keep the production bundle/static delivery contract and move only the build out of the URL critical path. The revised design explicitly covers missing artifacts, stale-bundle visibility, child failure propagation, signal cleanup, and the fact that the current path has no HMR to preserve. A full ESM/CommonJS bridge migration remains a separate, higher-risk task rather than being hidden inside this startup fix.
