# Deck Builder Vertical Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the deck-builder header fixed while allowing its content body to scroll vertically.

**Architecture:** Preserve the existing bounded flex modal and restore scrolling only on `#deckBuilderBody`. Lock the behavior with the existing source-level CSS contract test.

**Tech Stack:** CSS, Jest, TypeScript

## Global Constraints

- Do not launch or operate the playable game UI.
- Do not edit `worker-public/` directly.
- Preserve existing deck-builder scroll-position restoration.

---

### Task 1: Restore deck-builder body scrolling

**Files:**
- Modify: `test/ui.deck-builder-layout-css.test.ts`
- Modify: `styles-layout-controls.css`

**Interfaces:**
- Consumes: the existing `#deckBuilderModal` bounded flex layout.
- Produces: a vertically scrollable, horizontally clipped `#deckBuilderBody`.

- [ ] **Step 1: Write the failing CSS contract test**

Add a test that extracts the final Compact density `#deckBuilderBody` block and asserts:

```ts
expect(compactBodyBlock).toMatch(/overflow-y:\s*auto\s*!important/);
expect(compactBodyBlock).toMatch(/overflow-x:\s*hidden/);
expect(compactBodyBlock).not.toMatch(/overflow:\s*hidden\s*!important/);
```

- [ ] **Step 2: Verify the test fails**

Run:

```powershell
npx jest test/ui.deck-builder-layout-css.test.ts --runInBand
```

Expected: FAIL because the block currently contains `overflow: hidden !important`.

- [ ] **Step 3: Apply the minimal CSS fix**

Replace the Compact density overflow declaration with:

```css
overflow-y: auto !important;
overflow-x: hidden;
```

- [ ] **Step 4: Verify the focused test and diff**

Run:

```powershell
npx jest test/ui.deck-builder-layout-css.test.ts --runInBand
git diff --check
```

Expected: all focused tests pass and no whitespace errors are reported.

- [ ] **Step 5: Commit only the implementation files**

```powershell
git add -- styles-layout-controls.css test/ui.deck-builder-layout-css.test.ts docs/superpowers/plans/2026-07-09-deck-builder-vertical-scroll.md
git commit -m "fix: restore deck builder vertical scrolling"
```
