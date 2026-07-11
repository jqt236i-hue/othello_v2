# 顕現石 Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reclassify stones created by special cards as `顕現石` backed by `kind: 'manifestStone'`, while keeping legacy `specialStone` snapshots readable and preventing manifestation stones from being treated as ordinary special stones.

**Architecture:** Add a dedicated shared `ManifestStoneRegistry` and marker helpers, then migrate writes to `manifestStone` while read paths support both new and legacy forms. Keep game authority headless; UI, CPU, Worker projection, and tests consume the same helper functions instead of duplicating type lists.

**Tech Stack:** TypeScript/JavaScript, Jest, browser classic module registry, Cloudflare Worker mirror via `npm run worker:prepare`.

---

## File Structure

- Create `shared/manifest-stone-registry.ts`: canonical metadata and classification helpers for `顕現石`.
- Modify `shared/special-stone-registry.ts`: remove direct ownership of special-card marker metadata, delegate compatibility exports to `ManifestStoneRegistry`, and stop classifying manifestation types as `true_special_stone`.
- Modify `game/logic/markers_adapter.ts`: add `MARKER_KINDS.MANIFEST_STONE`, legacy normalization helpers, and separated `getManifestMarkers`.
- Modify `game/logic/cards/markers.ts`: expose `isManifestStoneMarker`, `getManifestMarkers`, `findManifestMarkerAt`, and update absolute protection / lock helpers.
- Modify `game/logic/cards/utils.ts`: mirror marker classification helper changes used by target modules.
- Modify `game/logic/card-resolution/observer-will.ts`: write `manifestStone`, read both new and legacy manifestation markers.
- Modify `game/turn/turn-start/special-stone-phase.ts`: process `OBSERVER_WILL` via manifest helpers, not only special-stone helpers.
- Modify `game/logic/cards/living_will.ts`: revive manifestation markers with the original `manifestStone` kind.
- Modify `game/logic/board_ops.ts`: absolute protection and revert logic must handle manifest markers.
- Modify `game/cards/target-resolver.ts`, `game/logic/cards/targets.ts`, and `game/logic/card-resolution/ownership.ts`: keep manifestation markers out of ordinary special-stone targets.
- Modify `shared/stone-status-snapshot.ts` and `ui/diff-renderer.ts`: display `顕現石` tags for manifestation markers.
- Modify `cards/card-interaction-effects.ts`, `cards/catalog.json`, and `01-rulebook.md`: visible wording from `観測石` / special-card-created `特殊石` to `顕現石`.
- Regenerate `cards/catalog.js`, `cards/catalog.ts`, and `cards/catalog.generated.js` through the existing catalog script if `cards/catalog.json` changes.
- Modify `entry-browser.js`, `workers/match-worker.ts`, and `workers/match-worker-runtime-preload.ts`: load `ManifestStoneRegistry`.
- Run `npm run worker:prepare` to sync generated and mirror files.
- Add tests in `test/manifest-stone-registry.test.ts`, `test/game.manifest-stone-marker.test.ts`, `test/game.observer-will-marker.test.ts`, `test/game.special-stone-visual-rule.test.ts`, `test/game.special-card-inviolable.test.ts`, `test/ui.long-press-info.test.ts`, and `test/utils.match-authority.public-snapshot.test.ts`.

## Implementation Notes

- Start by running `git status --short` and classify the existing dirty tree. Stage only files changed for this plan.
- Do not replace every `specialStone` string. `specialStone` remains the ordinary special-stone category.
- New writes use `manifestStone`. Legacy reads accept `specialStone` only when `data.type` is a registered manifestation type.
- Keep marker type strings unchanged: `THEORY_INCARNATION`, `BOARD_EXECUTOR`, `OBSERVER_WILL`.
- Keep card IDs unchanged: `theory_incarnation_01`, `board_executor_01`, `observer_will_01`.
- Do not hand-edit `worker-public/`; sync it with `npm run worker:prepare`.

---

### Task 1: Characterization Tests for the New Taxonomy

**Files:**
- Create: `test/manifest-stone-registry.test.ts`
- Modify: `test/game.special-stone-visual-rule.test.ts`
- Modify: `test/game.observer-will-marker.test.ts`
- Modify: `test/ui.long-press-info.test.ts`

- [ ] **Step 1: Write the failing registry test**

Create `test/manifest-stone-registry.test.ts`:

```ts
const ManifestStoneRegistry = require('../shared/manifest-stone-registry');
const SpecialStoneRegistry = require('../shared/special-stone-registry');

describe('ManifestStoneRegistry', () => {
  test('classifies the three special-card stones as manifestation stones', () => {
    expect(ManifestStoneRegistry.MANIFEST_STONE_KIND).toBe('manifestStone');
    expect(ManifestStoneRegistry.isManifestStoneType('THEORY_INCARNATION')).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneType('BOARD_EXECUTOR')).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneType('OBSERVER_WILL')).toBe(true);
    expect(ManifestStoneRegistry.getManifestStoneMetadata('OBSERVER_WILL')).toMatchObject({
      cardId: 'observer_will_01',
      markerType: 'OBSERVER_WILL',
      displayName: '盤理の観測者',
      displayCategoryName: '顕現石',
      durationOwnerTurns: 5,
      absoluteProtected: true,
      visualEffectKey: 'observerWillStone'
    });
  });

  test('recognizes new and legacy manifestation markers', () => {
    expect(ManifestStoneRegistry.isManifestStoneMarker({
      kind: 'manifestStone',
      data: { type: 'OBSERVER_WILL' }
    })).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneMarker({
      kind: 'specialStone',
      data: { type: 'OBSERVER_WILL' }
    })).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneMarker({
      kind: 'specialStone',
      data: { type: 'DRAGON' }
    })).toBe(false);
  });

  test('ordinary special-stone registry does not classify manifestation types as true special stones', () => {
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('OBSERVER_WILL')).toBe('manifest_stone');
    expect(SpecialStoneRegistry.isTrueSpecialStoneMarker({
      kind: 'specialStone',
      data: { type: 'OBSERVER_WILL' }
    })).toBe(false);
    expect(SpecialStoneRegistry.isAbsoluteProtectedSpecialType('OBSERVER_WILL')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the registry test and verify it fails**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/manifest-stone-registry.test.ts
```

Expected: fail because `shared/manifest-stone-registry.ts` does not exist yet.

- [ ] **Step 3: Write failing marker behavior tests**

Add this test near the existing special-stone classification tests in `test/game.special-stone-visual-rule.test.ts`:

```ts
test('顕現石は特殊石本体ではないが絶対保護として扱われる', () => {
  const CardMarkers = require('../game/logic/cards/markers');
  const cardState = {
    markers: [
      { id: 1, kind: 'manifestStone', row: 2, col: 2, owner: 'black', data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4, absoluteProtected: true } },
      { id: 2, kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'DRAGON', remainingOwnerTurns: 5 } }
    ]
  };

  expect(CardMarkers.isManifestStoneAt(cardState, 2, 2)).toBe(true);
  expect(CardMarkers.isSpecialStoneAt(cardState, 2, 2)).toBe(false);
  expect(CardMarkers.isTrueSpecialStoneAt(cardState, 2, 2)).toBe(false);
  expect(CardMarkers.isAbsoluteProtectedCell(cardState, 2, 2)).toBe(true);
  expect(CardMarkers.isSpecialStoneAt(cardState, 3, 3)).toBe(true);
});
```

Add this test to `test/game.observer-will-marker.test.ts`:

```ts
test('OBSERVER_WILL placement writes a manifestation marker', () => {
  const CardLogic = require('../game/logic/cards');
  const cardState = CardLogic.createInitialCardState();
  cardState.nextObserverWillStoneByPlayer.black = {
    sourceType: 'OBSERVER_WILL',
    repaymentId: 'observer_repay_1',
    stolenCardId: 'treasure_box',
    stolenCardCopyId: 101,
    repaymentIndex: 0
  };

  const result = CardLogic.applyObserverWillStoneReservation(cardState, 'black', 4, 4);
  expect(result.applied).toBe(true);
  const marker = cardState.markers.find((entry) => entry && entry.data && entry.data.type === 'OBSERVER_WILL');
  expect(marker).toEqual(expect.objectContaining({
    kind: 'manifestStone',
    row: 4,
    col: 4,
    owner: 'black'
  }));
});
```

Add this test to `test/ui.long-press-info.test.ts` near the current `OBSERVER_WILL` long-press test:

```ts
test('long press on OBSERVER_WILL labels it as 顕現石, not 特殊石', () => {
  global.cardState.markers = [{
    id: 901,
    kind: 'manifestStone',
    row: 5,
    col: 5,
    owner: 'black',
    data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4, absoluteProtected: true }
  }];
  global.gameState.board[5][5] = 1;

  const shown = mod.showSpecialStoneInfoAt(5, 5);
  expect(shown).toBe(true);
  const metaText = document.getElementById('stone-info-meta').textContent;
  expect(metaText).toContain('顕現石');
  expect(metaText).not.toContain('特殊石');
  expect(metaText).toContain('絶対保護');
  expect(metaText).toContain('残り4T');
});
```

- [ ] **Step 4: Run the focused failing tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/manifest-stone-registry.test.ts test/game.special-stone-visual-rule.test.ts test/game.observer-will-marker.test.ts test/ui.long-press-info.test.ts
```

Expected: fail on missing registry, missing `manifestStone` helper exports, `OBSERVER_WILL` still writing `specialStone`, and UI still showing `特殊石`.

- [ ] **Step 5: Commit only the failing tests if working in an isolated branch**

Run:

```powershell
git add test/manifest-stone-registry.test.ts test/game.special-stone-visual-rule.test.ts test/game.observer-will-marker.test.ts test/ui.long-press-info.test.ts
git commit -m "test: characterize manifestation stones"
```

Expected: commit succeeds only if no unrelated changes are staged. If the current dirty tree is mixed, skip this commit and record the reason in the final implementation report.

---

### Task 2: Shared Manifest Stone Registry

**Files:**
- Create: `shared/manifest-stone-registry.ts`
- Modify: `shared/special-stone-registry.ts`
- Modify: `entry-browser.js`
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-runtime-preload.ts`
- Test: `test/manifest-stone-registry.test.ts`
- Test: `test/shared.special-stone-registry.test.ts`

- [ ] **Step 1: Create `shared/manifest-stone-registry.ts`**

Create the file with the same UMD pattern used by `shared/special-card-registry.ts`:

```ts
(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.ManifestStoneRegistry = factory();
    }
}(typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>, function () {
    'use strict';

    const MANIFEST_STONE_KIND = 'manifestStone';
    const LEGACY_SPECIAL_STONE_KIND = 'specialStone';

    const MANIFEST_STONE_METADATA = Object.freeze({
        THEORY_INCARNATION: Object.freeze({
            cardId: 'theory_incarnation_01',
            markerType: 'THEORY_INCARNATION',
            displayName: '理論の化身',
            displayCategoryName: '顕現石',
            durationOwnerTurns: 3,
            absoluteProtected: true,
            visualEffectKey: 'theoryIncarnationStone',
            imagePathByOwner: Object.freeze({
                black: 'assets/images/special-stones/theory_incarnation-black.png',
                white: 'assets/images/special-stones/theory_incarnation-white.png'
            })
        }),
        BOARD_EXECUTOR: Object.freeze({
            cardId: 'board_executor_01',
            markerType: 'BOARD_EXECUTOR',
            displayName: '盤界の執行者',
            displayCategoryName: '顕現石',
            durationOwnerTurns: 4,
            absoluteProtected: true,
            visualEffectKey: 'boardExecutorStone',
            imagePathByOwner: Object.freeze({
                black: 'assets/images/special-stones/board_executor-black.png',
                white: 'assets/images/special-stones/board_executor-white.png'
            })
        }),
        OBSERVER_WILL: Object.freeze({
            cardId: 'observer_will_01',
            markerType: 'OBSERVER_WILL',
            displayName: '盤理の観測者',
            displayCategoryName: '顕現石',
            durationOwnerTurns: 5,
            absoluteProtected: true,
            visualEffectKey: 'observerWillStone',
            imagePathByOwner: Object.freeze({
                black: 'assets/images/special-stones/OBSERVER_WILL-black.png',
                white: 'assets/images/special-stones/OBSERVER_WILL-white.png'
            })
        })
    });

    const MANIFEST_STONE_TYPES = Object.freeze(Object.keys(MANIFEST_STONE_METADATA));
    const MANIFEST_STONE_TYPE_SET = new Set(MANIFEST_STONE_TYPES);

    function normalizeManifestStoneType(rawType: unknown): string | null {
        if (rawType === null || typeof rawType === 'undefined') return null;
        const type = String(rawType).trim().toUpperCase();
        return type || null;
    }

    function isManifestStoneType(rawType: unknown): boolean {
        const type = normalizeManifestStoneType(rawType);
        return !!type && MANIFEST_STONE_TYPE_SET.has(type);
    }

    function getManifestStoneMetadata(rawType: unknown): any {
        const type = normalizeManifestStoneType(rawType);
        return type ? (MANIFEST_STONE_METADATA as any)[type] || null : null;
    }

    function isManifestStoneMarker(marker: any): boolean {
        if (!marker || typeof marker !== 'object') return false;
        const type = marker.data ? marker.data.type : null;
        if (!isManifestStoneType(type)) return false;
        return marker.kind === MANIFEST_STONE_KIND || marker.kind === LEGACY_SPECIAL_STONE_KIND;
    }

    function isActiveManifestStoneMarker(marker: any): boolean {
        if (!isManifestStoneMarker(marker)) return false;
        if (Object.prototype.hasOwnProperty.call(marker.data || {}, 'remainingOwnerTurns')) {
            const remaining = Number(marker.data.remainingOwnerTurns);
            return Number.isFinite(remaining) && remaining > 0;
        }
        return true;
    }

    function isAbsoluteProtectedManifestStoneType(rawType: unknown): boolean {
        const metadata = getManifestStoneMetadata(rawType);
        return !!(metadata && metadata.absoluteProtected === true);
    }

    return Object.freeze({
        MANIFEST_STONE_KIND,
        LEGACY_SPECIAL_STONE_KIND,
        MANIFEST_STONE_METADATA,
        MANIFEST_STONE_TYPES,
        normalizeManifestStoneType,
        isManifestStoneType,
        getManifestStoneMetadata,
        isManifestStoneMarker,
        isActiveManifestStoneMarker,
        isAbsoluteProtectedManifestStoneType
    });
}));

export {};
```

- [ ] **Step 2: Wire compatibility exports in `shared/special-stone-registry.ts`**

At the module dependency setup, require or read `ManifestStoneRegistry`:

```ts
let ManifestStoneRegistry: any = null;
try {
    ManifestStoneRegistry = require('./manifest-stone-registry');
} catch (e) {
    if (typeof globalThis !== 'undefined') {
        ManifestStoneRegistry = (globalThis as any).ManifestStoneRegistry || null;
    }
}
```

Update `classifySpecialStoneRuleClass` before returning `true_special_stone`:

```ts
if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneType === 'function' && ManifestStoneRegistry.isManifestStoneType(type)) {
    return 'manifest_stone';
}
```

Update `getSpecialCardMarkerMetadata` and `isAbsoluteProtectedSpecialType`:

```ts
function getSpecialCardMarkerMetadata(rawType: unknown): any {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.getManifestStoneMetadata === 'function') {
        return ManifestStoneRegistry.getManifestStoneMetadata(rawType);
    }
    return null;
}

function isAbsoluteProtectedSpecialType(rawType: unknown): boolean {
    const type = normalizeSpecialStoneType(rawType);
    if (!type) return false;
    if (type === 'ABSOLUTE_PROTECTED') return true;
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isAbsoluteProtectedManifestStoneType === 'function') {
        return ManifestStoneRegistry.isAbsoluteProtectedManifestStoneType(type) === true;
    }
    return false;
}
```

Keep `SPECIAL_CARD_MARKER_METADATA` exported only if existing tests still import it directly. If it remains, define it as `ManifestStoneRegistry.MANIFEST_STONE_METADATA` instead of duplicating values.

- [ ] **Step 3: Load the new shared module in browser and Worker boot paths**

In `entry-browser.js`, add `dist/shared/manifest-stone-registry` before `dist/shared/special-stone-registry`:

```js
// dist/shared/manifest-stone-registry
try {
  var _manifestStoneRegistry = require("./dist/shared/manifest-stone-registry");
  if (typeof window !== "undefined") window.ManifestStoneRegistry = _manifestStoneRegistry;
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/manifest-stone-registry: " + e.message);
}
```

In `workers/match-worker.ts`, add module map and preload entries:

```ts
['../shared/manifest-stone-registry.js', 'ManifestStoneRegistry'],
```

In `workers/match-worker-runtime-preload.ts`, add:

```ts
installRuntimeModule('ManifestStoneRegistry', () => require('../shared/manifest-stone-registry.js'));
```

- [ ] **Step 4: Run registry tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/manifest-stone-registry.test.ts test/shared.special-stone-registry.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit the shared registry change**

Run:

```powershell
git add shared/manifest-stone-registry.ts shared/special-stone-registry.ts entry-browser.js workers/match-worker.ts workers/match-worker-runtime-preload.ts test/manifest-stone-registry.test.ts test/shared.special-stone-registry.test.ts
git commit -m "refactor: add manifestation stone registry"
```

Expected: commit succeeds only in a separated worktree or when unrelated dirty files are not staged.

---

### Task 3: Marker Helpers and Legacy Compatibility

**Files:**
- Modify: `game/logic/markers_adapter.ts`
- Modify: `game/logic/cards/markers.ts`
- Modify: `game/logic/cards/utils.ts`
- Test: `test/game.special-stone-visual-rule.test.ts`
- Test: `test/special-card-foundation.test.ts`

- [ ] **Step 1: Extend `MARKER_KINDS` in `game/logic/markers_adapter.ts`**

Update the type and constant:

```ts
interface MarkerKinds {
    SPECIAL_STONE: string;
    MANIFEST_STONE: string;
}

const MARKER_KINDS: MarkerKinds = {
    SPECIAL_STONE: 'specialStone',
    MANIFEST_STONE: 'manifestStone'
};
```

Add registry resolution:

```ts
const ManifestStoneRegistry = (() => {
    try { return require('../../shared/manifest-stone-registry'); } catch (e) { return null; }
})();
```

Add helpers:

```ts
function isManifestStoneMarker(marker: Marker): boolean {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneMarker === 'function') {
        return ManifestStoneRegistry.isManifestStoneMarker(marker) === true;
    }
    const type = String(marker && marker.data && marker.data.type || '').toUpperCase();
    return (marker.kind === MARKER_KINDS.MANIFEST_STONE || marker.kind === MARKER_KINDS.SPECIAL_STONE)
        && (type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL');
}

function isSpecialStoneMarker(marker: Marker): boolean {
    return !!(
        marker &&
        marker.kind === MARKER_KINDS.SPECIAL_STONE &&
        !isBombCategoryMarker(marker) &&
        !isManifestStoneMarker(marker)
    );
}

function getManifestMarkers(cardState: any): Marker[] {
    return getMarkers(cardState).filter(isManifestStoneMarker);
}
```

Export `isManifestStoneMarker` and `getManifestMarkers`.

- [ ] **Step 2: Preserve legacy projection arrays without treating manifestations as special stones**

Update `markersToSpecialStones` so `specialStones` legacy arrays exclude manifestation markers:

```ts
function markersToSpecialStones(markers: Marker[]): SpecialStone[] {
    return markers
        .filter(isSpecialStoneMarker)
        .map(toSpecialStone)
        .filter((s): s is SpecialStone => s !== null);
}
```

No `manifestStones` legacy array is added. The canonical `markers[]` array carries manifestation markers.

- [ ] **Step 3: Add manifest helpers to `game/logic/cards/markers.ts`**

Resolve the registry:

```ts
const ManifestStoneRegistry = resolveCardMarkersModuleOrGlobal('../../../shared/manifest-stone-registry', 'ManifestStoneRegistry');
```

Add helper functions:

```ts
function isManifestStoneMarker(marker: any): boolean {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneMarker === 'function') {
        return ManifestStoneRegistry.isManifestStoneMarker(marker) === true;
    }
    const type = getNormalizedMarkerType(marker);
    return !!marker
        && (marker.kind === MARKER_KINDS.MANIFEST_STONE || marker.kind === MARKER_KINDS.SPECIAL_STONE)
        && (type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL');
}

function getManifestMarkers(cardState: CardState): any[] {
    return getMarkers(cardState).filter(isManifestStoneMarker);
}

function isActiveManifestMarker(marker: any): boolean {
    if (!isManifestStoneMarker(marker) || !marker.data) return false;
    if (Object.prototype.hasOwnProperty.call(marker.data, 'remainingOwnerTurns')) {
        const remainingOwnerTurns = Number(marker.data.remainingOwnerTurns);
        if (!Number.isFinite(remainingOwnerTurns) || remainingOwnerTurns <= 0) return false;
    }
    return true;
}

function findManifestMarkerAt(cardState: CardState, row: number, col: number, type?: string, owner?: PlayerKey): any {
    return getManifestMarkers(cardState).find((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        (type ? getNormalizedMarkerType(marker) === String(type).toUpperCase() : true) &&
        (owner ? marker.owner === owner : true)
    )) || null;
}

function isManifestStoneAt(cardState: CardState, row: number, col: number): boolean {
    return !!findManifestMarkerAt(cardState, row, col);
}
```

Update `isSpecialStoneMarker` fallback to exclude manifestations:

```ts
return !!(
    marker &&
    marker.kind === MARKER_KINDS.SPECIAL_STONE &&
    !isBombCategoryMarker(marker) &&
    !isManifestStoneMarker(marker)
);
```

Update `isActiveSpecialMarker`, `isAbsoluteProtectedMarker`, `isCardPlayLockedForPlayer`, and `isPlacementLockedForPlayer` to use manifest helpers where relevant:

```ts
function isAbsoluteProtectedMarker(marker: any): boolean {
    if (isActiveManifestMarker(marker)) {
        const type = getNormalizedMarkerType(marker);
        return ManifestStoneRegistry && typeof ManifestStoneRegistry.isAbsoluteProtectedManifestStoneType === 'function'
            ? ManifestStoneRegistry.isAbsoluteProtectedManifestStoneType(type) === true
            : type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL';
    }
    if (!isActiveSpecialMarker(marker)) return false;
    const type = getNormalizedMarkerType(marker);
    return SpecialStoneRegistry && typeof SpecialStoneRegistry.isAbsoluteProtectedSpecialType === 'function'
        ? SpecialStoneRegistry.isAbsoluteProtectedSpecialType(type) === true
        : type === 'ABSOLUTE_PROTECTED';
}
```

Export the new helpers.

- [ ] **Step 4: Mirror classification in `game/logic/cards/utils.ts`**

Add `ManifestStoneRegistry` resolution and make utility helpers match `cards/markers.ts`:

```ts
const ManifestStoneRegistry = safeRequire('../../../shared/manifest-stone-registry') || getRuntimeGlobalValue('ManifestStoneRegistry');

function isManifestStoneMarker(marker: any): boolean {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneMarker === 'function') {
        return ManifestStoneRegistry.isManifestStoneMarker(marker) === true;
    }
    return false;
}
```

Update `isSpecialStoneMarker` and `isTrueSpecialStoneMarker` so manifestations return false.

- [ ] **Step 5: Run marker helper tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.special-stone-visual-rule.test.ts test/special-card-foundation.test.ts
```

Expected: pass. Existing special-stone tests for `DRAGON`, `PROTECTED`, and `ABSOLUTE_PROTECTED` still pass; new manifestation tests pass.

- [ ] **Step 6: Commit marker helper changes**

Run:

```powershell
git add game/logic/markers_adapter.ts game/logic/cards/markers.ts game/logic/cards/utils.ts test/game.special-stone-visual-rule.test.ts test/special-card-foundation.test.ts
git commit -m "refactor: split manifestation markers from special stones"
```

Expected: commit succeeds only when staged files are limited to this task.

---

### Task 4: Observer Will Migration to `manifestStone`

**Files:**
- Modify: `game/logic/card-resolution/observer-will.ts`
- Modify: `game/turn/turn-start/special-stone-phase.ts`
- Modify: `game/logic/cards/living_will.ts`
- Modify: `game/logic/board_ops.ts`
- Test: `test/game.observer-will-marker.test.ts`
- Test: `test/game.observer-will-repayment.test.ts`

- [ ] **Step 1: Write `manifestStone` from observer placement**

In `game/logic/card-resolution/observer-will.ts`, resolve the manifest kind:

```ts
const manifestKind = markerKinds && markerKinds.MANIFEST_STONE
    ? markerKinds.MANIFEST_STONE
    : 'manifestStone';
```

Use it in `applyObserverWillStoneReservation`:

```ts
const marker = addMarker(cardState, manifestKind, row, col, ownerKey, {
    type: 'OBSERVER_WILL',
    remainingOwnerTurns: 5,
    absoluteProtected: true,
    sourceType: 'OBSERVER_WILL',
    repaymentId: typeof reservation.repaymentId === 'string' ? reservation.repaymentId : null,
    stolenCardId: reservation.stolenCardId || null,
    stolenCardCopyId: Number.isInteger(reservation.stolenCardCopyId) ? reservation.stolenCardCopyId : null,
    repaymentIndex: Number.isInteger(reservation.repaymentIndex) ? reservation.repaymentIndex : null,
    visualEffectKey: 'observerWillStone'
});
```

- [ ] **Step 2: Read active observer markers through manifest helper**

In `hasActiveObserverWillReveal`, replace direct kind comparison:

```ts
const isManifestStoneMarker = deps && deps.isManifestStoneMarker;
return getMarkers(cardState).some((entry: any) => {
    if (!entry || entry.owner !== viewer || !entry.data) return false;
    if (typeof isManifestStoneMarker === 'function' && !isManifestStoneMarker(entry)) return false;
    if (typeof isManifestStoneMarker !== 'function' && entry.kind !== 'manifestStone' && entry.kind !== 'specialStone') return false;
    if (String(entry.data.type || '').toUpperCase() !== 'OBSERVER_WILL') return false;
    const remaining = Number(entry.data.remainingOwnerTurns);
    return !Number.isFinite(remaining) || remaining > 0;
});
```

In `findObserverWillMarker`, require `deps.isManifestStoneMarker(entry)` when available.

- [ ] **Step 3: Pass manifest helpers through `game/logic/cards.ts`**

Where observer deps are built, include:

```ts
isManifestStoneMarker: CardMarkersModule.isManifestStoneMarker,
getManifestMarkers: CardMarkersModule.getManifestMarkers
```

Export facade helpers:

```ts
function isManifestStoneMarker(marker: any) {
    return requireCardMarkersMethod('isManifestStoneMarker')(marker);
}

function isManifestStoneAt(cardState: any, row: any, col: any) {
    return requireCardMarkersMethod('isManifestStoneAt')(cardState, row, col);
}
```

- [ ] **Step 4: Process observer expiry from manifest markers**

In `game/turn/turn-start/special-stone-phase.ts`, ensure the anchor list includes manifestation markers:

```ts
const specialMarkers = typeof opts.CardLogic.getSpecialMarkers === 'function'
    ? opts.CardLogic.getSpecialMarkers(cardState)
    : [];
const manifestMarkers = typeof opts.CardLogic.getManifestMarkers === 'function'
    ? opts.CardLogic.getManifestMarkers(cardState)
    : [];
const markers = specialMarkers.concat(manifestMarkers);
```

Keep the existing `createdSeq` sort so turn-start ordering remains stable.

- [ ] **Step 5: Preserve manifest kind on Living Will revival**

In `game/logic/cards/living_will.ts`, when rebuilding the marker data for `OBSERVER_WILL`, keep or set the kind:

```ts
const revivedKind = sourceMarker && sourceMarker.kind === 'manifestStone'
    ? 'manifestStone'
    : (ManifestStoneRegistry && ManifestStoneRegistry.isManifestStoneType(type) ? 'manifestStone' : sourceMarker.kind);
```

Use `revivedKind` in the marker creation path. The revived observer marker must have `remainingOwnerTurns: 5` and `absoluteProtected: true`.

- [ ] **Step 6: Ensure revert and absolute protection support manifest markers**

In `game/logic/board_ops.ts`, update marker filters that revert special stones by type to include manifest markers only when the caller requests the exact manifest type:

```ts
const isRequestedManifest = registry && typeof registry.isManifestStoneType === 'function' && registry.isManifestStoneType(specialType);
const matchesKind = isRequestedManifest
    ? (marker.kind === 'manifestStone' || marker.kind === 'specialStone')
    : marker.kind === 'specialStone';
```

Keep ordinary loss/rebuild paths from mass-reverting manifestation markers.

- [ ] **Step 7: Run observer-focused tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.observer-will-marker.test.ts test/game.observer-will-repayment.test.ts test/game.observer-will-selection.test.ts
```

Expected: pass. Observer placement emits `manifestStone`; reveal, expiry, Living Will revival, and repayment still pass.

- [ ] **Step 8: Commit observer migration**

Run:

```powershell
git add game/logic/card-resolution/observer-will.ts game/logic/cards.ts game/turn/turn-start/special-stone-phase.ts game/logic/cards/living_will.ts game/logic/board_ops.ts test/game.observer-will-marker.test.ts test/game.observer-will-repayment.test.ts test/game.observer-will-selection.test.ts
git commit -m "refactor: make observer will use manifestation stones"
```

Expected: commit succeeds only with task files staged.

---

### Task 5: Targeting, Inviolability, and Duration Effects

**Files:**
- Modify: `game/cards/target-resolver.ts`
- Modify: `game/logic/cards/targets.ts`
- Modify: `game/logic/card-resolution/ownership.ts`
- Modify: `game/logic/cards-internal/effect-target-counts.ts`
- Modify: `game/logic/cards/markers.ts`
- Test: `test/game.special-card-inviolable.test.ts`
- Test: `test/game.loss-will.test.ts`
- Test: `test/game.corrosion-will.test.ts`
- Test: `test/game.capture-will.test.ts`

- [ ] **Step 1: Add tests that ordinary special-stone effects exclude manifestations**

In `test/game.special-card-inviolable.test.ts`, add:

```ts
test('manifestation stones are not targets for ordinary special-stone effects', () => {
  const CardLogic = require('../game/logic/cards');
  const gameState = createGameStateWithBoard();
  const cardState = CardLogic.createInitialCardState();
  cardState.markers.push({
    id: 701,
    kind: 'manifestStone',
    row: 2,
    col: 2,
    owner: 'white',
    data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4, absoluteProtected: true }
  });
  gameState.board[2][2] = -1;

  expect(CardLogic.getTemptWillTargets(cardState, gameState, 'black')).toEqual([]);
  expect(CardLogic.getCaptureWillTargets(cardState, gameState, 'black')).toEqual([]);
  expect(CardLogic.getCorrosionTargets(cardState, gameState, 'black')).toEqual([]);
  expect(CardLogic.getLossWillRemovableCount(cardState, gameState, 'black')).toBe(0);
});
```

Use the existing test helper names in that file for `createGameStateWithBoard`; if the file already has a factory, reuse it exactly.

- [ ] **Step 2: Keep manifestation markers out of true special-stone target helpers**

In `game/cards/target-resolver.ts`, update local `getSpecialMarkers` or downstream filters so they use the new ordinary-special helper:

```ts
const specials = getSpecialMarkers(cardState).filter((marker: any) => (
    marker &&
    !(Markers && typeof Markers.isManifestStoneMarker === 'function' && Markers.isManifestStoneMarker(marker))
));
```

In `game/logic/cards/targets.ts`, where `getTrueSpecialStoneMarkerAt` is used for `TEMPT_WILL` and `CAPTURE_WILL`, keep using true special-stone helpers. Do not switch those paths to `getManifestMarkers`.

- [ ] **Step 3: Keep ownership effects away from manifestations**

In `game/logic/card-resolution/ownership.ts`, update ownership target resolution:

```ts
if (CardMarkersModule && typeof CardMarkersModule.isManifestStoneAt === 'function' && CardMarkersModule.isManifestStoneAt(cardState, row, col)) {
    return { applied: false, reason: 'manifest_stone_inviolable' };
}
```

Use the same guard for capture and tempt selection application.

- [ ] **Step 4: Keep duration effects away from manifestations**

In `game/logic/cards/markers.ts`, keep `isDurationAffectableMarker` limited to ordinary special stones and stone statuses:

```ts
function isDurationAffectableMarker(marker: any): boolean {
    if (isManifestStoneMarker(marker)) return false;
    const ruleClass = getMarkerRuleClass(marker);
    return ruleClass === 'true_special_stone' || ruleClass === 'stone_status';
}
```

Observer expiry is handled by observer-specific turn-start code, not generic duration extension/corrosion.

- [ ] **Step 5: Run target and inviolability tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.special-card-inviolable.test.ts test/game.loss-will.test.ts test/game.corrosion-will.test.ts test/game.capture-will.test.ts test/game.special-stone-visual-rule.test.ts
```

Expected: pass. Existing ordinary special-stone targets still work; manifestation stones are excluded.

- [ ] **Step 6: Commit targeting changes**

Run:

```powershell
git add game/cards/target-resolver.ts game/logic/cards/targets.ts game/logic/card-resolution/ownership.ts game/logic/cards-internal/effect-target-counts.ts game/logic/cards/markers.ts test/game.special-card-inviolable.test.ts test/game.loss-will.test.ts test/game.corrosion-will.test.ts test/game.capture-will.test.ts
git commit -m "fix: exclude manifestation stones from special-stone targets"
```

Expected: commit succeeds only with task files staged.

---

### Task 6: UI, Rulebook, and Player-Facing Labels

**Files:**
- Modify: `shared/stone-status-snapshot.ts`
- Modify: `ui/diff-renderer.ts`
- Modify: `cards/card-interaction-effects.ts`
- Modify: `cards/catalog.json`
- Modify generated: `cards/catalog.js`
- Modify generated: `cards/catalog.ts`
- Modify generated: `cards/catalog.generated.js`
- Modify: `01-rulebook.md`
- Test: `test/ui.long-press-info.test.ts`
- Test: `test/ui.card-detail-effect-tags.test.ts`
- Test: `test/cards.catalog.test.ts`

- [ ] **Step 1: Teach status snapshots the `顕現石` tag**

In `shared/stone-status-snapshot.ts`, resolve `ManifestStoneRegistry` next to `SpecialStoneRegistry`:

```ts
const ManifestStoneRegistry = (() => {
    try { return require('./manifest-stone-registry'); } catch (e) { return null; }
})();
```

In `createSpecialStoneStatusSnapshot`, compute the category label:

```ts
const isManifest = ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneMarker === 'function'
    ? ManifestStoneRegistry.isManifestStoneMarker(input)
    : false;
```

When building tags, use:

```ts
if (isManifest) {
    tags.push('顕現石');
} else if (isTrueSpecialStone) {
    tags.push('特殊石');
}
```

Keep `絶対保護` and `残りNT` tag logic unchanged.

- [ ] **Step 2: Pass marker kind into UI status snapshot calls**

In `ui/diff-renderer.ts`, ensure the snapshot input includes `kind`:

```ts
const specialSnapshot = _createSpecialStoneStatusSnapshotForDiff({
    kind: primaryMarker && primaryMarker.kind,
    type,
    marker: primaryMarker,
    data: primaryMarker && primaryMarker.data,
    owner: primaryMarker && primaryMarker.owner
}, { mode: 'info' });
```

If a call site currently passes only `{ type, data }`, add `kind` and `marker`.

- [ ] **Step 3: Update visible wording**

In `cards/card-interaction-effects.ts`, change the observer detail text:

```ts
OBSERVER_WILL: '18手以上経過後に使用可能。\n使用時に相手手札を公開して1枚選ぶ。選んだカードは自分の手札に加わり0コストになる。\n選ばれなかった相手手札はコスト+5になる。\n次に置く自石は5T絶対保護の顕現石になる。顕現石がある間、相手手札は常に表表示。\n顕現石消滅後、奪ったカードの元コスト20%を自ターン開始時に最大9回返済する。布石不足時は自石4個をランダム破壊する。'
```

In `cards/catalog.json`, update `observer_will_01.desc_ja` and `desc` to say `顕現石`.

In `01-rulebook.md`, add a section under special stone classification:

```md
### 顕現石

- `顕現石` は、特殊カードから出現する専用石を指す。
- 顕現石は `特殊石本体` には含めない。
- 顕現石は、効果本文で明示されない限り、誘惑、捕獲、意志の喪失、延命、腐食などの特殊石対象効果を受けない。
- 顕現石は専用 type ごとに絶対保護、持続ターン、行動ロックなどを持つ。
```

Update the `OBSERVER_WILL（盤理の観測者）` subsection to use `顕現石`.

- [ ] **Step 4: Regenerate catalog projections**

Run:

```powershell
npm run generate:catalog
```

Expected: `cards/catalog.js`, `cards/catalog.ts`, and `cards/catalog.generated.js` update from `cards/catalog.json`.

- [ ] **Step 5: Run UI and catalog tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.long-press-info.test.ts test/ui.card-detail-effect-tags.test.ts test/cards.catalog.test.ts
```

Expected: pass. Observer detail still shows `絶対保護` and duration tags, and stone info shows `顕現石`.

- [ ] **Step 6: Commit UI and rulebook changes**

Run:

```powershell
git add shared/stone-status-snapshot.ts ui/diff-renderer.ts cards/card-interaction-effects.ts cards/catalog.json cards/catalog.js cards/catalog.ts cards/catalog.generated.js 01-rulebook.md test/ui.long-press-info.test.ts test/ui.card-detail-effect-tags.test.ts test/cards.catalog.test.ts
git commit -m "docs: rename special-card stones to manifestation stones"
```

Expected: commit succeeds only with intended source and generated catalog files staged.

---

### Task 7: Network Projection and Worker Mirror

**Files:**
- Modify: `utils/match-authority.ts`
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-runtime-preload.ts`
- Generated/mirror via script: `worker-public/**`
- Test: `test/utils.match-authority.public-snapshot.test.ts`
- Test: `test/workers.match-pending-effect-id.test.ts`
- Test: `test/workers.match-network-parity-missing-types.test.ts`

- [ ] **Step 1: Add public snapshot tests for manifestation markers**

In `test/utils.match-authority.public-snapshot.test.ts`, add:

```ts
test('public snapshot preserves manifestation marker kind and observer reveal behavior', () => {
  const { projectPublicSnapshot } = require('../utils/match-authority');
  const snapshot = makeSnapshot({
    cardState: {
      markers: [{
        id: 1,
        kind: 'manifestStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 3, absoluteProtected: true }
      }],
      hands: {
        black: [],
        white: [{ id: 'treasure_box', name_ja: '宝箱', cost: 1 }]
      }
    }
  });

  const blackView = projectPublicSnapshot(snapshot, { viewer: 'black' });
  const whiteView = projectPublicSnapshot(snapshot, { viewer: 'white' });

  expect(blackView.cardState.markers[0].kind).toBe('manifestStone');
  expect(blackView.cardState.hands.white[0].id).toBe('treasure_box');
  expect(whiteView.cardState.markers[0].kind).toBe('manifestStone');
});
```

Use existing snapshot factory names in the file. Keep assertions aligned with that file's hidden-hand structure.

- [ ] **Step 2: Update observer reveal marker filter in `utils/match-authority.ts`**

Resolve `ManifestStoneRegistry`:

```ts
const ManifestStoneRegistry = safeRequire('../shared/manifest-stone-registry') || getRuntimeGlobalValue('ManifestStoneRegistry');
```

Update marker filter:

```ts
const isObserverManifest = ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneMarker === 'function'
    ? ManifestStoneRegistry.isManifestStoneMarker(marker)
    : (marker.kind === 'manifestStone' || marker.kind === 'specialStone');
if (!isObserverManifest) return false;
if (String(data.type || '').toUpperCase() !== 'OBSERVER_WILL') return false;
```

- [ ] **Step 3: Sync Worker root mappings**

Confirm `workers/match-worker.ts` and `workers/match-worker-runtime-preload.ts` include `ManifestStoneRegistry` from Task 2. Do not edit `worker-public/` directly.

- [ ] **Step 4: Run network-focused tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/utils.match-authority.public-snapshot.test.ts test/workers.match-pending-effect-id.test.ts test/workers.match-network-parity-missing-types.test.ts
```

Expected: pass.

- [ ] **Step 5: Mirror root files to worker-public**

Run:

```powershell
npm run worker:prepare
```

Expected: exits 0 and updates only generated mirror/assets/module registry files needed by the root changes.

- [ ] **Step 6: Commit network and mirror sync**

Run:

```powershell
git add utils/match-authority.ts workers/match-worker.ts workers/match-worker-runtime-preload.ts test/utils.match-authority.public-snapshot.test.ts test/workers.match-pending-effect-id.test.ts test/workers.match-network-parity-missing-types.test.ts worker-public
git commit -m "fix: project manifestation markers across network"
```

Expected: commit succeeds only if all staged `worker-public` changes are generated from this plan. If unrelated mirror changes already exist, do not commit; report the exact files.

---

### Task 8: Final Verification and Cleanup

**Files:**
- Inspect all changed files from Tasks 1-7.
- No source edit is expected unless verification finds a defect.

- [ ] **Step 1: Run focused manifestation suite**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/manifest-stone-registry.test.ts test/game.special-stone-visual-rule.test.ts test/game.observer-will-marker.test.ts test/game.observer-will-repayment.test.ts test/game.special-card-inviolable.test.ts test/ui.long-press-info.test.ts test/utils.match-authority.public-snapshot.test.ts
```

Expected: pass.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Run TypeScript build**

Run:

```powershell
npm run build:ts
```

Expected: exits 0 and emits updated dist files.

- [ ] **Step 4: Run network parity if Worker or snapshot projection changed**

Run:

```powershell
npm run test:network:parity
```

Expected: exits 0.

- [ ] **Step 5: Re-run Worker prepare after build artifacts**

Run:

```powershell
npm run worker:prepare
```

Expected: exits 0. Any worker-public changes are generated mirror changes only.

- [ ] **Step 6: Inspect final diff**

Run:

```powershell
git status --short
git diff -- shared/manifest-stone-registry.ts shared/special-stone-registry.ts game/logic/markers_adapter.ts game/logic/cards/markers.ts game/logic/card-resolution/observer-will.ts shared/stone-status-snapshot.ts ui/diff-renderer.ts utils/match-authority.ts 01-rulebook.md cards/card-interaction-effects.ts cards/catalog.json
```

Expected: diff contains only the manifestation-stone taxonomy, observer migration, UI labels, docs, generated catalog, and worker mirror changes.

- [ ] **Step 7: Commit final generated artifacts if not already committed**

Run:

```powershell
git add shared/manifest-stone-registry.ts shared/special-stone-registry.ts game/logic/markers_adapter.ts game/logic/cards/markers.ts game/logic/cards/utils.ts game/logic/card-resolution/observer-will.ts game/turn/turn-start/special-stone-phase.ts game/logic/cards/living_will.ts game/logic/board_ops.ts game/cards/target-resolver.ts game/logic/cards/targets.ts game/logic/card-resolution/ownership.ts game/logic/cards-internal/effect-target-counts.ts shared/stone-status-snapshot.ts ui/diff-renderer.ts cards/card-interaction-effects.ts cards/catalog.json cards/catalog.js cards/catalog.ts cards/catalog.generated.js 01-rulebook.md utils/match-authority.ts workers/match-worker.ts workers/match-worker-runtime-preload.ts test/manifest-stone-registry.test.ts test/game.special-stone-visual-rule.test.ts test/game.observer-will-marker.test.ts test/game.observer-will-repayment.test.ts test/game.special-card-inviolable.test.ts test/ui.long-press-info.test.ts test/utils.match-authority.public-snapshot.test.ts worker-public
git commit -m "refactor: introduce manifestation stones"
```

Expected: one final commit only if previous task commits were skipped and the diff is cleanly separable. If unrelated dirty files remain mixed in the same files, do not commit and report the conflict.

---

## Verification Matrix

- Registry: `npm run test:jest -- --runTestsByPath test/manifest-stone-registry.test.ts`
- Marker classification: `npm run test:jest -- --runTestsByPath test/game.special-stone-visual-rule.test.ts test/special-card-foundation.test.ts`
- Observer behavior: `npm run test:jest -- --runTestsByPath test/game.observer-will-marker.test.ts test/game.observer-will-repayment.test.ts test/game.observer-will-selection.test.ts`
- Inviolability/targets: `npm run test:jest -- --runTestsByPath test/game.special-card-inviolable.test.ts test/game.loss-will.test.ts test/game.corrosion-will.test.ts test/game.capture-will.test.ts`
- UI labels: `npm run test:jest -- --runTestsByPath test/ui.long-press-info.test.ts test/ui.card-detail-effect-tags.test.ts`
- Network projection: `npm run test:jest -- --runTestsByPath test/utils.match-authority.public-snapshot.test.ts test/workers.match-pending-effect-id.test.ts test/workers.match-network-parity-missing-types.test.ts`
- Static checks: `npm run typecheck`
- Build: `npm run build:ts`
- Network parity: `npm run test:network:parity`
- Mirror: `npm run worker:prepare`

## Completion Criteria

- New manifestation markers are emitted with `kind: 'manifestStone'`.
- Legacy `specialStone` manifestation markers still work in reveal, lock, absolute protection, expiry, and repayment paths.
- Ordinary special-stone target effects do not see manifestation stones.
- Long-press UI shows `顕現石` and not `特殊石` for manifestation stones.
- Rulebook and card detail text use `顕現石`.
- Worker mirror is regenerated, not hand-edited.
- Final report lists commands run and any unrelated dirty files left in the workspace.
