# Card UI Refactor Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** カード面 UI の見た目を変えずに、非表示 badge、無効化済み animation、手札カード状態 CSS、カード詳細 warning 表示、CSS 契約テストを整理する。

**Architecture:** `game/`, `shared/`, CPU, Worker authority, card catalog, gameplay rulesは変更しない。対象は browser UI presentation の source files と focused Jest tests だけに限定し、`worker-public/` は最後に既存 mirror script で同期する。

**Tech Stack:** TypeScript, CSS, Jest, jsdom, CommonJS-compatible browser modules, existing `cards/` and `ui/` renderers.

---

## Document Role

- Role: この文書は、カード面 UI 周辺の behavior-preserving refactor を実施するための実行手順書。
- Target: `styles-cards.css`, `styles-animations.css`, card renderer / animation fallback / deck builder UI, and focused UI CSS tests.
- Source of truth: player-visible behavior is `01-rulebook.md`; internal boundaries are `docs/architecture-contracts.md`; root source files are canonical; `worker-public/` is generated mirror.
- Non-goals: カード効果、コスト、カード名、カード説明、ゲーム進行、network authority、CPU 判断、盤面描画順序は変更しない。

## Preconditions

- Run `git status --short` before every task.
- If unrelated dirty files exist, do not stage them. At plan creation time these unrelated files were dirty:
  - `styles-variables.css`
  - `test/ui.charge-delta-style-contract.test.ts`
  - `test/ui.charge-hud-layering-contract.test.ts`
  - `worker-public/styles-cards.css`
  - `worker-public/styles-variables.css`
- Do not edit `worker-public/` directly. Run `npm run worker:prepare` only after source changes are complete and related dirty mirror files have been classified.
- No `01-rulebook.md` update is expected because this refactor preserves the current visible behavior.
- Commit after each task when the diff is isolated and focused.

## Behavior To Preserve

- Card faces keep the shared pentagonal frame via `--card-frame-pentagon`.
- Type badges remain visually hidden. The refactor removes unnecessary DOM/CSS work; it must not make type badges visible again.
- `data-card-type` remains available for card category styling and tests.
- Hand cards that are affordable or usable keep the current final hand appearance: no transform until hover, tier border, normal card shadow, drop shadow, visible overflow, no card animation.
- Selected cards keep the current selected visual treatment.
- Card detail use reason remains an inline warning chip when non-empty and remains hidden when empty.
- Draw/use animation fallback still renders a readable moving card with name and root cost badge.
- Deck builder card tiles still render name and cost, with category stored in `data-card-type`.

## File Map

- Modify: `test/helpers/css-test-helpers.ts`
  - Add tiny CSS block extraction helpers used by focused CSS contract tests.
- Modify: `test/ui.card-surface-layout-contract.test.ts`
  - Split broad regex assertions into focused tests for type badge removal, static cards, hand state CSS, use reason chip, and shared frame.
- Modify: `styles-cards.css`
  - Remove dead type badge CSS, dead card animation declarations, duplicate `affordable` / `usable` blocks, and duplicate `#use-card-reason` blocks.
- Modify: `styles-animations.css`
  - Remove card-only keyframes after all card animation declarations are gone.
- Modify: `cards/card-renderer.ts`
  - Stop creating hidden `.card-badge-row` / `.card-type-badge`; keep `data-card-type`.
- Modify: `cards/card-interaction.ts`
  - Stop creating hidden type badge DOM in overlay card face; keep root cost badge and `data-card-type`.
- Modify: `ui/animation-utils.ts`
  - Stop reading or recreating hidden type badge in fallback moving cards.
- Modify: `ui/deck-builder-renderer.ts`
  - Stop creating hidden type badge DOM; keep `data-card-type`.
- Modify as needed: `test/ui.card-renderer-hand-inspect.test.ts`, `test/ui.animation-utils.hand-fallback.test.ts`, `test/ui.deck-builder-controller.test.ts`
  - Update assertions so tests protect the desired absence of hidden badge DOM.
- Generated mirror: `worker-public/*`
  - Update only through `npm run worker:prepare` at the final mirror task.

---

### Task 1: Split CSS Contract Helpers

**Risk:** Low. Test-only refactor before production cleanup.

**Files:**
- Modify: `test/helpers/css-test-helpers.ts`
- Modify: `test/ui.card-surface-layout-contract.test.ts`

- [ ] **Step 1: Add focused CSS block helpers**

Modify `test/helpers/css-test-helpers.ts` by appending these functions:

```ts
export function escapeCssSelectorForRegExp(selector: string): string {
  return selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function readCssBlock(css: string, selector: string): string {
  const escapedSelector = escapeCssSelectorForRegExp(selector);
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));
  if (!match) {
    throw new Error(`Missing CSS block for selector: ${selector}`);
  }
  return match[0];
}

export function expectCssBlockToContain(css: string, selector: string, pattern: RegExp): void {
  expect(readCssBlock(css, selector)).toEqual(expect.stringMatching(pattern));
}

export function expectCssBlockNotToContain(css: string, selector: string, pattern: RegExp): void {
  expect(readCssBlock(css, selector)).not.toEqual(expect.stringMatching(pattern));
}
```

- [ ] **Step 2: Run helper tests through the existing CSS contract suite**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts --runInBand
```

Expected: PASS. This task only adds helpers, so no assertion behavior should change.

- [ ] **Step 3: Refactor only the card frame assertions to use helpers**

Modify the import in `test/ui.card-surface-layout-contract.test.ts`:

```ts
import {
  expectCssBlockNotToContain,
  expectCssBlockToContain,
  readRepoTextFile
} from './helpers/css-test-helpers';
```

Replace the frame-specific assertions inside `card faces use a shared pentagonal frame across all card variants` with:

```ts
expectCssBlockToContain(cardsCss, '.card-item', /--card-frame-pentagon:\s*polygon\(50% 0/);
expectCssBlockToContain(cardsCss, '.card-item.visible', /clip-path:\s*var\(--card-frame-pentagon\)/);
expectCssBlockNotToContain(cardsCss, '.card-item.visible.cost-tier-special', /clip-path:/);
expectCssBlockNotToContain(cardsCss, '.card-item.visible[data-card-id="rainbow_stone"]', /clip-path:/);
expectCssBlockNotToContain(cardsCss, '.card-item.visible.special-card-face', /clip-path:/);
expectCssBlockToContain(cardsCss, '.card-item.visible.special-card-face::after', /clip-path:\s*var\(--card-frame-pentagon\)/);
expectCssBlockToContain(cardsCss, '.card-item.hidden', /clip-path:\s*var\(--card-frame-pentagon\)/);
```

- [ ] **Step 4: Run the focused suite**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts --runInBand
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

Run:

```powershell
git diff --check -- test/helpers/css-test-helpers.ts test/ui.card-surface-layout-contract.test.ts
git add -- test/helpers/css-test-helpers.ts test/ui.card-surface-layout-contract.test.ts
git commit -m "Refactor card CSS contract helpers"
```

Expected: commit includes only the helper and test refactor.

---

### Task 2: Remove Hidden Type Badge Path

**Risk:** Medium. This removes currently hidden DOM/CSS and keeps the visible result unchanged.

**Files:**
- Modify: `styles-cards.css`
- Modify: `cards/card-renderer.ts`
- Modify: `cards/card-interaction.ts`
- Modify: `ui/animation-utils.ts`
- Modify: `ui/deck-builder-renderer.ts`
- Modify: `test/ui.card-surface-layout-contract.test.ts`
- Modify as needed: `test/ui.card-renderer-hand-inspect.test.ts`, `test/ui.animation-utils.hand-fallback.test.ts`, `test/ui.deck-builder-controller.test.ts`

- [ ] **Step 1: Write characterization assertions for no type badge DOM**

In `test/ui.card-renderer-hand-inspect.test.ts`, add or extend the existing card DOM structure test so it asserts:

```ts
expect(cardEl.dataset.cardType).toBeTruthy();
expect(cardEl.querySelector('.card-badge-row')).toBeNull();
expect(cardEl.querySelector('.card-type-badge')).toBeNull();
expect(cardEl.querySelector('.card-cost-badge')).toBeTruthy();
```

In `test/ui.animation-utils.hand-fallback.test.ts`, extend the fallback moving-card assertions so they include:

```ts
expect(movingCard.querySelector('.card-badge-row')).toBeNull();
expect(movingCard.querySelector('.card-type-badge')).toBeNull();
expect(movingCard.querySelector('.card-cost-badge')).toBeTruthy();
```

In `test/ui.deck-builder-controller.test.ts`, add the same no badge row expectation for a rendered deck-builder card:

```ts
expect(firstCard.dataset.cardType).toBeTruthy();
expect(firstCard.querySelector('.card-badge-row')).toBeNull();
expect(firstCard.querySelector('.card-type-badge')).toBeNull();
expect(firstCard.querySelector('.card-cost-badge')).toBeTruthy();
```

- [ ] **Step 2: Run characterization tests before implementation**

Run:

```powershell
npx jest test/ui.card-renderer-hand-inspect.test.ts test/ui.animation-utils.hand-fallback.test.ts test/ui.deck-builder-controller.test.ts --runInBand
```

Expected: FAIL only where hidden type badge DOM is still present. Existing tests that already assert absence may pass.

- [ ] **Step 3: Remove type badge CSS blocks**

In `styles-cards.css`, delete these blocks:

```css
.card-badge-row > .card-type-badge {
    position: static;
}

.card-type-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: auto;
    min-width: calc(46px * var(--layout-stage-scale));
    max-width: calc(100% - (10px * var(--layout-stage-scale)));
    background:
        linear-gradient(180deg, var(--card-tier-seal-hi, rgba(255, 255, 255, 0.16)) 0%, transparent 48%),
        linear-gradient(145deg, var(--card-tier-seal-bg-a, rgba(54, 39, 27, 0.96)) 0%, var(--card-tier-seal-bg-b, rgba(21, 14, 10, 0.94)) 100%);
    clip-path: polygon(0 50%, 7% 0, 93% 0, 100% 50%, 93% 100%, 7% 100%);
    color: var(--card-tier-seal-text, #ffefc2);
    font-size: calc(var(--layout-size-card-badge-font) * 0.92);
    font-weight: 700;
    letter-spacing: 0.05em;
    line-height: 1;
    padding: calc(var(--layout-size-card-badge-pad-y) + (1px * var(--layout-stage-scale))) calc(var(--layout-size-card-badge-pad-x) + (4px * var(--layout-stage-scale)));
    border-radius: calc(999px * var(--layout-stage-scale));
    border: var(--layout-size-border-thin) solid var(--card-tier-seal-border, rgba(255, 225, 153, 0.32));
    box-shadow:
        0 0 0 calc(1px * var(--layout-stage-scale)) rgba(22, 13, 8, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1),
        0 2px 5px rgba(0, 0, 0, 0.22);
    white-space: nowrap;
    box-sizing: border-box;
}

.card-badge-row {
    display: none !important;
}

.card-type-badge {
    display: none !important;
}
```

Also remove the later `.card-type-badge` override blocks identified by this command:

```powershell
rg -n -- "card-type-badge" styles-cards.css
```

Delete whole blocks when the selector only targets `.card-type-badge`. When a block contains a combined selector such as `:is(.card-cost-badge, .card-type-badge)`, keep the `.card-cost-badge` selector and remove `.card-type-badge` from the selector list.

When a combined selector also styles `.card-cost-badge`, keep the `.card-cost-badge` block and remove only `.card-type-badge` from the selector.

- [ ] **Step 4: Stop creating badge row in `cards/card-renderer.ts`**

Remove `_createCardBadgeRow()`.

In `_syncCardCostBadgeForRender`, replace:

```ts
const badgeRow = cardEl.querySelector ? cardEl.querySelector('.card-badge-row') : null;
cardEl.insertBefore(costBadge, badgeRow || null);
```

with:

```ts
cardEl.appendChild(costBadge);
```

In the card creation path, replace:

```ts
if (!isSpecialCard) {
    cardEl.appendChild(_createCardCostBadge(cost, tierClass));
    const badgeRow = _createCardBadgeRow(cardDef, cardId);
    if (badgeRow) {
        cardEl.appendChild(badgeRow);
    }
}
```

with:

```ts
if (!isSpecialCard) {
    cardEl.appendChild(_createCardCostBadge(cost, tierClass));
}
```

- [ ] **Step 5: Stop creating badge row in `cards/card-interaction.ts`**

In `_appendCardDisplayBadges`, keep the `data-card-type` assignment and root cost badge, but remove `badgeRow` and `typeBadge`.

Replace the function body with this structure:

```ts
function _appendCardDisplayBadges(cardEl: any, cardDef: any, cost: any, tier: any) {
    if (!cardEl) return;

    const typeKey = _getCardDisplayTypeKey(cardDef);
    if (typeKey) {
        cardEl.dataset.cardType = typeKey;
    }

    const costBadge = document.createElement('div');
    costBadge.className = 'card-cost-badge';
    if (tier) {
        costBadge.classList.add(`cost-tier-${tier}`);
    }
    const costValue = document.createElement('span');
    costValue.className = 'cost-value';
    costValue.textContent = cardDef ? String(cost) : '?';
    const costLabel = document.createElement('span');
    costLabel.className = 'cost-label';
    costLabel.textContent = 'cost';
    costBadge.appendChild(costValue);
    costBadge.appendChild(costLabel);

    cardEl.appendChild(costBadge);
}
```

- [ ] **Step 6: Stop recreating badge row in `ui/animation-utils.ts`**

Remove the `typeBadgeEl` read in the source-card extraction path when it is only used for fallback reconstruction.

Delete the fallback creation block:

```ts
if (resolvedTypeLabel) {
    const badgeRow = document.createElement('div');
    badgeRow.className = 'card-badge-row';
    const typeBadge = document.createElement('div');
    typeBadge.className = 'card-type-badge';
    var _typeIconMap: Record<string, string> = { '採掘':'\u26CF\uFE0E', '守護':'\u26E8\uFE0E', '戦闘':'\u2694\uFE0E', '執行':'\u2696\uFE0E', '禁忌':'\u26A0\uFE0E', '殲滅':'\u2620\uFE0E', '繁栄':'\u2728', '特殊':'\u2726' };
    var _typeIcon = _typeIconMap[resolvedTypeLabel] || '';
    typeBadge.textContent = _typeIcon ? (_typeIcon + ' ' + resolvedTypeLabel) : resolvedTypeLabel;
    badgeRow.appendChild(typeBadge);
    cardEl.appendChild(badgeRow);
}
```

Keep the `cardEl.dataset.cardType = resolvedTypeKey` assignment.

- [ ] **Step 7: Stop creating badge row in `ui/deck-builder-renderer.ts`**

Remove the `badgeRow` / `typeBadge` creation and removal block. Keep:

```ts
if (typeKey) {
  cardEl.dataset.cardType = typeKey;
} else {
  delete cardEl.dataset.cardType;
}
```

Keep the root `.card-cost-badge` creation.

- [ ] **Step 8: Update CSS contract tests**

Replace `card surfaces suppress type badges while keeping other card layout tokens intact` with assertions that type badge styling is gone:

```ts
test('card surfaces do not keep hidden type badge CSS', () => {
  const cardsCss = readRepoTextFile('styles-cards.css');

  expect(cardsCss).not.toMatch(/\.card-type-badge/);
  expect(cardsCss).not.toMatch(/\.card-badge-row\s*>\s*\.card-type-badge/);
  expect(cardsCss).not.toMatch(/display:\s*none\s*!important/);
  expect(cardsCss).toMatch(/\.card-cost-badge[\s\S]*top:\s*calc\(var\(--layout-size-card-badge-offset\)\s*-\s*\(1px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
});
```

If `display: none !important` exists for unrelated card CSS, narrow the assertion to:

```ts
expect(cardsCss).not.toMatch(/\.card-badge-row\s*\{[\s\S]*display:\s*none\s*!important/);
expect(cardsCss).not.toMatch(/\.card-type-badge\s*\{[\s\S]*display:\s*none\s*!important/);
```

- [ ] **Step 9: Run focused tests**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts test/ui.card-renderer-hand-inspect.test.ts test/ui.animation-utils.hand-fallback.test.ts test/ui.deck-builder-controller.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```powershell
git diff --check -- styles-cards.css cards/card-renderer.ts cards/card-interaction.ts ui/animation-utils.ts ui/deck-builder-renderer.ts test/ui.card-surface-layout-contract.test.ts test/ui.card-renderer-hand-inspect.test.ts test/ui.animation-utils.hand-fallback.test.ts test/ui.deck-builder-controller.test.ts
git add -- styles-cards.css cards/card-renderer.ts cards/card-interaction.ts ui/animation-utils.ts ui/deck-builder-renderer.ts test/ui.card-surface-layout-contract.test.ts test/ui.card-renderer-hand-inspect.test.ts test/ui.animation-utils.hand-fallback.test.ts test/ui.deck-builder-controller.test.ts
git commit -m "Remove hidden card type badge path"
```

---

### Task 3: Remove Disabled Card Animation Declarations

**Risk:** Low to medium. Current behavior already disables card animations globally.

**Files:**
- Modify: `styles-cards.css`
- Modify: `styles-animations.css`
- Modify: `test/ui.card-surface-layout-contract.test.ts`

- [ ] **Step 1: Add a static-card contract test**

In `test/ui.card-surface-layout-contract.test.ts`, add:

```ts
test('card faces do not keep overridden animation declarations', () => {
  const cardsCss = readRepoTextFile('styles-cards.css');
  const animationsCss = readRepoTextFile('styles-animations.css');

  expect(cardsCss).toMatch(/\.card-item,[\s\S]*\.card-item \*::after\s*\{[\s\S]*animation:\s*none\s*!important/);
  expect(cardsCss).not.toMatch(/animation:\s*(?:foil-sweep|card-shimmer|card-selected-shine|card-usable-pulse)/);
  expect(animationsCss).not.toMatch(/@keyframes\s+(?:foil-sweep|card-shimmer|card-selected-shine|card-usable-pulse)\b/);
});
```

- [ ] **Step 2: Run test to verify current debt is detected**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts --runInBand
```

Expected: FAIL because card animation declarations and keyframes still exist.

- [ ] **Step 3: Remove card animation declarations from `styles-cards.css`**

Delete only these declarations:

```css
animation: foil-sweep 3.8s ease-in-out infinite;
animation: card-shimmer 3s ease-in-out infinite;
animation: foil-sweep 4s ease-in-out infinite;
animation: foil-sweep 3s ease-in-out infinite;
animation: card-selected-shine 1.6s ease-in-out infinite;
animation: card-usable-pulse 1.85s ease-in-out infinite;
```

Keep existing `animation: none` / `animation: none !important` declarations that enforce current static behavior.

- [ ] **Step 4: Remove unused keyframes from `styles-animations.css`**

Delete these keyframe blocks if `rg` shows no remaining references:

```powershell
rg -n -- "foil-sweep|card-shimmer|card-selected-shine|card-usable-pulse" styles-cards.css styles-animations.css test
```

Expected before deletion: only keyframes in `styles-animations.css` and removed declarations in `styles-cards.css`.

Delete the complete `@keyframes` blocks named `card-shimmer`, `card-usable-pulse`, `card-selected-shine`, and `foil-sweep` from `styles-animations.css`.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git diff --check -- styles-cards.css styles-animations.css test/ui.card-surface-layout-contract.test.ts
git add -- styles-cards.css styles-animations.css test/ui.card-surface-layout-contract.test.ts
git commit -m "Remove disabled card animations"
```

---

### Task 4: Consolidate Affordable and Usable Hand Card CSS

**Risk:** Medium. This changes CSS organization around important hand cues while preserving final computed behavior.

**Files:**
- Modify: `styles-cards.css`
- Modify: `test/ui.card-surface-layout-contract.test.ts`

- [ ] **Step 1: Add a stricter contract for final hand state CSS**

In `test/ui.card-surface-layout-contract.test.ts`, add:

```ts
test('hand affordable and usable cards use one final non-selected state block', () => {
  const cardsCss = readRepoTextFile('styles-cards.css');
  const finalStateSelector = ':is(#hand-black, #hand-white) .card-item:is(.affordable, .usable):not(.selected)';
  const finalHoverSelector = ':is(#hand-black, #hand-white) .card-item:is(.affordable, .usable).visible.clickable:hover:not(.selected)';

  expectCssBlockToContain(cardsCss, finalStateSelector, /border:\s*var\(--layout-size-border-medium\)\s+solid\s+var\(--card-tier-border,\s*#d9b766\)/);
  expectCssBlockToContain(cardsCss, finalStateSelector, /box-shadow:\s*var\(--card-visible-surface-shadow\)/);
  expectCssBlockToContain(cardsCss, finalStateSelector, /transform:\s*none/);
  expectCssBlockToContain(cardsCss, finalStateSelector, /overflow:\s*visible/);
  expectCssBlockToContain(cardsCss, finalStateSelector, /filter:\s*drop-shadow\(var\(--ui-drop-shadow-panel\)\)/);
  expectCssBlockToContain(cardsCss, finalStateSelector, /animation:\s*none/);
  expectCssBlockToContain(cardsCss, finalHoverSelector, /transform:\s*translateY\(-3px\)/);
  expectCssBlockToContain(cardsCss, finalHoverSelector, /filter:\s*drop-shadow\(var\(--ui-drop-shadow-panel\)\)/);

  expect(cardsCss).not.toMatch(/\.card-item\.affordable:not\(\.selected\),\s*\n\.card-item\.usable:not\(\.selected\)/);
  expect(cardsCss).not.toMatch(/#hand-black \.card-item\.affordable:not\(\.selected\),/);
});
```

- [ ] **Step 2: Run test to verify current duplication is detected**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts --runInBand
```

Expected: FAIL because the legacy broad and explicit `#hand-black/#hand-white` blocks still exist.

- [ ] **Step 3: Remove broad affordable/usable presentation blocks**

In `styles-cards.css`, delete the broad blocks whose selector starts with one of these selector pairs because the final hand-specific block owns the actual current appearance:

```text
.card-item.affordable,
.card-item.usable

.card-item.affordable:not(.selected),
.card-item.usable:not(.selected)

.card-item.affordable::before,
.card-item.usable::before

.card-item.affordable .card-name,
.card-item.usable .card-name

.card-item.affordable.visible.clickable:hover:not(.selected),
.card-item.usable.visible.clickable:hover:not(.selected)

.card-item.affordable .card-cost-badge,
.card-item.usable .card-cost-badge
```

Keep selected-card blocks that are not duplicated by final hand-specific state unless the focused test proves they are redundant.

- [ ] **Step 4: Merge explicit hand blocks into the `:is()` blocks**

Keep one non-selected hand state block:

```css
:is(#hand-black, #hand-white) .card-item:is(.affordable, .usable):not(.selected) {
    outline: none;
    border: var(--layout-size-border-medium) solid var(--card-tier-border, #d9b766);
    box-shadow: var(--card-visible-surface-shadow);
    transform: none;
    filter: drop-shadow(var(--ui-drop-shadow-panel));
    -webkit-filter: drop-shadow(var(--ui-drop-shadow-panel));
    overflow: visible;
    animation: none;
}
```

Keep one hover block:

```css
:is(#hand-black, #hand-white) .card-item:is(.affordable, .usable).visible.clickable:hover:not(.selected) {
    outline: none;
    box-shadow:
        0 7px 14px rgba(0, 0, 0, 0.42),
        0 0 6px var(--card-tier-hover-glow, rgba(255, 215, 0, 0.1));
    transform: translateY(-3px);
    filter: drop-shadow(var(--ui-drop-shadow-panel));
    -webkit-filter: drop-shadow(var(--ui-drop-shadow-panel));
}
```

Delete the later explicit duplicate blocks whose selectors start with these lists:

```text
#hand-black .card-item.affordable:not(.selected),
#hand-black .card-item.usable:not(.selected),
#hand-white .card-item.affordable:not(.selected),
#hand-white .card-item.usable:not(.selected)

#hand-black .card-item.affordable.visible.clickable:hover:not(.selected),
#hand-black .card-item.usable.visible.clickable:hover:not(.selected),
#hand-white .card-item.affordable.visible.clickable:hover:not(.selected),
#hand-white .card-item.usable.visible.clickable:hover:not(.selected)
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts test/ui.card-renderer-hand-inspect.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git diff --check -- styles-cards.css test/ui.card-surface-layout-contract.test.ts
git add -- styles-cards.css test/ui.card-surface-layout-contract.test.ts
git commit -m "Consolidate hand card state CSS"
```

---

### Task 5: Consolidate Use Card Reason CSS

**Risk:** Low. This removes earlier overridden declarations and keeps the final chip appearance.

**Files:**
- Modify: `styles-cards.css`
- Modify: `test/ui.card-surface-layout-contract.test.ts`

- [ ] **Step 1: Add a focused contract for the reason chip**

In `test/ui.card-surface-layout-contract.test.ts`, add:

```ts
test('use card reason is defined once as a compact warning chip', () => {
  const cardsCss = readRepoTextFile('styles-cards.css');
  const reasonBlocks = cardsCss.match(/#use-card-reason\s*\{[^}]*\}/g) || [];

  expect(reasonBlocks).toHaveLength(1);
  expectCssBlockToContain(cardsCss, '#use-card-reason', /display:\s*inline-flex/);
  expectCssBlockToContain(cardsCss, '#use-card-reason', /width:\s*auto/);
  expectCssBlockToContain(cardsCss, '#use-card-reason', /text-align:\s*left/);
  expectCssBlockToContain(cardsCss, '#use-card-reason', /min-height:\s*0/);
  expectCssBlockToContain(cardsCss, '#card-detail-panel > #use-card-reason:empty', /display:\s*none/);
  expect(cardsCss).not.toMatch(/#card-detail-panel > #use-card-reason\s*\{[\s\S]*display:\s*block/);
});
```

- [ ] **Step 2: Run test to verify current duplication is detected**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts --runInBand
```

Expected: FAIL because multiple `#use-card-reason` blocks exist.

- [ ] **Step 3: Remove `#use-card-reason` from broad layout selector**

In the broad selector around the card detail panel children, remove only this selector:

```css
#card-detail-panel > #use-card-reason
```

Keep the other selectors in that block.

- [ ] **Step 4: Merge reason styles into the final block**

Delete the earlier block:

```css
#use-card-reason {
    position: relative;
    font-size: calc(10px * var(--layout-stage-scale) * var(--layout-priority-card-detail-scale));
    color: #a08060;
    margin-top: calc(4px * var(--layout-stage-scale) * var(--layout-priority-card-detail-scale));
    min-height: calc(14px * var(--layout-stage-scale) * var(--layout-priority-card-detail-scale));
    z-index: 1;
}
```

Replace the final `#use-card-reason` block with:

```css
#use-card-reason {
    --card-detail-warning-chip-border: rgba(242, 201, 95, 0.30);
    position: relative;
    display: inline-flex;
    align-items: center;
    width: auto;
    max-width: 100%;
    margin-top: calc(6px * var(--layout-stage-scale));
    min-height: 0;
    padding: calc(4px * var(--layout-stage-scale)) calc(8px * var(--layout-stage-scale));
    border: calc(1px * var(--layout-stage-scale)) solid var(--card-detail-warning-chip-border);
    border-radius: calc(999px * var(--layout-stage-scale));
    background: var(--card-detail-warning-chip);
    color: rgba(244, 224, 174, 0.82);
    font-size: calc(10px * var(--layout-stage-scale) * var(--layout-priority-card-detail-scale));
    text-align: left;
    box-shadow: inset calc(2px * var(--layout-stage-scale)) 0 0 rgba(242, 201, 95, 0.24);
    z-index: 1;
}
```

Keep this block:

```css
#card-detail-panel > #use-card-reason:empty {
    display: none;
}
```

Remove this redundant block after verifying the base block gives the same final declarations:

```css
#card-detail-panel > #use-card-reason {
    display: inline-flex;
    width: auto;
    text-align: left;
}
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts test/ui.card-text-clarity-css.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git diff --check -- styles-cards.css test/ui.card-surface-layout-contract.test.ts
git add -- styles-cards.css test/ui.card-surface-layout-contract.test.ts
git commit -m "Consolidate card detail reason CSS"
```

---

### Task 6: Final Mirror Sync and Validation

**Risk:** Medium because generated mirror files may already be dirty.

**Files:**
- Modify through script only: `worker-public/*`

- [ ] **Step 1: Inspect working tree before mirror**

Run:

```powershell
git status --short
```

Expected: only source changes from completed tasks are committed. If unrelated dirty `worker-public/*` remains, classify it before running the mirror script.

- [ ] **Step 2: Run source validation**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts test/ui.card-text-clarity-css.test.ts test/ui.card-renderer-hand-inspect.test.ts test/ui.animation-utils.hand-fallback.test.ts test/ui.deck-builder-controller.test.ts --runInBand
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 3: Run worker mirror script**

Run:

```powershell
npm run worker:prepare
```

Expected: exit 0. Mirror changes should include only files affected by the source UI/CSS changes.

- [ ] **Step 4: Verify mirror diff**

Run:

```powershell
git diff -- worker-public/styles-cards.css worker-public/styles-animations.css worker-public/index.html worker-public/public/module-registry.js
```

Expected: mirror reflects the source changes. If unrelated mirror churn appears, stop and inspect `scripts/prepare-worker-assets.ts` output before staging.

- [ ] **Step 5: Commit mirror sync**

Run:

```powershell
git diff --check -- worker-public/styles-cards.css worker-public/styles-animations.css worker-public/index.html worker-public/public/module-registry.js
git add -- worker-public/styles-cards.css worker-public/styles-animations.css worker-public/index.html worker-public/public/module-registry.js
git commit -m "Sync card UI refactor worker assets"
```

If `worker-public/styles-animations.css` does not exist or is not touched, omit it from `git add`.

---

## Final Acceptance Checklist

- [ ] `rg -n -- "card-type-badge|card-badge-row" styles-cards.css cards ui test` returns only intentional historical text or test fixture text. No production renderer should create hidden type badge DOM.
- [ ] `rg -n -- "foil-sweep|card-shimmer|card-selected-shine|card-usable-pulse" styles-cards.css styles-animations.css test` returns no production CSS references.
- [ ] `rg -n -- "#use-card-reason\\s*\\{" styles-cards.css` returns exactly one block.
- [ ] `npx jest test/ui.card-surface-layout-contract.test.ts test/ui.card-text-clarity-css.test.ts test/ui.card-renderer-hand-inspect.test.ts test/ui.animation-utils.hand-fallback.test.ts test/ui.deck-builder-controller.test.ts --runInBand` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run worker:prepare` passes if source changes need deploy mirror sync.
- [ ] `git status --short` contains no uncommitted changes from this refactor.

## Rollback

- Each task is committed independently. To roll back one task, use `git revert <commit>` for that task.
- If a task uncovers behavior drift before commit, stop and inspect the focused diff. Do not continue into the next task with mixed uncommitted changes.
- If `worker:prepare` creates unrelated mirror churn, do not stage it; classify the dirty files and rerun from a clean source state.

## Execution Recommendation

Use subagent-driven execution for Tasks 2 through 5 because each task has a separate validation surface. Keep Task 1 inline or as the first subagent task. Run final mirror sync only after all source refactor tasks have landed.
