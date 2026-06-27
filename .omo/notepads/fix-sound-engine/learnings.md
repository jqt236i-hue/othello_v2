# learnings.md

## 2026-05-03: Removed duplicate `const _require` block from sound-engine.ts

- File location: `C:\Users\quarr\Desktop\othello_v2\sound-engine.ts` (NOT in `game/` subdirectory; at root)
- The file had two identical blocks: lines 2-6 (first) and lines 12-16 (second duplicate)
- Both blocks declared `declare const __non_webpack_require__` and `const _require`
- Removed the second block (lines 12-16), preserving the first
- After removal:
  - `const _require` → 1 match (line 4)
  - `declare const __non_webpack_require__` → 1 match (line 2)
- LSP (typescript-language-server) not installed in env but changes are purely structural removal — no logic change
- File reduced from 839 to 833 lines

## 2026-05-03: Added `window.SoundEngine = _mod135.default` to entry-browser.js

- File: `C:\Users\quarr\Desktop\othello_v2\entry-browser.js`
- Added after line 1134 (`if (_mod135) Object.assign(window, _mod135);`) in the `dist/sound-engine` try-catch block
- New line (now line 1135): `  if (_mod135 && _mod135.default) window.SoundEngine = _mod135.default;`
- Why: The module exports `{ default: SoundEngine }`. `Object.assign(window, _mod135)` sets `window.default = SoundEngine`, but NOT `window.SoundEngine`. Downstream `ui/handlers/sound.ts:13` looks for `globalThis.SoundEngine`/`window.SoundEngine`.
- Pattern aligned with `entry-browser-augmented.js` line 284
- Verified: `node --check entry-browser.js` passes (exit code 0)
- Verified: grep confirms the line exists at line 1135
