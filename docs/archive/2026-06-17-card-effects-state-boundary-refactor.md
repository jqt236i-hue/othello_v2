# Card Effects State Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Track progress by updating the checkbox list in this file.

**Goal:** `game/card-effects/*` のカード効果ロジックから `card-system.ts` への暗黙 state 依存を段階的に分離し、headless 層が browser/global state を直接参照しない構造へ寄せる。

**Architecture:** `game/card-effects` に pure state helper を追加し、既存の CommonJS 互換 export を維持しながら `card-system.ts` 依存を compatibility wrapper に閉じ込める。第 1 段階では挙動を変えず、テストで現状 fallback と新 helper の契約を固定する。

**Tech Stack:** TypeScript, CommonJS compatibility, Jest, existing `npm run check:window`, existing repo scripts.

---

## Document Role

この文書は refactor 実装計画書です。プレイヤー向け仕様、カード効果仕様、UI 文言、ネットワーク protocol を変更するものではありません。

Frontmatter/applyTo metadata is not used because this file is an implementation plan under `docs/superpowers/plans/`, not an AI instruction file under `.github/instructions` or an `AGENTS.md`-style scope file.

This plan does not supersede `01-rulebook.md`, `docs/architecture-contracts.md`, or any `正本/*.md` source-of-truth document.

## Target

対象は `game/card-effects/state-refs.ts`、`game/card-effects/helpers.ts`、そこから参照される protection marker state helper、および関連する focused Jest tests です。

## Source of Truth

- Gameplay specification: `01-rulebook.md`
- Architecture boundary: `docs/architecture-contracts.md`
- Repo work rules: `AGENTS.md`
- Current evidence:
  - `game/card-effects/state-refs.ts` imports `../../card-system`
  - `game/card-effects/helpers.ts` imports `../../card-system`
  - `card-system.ts` reads `window`, `globalThis.cardState`, and browser-facing globals
  - `game/turn-manager.ts` imports `./card-effects/helpers`

## Non-Goals

- `cards/card-interaction.ts` の分割はこの計画の範囲外です。
- `cards/card-renderer.ts` の view-model 抽出はこの計画の範囲外です。
- `workers/*`、`utils/match-authority.ts`、SSE/idempotency protocol の再設計は行いません。
- `01-rulebook.md` と `正本/*.md` は、挙動変更がないため更新しません。
- `worker-public/`、`dist/`、`public/module-registry.js` は直接編集しません。

## Current Risk

`game/card-effects/*` は headless 側のカード効果処理として使われる一方で、`card-system.ts` を経由して browser/global state に到達できます。`npm run check:window` が成功しても、`card-system.ts` 経由の間接依存は検出対象から漏れる可能性があります。

この refactor は大規模分割ではなく、最初の reviewable unit として state 参照境界を明示化します。既存挙動を保存し、次段階で `card-system.ts` import を完全に外せる状態にします。

## Completion Criteria

- `game/card-effects/protection-state.ts` が追加され、`card-system.ts`、`window`、`document`、`globalThis` を参照しない。
- `helpers.ts` は既存 `getActiveProtectionForPlayer(player)` export を維持しつつ、pure helper `getActiveProtectionForCardState(cardState, player)` を export する。
- `state-refs.ts` の `card-system.ts` fallback は 1 箇所の legacy provider に集約され、テストで現状互換が固定される。
- 新規または更新済み focused tests が成功する。
- `npm run check:window` が成功する。
- `npm run typecheck` が成功する。
- 新規計画とは別の unrelated dirty files を stage/commit しない。

## Phase 0: Preflight

- [ ] Run `git status --short`.

  Expected output: dirty files may exist. Classify any dirty files outside this plan as unrelated user/WIP changes and do not edit or stage them.

- [ ] Confirm the target files exist.

  ```powershell
  Test-Path .\game\card-effects\state-refs.ts
  Test-Path .\game\card-effects\helpers.ts
  Test-Path .\card-system.ts
  Test-Path .\test\game.card-effects.state-refs.test.ts
  ```

  Expected output: each command returns `True`.

- [ ] Read the current implementations before editing.

  ```powershell
  Get-Content .\game\card-effects\state-refs.ts
  Get-Content .\game\card-effects\helpers.ts
  Get-Content .\test\game.card-effects.state-refs.test.ts
  ```

  Expected output: current fallback and export contracts are visible.

## Phase 1: Characterize Existing State Fallback

- [ ] Extend `test/game.card-effects.state-refs.test.ts` with a test that proves `resolveActiveCardState(null, null)` can still fall back to legacy `card-system.ts` state.

  Add this test beside the existing `resolveActiveCardState` tests:

  ```ts
  test('falls back to legacy card-system state when injected state is unavailable', () => {
    jest.resetModules();

    const cardSystem = require('../card-system');
    const stateRefs = require('../game/card-effects/state-refs');
    const legacyState = {
      active: true,
      markers: [{ type: 'PROTECTED', owner: 1 }],
    };

    for (const key of Object.keys(cardSystem.cardState)) {
      delete cardSystem.cardState[key];
    }
    Object.assign(cardSystem.cardState, legacyState);

    expect(stateRefs.resolveActiveCardState(null, null)).toBe(cardSystem.cardState);
  });
  ```

- [ ] Run the focused test.

  ```powershell
  npm run test:jest -- test/game.card-effects.state-refs.test.ts
  ```

  Expected output: the suite passes before refactoring. If it fails, stop and record the exact failure because the plan is relying on an incorrect current-contract assumption.

## Phase 2: Add Pure Protection State Helper

- [ ] Create `game/card-effects/protection-state.ts`.

  Implementation:

  ```ts
  export {};

  declare const __non_webpack_require__: NodeRequire | undefined;

  const _require =
    typeof __non_webpack_require__ !== 'undefined'
      ? __non_webpack_require__
      : typeof require !== 'undefined'
        ? require
        : null;

  function requireOptional(path: string): any {
    if (!_require) return null;
    try {
      return _require(path);
    } catch (_error) {
      return null;
    }
  }

  const SharedConstants = requireOptional('../../shared-constants') || {};
  const MarkersAdapter = requireOptional('../logic/markers_adapter') || {};
  const OwnerHelpers = requireOptional('../../utils/owner-helpers') || {};

  const BLACK = SharedConstants.BLACK ?? 1;
  const WHITE = SharedConstants.WHITE ?? -1;

  function getPlayerKey(player: number): string {
    return player === BLACK ? 'black' : 'white';
  }

  function getPlayerDisplayName(player: number): string {
    return player === BLACK ? '黒' : '白';
  }

  function getOwner(player: number): number {
    if (typeof OwnerHelpers.normalizeOwnerToPlayer === 'function') {
      return OwnerHelpers.normalizeOwnerToPlayer(player);
    }
    return player === BLACK ? BLACK : WHITE;
  }

  function getMarkerList(cardState: any): any[] {
    if (!cardState || !cardState.markers) return [];
    if (typeof MarkersAdapter.getActiveMarkers === 'function') {
      const markers = MarkersAdapter.getActiveMarkers(cardState);
      return Array.isArray(markers) ? markers : [];
    }
    return Array.isArray(cardState.markers) ? cardState.markers : [];
  }

  function getActiveProtectionForCardState(cardState: any, player: number): any[] {
    const owner = getOwner(player);
    return getMarkerList(cardState).filter((marker) => {
      if (!marker || marker.type !== 'PROTECTED') return false;
      const markerOwner =
        typeof OwnerHelpers.normalizeOwnerToPlayer === 'function'
          ? OwnerHelpers.normalizeOwnerToPlayer(marker.owner)
          : marker.owner;
      return markerOwner === owner;
    });
  }

  module.exports = {
    getPlayerKey,
    getPlayerDisplayName,
    getOwner,
    getActiveProtectionForCardState,
  };
  ```

- [ ] Add `test/game.card-effects.protection-state.test.ts`.

  Implementation:

  ```ts
  describe('game/card-effects/protection-state', () => {
    test('filters active protection markers for the requested player', () => {
      const ProtectionState = require('../game/card-effects/protection-state');
      const cardState = {
        markers: [
          { type: 'PROTECTED', owner: 1, id: 'black-protection' },
          { type: 'PROTECTED', owner: -1, id: 'white-protection' },
          { type: 'OTHER', owner: 1, id: 'ignored' },
        ],
      };

      expect(ProtectionState.getActiveProtectionForCardState(cardState, 1)).toEqual([
        { type: 'PROTECTED', owner: 1, id: 'black-protection' },
      ]);
    });

    test('returns an empty list for missing or malformed marker state', () => {
      const ProtectionState = require('../game/card-effects/protection-state');

      expect(ProtectionState.getActiveProtectionForCardState(null, 1)).toEqual([]);
      expect(ProtectionState.getActiveProtectionForCardState({ markers: null }, 1)).toEqual([]);
    });
  });
  ```

- [ ] Run the new focused test.

  ```powershell
  npm run test:jest -- test/game.card-effects.protection-state.test.ts
  ```

  Expected output: the suite passes.

## Phase 3: Route Existing Helper Through Pure Helper

- [ ] Update `game/card-effects/helpers.ts` so display-name and owner helpers come from `protection-state.ts`, while the legacy wrapper still reads `CardSystem.cardState`.

  Required shape:

  ```ts
  const ProtectionState = _require('./protection-state');
  const CardSystem = _require('../../card-system');

  const {
    getPlayerKey,
    getPlayerDisplayName,
    getOwner,
    getActiveProtectionForCardState,
  } = ProtectionState;

  function getActiveProtectionForPlayer(player: number): any[] {
    return getActiveProtectionForCardState(CardSystem.cardState, player);
  }
  ```

  Preserve all existing public exports from `helpers.ts`, and add `getActiveProtectionForCardState` to `module.exports`.

- [ ] Run existing helper consumers.

  ```powershell
  npm run test:jest -- test/game.card-effects.protection-state.test.ts test/game.card-effects.state-refs.test.ts test/turn-manager.window-boundary.test.ts
  ```

  Expected output: all listed tests pass.

## Phase 4: Isolate Legacy State Provider In State Refs

- [ ] Update `game/card-effects/state-refs.ts` so `card-system.ts` is read through a single named provider function.

  Required shape:

  ```ts
  function readLegacyCardSystemState(): any | null {
    return CardSystem && CardSystem.cardState && typeof CardSystem.cardState === 'object'
      ? CardSystem.cardState
      : null;
  }

  let legacyCardStateProvider = readLegacyCardSystemState;

  function setLegacyCardStateProviderForTests(provider: any): void {
    legacyCardStateProvider =
      typeof provider === 'function' ? provider : readLegacyCardSystemState;
  }
  ```

  `resolveActiveCardState(currentCardState, fallbackCardState)` must continue to prefer explicit injected state first, explicit fallback second, and legacy provider third.

- [ ] Export `setLegacyCardStateProviderForTests` only from CommonJS `module.exports`; do not add it to browser globals.

- [ ] Extend `test/game.card-effects.state-refs.test.ts` to verify provider precedence.

  Add:

  ```ts
  test('prefers explicit state over legacy provider state', () => {
    jest.resetModules();

    const stateRefs = require('../game/card-effects/state-refs');
    const explicitState = { markers: [{ id: 'explicit' }] };
    const legacyState = { markers: [{ id: 'legacy' }] };

    stateRefs.setLegacyCardStateProviderForTests(() => legacyState);

    expect(stateRefs.resolveActiveCardState(explicitState, null)).toBe(explicitState);
    expect(stateRefs.resolveActiveCardState(null, null)).toBe(legacyState);

    stateRefs.setLegacyCardStateProviderForTests(null);
  });
  ```

- [ ] Run the state-ref focused tests.

  ```powershell
  npm run test:jest -- test/game.card-effects.state-refs.test.ts
  ```

  Expected output: the suite passes.

## Phase 5: Add Boundary Guard Test

- [ ] Add `test/game.card-effects.boundary-imports.test.ts`.

  Implementation:

  ```ts
  const fs = require('fs');
  const path = require('path');

  describe('game/card-effects boundary imports', () => {
    test('protection-state stays independent from browser globals and card-system', () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, '../game/card-effects/protection-state.ts'),
        'utf8'
      );

      expect(source).not.toMatch(/card-system/);
      expect(source).not.toMatch(/\bwindow\b/);
      expect(source).not.toMatch(/\bdocument\b/);
      expect(source).not.toMatch(/\bglobalThis\b/);
    });
  });
  ```

- [ ] Run boundary tests.

  ```powershell
  npm run test:jest -- test/game.card-effects.boundary-imports.test.ts test/game.card-effects.protection-state.test.ts
  ```

  Expected output: both suites pass.

## Phase 6: Validation Bundle

- [ ] Run focused regression tests.

  ```powershell
  npm run test:jest -- test/game.card-effects.state-refs.test.ts test/game.card-effects.protection-state.test.ts test/game.card-effects.boundary-imports.test.ts test/turn-manager.window-boundary.test.ts
  ```

  Expected output: all listed tests pass.

- [ ] Run architecture guard.

  ```powershell
  npm run check:window
  ```

  Expected output: command exits successfully.

- [ ] Run typecheck.

  ```powershell
  npm run typecheck
  ```

  Expected output: command exits successfully.

- [ ] Inspect the final diff.

  ```powershell
  git diff -- game/card-effects/protection-state.ts game/card-effects/helpers.ts game/card-effects/state-refs.ts test/game.card-effects.state-refs.test.ts test/game.card-effects.protection-state.test.ts test/game.card-effects.boundary-imports.test.ts
  ```

  Expected output: only the intended files are changed.

## Phase 7: Commit

- [ ] Stage only files changed by this plan.

  ```powershell
  git add -- game/card-effects/protection-state.ts game/card-effects/helpers.ts game/card-effects/state-refs.ts test/game.card-effects.state-refs.test.ts test/game.card-effects.protection-state.test.ts test/game.card-effects.boundary-imports.test.ts
  ```

- [ ] Confirm unrelated files are not staged.

  ```powershell
  git status --short
  ```

  Expected output: staged entries are limited to the files above. Other dirty files may remain unstaged.

- [ ] Commit the isolated refactor.

  ```powershell
  git commit -m "Refactor card effect state boundary"
  ```

## Follow-Up Refactor Candidates

These should be separate plans after the state boundary refactor is merged or otherwise stabilized:

- Split `cards/card-interaction.ts` into selection state, action wiring, preview/busy state, and DOM event modules.
- Extract `cards/card-renderer.ts` view-model and affordance calculation from DOM rendering.
- Consolidate duplicated card UI text and generated catalog projections around the catalog/codegen path.
- Re-audit network authority only against current `workers/*`, `utils/match-authority.ts`, and `ui/network/*`; older audit notes are partly stale.

## Rollback Plan

If a focused test fails because behavior changed unexpectedly, revert only the files touched by this plan and keep the characterization test failure output. Do not revert unrelated dirty files.

If `npm run check:window` fails, inspect whether the new helper introduced browser/global references. The intended fix is to remove that reference from `protection-state.ts`, not to loosen the guard.

## Self-Review Checklist

- [ ] No player-visible behavior changed.
- [ ] No edit was made to `01-rulebook.md`, `正本/*.md`, `worker-public/`, `dist/`, or `public/module-registry.js`.
- [ ] The pure helper has no dependency on `card-system.ts`.
- [ ] Legacy compatibility remains through existing exports.
- [ ] Focused tests and validation bundle passed.
- [ ] Only intended files were staged and committed.
