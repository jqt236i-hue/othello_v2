# Consecutive Pass UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a temporary `連続パスN/2` HUD below the bottom `布石` HUD, matching the game's two-consecutive-pass end condition.

**Architecture:** Keep the game rule authority in `gameState.consecutivePasses`; the browser UI only derives display state from `consecutivePasses`, current pass availability, and result-overlay state. Reuse the existing card-detail action-state path because it already computes `canShowPass` from legal moves, placement locks, pending selections, busy state, and turn ownership.

**Tech Stack:** TypeScript browser modules, classic DOM/CSS, Jest + JSDOM, existing TypeScript build and worker mirror scripts.

---

## Preflight Notes

Current checkout already has unrelated dirty files. Before implementation, run `git status --short` and only stage files changed for this task. Do not edit `worker-public/` by hand; run `npm run worker:prepare` after root source changes if mirror output is needed.

This plan assumes these source-of-truth files:

- `01-rulebook.md`: player-visible UI behavior spec.
- `index.html`: root browser DOM source.
- `styles-charge-hud.css`: charge HUD styling; this is the closest visual home for the new HUD.
- `cards/card-interaction-detail-actions.ts`: testable action-state derivation and pass-button sync.
- `cards/card-interaction.ts`: browser integration and dependency injection.
- `ui/result-overlay.ts`: result screen lifecycle.

Generated or mirror files:

- `cards/card-interaction-detail-actions.js`
- `cards/card-interaction.js`
- `ui/result-overlay.js`
- `public/module-registry.js`
- `worker-public/*`

These should be updated through `npm run build:ts`, `npm run build:browser`, or `npm run worker:prepare`, not hand edited.

## Display Contract

The UI model is:

```ts
type ConsecutivePassStatusModel = {
  shouldShow: boolean;
  count: number;
  max: 2;
  text: string;
};
```

The display rule is:

```ts
shouldShow =
  result overlay is not being shown
  && (gameState.consecutivePasses > 0 || current local action state can show pass)
```

The text is:

```text
連続パス0/2  // only when pass is currently available and consecutivePasses is 0
連続パス1/2  // after one accepted pass, until a non-pass turn resets the count
連続パス2/2  // after the second accepted pass, during the short transition before result overlay
```

When `gameState.__resultShown === true` or the result overlay is created, the HUD is hidden.

---

### Task 1: Document the Player-Visible Rule

**Files:**
- Modify: `01-rulebook.md`

- [ ] **Step 1: Add the UI spec under the UI display section**

Add this subsection after `### 12.8 布石差分表示`:

```markdown
### 12.9 連続パス表示

- 連続パス表示は常設 HUD ではなく、パス可能状態または直近パスがある時だけ表示する
- 表示位置は下側の `布石` HUD の真下とし、カード UI との隙間を使う
- 表示文言は `連続パスN/2` とする
- `連続パス0/2` は、現在手番プレイヤーがパス可能な時だけ表示する
- `連続パス1/2` は、どちらか一方のパスが成立した後、連続パス数がリセットされるまで表示する
- `連続パス2/2` は、2連続パス成立後からリザルト表示へ入るまでの対局画面上で表示してよい
- 石配置やカード効果など、パス以外の手番完了で連続パス数が `0` に戻ったら非表示にする
- リザルト画面・結果表示中には表示しない
```

- [ ] **Step 2: Verify the spec text is findable**

Run:

```powershell
rg -n "連続パス表示|連続パスN/2|リザルト画面" 01-rulebook.md
```

Expected: the new subsection lines are printed.

- [ ] **Step 3: Commit the documentation unit**

Run:

```powershell
git add 01-rulebook.md
git commit -m "docs: specify consecutive pass UI"
```

---

### Task 2: Add the Static HUD DOM and Styling

**Files:**
- Modify: `index.html`
- Modify: `styles-charge-hud.css`

- [ ] **Step 1: Add the static DOM under `#charge-hud-layer`**

In `index.html`, inside `#charge-hud-layer`, place the new element after the bottom charge HUD elements:

```html
<div id="consecutive-pass-status" class="pass-streak-status" hidden aria-hidden="true" aria-live="polite" aria-atomic="true">
    <span class="pass-streak-label">連続パス</span><span class="pass-streak-current" data-pass-streak-current="true">0</span><span class="pass-streak-separator">/</span><span class="pass-streak-max">2</span>
</div>
```

Keep this inside `#charge-hud-layer` so it shares the same absolute positioning context as `#charge-black`.

- [ ] **Step 2: Add the visual style near `.charge-display` in `styles-charge-hud.css`**

Add this block after the `#charge-black` / `#charge-white` rules:

```css
.pass-streak-status {
    position: absolute;
    left: 50%;
    bottom: calc(var(--layout-size-charge-offset) + var(--layout-charge-own-offset) - (29px * var(--layout-stage-scale)));
    transform: translateX(-50%);
    box-sizing: border-box;
    min-width: calc(116px * var(--layout-stage-scale));
    height: calc(22px * var(--layout-stage-scale));
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: calc(2px * var(--layout-stage-scale));
    padding: calc(2px * var(--layout-stage-scale)) calc(10px * var(--layout-stage-scale));
    border: max(1px, calc(1px * var(--layout-stage-scale))) solid rgba(255, 205, 120, 0.62);
    border-radius: calc(5px * var(--layout-stage-scale));
    background:
        linear-gradient(90deg, rgba(131, 34, 31, 0.2), transparent 36%),
        linear-gradient(180deg, rgba(39, 25, 15, 0.96), rgba(10, 6, 5, 0.94));
    color: #ffe0ad;
    font-family: var(--selected-app-font-readable-family);
    font-size: calc(12px * var(--layout-stage-scale));
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' 1;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    pointer-events: none;
    z-index: var(--layout-z-charge-display);
    box-shadow:
        0 calc(5px * var(--layout-stage-scale)) calc(10px * var(--layout-stage-scale)) rgba(0, 0, 0, 0.48),
        inset calc(3px * var(--layout-stage-scale)) 0 0 rgba(194, 64, 55, 0.34);
    white-space: nowrap;
}

.pass-streak-status[hidden] {
    display: none !important;
}

.pass-streak-status .pass-streak-label {
    color: rgba(255, 221, 164, 0.82);
}

.pass-streak-status .pass-streak-current {
    color: #fff1c7;
    min-width: calc(8px * var(--layout-stage-scale));
    text-align: right;
}

.pass-streak-status .pass-streak-separator,
.pass-streak-status .pass-streak-max {
    color: rgba(255, 215, 145, 0.74);
}
```

This keeps the component compact and below the bottom `布石` HUD without adding a new card-panel dependency.

- [ ] **Step 3: Run a source grep check**

Run:

```powershell
rg -n "consecutive-pass-status|pass-streak-status" index.html styles-charge-hud.css
```

Expected: one DOM hit in `index.html` and CSS hits in `styles-charge-hud.css`.

- [ ] **Step 4: Commit the DOM/CSS unit**

Run:

```powershell
git add index.html styles-charge-hud.css
git commit -m "ui: add consecutive pass HUD shell"
```

---

### Task 3: Add a Testable Pass Status Model

**Files:**
- Modify: `test/ui.card-interaction-detail-actions-module.test.ts`
- Modify: `cards/card-interaction-detail-actions.ts`

- [ ] **Step 1: Write failing model and DOM-sync tests**

Update the import in `test/ui.card-interaction-detail-actions-module.test.ts`:

```ts
import {
  createCardInteractionDetailActions,
  getPendingSelectionPrompt as getPendingSelectionPromptStatic,
  isHandOverlayPendingSelectionFallback,
  resolveConsecutivePassStatusModel
} from '../cards/card-interaction-detail-actions';
```

Add this DOM element to `createController`'s JSDOM body:

```html
<div id="consecutive-pass-status" hidden aria-hidden="true">
  <span class="pass-streak-label">連続パス</span><span class="pass-streak-current" data-pass-streak-current="true">0</span><span class="pass-streak-separator">/</span><span class="pass-streak-max">2</span>
</div>
```

Add `gameState` and a dependency:

```ts
const gameState = {
  currentPlayer: 1,
  consecutivePasses: 0,
  __resultShown: false
} as any;

const deps = {
  // existing deps...
  getGameStateValue: () => gameState,
  // existing deps...
};
```

Allow overrides:

```ts
if (overrides) {
  if (overrides.cardState) Object.assign(cardState, overrides.cardState);
  if (overrides.gameState) Object.assign(gameState, overrides.gameState);
  Object.assign(deps, overrides.deps || {});
}
```

Add these tests:

```ts
test('pass status model hides at zero when pass is not available', () => {
  expect(resolveConsecutivePassStatusModel({
    gameState: { consecutivePasses: 0 },
    canShowPass: false
  })).toEqual({
    shouldShow: false,
    count: 0,
    max: 2,
    text: ''
  });
});

test('pass status model shows zero only when pass is currently available', () => {
  expect(resolveConsecutivePassStatusModel({
    gameState: { consecutivePasses: 0 },
    canShowPass: true
  })).toEqual({
    shouldShow: true,
    count: 0,
    max: 2,
    text: '連続パス0/2'
  });
});

test('pass status model keeps one-pass warning even when current player can move', () => {
  expect(resolveConsecutivePassStatusModel({
    gameState: { consecutivePasses: 1 },
    canShowPass: false
  })).toEqual({
    shouldShow: true,
    count: 1,
    max: 2,
    text: '連続パス1/2'
  });
});

test('pass status model hides while result is shown', () => {
  expect(resolveConsecutivePassStatusModel({
    gameState: { consecutivePasses: 2, __resultShown: true },
    canShowPass: true
  })).toEqual({
    shouldShow: false,
    count: 2,
    max: 2,
    text: ''
  });
});

test('sync pass status element from action state', () => {
  const ctx = createController({
    gameState: { consecutivePasses: 1 },
    deps: {
      getLegalMovesForCurrentPlayer: jest.fn(() => [{ row: 2, col: 3, flips: [[3, 3]] }])
    }
  });

  const actionState = ctx.controller.resolveCardDetailActionState({
    playerKey: 'black',
    hasSelection: false,
    selectedId: null
  });
  ctx.controller.syncConsecutivePassStatus(actionState);

  const status = ctx.dom.window.document.getElementById('consecutive-pass-status') as HTMLElement;
  const current = status.querySelector('[data-pass-streak-current="true"]') as HTMLElement;
  expect(status.hidden).toBe(false);
  expect(status.getAttribute('aria-hidden')).toBe('false');
  expect(status.getAttribute('aria-label')).toBe('連続パス1/2');
  expect(current.textContent).toBe('1');
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.card-interaction-detail-actions-module.test.ts
```

Expected: FAIL because `resolveConsecutivePassStatusModel` and `syncConsecutivePassStatus` do not exist yet.

- [ ] **Step 3: Implement the model and sync helper**

In `cards/card-interaction-detail-actions.ts`, extend the deps type:

```ts
getGameStateValue?: () => any;
```

Add these helpers before `createCardInteractionDetailActions`:

```ts
type ConsecutivePassStatusModel = {
    shouldShow: boolean;
    count: number;
    max: 2;
    text: string;
};

function normalizeConsecutivePassDisplayCount(value: any): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(2, Math.trunc(numeric)));
}

export function resolveConsecutivePassStatusModel(input: any = {}): ConsecutivePassStatusModel {
    const gameStateValue = input && input.gameState ? input.gameState : {};
    const count = normalizeConsecutivePassDisplayCount(gameStateValue.consecutivePasses);
    const resultShown = gameStateValue && gameStateValue.__resultShown === true;
    const shouldShow = !resultShown && (count > 0 || input.canShowPass === true);
    return {
        shouldShow,
        count,
        max: 2,
        text: shouldShow ? `連続パス${count}/2` : ''
    };
}

export function syncConsecutivePassStatus(actionState: any, documentRef: Document | null): void {
    if (!documentRef) return;
    const statusEl = documentRef.getElementById('consecutive-pass-status') as HTMLElement | null;
    if (!statusEl) return;
    const model = actionState && actionState.consecutivePassStatus
        ? actionState.consecutivePassStatus
        : resolveConsecutivePassStatusModel({
            gameState: {},
            canShowPass: actionState && actionState.canShowPass
        });
    statusEl.hidden = !model.shouldShow;
    statusEl.setAttribute('aria-hidden', model.shouldShow ? 'false' : 'true');
    statusEl.setAttribute('aria-label', model.shouldShow ? model.text : '');
    const currentEl = statusEl.querySelector('[data-pass-streak-current="true"]') as HTMLElement | null;
    if (currentEl) {
        currentEl.textContent = String(model.count);
    } else {
        statusEl.textContent = model.text;
    }
}
```

In `resolveCardDetailActionState`, read game state:

```ts
const gameStateValue = typeof cfg.getGameStateValue === 'function' ? (cfg.getGameStateValue() || {}) : {};
```

After `canShowPass` is computed, add:

```ts
const consecutivePassStatus = resolveConsecutivePassStatusModel({
    gameState: gameStateValue,
    canShowPass
});
```

Return it in the action state:

```ts
consecutivePassStatus,
```

In `syncReversiPassButton`, call the new sync helper after pass button visibility:

```ts
syncConsecutivePassStatus(actionState, documentRef);
```

Return it from `createCardInteractionDetailActions`:

```ts
syncConsecutivePassStatus: (actionState: any) => {
    const documentRef = typeof cfg.getDocumentRef === 'function' ? cfg.getDocumentRef() : null;
    syncConsecutivePassStatus(actionState, documentRef);
},
```

Update `module.exports`:

```ts
module.exports = {
    createCardInteractionDetailActions,
    isCancellablePendingSelectionFallback,
    isHandOverlayPendingSelectionFallback,
    resolveConsecutivePassStatusModel,
    syncConsecutivePassStatus,
    getPendingSelectionPrompt
};
```

- [ ] **Step 4: Run the focused test and confirm pass**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.card-interaction-detail-actions-module.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the model unit**

Run:

```powershell
git add cards/card-interaction-detail-actions.ts test/ui.card-interaction-detail-actions-module.test.ts
git commit -m "ui: derive consecutive pass status"
```

---

### Task 4: Wire the Browser UI and Result Overlay Hide

**Files:**
- Modify: `cards/card-interaction.ts`
- Modify: `ui/result-overlay.ts`
- Modify: `test/ui.pass-stale-busy.test.ts`
- Modify: `test/ui.result-overlay.network-seat.test.ts`

- [ ] **Step 1: Write failing integration tests for card UI update**

In `test/ui.pass-stale-busy.test.ts`, add the HUD DOM to the JSDOM body:

```html
<div id="consecutive-pass-status" hidden aria-hidden="true">
  <span class="pass-streak-label">連続パス</span><span class="pass-streak-current" data-pass-streak-current="true">0</span><span class="pass-streak-separator">/</span><span class="pass-streak-max">2</span>
</div>
```

Set the initial game state pass count:

```ts
global.gameState = {
  currentPlayer: 1,
  consecutivePasses: 0,
  board: Array.from({ length: 8 }, () => Array(8).fill(0))
};
```

Add these tests:

```ts
test('shows consecutive pass zero when manual pass is available', () => {
  require('../cards/card-interaction.js');

  window.updateCardDetailPanel();

  const status = document.getElementById('consecutive-pass-status');
  const current = status.querySelector('[data-pass-streak-current="true"]');
  expect(status.hidden).toBe(false);
  expect(status.getAttribute('aria-hidden')).toBe('false');
  expect(status.getAttribute('aria-label')).toBe('連続パス0/2');
  expect(current.textContent).toBe('0');
});

test('keeps consecutive pass one visible even when legal moves exist', () => {
  global.gameState.consecutivePasses = 1;
  global.Core = { getLegalMoves: () => [{ row: 2, col: 3, flips: [[3, 3]] }] };
  require('../cards/card-interaction.js');

  window.updateCardDetailPanel();

  const passBtn = document.getElementById('pass-btn');
  const status = document.getElementById('consecutive-pass-status');
  const current = status.querySelector('[data-pass-streak-current="true"]');
  expect(passBtn.style.display).toBe('none');
  expect(status.hidden).toBe(false);
  expect(status.getAttribute('aria-label')).toBe('連続パス1/2');
  expect(current.textContent).toBe('1');
});

test('hides consecutive pass status after count reset when pass is not available', () => {
  global.gameState.consecutivePasses = 0;
  global.Core = { getLegalMoves: () => [{ row: 2, col: 3, flips: [[3, 3]] }] };
  require('../cards/card-interaction.js');

  window.updateCardDetailPanel();

  const status = document.getElementById('consecutive-pass-status');
  expect(status.hidden).toBe(true);
  expect(status.getAttribute('aria-hidden')).toBe('true');
});
```

- [ ] **Step 2: Write the result-overlay hide test**

In `test/ui.result-overlay.network-seat.test.ts`, add:

```ts
test('result overlay hides consecutive pass status', () => {
  document.body.innerHTML = `
    <div id="consecutive-pass-status" aria-hidden="false">
      <span data-pass-streak-current="true">2</span>
    </div>
  `;
  global.gameState.consecutivePasses = 2;
  global.countDiscs.mockReturnValue({ black: 32, white: 32 });

  const mod = require('../ui/result-overlay.js');
  mod.showResultOverlay();

  const status = document.getElementById('consecutive-pass-status');
  expect(status.hidden).toBe(true);
  expect(status.getAttribute('aria-hidden')).toBe('true');
});
```

- [ ] **Step 3: Run the focused tests and confirm failure**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.pass-stale-busy.test.ts test/ui.result-overlay.network-seat.test.ts
```

Expected: FAIL because browser integration does not inject game state and result overlay does not hide the HUD yet.

- [ ] **Step 4: Inject game state into the detail-actions controller**

In `cards/card-interaction.ts`, add this dependency to the `createCardInteractionDetailActions` call:

```ts
getGameStateValue: () => gameState,
```

Place it next to the existing `getCardStateValue: () => cardState` dependency.

- [ ] **Step 5: Hide the HUD when the result overlay is created**

In `ui/result-overlay.ts`, add this helper near other overlay DOM helpers:

```ts
function hideConsecutivePassStatusForResultOverlay() {
    if (typeof document === 'undefined') return;
    const statusEl = document.getElementById('consecutive-pass-status') as HTMLElement | null;
    if (!statusEl) return;
    statusEl.hidden = true;
    statusEl.setAttribute('aria-hidden', 'true');
}
```

At the start of `showResultOverlay()`, before `removeExistingResultOverlay({ stopResultBgm: false });`, call:

```ts
hideConsecutivePassStatusForResultOverlay();
```

This leaves `連続パス2/2` visible during the short pre-result transition, then removes it when the result screen actually appears.

- [ ] **Step 6: Run the focused tests and confirm pass**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.pass-stale-busy.test.ts test/ui.result-overlay.network-seat.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the integration unit**

Run:

```powershell
git add cards/card-interaction.ts ui/result-overlay.ts test/ui.pass-stale-busy.test.ts test/ui.result-overlay.network-seat.test.ts
git commit -m "ui: sync consecutive pass HUD"
```

---

### Task 5: Build Generated Browser Output and Mirror

**Files:**
- Generated by build: `cards/card-interaction-detail-actions.js`, `cards/card-interaction.js`, `ui/result-overlay.js`
- Generated by browser build: `public/module-registry.js`
- Generated by mirror prepare: `worker-public/*`

- [ ] **Step 1: Run TypeScript build**

Run:

```powershell
npm run build:ts
```

Expected: exit code 0. The adjacent `.js` outputs for touched `.ts` files are updated.

- [ ] **Step 2: Run browser registry build**

Run:

```powershell
npm run build:browser
```

Expected: exit code 0. `public/module-registry.js` reflects the rebuilt browser modules.

- [ ] **Step 3: Prepare worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: exit code 0. Root browser assets are mirrored to `worker-public/`.

- [ ] **Step 4: Inspect generated diff scope**

Run:

```powershell
git status --short
git diff --name-only
```

Expected changed files for this feature include only:

```text
01-rulebook.md
index.html
styles-charge-hud.css
cards/card-interaction-detail-actions.ts
cards/card-interaction-detail-actions.js
cards/card-interaction.ts
cards/card-interaction.js
ui/result-overlay.ts
ui/result-overlay.js
test/ui.card-interaction-detail-actions-module.test.ts
test/ui.pass-stale-busy.test.ts
test/ui.result-overlay.network-seat.test.ts
public/module-registry.js
worker-public/index.html
worker-public/styles-charge-hud.css
worker-public/public/module-registry.js
```

If unrelated pre-existing files are still dirty, leave them unstaged and report them.

- [ ] **Step 5: Commit generated and mirror output**

Run:

```powershell
git add cards/card-interaction-detail-actions.js cards/card-interaction.js ui/result-overlay.js public/module-registry.js worker-public/index.html worker-public/styles-charge-hud.css worker-public/public/module-registry.js
git commit -m "build: update consecutive pass UI assets"
```

---

### Task 6: Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run focused UI tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.card-interaction-detail-actions-module.test.ts test/ui.pass-stale-busy.test.ts test/ui.result-overlay.network-seat.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run browser build check**

Run:

```powershell
npm run build:browser
```

Expected: PASS.

- [ ] **Step 4: Visual smoke check in browser**

Start the local server:

```powershell
npm run serve
```

Use the in-app browser or Playwright to inspect:

```text
http://localhost:3000/?debug=1
```

Check these states:

- Normal board with legal moves: `#consecutive-pass-status` is hidden.
- No-legal-move/pass-button state: bottom HUD shows `連続パス0/2` under the bottom `布石` HUD.
- `gameState.consecutivePasses = 1` with legal moves present, then `updateCardDetailPanel()`: HUD shows `連続パス1/2` and pass button stays hidden.
- `gameState.consecutivePasses = 2` before result overlay: HUD shows `連続パス2/2`.
- After `showResultOverlay()`: HUD is hidden.

Use browser devtools console snippets if needed:

```js
gameState.consecutivePasses = 1;
Core.getLegalMoves = () => [{ row: 2, col: 3, flips: [[3, 3]] }];
updateCardDetailPanel();
```

```js
gameState.consecutivePasses = 2;
gameState.__resultShown = false;
updateCardDetailPanel();
```

```js
showResultOverlay();
```

- [ ] **Step 5: Final status check**

Run:

```powershell
git status --short
```

Expected: only unrelated pre-existing files remain dirty, or the tree is clean.

## Self-Review

- Spec coverage: the plan covers `0/2` only on pass availability, `1/2` after any accepted pass, `2/2` before result overlay, reset hiding, and no display on result overlay.
- Boundary check: no game logic changes are planned; the UI consumes `gameState.consecutivePasses` and existing `canShowPass`.
- Source-of-truth check: `01-rulebook.md` is updated before implementation; `worker-public/` is generated by script.
- Test coverage: pure model tests cover display derivation; JSDOM integration tests cover browser sync and result overlay hiding; visual smoke covers placement under `布石`.
