# Browser Runtime Recovery Plan

## TL;DR

> **Summary**: Recover browser boot by separating **Node/CommonJS runtime artifacts** from **browser-safe runtime artifacts**. Keep existing `dist/` CommonJS output and CLI wrappers for Node workflows, and add **browser-specific generated classic-script artifacts** for `index.html` and `story-deck-lab.html`.
>
> **Why**: The current HTML entrypoints load CommonJS wrappers (`module.exports = require(...)`) as classic `<script>` tags, which fails in browser/Workers asset execution with `module is not defined` / `require is not defined`.
>
> **Recommended Strategy**: **Option A** — browser-specific generated classic-script artifacts, while preserving current CommonJS outputs for Node/npm scripts.

---

## Context

### Current Failure Mode

- `index.html` and `story-deck-lab.html` load long chains of classic `<script src="...js">` tags.
- Many loaded `.js` files are CommonJS wrappers or CommonJS-oriented generated files.
- In browser runtime, this fails with:
  - `ReferenceError: module is not defined`
  - `ReferenceError: require is not defined`
  - duplicate global declarations such as `Identifier 'path' has already been declared`
- `wrangler.toml` includes `compatibility_flags = ["nodejs_compat"]`, but this does **not** make classic HTML scripts behave like Node/CommonJS modules.

### Constraints

- Preserve gameplay, UI behavior, CPU behavior, networking behavior, and existing load-order semantics.
- Root is canonical.
- `worker-public/` is generated mirror only.
- Avoid new dependencies unless absolutely necessary.
- Keep existing Node/npm workflows working:
  - `npm run checkall`
  - `npm run worker:prepare`
  - CLI/selfplay/training scripts

### Repo Evidence

- `index.html` directly loads a large number of `.js` files under:
  - `constants/`
  - `shared/`
  - `utils/`
  - `game/logic/`, `game/cards/`, `game/card-effects/`, `game/ai/`, etc.
  - `ui/`
- Many TypeScript source files still contain CommonJS/global hybrid patterns such as:
  - `module.exports`
  - `require(...)`
  - `export =`
  - direct `globalThis.*` assignment/use
- `story-deck-lab.html` also depends on classic-script globals and load order.

---

## Recommendation

## Choose: Browser-Specific Generated Classic-Script Artifacts

### Why this is the safest option

This repo is not ready for a repo-wide ESM migration.

- A full ESM migration would require rewriting a very large implicit global graph.
- A browser `require/module` shim would be brittle and would hide real dependency-order bugs.
- Keeping current Node/CommonJS outputs while generating separate browser-safe artifacts has the smallest blast radius.

### What this means

Maintain **two runtime formats**:

1. **Node/CommonJS path**
   - Existing `dist/` output
   - Existing CLI wrappers / npm script behavior
   - Existing `checkall` / `worker:prepare` / training flows

2. **Browser/classic-script path**
   - New generated browser-safe artifacts
   - No unguarded `module`, `exports`, or `require`
   - Explicit global exposure for the symbols HTML currently relies on

---

## Deliverables

- A browser-specific output directory, for example one of:
  - `browser-dist/`
  - `public-dist/`
  - `worker-public/browser-dist/` (generated target only, not canonical source)
- Updated `index.html` to load browser-safe artifacts instead of CommonJS wrappers.
- Updated `story-deck-lab.html` to load browser-safe artifacts instead of CommonJS wrappers.
- Updated generation/mirroring flow so `worker-public/` receives browser-safe assets automatically.
- Verification that browser pages boot without:
  - `module is not defined`
  - `require is not defined`
  - wrapper-related 404s

---

## Implementation Plan

## Phase 1 — Inventory Browser Entry Dependencies

### Objective

Freeze the exact browser dependency graph before changing output strategy.

### Scope

- `index.html`
- `story-deck-lab.html`
- all directly loaded script targets under root canonical source

### Tasks

- Enumerate all `<script src="...">` assets loaded by `index.html`.
- Enumerate all `<script src="...">` assets loaded by `story-deck-lab.html`.
- Classify each loaded file as one of:
  - browser-safe already
  - CommonJS wrapper
  - CommonJS/global hybrid source
  - generated browser asset
- Record global names expected by inline scripts or later modules.

### Acceptance Criteria

- Exact browser boot graph is documented.
- No loaded asset remains “unknown format”.

---

## Phase 2 — Define Browser Artifact Strategy

### Objective

Choose one browser output format and keep it narrow.

### Recommended Output Shape

- **One generated browser runtime artifact for `index.html`**
- **One generated browser runtime artifact for `story-deck-lab.html`**

These may be:

- page-level bundled classic scripts, or
- a very small set of page-level classic browser artifacts

### Hard Requirements

- Must execute as plain browser scripts.
- Must not require Node globals.
- Must preserve current load order semantics and global side effects.
- Must not replace existing Node/CommonJS dist contract.

### Acceptance Criteria

- Browser artifact strategy is fixed before implementation.
- Output path is clearly separated from Node/CommonJS outputs.

---

## Phase 3 — Implement Browser Artifact Generation

### Objective

Generate browser-safe JS from canonical source without changing canonical business logic.

### Scope

- browser generation script/config
- selected source modules required by HTML entrypoints

### Tasks

- Add browser generation step that emits classic browser-safe output.
- Ensure generated files expose the globals expected today.
- Ensure generated files contain no unguarded:
  - `module.exports`
  - `exports.`
  - `require(`
- Ensure generated files avoid duplicate global declarations like repeated `const path = ...` in shared global scope.

### Risks

- Hidden order dependencies between current classic scripts
- modules that mix Node/CommonJS and browser global assumptions in one file
- generated catalogs that currently contain syntax not safe for browser classic execution

### Acceptance Criteria

- Generated browser files are syntactically valid in browser.
- Generated browser files expose expected globals.

---

## Phase 4 — Update HTML Entry Points

### Objective

Point browser pages at browser-safe artifacts only.

### Scope

- `index.html`
- `story-deck-lab.html`

### Tasks

- Replace script references to CommonJS wrappers with browser-safe generated assets.
- Keep existing inline boot code working.
- Preserve page-specific requirements:
  - main game page boot sequence
  - story deck lab bootstrap and globals

### Must Not Do

- Do not point HTML directly to `dist/` CommonJS files.
- Do not leave mixed browser and CommonJS runtime assets in the same boot path.

### Acceptance Criteria

- No script tag in browser pages points to CommonJS wrapper files.
- Boot order remains deterministic.

---

## Phase 5 — Mirror Integration

### Objective

Ensure `worker-public/` gets browser-safe artifacts automatically.

### Scope

- `scripts/prepare-worker-assets.ts`
- generated browser asset output
- `worker-public/`

### Tasks

- Add browser artifacts to the prepare/mirror flow.
- Mirror browser-safe outputs into `worker-public/`.
- Keep root canonical and `worker-public/` generated only.

### Acceptance Criteria

- `npm run worker:prepare` succeeds.
- `worker-public/` contains everything required for browser boot.

---

## Phase 6 — Verification

### Required Commands

```bash
npm run build:ts
npx tsc --noEmit
npm run checkall
npm run worker:prepare
```

### Browser Verification Checklist

1. `index.html` loads with no console errors for:
   - `module is not defined`
   - `require is not defined`
2. `index.html` has no wrapper-related 404s.
3. `story-deck-lab.html` loads with the same guarantees.
4. Basic game boot succeeds:
   - board renders
   - reset works
   - UI init completes
5. Basic story deck lab boot succeeds.

### Static Verification Checklist

Search browser-loaded/generated assets for unguarded:

- `module.exports`
- `exports.`
- `require(`

Search HTML entrypoints to confirm they no longer reference CommonJS wrapper files.

---

## Main Risks

### 1. Hidden Global/Load-Order Coupling

Current code heavily relies on globals and ordered script execution. Any browser artifact generation must preserve that contract.

### 2. Mixed Runtime Assumptions in Source Files

Some files combine:

- `module.exports`
- `require(...)`
- `globalThis.*`
- browser globals

These may require targeted adaptation in browser generation.

### 3. Drift Between Node and Browser Outputs

If browser artifacts become hand-maintained, the system will regress quickly. They must be generated from canonical source.

---

## Explicit Non-Goals

- Full repo-wide ESM migration
- Rewriting all game/ui modules to modern import/export in one pass
- Browser `require/module` shimming as the primary solution
- Hand-editing `worker-public/`

---

## Success Criteria

- Browser pages run without CommonJS runtime errors.
- Existing Node/CommonJS CLI flows still work.
- `worker-public/` remains generated and valid.
- `index.html` and `story-deck-lab.html` no longer rely on CommonJS wrappers.
- Behavior remains unchanged from the user’s perspective.

---

## Recommended Execution Order

1. Freeze browser dependency inventory.
2. Implement browser artifact generation.
3. Switch HTML entrypoints.
4. Integrate `worker:prepare` mirroring.
5. Verify with Playwright and DevTools.

---

## Notes for Future Work

If this browser artifact layer stabilizes, a later project may consider:

- shrinking the global surface,
- reducing `module.exports` hybrids,
- or migrating page boot to explicit ESM.

That is a separate modernization effort, not part of this recovery plan.
