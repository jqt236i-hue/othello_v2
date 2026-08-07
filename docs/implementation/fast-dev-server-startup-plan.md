# Fast local dev-server startup implementation plan

- Status: completed
- Design: `docs/implementation/fast-dev-server-startup-design.md`
- Scope: make repeated `npm run dev` startup expose the existing local bundle before the next build completes, while preserving the current foreground build path and browser delivery contract.

## Step 1: Add tested orchestration helpers

- Outcome: the new CLI has pure, inspectable helpers for reusable-bundle detection, server command construction, build command construction, and child cleanup decisions.
- Files: `scripts/dev-vite-fast.ts`, `scripts/dev-vite-fast.js`; focused script test under `test/` or `scripts/__tests__/` if the helpers are exported.
- Dependency: reviewed design.
- Verification: focused Jest test plus source inspection.
- Done condition: helper behavior covers reusable output, missing output, argument forwarding, and platform npm command selection without starting real child processes.

## Step 2: Wire `npm run dev` to the fast path

- Outcome: `npm run dev` starts the existing server before a background `build:vite` when reusable output exists, and falls back to foreground build on first run.
- Files: `package.json`; `scripts/dev-vite-fast.ts`, `scripts/dev-vite-fast.js`; `docs/typescript-migration-js-allowlist.json`.
- Dependency: Step 1.
- Verification: `npm run dev` runtime smoke with the current bundle; confirm URL/server availability, build completion, and clean child shutdown.
- Done condition: the URL is emitted without waiting for the background build in the warm path, and non-zero build/server exits are not swallowed.

## Step 3: Verify build compatibility and final delivery

- Outcome: the existing build path and repository script boundary remain valid after the new entrypoint is added.
- Files: task-owned source/docs only; no hand-edited generated outputs.
- Dependency: Steps 1-2.
- Verification: focused Jest, `npm run build:ts`, `git diff --check`, final status/diff inspection.
- Done condition: all focused checks pass, the design and plan match the final implementation, and only task-owned files are committed.

## Completion checklist

- [x] Reviewed design exists and its self-review reflects the final approach.
- [x] Fast orchestrator detects warm/missing artifacts and handles child lifecycles.
- [x] `npm run dev` is wired to the fast path.
- [x] Existing `npm run dev:vite` foreground behavior remains available.
- [x] Focused tests and runtime smoke pass.
- [x] `npm run build:ts` passes.
- [x] `git diff --check` and final status/diff inspection pass.
- [x] Task-owned changes are committed.

## Execution record

- Implemented the orchestrator in TypeScript with a thin Node CLI adapter, including clean-checkout `build:ts` preparation and the compiled-output root resolution required by `dist/scripts` execution.
- `npm run build:ts`: passed.
- Focused Jest coverage (`test/scripts.vite-entry.test.ts`, `test/scripts.dev-vite-fast.test.ts`): 2 suites / 8 tests passed.
- `node dist/scripts/inventory-js-legacy.js`: passed with `unknown=0`, `legacy-implementation=0`; the adapter is classified as `node-cli-adapter`.
- `npm run checkall`: passed.
- Warm `npm run dev` smoke: HTTP endpoint became reachable in approximately 1.1 seconds; the background browser build completed successfully in approximately 40.2 seconds; no listener remained after cleanup.
- Direct Vite development serving remains intentionally out of scope because the existing CommonJS browser bridge fails browser boot under an unbundled Vite dev server.

## Self-review

The plan follows the reviewed design and keeps the canonical build/server implementations untouched. It separates pure helper verification from the live-process smoke, includes the missing-artifact fallback, and does not require generated browser or Worker output because no canonical runtime source changes. The only remaining risk is the documented short stale/incomplete bundle window during a warm background rebuild; the plan verifies the endpoint after build completion and leaves the foreground path available when strict sequencing is required.
