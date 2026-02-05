Patch bundle for local changes

This folder contains patches representing the local changes made to enforce the game ↔ UI DI boundary and related checks.

Files:
- 0001-0005: sequential git-format-patch files (in order).

How to apply:
- Using git: `git am patches/*.patch` (apply in order)
- Or review and apply manually: `git apply` or copy-paste the diffs

Notes:
- Changes were tested locally: `npm run checkall` and `npm test` both pass.
- CI job `check` was added to `.github/workflows/node-test.yml` but the repo remote push was intentionally not performed (local-only workflow).

If you want me to create a single combined patch file instead, tell me and I will generate `patches/combined.patch`.
