# UI Performance Instrumentation And Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure and then optimize endgame and high-special-stone UI load without changing canonical gameplay state, `events[]` meaning/order, or player-visible behavior.

**Architecture:** Keep all measurement and optimization in browser UI/presentation modules. `game/`, `shared/`, CPU, and pure card logic remain headless and do not gain DOM, `window`, audio, timer, or network dependencies. The first pass adds opt-in measurement only; later passes reduce DOM/layout work behind the existing Single Visual Writer and playback pipeline.

**Tech Stack:** TypeScript/CommonJS browser modules, Jest, jsdom, existing `AnimationEngine`, `PlaybackStateManager`, `BoardRenderer`, and `cards/card-renderer` surfaces.

---

## Files And Responsibilities

- Create: `ui/performance-monitor.ts`
  - Owns opt-in UI performance counters, spans, DOM/layout probes, snapshots, and reset helpers.
  - Enabled only by explicit flag or URL parameter such as `?debug=1&perf=1`.
- Modify: `ui/animation-engine.ts`
  - Records playback run duration, phase duration, per-phase event counts, and watchdog/abort metadata.
- Modify: `ui/playback-state-manager.ts`
  - Records playback lock active duration and release reason.
- Modify: `ui/board-renderer.ts`
  - Records `renderBoard` and `renderBoardFull` call counts and duration.
- Modify: `cards/card-renderer.ts`
  - Records `renderCardUI` call count and duration.
- Test: `test/ui.performance-monitor.test.ts`
  - Verifies opt-in behavior, counter/span snapshots, and DOM probe counts without changing returned DOM behavior.
- Test: `test/ui.performance-monitor.playback.test.ts`
  - Verifies AnimationEngine reports playback and phase counts while preserving event ordering.

## Task 1: Opt-In Performance Monitor

- [ ] **Step 1: Write failing monitor tests**

```typescript
const path = require('path');

describe('UI performance monitor', () => {
  beforeEach(() => {
    jest.resetModules();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('stays disabled by default and exposes empty snapshots', () => {
    const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.ts'));
    monitor.resetPerformanceMetrics();
    monitor.count('dom.createElement');
    expect(monitor.getPerformanceSnapshot()).toEqual({
      enabled: false,
      counters: {},
      spans: [],
      activeSpans: 0
    });
  });

  test('records counters and spans when explicitly enabled', () => {
    const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.ts'));
    monitor.configurePerformanceMonitor({ enabled: true, now: () => 10 });
    monitor.count('playback.phase.events', 3, { phase: 1 });
    const token = monitor.beginSpan('playback.phase', { phase: 1, eventCount: 3 });
    monitor.configurePerformanceMonitor({ enabled: true, now: () => 25 });
    monitor.endSpan(token, { completed: true });
    expect(monitor.getPerformanceSnapshot().counters['playback.phase.events'].count).toBe(3);
    expect(monitor.getPerformanceSnapshot().spans[0].durationMs).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --runInBand --runTestsByPath test/ui.performance-monitor.test.ts`

Expected: FAIL because `ui/performance-monitor.ts` does not exist.

- [ ] **Step 3: Implement `ui/performance-monitor.ts`**

Implement:
- `configurePerformanceMonitor(options)`
- `isPerformanceMonitorEnabled()`
- `count(name, amount, meta)`
- `beginSpan(name, meta)`
- `endSpan(token, meta)`
- `measure(name, meta, fn)`
- `getPerformanceSnapshot()`
- `resetPerformanceMetrics()`
- `installDomPerformanceProbe(documentRef)`

The DOM probe wraps `document.createElement`, `document.createElementNS`, `Element.prototype.appendChild`, and `Element.prototype.getBoundingClientRect` only when enabled, returns the original result, and can be installed repeatedly without double-wrapping.

- [ ] **Step 4: Run monitor tests**

Run: `npx jest --runInBand --runTestsByPath test/ui.performance-monitor.test.ts`

Expected: PASS.

## Task 2: Playback Metrics

- [ ] **Step 1: Write failing playback instrumentation test**

Create `test/ui.performance-monitor.playback.test.ts` with a no-animation AnimationEngine setup. Enable the monitor, play three events across two phases, and assert:
- `animation.playback.events` counter equals `3`
- `animation.playback.phase.events` counter equals `3`
- two `animation.playback.phase` spans exist
- one `animation.playback` span exists

- [ ] **Step 2: Run test to verify it fails**

Run: `NOANIM=1 npx jest --runInBand --runTestsByPath test/ui.performance-monitor.playback.test.ts`

Expected: FAIL because AnimationEngine does not record these metrics yet.

- [ ] **Step 3: Instrument `ui/animation-engine.ts`**

Add `const PerformanceMonitor = requireRuntimeModuleOrWindowGlobal('./performance-monitor', 'CardReversiPerformanceMonitor');`.

In `play(events)`:
- count normalized event length as `animation.playback.events`
- start `animation.playback` span after the run id is assigned
- include `runId`, `eventCount`, `phaseCount`, `watchdogFired`, and `aborted` metadata on finish

In `executePhase(phaseEvents)`:
- count phase event length as `animation.playback.phase.events`
- start/end `animation.playback.phase` span with `phase`, `eventCount`, and event type histogram

- [ ] **Step 4: Run playback instrumentation test**

Run: `NOANIM=1 npx jest --runInBand --runTestsByPath test/ui.performance-monitor.playback.test.ts`

Expected: PASS.

## Task 3: Render And Lock Metrics

- [ ] **Step 1: Add focused tests for render and lock metrics**

Cover:
- `PlaybackStateManager.beginPlayback` starts a lock span
- `PlaybackStateManager.finalizePlayback` closes it
- `BoardRenderer.renderBoard` records `ui.renderBoard`
- `CardRenderer.renderCardUI` records `ui.renderCardUI`

- [ ] **Step 2: Instrument render and lock entrypoints**

Modify:
- `ui/playback-state-manager.ts`
- `ui/board-renderer.ts`
- `cards/card-renderer.ts`

Only wrap the existing body in monitor spans; do not change skip conditions, side effects, or return values.

- [ ] **Step 3: Run focused tests**

Run: `npx jest --runInBand --runTestsByPath test/ui.performance-monitor.test.ts test/ui.performance-monitor.playback.test.ts`

Expected: PASS.

## Task 4: Hotspot Classification Report

- [ ] **Step 1: Add a debug-only summary helper**

Expose `window.getCardReversiPerformanceSnapshot()` only when the monitor is explicitly enabled.

- [ ] **Step 2: Run a synthetic heavy playback locally**

Use a debug board with:
- late-game mostly-filled board
- multiple special stone markers
- a playback batch with multiple phases and many destroy targets

Record:
- phase event count
- DOM creation count
- append count
- layout measurement count
- `renderBoard` / `renderCardUI` counts
- playback and lock durations

- [ ] **Step 3: Classify safe optimization targets**

Classify each hotspot into:
- board/hand UI diff update
- same-phase animation batching
- layout measurement batching
- DOM creation/append aggregation
- playback snapshot/board update deferral

## Task 5: Behavior-Preserving Optimization Passes

- [ ] **Pass A: Batch layout reads**

Add a UI-only phase geometry cache for animation phases. Preserve all target coordinates and animation methods; change only when `getBoundingClientRect()` is called.

- [ ] **Pass B: Aggregate DOM creation and append**

Use `DocumentFragment` or one overlay per phase for same-type source animations. Preserve visual duration, z-index, target order, and cleanup timing.

- [ ] **Pass C: Batch same-phase destroy-source animations**

For effects such as `ULTIMATE_DESTROY_GOD`, `LIGHTNING_WILL`, and beam/slash families, keep `events[]` unchanged and render the same concurrent visuals through a shared phase overlay.

- [ ] **Pass D: Reduce redundant render scheduling**

Keep Single Visual Writer. During playback, defer board/card UI refreshes already covered by the final playback sync instead of scheduling duplicate immediate updates.

## Invariants

- Do not modify `game/`, `shared/`, CPU, or pure card logic for UI performance instrumentation.
- Do not change canonical state, snapshot authority, or `events[]` meaning/order.
- Do not add DOM, `window`, audio, timer, or network dependencies to headless layers.
- Do not introduce a second board DOM writer during playback.
- Keep normal play behavior unchanged when performance monitoring is disabled.
- Do not edit `worker-public/` or `dist/` as source.

## Validation Bundle

- Focused monitor tests: `npx jest --runInBand --runTestsByPath test/ui.performance-monitor.test.ts`
- Playback instrumentation tests: `NOANIM=1 npx jest --runInBand --runTestsByPath test/ui.performance-monitor.playback.test.ts`
- UI animation smoke: `npm run test:jest:noanim -- --runTestsByPath test/ui.animation-engine.test.ts test/ui.playback-state-manager.test.ts`
- Type check: `npm run typecheck`

## First Safe Pass

Implement Task 1 and Task 2 only. They add opt-in measurement and do not change gameplay rules, event generation, or visible playback behavior.
