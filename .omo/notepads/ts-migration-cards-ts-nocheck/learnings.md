# Learnings: Remove @ts-nocheck from game/logic/cards.ts and regen.ts

## Summary
Removed `// @ts-nocheck` from the last two remaining files in `game/logic/`:
- `game/logic/cards.ts` (5842 lines)
- `game/logic/cards/regen.ts` (454 lines)

## Patterns Used
1. Added `import type { CardState, GameState, PlayerKey }` for type imports (regen.ts only)
2. For callback params in `.filter()`, `.map()`, `.reduce()`, `.some()`, `.find()` etc: added `: any` to arrow function parameters
3. For function declarations with optional trailing params: used `?` to make params optional
4. For `never[]` arrays (initialized as `[]` in objects): added `: any` type assertion or `as any[]` cast
5. For `globalThis` property access: used `(globalThis as any).PROP`
6. For `Object.freeze()` readonly objects: used `(obj as any)[key]` cast for index access
7. For `new Set()` with string keys: used `new Set<string>()`
8. For variable implicitly `any`/`any[]`: added explicit `: any` or `: any[]` annotations

## Key Fixes
- **regen.ts**: Added `import type`, typed all function params, fixed `Set` generic, fixed callback params
- **cards.ts**: Made ~15 function params optional with `?`, fixed ~100+ callback params across `.filter()/.map()/.reduce()/.some()/.find()` calls, fixed 2 `never[]` issues with `as any[]`/`: any`, fixed 2 `rem` null-check issues, fixed 2 `globalThis` index access issues

## Verification
- `npx tsc --noEmit`: Zero new errors from cards.ts or regen.ts
- `npm run build:ts`: Succeeds
- 3 pre-existing errors in `game/cpu-turn-handler.ts` remain (unrelated scope)
