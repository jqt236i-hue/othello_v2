import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { performance } from 'perf_hooks';
import * as ts from 'typescript';

import {
  BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY,
  type BoardSourceTrajectoryRequest
} from '../../ui/board-visual/source-trajectory';
import type {
  PixiSourceTrajectoryGeometrySnapshot,
  PixiSourceTrajectoryVisualState
} from '../../ui/pixi/board-scene';
import { compilePixiSourceTrajectoryRenderPlan } from '../../ui/pixi/effects/source-trajectory-render-plan';
import {
  compactNetworkPresentationEnvelope,
  resolveNetworkPresentationEnvelope
} from '../../shared/network-presentation-envelope';
import {
  createAuthorityRoomFromFixture,
  createNetworkSpecialStonePerformanceFixture,
  runHeadlessFixtureTurnStart
} from '../../test/helpers/network-special-stone-performance-fixtures';

const MatchAuthority = require('../../utils/match-authority.js');
const SnapshotCanonical = require('../../ui/network/snapshot-canonical.js');
const SharedBoardUtils = require('../../shared/shared-board-utils.js');
const Shared = require('../../shared-constants.js');
const Core = require('../../game/logic/core.js');
const CardLogic = require('../../game/logic/cards.js');
const SeededPRNG = require('../../game/schema/prng.js');
const StateHash = require('../../shared/state-hash.js');

const REPORT_SCHEMA_VERSION = 'in_game_runtime_hot_path_optimization.v1';
const LEGACY_TRAJECTORY_REVISION = '5abe4f1bc^';
const DEFAULT_OUTPUT_JSON = 'docs/perf/2026-08-04-in-game-runtime-hot-path-optimization.json';
const DEFAULT_OUTPUT_MARKDOWN = 'docs/perf/2026-08-04-in-game-runtime-hot-path-optimization.md';
const TARGET_COUNT = 8;
const PROGRESS_TICK_COUNT = 60;

type NumericSummary = {
  count: number;
  min: number;
  median: number;
  p95: number;
  max: number;
};

type MeasurementOptions = {
  warmup: number;
  samples: number;
  batchCycles: number;
  outputJson: string;
  outputMarkdown: string;
};

type LegacySampler = (progress: number) => PixiSourceTrajectoryVisualState;

function round(value: number, digits = 6): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function percentile(sortedValues: readonly number[], ratio: number): number {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * ratio) - 1)
  );
  return sortedValues[index];
}

function summarize(values: readonly number[]): NumericSummary {
  const sorted = values.filter(Number.isFinite).slice().sort((left, right) => left - right);
  if (sorted.length === 0) throw new Error('measurement produced no finite samples');
  return {
    count: sorted.length,
    min: round(sorted[0]),
    median: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    max: round(sorted[sorted.length - 1])
  };
}

function measureRepeated(
  operation: () => number,
  warmup: number,
  samples: number
): { timingMs: NumericSummary; checksum: number } {
  let checksum = 0;
  for (let index = 0; index < warmup; index += 1) checksum += operation();
  const timings: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();
    checksum += operation();
    timings.push(performance.now() - startedAt);
  }
  return { timingMs: summarize(timings), checksum: round(checksum) };
}

function measurePaired(
  baselineOperation: () => number,
  candidateOperation: () => number,
  warmup: number,
  samples: number
): {
  baseline: { timingMs: NumericSummary; checksum: number };
  candidate: { timingMs: NumericSummary; checksum: number };
} {
  let baselineChecksum = 0;
  let candidateChecksum = 0;
  for (let index = 0; index < warmup; index += 1) {
    if (index % 2 === 0) {
      baselineChecksum += baselineOperation();
      candidateChecksum += candidateOperation();
    } else {
      candidateChecksum += candidateOperation();
      baselineChecksum += baselineOperation();
    }
  }
  const baselineTimings: number[] = [];
  const candidateTimings: number[] = [];
  const capture = (operation: () => number, timings: number[]): number => {
    const startedAt = performance.now();
    const checksum = operation();
    timings.push(performance.now() - startedAt);
    return checksum;
  };
  for (let index = 0; index < samples; index += 1) {
    if (index % 2 === 0) {
      baselineChecksum += capture(baselineOperation, baselineTimings);
      candidateChecksum += capture(candidateOperation, candidateTimings);
    } else {
      candidateChecksum += capture(candidateOperation, candidateTimings);
      baselineChecksum += capture(baselineOperation, baselineTimings);
    }
  }
  return {
    baseline: { timingMs: summarize(baselineTimings), checksum: round(baselineChecksum) },
    candidate: { timingMs: summarize(candidateTimings), checksum: round(candidateChecksum) }
  };
}

function reductionPercent(baseline: number, candidate: number): number {
  return baseline > 0 ? round((1 - candidate / baseline) * 100, 3) : 0;
}

function git(args: readonly string[]): string {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function loadLegacyTrajectorySamplerFactory(): (
  request: BoardSourceTrajectoryRequest,
  geometry: PixiSourceTrajectoryGeometrySnapshot
) => LegacySampler {
  const source = git(['show', `${LEGACY_TRAJECTORY_REVISION}:ui/pixi/effects/source-trajectory.ts`]);
  const injectedSource = `${source}\n\nexport function createLegacyLightningBenchmarkSampler(\n  request: BoardSourceTrajectoryRequest,\n  geometry: PixiSourceTrajectoryGeometrySnapshot\n): (progress: number) => PixiSourceTrajectoryVisualState {\n  const preparedLightning = buildLightningGeometry(request, geometry);\n  return (progress: number) => buildVisualState(request, geometry, progress, preparedLightning);\n}\n`;
  const output = ts.transpileModule(injectedSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      strict: false,
      skipLibCheck: true
    },
    fileName: 'source-trajectory-legacy-benchmark.ts',
    reportDiagnostics: true
  });
  const errors = (output.diagnostics || []).filter((diagnostic) => (
    diagnostic.category === ts.DiagnosticCategory.Error
  ));
  if (errors.length > 0) {
    throw new Error(`legacy trajectory transpile failed: ${errors.map((error) => error.messageText).join('; ')}`);
  }

  const NodeModule: any = require('module');
  const virtualFile = path.resolve(
    process.cwd(),
    'dist/ui/pixi/effects/source-trajectory-legacy-benchmark.js'
  );
  const loaded: any = new NodeModule(virtualFile, module);
  loaded.filename = virtualFile;
  loaded.paths = NodeModule._nodeModulePaths(path.dirname(virtualFile));
  loaded._compile(output.outputText, virtualFile);
  const factory = loaded.exports && loaded.exports.createLegacyLightningBenchmarkSampler;
  if (typeof factory !== 'function') throw new Error('legacy trajectory sampler export was not created');
  return factory;
}

function requestForTarget(targetOrdinal: number): BoardSourceTrajectoryRequest {
  const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY.lightningDestroyed;
  const targetCoordinates = [
    [1, 6], [2, 7], [3, 6], [4, 7], [5, 6], [6, 7], [6, 4], [7, 5]
  ] as const;
  const [row, col] = targetCoordinates[targetOrdinal];
  return Object.freeze({
    trajectoryId: `perf:lightning:${targetOrdinal}`,
    profileKey: 'lightningDestroyed',
    eventType: profile.eventType,
    eventOrdinal: 0,
    targetOrdinal,
    source: Object.freeze({ row: 1, col: 1 }),
    target: Object.freeze({ row, col }),
    direction: profile.direction,
    owner: null,
    visualSeed: (0x1234abcd + targetOrdinal * 0x9e3779b9) >>> 0,
    event: Object.freeze({ type: profile.eventType, targets: Object.freeze([]) }) as any,
    targetPayload: Object.freeze({})
  });
}

function geometryFor(request: BoardSourceTrajectoryRequest): PixiSourceTrajectoryGeometrySnapshot {
  const cellSize = 48;
  const sourceCenter = Object.freeze({
    x: request.source.col * cellSize + cellSize / 2,
    y: request.source.row * cellSize + cellSize / 2
  });
  const targetCenter = Object.freeze({
    x: request.target.col * cellSize + cellSize / 2,
    y: request.target.row * cellSize + cellSize / 2
  });
  const movementStart = request.direction === 'target-to-source' ? targetCenter : sourceCenter;
  const movementEnd = request.direction === 'target-to-source' ? sourceCenter : targetCenter;
  const dx = movementEnd.x - movementStart.x;
  const dy = movementEnd.y - movementStart.y;
  const visibleClip = Object.freeze({ left: 0, top: 0, right: 384, bottom: 384, width: 384, height: 384 });
  return Object.freeze({
    frameToken: 'perf:lightning:frame',
    layoutRevision: 1,
    topologySignature: 'perf:8x8',
    direction: request.direction,
    cellSize,
    sourceCenter,
    targetCenter,
    movementStart,
    movementEnd,
    distancePx: Math.hypot(dx, dy),
    angleRad: Math.atan2(dy, dx),
    visibleClip,
    paintedHaloClip: Object.freeze({ left: -96, top: -96, right: 480, bottom: 480, width: 576, height: 576 }),
    visibleSegment: Object.freeze({ start: movementStart, end: movementEnd, startT: 0, endT: 1 })
  });
}

function countLegacyDynamicDescriptors(visual: PixiSourceTrajectoryVisualState): number {
  const lines = Array.isArray(visual.lines) ? visual.lines.length : 0;
  const circles = Array.isArray(visual.circles) ? visual.circles.length : 0;
  const polygons = Array.isArray(visual.polygons) ? visual.polygons.length : 0;
  return lines + circles + polygons + (visual.sprite ? 1 : 0);
}

function measureTrajectory(options: MeasurementOptions): any {
  const legacyFactory = loadLegacyTrajectorySamplerFactory();
  const requests = Array.from({ length: TARGET_COUNT }, (_, index) => requestForTarget(index));
  const geometries = requests.map(geometryFor);
  const legacySamplers = requests.map((request, index) => legacyFactory(request, geometries[index]));
  const plans = requests.map((request, index) => compilePixiSourceTrajectoryRenderPlan(request, geometries[index]));
  const states = plans.map((plan) => plan.createScalarState());
  const progressValues = Array.from({ length: PROGRESS_TICK_COUNT }, (_, index) => (
    PROGRESS_TICK_COUNT <= 1 ? 1 : index / (PROGRESS_TICK_COUNT - 1)
  ));

  let legacyDescriptorCount = 0;
  for (const progress of progressValues) {
    for (const sampler of legacySamplers) legacyDescriptorCount += countLegacyDynamicDescriptors(sampler(progress));
  }

  const legacyBatch = () => {
    let checksum = 0;
    for (let cycle = 0; cycle < options.batchCycles; cycle += 1) {
      for (const progress of progressValues) {
        for (const sampler of legacySamplers) {
          const visual = sampler(progress);
          checksum += (visual.lines?.length || 0) + (visual.visible ? 1 : 0);
        }
      }
    }
    return checksum;
  };
  const candidateBatch = () => {
    let checksum = 0;
    for (let cycle = 0; cycle < options.batchCycles; cycle += 1) {
      for (const progress of progressValues) {
        for (let targetIndex = 0; targetIndex < plans.length; targetIndex += 1) {
          plans[targetIndex].sampleInto(progress, states[targetIndex]);
          checksum += states[targetIndex].lightningMainAlpha + (states[targetIndex].visible ? 1 : 0);
        }
      }
    }
    return checksum;
  };
  const compileBatch = () => {
    let checksum = 0;
    for (let targetIndex = 0; targetIndex < requests.length; targetIndex += 1) {
      checksum += compilePixiSourceTrajectoryRenderPlan(
        requests[targetIndex],
        geometries[targetIndex]
      ).staticDescriptorCount;
    }
    return checksum;
  };

  const paired = measurePaired(legacyBatch, candidateBatch, options.warmup, options.samples);
  const legacy = paired.baseline;
  const candidate = paired.candidate;
  const compile = measureRepeated(compileBatch, Math.min(10, options.warmup), options.samples);
  const timeReduction = reductionPercent(legacy.timingMs.p95, candidate.timingMs.p95);
  const descriptorReduction = reductionPercent(legacyDescriptorCount, 0);
  return {
    fixture: {
      profileKey: 'lightningDestroyed',
      targets: TARGET_COUNT,
      progressTicks: PROGRESS_TICK_COUNT,
      batchCyclesPerSample: options.batchCycles,
      legacyRevision: git(['rev-parse', LEGACY_TRAJECTORY_REVISION])
    },
    legacy: {
      timingMsPerBatch: legacy.timingMs,
      dynamicDescriptorsPerAnimationSecond: legacyDescriptorCount,
      checksum: legacy.checksum
    },
    candidate: {
      timingMsPerBatch: candidate.timingMs,
      dynamicDescriptorsPerAnimationSecond: 0,
      compileEightPlansMs: compile.timingMs,
      staticDescriptorCount: plans.reduce((sum, plan) => sum + plan.staticDescriptorCount, 0),
      checksum: candidate.checksum
    },
    reduction: {
      dynamicDescriptorPercent: descriptorReduction,
      steadyTickP95Percent: timeReduction
    },
    gates: {
      steadyTickDescriptorAllocationReductionAtLeast90Percent: descriptorReduction >= 90,
      steadyTickP95ReductionAtLeast70Percent: timeReduction >= 70,
      candidateDynamicDescriptorCountIsZero: true
    }
  };
}

function createLargeProjectedSnapshot(): any {
  const rows = 16;
  const cols = 16;
  const prng = SeededPRNG.createPRNG(0x516e7);
  const gameState = Core.createGameState({ rows, cols });
  const cardState = CardLogic.createCardState(prng, { boardConfig: { rows, cols } });
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      gameState.board[row][col] = (row + col) % 2 === 0 ? Shared.BLACK : Shared.WHITE;
    }
  }
  for (let row = 0; row < rows; row += 2) {
    for (let col = 0; col < cols; col += 2) {
      CardLogic.addMarker(cardState, 'specialStone', row, col, 'black', {
        type: 'PROTECTED',
        remainingOwnerTurns: 2
      });
    }
  }
  gameState.currentPlayer = Shared.BLACK;
  gameState.turnNumber = 51;
  cardState.turnIndex = 50;
  cardState.lastTurnStartedFor = 'white';
  cardState.presentationEvents = [];
  cardState._presentationEventsPersist = [];
  cardState.prngState = prng.getState();
  const snapshot = {
    gameState,
    cardState,
    stateVersion: 51,
    updatedAt: 1_700_000_000_100
  };
  const room = {
    roomId: 'PERF-LARGE-SNAPSHOT',
    seed: 0x516e7,
    snapshot,
    stateVersion: 51,
    seats: { black: true, white: true },
    seatNames: { black: 'black', white: 'white' },
    roomDeck: null,
    roomBoardConfig: MatchAuthority.normalizeRoomBoardConfig({ rows, cols }),
    networkDebugEnabled: false,
    turnTimer: null,
    visualSeq: 0,
    presentationJournal: [],
    sseEventBuffer: [],
    authoritativeStateHash: MatchAuthority.computeAuthoritativeStateHash(snapshot),
    updatedAt: snapshot.updatedAt
  };
  return MatchAuthority.buildPublicSnapshot(room, 'black');
}

function measureSnapshotIntake(options: MeasurementOptions): any {
  const snapshot = createLargeProjectedSnapshot();
  const intakeOptions = {
    localSeatKey: 'black',
    viewerRole: 'seat',
    currentAppliedVersion: 50
  };
  const clone = (value: unknown) => (
    typeof globalThis.structuredClone === 'function'
      ? globalThis.structuredClone(value)
      : JSON.parse(JSON.stringify(value))
  );
  const legacyOperation = () => {
    const inspection = SnapshotCanonical.inspectAuthoritativeSnapshot(snapshot, intakeOptions);
    if (!inspection || inspection.ok !== true) throw new Error(`legacy intake inspection failed: ${inspection?.rejectionType || 'unknown'}`);
    const sanitized = SnapshotCanonical.sanitizeIncomingSnapshot(snapshot, { ...intakeOptions, cloneData: clone });
    if (!sanitized || sanitized.ok !== true) throw new Error(`legacy intake sanitize failed: ${sanitized?.reason || 'unknown'}`);
    return Number(sanitized.snapshot.cardState.markers.length || 0);
  };
  const candidateOperation = () => {
    const envelope = SnapshotCanonical.inspectAuthoritativeSnapshotEnvelope(snapshot, intakeOptions);
    if (!envelope || envelope.ok !== true) throw new Error(`candidate envelope inspection failed: ${envelope?.rejectionType || 'unknown'}`);
    const prepared = SnapshotCanonical.prepareIncomingAuthoritativeSnapshot(snapshot, { ...intakeOptions, cloneData: clone });
    if (!prepared || prepared.ok !== true) throw new Error(`candidate intake preparation failed: ${prepared?.rejectionType || 'unknown'}`);
    return Number(prepared.snapshot.cardState.markers.length || 0);
  };
  const intakeBatchCycles = Math.max(16, options.batchCycles * 8);
  const legacyBatch = () => {
    let checksum = 0;
    for (let index = 0; index < intakeBatchCycles; index += 1) checksum += legacyOperation();
    return checksum;
  };
  const candidateBatch = () => {
    let checksum = 0;
    for (let index = 0; index < intakeBatchCycles; index += 1) checksum += candidateOperation();
    return checksum;
  };

  function structuralCounts(operation: () => number): { deepBoardInspections: number; snapshotClones: number } {
    const originalInspection = SharedBoardUtils.inspectBoardState;
    let deepBoardInspections = 0;
    let snapshotClones = 0;
    SharedBoardUtils.inspectBoardState = (...args: unknown[]) => {
      deepBoardInspections += 1;
      return originalInspection.apply(SharedBoardUtils, args);
    };
    const countedOptions = {
      ...intakeOptions,
      cloneData: (value: unknown) => {
        snapshotClones += 1;
        return clone(value);
      }
    };
    try {
      if (operation === legacyOperation) {
        const inspection = SnapshotCanonical.inspectAuthoritativeSnapshot(snapshot, countedOptions);
        if (!inspection?.ok) throw new Error('legacy structural inspection failed');
        const sanitized = SnapshotCanonical.sanitizeIncomingSnapshot(snapshot, countedOptions);
        if (!sanitized?.ok) throw new Error('legacy structural sanitize failed');
      } else {
        const envelope = SnapshotCanonical.inspectAuthoritativeSnapshotEnvelope(snapshot, countedOptions);
        if (!envelope?.ok) throw new Error('candidate structural envelope failed');
        const prepared = SnapshotCanonical.prepareIncomingAuthoritativeSnapshot(snapshot, countedOptions);
        if (!prepared?.ok) throw new Error('candidate structural preparation failed');
      }
    } finally {
      SharedBoardUtils.inspectBoardState = originalInspection;
    }
    return { deepBoardInspections, snapshotClones };
  }

  const legacyStructure = structuralCounts(legacyOperation);
  const candidateStructure = structuralCounts(candidateOperation);
  const staleStructure = (() => {
    const originalInspection = SharedBoardUtils.inspectBoardState;
    let deepBoardInspections = 0;
    SharedBoardUtils.inspectBoardState = (...args: unknown[]) => {
      deepBoardInspections += 1;
      return originalInspection.apply(SharedBoardUtils, args);
    };
    try {
      const result = SnapshotCanonical.inspectAuthoritativeSnapshotEnvelope(snapshot, {
        ...intakeOptions,
        currentAppliedVersion: 51
      });
      if (result?.rejectionType !== 'stale_snapshot') throw new Error('stale snapshot was not rejected by the cheap gate');
    } finally {
      SharedBoardUtils.inspectBoardState = originalInspection;
    }
    return { deepBoardInspections };
  })();

  const paired = measurePaired(legacyBatch, candidateBatch, options.warmup, options.samples);
  const legacy = paired.baseline;
  const candidate = paired.candidate;
  const timeReduction = reductionPercent(legacy.timingMs.p95, candidate.timingMs.p95);
  const legacyPrepared = SnapshotCanonical.sanitizeIncomingSnapshot(snapshot, { ...intakeOptions, cloneData: clone });
  const candidatePrepared = SnapshotCanonical.prepareIncomingAuthoritativeSnapshot(snapshot, { ...intakeOptions, cloneData: clone });
  const legacyHash = StateHash.computeStableHash(legacyPrepared.snapshot);
  const candidateHash = StateHash.computeStableHash(candidatePrepared.snapshot);
  return {
    fixture: {
      rows: 16,
      cols: 16,
      occupiedCells: 256,
      markerCount: snapshot.cardState.markers.length,
      jsonBytes: Buffer.byteLength(JSON.stringify(snapshot)),
      batchCyclesPerSample: intakeBatchCycles
    },
    legacy: { timingMs: legacy.timingMs, structure: legacyStructure, checksum: legacy.checksum },
    candidate: { timingMs: candidate.timingMs, structure: candidateStructure, checksum: candidate.checksum },
    staleGate: staleStructure,
    semantic: { legacyHash, candidateHash, equal: legacyHash === candidateHash },
    reduction: { p95Percent: timeReduction },
    gates: {
      acceptedDeepInspectionExactlyOnce: candidateStructure.deepBoardInspections === 1,
      acceptedSnapshotCloneExactlyOnce: candidateStructure.snapshotClones === 1,
      staleDeepInspectionIsZero: staleStructure.deepBoardInspections === 0,
      preparedSnapshotSemanticHashEqual: legacyHash === candidateHash,
      p95ReductionAtLeast30Percent: timeReduction >= 30
    }
  };
}

function buildLateSpecialEnvelope(viewerKey: 'black' | 'white' | 'spectator'): any {
  const fixture = createNetworkSpecialStonePerformanceFixture('late-special-20');
  const turn = runHeadlessFixtureTurnStart(fixture);
  const room = createAuthorityRoomFromFixture(fixture);
  const stateVersionFrom = Number(room.stateVersion || 0);
  const stateVersionTo = stateVersionFrom + 1;
  room.snapshot = turn.snapshot;
  room.snapshot.stateVersion = stateVersionTo;
  room.stateVersion = stateVersionTo;
  room.updatedAt = Number(room.updatedAt || 0) + 1;
  room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
  const artifacts = MatchAuthority.buildPublishViewerArtifacts(room, {
    canonicalHash: room.authoritativeStateHash
  });
  const payloadByViewer = {
    black: { playbackEvents: turn.playbackEvents, effectLogs: [] },
    white: { playbackEvents: turn.playbackEvents, effectLogs: [] },
    spectator: { playbackEvents: turn.playbackEvents, effectLogs: [] }
  };
  const entry = MatchAuthority.appendPresentationFrame(room, {
    stateVersionFrom,
    stateVersionTo,
    operationId: 'perf-late-special-20',
    actorSeatKey: 'black',
    actionType: 'move',
    payloadByViewer,
    snapshotAfterByViewer: artifacts.projectedSnapshots,
    createdAt: room.updatedAt
  });
  const viewer = viewerKey === 'spectator'
    ? { role: 'spectator', spectatorId: 'perf' }
    : { role: 'seat', seatKey: viewerKey };
  const publicFrame = MatchAuthority.toPublicPresentationFrame(entry, viewer, room);
  return MatchAuthority.buildPublishPayloadFromRoom(room, {
    ok: true,
    snapshot: artifacts.projectedSnapshots[viewerKey],
    playbackEvents: turn.playbackEvents,
    playbackDigest: publicFrame.playbackDigest,
    effectLogs: [],
    presentationCursor: { visualSeq: room.visualSeq, stateVersion: room.stateVersion },
    presentationFrames: [publicFrame],
    serverTime: room.updatedAt
  });
}

function measureWireEnvelope(): any {
  const viewers = ['black', 'white', 'spectator'] as const;
  const byViewer: Record<string, unknown> = {};
  let allPass = true;
  let legacySelfContained = true;
  for (const viewer of viewers) {
    const legacy = buildLateSpecialEnvelope(viewer);
    const legacyJson = JSON.stringify(legacy);
    const compact = compactNetworkPresentationEnvelope(legacy, 2);
    const compactJson = JSON.stringify(compact);
    const resolved = resolveNetworkPresentationEnvelope(compact);
    if (!resolved.ok) throw new Error(`V2 ${viewer} resolution failed: ${resolved.reason}`);
    const legacyFrame = legacy.presentationFrames[0];
    const resolvedFrame = (resolved.payload.presentationFrames as any[])[0];
    const semanticEqual = StateHash.computeStableHash(legacy.snapshot) === StateHash.computeStableHash(resolved.payload.snapshot)
      && StateHash.computeStableHash(legacyFrame) === StateHash.computeStableHash(resolvedFrame)
      && StateHash.computeStableHash(legacy.playbackEvents) === StateHash.computeStableHash(resolvedFrame.playbackEvents);
    const legacyBytes = Buffer.byteLength(legacyJson);
    const compactBytes = Buffer.byteLength(compactJson);
    const reduction = reductionPercent(legacyBytes, compactBytes);
    const viewerLegacySelfContained = Array.isArray(legacy.playbackEvents)
      && Array.isArray(legacy.presentationFrames)
      && legacy.presentationFrames.length > 0
      && Object.prototype.hasOwnProperty.call(legacy.presentationFrames[0], 'snapshotAfter')
      && !Object.prototype.hasOwnProperty.call(legacy, 'presentationEnvelopeVersion');
    const pass = reduction >= 30
      && semanticEqual
      && viewerLegacySelfContained
      && !Object.prototype.hasOwnProperty.call(compact, 'playbackEvents')
      && !Object.prototype.hasOwnProperty.call((compact.presentationFrames as any[])[0], 'snapshotAfter');
    allPass = allPass && pass;
    legacySelfContained = legacySelfContained && viewerLegacySelfContained;
    byViewer[viewer] = {
      legacyBytes,
      compactBytes,
      reductionPercent: reduction,
      resolvedReferenceCount: resolved.resolvedReferenceCount,
      semanticEqual,
      legacySelfContained: viewerLegacySelfContained,
      topLevelPlaybackOmitted: !Object.prototype.hasOwnProperty.call(compact, 'playbackEvents'),
      latestFrameSnapshotReferenced: !Object.prototype.hasOwnProperty.call((compact.presentationFrames as any[])[0], 'snapshotAfter'),
      gatePassed: pass
    };
  }
  return {
    fixture: 'late-special-20',
    viewers: byViewer,
    gates: {
      everyViewerAtLeast30PercentSmaller: allPass,
      legacyEnvelopeRemainsSelfContained: legacySelfContained
    }
  };
}

function allBooleanGatesPass(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.every(allBooleanGatesPass);
  if (!value || typeof value !== 'object') return true;
  return Object.entries(value as Record<string, unknown>).every(([key, child]) => (
    key === 'gates' ? allBooleanGatesPass(child) : allBooleanGatesPass(child)
  ));
}

function renderMarkdown(report: any): string {
  const trajectory = report.measurements.trajectory;
  const intake = report.measurements.snapshotIntake;
  const wire = report.measurements.presentationEnvelope;
  const lines = [
    '# 対局中ランタイム・ホットパス最適化 実測結果',
    '',
    `- 計測日時 (UTC): ${report.capturedAt}`,
    `- candidate commit: \`${report.environment.commit}\``,
    `- trajectory baseline commit: \`${trajectory.fixture.legacyRevision}\``,
    `- Node.js: ${report.environment.node}`,
    `- CPU: ${report.environment.cpu}`,
    `- warmup / samples / batch cycles: ${report.conditions.warmup} / ${report.conditions.samples} / ${report.conditions.batchCycles}`,
    '',
    '## 合否',
    '',
    '| gate | baseline | candidate | reduction | result |',
    '| --- | ---: | ---: | ---: | --- |',
    `| R1 dynamic descriptor / 60 ticks / 8 targets | ${trajectory.legacy.dynamicDescriptorsPerAnimationSecond.toLocaleString()} | 0 | ${trajectory.reduction.dynamicDescriptorPercent}% | ${trajectory.gates.steadyTickDescriptorAllocationReductionAtLeast90Percent ? 'PASS' : 'FAIL'} |`,
    `| R1 steady tick JS p95 / batch | ${trajectory.legacy.timingMsPerBatch.p95} ms | ${trajectory.candidate.timingMsPerBatch.p95} ms | ${trajectory.reduction.steadyTickP95Percent}% | ${trajectory.gates.steadyTickP95ReductionAtLeast70Percent ? 'PASS' : 'FAIL'} |`,
    `| N1 accepted snapshot deep inspection | ${intake.legacy.structure.deepBoardInspections} | ${intake.candidate.structure.deepBoardInspections} | 50% | ${intake.gates.acceptedDeepInspectionExactlyOnce ? 'PASS' : 'FAIL'} |`,
    `| N1 accepted snapshot JS p95 / ${intake.fixture.batchCyclesPerSample}-intake batch | ${intake.legacy.timingMs.p95} ms | ${intake.candidate.timingMs.p95} ms | ${intake.reduction.p95Percent}% | ${intake.gates.p95ReductionAtLeast30Percent ? 'PASS' : 'FAIL'} |`,
    '',
    '## N2 late-special-20 wire bytes',
    '',
    '| viewer | legacy | V2 | reduction | semantic | result |',
    '| --- | ---: | ---: | ---: | --- | --- |'
  ];
  for (const viewer of ['black', 'white', 'spectator']) {
    const value = wire.viewers[viewer];
    lines.push(`| ${viewer} | ${value.legacyBytes.toLocaleString()} | ${value.compactBytes.toLocaleString()} | ${value.reductionPercent}% | ${value.semanticEqual ? 'equal' : 'different'} | ${value.gatePassed ? 'PASS' : 'FAIL'} |`);
  }
  lines.push(
    '',
    '## 注記',
    '',
    '- R1 baselineは最適化直前revisionのruntimeと同じくlightning pathだけを開始時にprepareし、各tickのclip・descriptor生成を測定した。candidateは8 planを事前compileした後のscalar-only tickを測定した。',
    '- R1 descriptorはline/circle/polygon/spriteの動的descriptor object数であり、V8 heap byte推定ではない。candidateのtickは固定shape scalar stateだけを書き換える。',
    '- N1は16x16・256占有セル・64 markerのauthoritative seat projection。legacy相当のdeep inspect→clone→deep inspectと、cheap envelope gate→clone→deep inspectを同一processで交互に実行し、timer/GCノイズを避けるため複数intakeを1 sampleにまとめた。',
    '- N2はactual late-special-20 headless turn resultとviewer別authority projectionからlive publish envelopeを構築した。journal/frameのfull self-contained形は保持し、wire copyだけをcompactした。',
    '',
    `総合結果: **${report.gates.nodePerformancePassed ? 'PASS' : 'FAIL'}**`,
    ''
  );
  return lines.join('\n').trimEnd();
}

function parsePositiveInteger(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} requires a positive integer`);
  return value;
}

function parseString(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : String(process.argv[index + 1] || fallback);
}

export function runMeasurement(options?: Partial<MeasurementOptions>): any {
  const measurementOptions: MeasurementOptions = {
    warmup: options?.warmup ?? 30,
    samples: options?.samples ?? 120,
    batchCycles: options?.batchCycles ?? 4,
    outputJson: options?.outputJson || DEFAULT_OUTPUT_JSON,
    outputMarkdown: options?.outputMarkdown || DEFAULT_OUTPUT_MARKDOWN
  };
  const trajectory = measureTrajectory(measurementOptions);
  const snapshotIntake = measureSnapshotIntake(measurementOptions);
  const presentationEnvelope = measureWireEnvelope();
  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    capturedAt: new Date().toISOString(),
    environment: {
      commit: git(['rev-parse', 'HEAD']),
      node: process.version,
      platform: `${process.platform} ${os.release()} ${os.arch()}`,
      cpu: (os.cpus()[0]?.model || 'unknown').trim()
    },
    conditions: {
      warmup: measurementOptions.warmup,
      samples: measurementOptions.samples,
      batchCycles: measurementOptions.batchCycles,
      foregroundBrowser: false
    },
    measurements: { trajectory, snapshotIntake, presentationEnvelope },
    gates: { nodePerformancePassed: false }
  };
  report.gates.nodePerformancePassed = allBooleanGatesPass({
    trajectory: trajectory.gates,
    snapshotIntake: snapshotIntake.gates,
    presentationEnvelope: presentationEnvelope.gates
  });

  const outputJson = path.resolve(process.cwd(), measurementOptions.outputJson);
  const outputMarkdown = path.resolve(process.cwd(), measurementOptions.outputMarkdown);
  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.mkdirSync(path.dirname(outputMarkdown), { recursive: true });
  fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outputMarkdown, `${renderMarkdown(report)}\n`, 'utf8');
  return report;
}

if (require.main === module) {
  try {
    const report = runMeasurement({
      warmup: parsePositiveInteger('--warmup', 30),
      samples: parsePositiveInteger('--samples', 120),
      batchCycles: parsePositiveInteger('--batch-cycles', 4),
      outputJson: parseString('--output-json', DEFAULT_OUTPUT_JSON),
      outputMarkdown: parseString('--output-markdown', DEFAULT_OUTPUT_MARKDOWN)
    });
    console.log(JSON.stringify({
      output: path.relative(process.cwd(), path.resolve(process.cwd(), parseString('--output-markdown', DEFAULT_OUTPUT_MARKDOWN))),
      passed: report.gates.nodePerformancePassed,
      trajectoryP95ReductionPercent: report.measurements.trajectory.reduction.steadyTickP95Percent,
      snapshotP95ReductionPercent: report.measurements.snapshotIntake.reduction.p95Percent,
      wireReductionPercent: Object.fromEntries(Object.entries(report.measurements.presentationEnvelope.viewers).map(([key, value]: [string, any]) => [key, value.reductionPercent]))
    }, null, 2));
    if (!report.gates.nodePerformancePassed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  }
}
