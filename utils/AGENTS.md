# utils/ AGENTS.md

Canonical normalization / authority helper subtree. Use this file with the root `AGENTS.md` as the local boundary guide.

## WHERE TO LOOK

| Task | Start here | Notes |
| --- | --- | --- |
| Owner / seat normalization | `owner-helpers.ts` | Canonical owner/player/layout normalization; do not fork equivalent helpers elsewhere. |
| Match authority contract | `match-authority.ts` | Seat token, operationId, projection, SSE, publish-version helpers. |
| Safe cloning helper | `deepClone.ts` | Shared copy helper for authority / projection paths. |

## CONVENTIONS

- Keep helpers runtime-safe across browser, worker, and Node unless the file is explicitly authority-only.
- Normalize ambiguous `owner` / `player` / seat-key shapes at the helper boundary, then keep internal forms stable.
- Prefer importing these helpers over copying tiny “just for this file” variants into `ui/`, `game/`, or `workers/`.
- Paired `.js` files are compatibility outputs; update `.ts` first.

## ANTI-PATTERNS

- Creating a second owner/player normalization path outside `owner-helpers.ts`.
- Re-implementing seat token, operationId, or public-seat shaping outside `match-authority.ts`.
- Mixing DOM/UI concerns into authority helpers.
- Changing canonical payload/normalization formats in one caller without updating the shared helper.

## VERIFICATION

- Focused tests usually start with `test/utils.*`, `test/network.*`, `test/local-match-server*`, or `test/workers.*`.
- TypeScript changes need `npm run typecheck` and `npm run build:ts`.
- Authority contract changes should include `npm run test:network:parity`.
