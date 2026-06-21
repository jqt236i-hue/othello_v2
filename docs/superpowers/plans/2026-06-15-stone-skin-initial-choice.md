# Stone Skin Initial Choice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an initially owned selectable normal-stone skin using the provided black/white images without changing gameplay authority.

**Architecture:** Follow the existing cosmetic pattern: `catalog`, `selection`, `runtime`, and `controller` modules under `ui/stone-skin/`. The runtime owns CSS variable application for normal stone images; board rendering continues to consume `--normal-stone-black-image` and `--normal-stone-white-image`.

**Tech Stack:** TypeScript browser modules, CommonJS wrappers, JSDOM/Jest tests, CSS custom properties, localStorage.

---

### Task 1: Stone Skin Catalog And Selection

**Files:**
- Create: `ui/stone-skin/catalog.ts`
- Create: `ui/stone-skin/catalog.js`
- Create: `ui/stone-skin/selection.ts`
- Create: `ui/stone-skin/selection.js`
- Test: `test/ui.stone-skin-catalog.test.ts`
- Test: `test/ui.stone-skin-selection.test.ts`

- [ ] **Step 1: Write failing catalog tests**

```ts
const catalog = require('../ui/stone-skin/catalog.ts');

test('stone skin catalog exposes default and O-stone as owned skins', () => {
  const skins = catalog.getOwnedStoneSkins(global.window || globalThis);
  expect(skins.map((skin: any) => skin.id)).toEqual(['default', 'o-stone']);
  expect(catalog.getStoneSkinDefinition('o-stone', global.window || globalThis)).toEqual(expect.objectContaining({
    id: 'o-stone',
    blackImagePath: 'assets/images/stone-skin/o-stone/black.png',
    whiteImagePath: 'assets/images/stone-skin/o-stone/white.png'
  }));
});
```

- [ ] **Step 2: Run catalog test and verify RED**

Run: `npx jest test/ui.stone-skin-catalog.test.ts --runInBand`

Expected: FAIL because `ui/stone-skin/catalog.ts` does not exist.

- [ ] **Step 3: Implement catalog and wrapper**

Create a two-item catalog with `default` and `o-stone`; all entries are initial owned items. The default image paths must remain `assets/images/stone-skin/default/black.png` and `assets/images/stone-skin/default/white.png`.

- [ ] **Step 4: Write failing selection tests**

```ts
const selection = require('../ui/stone-skin/selection.ts');

test('stone skin selection stores and normalizes selected skin', () => {
  window.localStorage.setItem(selection.STONE_SKIN_STORAGE_KEY, 'o-stone');
  expect(selection.readStoredStoneSkinId(window)).toBe('o-stone');
  expect(selection.writeStoredStoneSkinId(window, 'missing')).toBe(true);
  expect(selection.readStoredStoneSkinId(window)).toBe('default');
});
```

- [ ] **Step 5: Run selection test and verify RED**

Run: `npx jest test/ui.stone-skin-selection.test.ts --runInBand`

Expected: FAIL because selection module does not exist.

- [ ] **Step 6: Implement selection and wrapper**

Use storage keys `reversi.stoneSkin` and `othello.stoneSkin`; normalize through catalog before writing.

### Task 2: Runtime Application

**Files:**
- Create: `ui/stone-skin/runtime.ts`
- Create: `ui/stone-skin/runtime.js`
- Test: `test/ui.stone-skin-runtime.test.ts`

- [ ] **Step 1: Write failing runtime tests**

```ts
const runtime = require('../ui/stone-skin/runtime.ts');

test('stone skin runtime applies selected normal stone image variables', () => {
  const applied = runtime.syncDisplayedStoneSkin(window, 'o-stone');
  expect(applied.id).toBe('o-stone');
  expect(document.documentElement.getAttribute('data-stone-skin-id')).toBe('o-stone');
  expect(document.documentElement.style.getPropertyValue('--normal-stone-black-image')).toBe('url("assets/images/stone-skin/o-stone/black.png")');
  expect(document.documentElement.style.getPropertyValue('--normal-stone-white-image')).toBe('url("assets/images/stone-skin/o-stone/white.png")');
});
```

- [ ] **Step 2: Run runtime test and verify RED**

Run: `npx jest test/ui.stone-skin-runtime.test.ts --runInBand`

Expected: FAIL because runtime module does not exist.

- [ ] **Step 3: Implement runtime and wrapper**

Set `data-stone-skin-id` on `documentElement`, update both normal-stone CSS variables, and call `window.renderBoard()` when requested by the controller after selection.

### Task 3: Appearance Panel Integration

**Files:**
- Modify: `index.html`
- Modify: `ui/hand-skin/controller.ts`
- Modify: `styles-base.css`
- Modify: `styles-layout-controls.css`
- Test: `test/ui.hand-skin-handler.test.ts`

- [ ] **Step 1: Write failing panel test**

Add a JSDOM test that includes `appearanceTabStone`, `stoneSkinSection`, and `stoneSkinOptions`, opens setup, clicks the 石 tab, selects `o-stone`, and asserts the root CSS variables changed.

- [ ] **Step 2: Run panel test and verify RED**

Run: `npx jest test/ui.hand-skin-handler.test.ts --runInBand`

Expected: FAIL because the controller does not know the stone tab.

- [ ] **Step 3: Implement panel integration**

Add a 石 tab in `index.html`; extend `ui/hand-skin/controller.ts` to resolve `StoneSkinControllerModule`, initialize it, refresh it on panel open, and route `selectAppearanceTab('stone')`.

- [ ] **Step 4: Add stone option CSS**

Reuse existing visual language from hand/background/font options. The option preview must show black and white stone samples side by side.

### Task 4: Assets, Registry, Docs, And Verification

**Files:**
- Copy: `C:\Users\quarr\Desktop\01-black-o.png` to `assets/images/stone-skin/o-stone/black.png`
- Copy: `C:\Users\quarr\Desktop\01-white-o.png` to `assets/images/stone-skin/o-stone/white.png`
- Modify: `01-rulebook.md`
- Generated: `public/module-registry.js`
- Generated/mirror: `worker-public/*`

- [ ] **Step 1: Copy assets**

Use `Copy-Item` into `assets/images/stone-skin/o-stone/`.

- [ ] **Step 2: Update rulebook**

Add a short player-visible note that the appearance settings include selectable normal-stone skins and that the new O-stone skin is initially owned.

- [ ] **Step 3: Regenerate browser/worker outputs**

Run: `npm run build:ts`

Run: `npm run worker:prepare`

- [ ] **Step 4: Verify focused tests**

Run: `npx jest test/ui.stone-skin-catalog.test.ts test/ui.stone-skin-selection.test.ts test/ui.stone-skin-runtime.test.ts test/ui.hand-skin-handler.test.ts test/ui.stone-rendering.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Inspect diff and commit separable task changes**

Run: `git status --short` and inspect diffs. Stage only stone-skin task files, excluding pre-existing unrelated pass/worker changes.
