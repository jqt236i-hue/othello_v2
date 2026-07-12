# Repository hygiene cleanup implementation plan

- Status: completed
- Design: `docs/implementation/repository-hygiene-cleanup-design.md`
- Scope: current tracked-tree hygiene and stale ignored local-output cleanup

## Step 1: Add recurrence-prevention rules

- Outcome: disposable root artifacts and `.codegraph/` cannot be accidentally recommitted.
- Files: `.gitignore`.
- Dependency: reviewed cleanup design.
- Verification: `git check-ignore -v` against representative untracked probe names after tracked candidates are removed.
- Done condition: narrow rules cover `.codex-podium-*.json`, `session-ses_*.md`, root `tmp_*.json`, `*.lnk`, and `.codegraph/` without ignoring canonical project paths.

## Step 2: Remove tracked disposable files

- Outcome: the current Git tree no longer contains local visual diagnostics, a Windows shortcut, an empty deployment temporary file, or a raw assistant transcript.
- Files: nine `.codex-podium-*.json` files, `other.lnk`, `tmp_deploy.json`, and `session-ses_1fdf.md`.
- Dependency: Step 1 so recurrence is prevented in the same coherent change.
- Verification: task-scoped `git diff --stat` and `git ls-files` checks.
- Done condition: all twelve paths are absent from the working tree and appear only as intentional deletions in the task diff.

## Step 3: Remove stale ignored local outputs

- Outcome: recover about 1.85 GiB without deleting source, dependencies, training data, or active runtime caches, and remove the stale `.codegraph/` workspace junction without deleting its external target.
- Paths: `artifacts/`, three `tmp-live-spectator-check-*` directories, `.codegraph/`, `.playwright-mcp/`, `0/`, `8017/`, and `tmp-check-load.cjs`.
- Dependency: repeat absolute-path containment and process-reference checks immediately before deletion; inspect link type and handle `.codegraph/` as a non-recursive junction removal.
- Verification: filesystem non-existence checks for removed paths and existence checks for preserved large paths.
- Done condition: every selected stale path is absent; `worker-public/`, `data/`, `.venv/`, `node_modules/`, `dist/`, `.wrangler/`, and `othello-ai/` remain.

## Step 4: Verify repository contracts

- Outcome: cleanup is structurally safe and introduces no malformed diff.
- Components: Git index/worktree, artifact-retention check, ignore behavior.
- Dependency: Steps 1-3.
- Verification:
  - `npm run check:artifact-retention`;
  - `git diff --check`;
  - representative `git check-ignore -v` probes;
  - final task-scoped diff inspection.
- Done condition: all checks pass and no runtime, test, rulebook, Worker mirror, or unrelated files are changed.

## Step 5: Commit the isolated cleanup

- Outcome: a coherent cleanup commit exists on the current branch.
- Files: only `.gitignore`, the two implementation documents, and the twelve tracked deletions.
- Dependency: Step 4 passes and `git status --short` confirms the diff is separable from any newly appearing unrelated work.
- Verification: inspect staged diff, commit, then inspect final `git status --short` and `git show --stat --oneline HEAD`.
- Done condition: task-owned changes are committed; unrelated work, if any, remains unstaged and is reported.

## Completion checklist

- [x] Design completion conditions are all satisfied.
- [x] Canonical sources, shipped assets, tests, and tracked Worker mirror are preserved.
- [x] Large training/dependency/runtime paths marked for preservation still exist.
- [x] Selected stale ignored paths are gone.
- [x] Ignore rules prevent recurrence.
- [x] Artifact-retention and diff checks pass.
- [x] Final diff contains only task-owned files.
- [x] Cleanup commit is created.

## Execution results

- Removed twelve tracked disposable files and added five narrow ignore rules.
- Removed about 1.85 GiB of stale ignored local outputs.
- Removed only the `.codegraph/` junction; its external cache target was preserved.
- `npm run check:artifact-retention`: pass; TypeScript build and training typecheck also passed as prerequisites.
- `git diff --check`: pass.
- Representative `git check-ignore -v --no-index` probes matched every new rule.
- Selected stale paths are absent; all explicitly preserved large paths remain present.

## Self-review

The plan was revised to place ignore rules before tracked deletions and to repeat process/path safety checks immediately before local recursive deletion. After discovering that `.codegraph/` points outside the repository, the plan was revised again to remove only the junction itself and preserve the target. It deliberately omits `worker:prepare`, browser builds, and gameplay tests because no runtime or mirror source changes are planned. It also keeps local-output deletion separate from the Git diff so a failed filesystem cleanup cannot obscure the reviewable tracked-tree change.
