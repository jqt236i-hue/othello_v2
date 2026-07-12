# Repository hygiene cleanup design

- Status: reviewed design
- Target: current checkout hygiene and prevention of disposable-root-file recurrence
- Source of truth: root `AGENTS.md`, `docs/refactor-baselines/artifact-retention-policy.md`, and `docs/refactor-baselines/worker-mirror-lifecycle.md`
- Non-goals: gameplay changes, Worker mirror lifecycle changes, ML data removal, dependency removal, Git history rewriting, or modification of unrelated in-progress work

## Problem and desired outcome

The checkout contains a small set of tracked files that are clearly local tool output rather than repository source, plus several ignored and stale local-output directories consuming about 1.85 GiB. The Git object database is also large, but changing reachable history is a separate destructive operation and is not part of this cleanup.

The desired outcome is a smaller and less leak-prone current checkout while preserving every canonical source, shipped asset, test fixture, dependency environment, training artifact, and generated deployment contract required by the project.

## Repository evidence

- `git status --short` was clean after the unrelated network refresh-button work committed as `05cb30ff4`.
- `docs/refactor-baselines/worker-mirror-lifecycle.md` explicitly requires `worker-public/` to remain a tracked generated deployment mirror.
- `docs/refactor-baselines/artifact-retention-policy.md` defines `artifacts/` as disposable local output with an empty tracked allowlist.
- The tracked root candidates have no runtime or test consumers:
  - nine `.codex-podium-*.json` visual-measurement intermediates;
  - `other.lnk`, a Windows shortcut;
  - `tmp_deploy.json`, an empty temporary file;
  - `session-ses_1fdf.md`, an unreferenced assistant-session transcript containing prompts and work logs rather than durable project documentation.
- Strong secret-marker scanning found no tracked GitHub token, AWS access-key, or private-key marker in the current tree. This does not make historical publication safe by itself; history review remains a separate concern.
- The following ignored paths are stale and have no running process whose command line references them:
  - `artifacts/` (about 30.81 MiB);
  - three `tmp-live-spectator-check-*` directories (about 1.82 GiB total, last modified 2026-06-18);
  - `.codegraph/`, which is a workspace junction to `C:\Users\quarr\.omo\codegraph\projects\othello_v2-c5fdc6c362bef322` rather than an in-repository cache directory;
  - `.playwright-mcp/` (about 0.36 MiB, no tracked files);
  - root `0/` and `8017/` temporary model-manifest directories;
  - `tmp-check-load.cjs`.

## Scope and safety constraints

### Remove from the tracked tree

- `.codex-podium-*.json`
- `other.lnk`
- `tmp_deploy.json`
- `session-ses_1fdf.md`

### Prevent recurrence

Add narrow ignore rules for Codex podium diagnostics, root assistant-session transcripts, root temporary JSON, Windows shortcuts, and `.codegraph/`. Existing broader rules continue to own logs, `artifacts/`, `tmp-*`, build outputs, dependencies, and training data.

### Remove only from the local ignored working tree

Delete the stale paths listed above only after resolving each absolute path under the repository root and rechecking that no process command line references it. Remove only the `.codegraph/` junction itself; do not recurse into or delete its external target. These removals do not become Git diffs.

### Preserve

- `worker-public/`, because the active contract requires a tracked mirror;
- `data/`, `othello-ai/` local training outputs, `.venv/`, and model artifacts, because they can be expensive or irreplaceable inputs;
- `node_modules/`, `dist/`, and `.wrangler/`, because active Node/Python processes were observed and these paths may support current work;
- root source, shipped assets, tests, visual-regression baselines, `.codex/`, and `.opencode/`;
- all unrelated commits and working-tree changes.

## Alternatives considered

1. Delete every large ignored directory. Rejected because training data and environments may be costly or impossible to reconstruct, and active processes make build/runtime cache deletion unsafe.
2. Stop tracking `worker-public/`. Rejected because the active lifecycle decision deliberately keeps it tracked for reviewable Worker deployment diffs.
3. Rewrite Git history now. Rejected for this task because it changes commit IDs and remote coordination requirements; current-tree cleanup can be completed independently and verified first.
4. Keep the root transcript as historical documentation. Rejected because it is a raw tool-session transcript, duplicates durable TypeScript migration documentation, exposes development prompts, and has no repository consumer.

## Chosen design

Perform a narrow two-layer cleanup:

1. Make a reviewable Git change deleting only the twelve tracked disposable files and adding narrow ignore rules.
2. Separately delete stale ignored local outputs after path and process-use validation.

No production code, gameplay specification, generated catalog, or Worker mirror file changes. The cleanup remains reversible from Git for tracked deletions, while ignored local output deletion is limited to items already classified as disposable or clearly stale tool output.

## Security, compatibility, and failure behavior

- Removing `other.lnk` and the raw assistant transcript reduces accidental disclosure of local paths and internal work prompts in future public snapshots.
- Ignore rules prevent the same artifact classes from being recommitted.
- A failed local deletion stops on the affected path and leaves canonical files untouched.
- The cleanup does not claim to remove artifacts from historical commits; a later history rewrite must use a disposable mirror clone, backup refs, and explicit remote coordination.
- Worker and browser behavior remain unchanged because no runtime source or generated deployment surface is modified.

## Verification strategy

- `git status --short` and task-scoped `git diff` inspection.
- `git check-ignore -v` for representative recurrence patterns.
- `git ls-files` checks proving all twelve tracked candidates are absent.
- `npm run check:artifact-retention` to preserve the active artifact contract.
- `git diff --check` for the task diff.
- Filesystem checks proving selected ignored paths no longer exist while preserved large paths still exist.
- No gameplay or browser build is required because the change is repository hygiene only and does not affect root browser sources.

## Completion conditions

- All twelve tracked disposable files are removed.
- Narrow ignore rules cover their artifact classes and `.codegraph/`.
- Selected stale ignored local outputs are absent.
- `worker-public/`, `data/`, `.venv/`, `node_modules/`, `dist/`, `.wrangler/`, and `othello-ai/` remain present.
- Artifact-retention and diff checks pass.
- The task-owned diff is committed without staging unrelated work.

## Self-review

The initial cleanup idea considered untracking `worker-public/`, but repository evidence disproved that option: the active lifecycle contract explicitly requires a tracked mirror. The design was revised to preserve it. The initial disk-size inventory also made broad cache deletion look attractive, but active processes and expensive training data make that unsafe; the final scope deletes only stale ignored paths with no process references. A later filesystem check showed that `.codegraph/` is an external-target junction, so the design was revised again to remove only the workspace link and preserve the external cache. No independent reviewer is needed because the final change is non-runtime, narrowly enumerated, and guarded by existing repository contracts.
