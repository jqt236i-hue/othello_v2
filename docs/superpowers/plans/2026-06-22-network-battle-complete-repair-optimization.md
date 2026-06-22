# Network Battle Complete Repair and Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ネット対戦モードを、同期・描画・演出再生・再接続・起動負荷の全てで安定した server-authoritative runtime に作り直し、公開環境で 2 クライアント対戦が軽く、二重演出や盤面ジャンプなしに動く状態へ持っていく。

**Architecture:** サーバー snapshot は canonical state の唯一の正本、presentation frame は `visualSeq` 順の唯一の演出正本、board DOM は Single Visual Writer 経由だけで更新する。POST response、SSE、state sync、presentation journal は全て同じ client intake pipeline に正規化し、直接 `renderBoard` / `renderBoardFull` / `flushVisualUpdates` を呼ばない。起動は network mode に必要な最小 module set と、CPU / ONNX / gacha / commentary の遅延 load に分割する。

**Tech Stack:** TypeScript, browser CommonJS compatibility runtime, Cloudflare Workers, local match server, Jest, Playwright browser checks, existing `npm run build:browser`, `npm run test:network:parity`, `npm run worker:prepare`, and live Chrome/Edge network verification.

---

## Document Role

This is an active master implementation plan for network battle repair and optimization.

Source of truth:

- Gameplay and player-visible card behavior: `01-rulebook.md`
- Architecture boundary: `docs/architecture-contracts.md`
- Root source: `ui/`, `workers/`, `utils/`, `shared/`, `scripts/`
- Generated / mirrored surfaces: `dist/`, `public/module-registry.js`, `worker-public/`

Non-goals:

- Do not change card rules, card costs, or player-visible card text.
- Do not source-edit `dist/`, `public/module-registry.js`, or `worker-public/`.
- Do not patch individual cards as a substitute for fixing the network/presentation boundary.
- Do not make client-authored preview state authoritative.

## Confirmed Evidence To Preserve

Current investigation showed these facts on 2026-06-22:

- `public/module-registry.js` is about 7.5 MB and matches the lightweight package byte-for-byte.
- `entry-browser.js` eagerly boots 224 module entries and 47 namespace require calls.
- `index.html` loads `node_modules/onnxruntime-web/dist/ort.min.js` for all modes.
- `ui/network-client.ts` is about 3,849 lines and still mixes transport, snapshot intake, playback, reconnect, rendering fallback, and telemetry.
- `ui/network-client.ts::requestNetworkTimelineBoardRefresh()` can call `emitBoardUpdate`, `RenderScheduler.requestBoardRender`, `flushVisualUpdates`, direct `renderBoard`, direct `renderBoardFull`, and post-playback refresh from one timeline commit.
- `ui/network/publish-flow.ts`, `ui/network/stream-snapshot.ts`, `ui/network/session-lifecycle.ts`, and presentation journal recovery can all deliver the same authoritative transition.
- `cards/card-interaction-pending-settlement.ts` uses a 1,500 ms pending-selection publish settlement timeout and can clear `PLAYBACK_EVENTS` queues.
- Source and generated surfaces can drift. At investigation time `utils/match-authority.ts` had `SSE_RESUME_BUFFER_LIMIT = 8` and `PRESENTATION_JOURNAL_LIMIT = 8`, while generated browser surfaces still contained the older `SSE_RESUME_BUFFER_LIMIT = 96` and no presentation journal cap.

## Target Runtime Contract

### State Lanes

- Canonical lane: latest accepted server snapshot. Used for authority, input legality, result state, reconnect truth, and version comparisons.
- Visual lane: render-facing state. Advanced only when contiguous presentation frames finish playback.
- Transport lane: SSE / POST / state sync / journal payloads. Never writes board DOM directly.
- Settlement lane: local busy flags, playback locks, pending selection locks. Never becomes gameplay authority.

### Network Intake

All inbound payloads must become a single internal envelope:

```ts
type NetworkIntakeSource = 'publish_response' | 'stream' | 'state_sync' | 'presentation_journal' | 'heartbeat_recovery';

interface NetworkSnapshotEnvelope {
  source: NetworkIntakeSource;
  operationId: string | null;
  stateVersion: number | null;
  visualSeq: number | null;
  snapshot: unknown | null;
  presentationFrames: unknown[];
  playbackEvents: unknown[];
  presentationCursor: { visualSeq: number; stateVersion: number } | null;
  force: boolean;
  skipResultOverlay: boolean;
  receivedAt: number;
}
```

Only the intake coordinator may decide:

- whether the canonical snapshot is newer, duplicate, or stale
- whether presentation frames should enter `ui/network/presentation-timeline.ts`
- whether playback events are strict, shadow, suppressed, or recovery-only
- whether board DOM sync is queued after playback idle

### Board DOM Writes

During playback active / claimed / pending:

- allowed: animation/presentation writer mutating temporary visual DOM
- allowed: canonical state update in JS memory
- allowed: non-board UI refresh if it does not mutate board cells
- forbidden: network path direct `renderBoard`
- forbidden: network path direct `renderBoardFull`
- forbidden: network path board `flushVisualUpdates` while playback deferral is true

### Publish Contract

Short-term target:

- POST response and SSE may both carry state for compatibility.
- Both must pass through the same intake coordinator.
- Duplicate `operationId` / `stateVersion` / `visualSeq` must be idempotent.
- The first accepted source may update canonical state, but only presentation timeline may request board visual advancement.

Final optimized target:

- POST response becomes ack-first: `ok`, `operationId`, `stateVersion`, `presentationCursor`, rejection details, and minimal recovery data.
- Full visual transition arrives through SSE or journal catch-up.
- If SSE is unavailable, explicit state sync recovery uses the same envelope path and marks itself as recovery.

## File Map

Generated-surface integrity:

- Create `scripts/check-generated-network-surface.ts`: verifies source, dist, browser registry, and worker-public mirror contain the same network authority constants and public API markers.
- Create `test/scripts.check-generated-network-surface.test.ts`: unit tests the checker against fixture strings.
- Modify `package.json`: add `check:generated-network-surface`.
- Generated by command only: `dist/`, `public/module-registry.js`, `worker-public/`.

Network intake and telemetry:

- Create `ui/network/intake-envelope.ts`: normalizes POST/SSE/state/journal payloads into `NetworkSnapshotEnvelope`.
- Create `ui/network/intake-coordinator.ts`: owns dedupe, canonical apply decision, presentation frame enqueue, playback recovery classification, and board-refresh scheduling.
- Create `ui/network/debug-trace.ts`: small ring buffer and structured console telemetry for `source`, `operationId`, `stateVersion`, `visualSeq`, and board writer.
- Modify `ui/network/publish-flow.ts`: convert publish response to envelope submission.
- Modify `ui/network/stream-snapshot.ts`: convert stream snapshot to envelope submission.
- Modify `ui/network/session-lifecycle.ts`: convert state sync and journal catch-up to envelope submission.
- Modify `ui/network-client.ts`: reduce to facade/wiring and remove direct board writer fallback from network timeline.

Rendering / playback:

- Modify `ui/network/presentation-timeline.ts`: emit visual commit events only after contiguous frame playback or explicit no-playback visual cursor sync.
- Modify `ui/network/visual-state-store.ts`: provide render-facing state for board renderer without reading transport source details.
- Modify `ui/render-scheduler.ts`: keep board queue deferral strict during playback.
- Modify `ui/network/snapshot.ts`: canonical apply only; no direct board DOM writer choice.
- Modify `cards/card-interaction-pending-settlement.ts`: replace normal 1,500 ms forced cleanup with `visualSeq`-scoped completion / abort settlement.
- Modify `ui/playback-state-manager.ts`: own pending network visual settlement locks and explicit abort reasons.

Reconnect:

- Create or expand `ui/network/reconnect-controller.ts`: make heartbeat resync, stream watchdog, reconnect recovery sync, and journal catch-up a single state machine.
- Modify `ui/network/stream-session.ts`: expose stream activity and last event id only through reconnect controller callbacks.

Boot optimization:

- Modify `scripts/build-module-registry.ts`: emit required/optional/lazy boot metadata and split browser registry output so startup does not parse/register optional CPU/ONNX/gacha/commentary module bodies.
- Modify `entry-browser.js`: load only required startup modules first; load optional CPU/ONNX/gacha/commentary modules on demand after their registry chunk is loaded.
- Modify `index.html`: load only the required startup registry; stop loading `onnxruntime-web` eagerly; use lazy loader from CPU policy path.
- Create `ui/bootstrap/lazy-runtime-loader.ts`: central browser loader for optional module groups.

Documentation:

- Modify `docs/architecture-contracts.md` if a stable new contract emerges during implementation.
- Update this plan with execution results as phases complete.

## Phase 0: Dirty Tree Gate And Baseline Snapshot

Goal: prevent source/generated drift and unrelated working-tree changes from hiding network fixes.

### Task 0.1: Classify Current Worktree

**Files:**

- Read: repository working tree
- Modify: none

- [ ] Run:

```powershell
git status --short
```

Expected now: unrelated dirty files may exist, including animation/layout/generated surfaces. Do not overwrite them.

- [ ] For each dirty file that will be touched by a planned task, inspect:

```powershell
git diff -- ui/network-client.ts
git diff -- public/module-registry.js
git diff -- worker-public/public/module-registry.js
```

Expected: if a target file has unrelated edits, stop and either isolate the task or ask for direction.

- [ ] Commit only the plan if no implementation has started:

```powershell
git add docs/superpowers/plans/2026-06-22-network-battle-complete-repair-optimization.md
git commit -m "Document network battle repair plan"
```

### Task 0.2: Capture Baseline Metrics

**Files:**

- Create: `docs/network-repair-baseline-2026-06-22.md`
- Modify: none initially

- [ ] Run:

```powershell
$files = @(
  'ui/network-client.ts',
  'ui/network/publish-flow.ts',
  'ui/network/stream-snapshot.ts',
  'ui/network/session-lifecycle.ts',
  'ui/network/snapshot.ts',
  'ui/render-scheduler.ts',
  'cards/card-interaction-pending-settlement.ts',
  'utils/match-authority.ts',
  'public/module-registry.js',
  'worker-public/public/module-registry.js'
)
foreach ($f in $files) {
  $text = Get-Content $f -Raw
  $lines = ($text -split "`n").Count
  $catch = [regex]::Matches($text, 'catch\s*\(').Count
  $render = [regex]::Matches($text, 'renderBoard|renderBoardFull|requestBoardRender|flushVisualUpdates|emitBoardUpdate').Count
  "{0}`tlines={1}`tcatch={2}`trenderRefs={3}" -f $f,$lines,$catch,$render
}
```

Expected: save exact counts in the baseline document.

- [ ] Run:

```powershell
$paths=@('utils/match-authority.ts','dist/utils/match-authority.js','public/module-registry.js','worker-public/public/module-registry.js')
foreach($p in $paths){
  if(Test-Path $p){
    $text=Get-Content $p -Raw
    $sse=[regex]::Match($text,'SSE_RESUME_BUFFER_LIMIT\s*=\s*(\d+)')
    $journal=[regex]::Match($text,'PRESENTATION_JOURNAL_LIMIT\s*=\s*(\d+)')
    $base=$text.Contains('presentationJournalBaseVisualSeq')
    "{0}`tSSE={1}`tJournal={2}`tHasBase={3}" -f $p, $(if($sse.Success){$sse.Groups[1].Value}else{'none'}), $(if($journal.Success){$journal.Groups[1].Value}else{'none'}), $base
  }
}
```

Expected: any mismatch blocks deploy until Phase 1 completes.

## Phase 1: Generated Surface Integrity

Goal: source, dist, browser registry, and worker-public must not drift silently again.

### Task 1.1: Add Generated Network Surface Checker

**Files:**

- Create: `scripts/check-generated-network-surface.ts`
- Create: `test/scripts.check-generated-network-surface.test.ts`
- Modify: `package.json`

- [ ] Write the failing test in `test/scripts.check-generated-network-surface.test.ts`:

```ts
import {
  collectNetworkSurfaceMarkersFromText,
  compareNetworkSurfaceMarkers
} from '../scripts/check-generated-network-surface';

test('detects stale generated network surface markers', () => {
  const source = collectNetworkSurfaceMarkersFromText(`
    const SSE_RESUME_BUFFER_LIMIT = 8;
    const PRESENTATION_JOURNAL_LIMIT = 8;
    room.presentationJournalBaseVisualSeq = 1;
    room.presentationJournalBaseSnapshotByViewer = {};
  `);
  const stale = collectNetworkSurfaceMarkersFromText(`
    const SSE_RESUME_BUFFER_LIMIT = 96;
  `);
  expect(compareNetworkSurfaceMarkers({ source, generated: stale })).toEqual([
    'SSE_RESUME_BUFFER_LIMIT mismatch: source=8 generated=96',
    'PRESENTATION_JOURNAL_LIMIT missing from generated',
    'presentationJournalBaseVisualSeq missing from generated',
    'presentationJournalBaseSnapshotByViewer missing from generated'
  ]);
});
```

- [ ] Run the test and confirm it fails because the module does not exist:

```powershell
npx jest --runInBand test/scripts.check-generated-network-surface.test.ts
```

Expected: FAIL with module not found.

- [ ] Implement `scripts/check-generated-network-surface.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';

export interface NetworkSurfaceMarkers {
  sseResumeBufferLimit: string | null;
  presentationJournalLimit: string | null;
  hasPresentationJournalBaseVisualSeq: boolean;
  hasPresentationJournalBaseSnapshotByViewer: boolean;
}

function matchConstant(text: string, name: string): string | null {
  const direct = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(text);
  return direct ? direct[1] : null;
}

export function collectNetworkSurfaceMarkersFromText(text: string): NetworkSurfaceMarkers {
  return {
    sseResumeBufferLimit: matchConstant(text, 'SSE_RESUME_BUFFER_LIMIT'),
    presentationJournalLimit: matchConstant(text, 'PRESENTATION_JOURNAL_LIMIT'),
    hasPresentationJournalBaseVisualSeq: text.includes('presentationJournalBaseVisualSeq'),
    hasPresentationJournalBaseSnapshotByViewer: text.includes('presentationJournalBaseSnapshotByViewer')
  };
}

export function compareNetworkSurfaceMarkers(input: {
  source: NetworkSurfaceMarkers;
  generated: NetworkSurfaceMarkers;
}): string[] {
  const errors: string[] = [];
  const { source, generated } = input;
  if (source.sseResumeBufferLimit !== generated.sseResumeBufferLimit) {
    errors.push(`SSE_RESUME_BUFFER_LIMIT mismatch: source=${source.sseResumeBufferLimit ?? 'missing'} generated=${generated.sseResumeBufferLimit ?? 'missing'}`);
  }
  if (source.presentationJournalLimit && !generated.presentationJournalLimit) {
    errors.push('PRESENTATION_JOURNAL_LIMIT missing from generated');
  } else if (source.presentationJournalLimit !== generated.presentationJournalLimit) {
    errors.push(`PRESENTATION_JOURNAL_LIMIT mismatch: source=${source.presentationJournalLimit ?? 'missing'} generated=${generated.presentationJournalLimit ?? 'missing'}`);
  }
  if (source.hasPresentationJournalBaseVisualSeq && !generated.hasPresentationJournalBaseVisualSeq) {
    errors.push('presentationJournalBaseVisualSeq missing from generated');
  }
  if (source.hasPresentationJournalBaseSnapshotByViewer && !generated.hasPresentationJournalBaseSnapshotByViewer) {
    errors.push('presentationJournalBaseSnapshotByViewer missing from generated');
  }
  return errors;
}

function readMarkers(rootDir: string, relativePath: string): NetworkSurfaceMarkers {
  const fullPath = path.join(rootDir, relativePath);
  return collectNetworkSurfaceMarkersFromText(fs.readFileSync(fullPath, 'utf8'));
}

export function checkGeneratedNetworkSurface(rootDir = process.cwd()): string[] {
  const source = readMarkers(rootDir, 'utils/match-authority.ts');
  const generatedPaths = [
    'dist/utils/match-authority.js',
    'public/module-registry.js',
    'worker-public/public/module-registry.js'
  ];
  return generatedPaths.flatMap((relativePath) => {
    const fullPath = path.join(rootDir, relativePath);
    if (!fs.existsSync(fullPath)) return [`${relativePath} missing`];
    return compareNetworkSurfaceMarkers({
      source,
      generated: readMarkers(rootDir, relativePath)
    }).map((message) => `${relativePath}: ${message}`);
  });
}

if (require.main === module) {
  const errors = checkGeneratedNetworkSurface(process.cwd());
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log('generated network surface is in sync');
}
```

- [ ] Add package script:

```json
"check:generated-network-surface": "npm run build:ts && node dist/scripts/check-generated-network-surface.js"
```

- [ ] Run:

```powershell
npx jest --runInBand test/scripts.check-generated-network-surface.test.ts
npm run check:generated-network-surface
```

Expected before regeneration: checker fails on stale generated surfaces.

### Task 1.2: Regenerate And Mirror

**Files:**

- Generated: `dist/`
- Generated: `public/module-registry.js`
- Generated mirror: `worker-public/`

- [ ] Run:

```powershell
npm run build:browser
npm run worker:prepare
npm run check:generated-network-surface
```

Expected:

- `check:generated-network-surface` passes.
- `public/module-registry.js` contains `SSE_RESUME_BUFFER_LIMIT = 8`.
- `public/module-registry.js` contains `PRESENTATION_JOURNAL_LIMIT = 8`.
- `worker-public/public/module-registry.js` contains the same markers.

- [ ] Inspect generated diffs:

```powershell
git diff --stat -- public/module-registry.js worker-public/public/module-registry.js worker-public
git diff -- public/module-registry.js worker-public/public/module-registry.js | Select-String -Pattern "SSE_RESUME_BUFFER_LIMIT|PRESENTATION_JOURNAL_LIMIT|presentationJournalBaseVisualSeq"
```

Expected: only generated/mirror consequences of source changes are present. Do not hand-edit generated files.

- [ ] Stage only files proven to be generated by this task. Do not use `git add worker-public`.

```powershell
git status --short
git diff --name-only -- public/module-registry.js worker-public
git add scripts/check-generated-network-surface.ts test/scripts.check-generated-network-surface.test.ts package.json public/module-registry.js worker-public/public/module-registry.js
git diff --cached --name-only
git commit -m "Verify generated network surfaces"
```

Expected staged files: the checker, its test, `package.json`, `public/module-registry.js`, and the intentionally regenerated worker-public registry. If `worker-public/index.html` changes only because `sync-browser-script-versions` updated script query strings, stage it explicitly after inspecting that diff. Do not stage unrelated worker-public CSS/layout files.

## Phase 2: Structured Network Trace

Goal: every state apply and board-write request is attributable by source, operation, state version, and visual sequence.

### Task 2.1: Add Network Debug Trace Ring Buffer

**Files:**

- Create: `ui/network/debug-trace.ts`
- Create: `test/ui.network-debug-trace.test.ts`

- [ ] Write failing tests:

```ts
import { createNetworkDebugTrace } from '../ui/network/debug-trace';

test('keeps latest trace entries with stable fields', () => {
  const trace = createNetworkDebugTrace({ limit: 2, now: () => 1000 });
  trace.record('snapshot_apply', {
    source: 'stream',
    operationId: 'op_1',
    stateVersion: 4,
    visualSeq: 3,
    boardWriter: 'none'
  });
  trace.record('board_request', {
    source: 'network_timeline',
    operationId: 'op_1',
    stateVersion: 4,
    visualSeq: 3,
    boardWriter: 'render_scheduler'
  });
  trace.record('board_request', {
    source: 'state_sync',
    operationId: null,
    stateVersion: 5,
    visualSeq: 4,
    boardWriter: 'deferred'
  });
  expect(trace.entries()).toHaveLength(2);
  expect(trace.entries()[0]).toMatchObject({ type: 'board_request', source: 'network_timeline' });
  expect(trace.entries()[1]).toMatchObject({ type: 'board_request', source: 'state_sync' });
});
```

- [ ] Implement:

```ts
export interface NetworkDebugTraceEntry {
  type: string;
  source: string;
  operationId: string | null;
  stateVersion: number | null;
  visualSeq: number | null;
  boardWriter: string | null;
  timestamp: number;
  details?: Record<string, unknown>;
}

export function createNetworkDebugTrace(options?: { limit?: number; now?: () => number }) {
  const limit = Math.max(1, Math.trunc(Number(options?.limit || 200)));
  const now = typeof options?.now === 'function' ? options.now : () => Date.now();
  const buffer: NetworkDebugTraceEntry[] = [];

  function normalizeNumber(value: unknown): number | null {
    return Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null;
  }

  function record(type: string, input: Partial<NetworkDebugTraceEntry> & { details?: Record<string, unknown> }) {
    buffer.push({
      type: String(type || 'unknown'),
      source: String(input.source || 'unknown'),
      operationId: input.operationId ? String(input.operationId) : null,
      stateVersion: normalizeNumber(input.stateVersion),
      visualSeq: normalizeNumber(input.visualSeq),
      boardWriter: input.boardWriter ? String(input.boardWriter) : null,
      timestamp: now(),
      details: input.details && typeof input.details === 'object' ? input.details : undefined
    });
    if (buffer.length > limit) buffer.splice(0, buffer.length - limit);
  }

  return {
    record,
    entries: () => buffer.slice(),
    clear: () => { buffer.length = 0; }
  };
}
```

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-debug-trace.test.ts
```

Expected: PASS.

### Task 2.2: Wire Trace Into Existing Telemetry

**Files:**

- Modify: `ui/network-client.ts`
- Modify: `ui/network/publish-flow.ts`
- Modify: `ui/network/stream-snapshot.ts`
- Modify: `ui/network/session-lifecycle.ts`
- Modify: `ui/network/snapshot.ts`

- [ ] Add trace dependency wiring to network client facade:

```ts
const NetworkDebugTraceModule = resolveNetworkClientCandidate(() => _require('./network/debug-trace'));
const networkDebugTrace = NetworkDebugTraceModule && typeof NetworkDebugTraceModule.createNetworkDebugTrace === 'function'
  ? NetworkDebugTraceModule.createNetworkDebugTrace({ limit: 250 })
  : null;

function recordNetworkTrace(type: string, details: any) {
  if (networkDebugTrace && typeof networkDebugTrace.record === 'function') {
    networkDebugTrace.record(type, details || {});
  }
  recordNetworkTelemetry(type, details);
}
```

- [ ] Replace high-value apply and board request telemetry calls with `recordNetworkTrace`.

- [ ] Expose debug-only accessor:

```ts
try {
  root.__networkDebugTrace = {
    entries: () => networkDebugTrace ? networkDebugTrace.entries() : [],
    clear: () => networkDebugTrace ? networkDebugTrace.clear() : undefined
  };
} catch (e: any) { /* ignore */ }
```

- [ ] Add or update tests so publish response and stream snapshot record distinct source values.

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-client.apply-coordinator.test.ts test/ui.network-client.reconnect-sync.test.ts
```

Expected: PASS, with no changed gameplay behavior.

## Phase 3: Single Network Intake Pipeline

Goal: POST response, SSE, state sync, and presentation journal all go through one envelope coordinator.

### Task 3.1: Add Envelope Normalizer

**Files:**

- Create: `ui/network/intake-envelope.ts`
- Create: `test/ui.network-intake-envelope.test.ts`

- [ ] Write tests:

```ts
import { normalizeNetworkSnapshotEnvelope } from '../ui/network/intake-envelope';

test('normalizes publish response envelope', () => {
  const envelope = normalizeNetworkSnapshotEnvelope({
    source: 'publish_response',
    payload: {
      operationId: 'op_1',
      stateVersion: 7,
      snapshot: { stateVersion: 7 },
      presentationCursor: { visualSeq: 6, stateVersion: 7 },
      presentationFrames: [{ visualSeq: 6, stateVersionFrom: 6, stateVersionTo: 7 }]
    },
    force: true
  });
  expect(envelope).toMatchObject({
    source: 'publish_response',
    operationId: 'op_1',
    stateVersion: 7,
    visualSeq: 6,
    force: true
  });
  expect(envelope.presentationFrames).toHaveLength(1);
});

test('uses snapshot version when payload stateVersion is missing', () => {
  const envelope = normalizeNetworkSnapshotEnvelope({
    source: 'stream',
    payload: { snapshot: { stateVersion: 9 } }
  });
  expect(envelope.stateVersion).toBe(9);
});
```

- [ ] Implement the normalizer using the `NetworkSnapshotEnvelope` shape from this plan.

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-intake-envelope.test.ts
```

Expected: PASS.

### Task 3.2: Add Intake Coordinator

**Files:**

- Create: `ui/network/intake-coordinator.ts`
- Create: `test/ui.network-intake-coordinator.test.ts`
- Modify: `ui/network/apply-coordinator.ts` only if existing functions can be reused instead of duplicated.

- [ ] Write tests:

```ts
import { createNetworkIntakeCoordinator } from '../ui/network/intake-coordinator';

test('dedupes same visualSeq from publish response and stream', () => {
  const applied: string[] = [];
  const enqueued: number[] = [];
  const coordinator = createNetworkIntakeCoordinator({
    getAppliedStateVersion: () => null,
    applyCanonicalSnapshot: (_snapshot, meta) => {
      applied.push(meta.source);
      return true;
    },
    enqueuePresentationFrames: (frames) => {
      enqueued.push(...frames.map((frame: any) => frame.visualSeq));
      return frames.length;
    },
    requestBoardRefresh: () => true,
    recordTrace: () => undefined
  });

  const frame = { visualSeq: 3, stateVersionFrom: 2, stateVersionTo: 3, operationId: 'op_1' };
  coordinator.submit({ source: 'publish_response', operationId: 'op_1', stateVersion: 3, visualSeq: 3, snapshot: { stateVersion: 3 }, presentationFrames: [frame], playbackEvents: [], presentationCursor: null, force: true, skipResultOverlay: false, receivedAt: 1 });
  coordinator.submit({ source: 'stream', operationId: 'op_1', stateVersion: 3, visualSeq: 3, snapshot: { stateVersion: 3 }, presentationFrames: [frame], playbackEvents: [], presentationCursor: null, force: false, skipResultOverlay: false, receivedAt: 2 });

  expect(applied).toEqual(['publish_response']);
  expect(enqueued).toEqual([3]);
});
```

- [ ] Implement coordinator state:

```ts
interface SeenTransition {
  operationId: string | null;
  stateVersion: number | null;
  visualSeq: number | null;
}

const seenByVisualSeq = new Set<number>();
const seenByOperationAndVersion = new Set<string>();
```

Decision rules:

- If `visualSeq` was already enqueued, do not enqueue presentation frames again.
- If `operationId + stateVersion` was already applied, do not apply canonical snapshot again unless `force` and projected snapshot hash differs.
- If source is `state_sync`, allow canonical force apply only through the same coordinator.
- If no presentation frames and no playback events exist, request board refresh as `snapshot_no_playback_visual_sync`, not as direct render.

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-intake-coordinator.test.ts test/ui.network-client.apply-coordinator.test.ts
```

Expected: PASS.

### Task 3.3: Route Existing Sources Through Coordinator

**Files:**

- Modify: `ui/network/publish-flow.ts`
- Modify: `ui/network/stream-snapshot.ts`
- Modify: `ui/network/session-lifecycle.ts`
- Modify: `ui/network-client.ts`

- [ ] In `publish-flow.ts`, replace direct `applySnapshotThroughCoordinator(res.data.snapshot, ...)` with:

```ts
const envelope = cfg.normalizeNetworkSnapshotEnvelope({
  source: 'publish_response',
  payload: res.data,
  force: true,
  trackedPublish
});
const applied = cfg.submitNetworkSnapshotEnvelope(envelope);
```

- [ ] In `stream-snapshot.ts`, replace direct apply with:

```ts
const envelope = cfg.normalizeNetworkSnapshotEnvelope({
  source: 'stream',
  payload,
  force: false,
  trackedPublish
});
const applied = cfg.submitNetworkSnapshotEnvelope(envelope);
```

- [ ] In `session-lifecycle.ts`, route state sync and journal catch-up through the same submit function with sources `state_sync` and `presentation_journal`.

- [ ] Keep old helper functions temporarily as compatibility adapters, but add trace entries when they are used.

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-client.publish-base-version.test.ts test/ui.network-client.reconnect-sync.test.ts test/ui.network-client.apply-coordinator.test.ts test/ui.network-client.sound-dedupe.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts
npm run test:network:parity
```

Expected: PASS. No double playback from self operation stream after publish response.

## Phase 4: Remove Network Board Writer Bypasses

Goal: network code never writes board DOM directly.

### Task 4.1: Characterize Current Bypass

**Files:**

- Create or modify: `test/ui.network-client.visual-catchup.test.ts`
- Modify only tests first.

- [ ] Add failing test:

```ts
test('network timeline refresh queues board update without direct render while playback is active', () => {
  const renderBoard = jest.fn();
  const renderBoardFull = jest.fn();
  const requestBoardRender = jest.fn(() => true);
  const flushVisualUpdates = jest.fn(() => false);
  const waitForPlaybackIdle = jest.fn(() => Promise.resolve());

  const client = createNetworkClientHarness({
    renderBoard,
    boardRenderer: { renderBoardFull },
    RenderScheduler: { requestBoardRender, flushVisualUpdates },
    waitForPlaybackIdle,
    shouldDeferNetworkBoardDomWrite: () => true
  });

  client.requestNetworkTimelineBoardRefreshForTest(
    { stateVersionFrom: 4, stateVersionTo: 5 },
    { reason: 'presentation_frame_committed', visualSeq: 5, visualVersion: 5 }
  );

  expect(requestBoardRender).toHaveBeenCalled();
  expect(renderBoard).not.toHaveBeenCalled();
  expect(renderBoardFull).not.toHaveBeenCalled();
});
```

- [ ] If no harness exists, add a narrow exported test hook instead of exposing production internals globally.

- [ ] Run and confirm failure on current direct-render path:

```powershell
npx jest --runInBand test/ui.network-client.visual-catchup.test.ts -t "network timeline refresh"
```

### Task 4.2: Simplify Timeline Board Refresh

**Files:**

- Modify: `ui/network-client.ts`
- Modify: `ui/network/snapshot.ts`
- Modify: `ui/render-scheduler.ts` only if needed.

- [ ] Replace `requestNetworkTimelineBoardRefresh()` body with a single scheduling path:

```ts
function requestNetworkTimelineBoardRefresh(frame: any, meta: any) {
  const info = buildNetworkTimelineBoardRefreshInfo(frame, meta);
  recordNetworkTrace('board_refresh_requested', {
    ...info,
    boardWriter: 'render_scheduler'
  });

  const scheduler = resolveNetworkClientCandidate(() => root && root.RenderScheduler)
    || resolveNetworkClientGlobal('RenderScheduler');
  if (scheduler && typeof scheduler.requestBoardRender === 'function') {
    return scheduler.requestBoardRender(info) !== false;
  }

  const boardUpdateDispatch = resolveNetworkClientCandidate(() => root && root.BoardUpdateDispatch)
    || resolveNetworkClientGlobal('BoardUpdateDispatch');
  if (boardUpdateDispatch && typeof boardUpdateDispatch.requestBoardUpdate === 'function') {
    return boardUpdateDispatch.requestBoardUpdate(info) !== false;
  }

  recordNetworkTrace('board_refresh_unavailable', {
    ...info,
    boardWriter: 'none'
  });
  return false;
}
```

- [ ] Remove direct calls from this function:

```ts
renderBoard();
boardRenderer.renderBoardFull();
renderScheduler.flushVisualUpdates();
waitForPlaybackIdle().then(() => renderBoard());
```

- [ ] In `ui/network/snapshot.ts::refreshUi`, route board refresh through `boardUpdateDispatch` or `RenderScheduler` only. Keep card UI and result overlay separate.

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-client.visual-catchup.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.render-scheduler.test.ts
```

Expected: PASS, with final board sync queued and not lost.

### Task 4.3: Browser Regression For No Final-Board Prepaint

**Files:**

- Create or extend: `scripts/playback-board-writer-browser-check.ts`
- Modify: `package.json`

- [ ] Add npm script:

```json
"match:playback-board-writer-check": "npm run build:browser && node dist/scripts/playback-board-writer-browser-check.js"
```

- [ ] In the browser script, assert these events in order:

```ts
interface BoardWriterCheckResult {
  targetVisibleBeforePlayback: boolean;
  directNetworkRenderCountDuringPlayback: number;
  playbackStartedAt: number | null;
  firstTargetRemovalAt: number | null;
  finalBoardSyncAt: number | null;
}
```

Acceptance:

- `targetVisibleBeforePlayback === true`
- `directNetworkRenderCountDuringPlayback === 0`
- `firstTargetRemovalAt >= playbackStartedAt`
- `finalBoardSyncAt >= firstTargetRemovalAt`

- [ ] Run:

```powershell
npm run match:playback-board-writer-check
```

Expected: PASS in Chrome.

## Phase 5: VisualSeq-Based Playback Settlement

Goal: remove normal dependence on the 1,500 ms pending selection timeout and queue deletion.

### Task 5.1: Add Visual Settlement Primitive

**Files:**

- Create: `ui/network/visual-settlement.ts`
- Create: `test/ui.network-visual-settlement.test.ts`

- [ ] Write tests:

```ts
import { createVisualSettlementTracker } from '../ui/network/visual-settlement';

test('resolves waiters when matching visualSeq completes', async () => {
  const tracker = createVisualSettlementTracker({ now: () => 100 });
  const waiter = tracker.waitForVisualSeq(12, { timeoutMs: 5000 });
  tracker.markVisualSeqCompleted(12);
  await expect(waiter).resolves.toEqual({ ok: true, visualSeq: 12 });
});

test('rejects stale waiters with explicit timeout reason', async () => {
  jest.useFakeTimers();
  const tracker = createVisualSettlementTracker({ now: () => Date.now() });
  const waiter = tracker.waitForVisualSeq(13, { timeoutMs: 20 });
  jest.advanceTimersByTime(25);
  await expect(waiter).resolves.toEqual({ ok: false, visualSeq: 13, reason: 'VISUAL_SETTLEMENT_TIMEOUT' });
  jest.useRealTimers();
});
```

- [ ] Implement with explicit completion and abort APIs:

```ts
export function createVisualSettlementTracker(options?: { now?: () => number; completedLimit?: number }) {
  type Waiter = { resolve: (result: any) => void; timeoutId: any };
  const waiters = new Map<number, Waiter[]>();
  const completedSeq = new Set<number>();
  const completedLimit = Math.max(1, Math.trunc(Number(options?.completedLimit || 64)));

  function rememberCompleted(seq: number) {
    completedSeq.add(seq);
    while (completedSeq.size > completedLimit) {
      const first = completedSeq.values().next().value;
      completedSeq.delete(first);
    }
  }

  function finish(visualSeq: number, result: any) {
    const seq = Math.max(0, Math.trunc(Number(visualSeq)));
    if (result && result.ok === true) rememberCompleted(seq);
    const list = waiters.get(seq) || [];
    waiters.delete(seq);
    for (const waiter of list) {
      if (waiter.timeoutId) clearTimeout(waiter.timeoutId);
      waiter.resolve(result);
    }
  }

  function waitForVisualSeq(visualSeq: number, opts?: { timeoutMs?: number }) {
    const seq = Math.max(0, Math.trunc(Number(visualSeq)));
    const timeoutMs = Math.max(0, Math.trunc(Number(opts?.timeoutMs ?? 10000)));
    if (completedSeq.has(seq)) {
      return Promise.resolve({ ok: true, visualSeq: seq });
    }
    return new Promise((resolve) => {
      const list = waiters.get(seq) || [];
      const timeoutId = timeoutMs > 0
        ? setTimeout(() => finish(seq, { ok: false, visualSeq: seq, reason: 'VISUAL_SETTLEMENT_TIMEOUT' }), timeoutMs)
        : null;
      waiters.set(seq, list.concat([{ resolve, timeoutId }]));
    });
  }

  return {
    waitForVisualSeq,
    markVisualSeqCompleted: (visualSeq: number) => {
      const seq = Math.max(0, Math.trunc(Number(visualSeq)));
      finish(seq, { ok: true, visualSeq: seq });
    },
    abortVisualSeq: (visualSeq: number, reason = 'VISUAL_SETTLEMENT_ABORTED') => {
      const seq = Math.max(0, Math.trunc(Number(visualSeq)));
      finish(seq, { ok: false, visualSeq: seq, reason });
    }
  };
}
```

- [ ] Include these edge-case tests before integration:

```ts
test('late waiter resolves immediately for recently completed visualSeq', async () => {
  const tracker = createVisualSettlementTracker();
  tracker.markVisualSeqCompleted(20);
  await expect(tracker.waitForVisualSeq(20, { timeoutMs: 5000 })).resolves.toEqual({ ok: true, visualSeq: 20 });
});

test('completion clears timeout so a resolved waiter is not resolved again', async () => {
  jest.useFakeTimers();
  const tracker = createVisualSettlementTracker();
  const waiter = tracker.waitForVisualSeq(21, { timeoutMs: 20 });
  tracker.markVisualSeqCompleted(21);
  jest.advanceTimersByTime(25);
  await expect(waiter).resolves.toEqual({ ok: true, visualSeq: 21 });
  jest.useRealTimers();
});
```

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-visual-settlement.test.ts
```

### Task 5.2: Replace Pending Selection Forced Cleanup

**Files:**

- Modify: `cards/card-interaction-pending-settlement.ts`
- Modify: `cards/card-interaction-pending-publish.ts`
- Modify: `ui/network/presentation-timeline.ts`
- Modify: `ui/playback-state-manager.ts`

- [ ] Change normal settlement flow:

```ts
// Before: waitForVisualPlaybackDrain({ timeoutMs: 1500 }) then clear queues.
// After: wait for accepted publish visualSeq when available; timeout only records recovery.
```

- [ ] Keep timeout as failure telemetry, not normal cleanup:

```ts
if (settlement.ok !== true) {
  recordNetworkTelemetry('pending_selection_visual_settlement_timeout', {
    visualSeq,
    operationId,
    reason: settlement.reason
  });
  playbackStateManager.releasePendingSelectionLock({ reason: settlement.reason });
  return false;
}
```

- [ ] Remove unconditional `PLAYBACK_EVENTS` deletion from successful settlement. Keep an explicit recovery function only for stale abandoned queues with trace evidence.

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.playback-state-manager.test.ts test/ui.animation-engine.test.ts
npm run test:network:parity
```

Expected: pending selection locks release after visual completion, not after arbitrary 1,500 ms cleanup.

## Phase 6: Reconnect As A Single Recovery State Machine

Goal: heartbeat resync, stream watchdog reconnect, state sync, and journal catch-up cannot race into independent board updates.

### Task 6.1: Add Reconnect State Tests

**Files:**

- Modify: `test/ui.network-client.reconnect-sync.test.ts`
- Modify or create: `test/ui.network-reconnect-controller.test.ts`

- [ ] Add test:

```ts
test('heartbeat resync and watchdog reconnect share one recovery flight', async () => {
  const syncLatestStateWithRetry = jest.fn(() => Promise.resolve({ ok: true }));
  const controller = createNetworkReconnectController({
    getState: () => ({
      heartbeatResyncInFlight: false,
      reconnectRecoveryPending: false,
      eventSource: { close: jest.fn() },
      lastStreamActivityAt: 0,
      streamWatchdogTimerId: 0,
      reconnectTimerId: null,
      reconnectAttempt: 0
    }),
    isActive: () => true,
    getAppliedStateVersion: () => 3,
    syncLatestStateWithRetry,
    recordNetworkTelemetry: jest.fn(),
    scheduleTimeout: (fn: any) => { fn(); return 1; },
    clearScheduledTimeout: jest.fn(),
    streamStaleTimeoutMs: 1,
    streamWatchdogIntervalMs: 1,
    reconnectBaseDelayMs: 1,
    reconnectMaxDelayMs: 1,
    reconnectRecoveryWaitMs: 1,
    computeRetryDelayMs: () => 1,
    openStream: jest.fn(),
    emitStatus: jest.fn()
  });
  controller.maybeSyncFromHeartbeat({ stateVersion: 4 });
  controller.scheduleReconnectRecoverySync();
  await Promise.resolve();
  expect(syncLatestStateWithRetry).toHaveBeenCalledTimes(1);
});
```

- [ ] Implement a single recovery flight flag if the test fails because two recovery syncs run.

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-client.reconnect-sync.test.ts test/ui.network-reconnect-controller.test.ts
```

Expected: one recovery path at a time.

### Task 6.2: Journal Catch-Up Through Intake Coordinator

**Files:**

- Modify: `ui/network/session-lifecycle.ts`
- Modify: `ui/network/intake-coordinator.ts`
- Modify: `test/ui.network-client.reconnect-sync.test.ts`

- [ ] Ensure `fetchAndApplyPresentationJournal()` does not call board refresh directly.

- [ ] Journal response handling must submit:

```ts
submitNetworkSnapshotEnvelope(normalizeNetworkSnapshotEnvelope({
  source: 'presentation_journal',
  payload: {
    snapshot: payload.baseSnapshot,
    stateVersion: baseVersion,
    presentationCursor: payload.presentationCursor,
    presentationFrames: payload.presentationFrames
  },
  force: true
}));
```

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-client.reconnect-sync.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts
npm run test:network:parity
```

Expected: reconnect catch-up produces one visual sequence, no duplicate playback.

## Phase 7: Server Payload And Storage Optimization

Goal: reduce server storage and transport payload size without weakening recovery.

### Task 7.1: Lock Journal And SSE Buffer Limits Across Runtimes

**Files:**

- Modify: `utils/match-authority.ts` only if tests expose missing source behavior.
- Modify: `test/utils.match-authority.presentation-journal.test.ts`
- Modify: `test/workers.match-stream-sse.test.ts`

- [ ] Add tests that verify:

```ts
expect(MatchAuthority.SSE_RESUME_BUFFER_LIMIT).toBe(8);
expect(MatchAuthority.PRESENTATION_JOURNAL_LIMIT).toBe(8);
```

- [ ] Add test that old cursor returns `VISUAL_CURSOR_EXPIRED` with current snapshot fallback.

- [ ] Run:

```powershell
npx jest --runInBand test/utils.match-authority.presentation-journal.test.ts test/workers.match-stream-sse.test.ts
npm run check:generated-network-surface
```

Expected: source and generated surfaces agree.

### Task 7.2: Prepare Ack-First Publish Response

**Files:**

- Modify: `workers/match-worker-publish-controller.ts`
- Modify: `utils/match-authority.ts`
- Modify: `ui/network/publish-flow.ts`
- Modify: `test/workers.match-publish-idempotency.test.ts`
- Modify: `test/ui.network-client.publish-base-version.test.ts`

- [ ] Add server option behind a compatibility flag:

```ts
const publishResponseMode = room.publishResponseMode || 'snapshot_compat';
```

- [ ] In `ack_only` mode, accepted publish response includes:

```ts
{
  ok: true,
  operationId,
  stateVersion: room.stateVersion,
  presentationCursor: buildPresentationCursor(room),
  publishMeta,
  serverTime
}
```

- [ ] Keep rejected response with authoritative snapshot until UI rejection recovery tests are green.

- [ ] Client behavior:

```ts
if (res.data && res.data.ok === true && !res.data.snapshot) {
  cfg.markTrackedPublishResponse(trackedPublish, responseStateVersion);
  cfg.recordNetworkTelemetry('publish_ack_without_snapshot', { operationId, responseStateVersion });
  return { ok: true };
}
```

- [ ] Run:

```powershell
npx jest --runInBand test/workers.match-publish-idempotency.test.ts test/ui.network-client.publish-base-version.test.ts test/ui.network-client.reconnect-sync.test.ts
npm run test:network:parity
```

Expected: compatibility mode still passes. Ack-only mode passes targeted tests.

## Phase 8: Browser Boot And Bundle Optimization

Goal: network mode startup does not pay CPU / ONNX / gacha / commentary costs before they are used.

### Task 8.1: Extend Boot Metadata Contract

**Files:**

- Modify: `scripts/build-module-registry.ts`
- Modify: `test/scripts.build-module-registry.boot-contract.test.ts`

- [x] Extend the existing boot contract test. `classifyBrowserBootModule` and `test/scripts.build-module-registry.boot-contract.test.ts` already exist; do not recreate them.

```ts
import { classifyBrowserBootModule } from '../scripts/build-module-registry';

test('network core is required but ONNX and gacha are optional', () => {
  expect(classifyBrowserBootModule('ui/network-client')).toBe('required');
  expect(classifyBrowserBootModule('ui/network/publish-flow')).toBe('required');
  expect(classifyBrowserBootModule('game/ai/policy-onnx-runtime')).toBe('optional');
  expect(classifyBrowserBootModule('ui/gacha/gacha-overlay-controller')).toBe('optional');
  expect(classifyBrowserBootModule('node_modules/onnxruntime-web')).toBe('optional');
});
```

- [x] Add a registry split assertion to the same test file:

```ts
test('separates startup registry from lazy optional registry content', () => {
  const result = buildRegistry({ write: false, log: false, syncScriptVersions: false, splitRegistries: true });
  expect(result && result.startupContent).toContain('"ui/network-client"');
  expect(result && result.startupContent).not.toContain('"game/ai/policy-onnx-runtime"');
  expect(result && result.optionalContent).toContain('"game/ai/policy-onnx-runtime"');
  expect(result && result.optionalContent).toContain('"ui/gacha/gacha-overlay-controller"');
});
```

- [x] Run:

```powershell
npx jest --runInBand test/scripts.build-module-registry.boot-contract.test.ts
```

### Task 8.2: Split Registry Output And Lazy Load Optional Runtime Groups

**Files:**

- Create: `ui/bootstrap/lazy-runtime-loader.ts`
- Modify: `scripts/build-module-registry.ts`
- Modify: `entry-browser.js`
- Modify: `index.html`
- Modify: `ui/handlers/cpu-policy.ts`
- Modify: `ui/handlers/gacha.ts`

- [x] Change `scripts/build-module-registry.ts` so `buildRegistry()` can write at least two browser registry files:

```text
public/module-registry.js                  required startup modules only
public/module-registry.optional.js         optional CPU/ONNX/gacha/commentary/cosmetic modules
```

- [x] Keep `public/runtime.js` unchanged unless tests prove it cannot safely accept a second registry script. The current runtime can register additional modules through repeated `window.__cjsRegister(...)` calls.

- [x] Update `index.html` so startup loads only:

```html
<script src="public/runtime.js?..."></script>
<script src="public/module-registry.js?..."></script>
<script src="ui/layout-stage.js"></script>
<script src="entry-browser.js?..."></script>
```

- [x] Do not include `public/module-registry.optional.js` or `node_modules/onnxruntime-web/dist/ort.min.js` in the initial HTML.

- [x] Implement lazy loader:

```ts
type LazyGroup = 'cpu' | 'onnx' | 'gacha' | 'commentary';

const loadedGroups = new Set<LazyGroup>();

export async function loadLazyRuntimeGroup(group: LazyGroup, modules: string[]) {
  if (loadedGroups.has(group)) return true;
  await ensureOptionalRegistryScriptLoaded();
  for (const moduleKey of modules) {
    if (typeof window !== 'undefined' && typeof (window as any).require === 'function') {
      (window as any).require(moduleKey);
    }
  }
  loadedGroups.add(group);
  return true;
}
```

- [x] Remove eager script:

```html
<!-- Remove from base boot -->
<script src="node_modules/onnxruntime-web/dist/ort.min.js"></script>
```

- [x] CPU Lv6/ONNX path loads ONNX before first ONNX decision:

```ts
await loadOptionalOnnxRuntimeForCpuPolicy();
```

- [x] Gacha button click loads gacha group before opening overlay.

- [x] Run:

```powershell
npm run build:browser
npx jest --runInBand test/scripts.build-module-registry.boot-contract.test.ts test/ui.match-mode.network-button.test.ts
```

Expected: network mode can boot without loading the optional registry chunk or eager ONNX script.

### Task 8.3: Browser Performance Gate

**Files:**

- Create: `scripts/browser-boot-performance-check.ts`
- Modify: `package.json`

- [x] Add npm script:

```json
"match:boot-performance-check": "npm run build:browser && node dist/scripts/browser-boot-performance-check.js"
```

- [x] Browser check must collect:

```ts
interface BootPerformanceSample {
  moduleRegistryBytes: number;
  requiredBootModuleCount: number;
  optionalBootModuleCount: number;
  onnxScriptLoadedAtStartup: boolean;
  networkModeReadyMs: number;
}
```

Acceptance:

- `onnxScriptLoadedAtStartup === false`
- optional registry script is not loaded at startup
- required startup registry byte size is lower than the previous single-registry size
- required boot module count is lower than current eager count
- network mode ready time is recorded and does not regress across repeated local runs

- [x] Run:

```powershell
npm run match:boot-performance-check
```

Expected: outputs JSON summary and exits 0.

Result on 2026-06-22: `npm run match:boot-performance-check` passed with `moduleRegistryBytes=7191609`, `optionalRegistryBytes=399816`, `combinedRegistryBytes=7591425`, `requiredBootModuleCount=504`, `optionalBootModuleCount=39`, `combinedBootModuleCount=543`, `optionalRegistryLoadedAtStartup=false`, `onnxScriptLoadedAtStartup=false`, and `networkModeReadyMs=1008`.

## Phase 9: End-To-End Network Verification

Goal: two independent browsers verify the public gameplay path, not only unit contracts.

### Task 9.1: Local Two-Browser Network Smoke

**Files:**

- Modify or create: `test/e2e/network-battle-complete-smoke.test.ts`
- Reuse existing local static server / local match server helpers.

- [ ] Scenario:

1. Browser A creates room as black.
2. Browser B joins as white.
3. Black performs normal placement.
4. White performs normal placement.
5. A card with pending selection is used.
6. A movement/destroy playback card is used.
7. Force stream reconnect on one browser.
8. Continue one move after reconnect.

- [ ] Assert:

```ts
expect(consoleErrors).toEqual([]);
expect(network500s).toEqual([]);
expect(unexpected409s).toEqual([]);
expect(trace.directBoardWritesDuringPlayback).toBe(0);
expect(trace.duplicateVisualSeqPlayback).toBe(0);
expect(trace.stuckBusyLocks).toBe(0);
expect(boardHashA).toBe(boardHashB);
```

- [ ] Run:

```powershell
npx jest --runInBand test/e2e/network-battle-complete-smoke.test.ts
```

Expected: PASS locally.

### Task 9.2: Live Public Chrome/Edge Check

**Files:**

- Use the `card-reversi-browser-live-network-check` workflow for Chrome/Edge verification, or document the exact browser automation fallback if the skill is unavailable.
- Write results to `docs/network-live-check-YYYY-MM-DD.md`.

- [ ] Build a deploy-ready state only after source and generated surfaces are synced:

```powershell
npm run test:network:parity
npm run worker:prepare
```

- [ ] Stop for explicit user approval before public deploy. Do not run:

```powershell
npm run worker:deploy
```

until the user approves deploying the verified build to the public Worker.

- [ ] Run Chrome/Edge live check against:

```text
https://card.reversi-0.workers.dev/
```

- [ ] Required live assertions:

```text
/api/match/publish 500 count: 0
unexpected /api/match/publish 409 count: 0
duplicate visualSeq playback count: 0
direct board write during playback count: 0
busy lock stuck after publish count: 0
Chrome board hash == Edge board hash after each accepted turn
```

- [ ] Capture artifacts:

```text
roomId
console logs
network request summary
network debug trace dump from both browsers
screenshots before and after reconnect
final board/canonical state hash
```

## Phase 10: Final Cleanup And Contract Update

Goal: remove compatibility shims that are no longer needed and document the stable contract.

### Task 10.1: Remove Dead Fallbacks

**Files:**

- Modify: `ui/network-client.ts`
- Modify: `ui/network/snapshot.ts`
- Modify: `ui/network/publish-flow.ts`
- Modify: `ui/network/stream-snapshot.ts`

- [ ] Search:

```powershell
rg -n "renderBoardFull|renderBoard\\(|flushVisualUpdates|catch \\(e.*ignore|publish_response_shadow|stream_self_shadow|force_recovery" ui/network-client.ts ui/network ui/render-scheduler.ts
```

- [ ] For each remaining fallback, classify as:

```text
keep: required compatibility, covered by test
remove: replaced by intake coordinator
move: belongs in playback-state-manager or render scheduler
```

- [ ] Remove only fallbacks covered by passing tests. Do not remove compatibility code just to reduce line count.

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-client.apply-coordinator.test.ts test/ui.network-client.reconnect-sync.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts
npm run test:network:parity
```

### Task 10.2: Update Architecture Contract

**Files:**

- Modify: `docs/architecture-contracts.md`
- Modify: this plan with execution result

- [ ] Add stable contract text if implementation establishes it:

```md
Network snapshot intake is source-normalized before application. POST responses, SSE snapshots, state sync payloads, and presentation journal catch-up must submit `NetworkSnapshotEnvelope` values to the intake coordinator. Source-specific handlers must not apply snapshots, enqueue playback, or request board DOM writes directly.
```

- [ ] Add boot contract text if lazy loading lands:

```md
Browser startup has required and lazy module groups. Network battle startup must not eagerly load CPU ONNX, gacha reveal, or commentary modules unless the selected feature path requests them.
```

- [ ] Run docs verification:

```powershell
git diff -- docs/architecture-contracts.md docs/superpowers/plans/2026-06-22-network-battle-complete-repair-optimization.md
git diff --check -- docs/architecture-contracts.md docs/superpowers/plans/2026-06-22-network-battle-complete-repair-optimization.md
```

## Verification Ladder

Run the smallest relevant check after each task, then broaden only when the blast radius expands.

Level 1:

```powershell
npx jest --runInBand test/ui.network-debug-trace.test.ts
npx jest --runInBand test/ui.network-intake-envelope.test.ts
npx jest --runInBand test/ui.network-intake-coordinator.test.ts
```

Level 2:

```powershell
npx jest --runInBand test/ui.network-client.apply-coordinator.test.ts test/ui.network-client.publish-base-version.test.ts test/ui.network-client.reconnect-sync.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts
```

Level 3:

```powershell
npm run test:network:parity
npm run build:browser
npm run check:generated-network-surface
npm run worker:prepare
```

Browser / live:

```powershell
npm run match:playback-board-writer-check
npm run match:boot-performance-check
npx jest --runInBand test/e2e/network-battle-complete-smoke.test.ts
# after explicit user approval only:
# npm run worker:deploy
```

## Completion Criteria

The repair is complete only when all of these are true:

- Source, `dist`, `public/module-registry.js`, and `worker-public` pass generated-surface integrity checks.
- Network mode starts without eager ONNX load and without loading the optional registry chunk.
- No network source directly calls board DOM writers during playback.
- POST response, SSE, state sync, and journal recovery all use the same intake coordinator.
- Duplicate `operationId` / `stateVersion` / `visualSeq` transitions do not replay animation twice.
- Pending selection publish settlement resolves from visual completion or explicit abort, not normal 1,500 ms queue clearing.
- Reconnect recovery cannot run multiple independent state sync / journal catch-up flows at the same time.
- `npm run test:network:parity` passes.
- Local two-browser smoke passes.
- Live Chrome/Edge public network check passes with zero publish 500, zero unexpected publish 409, zero stuck busy lock, and matching final board hashes.

## Execution Order Summary

1. Generated-surface integrity first. Do not debug runtime behavior while generated surfaces are stale.
2. Add structured trace before changing sync semantics.
3. Introduce intake envelope and coordinator while keeping compatibility response shapes.
4. Remove network direct board writer bypasses.
5. Replace pending selection timeout cleanup with visualSeq settlement.
6. Unify reconnect recovery.
7. Optimize server payloads and boot load.
8. Run local browser smoke.
9. Deploy and run live Chrome/Edge verification.
10. Update `docs/architecture-contracts.md` with only the stable contracts that actually landed.

## Self-Review

- Spec coverage: the plan covers source/generated drift, network sync, board rendering, playback settlement, reconnect, server payload storage, boot performance, and live verification.
- Placeholder scan: no unresolved placeholder markers or vague future-work steps are intentionally left.
- Type consistency: `NetworkSnapshotEnvelope`, `NetworkIntakeSource`, visualSeq settlement, and trace fields are named consistently across phases.
- Risk note: this is intentionally a multi-commit refactor. Do not attempt all phases in one commit.
