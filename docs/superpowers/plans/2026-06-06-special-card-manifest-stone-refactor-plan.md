# Special Card Manifest Stone Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 特殊カードと顕現石まわりの重複判定・重複メタデータを整理し、盤理の観測者・理論の化身・将来の盤界の執行者を同じ基盤で扱えるようにする。

**Architecture:** 挙動は変えず、顕現石の正本を `shared/manifest-stone-registry.ts` に寄せる。headless のカード効果は `game/logic/card-resolution/` に閉じ、UI は registry と events/presentation metadata を読むだけにする。

**Tech Stack:** TypeScript, CommonJS-compatible shared modules, Jest, existing worker mirror generation via `npm run worker:prepare`.

---

## Current Problems

- 顕現石3種の判定が `shared/manifest-stone-registry.ts` 以外にも複数ある。
  - `game/logic/markers_adapter.ts`
  - `shared/stone-status-snapshot.ts`
  - `ui/diff-renderer.ts`
  - `game/turn/pipeline_ui_adapter.ts`
  - `game/turn/pipeline-ui/playback-after-state.ts`
- 顕現石 marker の生成データがカードごとに直書きされている。
  - `game/logic/card-resolution/observer-will.ts`
  - `game/logic/card-resolution/theory-incarnation.ts`
- 特殊カードの「不可侵カード」と、顕現石の「不可侵 marker」が別 registry で管理されており、cardId と markerType の対応を使う UI がループ探索している。
- `specialStone` だった旧顕現石を互換扱いする処理が複数箇所にあり、今後の削除・整理ポイントが見えにくい。
- 理論の化身の pending expiration など、顕現石共通 lifecycle とカード固有 lifecycle が同じファイル内で混ざり始めている。

## Preserve Behavior

- 顕現石の種類は維持する。
  - `THEORY_INCARNATION`
  - `BOARD_EXECUTOR`
  - `OBSERVER_WILL`
- marker kind は引き続き `manifestStone` を正とする。
- 旧互換として、`kind: 'specialStone'` かつ顕現石 type の marker は当面顕現石として扱う。
- 顕現石は特殊石ではないが、絶対保護・不可侵・専用見た目・専用背景/BGMの対象である。
- 盤面に存在できる顕現石は1つまでという既存方針を変えない。
- 特殊カードは手札破壊・奪取・ガチャ候補などから除外される。
- 観測者と理論の化身の現在の効果、イベント順、ネットワーク同期は変えない。
- `worker-public/` は直接編集せず、必要時は `npm run worker:prepare` で同期する。

## Out Of Scope

- 盤界の執行者の本実装。
- 顕現石の新演出追加。
- 顕現石の持続ターン、BGM、背景、セリフ、カードテキストの仕様変更。
- `manifestStone` という wire/state kind のリネーム。
- 旧 `specialStone` 顕現石互換の削除。

---

## Task 1: Characterize Manifest Stone Registry Behavior

**Files:**
- Create: `test/shared.manifest-stone-registry.test.ts`
- Modify: none

- [ ] **Step 1: Add registry characterization tests**

Create `test/shared.manifest-stone-registry.test.ts`:

```ts
const ManifestStoneRegistry = require('../shared/manifest-stone-registry');

describe('ManifestStoneRegistry', () => {
  test('knows all current manifestation stone types', () => {
    expect(ManifestStoneRegistry.MANIFEST_STONE_TYPES).toEqual([
      'THEORY_INCARNATION',
      'BOARD_EXECUTOR',
      'OBSERVER_WILL'
    ]);
    expect(ManifestStoneRegistry.isManifestStoneType('THEORY_INCARNATION')).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneType('BOARD_EXECUTOR')).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneType('OBSERVER_WILL')).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneType('GHOST')).toBe(false);
  });

  test('classifies manifestStone and legacy specialStone manifestation markers', () => {
    const current = {
      kind: 'manifestStone',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 5 }
    };
    const legacy = {
      kind: 'specialStone',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 5 }
    };
    const normalSpecial = {
      kind: 'specialStone',
      data: { type: 'GHOST', remainingOwnerTurns: 3 }
    };

    expect(ManifestStoneRegistry.isManifestStoneMarker(current)).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneMarker(legacy)).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneMarker(normalSpecial)).toBe(false);
  });

  test('active manifestation marker requires positive remainingOwnerTurns when present', () => {
    expect(ManifestStoneRegistry.isActiveManifestStoneMarker({
      kind: 'manifestStone',
      data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 1 }
    })).toBe(true);
    expect(ManifestStoneRegistry.isActiveManifestStoneMarker({
      kind: 'manifestStone',
      data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 0 }
    })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the new test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\shared.manifest-stone-registry.test.ts
```

Expected: PASS. This locks current registry behavior before refactoring consumers.

- [ ] **Step 3: Commit characterization**

```powershell
git add test/shared.manifest-stone-registry.test.ts
git commit -m "Characterize manifest stone registry"
```

---

## Task 2: Consolidate Local Manifest Type Fallbacks In Headless Shared Consumers

**Files:**
- Modify: `game/logic/markers_adapter.ts`
- Modify: `shared/stone-status-snapshot.ts`
- Test: `test/shared.manifest-stone-registry.test.ts`
- Test: `test/game.special-stone-visual-rule.test.ts`
- Test: `test/game.special-card-inviolable.test.ts`

- [ ] **Step 1: Update `game/logic/markers_adapter.ts` fallback shape**

Keep `ManifestStoneRegistry` as the primary source. Replace direct local comparisons with a single fallback array constant only used when the registry cannot be loaded. Do not remove the fallback yet because browser/global boot order still needs a safe no-registry path:

```ts
const FALLBACK_MANIFEST_STONE_TYPES = Object.freeze([
    'THEORY_INCARNATION',
    'BOARD_EXECUTOR',
    'OBSERVER_WILL'
]);

function isManifestStoneType(rawType: unknown): boolean {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneType === 'function') {
        return ManifestStoneRegistry.isManifestStoneType(rawType) === true;
    }
    const type = String(rawType || '').trim().toUpperCase();
    return FALLBACK_MANIFEST_STONE_TYPES.includes(type);
}
```

This keeps browser/worker fallback behavior but makes the duplicated list obvious and isolated.

- [ ] **Step 2: Update `shared/stone-status-snapshot.ts` the same way**

Use the same `FALLBACK_MANIFEST_STONE_TYPES` pattern near its local `isManifestStoneType` helper. Do not change output tags or snapshot shape.

- [ ] **Step 3: Run focused tests**

```powershell
npx jest --runInBand --runTestsByPath test\shared.manifest-stone-registry.test.ts test\game.special-stone-visual-rule.test.ts test\game.special-card-inviolable.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add game/logic/markers_adapter.ts shared/stone-status-snapshot.ts
git commit -m "Centralize manifest stone type fallback"
```

---

## Task 3: Add Manifest Marker Data Builder

**Files:**
- Modify: `shared/manifest-stone-registry.ts`
- Create: `test/shared.manifest-stone-registry.marker-data.test.ts`

- [ ] **Step 1: Add marker data builder tests**

Create `test/shared.manifest-stone-registry.marker-data.test.ts`:

```ts
const ManifestStoneRegistry = require('../shared/manifest-stone-registry');

describe('manifest stone marker data builder', () => {
  test('builds observer marker data from registry metadata', () => {
    const data = ManifestStoneRegistry.createManifestStoneMarkerData('OBSERVER_WILL', {
      repaymentId: 'repay_1',
      stolenCardId: 'meteor_01'
    });

    expect(data).toEqual(expect.objectContaining({
      type: 'OBSERVER_WILL',
      sourceType: 'OBSERVER_WILL',
      remainingOwnerTurns: 5,
      absoluteProtected: true,
      visualEffectKey: 'observerWillStone',
      repaymentId: 'repay_1',
      stolenCardId: 'meteor_01'
    }));
  });

  test('rejects unknown marker types by returning null', () => {
    expect(ManifestStoneRegistry.createManifestStoneMarkerData('GHOST')).toBeNull();
  });
});
```

- [ ] **Step 2: Add `createManifestStoneMarkerData`**

Modify `shared/manifest-stone-registry.ts`:

```ts
function createManifestStoneMarkerData(rawType: unknown, extra?: any): any {
    const metadata = getManifestStoneMetadata(rawType);
    if (!metadata) return null;
    const type = metadata.markerType;
    const data = {
        type,
        remainingOwnerTurns: metadata.durationOwnerTurns,
        absoluteProtected: metadata.absoluteProtected === true,
        sourceType: type,
        visualEffectKey: metadata.visualEffectKey
    };
    return Object.assign(data, (extra && typeof extra === 'object') ? extra : {});
}
```

Add it to the returned object:

```ts
createManifestStoneMarkerData
```

- [ ] **Step 3: Run tests**

```powershell
npx jest --runInBand --runTestsByPath test\shared.manifest-stone-registry.marker-data.test.ts test\shared.manifest-stone-registry.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add shared/manifest-stone-registry.ts test/shared.manifest-stone-registry.marker-data.test.ts
git commit -m "Add manifest stone marker data builder"
```

---

## Task 4: Use Marker Data Builder In Observer And Theory Placement

**Files:**
- Modify: `game/logic/cards.ts`
- Modify: `game/logic/card-resolution/observer-will.ts`
- Modify: `game/logic/card-resolution/theory-incarnation.ts`
- Test: `test/game.observer-will-marker.test.ts`
- Test: `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Pass registry builder through existing deps**

In `game/logic/cards.ts`, add `ManifestStoneRegistry` near the existing shared registry imports. Use the existing module/global resolver pattern already used by `SpecialCardRegistry`; do not add direct `require('../shared/...')` calls:

```ts
const ManifestStoneRegistry = resolveCardLogicModuleOrGlobal('../../shared/manifest-stone-registry', 'ManifestStoneRegistry');
```

Add to both `getObserverWillResolutionDeps()` and `getTheoryIncarnationResolutionDeps()`:

```ts
ManifestStoneRegistry
```

- [ ] **Step 2: Replace Observer marker literal**

In `game/logic/card-resolution/observer-will.ts`, replace the literal data object inside `applyObserverWillStoneReservation` with:

```ts
const registry = deps && deps.ManifestStoneRegistry;
const markerData = registry && typeof registry.createManifestStoneMarkerData === 'function'
    ? registry.createManifestStoneMarkerData('OBSERVER_WILL', {
        repaymentId: typeof reservation.repaymentId === 'string' ? reservation.repaymentId : null,
        stolenCardId: reservation.stolenCardId || null,
        stolenCardCopyId: Number.isInteger(reservation.stolenCardCopyId) ? reservation.stolenCardCopyId : null,
        repaymentIndex: Number.isInteger(reservation.repaymentIndex) ? reservation.repaymentIndex : null
    })
    : {
        type: 'OBSERVER_WILL',
        remainingOwnerTurns: 5,
        absoluteProtected: true,
        sourceType: 'OBSERVER_WILL',
        repaymentId: typeof reservation.repaymentId === 'string' ? reservation.repaymentId : null,
        stolenCardId: reservation.stolenCardId || null,
        stolenCardCopyId: Number.isInteger(reservation.stolenCardCopyId) ? reservation.stolenCardCopyId : null,
        repaymentIndex: Number.isInteger(reservation.repaymentIndex) ? reservation.repaymentIndex : null,
        visualEffectKey: 'observerWillStone'
    };
```

Then pass `markerData` to `addMarker`.

- [ ] **Step 3: Replace Theory marker literal**

In `game/logic/card-resolution/theory-incarnation.ts`, replace the literal data object inside `applyTheoryIncarnationStoneReservation` with:

```ts
const registry = deps && deps.ManifestStoneRegistry;
const markerData = registry && typeof registry.createManifestStoneMarkerData === 'function'
    ? registry.createManifestStoneMarkerData(THEORY_MARKER_TYPE, {
        sessionId: reservation.sessionId || null
    })
    : {
        type: THEORY_MARKER_TYPE,
        remainingOwnerTurns: THEORY_DURATION_OWNER_TURNS,
        absoluteProtected: true,
        sourceType: THEORY_MARKER_TYPE,
        sessionId: reservation.sessionId || null,
        visualEffectKey: 'theoryIncarnationStone'
    };
```

Then pass `markerData` to `deps.addMarker`.

- [ ] **Step 4: Run focused tests**

```powershell
npx jest --runInBand --runTestsByPath test\game.observer-will-marker.test.ts test\game.theory-incarnation.test.ts test\game.special-stone-visual-rule.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add game/logic/cards.ts game/logic/card-resolution/observer-will.ts game/logic/card-resolution/theory-incarnation.ts
git commit -m "Use registry data for manifest markers"
```

---

## Task 5: Centralize Active Manifest Stone Queries For Rules

**Files:**
- Modify: `game/logic/markers_adapter.ts`
- Modify: `game/logic/cards.ts`
- Test: `test/game.observer-will-selection.test.ts`
- Test: `test/game.special-card-inviolable.test.ts`

- [ ] **Step 1: Add adapter function**

In `game/logic/markers_adapter.ts`, add:

```ts
function getActiveManifestMarkers(cardState: any): Marker[] {
    return getManifestMarkers(cardState).filter((marker: any) => {
        if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isActiveManifestStoneMarker === 'function') {
            return ManifestStoneRegistry.isActiveManifestStoneMarker(marker) === true;
        }
        const remaining = Number(marker && marker.data && marker.data.remainingOwnerTurns);
        return !Number.isFinite(remaining) || remaining > 0;
    });
}
```

Export it from the adapter.

- [ ] **Step 2: Expose through `CardLogic`**

In `game/logic/cards.ts`, add:

```ts
function getActiveManifestMarkers(cardState: any) {
    return requireCardMarkersMethod('getActiveManifestMarkers')(cardState);
}
```

Export it in `cardsApi`.

- [ ] **Step 3: Replace active checks that manually inspect remaining turns**

Use `getActiveManifestMarkers(cardState)` for:

- one-manifest-on-board usage checks
- observer reveal active checks where the marker is already known to be a manifestation marker

Do not replace card-specific checks that must confirm `OBSERVER_WILL` or `THEORY_INCARNATION`; filter by type after using the common active manifest query.

- [ ] **Step 4: Run focused tests**

```powershell
npx jest --runInBand --runTestsByPath test\game.observer-will-selection.test.ts test\game.special-card-inviolable.test.ts test\game.observer-will-marker.test.ts test\game.theory-incarnation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add game/logic/markers_adapter.ts game/logic/cards.ts game/logic/card-resolution/observer-will.ts game/logic/card-resolution/theory-incarnation.ts
git commit -m "Centralize active manifest stone queries"
```

---

## Task 6: Replace UI Manifest Type Fallbacks With Registry Calls

**Files:**
- Modify: `ui/diff-renderer.ts`
- Modify: `game/turn/pipeline_ui_adapter.ts`
- Modify: `game/turn/pipeline-ui/playback-after-state.ts`
- Test: `test/game.pipeline-ui-adapter.spawn.test.ts`
- Test: `test/game.specialstone.spawn-meta-backfill.test.ts`

- [ ] **Step 1: Update `ui/diff-renderer.ts`**

Keep `_getManifestStoneRegistryForDiff()`. In `_isManifestStoneTypeForDiff`, make registry the primary path and leave the local fallback as a single array:

```ts
const FALLBACK_MANIFEST_STONE_TYPES_FOR_DIFF = Object.freeze([
    'THEORY_INCARNATION',
    'BOARD_EXECUTOR',
    'OBSERVER_WILL'
]);

function _isManifestStoneTypeForDiff(rawType: any) {
    const registry = _getManifestStoneRegistryForDiff();
    if (registry && typeof registry.isManifestStoneType === 'function') {
        return registry.isManifestStoneType(rawType) === true;
    }
    const typeKey = String(rawType || '').trim().toUpperCase();
    return FALLBACK_MANIFEST_STONE_TYPES_FOR_DIFF.includes(typeKey);
}
```

- [ ] **Step 2: Update `game/turn/pipeline_ui_adapter.ts`**

Add the registry to `PIPELINE_UI_ADAPTER_MODULE_GLOBALS`:

```ts
'../../shared/manifest-stone-registry': 'ManifestStoneRegistry',
```

Then load it with the existing optional module helper:

```ts
const ManifestStoneRegistry = requireOptionalModule('../../shared/manifest-stone-registry');
```

Add a local helper:

```ts
const FALLBACK_MANIFEST_STONE_TYPES_FOR_PIPELINE_UI = Object.freeze([
    'THEORY_INCARNATION',
    'BOARD_EXECUTOR',
    'OBSERVER_WILL'
]);

function isManifestStoneTypeForPipelineUI(rawType: any): boolean {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneType === 'function') {
        return ManifestStoneRegistry.isManifestStoneType(rawType) === true;
    }
    const typeKey = String(rawType || '').trim().toUpperCase();
    return FALLBACK_MANIFEST_STONE_TYPES_FOR_PIPELINE_UI.includes(typeKey);
}
```

Replace local 3-type comparisons in this file with `isManifestStoneTypeForPipelineUI`.

- [ ] **Step 3: Pass the predicate into `game/turn/pipeline-ui/playback-after-state.ts`**

Do not make `playback-after-state.ts` discover shared modules by itself. It already receives behavior through `PlaybackAfterStateDeps`, so add an optional dependency:

```ts
type PlaybackAfterStateDeps = {
    getVisualSpecialFromMeta: (meta: any) => any;
    shouldPreferFinalVisualStateForStatusApplied: (eventSpecialRaw: any, visualSpecial: any, livingWillAura: any) => boolean;
    getPrimaryTimerFromMeta: (meta: any) => any;
    getFlipEvadeRemainingFromMeta: (meta: any) => any;
    getDestroyEvadeRemainingFromMeta: (meta: any) => any;
    getVisualStateAt: (row: any, col: any, cardState: any, gameState: any) => any;
    isManifestStoneType?: (rawType: any) => boolean;
};
```

Change `isManifestStoneVisualType` to use the injected predicate first and keep the local fallback second:

```ts
const FALLBACK_MANIFEST_STONE_TYPES_FOR_PLAYBACK_AFTER = Object.freeze([
    'THEORY_INCARNATION',
    'BOARD_EXECUTOR',
    'OBSERVER_WILL'
]);

function isManifestStoneVisualType(rawType: any, deps: PlaybackAfterStateDeps) {
    if (deps && typeof deps.isManifestStoneType === 'function') {
        return deps.isManifestStoneType(rawType) === true;
    }
    const typeKey = String(rawType || '').trim().toUpperCase();
    return FALLBACK_MANIFEST_STONE_TYPES_FOR_PLAYBACK_AFTER.includes(typeKey);
}
```

Update the call in `createSpawnAfter`:

```ts
if (!visual || !isManifestStoneVisualType(visual.special, deps)) return eventSourced;
```

Finally, in `getPipelineUIPlaybackAfterStateDeps()` in `game/turn/pipeline_ui_adapter.ts`, pass:

```ts
isManifestStoneType: isManifestStoneTypeForPipelineUI
```

Keep event-sourced visual override behavior unchanged.

- [ ] **Step 4: Run focused UI adapter tests**

```powershell
npx jest --runInBand --runTestsByPath test\game.pipeline-ui-adapter.spawn.test.ts test\game.specialstone.spawn-meta-backfill.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add ui/diff-renderer.ts game/turn/pipeline_ui_adapter.ts game/turn/pipeline-ui/playback-after-state.ts
git commit -m "Use manifest registry in presentation adapters"
```

---

## Task 7: Add Marker Type Lookup To Special Card Registry

**Files:**
- Modify: `shared/special-card-registry.ts`
- Create: `test/shared.special-card-registry.test.ts`
- Modify: `ui/diff-renderer.ts`

- [ ] **Step 1: Add tests**

Create `test/shared.special-card-registry.test.ts`:

```ts
const SpecialCardRegistry = require('../shared/special-card-registry');

describe('SpecialCardRegistry', () => {
  test('finds presentation by marker type', () => {
    expect(SpecialCardRegistry.getSpecialCardPresentationByMarkerType('OBSERVER_WILL')).toEqual(expect.objectContaining({
      cardId: 'observer_will_01',
      markerType: 'OBSERVER_WILL',
      displayName: '盤理の観測者'
    }));
    expect(SpecialCardRegistry.getSpecialCardPresentationByMarkerType('THEORY_INCARNATION')).toEqual(expect.objectContaining({
      cardId: 'theory_incarnation_01',
      markerType: 'THEORY_INCARNATION',
      displayName: '理論の化身'
    }));
    expect(SpecialCardRegistry.getSpecialCardPresentationByMarkerType('GHOST')).toBeNull();
  });
});
```

- [ ] **Step 2: Add lookup map**

In `shared/special-card-registry.ts`, after `SPECIAL_CARD_PRESENTATION_BY_ID`, add:

```ts
const SPECIAL_CARD_ID_BY_MARKER_TYPE: Readonly<Record<string, string>> = Object.freeze(
    Object.fromEntries(Object.entries(SPECIAL_CARD_PRESENTATION_BY_ID).map(([cardId, meta]: [string, any]) => [
        String(meta.markerType || '').toUpperCase(),
        cardId
    ]))
);
```

Add function:

```ts
function getSpecialCardPresentationByMarkerType(markerType: unknown): any {
    const type = typeof markerType === 'string' ? markerType.trim().toUpperCase() : '';
    if (!type) return null;
    const cardId = SPECIAL_CARD_ID_BY_MARKER_TYPE[type];
    return cardId ? clonePresentationMetadata(SPECIAL_CARD_PRESENTATION_BY_ID[cardId]) : null;
}
```

Export it.

- [ ] **Step 3: Use lookup in `ui/diff-renderer.ts`**

Replace loops over `getInviolableSpecialCardIds()` used only to find presentation by `marker.data.type` with:

```ts
const meta = specialCardRegistry.getSpecialCardPresentationByMarkerType(typeKey);
```

Keep fallback loop only if `getSpecialCardPresentationByMarkerType` is not available.

- [ ] **Step 4: Run tests**

```powershell
npx jest --runInBand --runTestsByPath test\shared.special-card-registry.test.ts test\game.pipeline-ui-adapter.spawn.test.ts test\game.specialstone.spawn-meta-backfill.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add shared/special-card-registry.ts ui/diff-renderer.ts test/shared.special-card-registry.test.ts
git commit -m "Add special card presentation lookup by marker type"
```

---

## Task 8: Final Validation And Worker Mirror Sync

**Files:**
- Modify generated/mirror files only through scripts:
  - `public/module-registry.js`
  - `index.html`
  - `worker-public/**`

- [ ] **Step 1: Run focused manifest/special-card suite**

```powershell
npx jest --runInBand --runTestsByPath test\shared.manifest-stone-registry.test.ts test\shared.manifest-stone-registry.marker-data.test.ts test\shared.special-card-registry.test.ts test\game.special-stone-visual-rule.test.ts test\game.special-card-inviolable.test.ts test\game.observer-will-marker.test.ts test\game.observer-will-selection.test.ts test\game.theory-incarnation.test.ts test\game.pipeline-ui-adapter.spawn.test.ts test\game.specialstone.spawn-meta-backfill.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck and network parity**

```powershell
npm run typecheck
npm run test:network:parity
```

Expected: PASS.

- [ ] **Step 3: Sync browser/worker generated surfaces**

```powershell
npm run worker:prepare
```

Expected:

- `public/module-registry.js` updates if compiled browser modules changed.
- `worker-public/` mirror verifies successfully.
- No source edits are made directly under `worker-public/`.

- [ ] **Step 4: Inspect final diff**

```powershell
git status --short
git diff --check
git diff --stat
```

Expected:

- No whitespace errors.
- Only files changed by the refactor and generated mirror sync are present.
- Pre-existing unrelated untracked plan files remain unstaged.

- [ ] **Step 5: Commit final generated sync**

```powershell
git add public/module-registry.js index.html worker-public/index.html worker-public/public/module-registry.js worker-public/assets/asset-manifest.json
git commit -m "Sync worker assets after manifest refactor"
```

Skip this commit if `npm run worker:prepare` produces no generated changes.

---

## Risk Notes

- **Risk level:** Medium. This is mostly behavior-preserving, but it touches shared headless/UI classification paths used by local and network playback.
- **Main regression risk:** A UI fallback path stops recognizing legacy `specialStone` manifestation markers.
- **Mitigation:** Keep legacy kind support; add registry characterization; run network parity.
- **Rollback:** Each task is a small commit. Revert the last failing task commit first; earlier characterization commits can remain.

## Recommended First Pass

Start with Task 1 and Task 2 only. They are the lowest-risk cleanup and give immediate value by making duplicated type checks easier to audit without changing marker creation or presentation behavior.
