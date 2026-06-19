# Turn Start Network Parity Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local play, local match server, and Cloudflare Worker resolve multiple turn-start special stones, bombs, continued states, PRNG, and playback ordering through the same deterministic contracts.

**Architecture:** Freeze only the turn-start anchor set at the turn-start entrance, resolve each surviving canonical anchor synchronously against the latest canonical state, emit ordered presentation events, and convert them with a pure playback planner into deterministic phases. Network authority owns canonical results and PRNG state; clients only present authoritative playback or validated local preview.

**Tech Stack:** TypeScript/JavaScript game core, Jest focused tests, Cloudflare Worker source under `workers/`, local match server under `scripts/`, browser UI/network modules under `ui/`.

---

## Non-Negotiable Contracts

- Root implementation is canonical. Do not source-edit `worker-public/`, `dist/`, or `public/module-registry.js`.
- `game/`, `shared/`, CPU logic, and pure card logic remain headless: no DOM, `window`, audio, timers, browser globals, or network clients.
- The UI is not gameplay authority. Playback locks, preview state, animation state, and busy flags never decide canonical game results.
- Turn-start effects are deterministic and synchronous in game core. Animation waiting happens only after canonical results and ordered presentation events are fixed.
- Every accepted authority operation must persist the next `prngState`.
- Every phase-changing playback contract must be covered by focused tests before broad refactors.

## Current Evidence Summary

- `README_LIGHTWEIGHT.md` is absent in this checkout. Treat that as repository state, not a game bug.
- `01-rulebook.md` and `正本/ターン進行正本.md` require turn-start effects before draw, createdSeq-based turn-start order, no same-turn activation for newly born turn-start objects, and one-by-one special stone/bomb processing.
- `game/turn/turn_pipeline_phases.ts` currently calls `CardLogic.onTurnStart()` before `TurnStartMarkerPhase.collectTurnStartMarkerAnchors()`.
- `game/logic/cards-internal/effect-timing.ts` currently performs draw inside `onTurnStart()` before later special-marker processing.
- `game/turn/turn-start/marker-phase.ts` currently stores marker object references and sorts only by `createdSeq || 0`.
- `game/turn/pipeline-ui/board-event-playback.ts` currently groups batch destroy phases by cause, which can merge separate time bombs.
- `workers/match-worker.ts` has a Worker-local TurnPipeline copy whose `applyTurnSafe()` returns `stateHash: null` and does not mirror root `prngState` persistence in the same place.

## Target File Map

- Specs:
  - Modify `01-rulebook.md`
  - Modify `正本/ターン進行正本.md`
  - Modify `正本/演出正本.md`
  - Modify `正本/共通ルール正本.md`
- Turn-start core:
  - Modify `game/turn/turn_pipeline_phases.ts`
  - Modify `game/turn/turn-start/marker-phase.ts`
  - Modify `game/turn/turn-start/special-stone-phase.ts`
  - Modify `game/turn/turn-start/bomb-phase.ts`
  - Modify `game/turn/turn-start/post-processing.ts`
  - Modify `game/turn/turn-start/timer-phase.ts`
  - Modify `game/logic/cards-internal/effect-timing.ts`
  - Modify `game/logic/cards/markers.ts`
  - Modify `game/logic/markers_adapter.ts`
  - Modify `game/logic/board_ops.ts` only if a metadata-only action scope is needed
- Playback:
  - Create `shared/playback-planner.ts`
  - Create `shared/playback-digest.ts`
  - Modify `game/turn/pipeline-ui/board-event-playback.ts`
  - Modify `game/turn/pipeline_ui_adapter.ts`
  - Modify `shared/playback-event-helpers.ts`
  - Modify `game/turn/pipeline-ui/sound-cues.ts` if sound phase grouping depends on destroy phase grouping
- Network authority:
  - Modify `workers/match-worker.ts`
  - Modify `scripts/local-match-server.ts`
  - Modify `utils/match-authority.ts`
  - Modify `ui/network/playback-recovery.ts`
  - Modify `ui/network/action-bridge.ts`
  - Modify `ui/network-client.ts` only for integration wiring
- Tests:
  - Create `test/game.marker-identity-contract.test.ts`
  - Modify `test/game.turn-start-marker-order.test.ts`
  - Modify `test/game.pipeline-ui-adapter.destroy-batch.test.ts`
  - Modify `test/game.pipeline-ui-adapter.spawn.test.ts` if rescue/spawn ordering changes
  - Create `test/game.turn-start-anchor-lifecycle.test.ts`
  - Create `test/workers.match-prng-contract.test.ts` or extend existing Worker parity tests
  - Create `test/shared.playback-planner.test.ts`
  - Create `test/ui.network-playback-digest.test.ts`
  - Extend network parity tests used by `npm run test:network:parity`

---

## Phase 0: Specification Lock

**Purpose:** Make the intended behavior explicit before behavior-changing code lands.

**Files:**
- Modify: `01-rulebook.md`
- Modify: `正本/ターン進行正本.md`
- Modify: `正本/演出正本.md`
- Modify: `正本/共通ルール正本.md`

- [x] **Step 0.1: Document turn-start anchor snapshot timing**

Add to `正本/ターン進行正本.md` under turn-start ordering:

```markdown
ターン開始処理では、今回のターン開始中に発動可能な特殊石・爆弾・継続状態の個体集合を、ターン開始由来の最初の盤面・マーカー変更より前に固定する。

固定するのは個体の同一性、登場順、同値時の実装順だけであり、現在座標、所有者、対象候補、移動先、破壊対象、生成先、乱数結果、効果結果は固定しない。

固定後に支払い、破壊、救済、復活、生成などで消えた個体は、その個体の処理枠で生存確認に失敗した場合は発動しない。同じ座標・同じ種類の新規個体へ処理枠を引き継がない。

固定後に新しく生成・復活・付与された特殊石、爆弾、継続状態は、その同じターン開始処理では発動せず、次に条件を満たすターン開始から処理する。
```

- [x] **Step 0.2: Document deterministic anchor order**

Add to the same section:

```markdown
ターン開始アンカーの基本順は `createdSeq` 昇順とする。`createdSeq` が同値または欠損している互換状態では、ターン開始入口で取得した canonical marker 配列上の `sourceIndex` 昇順を第2キーにする。さらに比較が必要な場合は安定した `markerId` の文字列表現を第3キーにする。

この比較規則はローカル対戦、ローカルサーバー、Cloudflare Worker で同じでなければならない。JavaScript エンジンの stable sort だけには依存しない。
```

- [x] **Step 0.3: Document identity**

Add to `01-rulebook.md` marker/special-stone terminology area:

```markdown
盤面上でターン開始効果を持つ特殊石、爆弾、継続状態は、長期的には一意で安定した `markerId` と、盤面上に成立した順序を示す `createdSeq` を持つ。

石が移動しても `markerId` と `createdSeq` は変わらない。複製、生成、救済、復活などで新しく成立した個体は新しい `markerId` と `createdSeq` を得る。

互換状態で `markerId` が欠損している場合、同一 runtime 内の同一 turn-start 処理中に限り、元 marker object が現在 marker 集合に残っていることだけを互換的な同一性として扱う。座標、種類、所有者だけで旧個体を新個体へ引き継がない。
```

- [x] **Step 0.4: Document playback IDs**

Add to `正本/演出正本.md`:

```markdown
ゲームコアは確定した意味順を持つ ordered presentation events を生成する。UI はこの順序から逆算して特殊石順を推測してはならない。

`sequenceIndex` は全 presentation event の意味順、`actionId` は1つの特殊石・爆弾・ターン開始アンカーの直列境界、`effectBlockId` は1回の爆発や1回の破壊バッチなど同時表示を許す一括効果境界、`phase` は実際にUIが同時再生する単位とする。

異なる非 null `actionId` を持つイベントは同じ `phase` に入れない。1個の時限爆弾による範囲破壊は同じ `effectBlockId` 内で同じ `phase` にできるが、別の時限爆弾は `cause` が同じでも別 `actionId` として後続 `phase` にする。
```

- [x] **Step 0.5: Document PRNG authority**

Add to `正本/共通ルール正本.md` random section:

```markdown
ネット対戦では authority だけが canonical な乱数を消費する。ローカル対戦、ローカルサーバー、Cloudflare Worker は同じ PRNG 実装、同じ候補配列順、同じ消費順、同じ保存契約を使う。

受理された操作の処理後、authority は次の `prngState` を必ず canonical `cardState` へ保存する。却下された操作では canonical PRNG を消費しない。

UI は演出の見た目を再生してよいが、ランダム対象を再抽選してはならない。
```

- [x] **Step 0.6: Resolve previously open specification decisions**

Add to `正本/ターン進行正本.md`:

```markdown
同じ物理石に複数のターン開始対象がある場合、その処理枠の登場順は、その枠に属する対象のうち最小の `createdSeq` とする。枠内では石本体の効果を先に処理し、付与状態は `createdSeq` 昇順、同値時は状態の canonical sourceIndex 昇順で処理する。

同じセルに存在するという理由だけで、凍結、種、封鎖、穴、数字マス、顕現石などの盤面マーカーを物理石の状態枠へ統合しない。物理石へ付与された石状態だけを同じ処理枠の対象にする。

凍結セルの有効判定は、現行互換としてターン開始入口で固定する。ターン開始処理中に凍結期限が切れても、その同じターン開始中に後続特殊石が凍結対象セルを通過できるようにはしない。この挙動を変更する場合は、今回の turn-start parity 変更とは別仕様変更として扱う。

legacy marker に `markerId` が欠損している状態は移行互換として扱う。Phase 1 完了後の canonical cardState では、turn-start 対象になり得る marker は必ず canonical string `markerId` を持つ。
```

Add to `01-rulebook.md` near special-stone classification:

```markdown
ターン開始処理の同一個体判定に使う `markerId` は文字列として正規化する。数値IDを持つ互換データは読み込み・正規化時に同じ内容の文字列IDへ変換する。
```

- [x] **Step 0.7: Verify docs-only consistency**

Run:

```powershell
rg -n "ターン開始|createdSeq|markerId|actionId|effectBlockId|prngState|phase" 01-rulebook.md 正本\ターン進行正本.md 正本\演出正本.md 正本\共通ルール正本.md
git diff -- 01-rulebook.md 正本\ターン進行正本.md 正本\演出正本.md 正本\共通ルール正本.md
```

Expected:
- The new contract is present in all four source-of-truth documents.
- No generated or mirror files changed.

- [x] **Step 0.8: Commit Phase 0**

```powershell
git add 01-rulebook.md 正本\ターン進行正本.md 正本\演出正本.md 正本\共通ルール正本.md
git commit -m "docs: define deterministic turn-start playback contract"
```

---

## Phase 1: Fix Confirmed Root Bugs Without Lifecycle Refactor

**Purpose:** Stop known order/sync bugs while avoiding broad movement of rescue and duration lifecycle code.

### Task 1.0: Canonical Marker Identity Baseline

**Files:**
- Modify: `game/logic/cards/markers.ts`
- Modify: `game/logic/markers_adapter.ts`
- Create: `test/game.marker-identity-contract.test.ts`

- [ ] **Step 1.0.1: Write marker identity contract tests**

Create `test/game.marker-identity-contract.test.ts` with tests for new and legacy marker shapes:

```ts
const CardLogic = require('../game/logic/cards');
const MarkersAdapter = require('../game/logic/markers_adapter');

test('CardLogic.addMarker assigns canonical string markerId and createdSeq', () => {
  const cardState: any = { markers: [], _nextMarkerId: 1, _nextCreatedSeq: 10 };
  const marker = CardLogic.addMarker(cardState, 'specialStone', 2, 3, 'black', { type: 'TIME_BOMB', category: 'bomb' });
  expect(marker.markerId).toBe('1');
  expect(typeof marker.markerId).toBe('string');
  expect(marker.id).toBe(1);
  expect(marker.createdSeq).toBe(10);
});

test('MarkersAdapter.ensureMarkers backfills markerId without changing existing createdSeq', () => {
  const cardState: any = {
    markers: [{ id: 7, row: 1, col: 1, kind: 'specialStone', owner: 'white', createdSeq: 99, data: { type: 'DRAGON' } }],
    _nextMarkerId: 8
  };
  MarkersAdapter.ensureMarkers(cardState);
  expect(cardState.markers[0].markerId).toBe('7');
  expect(cardState.markers[0].createdSeq).toBe(99);
});

test('legacy marker without id gets deterministic markerId from canonical order', () => {
  const cardState: any = {
    markers: [
      { row: 0, col: 0, kind: 'specialStone', owner: 'black', createdSeq: 2, data: { type: 'SNIPER' } },
      { row: 0, col: 1, kind: 'specialStone', owner: 'white', createdSeq: 3, data: { type: 'TIME_BOMB', category: 'bomb' } }
    ],
    _nextMarkerId: 20
  };
  MarkersAdapter.ensureMarkers(cardState);
  expect(cardState.markers.map((m: any) => m.markerId)).toEqual(['20', '21']);
  expect(cardState._nextMarkerId).toBe(22);
});
```

- [ ] **Step 1.0.2: Run identity tests and confirm failure**

```powershell
npx jest --runInBand --runTestsByPath test\game.marker-identity-contract.test.ts
```

Expected before implementation:
- At least the `markerId` assertions fail.

- [ ] **Step 1.0.3: Add canonical marker ID helpers**

In `game/logic/markers_adapter.ts`, add:

```ts
function normalizeMarkerId(value: unknown): string | null {
    if (value === undefined || value === null || value === '') return null;
    return String(value);
}

function assignMarkerIdentity(cardState: CardState, marker: Marker): Marker {
    if (!marker || typeof marker !== 'object') return marker;
    const existing = normalizeMarkerId((marker as any).markerId);
    if (existing) {
        (marker as any).markerId = existing;
        return marker;
    }
    const legacy = normalizeMarkerId(marker.id);
    if (legacy) {
        (marker as any).markerId = legacy;
        return marker;
    }
    const nextId = Number.isFinite(Number(cardState._nextMarkerId))
        ? Math.trunc(Number(cardState._nextMarkerId))
        : 1;
    marker.id = nextId;
    (marker as any).markerId = String(nextId);
    cardState._nextMarkerId = nextId + 1;
    return marker;
}
```

- [ ] **Step 1.0.4: Backfill identity in `ensureMarkers()`**

Update `MarkersAdapter.ensureMarkers(cardState)` so it:
- initializes `markers` to an array
- initializes `_nextMarkerId`
- calls `assignMarkerIdentity(cardState, marker)` for every marker in canonical array order
- guarantees `_nextMarkerId` is greater than every numeric marker `id`

- [ ] **Step 1.0.5: Add `markerId` in `CardLogic.addMarker()`**

In `game/logic/cards/markers.ts`, update the marker object built by `addMarker()`:

```ts
const markerId = String(id);
const marker = {
    id,
    markerId,
    row,
    col,
    kind: normalized.kind,
    owner,
    createdSeq,
    data: normalized.data
};
```

- [ ] **Step 1.0.6: Export helpers**

Export `normalizeMarkerId` and `assignMarkerIdentity` from `game/logic/markers_adapter.ts` so turn-start anchor code can use the same normalization instead of duplicating it.

- [ ] **Step 1.0.7: Run identity tests**

```powershell
npx jest --runInBand --runTestsByPath test\game.marker-identity-contract.test.ts
```

Expected:
- All marker identity contract tests pass.

### Task 1.1: Turn-Start Anchor Token Tests

**Files:**
- Modify: `test/game.turn-start-marker-order.test.ts`

- [ ] **Step 1.1.1: Add failing test for markers born inside `onTurnStart()`**

Add a test that stubs `CardLogic.onTurnStart()` to push a new special marker before marker collection would previously run. Expected behavior: the new marker remains on board but is not processed until a later turn-start.

Test assertion shape:

```ts
expect(processedMarkerIds).not.toContain('born-during-on-turn-start');
expect(cardState.markers.some((m: any) => m.markerId === 'born-during-on-turn-start')).toBe(true);
```

- [ ] **Step 1.1.2: Add failing test for deleted anchor skip**

Create two anchors A and B. A's processing removes B. Expected behavior: B's queue slot is skipped.

Assertion shape:

```ts
expect(processedMarkerIds).toEqual(['anchor-A']);
expect(events.map((ev: any) => ev.type)).not.toContain('event-from-anchor-B');
```

- [ ] **Step 1.1.3: Add failing test for same-coordinate replacement**

Create B at row/col/type, then A removes B and creates C at the same row/col/type with a different `markerId`. Expected behavior: B's queue slot does not process C.

Assertion shape:

```ts
expect(processedMarkerIds).toEqual(['anchor-A']);
expect(cardState.markers.map((m: any) => m.markerId)).toContain('replacement-C');
```

- [ ] **Step 1.1.4: Add test for tie-breaker**

Create anchors with equal or missing `createdSeq`. Expected order is source marker array order.

Assertion shape:

```ts
expect(processedMarkerIds).toEqual(['first-source', 'second-source', 'third-source']);
```

- [ ] **Step 1.1.5: Run failing tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.turn-start-marker-order.test.ts
```

Expected before implementation:
- At least the onTurnStart-generated marker test fails.
- Deleted/replacement tests fail if they exercise current stale-anchor behavior.

### Task 1.2: Anchor Token Collection and Same-Identity Resolution

**Files:**
- Modify: `game/turn/turn-start/marker-phase.ts`
- Modify: `game/turn/turn_pipeline_phases.ts`
- Modify: `game/turn/turn-start/special-stone-phase.ts` only if it assumes stale marker anchors cannot be null
- Modify: `game/turn/turn-start/bomb-phase.ts` only if it assumes stale marker anchors cannot be null

- [ ] **Step 1.2.1: Introduce explicit anchor token type**

In `game/turn/turn-start/marker-phase.ts`, replace the current loose anchor shape with a token-compatible shape:

```ts
type TurnStartMarkerAnchor = {
    isBomb: boolean;
    marker: any;
    markerId: string | null;
    createdSeq: number | null;
    sourceIndex: number;
    startKind: string | null;
    startType: string | null;
};
```

- [ ] **Step 1.2.2: Implement `getMarkerIdentity()`**

Add helper:

```ts
function getMarkerIdentity(marker: any): string | null {
    if (!marker || typeof marker !== 'object') return null;
    const direct = marker.markerId ?? marker.id;
    if (direct === undefined || direct === null || direct === '') return null;
    return String(direct);
}
```

- [ ] **Step 1.2.3: Implement explicit order comparison**

Add helper:

```ts
function normalizeCreatedSeq(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function compareTurnStartAnchors(a: TurnStartMarkerAnchor, b: TurnStartMarkerAnchor): number {
    const seqDiff = normalizeCreatedSeq(a.createdSeq) - normalizeCreatedSeq(b.createdSeq);
    if (seqDiff !== 0) return seqDiff;
    const sourceDiff = Number(a.sourceIndex || 0) - Number(b.sourceIndex || 0);
    if (sourceDiff !== 0) return sourceDiff;
    const aId = a.markerId || '';
    const bId = b.markerId || '';
    return aId < bId ? -1 : (aId > bId ? 1 : 0);
}
```

- [ ] **Step 1.2.4: Update anchor collection**

Collect `sourceIndex` from the canonical marker array and sort with `compareTurnStartAnchors`. Keep `marker` as compatibility reference, not canonical identity.

- [ ] **Step 1.2.5: Implement current marker resolution**

Add:

```ts
function resolveCurrentMarkerForAnchor(cardState: any, anchor: TurnStartMarkerAnchor, getMarkers: (state: any) => any[]): any | null {
    const currentMarkers = getMarkers(cardState) || [];
    if (anchor.markerId !== null && anchor.markerId !== '') {
        return currentMarkers.find((marker: any) => getMarkerIdentity(marker) === anchor.markerId) || null;
    }
    return currentMarkers.includes(anchor.marker) ? anchor.marker : null;
}
```

- [ ] **Step 1.2.6: Resolve before processing**

Inside `processTurnStartMarkers()`, resolve the current marker immediately before each anchor. If missing, continue. Pass a shallow-copied anchor with `marker: currentMarker`.

```ts
const currentMarker = resolveCurrentMarkerForAnchor(opts.cardState, markerAnchor, getMarkers);
if (!currentMarker) continue;
const currentAnchor = Object.assign({}, markerAnchor, {
    marker: currentMarker,
    markerId: getMarkerIdentity(currentMarker)
});
```

- [ ] **Step 1.2.7: Preserve start classification for dispatch eligibility**

Use `anchor.isBomb`, `anchor.startKind`, and `anchor.startType` as the classification captured at snapshot time. Use the current marker only for current position, owner, duration, and target calculation.

Before dispatching, skip the anchor if the same marker no longer belongs to the same broad start category:

```ts
const currentIsBomb = typeof opts.isBombCategoryMarker === 'function' && opts.isBombCategoryMarker(currentMarker);
if (markerAnchor.isBomb !== currentIsBomb) continue;
```

This prevents a marker that was converted or normalized before its turn-start slot from being dispatched as a different category while still allowing the same marker to move and be processed at its current coordinates.

- [ ] **Step 1.2.8: Move anchor collection earlier**

In `game/turn/turn_pipeline_phases.ts`, collect `turnStartMarkerAnchors` before `CardLogic.onTurnStart()`. Process that fixed array after `onTurnStart()` until Phase 2 splits `onTurnStart()`.

The ordering in Phase 1 should be:

```ts
const turnStartMarkerAnchors = collectTurnStartMarkerAnchors(cardState, markerDeps);
const turnStartSummary = CardLogic.onTurnStart(...);
processTurnStartMarkers({ markers: turnStartMarkerAnchors, ... });
```

This is intentionally not the final lifecycle design; it stops same-turn new marker contamination without moving all status logic yet.

- [ ] **Step 1.2.9: Run focused tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.turn-start-marker-order.test.ts
```

Expected:
- New anchor identity tests pass.
- Existing createdSeq/bomb-special order tests still pass.

### Task 1.3: Deterministic Action Metadata and Presentation Sequence

**Files:**
- Modify: `game/turn/turn-start/marker-phase.ts`
- Modify: `game/turn/turn-start/bomb-phase.ts`
- Modify: `game/turn/turn-start/special-stone-phase.ts`
- Modify: `game/logic/board_ops.ts`
- Modify: `test/game.turn-start-marker-order.test.ts`

- [ ] **Step 1.3.1: Add deterministic anchor action metadata tests**

In `test/game.turn-start-marker-order.test.ts`, add a case with two turn-start anchors that emit presentation events. Assert each anchor's events carry deterministic, distinct `actionId`, and that events inside the same anchor share the same `actionId`.

Assertion shape:

```ts
expect(anchorAEvents.every((ev: any) => ev.actionId === 'turn-start:7:anchor:0:101')).toBe(true);
expect(anchorBEvents.every((ev: any) => ev.actionId === 'turn-start:7:anchor:1:102')).toBe(true);
expect(anchorAEvents[0].actionId).not.toBe(anchorBEvents[0].actionId);
```

- [ ] **Step 1.3.2: Add presentation `sequenceIndex` test**

In the same test file, emit multiple presentation events during turn-start and assert order-sensitive sequence indices:

```ts
expect(presentationEvents.map((ev: any) => ev.sequenceIndex)).toEqual([0, 1, 2, 3]);
expect(presentationEvents.map((ev: any) => ev.sequenceIndex)).toEqual(
  presentationEvents.map((_ev: any, index: number) => index)
);
```

- [ ] **Step 1.3.3: Add action ID builder in marker phase**

In `game/turn/turn-start/marker-phase.ts`, add:

```ts
function buildTurnStartActionId(turnIndex: number, queueIndex: number, anchor: TurnStartMarkerAnchor): string {
    const idPart = anchor.markerId ? anchor.markerId : `source-${anchor.sourceIndex}`;
    return `turn-start:${turnIndex}:anchor:${queueIndex}:${idPart}`;
}

function buildTurnStartEffectBlockId(actionId: string, kind: string): string {
    return `${actionId}:effect:${kind}`;
}
```

- [ ] **Step 1.3.4: Wrap each anchor with metadata-only action context**

Use existing `BoardOps.setActionContext()` and `BoardOps.clearActionContext()` around each anchor dispatch. Do not call `runEffectBlock()` solely to attach metadata.

```ts
const turnIndex = Number(opts.cardState && opts.cardState.turnIndex) || 0;
const actionId = buildTurnStartActionId(turnIndex, index, currentAnchor);
const effectBlockId = buildTurnStartEffectBlockId(actionId, currentAnchor.isBomb ? 'bomb' : 'special');
if (opts.BoardOps && typeof opts.BoardOps.setActionContext === 'function') {
    opts.BoardOps.setActionContext(opts.cardState, {
        actionId,
        effectBlockId,
        turnIndex,
        plyIndex: 0,
        randomSource: opts.prng || null
    });
}
try {
    // existing bomb or special dispatch
} finally {
    if (opts.BoardOps && typeof opts.BoardOps.clearActionContext === 'function') {
        opts.BoardOps.clearActionContext(opts.cardState);
    }
}
```

If `processTurnStartMarkers()` does not currently receive `BoardOps`, add it to `ProcessTurnStartMarkersOptions` and pass it from `applyTurnStartPhase()`.

- [ ] **Step 1.3.5: Preserve resolver `runEffectBlock()` flush behavior**

When existing resolvers call `BoardOps.runEffectBlock()`, pass the current `actionId` through their existing options when available. Do not add an outer `runEffectBlock()` around all resolvers.

- [ ] **Step 1.3.6: Add sequenceIndex in `emitPresentationEvent()`**

In `game/logic/board_ops.ts`, update `emitPresentationEvent()` so each event gets an order-sensitive index:

```ts
if (!Number.isFinite(Number(cardState._nextPresentationSequenceIndex))) {
    cardState._nextPresentationSequenceIndex = Array.isArray(cardState.presentationEvents)
        ? cardState.presentationEvents.length
        : 0;
}
const sequenceIndex = (ev.sequenceIndex !== undefined && ev.sequenceIndex !== null)
    ? ev.sequenceIndex
    : cardState._nextPresentationSequenceIndex++;
const out = Object.assign({}, ev, { meta: outMeta, actionId, effectBlockId, turnIndex, plyIndex, sequenceIndex });
```

Do not sort presentation events after assignment. `sequenceIndex` must reflect emit order.

- [ ] **Step 1.3.7: Run metadata tests**

```powershell
npx jest --runInBand --runTestsByPath test\game.turn-start-marker-order.test.ts
```

Expected:
- Anchor `actionId`s are deterministic.
- Presentation `sequenceIndex` is monotonic and order-sensitive.
- Existing marker-order tests remain green.

### Task 1.4: Time Bomb Phase Separation

**Files:**
- Modify: `test/game.pipeline-ui-adapter.destroy-batch.test.ts`
- Modify: `game/turn/pipeline-ui/board-event-playback.ts`
- Modify: `game/turn/pipeline-ui/sound-cues.ts` if bomb sound grouping uses phase-only inference that now needs action/effectBlock awareness

- [ ] **Step 1.4.1: Add failing test for two time bombs**

Add two `DESTROY` presentation events:

```ts
const events = [
  { type: 'DESTROY', row: 1, col: 1, cause: 'TIME_BOMB', actionId: 'turn-7-anchor-0', effectBlockId: 'turn-7-anchor-0-bomb' },
  { type: 'DESTROY', row: 6, col: 6, cause: 'TIME_BOMB', actionId: 'turn-7-anchor-1', effectBlockId: 'turn-7-anchor-1-bomb' }
];
```

Expected:

```ts
expect(playback[0].phase).toBeLessThan(playback[1].phase);
```

- [ ] **Step 1.4.2: Preserve one-bomb batch behavior**

Add two `DESTROY` events with the same `actionId` and same `effectBlockId`. Expected same phase:

```ts
expect(playback[0].phase).toBe(playback[1].phase);
```

- [ ] **Step 1.4.3: Replace cause-only batch phase cache**

In `planDestroyPlayback()`, compute a batch key:

```ts
function getDestroyBatchPhaseKey(ev: any): string {
    const cause = String(ev && ev.cause ? ev.cause : '').toUpperCase();
    const actionId = ev && ev.actionId ? String(ev.actionId) : '';
    const effectBlockId = ev && ev.effectBlockId ? String(ev.effectBlockId) : '';
    return `${cause}|${actionId}|${effectBlockId}`;
}
```

Use this key instead of only `prevDestroyCause` for `deps.batchDestroyCauses`.

- [ ] **Step 1.4.4: Keep legacy no-id events conservative**

For old events with no `actionId` and no `effectBlockId`, keep existing cause grouping only within consecutive events. This avoids breaking old tests that model one batch without IDs.

- [ ] **Step 1.4.5: Run playback tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.pipeline-ui-adapter.destroy-batch.test.ts test\game.pipeline-ui-adapter.spawn.test.ts
```

Expected:
- Two time bombs separate.
- One bomb batch remains same phase.
- Spawn/rescue ordering tests remain green.

### Task 1.5: Worker PRNG Persistence Parity

**Files:**
- Modify: `workers/match-worker.ts`
- Modify: `test/workers.match-prng-contract.test.ts` or existing Worker parity test file
- Inspect: `scripts/local-match-server.ts`

- [ ] **Step 1.5.1: Add focused Worker PRNG contract test**

Create a test that executes the same accepted command through root pipeline and Worker pipeline using the same initial `cardState.prngState`. Compare:

```ts
expect(workerResult.cardState.prngState).toEqual(rootResult.cardState.prngState);
expect(workerResult.stateHash).toBe(rootResult.stateHash);
```

Include at least one `skipTurnStart: true` path because pending selection and sub-placement are high-risk.

- [ ] **Step 1.5.2: Persist PRNG in Worker applyTurnSafe**

In `workers/match-worker.ts` after successful `applyTurn()`, mirror root behavior:

```ts
const nextPrngState = prng && typeof (prng as any).getState === 'function'
    ? (prng as any).getState()
    : (opts && opts.prngState ? opts.prngState : null);
if (nextPrngState && result.cardState && typeof result.cardState === 'object') {
    (result.cardState as any).prngState = nextPrngState;
}
```

- [ ] **Step 1.5.3: Align state hash**

Use the same hash helper used by root or `MatchAuthority.computeAuthoritativeStateHash()` on the same projected snapshot. The Worker `applyTurnSafe()` result or the immediately persisted room update must expose a non-null `stateHash`/`authoritativeStateHash` derived from the same canonical state as root. Do not leave a successful accepted operation with only `stateHash: null`.

- [ ] **Step 1.5.4: Run Worker PRNG tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\workers.match-prng-contract.test.ts
npm run test:network:parity
```

Expected:
- Worker and root PRNG states match after normal and skip-turn-start accepted operations.
- Network parity suite remains green.

### Task 1.6: Phase 1 Verification and Commit

- [ ] **Step 1.6.1: Run focused suite**

```powershell
npx jest --runInBand --runTestsByPath test\game.marker-identity-contract.test.ts test\game.turn-start-marker-order.test.ts test\game.pipeline-ui-adapter.destroy-batch.test.ts test\game.pipeline-ui-adapter.spawn.test.ts test\workers.match-prng-contract.test.ts
```

- [ ] **Step 1.6.2: Run boundary checks**

```powershell
npm run check:window
npm run typecheck
npm run build:ts
```

- [ ] **Step 1.6.3: Prepare mirror if root-to-worker bundle changed**

```powershell
npm run worker:prepare
```

- [ ] **Step 1.6.4: Inspect and commit Phase 1**

Inspect each intended file before staging:

```powershell
git diff -- game\logic\cards\markers.ts game\logic\markers_adapter.ts game\turn\turn_pipeline_phases.ts game\turn\turn-start\marker-phase.ts game\turn\turn-start\bomb-phase.ts game\turn\turn-start\special-stone-phase.ts game\logic\board_ops.ts game\turn\pipeline-ui\board-event-playback.ts workers\match-worker.ts test\game.marker-identity-contract.test.ts test\game.turn-start-marker-order.test.ts test\game.pipeline-ui-adapter.destroy-batch.test.ts test\workers.match-prng-contract.test.ts
```

```powershell
git add game\logic\cards\markers.ts game\logic\markers_adapter.ts game\turn\turn_pipeline_phases.ts game\turn\turn-start\marker-phase.ts game\turn\turn-start\bomb-phase.ts game\turn\turn-start\special-stone-phase.ts game\logic\board_ops.ts game\turn\pipeline-ui\board-event-playback.ts workers\match-worker.ts test\game.marker-identity-contract.test.ts test\game.turn-start-marker-order.test.ts test\game.pipeline-ui-adapter.destroy-batch.test.ts test\workers.match-prng-contract.test.ts
git commit -m "fix: stabilize turn-start anchors and bomb playback phases"
```

---

## Phase 2: Split Turn-Start Lifecycle and Move Effects Into Anchor Scope

**Purpose:** Make the turn-start implementation match the source-of-truth order instead of relying on post-loop cleanup.

### Task 2.1: Characterization Tests Before Movement

**Files:**
- Create: `test/game.turn-start-anchor-lifecycle.test.ts`
- Modify: `test/game.turn-start-marker-order.test.ts`

- [ ] **Step 2.1.1: Test draw happens after turn-start effects**

Construct a fake turn-start effect that records hand count before draw. Expected: hand count is pre-draw during effect, post-draw after phase completion.

Assertion shape:

```ts
expect(observedHandCountDuringEffect).toBe(initialHandCount);
expect(finalHandCount).toBe(initialHandCount + 1);
```

- [ ] **Step 2.1.2: Test immediate revive before second anchor**

Set up anchor A to flip/destroy a stone with regen or living will, and anchor B to target based on the post-revive board. Expected: B sees the revived board.

Assertion shape:

```ts
expect(boardSeenBySecondAnchor).toEqual(expectedAfterRevive);
```

- [ ] **Step 2.1.3: Test hyperactive multi-step non-interleaving**

Use a multi-move anchor and another anchor with lower/higher order around it. Expected event order keeps all multi-move substeps inside one action before the next anchor.

Assertion shape:

```ts
expect(actionOrder).toEqual([
  'hyperactive:move-1',
  'hyperactive:flip-1',
  'hyperactive:move-2',
  'hyperactive:flip-2',
  'next-anchor:start'
]);
```

- [ ] **Step 2.1.4: Run tests to capture current failures**

```powershell
npx jest --runInBand --runTestsByPath test\game.turn-start-anchor-lifecycle.test.ts
```

Expected:
- Draw-order and post-loop lifecycle tests fail against current structure.

### Task 2.2: Split `CardLogic.onTurnStart()`

**Files:**
- Modify: `game/logic/cards-internal/effect-timing.ts`
- Modify: any export hub that exposes `CardLogic.onTurnStart()`
- Modify: `game/turn/turn_pipeline_phases.ts`

- [ ] **Step 2.2.1: Keep compatibility wrapper**

Retain `onTurnStart()` as a wrapper for non-migrated callers, but route `applyTurnStartPhase()` through split functions.

Target API shape:

```ts
beginTurnStartBookkeeping(cardState, playerKey, gameState, prng, options)
resolveMandatoryTurnStartPayments(cardState, playerKey, gameState, prng, options)
prepareTurnStartStatusSnapshot(cardState, playerKey, gameState, prng, options)
commitTurnStartDraw(cardState, playerKey, gameState, prng, options)
```

- [ ] **Step 2.2.2: Move draw into `commitTurnStartDraw()`**

Move the current `helpers.commitDraw()` block from `onTurnStart()` into the new function. Do not call it until after fixed anchors finish.

- [ ] **Step 2.2.3: Keep freeze snapshot explicit**

Move `_frozenCellsActiveAtTurnStart` setup into `prepareTurnStartStatusSnapshot()` and call it once per turn-start. Do not change freeze semantics in this phase.

- [ ] **Step 2.2.4: Run draw-order tests**

```powershell
npx jest --runInBand --runTestsByPath test\game.turn-start-anchor-lifecycle.test.ts
```

Expected:
- Draw-order test passes.
- Lifecycle tests that still depend on post-processing may remain failing until Task 2.3.

### Task 2.3: Anchor Lifecycle Scope

**Files:**
- Modify: `game/turn/turn-start/marker-phase.ts`
- Modify: `game/turn/turn-start/special-stone-phase.ts`
- Modify: `game/turn/turn-start/bomb-phase.ts`
- Modify: `game/turn/turn-start/post-processing.ts`
- Modify: `game/turn/turn-start/timer-phase.ts`
- Modify: `game/logic/board_ops.ts` only if a metadata-only action scope is required

- [ ] **Step 2.3.1: Reuse Phase 1 deterministic action metadata**

Do not introduce a second action ID generator. Reuse `buildTurnStartActionId()` and `buildTurnStartEffectBlockId()` from Phase 1. This phase may add more precise sub-effect `effectBlockId`s inside one anchor, but the anchor-level `actionId` must remain stable.

Expected invariant:

```ts
expect(eventsForOneAnchor.every((ev: any) => ev.actionId === anchorActionId)).toBe(true);
expect(new Set(eventsForOneAnchor.map((ev: any) => ev.effectBlockId)).size).toBeGreaterThanOrEqual(1);
```

- [ ] **Step 2.3.2: Avoid outer `runEffectBlock()` wrapping**

If existing card resolvers already call `BoardOps.runEffectBlock()`, pass the deterministic `actionId` into their existing options. If a resolver emits events without effect block, use `BoardOps.setActionContext()`/`clearActionContext()` or a new metadata-only scope that does not touch `_stoneSalvationGodDestroyBlockDepth`.

Acceptable new helper shape in `board_ops.ts`:

```ts
function runActionMetadataScope(cardState: any, meta: any, fn: any): any {
    const previousActionMeta = cardState._currentActionMeta;
    const hadPreviousActionMeta = Object.prototype.hasOwnProperty.call(cardState, '_currentActionMeta');
    cardState._currentActionMeta = Object.assign({}, previousActionMeta || {}, meta || {});
    try {
        return typeof fn === 'function' ? fn() : undefined;
    } finally {
        if (hadPreviousActionMeta) cardState._currentActionMeta = previousActionMeta;
        else delete cardState._currentActionMeta;
    }
}
```

- [ ] **Step 2.3.3: Move hyperactive revive handling into anchor processing**

Replace the all-anchor aggregation dependency for hyperactive flips. After one hyperactive anchor's flips are known, call the same revive/living-will logic before the next anchor is processed. Remove the corresponding hyperactive flip entries from the post-loop aggregation so the same revive is not applied twice.

- [ ] **Step 2.3.4: Move timer/status tick event emission into anchor or explicit per-anchor finalizer**

For markers that decrement or revert during the anchor, emit presentation timer/status events before leaving that anchor scope. Keep purely visual timer comparison fallback only for compatibility.

- [ ] **Step 2.3.5: Keep trap processing behavior covered**

If `processTrapEffects()` remains global after all anchors, add a test proving it is intended. If trap effects are turn-start anchors, move them into the fixed anchor queue with identity and order.

- [ ] **Step 2.3.6: Run lifecycle tests**

```powershell
npx jest --runInBand --runTestsByPath test\game.turn-start-anchor-lifecycle.test.ts test\game.turn-start-marker-order.test.ts
```

Expected:
- Immediate revive/living-will before second anchor passes.
- Hyperactive multi-step non-interleaving passes.
- Anchor identity tests remain green.

### Task 2.4: Phase 2 Verification and Commit

- [ ] **Step 2.4.1: Run focused suites**

```powershell
npx jest --runInBand --runTestsByPath test\game.turn-start-anchor-lifecycle.test.ts test\game.turn-start-marker-order.test.ts test\game.pipeline-ui-adapter.destroy-batch.test.ts test\game.pipeline-ui-adapter.spawn.test.ts
```

- [ ] **Step 2.4.2: Run broader game checks**

```powershell
npm run typecheck
npm run build:ts
npm run test:jest
```

- [ ] **Step 2.4.3: Commit Phase 2**

Inspect each intended file before staging:

```powershell
git diff -- game\logic\cards-internal\effect-timing.ts game\turn\turn_pipeline_phases.ts game\turn\turn-start\marker-phase.ts game\turn\turn-start\special-stone-phase.ts game\turn\turn-start\bomb-phase.ts game\turn\turn-start\post-processing.ts game\turn\turn-start\timer-phase.ts game\logic\board_ops.ts test\game.turn-start-anchor-lifecycle.test.ts test\game.turn-start-marker-order.test.ts test\game.pipeline-ui-adapter.spawn.test.ts
```

```powershell
git add game\logic\cards-internal\effect-timing.ts game\turn\turn_pipeline_phases.ts game\turn\turn-start\marker-phase.ts game\turn\turn-start\special-stone-phase.ts game\turn\turn-start\bomb-phase.ts game\turn\turn-start\post-processing.ts game\turn\turn-start\timer-phase.ts game\logic\board_ops.ts test\game.turn-start-anchor-lifecycle.test.ts test\game.turn-start-marker-order.test.ts test\game.pipeline-ui-adapter.spawn.test.ts
git commit -m "refactor: resolve turn-start lifecycle per anchor"
```

---

## Phase 3: Runtime Parity and Playback Authority

**Purpose:** Make local play, local server, Worker, and browser presentation consume the same deterministic core contracts.

### Task 3.0: Extract Pure Playback Planner

**Files:**
- Create: `shared/playback-planner.ts`
- Modify: `game/turn/pipeline_ui_adapter.ts`
- Modify: `shared/playback-event-helpers.ts`
- Modify: `workers/match-worker-runtime-preload.ts`
- Modify: `workers/match-worker.ts`
- Create: `test/shared.playback-planner.test.ts`

- [ ] **Step 3.0.1: Create planner contract tests**

Create `test/shared.playback-planner.test.ts` with order and phase cases:

```ts
const Planner = require('../shared/playback-planner');

test('plans one time bomb destroy batch in one phase', () => {
  const events = [
    { type: 'DESTROY', row: 1, col: 1, cause: 'TIME_BOMB', actionId: 'a', effectBlockId: 'a:bomb', sequenceIndex: 0 },
    { type: 'DESTROY', row: 1, col: 2, cause: 'TIME_BOMB', actionId: 'a', effectBlockId: 'a:bomb', sequenceIndex: 1 }
  ];
  const playback = Planner.planPlaybackEvents({ presentationEvents: events, cardState: {}, gameState: {} });
  expect(playback[0].phase).toBe(playback[1].phase);
});

test('does not merge separate actions with same cause', () => {
  const events = [
    { type: 'DESTROY', row: 1, col: 1, cause: 'TIME_BOMB', actionId: 'a', effectBlockId: 'a:bomb', sequenceIndex: 0 },
    { type: 'DESTROY', row: 6, col: 6, cause: 'TIME_BOMB', actionId: 'b', effectBlockId: 'b:bomb', sequenceIndex: 1 }
  ];
  const playback = Planner.planPlaybackEvents({ presentationEvents: events, cardState: {}, gameState: {} });
  expect(playback[0].phase).toBeLessThan(playback[1].phase);
});
```

- [ ] **Step 3.0.2: Implement `shared/playback-planner.ts` as the pure mapping owner**

Move the pure event-to-playback mapping logic out of `game/turn/pipeline_ui_adapter.ts` into `shared/playback-planner.ts`. `shared/playback-planner.ts` must not import `game/turn/pipeline_ui_adapter.ts`; the dependency direction must be `game/turn/pipeline_ui_adapter.ts -> shared/playback-planner.ts`.

Required public API:

```ts
type PlanPlaybackEventsOptions = {
    presentationEvents: unknown[];
    cardState?: unknown;
    gameState?: unknown;
};

function planPlaybackEvents(options: PlanPlaybackEventsOptions): unknown[] {
    const opts = options && typeof options === 'object' ? options : { presentationEvents: [] };
    const events = Array.isArray(opts.presentationEvents) ? opts.presentationEvents : [];
    return mapPresentationEventsToPlayback(events, opts.cardState || {}, opts.gameState || {});
}

export = { planPlaybackEvents };
```

`mapPresentationEventsToPlayback()` is the moved pure body of the current `mapToPlaybackEvents()` implementation. Browser/UI-only concerns, sound playback, DOM state, and animation timing must remain outside this function.

- [ ] **Step 3.0.3: Wire local, Worker, and network assembly to the planner**

Update:
- `game/turn/pipeline_ui_adapter.ts` to call `PlaybackPlanner.planPlaybackEvents()` or delegate its internal mapping to it.
- `shared/playback-event-helpers.ts` to accept `planner.planPlaybackEvents` as the canonical route when assembling server presentation.
- `workers/match-worker-runtime-preload.ts` and `workers/match-worker.ts` to preload/use `shared/playback-planner.js`.

- [ ] **Step 3.0.4: Add no-browser-dependency check**

Run:

```powershell
rg -n "window\.|document\.|Audio|setTimeout|requestAnimationFrame" shared\playback-planner.ts game\turn\pipeline-ui game\turn\pipeline_ui_adapter.ts
```

Expected:
- `shared/playback-planner.ts` has no browser APIs.

- [ ] **Step 3.0.5: Run planner tests**

```powershell
npx jest --runInBand --runTestsByPath test\shared.playback-planner.test.ts test\game.pipeline-ui-adapter.destroy-batch.test.ts
```

Expected:
- Shared planner produces the same playback phases as the existing adapter tests.

### Task 3.1: Shared Playback Digest

**Files:**
- Create: `shared/playback-digest.ts`
- Modify: `ui/network/playback-recovery.ts`
- Modify: `ui/network/action-bridge.ts`
- Create: `test/ui.network-playback-digest.test.ts`

- [ ] **Step 3.1.1: Implement normalized digest helper**

Digest should include only semantic playback ordering fields:

```ts
type PlaybackDigestEvent = {
    type?: string;
    phase?: number;
    actionId?: string | null;
    effectBlockId?: string | null;
    sequenceIndex?: number | null;
    plyIndex?: number | null;
    row?: number | null;
    col?: number | null;
    toRow?: number | null;
    toCol?: number | null;
    cause?: string | null;
};
```

Normalize by mapping playback events to this shape in the original array order. Do not sort playback events for digest generation. Hash the normalized array with `StateHash.computeStableHash()` from `shared/state-hash.ts`.

Required implementation shape:

```ts
const StateHash = require('./state-hash');

function computePlaybackDigest(playbackEvents: unknown[]): string {
    const normalized = normalizePlaybackEventsForDigest(playbackEvents);
    return StateHash.computeStableHash(normalized);
}
```

- [ ] **Step 3.1.2: Test digest equality and inequality**

Cases:
- Same playback events with harmless object property order differences produce same digest.
- A then B versus B then A produces different digest.
- Same snapshot but different phase boundaries produces different digest.

- [ ] **Step 3.1.3: Use digest in shadow playback decisions**

Update `shouldApplyPublishResponseAsShadowPlayback()` and `shouldApplyStreamSnapshotAsShadowPlayback()` so they require:

```ts
localPlaybackDigest === authoritativePlaybackDigest
```

Snapshot signature equality remains necessary but no longer sufficient.

- [ ] **Step 3.1.4: Run digest tests**

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-playback-digest.test.ts
```

### Task 3.2: Authority Playback Bundle Contract

**Files:**
- Modify: `utils/match-authority.ts`
- Modify: `workers/match-worker.ts`
- Modify: `scripts/local-match-server.ts`
- Modify: `ui/network-client.ts`
- Modify: relevant network tests

- [ ] **Step 3.2.1: Define bundle shape**

Authority responses and SSE frames should carry:

```ts
type AuthoritativePlaybackBundle = {
    operationId: string;
    stateVersion: number;
    snapshotHash: string;
    playbackEvents: any[];
    playbackDigest: string;
};
```

- [ ] **Step 3.2.2: Ensure publish response and SSE use same bundle**

Generate the bundle once per accepted operation and reuse it for publish response and stream event. Do not generate playback independently in two places.

- [ ] **Step 3.2.3: Deduplicate by operationId and stateVersion**

Client handling should ignore duplicate bundle applications for the same `operationId + stateVersion + playbackDigest`.

- [ ] **Step 3.2.4: Test publish/SSE ordering**

Add tests:
- publish response first, SSE later: playback applied once.
- SSE first, publish response later: playback applied once.
- same stateVersion but different snapshotHash: not treated as same bundle.

### Task 3.3: Worker TurnPipeline Copy Removal

**Files:**
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-runtime-preload.ts`
- Modify: `game/turn/turn_pipeline.ts`
- Create or modify: Worker parity tests

- [ ] **Step 3.3.1: Identify import constraints**

Run:

```powershell
rg -n "createWorkerTurnPipelineModule|TurnPipeline.applyTurnSafe|from '../game|require\\(.+turn_pipeline" workers scripts game
```

Expected:
- Exact Worker copy boundaries and root pipeline exports are known before deletion.

- [ ] **Step 3.3.2: Run Worker import feasibility spike**

Create a minimal test or script that imports root `game/turn/turn_pipeline.ts` through the Worker runtime preload path and runs a no-op legal action fixture.

Decision rule:
- If root `TurnPipeline` can load in Worker tests without browser globals and without circular runtime preload failures, choose Option A.
- If root `TurnPipeline` cannot load directly but the failure is caused by packaging/preload shape, choose Option B.
- Do not proceed with a silent copy-based fallback. If neither option is feasible, stop Phase 3 and document the exact import blocker.

- [ ] **Step 3.3.3: Option A - route Worker to root TurnPipeline**

Replace `createWorkerTurnPipelineModule()` usage with root `TurnPipeline`. Keep only Worker-specific validation and type normalization in Worker code.

Required invariant:

```ts
expect(workerRuntime.TurnPipeline.applyTurnSafe).toBe(rootTurnPipeline.applyTurnSafe);
```

- [ ] **Step 3.3.4: Option B - extract shared turn pipeline core**

If Option A is blocked, extract the gameplay sequencing body from `game/turn/turn_pipeline.ts` into a shared root module, for example `game/turn/turn_pipeline_core.ts`, and make both root `turn_pipeline.ts` and Worker preload call that module.

Required invariant:

```ts
expect(workerResult.cardState.prngState).toEqual(rootResult.cardState.prngState);
expect(workerResult.events).toEqual(rootResult.events);
expect(workerResult.presentationEvents).toEqual(rootResult.presentationEvents);
```

- [ ] **Step 3.3.5: Remove duplicated gameplay outcome logic**

Delete Worker-local copies of:
- turn-start phase sequencing
- card usage/action phase sequencing
- root-safe `applyTurnSafe()` behavior

Keep Worker-specific:
- room lookup
- seat token validation
- operation idempotency
- persistence
- SSE
- projection

- [ ] **Step 3.3.6: Run Worker/local/root parity fixture**

Create or extend a fixture with:
- time bomb
- ultimate hyperactive movement
- destroy dragon
- salvation/revive
- newly generated special stone during turn-start

Compare:
- `gameState`
- `cardState`
- `prngState`
- `stateHash`
- presentation event order
- playback event order
- phase
- `actionId`
- `effectBlockId`
- `sequenceIndex`

### Task 3.4: Phase 3 Verification and Commit

- [ ] **Step 3.4.1: Run focused network and Worker tests**

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-playback-digest.test.ts test\workers.match-prng-contract.test.ts
npx jest --runInBand --runTestsByPath test\shared.playback-planner.test.ts
npm run test:network:parity
```

- [ ] **Step 3.4.2: Run broad verification**

```powershell
npm run typecheck
npm run build:ts
npm run checkall
npm run worker:prepare
```

- [ ] **Step 3.4.3: Commit Phase 3**

Inspect each intended file before staging:

```powershell
git diff -- shared\playback-planner.ts shared\playback-digest.ts shared\playback-event-helpers.ts game\turn\pipeline_ui_adapter.ts game\turn\pipeline-ui\board-event-playback.ts workers\match-worker.ts workers\match-worker-runtime-preload.ts scripts\local-match-server.ts utils\match-authority.ts ui\network\playback-recovery.ts ui\network\action-bridge.ts ui\network-client.ts test\shared.playback-planner.test.ts test\ui.network-playback-digest.test.ts test\workers.match-prng-contract.test.ts
```

```powershell
git add shared\playback-planner.ts shared\playback-digest.ts shared\playback-event-helpers.ts game\turn\pipeline_ui_adapter.ts game\turn\pipeline-ui\board-event-playback.ts workers\match-worker.ts workers\match-worker-runtime-preload.ts scripts\local-match-server.ts utils\match-authority.ts ui\network\playback-recovery.ts ui\network\action-bridge.ts ui\network-client.ts test\shared.playback-planner.test.ts test\ui.network-playback-digest.test.ts test\workers.match-prng-contract.test.ts
git commit -m "refactor: share authority playback and runtime parity contracts"
```

---

## Phase 4: End-to-End Verification and Deployment Gate

**Purpose:** Prove that local play, local server, and public Worker behavior are aligned before deployment and after deployment.

### Task 4.1: Local Verification Matrix

- [ ] **Step 4.1.1: Run static and type checks**

```powershell
npm run check:window
npm run typecheck
npm run build:ts
```

- [ ] **Step 4.1.2: Run focused suites**

```powershell
npx jest --runInBand --runTestsByPath test\game.turn-start-marker-order.test.ts test\game.turn-start-anchor-lifecycle.test.ts test\game.pipeline-ui-adapter.destroy-batch.test.ts test\game.pipeline-ui-adapter.spawn.test.ts test\workers.match-prng-contract.test.ts test\ui.network-playback-digest.test.ts
```

- [ ] **Step 4.1.3: Run network parity**

```powershell
npm run test:network:parity
npm run match:check
```

- [ ] **Step 4.1.4: Run full Jest**

```powershell
npm run test:jest
```

If this cannot run because the lightweight checkout lacks dependencies, record the exact missing command or dependency and run the focused suites plus `npm run test:network:parity` instead. Do not mark Phase 4 complete if tests fail.

### Task 4.2: Browser Game Verification

- [ ] **Step 4.2.1: Local two-client smoke**

Use the existing local match server or static/dev server path. Verify:
- first move accepted
- second move accepted
- pending selection accepted
- time bomb playback phase separated
- special stone chain playback completes before next input unlock

- [ ] **Step 4.2.2: Public Worker smoke after deployment**

Use two independent browser sessions. Verify:
- room create/join
- both seats see same stateVersion
- both seats replay same playback bundle digest
- self operation does not suppress server playback unless digest matches
- reconnect lands on canonical state and does not replay completed old playback incorrectly

### Task 4.3: Final Commit or Release Note

- [ ] **Step 4.3.1: Inspect final diff**

```powershell
git status --short
git diff --stat
```

- [ ] **Step 4.3.2: Block on unresolved spec or contract gaps**

These items must be resolved by Phase 0 or explicitly marked out-of-scope in the source-of-truth docs before deployment:
- same physical stone with multiple state createdSeq rule
- freeze snapshot semantics
- legacy markers without markerId
- any Worker import constraint that required an adapter

If any item is still unresolved and not explicitly out-of-scope in docs, stop and do not deploy.

---

## Execution Order Summary

1. Phase 0: Spec lock.
2. Phase 1: Confirmed bug fixes: canonical markerId, anchor timing, identity, deletion skip, deterministic action metadata, sequenceIndex, time bomb phase split, Worker PRNG persistence.
3. Phase 2: Lifecycle refactor: split `onTurnStart()`, move draw, move immediate reactions and normal-stone/revert events into anchor scope.
4. Phase 3: Runtime parity: shared playback planner, playback digest, authority bundle, Worker root TurnPipeline sharing or extracted shared turn pipeline core.
5. Phase 4: Local and deployed verification.

Do not merge Phase 2 before Phase 1 tests are green. Do not merge Phase 3 before Phase 2 lifecycle tests are green. Do not deploy before Phase 4 local network verification passes.

## Self-Review

- Spec coverage: The plan covers anchor snapshot timing, canonical markerId, createdSeq ordering, lifecycle ordering, draw order, deterministic action/effect metadata, sequenceIndex, phase boundaries, shared playback planner, playback digest, PRNG persistence, Worker/local parity, and preview-vs-authority playback comparison.
- Overreach check: The first implementation phase avoids moving rescue/duration lifecycles and fixes only confirmed root bugs.
- Boundary check: No task edits `worker-public/`, `dist/`, or `public/module-registry.js` directly. Headless layers remain free of DOM/audio/timer/network dependencies.
- Risk check: `runEffectBlock()` outer wrapping is explicitly prohibited. Phase 1 uses metadata-only `setActionContext()` for deterministic `actionId` and leaves rescue flush timing untouched.
- Completeness check: Previously open decisions for multi-state createdSeq, freeze snapshot semantics, and legacy marker ID handling are resolved in Phase 0 instead of deferred to final reporting.
