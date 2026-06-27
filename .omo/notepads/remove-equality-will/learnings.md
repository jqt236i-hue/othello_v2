# Learnings: Removing equality_will from module-registry.js

## File Structure

- `public/module-registry.js` is a generated file (~5.3MB) containing bundled JS modules.
- Each module is registered via `_r("module-name", "code_string")` on its own line.
- Internal code strings use literal `\n` (backslash + n, 2 chars) for newlines, NOT actual newlines.
- Actual newlines (0x0A) separate `_r()` calls.

## Key Regex Insight

When matching content INSIDE code strings (the second argument to `_r()`):
- In JS regex literals, `\\n` matches literal `\n` (backslash + n) - what's in the file
- In JS regex literals, `\n` matches a real newline character (0x0A)

## Approach That Worked

1. **Catalog entries (JSON arrays)**: Find the `\"id\": \"equality_will_01\"` pattern with escaped quotes, locate the JSON object boundaries, and remove the entry.
2. **Shared-constants CARD_DEFS**: Remove the card entry object with its preceding comment.
3. **Module-level references**: Use a `fixModule` helper that extracts a module's `_r()` line, applies targeted regexes, and replaces it.
4. **Final blanket pass**: For any remaining `'EQUALITY_WILL'` string literals, safely replace with `''` (empty string, valid JS).
