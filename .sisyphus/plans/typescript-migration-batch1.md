# Phase 8 TypeScript Migration - Remaining Major Files

## Objective
Complete TypeScript migration for all remaining major JavaScript files in the codebase.

## Files to Convert (Batch 1)

### Large Files (>3000 lines)
- [ ] game/ai/cpu-policy-core.js (5,093 lines)
- [ ] src/engine/selfplay-runner.js (4,085 lines)
- [ ] game/turn/turn_pipeline_phases.js (3,772 lines)
- [ ] ui/animation-engine.js (3,598 lines)
- [ ] game/turn/pipeline_ui_adapter.js (3,559 lines)

### Medium Files (2000-3000 lines)
- [ ] ui/network-client.js (2,835 lines)
- [ ] scripts/run-selfplay-training-cycle.js (2,763 lines)
- [ ] ui/diff-renderer.js (2,507 lines)
- [ ] ui/animation-utils.js (2,268 lines)
- [ ] scripts/local-match-server.js (2,185 lines)

### Smaller Files (<2000 lines)
- [ ] ui/handlers/match-mode.js (1,597 lines)
- [ ] scripts/generate-selfplay-data.js (1,579 lines)
- [ ] ui/result-overlay.js (1,431 lines)
- [ ] scripts/benchmark-policy-adoption.js (1,360 lines)
- [ ] game/card-effects/selection-flow.js (1,315 lines)
- [ ] ui/story/story-steps.js (1,293 lines)
- [ ] ui/board-renderer.js (1,292 lines)
- [ ] game/ai/policy-onnx-runtime.js (1,226 lines)
- [ ] game/cards/target-resolver.js (1,221 lines)
- [ ] game/game/cards/target-resolver.js (1,210 lines)
- [ ] ui/bootstrap.js (1,194 lines)
- [ ] ui/deck-builder-controller.js (1,133 lines)
- [ ] game/turn-manager.js (1,129 lines)
- [ ] scripts/benchmark-selfplay-policy.js (1,046 lines)
- [ ] ui.js (980 lines)
- [ ] scripts/load-training-profile.js (882 lines)
- [ ] game/ai/fixed-commentary-engine.js (877 lines)
- [ ] scripts/benchmark-policy-onnx-gate.js (862 lines)
- [ ] cards/catalog.js (844 lines)
- [ ] ui/network/snapshot.js (840 lines)

## Conversion Pattern

For each file:
1. Read the full .js file
2. Create .ts with:
   - `// @ts-nocheck` at top (for files >1000 lines)
   - `declare const __non_webpack_require__: NodeRequire | undefined;`
   - `_require` helper function
   - `import type { CardState, GameState, PlayerKey } from '../src/types';` (adjust path)
   - Convert UMD wrapper to direct imports
   - Add type annotations (use `any` for complex types)
   - `export = { ... }` at end
3. Replace .js with wrapper:
   ```js
   "use strict";
   /** @type {any} */
   module.exports = require('../dist/PATH/FILENAME');
   ```

## Verification
After each batch:
- `npx tsc --noEmit` must pass
- `npm run checkall` must pass

## Completion Criteria
- All listed files converted to TypeScript
- All wrappers pointing to dist/
- No compilation errors
- All checks passing
