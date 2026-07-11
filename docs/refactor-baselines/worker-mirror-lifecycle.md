# Worker mirror lifecycle

Status: active contract  
Updated: 2026-07-11

## Decision

`worker-public/` remains a tracked, generated deployment mirror. It is the static asset directory served by `workers/match-worker.mjs`; root source files remain the only implementation authority.

The repository currently has 884 tracked mirror files. `npm run worker:prepare` rebuilds its generator-owned surface from root source, and its post-generation verification reported 893 mirrored source files during the 2026-07-11 refactor program.

Keeping the mirror tracked makes Worker deployment diffs reviewable while retaining deterministic regeneration. It must never be edited as source.

## Required workflow

1. Change the root source of truth.
2. Run `npm run worker:prepare` to regenerate the mirror.
3. Run `npm run check:worker-mirror` to validate the already-generated mirror without writing files.
4. Review and stage only generator-produced `worker-public/**` changes that correspond to the root change.

`npm run worker:dev` and `npm run worker:deploy` already invoke `worker:prepare`. Run the explicit prepare command when invoking Wrangler directly. `npm run checkall` also includes the read-only mirror guard.

## Guard coverage

`check:worker-mirror` verifies all root-owned files, optional copies, generated model assets, and the generated model availability manifest. It additionally rejects every file in `worker-public/` that is not part of the generator-owned output set. This detects both stale mirror content and manual-only additions without changing the mirror.
