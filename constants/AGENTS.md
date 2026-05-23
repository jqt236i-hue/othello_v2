# constants/ AGENTS.md

Single-source constants boundary. Use this file with the root `AGENTS.md` as the local boundary guide.

## Where to edit

| Task | Start here | Notes |
| --- | --- | --- |
| Shared meaning across runtimes | `../shared-constants.ts`, `../shared-constants.js` | Root shared constants entry; `.js` is shimmed through `dist`. |
| Domain-specific constants | `*` | Keep values near the owning domain when not broadly shared. |
| CPU Lv6 shared defaults | `cpu-lv6-shared-profile.js` | Also referenced by `../docs/architecture-contracts.md` §5.2. |
| Mirror copy | `../worker-public/constants/*` | Mirror only; do not edit first. |

## Rules

- Put the same semantic value in one place only.
- Do not hardcode UI-only constants into `game/`.
- Prefer enum/map/helper shapes that make caller updates obvious.
- Rename widely used constants only with callers updated in the same task.

## Duplication traps

- `shared-constants.ts` / `shared-constants.js` / `src/shared-constants.js` are not separate sources.
- Root constants and `worker-public/constants/` must not diverge.
- Decision-mode / profile defaults must not be reimplemented in UI, game, and scripts separately.

## Verification

- Search for duplicate literal/name variants after adding or renaming constants.
- Run focused tests for the owning domain.
- `.ts` changes require `npm run typecheck` and `npm run build:ts`.
