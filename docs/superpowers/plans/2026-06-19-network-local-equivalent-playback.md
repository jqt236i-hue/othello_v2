# Network Local-Equivalent Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make network battle mode replay every accepted visual event in server order, matching local playback semantics, even after reconnects and late-game special-stone-heavy turns.

**Architecture:** Keep the Worker/local server as canonical gameplay authority, but split network presentation into a server-side presentation journal and a client-side visual timeline. The client may accept the newest authoritative snapshot immediately, while the board renderer reads a separate visual state that advances only after each contiguous presentation frame finishes playback.

**Tech Stack:** TypeScript, CommonJS-compatible browser modules, Jest/jsdom unit tests, Cloudflare Workers Durable Object, local match server, existing playback engine, Playwright/live browser verification.

---

## Evidence And Scope

The current network flow sends authoritative snapshots and playback metadata together, then applies the authoritative state before presentation playback:

- `ui/network/snapshot.ts` applies `gameState` and `cardState` in `applyAuthoritativeSnapshotState()`.
- `ui/network/snapshot.ts` emits `PLAYBACK_EVENTS` in `finalizeSnapshotPresentation()` after canonical state has already been replaced.
- `ui/presentation-handler.ts` forwards `PLAYBACK_EVENTS` to `AnimationEngine.play()`.
- `workers/match-worker-broadcast-controller.ts` buffers SSE snapshot events, not a dedicated visual journal.
- `scripts/local-match-server.ts` replays buffered SSE events after reconnect through `getBufferedSseReplayEvents()`.

This means the network client currently has one state lane doing too many jobs:

1. Canonical state convergence.
2. Visual transition sequencing.
3. Reconnect recovery.
4. Busy/playback lock settlement.

For the requested product goal, "常にローカル同等に、全部を順番通り再生", the design must treat visual playback as a first-class ordered contract. The client must not skip or collapse accepted presentation frames just because a newer snapshot has arrived.

## Behavior Contract

- Network authority remains server-side. Client visual state never decides gameplay legality or final state.
- Every accepted server operation that has visual effects produces one `NetworkPresentationFrame`.
- Frames are replayed in `visualSeq` order.
- A frame is playable only when `frame.stateVersionFrom === currentVisualVersion`.
- During strict network playback, player input stays locked while `visualVersion < canonicalVersion`.
- Reconnect recovery uses the presentation journal cursor, not SSE `lastEventId`, to recover missing visuals.
- If a client is too far behind, the room still returns a base visual snapshot plus all missing frames for the active match. It does not snapshot-skip within an active room.
- A fatal playback exception pauses the network visual timeline and reports diagnostics; it does not silently call final-state sync as success.

## File Structure

- Modify `01-rulebook.md`
  - State that network mode preserves local-equivalent presentation order for accepted operations.
  - Clarify that late playback may delay the next input when the client is catching up.
- Modify `docs/architecture-contracts.md`
  - Replace the current snapshot/playback wording with canonical state lane + visual timeline lane.
  - Define ownership for `Presentation Journal`, `NetworkPresentationTimeline`, and `VisualStateStore`.
- Modify `正本/演出正本.md`
  - Add a network playback subsection requiring ordered replay of all accepted frames.
- Modify `正本/正本差分監査.md`
  - Update the reconnect/playback audit row after implementation.
- Create `shared/network-presentation-frame.ts`
  - Shared frame/cursor normalization and projection-safe public frame helpers.
- Modify `utils/match-authority-types.ts`
  - Add presentation journal types to room state and payload options.
- Modify `utils/match-authority.ts`
  - Add journal append/read/project helpers.
  - Add payload fields for `presentationCursor`, `presentationFrames`, and journal recovery responses.
- Modify `workers/match-worker-types.ts`
  - Thread journal fields through Worker room and prepared snapshot types.
- Modify `workers/match-worker.ts`
  - Append presentation frames after accepted publish, timeout pass, and rematch reset.
  - Add journal recovery route handling.
- Modify `workers/match-worker-broadcast-controller.ts`
  - Include current frame/cursor metadata in snapshot broadcasts.
- Modify `workers/match-worker-stream-route-controller.ts`
  - Preserve SSE replay for transport, but do not treat it as visual recovery authority.
- Modify `scripts/local-match-server.ts`
  - Mirror Worker journal creation and recovery behavior.
- Create `ui/network/presentation-timeline.ts`
  - Own client visual cursor, pending frames, strict ordering, and catch-up state.
- Create `ui/network/playback-dispatcher.ts`
  - Wrap existing `PLAYBACK_EVENTS` dispatch so `snapshot.ts` and timeline code do not duplicate board event plumbing.
- Create `ui/network/visual-state-store.ts`
  - Keep canonical snapshot and render-facing visual snapshot separated.
- Modify `ui/network/snapshot.ts`
  - Keep canonical snapshot application, but route network playback through the timeline.
- Modify `ui/network/stream-snapshot.ts`
  - Feed `presentationFrames` into the timeline.
- Modify `ui/network/publish-flow.ts`
  - Feed publish-response frames into the same timeline and dedupe by `visualSeq`.
- Modify `ui/network/session-seat.ts`
  - Persist `lastVisualSeq` and `lastVisualVersion` with the active session.
- Modify `ui/network/session-lifecycle.ts`
  - Fetch missing journal frames during restore/reconnect before allowing input.
- Modify `ui/network-client.ts`
  - Install timeline/store dependencies and expose debug diagnostics.
- Modify `ui/board-renderer.ts`
  - Read render-facing state from `VisualStateStore` while strict network playback is active.
- Modify `ui/animation-engine.ts`
  - Add strict network playback error mode that reports failure without silent final-state success.
- Add focused tests:
  - `test/shared.network-presentation-frame.test.ts`
  - `test/utils.match-authority.presentation-journal.test.ts`
  - `test/workers.match-presentation-journal.test.ts`
  - `test/local-match-server.presentation-journal.test.ts`
  - `test/ui.network-presentation-timeline.test.ts`
  - `test/ui.network-playback-dispatcher.test.ts`
  - `test/ui.network-visual-state-store.test.ts`
  - `test/ui.network-client.visual-catchup.test.ts`
  - `test/ui.board-renderer.visual-state.test.ts`
  - `test/ui.animation-engine.strict-network.test.ts`

---

### Task 1: Update Player-Facing And Architecture Specs

**Files:**
- Modify: `01-rulebook.md`
- Modify: `docs/architecture-contracts.md`
- Modify: `正本/演出正本.md`
- Modify: `正本/正本差分監査.md`

- [ ] **Step 1: Inspect current dirty state before touching shared docs**

Run:

```powershell
git status --short
git diff -- 01-rulebook.md docs/architecture-contracts.md 正本/演出正本.md 正本/正本差分監査.md
```

Expected: identify whether existing edits in `01-rulebook.md` or `正本/*.md` belong to another task. If they are unrelated and cannot be cleanly separated, stop this task and ask for direction before editing shared source-of-truth docs.

- [ ] **Step 2: Update `01-rulebook.md` network presentation wording**

Add a network presentation bullet near the network mode / UI presentation section:

```markdown
- ネット対戦では、server が受理した各操作の演出を `visualSeq` の昇順に再生する。再接続や一時的な通信停止で未再生演出が残っている場合も、アクティブな room 内では最新盤面へ即時スキップせず、基準 visual snapshot から不足分を順番に再生して追いつく。
- 未再生演出が残っている間、盤面入力・手札操作・パス操作はロックされる。これは結果同期ではなく、ローカル対戦同等の演出順を守るための表示上の待機である。
```

- [ ] **Step 3: Update `docs/architecture-contracts.md` snapshot/playback ownership**

Replace the current "Snapshot and playback" wording with this contract:

```markdown
### 6.4 Snapshot, presentation journal, and visual timeline

Network snapshot data is authoritative state transfer. It updates the canonical client state as soon as the server version is accepted.

Network presentation frames are ordered replay instructions. They are identified by `visualSeq` and represent one authoritative transition from `stateVersionFrom` to `stateVersionTo`.

The browser keeps two state lanes:

- canonical state: latest accepted server snapshot, used for authority, validation, result state, and reconnect truth
- visual state: render-facing state, advanced only after each contiguous presentation frame finishes playback

`ui/network/presentation-timeline.ts` owns visual cursor order. `ui/network/visual-state-store.ts` owns render-facing state selection. `ui/network/snapshot.ts` owns canonical snapshot application and must not directly skip strict network playback when presentation frames are available.
```

- [ ] **Step 4: Update `正本/演出正本.md` network section**

Add this paragraph under `## ネット対戦で特に守ること`:

```markdown
ネット対戦でも、server が受理した演出フレームはローカル対戦と同じ順番で全て再生する。再接続後や終盤で演出が溜まっている場合も、アクティブな room 内では最新盤面へ演出を飛ばして同期完了扱いにしない。表示が追いつくまで入力は待機し、盤面は visual timeline が進めた状態を描画する。
```

- [ ] **Step 5: Run documentation checks**

Run:

```powershell
rg -n "visualSeq|presentation journal|visual timeline|ネット対戦でも" 01-rulebook.md docs/architecture-contracts.md 正本
npm run typecheck
```

Expected: `rg` shows the new spec lines; `npm run typecheck` passes or reports unrelated pre-existing TypeScript errors.

- [ ] **Step 6: Commit the spec-only change**

Run:

```powershell
git add 01-rulebook.md docs/architecture-contracts.md 正本/演出正本.md 正本/正本差分監査.md
git commit -m "Document strict network playback ordering"
```

Expected: commit contains only source-of-truth documentation for this behavior.

---

### Task 2: Add Shared Presentation Frame Contract

**Files:**
- Create: `shared/network-presentation-frame.ts`
- Test: `test/shared.network-presentation-frame.test.ts`

- [ ] **Step 1: Write the failing shared contract tests**

Create `test/shared.network-presentation-frame.test.ts`:

```ts
const FrameContract = require('../shared/network-presentation-frame');

describe('network presentation frame contract', () => {
  test('normalizes a valid frame with stable numeric cursors', () => {
    const frame = FrameContract.normalizePresentationFrame({
      roomId: 'ABC',
      visualSeq: '4',
      stateVersionFrom: '3',
      stateVersionTo: 4,
      operationId: 'op_1',
      actorSeatKey: 'black',
      actionType: 'place',
      playbackEvents: [{ type: 'flip', phase: 2, targets: [{ r: 3, col: 4, owner: 'black' }] }],
      effectLogs: ['黒が石を置いた'],
      projectedSnapshotHash: 'hash_4',
      createdAt: 1781800000000
    });

    expect(frame).toMatchObject({
      roomId: 'ABC',
      visualSeq: 4,
      stateVersionFrom: 3,
      stateVersionTo: 4,
      operationId: 'op_1',
      actorSeatKey: 'black',
      actionType: 'place',
      projectedSnapshotHash: 'hash_4'
    });
    expect(frame.playbackEvents).toHaveLength(1);
  });

  test('rejects frames that cannot preserve contiguous visual order', () => {
    expect(() => FrameContract.normalizePresentationFrame({
      roomId: 'ABC',
      visualSeq: 4,
      stateVersionFrom: 4,
      stateVersionTo: 4,
      playbackEvents: []
    })).toThrow(/stateVersionTo/);
  });

  test('dedupes and sorts frames after a cursor', () => {
    const frames = FrameContract.collectFramesAfter([
      { visualSeq: 3, stateVersionFrom: 2, stateVersionTo: 3, playbackEvents: [{ type: 'a' }] },
      { visualSeq: 2, stateVersionFrom: 1, stateVersionTo: 2, playbackEvents: [{ type: 'b' }] },
      { visualSeq: 3, stateVersionFrom: 2, stateVersionTo: 3, playbackEvents: [{ type: 'duplicate' }] }
    ], 1);

    expect(frames.map((frame: any) => frame.visualSeq)).toEqual([2, 3]);
    expect(frames[1].playbackEvents[0].type).toBe('a');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npx jest test/shared.network-presentation-frame.test.ts --runInBand
```

Expected: FAIL because `shared/network-presentation-frame` does not exist.

- [ ] **Step 3: Add the shared module**

Create `shared/network-presentation-frame.ts`:

```ts
export interface NetworkPresentationFrame {
  roomId: string | null;
  visualSeq: number;
  stateVersionFrom: number;
  stateVersionTo: number;
  operationId: string | null;
  actorSeatKey: 'black' | 'white' | null;
  actionType: string | null;
  playbackEvents: unknown[];
  effectLogs: string[];
  playbackDiagnostics: unknown | null;
  projectedSnapshotHash: string | null;
  createdAt: number;
}

function toFiniteInteger(value: unknown, fieldName: string): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${fieldName}_required`);
  }
  return Math.trunc(numberValue);
}

function normalizeSeatKey(value: unknown): 'black' | 'white' | null {
  if (value === 'black' || value === 1 || value === '1' || value === '+1') return 'black';
  if (value === 'white' || value === -1 || value === '-1') return 'white';
  return null;
}

function normalizeStringOrNull(value: unknown): string | null {
  const text = value == null ? '' : String(value).trim();
  return text ? text : null;
}

export function normalizePresentationFrame(value: unknown): NetworkPresentationFrame {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const visualSeq = toFiniteInteger(source.visualSeq, 'visualSeq');
  const stateVersionFrom = toFiniteInteger(source.stateVersionFrom, 'stateVersionFrom');
  const stateVersionTo = toFiniteInteger(source.stateVersionTo, 'stateVersionTo');
  if (stateVersionTo <= stateVersionFrom) {
    throw new Error('stateVersionTo_must_advance');
  }
  return {
    roomId: normalizeStringOrNull(source.roomId),
    visualSeq,
    stateVersionFrom,
    stateVersionTo,
    operationId: normalizeStringOrNull(source.operationId),
    actorSeatKey: normalizeSeatKey(source.actorSeatKey),
    actionType: normalizeStringOrNull(source.actionType),
    playbackEvents: Array.isArray(source.playbackEvents) ? source.playbackEvents.slice() : [],
    effectLogs: Array.isArray(source.effectLogs) ? source.effectLogs.map((item) => String(item)) : [],
    playbackDiagnostics: source.playbackDiagnostics || null,
    projectedSnapshotHash: normalizeStringOrNull(source.projectedSnapshotHash),
    createdAt: Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : Date.now()
  };
}

export function collectFramesAfter(values: unknown, afterVisualSeq: unknown): NetworkPresentationFrame[] {
  const minSeq = Number.isFinite(Number(afterVisualSeq)) ? Math.trunc(Number(afterVisualSeq)) : 0;
  const frames = Array.isArray(values) ? values : [];
  const bySeq = new Map<number, NetworkPresentationFrame>();
  for (const value of frames) {
    const frame = normalizePresentationFrame(value);
    if (frame.visualSeq <= minSeq) continue;
    if (!bySeq.has(frame.visualSeq)) bySeq.set(frame.visualSeq, frame);
  }
  return Array.from(bySeq.values()).sort((a, b) => a.visualSeq - b.visualSeq);
}

export = {
  normalizePresentationFrame,
  collectFramesAfter
};
```

- [ ] **Step 4: Run the shared contract test**

Run:

```powershell
npx jest test/shared.network-presentation-frame.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Build TypeScript**

Run:

```powershell
npm run build:ts
```

Expected: PASS and generated compatibility output is produced by the existing build process.

- [ ] **Step 6: Commit**

Run:

```powershell
git add shared/network-presentation-frame.ts test/shared.network-presentation-frame.test.ts
git commit -m "Add network presentation frame contract"
```

---

### Task 3: Add Authority Presentation Journal Helpers

**Files:**
- Modify: `utils/match-authority-types.ts`
- Modify: `utils/match-authority.ts`
- Test: `test/utils.match-authority.presentation-journal.test.ts`

- [ ] **Step 1: Write failing journal helper tests**

Create `test/utils.match-authority.presentation-journal.test.ts`:

```ts
const MatchAuthority = require('../utils/match-authority');

function createRoom() {
  return {
    roomId: 'ABC',
    stateVersion: 1,
    visualSeq: 0,
    presentationJournal: [],
    snapshot: {
      stateVersion: 1,
      _meta: { projectedSnapshotHash: 'hash_1' },
      gameState: { currentPlayer: 1 },
      cardState: { hands: { black: [], white: [] } }
    }
  };
}

describe('match authority presentation journal', () => {
  test('appendPresentationFrame increments visualSeq and stores viewer payloads', () => {
    const room = createRoom();
    const frame = MatchAuthority.appendPresentationFrame(room, {
      stateVersionFrom: 1,
      stateVersionTo: 2,
      operationId: 'op_1',
      actorSeatKey: 'black',
      actionType: 'place',
      payloadByViewer: {
        black: { playbackEvents: [{ type: 'flip', phase: 2 }], effectLogs: ['black view'] },
        white: { playbackEvents: [{ type: 'flip', phase: 2 }], effectLogs: ['white view'] },
        spectator: { playbackEvents: [{ type: 'flip', phase: 2 }], effectLogs: ['spectator view'] }
      },
      snapshotAfterByViewer: {
        black: { stateVersion: 2, _meta: { projectedSnapshotHash: 'black_hash_2' } },
        white: { stateVersion: 2, _meta: { projectedSnapshotHash: 'white_hash_2' } },
        spectator: { stateVersion: 2, _meta: { projectedSnapshotHash: 'spectator_hash_2' } }
      },
      createdAt: 1000
    });

    expect(frame.visualSeq).toBe(1);
    expect(room.visualSeq).toBe(1);
    expect(room.presentationJournal).toHaveLength(1);
  });

  test('getPresentationFramesAfter returns projection-safe frames for a seat', () => {
    const room = createRoom();
    MatchAuthority.appendPresentationFrame(room, {
      stateVersionFrom: 1,
      stateVersionTo: 2,
      operationId: 'op_1',
      actorSeatKey: 'white',
      actionType: 'card',
      payloadByViewer: {
        black: { playbackEvents: [{ type: 'observer_bubble' }], effectLogs: ['black redacted'] },
        white: { playbackEvents: [{ type: 'observer_bubble' }], effectLogs: ['white private'] },
        spectator: { playbackEvents: [{ type: 'observer_bubble' }], effectLogs: ['spectator public'] }
      },
      snapshotAfterByViewer: {
        black: { stateVersion: 2, _meta: { projectedSnapshotHash: 'black_hash_2' } },
        white: { stateVersion: 2, _meta: { projectedSnapshotHash: 'white_hash_2' } },
        spectator: { stateVersion: 2, _meta: { projectedSnapshotHash: 'spectator_hash_2' } }
      },
      createdAt: 1000
    });

    const frames = MatchAuthority.getPresentationFramesAfter(room, 0, { role: 'seat', seatKey: 'black' });
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      visualSeq: 1,
      stateVersionFrom: 1,
      stateVersionTo: 2,
      effectLogs: ['black redacted'],
      projectedSnapshotHash: 'black_hash_2'
    });
  });

  test('buildPresentationJournalResponse returns base snapshot and contiguous frames', () => {
    const room = createRoom();
    MatchAuthority.appendPresentationFrame(room, {
      stateVersionFrom: 1,
      stateVersionTo: 2,
      operationId: 'op_1',
      actorSeatKey: 'black',
      actionType: 'place',
      payloadByViewer: {
        black: { playbackEvents: [{ type: 'flip' }], effectLogs: [] }
      },
      snapshotAfterByViewer: {
        black: { stateVersion: 2, _meta: { projectedSnapshotHash: 'hash_2' } }
      },
      createdAt: 1000
    });

    const response = MatchAuthority.buildPresentationJournalResponse(room, {
      afterVisualSeq: 0,
      viewer: { role: 'seat', seatKey: 'black' },
      baseSnapshot: { stateVersion: 1, _meta: { projectedSnapshotHash: 'hash_1' } }
    });

    expect(response.ok).toBe(true);
    expect(response.baseVisualSeq).toBe(0);
    expect(response.baseSnapshot.stateVersion).toBe(1);
    expect(response.presentationFrames.map((frame: any) => frame.visualSeq)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run the helper tests and verify failure**

Run:

```powershell
npx jest test/utils.match-authority.presentation-journal.test.ts --runInBand
```

Expected: FAIL because journal helpers are not exported.

- [ ] **Step 3: Extend room and payload types**

In `utils/match-authority-types.ts`, add:

```ts
export type MatchAuthorityPresentationPayloadKey = MatchAuthoritySeatKey | 'spectator';

export interface MatchAuthorityPresentationFramePublic extends MatchAuthorityJsonObject {
    roomId?: string | null;
    visualSeq: number;
    stateVersionFrom: number;
    stateVersionTo: number;
    operationId?: string | null;
    actorSeatKey?: MatchAuthoritySeatKey | null;
    actionType?: string | null;
    playbackEvents: unknown[];
    effectLogs?: string[];
    playbackDiagnostics?: unknown | null;
    projectedSnapshotHash?: string | null;
    createdAt: number;
}

export interface MatchAuthorityPresentationJournalEntry extends MatchAuthorityJsonObject {
    visualSeq: number;
    stateVersionFrom: number;
    stateVersionTo: number;
    operationId?: string | null;
    actorSeatKey?: MatchAuthoritySeatKey | null;
    actionType?: string | null;
    payloadByViewer: Partial<Record<MatchAuthorityPresentationPayloadKey, MatchAuthorityRoomPayloadOptions>>;
    snapshotAfterByViewer: Partial<Record<MatchAuthorityPresentationPayloadKey, unknown>>;
    createdAt: number;
}
```

Add these fields to `MatchAuthorityRoomState`:

```ts
visualSeq?: number | null;
presentationJournal?: MatchAuthorityPresentationJournalEntry[] | null;
initialSnapshotByViewer?: Partial<Record<MatchAuthorityPresentationPayloadKey, unknown>> | null;
```

Add these fields to `MatchAuthorityRoomPayloadOptions` and `MatchAuthorityRoomPayload`:

```ts
presentationCursor?: unknown;
presentationFrames?: unknown;
baseVisualSeq?: unknown;
baseSnapshot?: unknown;
```

- [ ] **Step 4: Implement journal helpers in `utils/match-authority.ts`**

Add helpers near the existing SSE buffer helpers:

```ts
function getPresentationPayloadKeyForViewer(viewer: MatchAuthorityViewer | null | undefined): MatchAuthorityPresentationPayloadKey {
    if (viewer && viewer.role === 'seat' && (viewer.seatKey === 'black' || viewer.seatKey === 'white')) {
        return viewer.seatKey;
    }
    return 'spectator';
}

function ensurePresentationJournal(room: MatchAuthorityRoomState): MatchAuthorityPresentationJournalEntry[] {
    if (!room || typeof room !== 'object') return [];
    if (!Array.isArray(room.presentationJournal)) room.presentationJournal = [];
    return room.presentationJournal;
}

function appendPresentationFrame(room: MatchAuthorityRoomState, input: Partial<MatchAuthorityPresentationJournalEntry>): MatchAuthorityPresentationJournalEntry {
    const journal = ensurePresentationJournal(room);
    const nextSeq = Number.isFinite(Number(room.visualSeq)) ? Math.trunc(Number(room.visualSeq)) + 1 : journal.length + 1;
    const entry: MatchAuthorityPresentationJournalEntry = {
        visualSeq: nextSeq,
        stateVersionFrom: Math.trunc(Number(input.stateVersionFrom)),
        stateVersionTo: Math.trunc(Number(input.stateVersionTo)),
        operationId: input.operationId ? String(input.operationId) : null,
        actorSeatKey: input.actorSeatKey === 'black' || input.actorSeatKey === 'white' ? input.actorSeatKey : null,
        actionType: input.actionType ? String(input.actionType) : null,
        payloadByViewer: input.payloadByViewer || {},
        snapshotAfterByViewer: input.snapshotAfterByViewer || {},
        createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : Date.now()
    };
    if (!Number.isFinite(entry.stateVersionFrom) || !Number.isFinite(entry.stateVersionTo) || entry.stateVersionTo <= entry.stateVersionFrom) {
        throw new Error('invalid_presentation_frame_versions');
    }
    journal.push(entry);
    room.visualSeq = nextSeq;
    return entry;
}

function toPublicPresentationFrame(entry: MatchAuthorityPresentationJournalEntry, viewer: MatchAuthorityViewer | null | undefined): MatchAuthorityPresentationFramePublic {
    const payloadKey = getPresentationPayloadKeyForViewer(viewer);
    const payload = (entry.payloadByViewer && entry.payloadByViewer[payloadKey])
        || (entry.payloadByViewer && entry.payloadByViewer.spectator)
        || {};
    const snapshotAfter = (entry.snapshotAfterByViewer && entry.snapshotAfterByViewer[payloadKey])
        || (entry.snapshotAfterByViewer && entry.snapshotAfterByViewer.spectator)
        || null;
    const snapshotMeta = snapshotAfter && typeof snapshotAfter === 'object' ? (snapshotAfter as Record<string, unknown>)._meta as Record<string, unknown> : null;
    return {
        roomId: null,
        visualSeq: entry.visualSeq,
        stateVersionFrom: entry.stateVersionFrom,
        stateVersionTo: entry.stateVersionTo,
        operationId: entry.operationId || null,
        actorSeatKey: entry.actorSeatKey || null,
        actionType: entry.actionType || null,
        playbackEvents: Array.isArray(payload.playbackEvents) ? payload.playbackEvents.slice() : [],
        effectLogs: normalizeEffectLogMessages(payload.effectLogs),
        playbackDiagnostics: payload.playbackDiagnostics || null,
        projectedSnapshotHash: snapshotMeta && snapshotMeta.projectedSnapshotHash ? String(snapshotMeta.projectedSnapshotHash) : null,
        createdAt: entry.createdAt
    };
}

function getPresentationFramesAfter(room: MatchAuthorityRoomState, afterVisualSeq: unknown, viewer: MatchAuthorityViewer | null | undefined): MatchAuthorityPresentationFramePublic[] {
    const minSeq = Number.isFinite(Number(afterVisualSeq)) ? Math.trunc(Number(afterVisualSeq)) : 0;
    const journal = Array.isArray(room && room.presentationJournal) ? room.presentationJournal : [];
    return journal
        .filter((entry) => entry && Number(entry.visualSeq) > minSeq)
        .sort((a, b) => Number(a.visualSeq) - Number(b.visualSeq))
        .map((entry) => toPublicPresentationFrame(entry, viewer));
}
```

Add `buildPresentationJournalResponse(room, options)` using `getPresentationFramesAfter()` and the supplied `baseSnapshot`.

- [ ] **Step 5: Export the helpers**

Add the new functions to the `MatchAuthority` export object:

```ts
appendPresentationFrame,
getPresentationFramesAfter,
buildPresentationJournalResponse,
toPublicPresentationFrame
```

- [ ] **Step 6: Run tests**

Run:

```powershell
npx jest test/utils.match-authority.presentation-journal.test.ts --runInBand
npm run typecheck
```

Expected: both pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add utils/match-authority-types.ts utils/match-authority.ts test/utils.match-authority.presentation-journal.test.ts
git commit -m "Add match presentation journal helpers"
```

---

### Task 4: Generate Journal Frames On Worker And Local Accepted Operations

**Files:**
- Modify: `workers/match-worker-types.ts`
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-broadcast-controller.ts`
- Modify: `scripts/local-match-server.ts`
- Test: `test/workers.match-presentation-journal.test.ts`
- Test: `test/local-match-server.presentation-journal.test.ts`

- [ ] **Step 1: Write Worker acceptance test**

Create `test/workers.match-presentation-journal.test.ts` with a Durable Object scenario that:

1. Creates room `JRN1`.
2. Publishes one legal operation.
3. Reads `/api/match/state`.
4. Asserts `presentationCursor.visualSeq === 1`.
5. Asserts `presentationFrames[0].stateVersionFrom === 1`.
6. Asserts `presentationFrames[0].stateVersionTo === 2`.

Use the existing spawned-worker style from `test/workers.match-stream-sse.test.ts`.

- [ ] **Step 2: Write local server helper test**

Create `test/local-match-server.presentation-journal.test.ts`:

```ts
const LocalServer = require('../scripts/local-match-server');

describe('local match server presentation journal', () => {
  test('accepted command increments room visual cursor with the same version edge as stateVersion', async () => {
    const room = {
      roomId: 'JRN1',
      seed: 1,
      stateVersion: 1,
      visualSeq: 0,
      presentationJournal: [],
      snapshot: {
        stateVersion: 1,
        gameState: {
          board: Array.from({ length: 8 }, () => Array(8).fill(0)),
          currentPlayer: 1,
          turnNumber: 1,
          consecutivePasses: 0
        },
        cardState: {
          hands: { black: [], white: [] },
          charge: { black: 0, white: 0 },
          pendingEffectByPlayer: { black: null, white: null },
          hasUsedCardThisTurnByPlayer: { black: false, white: false },
          lastUsedCardByPlayer: { black: null, white: null },
          markers: [],
          discard: [],
          turnIndex: 1
        }
      },
      seats: { black: true, white: true },
      seatTokens: { black: 'token_black', white: 'token_white' },
      seatNames: { black: 'black', white: 'white' },
      roomDeck: null,
      turnTimer: { active: false },
      lastAcceptedOperationBySeat: { black: null, white: null },
      eventSeq: 1,
      chatMessages: [],
      chatSeq: 0
    };

    expect(typeof LocalServer.__testAppendPresentationFrameForAcceptedPublish).toBe('function');
    const frame = LocalServer.__testAppendPresentationFrameForAcceptedPublish(room, {
      previousStateVersion: 1,
      nextStateVersion: 2,
      operationId: 'op_1',
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [{ type: 'flip', phase: 2 }],
      effectLogs: ['黒が石を置いた'],
      playbackDiagnostics: null
    });

    expect(frame.visualSeq).toBe(1);
    expect(room.presentationJournal).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```powershell
npx jest test/workers.match-presentation-journal.test.ts test/local-match-server.presentation-journal.test.ts --runInBand
```

Expected: FAIL because frames are not appended yet.

- [ ] **Step 4: Extend Worker room type**

In `workers/match-worker-types.ts`, rely on the extended `MatchAuthorityRoomState` fields. If TypeScript needs explicit fields, add:

```ts
visualSeq?: number | null;
presentationJournal?: MatchAuthorityPresentationJournalEntry[] | null;
initialSnapshotByViewer?: Partial<Record<MatchAuthorityPresentationPayloadKey, unknown>> | null;
```

Import the new types from `utils/match-authority-types.ts`.

- [ ] **Step 5: Append a frame after accepted publish in `workers/match-worker.ts`**

After `room.stateVersion` is incremented and before prepared snapshot broadcast is sent, build the three viewer snapshots and append one frame:

```ts
const previousStateVersion = room.stateVersion - 1;
const snapshotAfterByViewer = {
  black: toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'black' }),
  white: toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'white' }),
  spectator: toPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: '' })
};
const payloadByViewer = {
  black: buildSnapshotPayload(room, meta, { role: 'seat', seatKey: 'black' }),
  white: buildSnapshotPayload(room, meta, { role: 'seat', seatKey: 'white' }),
  spectator: buildSnapshotPayload(room, meta, { role: 'spectator', spectatorId: '' })
};
MatchAuthority.appendPresentationFrame(room, {
  stateVersionFrom: previousStateVersion,
  stateVersionTo: room.stateVersion,
  operationId: operationId || null,
  actorSeatKey: playerKey,
  actionType,
  payloadByViewer,
  snapshotAfterByViewer,
  createdAt: room.updatedAt || Date.now()
});
```

If the accepted operation has no playback events, still append the frame with an empty `playbackEvents` array. This keeps visual cursor order equal to accepted state transitions.

- [ ] **Step 6: Mirror the same append point in `scripts/local-match-server.ts`**

Add a local helper:

```ts
function appendPresentationFrameForAcceptedPublish(room: any, options: any) {
  return MatchAuthority.appendPresentationFrame(room, {
    stateVersionFrom: options.previousStateVersion,
    stateVersionTo: options.nextStateVersion,
    operationId: options.operationId || null,
    actorSeatKey: options.playerKey || null,
    actionType: options.actionType || null,
    payloadByViewer: {
      black: buildSnapshotPayload(room, { ...options, playbackEvents: options.playbackEvents }, { role: 'seat', seatKey: 'black' }),
      white: buildSnapshotPayload(room, { ...options, playbackEvents: options.playbackEvents }, { role: 'seat', seatKey: 'white' }),
      spectator: buildSnapshotPayload(room, { ...options, playbackEvents: options.playbackEvents }, { role: 'spectator', spectatorId: '' })
    },
    snapshotAfterByViewer: {
      black: toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'black' }),
      white: toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'white' }),
      spectator: toPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: '' })
    },
    createdAt: room.updatedAt || Date.now()
  });
}
```

Export it as `__testAppendPresentationFrameForAcceptedPublish` for the focused test.

- [ ] **Step 7: Include cursor metadata in snapshot payloads**

In `utils/match-authority.ts`, when building room/snapshot/publish payloads, include:

```ts
presentationCursor: {
  visualSeq: Number.isFinite(Number(room.visualSeq)) ? Math.trunc(Number(room.visualSeq)) : 0,
  stateVersion: Number.isFinite(Number(room.stateVersion)) ? Math.trunc(Number(room.stateVersion)) : null
}
```

For the accepted operation payload, include `presentationFrames: [toPublicPresentationFrame(newEntry, viewer)]`.

- [ ] **Step 8: Run tests**

Run:

```powershell
npx jest test/workers.match-presentation-journal.test.ts test/local-match-server.presentation-journal.test.ts --runInBand
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```powershell
git add workers/match-worker-types.ts workers/match-worker.ts workers/match-worker-broadcast-controller.ts scripts/local-match-server.ts utils/match-authority.ts test/workers.match-presentation-journal.test.ts test/local-match-server.presentation-journal.test.ts
git commit -m "Record presentation journal frames for network actions"
```

---

### Task 5: Add Presentation Journal Recovery Transport

**Files:**
- Modify: `utils/match-authority.ts`
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-stream-route-controller.ts`
- Modify: `scripts/local-match-server.ts`
- Test: `test/workers.match-presentation-journal.test.ts`
- Test: `test/local-match-server.presentation-journal.test.ts`

- [ ] **Step 1: Extend tests for recovery endpoint**

Add assertions to the Worker and local tests:

```ts
expect(recoveryPayload).toMatchObject({
  ok: true,
  roomId: 'JRN1',
  baseVisualSeq: 0,
  presentationCursor: { visualSeq: 1, stateVersion: 2 }
});
expect(recoveryPayload.baseSnapshot.stateVersion).toBe(1);
expect(recoveryPayload.presentationFrames.map((frame: any) => frame.visualSeq)).toEqual([1]);
```

Use this request shape:

```text
GET /api/match/presentation-journal?roomId=JRN1&seatKey=black&seatToken=token_black&afterVisualSeq=0
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npx jest test/workers.match-presentation-journal.test.ts test/local-match-server.presentation-journal.test.ts --runInBand
```

Expected: FAIL because the endpoint does not exist.

- [ ] **Step 3: Implement `buildPresentationJournalResponse()` base snapshot selection**

In `utils/match-authority.ts`, return the snapshot that corresponds to `afterVisualSeq`:

```ts
function findBaseSnapshotForVisualSeq(room: MatchAuthorityRoomState, afterVisualSeq: number, viewer: MatchAuthorityViewer | null | undefined): unknown {
    const payloadKey = getPresentationPayloadKeyForViewer(viewer);
    if (afterVisualSeq <= 0) {
        const initial = room.initialSnapshotByViewer && room.initialSnapshotByViewer[payloadKey];
        return initial || room.snapshot || null;
    }
    const journal = Array.isArray(room.presentationJournal) ? room.presentationJournal : [];
    const entry = journal.find((item) => Number(item && item.visualSeq) === afterVisualSeq);
    if (!entry) return null;
    return (entry.snapshotAfterByViewer && entry.snapshotAfterByViewer[payloadKey])
        || (entry.snapshotAfterByViewer && entry.snapshotAfterByViewer.spectator)
        || null;
}
```

The response must be:

```ts
{
  ok: true,
  roomId,
  baseVisualSeq,
  baseSnapshot,
  presentationCursor,
  presentationFrames,
  serverTime
}
```

If no base snapshot exists for the requested cursor, return:

```ts
{
  ok: false,
  reason: 'VISUAL_CURSOR_EXPIRED',
  presentationCursor,
  snapshot: currentPublicSnapshot
}
```

This failure path is a visible error for active-room strict playback and must not be interpreted as successful skip.

- [ ] **Step 4: Add Worker endpoint**

In `workers/match-worker.ts`, add route handling for `/api/match/presentation-journal` near the existing state/stream handlers:

```ts
async handlePresentationJournal(request: Request): Promise<Response> {
  await this.loadRoom();
  const url = new URL(request.url);
  const room = this.room;
  if (!room) return jsonResponse({ ok: false, reason: 'ROOM_NOT_FOUND' }, 404);
  const viewer = this.authenticateViewerFromRequest(url);
  if (!viewer) return jsonResponse({ ok: false, reason: 'UNAUTHORIZED' }, 403);
  const afterVisualSeq = Number(url.searchParams.get('afterVisualSeq') || 0);
  const payload = MatchAuthority.buildPresentationJournalResponse(room, {
    afterVisualSeq,
    viewer,
    baseSnapshot: null,
    serverTime: Date.now()
  });
  return jsonResponse(payload, payload.ok === false ? 409 : 200);
}
```

Use existing authentication helpers rather than adding a second token parser.

- [ ] **Step 5: Add local server endpoint**

In `scripts/local-match-server.ts`, add:

```ts
if (req.method === 'GET' && pathname === '/api/match/presentation-journal') {
  handlePresentationJournal(req, res, urlObj);
  return;
}
```

`handlePresentationJournal()` must reuse the same viewer authentication branches as `/api/match/state`.

- [ ] **Step 6: Keep SSE replay as transport-only**

Do not remove SSE replay. In `workers/match-worker-stream-route-controller.ts` and `scripts/local-match-server.ts`, keep replay events for transport continuity, but add no new visual ordering logic there. Visual catch-up will be handled by the client timeline using `presentationCursor` and the journal endpoint.

- [ ] **Step 7: Run transport tests**

Run:

```powershell
npx jest test/workers.match-presentation-journal.test.ts test/workers.match-stream-sse.test.ts test/workers.match-worker-stream-route-controller.test.ts --runInBand
npm run test:network:parity
```

Expected: all pass. Existing SSE replay tests continue passing.

- [ ] **Step 8: Commit**

Run:

```powershell
git add utils/match-authority.ts workers/match-worker.ts workers/match-worker-stream-route-controller.ts scripts/local-match-server.ts test/workers.match-presentation-journal.test.ts test/local-match-server.presentation-journal.test.ts
git commit -m "Expose presentation journal recovery"
```

---

### Task 6: Add Client Presentation Timeline In Shadow Mode

**Files:**
- Create: `ui/network/presentation-timeline.ts`
- Modify: `ui/network-client.ts`
- Modify: `ui/network/stream-snapshot.ts`
- Modify: `ui/network/publish-flow.ts`
- Test: `test/ui.network-presentation-timeline.test.ts`

- [ ] **Step 1: Write timeline unit tests**

Create `test/ui.network-presentation-timeline.test.ts`:

```ts
const Timeline = require('../ui/network/presentation-timeline');

function frame(seq: number) {
  return {
    visualSeq: seq,
    stateVersionFrom: seq,
    stateVersionTo: seq + 1,
    playbackEvents: [{ type: `event_${seq}`, phase: seq }],
    effectLogs: []
  };
}

describe('network presentation timeline', () => {
  test('queues frames and exposes only contiguous playable frames', () => {
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });

    timeline.enqueueFrames([frame(2), frame(1)], { source: 'test' });
    expect(timeline.peekNextFrame().visualSeq).toBe(1);

    timeline.markFramePlayed(1, 2);
    expect(timeline.peekNextFrame().visualSeq).toBe(2);
  });

  test('dedupes publish and stream copies by visualSeq', () => {
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });

    timeline.enqueueFrames([frame(1)], { source: 'stream' });
    timeline.enqueueFrames([frame(1)], { source: 'publish_response' });
    expect(timeline.getDiagnostics().pendingFrameCount).toBe(1);
  });

  test('detects a version gap without advancing visual cursor', () => {
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });

    timeline.enqueueFrames([{ ...frame(1), stateVersionFrom: 3, stateVersionTo: 4 }], { source: 'test' });
    expect(timeline.peekNextFrame()).toBeNull();
    expect(timeline.getDiagnostics().gap).toMatchObject({ expectedVersion: 1, nextVersionFrom: 3 });
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npx jest test/ui.network-presentation-timeline.test.ts --runInBand
```

Expected: FAIL because the timeline module does not exist.

- [ ] **Step 3: Implement shadow timeline**

Create `ui/network/presentation-timeline.ts`:

```ts
interface TimelineOptions {
  initialVisualSeq?: unknown;
  initialVisualVersion?: unknown;
}

interface EnqueueOptions {
  source?: string;
}

function toInt(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
}

function normalizeFrame(value: any): any | null {
  if (!value || typeof value !== 'object') return null;
  const visualSeq = toInt(value.visualSeq, 0);
  const stateVersionFrom = toInt(value.stateVersionFrom, 0);
  const stateVersionTo = toInt(value.stateVersionTo, 0);
  if (visualSeq <= 0 || stateVersionTo <= stateVersionFrom) return null;
  return {
    ...value,
    visualSeq,
    stateVersionFrom,
    stateVersionTo,
    playbackEvents: Array.isArray(value.playbackEvents) ? value.playbackEvents.slice() : []
  };
}

function createNetworkPresentationTimeline(options?: TimelineOptions) {
  const opts = options || {};
  let visualSeq = toInt(opts.initialVisualSeq, 0);
  let visualVersion = toInt(opts.initialVisualVersion, 0);
  const pending = new Map<number, any>();
  let lastGap: any = null;

  function enqueueFrames(frames: unknown, _options?: EnqueueOptions): void {
    for (const value of Array.isArray(frames) ? frames : []) {
      const frame = normalizeFrame(value);
      if (!frame || frame.visualSeq <= visualSeq || pending.has(frame.visualSeq)) continue;
      pending.set(frame.visualSeq, frame);
    }
  }

  function peekNextFrame(): any | null {
    const next = pending.get(visualSeq + 1);
    if (!next) {
      lastGap = null;
      return null;
    }
    if (next.stateVersionFrom !== visualVersion) {
      lastGap = { expectedVersion: visualVersion, nextVersionFrom: next.stateVersionFrom, visualSeq: next.visualSeq };
      return null;
    }
    lastGap = null;
    return next;
  }

  function markFramePlayed(playedVisualSeq: unknown, nextVisualVersion: unknown): void {
    const seq = toInt(playedVisualSeq, visualSeq);
    if (seq !== visualSeq + 1) throw new Error('visualSeq_not_contiguous');
    pending.delete(seq);
    visualSeq = seq;
    visualVersion = toInt(nextVisualVersion, visualVersion);
  }

  function getDiagnostics(): any {
    return {
      visualSeq,
      visualVersion,
      pendingFrameCount: pending.size,
      gap: lastGap
    };
  }

  return {
    enqueueFrames,
    peekNextFrame,
    markFramePlayed,
    getDiagnostics
  };
}

export = {
  createNetworkPresentationTimeline
};
```

- [ ] **Step 4: Wire shadow ingestion**

In `ui/network/stream-snapshot.ts`, after reading the payload:

```ts
const timeline = resolveNetworkPresentationTimeline();
if (timeline && typeof timeline.enqueueFrames === 'function') {
  timeline.enqueueFrames(payload.presentationFrames, { source: 'stream' });
}
```

In `ui/network/publish-flow.ts`, after a successful publish response:

```ts
const timeline = resolveNetworkPresentationTimeline();
if (timeline && typeof timeline.enqueueFrames === 'function') {
  timeline.enqueueFrames(responsePayload.presentationFrames, { source: 'publish_response' });
}
```

In `ui/network-client.ts`, create and expose one timeline instance:

```ts
const presentationTimeline = PresentationTimeline.createNetworkPresentationTimeline();
state.presentationTimeline = presentationTimeline;
```

Expose diagnostics under debug only:

```ts
getPresentationTimelineDiagnostics() {
  return state.presentationTimeline && state.presentationTimeline.getDiagnostics
    ? state.presentationTimeline.getDiagnostics()
    : null;
}
```

- [ ] **Step 5: Run tests**

Run:

```powershell
npx jest test/ui.network-presentation-timeline.test.ts --runInBand
npx jest test/ui.network-client.reconnect-sync.test.ts --runInBand
npm run typecheck
```

Expected: all pass. Playback behavior is unchanged because timeline is shadow-only.

- [ ] **Step 6: Commit**

Run:

```powershell
git add ui/network/presentation-timeline.ts ui/network-client.ts ui/network/stream-snapshot.ts ui/network/publish-flow.ts test/ui.network-presentation-timeline.test.ts
git commit -m "Observe network presentation timeline"
```

---

### Task 7: Move Network Playback Dispatch Behind The Timeline

**Files:**
- Create: `ui/network/playback-dispatcher.ts`
- Modify: `ui/network/snapshot.ts`
- Modify: `ui/network/presentation-timeline.ts`
- Test: `test/ui.network-playback-dispatcher.test.ts`
- Test: `test/ui.network-client.visual-catchup.test.ts`

- [ ] **Step 1: Write dispatcher test**

Create `test/ui.network-playback-dispatcher.test.ts`:

```ts
const Dispatcher = require('../ui/network/playback-dispatcher');

describe('network playback dispatcher', () => {
  afterEach(() => {
    delete (global as any).BoardOps;
    delete (global as any).PresentationHandler;
  });

  test('emits one PLAYBACK_EVENTS batch through BoardOps', async () => {
    const emitted: any[] = [];
    (global as any).BoardOps = {
      emitPresentationEvent: (event: any) => emitted.push(event)
    };

    await Dispatcher.dispatchNetworkPlaybackEvents([{ type: 'flip', phase: 2 }], {
      source: 'network_timeline',
      visualSeq: 1
    });

    expect(emitted).toEqual([{
      type: 'PLAYBACK_EVENTS',
      source: 'network_timeline',
      networkPlaybackBatchId: expect.any(String),
      visualSeq: 1,
      events: [{ type: 'flip', phase: 2 }]
    }]);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npx jest test/ui.network-playback-dispatcher.test.ts --runInBand
```

Expected: FAIL because dispatcher does not exist.

- [ ] **Step 3: Implement dispatcher**

Create `ui/network/playback-dispatcher.ts`:

```ts
let nextBatchId = 1;

function resolveGlobalObject(name: string): any {
  try {
    if (typeof window !== 'undefined' && (window as any)[name]) return (window as any)[name];
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any)[name]) return (globalThis as any)[name];
  } catch (e) { /* ignore */ }
  return null;
}

async function dispatchNetworkPlaybackEvents(events: unknown[], options?: any): Promise<any> {
  const playbackEvents = Array.isArray(events) ? events.slice() : [];
  if (playbackEvents.length === 0) return null;
  const opts = options && typeof options === 'object' ? options : {};
  const event = {
    type: 'PLAYBACK_EVENTS',
    source: opts.source || 'network_timeline',
    networkPlaybackBatchId: `network_timeline_${Date.now()}_${nextBatchId++}`,
    visualSeq: Number.isFinite(Number(opts.visualSeq)) ? Math.trunc(Number(opts.visualSeq)) : null,
    strictNetworkPlayback: opts.strictNetworkPlayback === true,
    events: playbackEvents
  };
  const boardOps = resolveGlobalObject('BoardOps');
  if (boardOps && typeof boardOps.emitPresentationEvent === 'function') {
    return boardOps.emitPresentationEvent(event);
  }
  const handler = resolveGlobalObject('PresentationHandler');
  if (handler && typeof handler.handlePresentationEvent === 'function') {
    return handler.handlePresentationEvent(event);
  }
  return null;
}

export = {
  dispatchNetworkPlaybackEvents
};
```

- [ ] **Step 4: Extend timeline with `drainPlayableFrames()`**

In `ui/network/presentation-timeline.ts`, add:

```ts
async function drainPlayableFrames(dispatcher: any): Promise<number> {
  let played = 0;
  while (true) {
    const frame = peekNextFrame();
    if (!frame) break;
    await dispatcher.dispatchNetworkPlaybackEvents(frame.playbackEvents, {
      source: 'network_timeline',
      visualSeq: frame.visualSeq,
      strictNetworkPlayback: true
    });
    markFramePlayed(frame.visualSeq, frame.stateVersionTo);
    played += 1;
  }
  return played;
}
```

- [ ] **Step 5: Route network snapshot playback through timeline**

In `ui/network/snapshot.ts`, when `options.presentationFrames` is present:

```ts
const timeline = resolveNetworkPresentationTimeline();
if (timeline && Array.isArray(opts.presentationFrames) && opts.presentationFrames.length > 0) {
  timeline.enqueueFrames(opts.presentationFrames, { source: opts.source || 'snapshot' });
  timeline.drainPlayableFrames(NetworkPlaybackDispatcher);
  return finishWithoutDirectPlaybackEmission();
}
```

Keep the existing direct `emitPlaybackEvents()` path only for legacy payloads that have `playbackEvents` but no `presentationFrames`.

- [ ] **Step 6: Add visual catch-up client test**

Create `test/ui.network-client.visual-catchup.test.ts` asserting:

1. Stream receives two frames out of order.
2. `AnimationEngine.play` is called for visualSeq `1` before visualSeq `2`.
3. `applySnapshot` still accepts the newest canonical state.
4. Input lock remains active while pending frames exist.

- [ ] **Step 7: Run tests**

Run:

```powershell
npx jest test/ui.network-playback-dispatcher.test.ts test/ui.network-presentation-timeline.test.ts test/ui.network-client.visual-catchup.test.ts --runInBand
npm run typecheck
```

Expected: all pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add ui/network/playback-dispatcher.ts ui/network/presentation-timeline.ts ui/network/snapshot.ts test/ui.network-playback-dispatcher.test.ts test/ui.network-client.visual-catchup.test.ts
git commit -m "Route network playback through visual timeline"
```

---

### Task 8: Add Visual State Store

**Files:**
- Create: `ui/network/visual-state-store.ts`
- Modify: `ui/network/presentation-timeline.ts`
- Test: `test/ui.network-visual-state-store.test.ts`

- [ ] **Step 1: Write visual state store tests**

Create `test/ui.network-visual-state-store.test.ts`:

```ts
const Store = require('../ui/network/visual-state-store');

function snapshot(version: number) {
  return {
    stateVersion: version,
    gameState: { board: [[version]], currentPlayer: 1 },
    cardState: { hands: { black: [], white: [] }, markers: [] }
  };
}

describe('network visual state store', () => {
  test('canonical snapshot updates immediately while render state stays on visual snapshot', () => {
    const store = Store.createNetworkVisualStateStore();
    store.setBaseVisualSnapshot(snapshot(1), { visualSeq: 0, visualVersion: 1 });
    store.setCanonicalSnapshot(snapshot(3), { stateVersion: 3 });

    expect(store.getCanonicalSnapshot().stateVersion).toBe(3);
    expect(store.getRenderState().gameState.board).toEqual([[1]]);
  });

  test('committing a frame advances render state to the frame after snapshot', () => {
    const store = Store.createNetworkVisualStateStore();
    store.setBaseVisualSnapshot(snapshot(1), { visualSeq: 0, visualVersion: 1 });
    store.commitFrame({
      visualSeq: 1,
      stateVersionTo: 2,
      snapshotAfter: snapshot(2)
    });

    expect(store.getDiagnostics()).toMatchObject({ visualSeq: 1, visualVersion: 2 });
    expect(store.getRenderState().gameState.board).toEqual([[2]]);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npx jest test/ui.network-visual-state-store.test.ts --runInBand
```

Expected: FAIL because store does not exist.

- [ ] **Step 3: Implement store**

Create `ui/network/visual-state-store.ts`:

```ts
function cloneData(value: any): any {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function createNetworkVisualStateStore() {
  let canonicalSnapshot: any = null;
  let visualSnapshot: any = null;
  let visualSeq = 0;
  let visualVersion = 0;

  function setCanonicalSnapshot(snapshot: any, options?: any): void {
    canonicalSnapshot = cloneData(snapshot);
    if (!visualSnapshot) {
      visualSnapshot = cloneData(snapshot);
      visualVersion = Number.isFinite(Number(options && options.stateVersion))
        ? Math.trunc(Number(options.stateVersion))
        : Number(snapshot && snapshot.stateVersion) || visualVersion;
    }
  }

  function setBaseVisualSnapshot(snapshot: any, options?: any): void {
    visualSnapshot = cloneData(snapshot);
    visualSeq = Number.isFinite(Number(options && options.visualSeq)) ? Math.trunc(Number(options.visualSeq)) : visualSeq;
    visualVersion = Number.isFinite(Number(options && options.visualVersion)) ? Math.trunc(Number(options.visualVersion)) : Number(snapshot && snapshot.stateVersion) || visualVersion;
  }

  function commitFrame(frame: any): void {
    if (!frame || typeof frame !== 'object') throw new Error('frame_required');
    const snapshotAfter = frame.snapshotAfter || frame.snapshot || null;
    if (!snapshotAfter) throw new Error('snapshotAfter_required');
    visualSnapshot = cloneData(snapshotAfter);
    visualSeq = Math.trunc(Number(frame.visualSeq));
    visualVersion = Math.trunc(Number(frame.stateVersionTo));
  }

  function getRenderState(): any {
    const snapshot = visualSnapshot || canonicalSnapshot || {};
    return {
      gameState: snapshot.gameState || null,
      cardState: snapshot.cardState || null,
      snapshot
    };
  }

  function getCanonicalSnapshot(): any {
    return canonicalSnapshot;
  }

  function getDiagnostics(): any {
    return { visualSeq, visualVersion, hasCanonicalSnapshot: !!canonicalSnapshot, hasVisualSnapshot: !!visualSnapshot };
  }

  return {
    setCanonicalSnapshot,
    setBaseVisualSnapshot,
    commitFrame,
    getRenderState,
    getCanonicalSnapshot,
    getDiagnostics
  };
}

export = {
  createNetworkVisualStateStore
};
```

- [ ] **Step 4: Attach frame snapshots to timeline commits**

In `ui/network/presentation-timeline.ts`, when a frame is played, call:

```ts
if (visualStateStore && typeof visualStateStore.commitFrame === 'function') {
  visualStateStore.commitFrame({
    ...frame,
    snapshotAfter: frame.snapshotAfter || frame.snapshot
  });
}
```

If a frame has no `snapshotAfter`, keep the timeline paused and expose diagnostic reason `missing_snapshot_after`.

- [ ] **Step 5: Run tests**

Run:

```powershell
npx jest test/ui.network-visual-state-store.test.ts test/ui.network-presentation-timeline.test.ts --runInBand
npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add ui/network/visual-state-store.ts ui/network/presentation-timeline.ts test/ui.network-visual-state-store.test.ts
git commit -m "Add network visual state store"
```

---

### Task 9: Make Board Rendering Read Visual State During Strict Network Playback

**Files:**
- Modify: `ui/board-renderer.ts`
- Modify: `ui/network-client.ts`
- Test: `test/ui.board-renderer.visual-state.test.ts`

- [ ] **Step 1: Write board renderer visual-state test**

Create `test/ui.board-renderer.visual-state.test.ts`:

```ts
describe('board renderer visual state', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="board"></div>';
    (global as any).boardEl = document.getElementById('board');
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).getPlayerKey = () => 'black';
    (global as any).CardLogic = { getSelectableTargets: () => [], getCardContext: () => ({}) };
    (global as any).getLegalMoves = () => [];
    (global as any).countDiscs = () => ({ black: 0, white: 0 });
    (global as any).gameState = { board: [[1]], currentPlayer: 1 };
    (global as any).cardState = { markers: [], pendingEffectByPlayer: { black: null, white: null } };
    (global as any).NetworkVisualStateStore = {
      getRenderState: () => ({
        gameState: { board: [[-1]], currentPlayer: -1 },
        cardState: { markers: [], pendingEffectByPlayer: { white: null } }
      })
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (global as any).NetworkVisualStateStore;
  });

  test('renderBoard uses visual state instead of canonical globals when available', () => {
    const BoardRenderer = require('../ui/board-renderer');
    BoardRenderer.renderBoardFullLegacy();
    expect(document.querySelector('.disc.white')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npx jest test/ui.board-renderer.visual-state.test.ts --runInBand
```

Expected: FAIL because renderer reads global `gameState`.

- [ ] **Step 3: Add a renderer state resolver**

In `ui/board-renderer.ts`, add near helper functions:

```ts
function _getBoardRendererStateRefs() {
    try {
        const store = (typeof window !== 'undefined' && (window as any).NetworkVisualStateStore)
            ? (window as any).NetworkVisualStateStore
            : ((typeof globalThis !== 'undefined' && (globalThis as any).NetworkVisualStateStore) ? (globalThis as any).NetworkVisualStateStore : null);
        if (store && typeof store.getRenderState === 'function') {
            const renderState = store.getRenderState();
            if (renderState && renderState.gameState && renderState.cardState) {
                return {
                    gameState: renderState.gameState,
                    cardState: renderState.cardState
                };
            }
        }
    } catch (e: any) { /* ignore */ }
    return {
        gameState: typeof gameState !== 'undefined' ? gameState : null,
        cardState: typeof cardState !== 'undefined' ? cardState : null
    };
}
```

- [ ] **Step 4: Use state refs in render functions**

In `renderBoard()`, `renderBoardFull()`, `renderBoardFullLegacy()`, and `updateOccupancyUI()`, add:

```ts
const stateRefs = _getBoardRendererStateRefs();
const renderGameState = stateRefs.gameState;
const renderCardState = stateRefs.cardState;
```

Replace reads in those functions from `gameState` and `cardState` to `renderGameState` and `renderCardState`. Do not replace helper-level reads outside these render paths in this task.

- [ ] **Step 5: Expose the visual store**

In `ui/network-client.ts`, after creating the store:

```ts
root.NetworkVisualStateStore = state.visualStateStore;
```

Use the same root object where `NetworkMatchClient` is installed.

- [ ] **Step 6: Run tests**

Run:

```powershell
npx jest test/ui.board-renderer.visual-state.test.ts --runInBand
npx jest test/ui.network-visual-state-store.test.ts --runInBand
npm run typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add ui/board-renderer.ts ui/network-client.ts test/ui.board-renderer.visual-state.test.ts
git commit -m "Render board from network visual state"
```

---

### Task 10: Recover Missing Frames On Reconnect And Restore

**Files:**
- Modify: `ui/network/session-seat.ts`
- Modify: `ui/network/session-lifecycle.ts`
- Modify: `ui/network/reconnect-controller.ts`
- Modify: `ui/network/presentation-timeline.ts`
- Test: `test/ui.network-client.visual-catchup.test.ts`
- Test: `test/ui.network-session-lifecycle.test.ts`

- [ ] **Step 1: Extend reconnect tests**

Add a test where:

1. Client has persisted `{ roomId: 'ABC', seatKey: 'black', seatToken: 'token', lastVisualSeq: 1, lastVisualVersion: 2 }`.
2. `/api/match/state` returns `stateVersion: 4`.
3. `/api/match/presentation-journal?afterVisualSeq=1` returns `baseVisualSeq: 1`, `baseSnapshot.stateVersion: 2`, and frames `2`, `3`.
4. Timeline plays frame `2` then `3`.
5. Session persistence updates `lastVisualSeq` to `3`.

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npx jest test/ui.network-client.visual-catchup.test.ts test/ui.network-session-lifecycle.test.ts --runInBand
```

Expected: FAIL because restore does not fetch visual journal frames.

- [ ] **Step 3: Persist visual cursor**

In `ui/network/session-seat.ts`, add fields to stored active session:

```ts
lastVisualSeq: diagnostics && Number.isFinite(Number(diagnostics.visualSeq)) ? Math.trunc(Number(diagnostics.visualSeq)) : 0,
lastVisualVersion: diagnostics && Number.isFinite(Number(diagnostics.visualVersion)) ? Math.trunc(Number(diagnostics.visualVersion)) : null
```

Update this cursor after each `markFramePlayed()`.

- [ ] **Step 4: Add journal fetch in session lifecycle**

In `ui/network/session-lifecycle.ts`, add:

```ts
async function fetchPresentationJournalCatchup(options: any) {
  const params = new URLSearchParams();
  params.set('roomId', options.roomId);
  params.set('afterVisualSeq', String(options.afterVisualSeq || 0));
  if (options.viewerRole === 'spectator') {
    params.set('viewerRole', 'spectator');
    params.set('spectatorId', options.spectatorId);
    params.set('spectatorToken', options.spectatorToken);
  } else {
    params.set('seatKey', options.seatKey);
    params.set('seatToken', options.seatToken);
  }
  const response = await fetch(`${options.serverUrl}/api/match/presentation-journal?${params.toString()}`);
  return response.json();
}
```

On restore/reconnect, call it when `canonicalStateVersion > lastVisualVersion`.

- [ ] **Step 5: Initialize visual baseline before replay**

When journal recovery returns:

```ts
visualStateStore.setBaseVisualSnapshot(payload.baseSnapshot, {
  visualSeq: payload.baseVisualSeq,
  visualVersion: payload.baseSnapshot && payload.baseSnapshot.stateVersion
});
timeline.enqueueFrames(payload.presentationFrames, { source: 'journal_recovery' });
await timeline.drainPlayableFrames(playbackDispatcher);
```

Do not unlock input until `timeline.getDiagnostics().visualVersion >= canonicalStateVersion`.

- [ ] **Step 6: Run reconnect tests**

Run:

```powershell
npx jest test/ui.network-client.visual-catchup.test.ts test/ui.network-session-lifecycle.test.ts test/ui.network-client.reconnect-sync.test.ts --runInBand
npm run typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add ui/network/session-seat.ts ui/network/session-lifecycle.ts ui/network/reconnect-controller.ts ui/network/presentation-timeline.ts test/ui.network-client.visual-catchup.test.ts test/ui.network-session-lifecycle.test.ts
git commit -m "Recover network visual timeline on reconnect"
```

---

### Task 11: Validate Playback Events Are Self-Contained Enough For Network Replay

**Files:**
- Create: `shared/playback-event-contract.ts`
- Modify: `shared/playback-event-helpers.ts`
- Test: `test/shared.playback-event-contract.test.ts`
- Test: existing playback event tests touched by failures

- [ ] **Step 1: Write validation tests**

Create `test/shared.playback-event-contract.test.ts`:

```ts
const Contract = require('../shared/playback-event-contract');

describe('playback event replay contract', () => {
  test('accepts board-target events with explicit target coordinates and owner', () => {
    expect(Contract.validatePlaybackEventsForNetworkReplay([
      { type: 'flip', phase: 2, targets: [{ r: 3, col: 4, owner: 'black' }] },
      { type: 'destroy', phase: 3, targets: [{ r: 2, col: 2, owner: 'white', cause: 'SNIPER_WILL' }] }
    ])).toEqual([]);
  });

  test('reports target events missing coordinates', () => {
    const errors = Contract.validatePlaybackEventsForNetworkReplay([
      { type: 'flip', phase: 2, targets: [{ owner: 'black' }] }
    ]);
    expect(errors).toEqual([expect.objectContaining({ code: 'target_coordinates_required' })]);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npx jest test/shared.playback-event-contract.test.ts --runInBand
```

Expected: FAIL because validator does not exist.

- [ ] **Step 3: Implement validator**

Create `shared/playback-event-contract.ts`:

```ts
const BOARD_TARGET_EVENT_TYPES = new Set(['flip', 'destroy', 'move', 'spawn', 'status_change', 'place_hand_animation']);

function validatePlaybackEventsForNetworkReplay(events: unknown[]): any[] {
  const errors: any[] = [];
  const list = Array.isArray(events) ? events : [];
  list.forEach((event: any, eventIndex: number) => {
    if (!event || typeof event !== 'object') {
      errors.push({ code: 'event_object_required', eventIndex });
      return;
    }
    const type = String(event.type || '').trim();
    if (!type) errors.push({ code: 'event_type_required', eventIndex });
    if (!Number.isFinite(Number(event.phase))) errors.push({ code: 'event_phase_required', eventIndex, type });
    if (!BOARD_TARGET_EVENT_TYPES.has(type)) return;
    const targets = Array.isArray(event.targets) ? event.targets : [];
    targets.forEach((target: any, targetIndex: number) => {
      const row = Number.isFinite(Number(target && (target.r ?? target.row))) ? Number(target.r ?? target.row) : null;
      const col = Number.isFinite(Number(target && target.col)) ? Number(target.col) : null;
      if (row === null || col === null) {
        errors.push({ code: 'target_coordinates_required', eventIndex, targetIndex, type });
      }
      const owner = target && (target.owner || target.player);
      if (owner !== 'black' && owner !== 'white' && owner !== 1 && owner !== -1) {
        errors.push({ code: 'target_owner_required', eventIndex, targetIndex, type });
      }
    });
  });
  return errors;
}

export = {
  validatePlaybackEventsForNetworkReplay
};
```

- [ ] **Step 4: Report validation errors without blocking non-network modes**

In `shared/playback-event-helpers.ts`, after assembling server playback events, call the validator when available. Add warnings into existing diagnostics:

```ts
const replayContractErrors = PlaybackEventContract.validatePlaybackEventsForNetworkReplay(playbackEvents);
if (replayContractErrors.length > 0) {
  diagnostics.warnings.push(`network_replay_contract:${JSON.stringify(replayContractErrors)}`);
}
```

Do not reject gameplay in this task. This task reveals gaps without changing card resolution.

- [ ] **Step 5: Run playback tests**

Run:

```powershell
npx jest test/shared.playback-event-contract.test.ts test/game.pipeline-ui-adapter.spawn.test.ts test/game.pipeline-ui-adapter.sound-cue.test.ts --runInBand
npm run typecheck
```

Expected: all pass. If diagnostics expose missing target metadata in existing tests, fix the playback event assembly at the source that creates the incomplete event.

- [ ] **Step 6: Commit**

Run:

```powershell
git add shared/playback-event-contract.ts shared/playback-event-helpers.ts test/shared.playback-event-contract.test.ts
git commit -m "Validate playback events for network replay"
```

---

### Task 12: Change Watchdog Semantics For Strict Network Playback

**Files:**
- Modify: `ui/animation-engine.ts`
- Modify: `ui/playback-state-manager.ts`
- Modify: `ui/network/presentation-timeline.ts`
- Test: `test/ui.animation-engine.strict-network.test.ts`
- Test: `test/ui.network-presentation-timeline.test.ts`

- [ ] **Step 1: Write strict watchdog test**

Create `test/ui.animation-engine.strict-network.test.ts`:

```ts
describe('AnimationEngine strict network playback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('watchdog rejects strict network playback instead of reporting successful sync', async () => {
    const AnimationEngine = require('../ui/animation-engine');
    const playPromise = AnimationEngine.play([
      { type: 'test_never_resolves', phase: 1, strictNetworkPlayback: true }
    ], { strictNetworkPlayback: true });

    jest.advanceTimersByTime(60000);
    await expect(playPromise).rejects.toThrow(/network_playback_watchdog/);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npx jest test/ui.animation-engine.strict-network.test.ts --runInBand
```

Expected: FAIL because watchdog currently aborts and syncs.

- [ ] **Step 3: Add strict mode to animation engine**

In `ui/animation-engine.ts`, thread `strictNetworkPlayback` from `play(events, options)` into watchdog handling:

```ts
if (playbackScope.strictNetworkPlayback === true) {
  const error = new Error('network_playback_watchdog');
  error.name = 'NetworkPlaybackWatchdogError';
  rejectPlayback(error);
  return;
}
```

Keep the existing abort-and-sync behavior for local and legacy non-strict network playback.

- [ ] **Step 4: Pause timeline on strict playback failure**

In `ui/network/presentation-timeline.ts`, wrap dispatcher playback:

```ts
try {
  await dispatcher.dispatchNetworkPlaybackEvents(frame.playbackEvents, {
    source: 'network_timeline',
    visualSeq: frame.visualSeq,
    strictNetworkPlayback: true
  });
} catch (error) {
  pausedError = {
    visualSeq: frame.visualSeq,
    message: error && error.message ? error.message : String(error)
  };
  break;
}
```

Diagnostics must include:

```ts
{ paused: true, pausedError }
```

- [ ] **Step 5: Keep input locked while paused**

In `ui/playback-state-manager.ts`, expose timeline paused state to the existing busy check:

```ts
if (NetworkPresentationTimeline && NetworkPresentationTimeline.getDiagnostics().paused === true) {
  return true;
}
```

Use dependency lookup matching existing global/module patterns.

- [ ] **Step 6: Run tests**

Run:

```powershell
npx jest test/ui.animation-engine.strict-network.test.ts test/ui.network-presentation-timeline.test.ts --runInBand
npm run typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add ui/animation-engine.ts ui/playback-state-manager.ts ui/network/presentation-timeline.ts test/ui.animation-engine.strict-network.test.ts
git commit -m "Make strict network watchdog pause timeline"
```

---

### Task 13: End-To-End Network Parity And Browser Verification

**Files:**
- Modify generated/mirror output only through existing scripts:
  - `worker-public/*`
  - `public/module-registry.js`
- Test/verification artifacts:
  - Playwright screenshots or live check output under a new `tmp-*` directory if needed

- [ ] **Step 1: Run focused network and playback tests**

Run:

```powershell
npx jest test/shared.network-presentation-frame.test.ts test/utils.match-authority.presentation-journal.test.ts test/workers.match-presentation-journal.test.ts test/ui.network-presentation-timeline.test.ts test/ui.network-client.visual-catchup.test.ts test/ui.network-visual-state-store.test.ts test/ui.board-renderer.visual-state.test.ts test/ui.animation-engine.strict-network.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run network parity**

Run:

```powershell
npm run test:network:parity
```

Expected: PASS.

- [ ] **Step 3: Run broad build checks**

Run:

```powershell
npm run build:ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Prepare Worker assets**

Run:

```powershell
npm run worker:prepare
```

Expected: generated mirror output changes only from the source changes in this plan.

- [ ] **Step 5: Run two-browser live network check**

Use the existing live network verification workflow for this repo. The scenario must include:

1. Create room as black.
2. Join as white in a second independent browser.
3. Execute at least one normal placement.
4. Execute at least one card action that produces multiple playback events.
5. Force reconnect on one browser.
6. Confirm `visualSeq` catch-up occurs without skipped frames.
7. Confirm input remains locked while catch-up frames are pending.

Expected console diagnostics:

```text
NetworkPresentationTimeline visualSeq advances contiguously
paused=false
pendingFrameCount=0 after catch-up
```

- [ ] **Step 6: Inspect final diff**

Run:

```powershell
git status --short
git diff --stat
git diff --check
```

Expected: no whitespace errors; generated/mirror files are explainable by `npm run worker:prepare`.

- [ ] **Step 7: Commit final generated/mirror sync**

Run:

```powershell
git add public/module-registry.js worker-public/index.html worker-public/public/module-registry.js
git commit -m "Prepare worker assets for network visual timeline"
```

Commit only files generated by `npm run worker:prepare`. Do not include unrelated dirty files.

---

## Rollback Approach

Rollback is split by layer:

- Specs: revert the spec commit if the product decision changes away from strict local-equivalent playback.
- Server journal: disable `presentationFrames` in payloads while keeping snapshots authoritative.
- Client timeline: fall back to legacy `playbackEvents` path only for payloads without `presentationFrames`.
- Visual state store: renderer resolver falls back to global `gameState/cardState` when the store is absent.
- Strict watchdog: strict mode is opt-in through timeline dispatch; legacy local playback remains unchanged.

Do not remove server authority or let client visual state become gameplay authority during rollback.

## Risk Classification

Risk level: high.

Reasons:

- Changes network response shape by adding fields.
- Adds persisted room journal state.
- Changes reconnect semantics.
- Changes board rendering state source during network playback.
- Changes watchdog behavior for strict network playback.

Risk controls:

- Add characterization and unit tests before each production change.
- Keep legacy `playbackEvents` handling until `presentationFrames` is available everywhere.
- Use shared authority helpers for Worker and local server.
- Keep `worker-public/` and generated registry updates in the final generated sync task only.
- Preserve server authority and projection-safe hidden-card behavior.

## First Safe Implementation Pass

The first safe pass is Task 1 plus Task 2:

1. Document the intended strict network playback contract.
2. Add the shared frame normalizer and tests.

Those two tasks do not change runtime behavior. They create the contract needed before journal persistence, client timeline ownership, and board-renderer state separation.

## Required Validation Summary

- Shared frame contract: `npx jest test/shared.network-presentation-frame.test.ts --runInBand`
- Journal helpers: `npx jest test/utils.match-authority.presentation-journal.test.ts --runInBand`
- Worker/local journal: `npx jest test/workers.match-presentation-journal.test.ts test/local-match-server.presentation-journal.test.ts --runInBand`
- Client timeline: `npx jest test/ui.network-presentation-timeline.test.ts test/ui.network-client.visual-catchup.test.ts --runInBand`
- Visual renderer: `npx jest test/ui.network-visual-state-store.test.ts test/ui.board-renderer.visual-state.test.ts --runInBand`
- Strict watchdog: `npx jest test/ui.animation-engine.strict-network.test.ts --runInBand`
- Network contracts: `npm run test:network:parity`
- Build checks: `npm run build:ts` and `npm run typecheck`
- Worker mirror: `npm run worker:prepare`

## Execution Notes

- Implement in the listed order. Later tasks assume earlier tests and contracts exist.
- Commit after each task when validation passes.
- Do not edit `worker-public/` directly.
- Do not use client visual state to validate moves, resolve cards, decide random outcomes, or publish canonical state.
- If a task exposes unrelated dirty files, keep them out of the commit and report them before proceeding.
