import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

import BrowserUiControlSmoke from './browser-ui-control-smoke';

const SharedBoardUtils: any = require('../shared/shared-board-utils');
const PlaybackDigest: any = require('../shared/playback-digest');
const NetworkPresentationTimeline: any = require('../ui/network/presentation-timeline');
const NetworkVisualStateStore: any = require('../ui/network/visual-state-store');
const { runBrowserUiControlSmoke } = BrowserUiControlSmoke as any;

const REPORT_JSON_PATH = 'docs/perf/pixijs-playfield-baseline.json';
const REPORT_MARKDOWN_PATH = 'docs/perf/pixijs-playfield-baseline.md';
const CAPTURE_DIR = 'tests/visual-regression/baselines/pixijs-playfield-dom';

const PRESENTATION_EVENT_TYPES = Object.freeze([
  'PLACE',
  'FLIP',
  'DESTROY',
  'SPAWN',
  'MOVE',
  'STATUS',
  'BOARD_EXPANSION',
  'BOARD_SHRINK',
  'THEORY_INCARNATION',
  'OBSERVER_WILL',
  'MANIFEST'
]);

const SELECTOR_TOKENS = Object.freeze([
  '.cell',
  '.disc',
  'renderBoardDiff',
  'forceFullRender',
  'getCellEl'
]);

const SELECTOR_INVENTORY_EXCLUDES = new Set([
  'scripts/capture-pixijs-playfield-baseline.ts',
  'test/scripts.pixijs-playfield-baseline.test.ts'
]);

interface CaptureOptions {
  rootDir?: string;
  write?: boolean;
  log?: boolean;
  captureBrowsers?: boolean;
}

interface TopologyFixtureDefinition {
  name: string;
  rows: number;
  cols: number;
  shape: 'rectangle' | 'circle';
  expansionCells?: Array<{ row: number; col: number; side: string; owner: number }>;
  holes?: Array<{ row: number; col: number }>;
}

interface BrowserFixtureDefinition extends TopologyFixtureDefinition {
  captureKind: 'topology' | 'presentation';
  markers?: any[];
  decoratePresentation?: boolean;
  skin?: {
    board: string;
    frame: string;
    stone: string;
  };
}

const TOPOLOGY_FIXTURES: readonly TopologyFixtureDefinition[] = Object.freeze([
  { name: 'rectangle-4x4', rows: 4, cols: 4, shape: 'rectangle' },
  { name: 'rectangle-4x16', rows: 4, cols: 16, shape: 'rectangle' },
  { name: 'rectangle-16x4', rows: 16, cols: 4, shape: 'rectangle' },
  { name: 'rectangle-7x7', rows: 7, cols: 7, shape: 'rectangle' },
  { name: 'rectangle-8x8', rows: 8, cols: 8, shape: 'rectangle' },
  { name: 'rectangle-16x16', rows: 16, cols: 16, shape: 'rectangle' },
  { name: 'circle-6', rows: 6, cols: 6, shape: 'circle' },
  { name: 'circle-8', rows: 8, cols: 8, shape: 'circle' },
  { name: 'circle-10', rows: 10, cols: 10, shape: 'circle' },
  { name: 'circle-12', rows: 12, cols: 12, shape: 'circle' },
  { name: 'circle-14', rows: 14, cols: 14, shape: 'circle' },
  { name: 'circle-16', rows: 16, cols: 16, shape: 'circle' },
  {
    name: 'rectangle-8x8-hole',
    rows: 8,
    cols: 8,
    shape: 'rectangle',
    holes: [{ row: 0, col: 0 }, { row: 3, col: 3 }]
  },
  {
    name: 'rectangle-8x8-multistage-expansion',
    rows: 8,
    cols: 8,
    shape: 'rectangle',
    expansionCells: [
      { row: -1, col: 3, side: 'top', owner: 0 },
      { row: -2, col: 3, side: 'top', owner: 1 },
      { row: 8, col: 4, side: 'bottom', owner: 0 },
      { row: 3, col: -1, side: 'left', owner: -1 },
      { row: 4, col: 8, side: 'right', owner: 0 }
    ]
  }
]);

const DEFAULT_SKIN = Object.freeze({
  board: 'bluegreen-felt',
  frame: 'marsh-forged-iron',
  stone: 'o-stone'
});

const SPECIAL_VISUAL_MARKERS = Object.freeze([
  Object.freeze({
    id: 'baseline-hyperactive', kind: 'specialStone', row: 1, col: 1, owner: 'black',
    data: Object.freeze({ type: 'HYPERACTIVE', remainingOwnerTurns: 12, flipEvadeRemaining: 2, regenRemaining: 3 })
  }),
  Object.freeze({
    id: 'baseline-guard', kind: 'specialStone', row: 1, col: 2, owner: 'white',
    data: Object.freeze({ type: 'GUARD', remainingOwnerTurns: 4 })
  }),
  Object.freeze({
    id: 'baseline-bomb', kind: 'bomb', row: 2, col: 2, owner: 'black',
    data: Object.freeze({ type: 'BOMB', remainingTurns: 10 })
  }),
  Object.freeze({
    id: 'baseline-seed', kind: 'specialStone', row: 4, col: 4, owner: 'white',
    data: Object.freeze({ type: 'SEED', remainingOwnerTurns: 2 })
  }),
  Object.freeze({
    id: 'baseline-freeze', kind: 'specialStone', row: 5, col: 5, owner: 'black',
    data: Object.freeze({ type: 'FREEZE', remainingOwnerTurns: 3 })
  }),
  Object.freeze({
    id: 'baseline-manifest', kind: 'manifestStone', row: 6, col: 6, owner: 'white',
    data: Object.freeze({ type: 'ULTIMATE_REVERSE_DRAGON', remainingOwnerTurns: 8 })
  })
]);

const BROWSER_FIXTURES: readonly BrowserFixtureDefinition[] = Object.freeze([
  { name: 'rectangle-4x4', rows: 4, cols: 4, shape: 'rectangle', captureKind: 'topology' },
  { name: 'rectangle-4x16', rows: 4, cols: 16, shape: 'rectangle', captureKind: 'topology' },
  { name: 'rectangle-16x4', rows: 16, cols: 4, shape: 'rectangle', captureKind: 'topology' },
  { name: 'rectangle-7x7', rows: 7, cols: 7, shape: 'rectangle', captureKind: 'topology' },
  { name: 'rectangle-8x8-four-stars', rows: 8, cols: 8, shape: 'rectangle', captureKind: 'topology' },
  { name: 'rectangle-16x16', rows: 16, cols: 16, shape: 'rectangle', captureKind: 'topology' },
  { name: 'circle-6', rows: 6, cols: 6, shape: 'circle', captureKind: 'topology' },
  { name: 'circle-10', rows: 10, cols: 10, shape: 'circle', captureKind: 'topology' },
  { name: 'circle-16', rows: 16, cols: 16, shape: 'circle', captureKind: 'topology' },
  {
    name: 'circle-10-hole-pseudo-edge', rows: 10, cols: 10, shape: 'circle', captureKind: 'topology',
    holes: [{ row: 4, col: 4 }, { row: 5, col: 5 }]
  },
  {
    name: 'rectangle-8x8-expanded-top', rows: 8, cols: 8, shape: 'rectangle', captureKind: 'topology',
    expansionCells: [{ row: -1, col: 3, side: 'top', owner: 1 }]
  },
  {
    name: 'rectangle-8x8-expanded-right', rows: 8, cols: 8, shape: 'rectangle', captureKind: 'topology',
    expansionCells: [{ row: 3, col: 8, side: 'right', owner: -1 }]
  },
  {
    name: 'rectangle-8x8-expanded-bottom', rows: 8, cols: 8, shape: 'rectangle', captureKind: 'topology',
    expansionCells: [{ row: 8, col: 4, side: 'bottom', owner: 1 }]
  },
  {
    name: 'rectangle-8x8-expanded-left', rows: 8, cols: 8, shape: 'rectangle', captureKind: 'topology',
    expansionCells: [{ row: 4, col: -1, side: 'left', owner: -1 }]
  },
  {
    name: 'rectangle-8x8-multistage-negative', rows: 8, cols: 8, shape: 'rectangle', captureKind: 'topology',
    expansionCells: [
      { row: -1, col: 3, side: 'top', owner: 0 },
      { row: -2, col: 3, side: 'top', owner: 1 },
      { row: 8, col: 4, side: 'bottom', owner: 0 },
      { row: 3, col: -1, side: 'left', owner: -1 },
      { row: 4, col: 8, side: 'right', owner: 1 }
    ]
  },
  {
    name: 'presentation-default-hints', rows: 8, cols: 8, shape: 'rectangle', captureKind: 'presentation',
    decoratePresentation: true,
    skin: DEFAULT_SKIN
  },
  {
    name: 'presentation-custom-skins', rows: 8, cols: 8, shape: 'rectangle', captureKind: 'presentation',
    decoratePresentation: true,
    skin: { board: 'cyan-obsidian', frame: 'compact-gold-clean-corners', stone: 'pearl-obsidian' }
  },
  {
    name: 'presentation-special-timer-badge', rows: 8, cols: 8, shape: 'rectangle', captureKind: 'presentation',
    markers: SPECIAL_VISUAL_MARKERS as any[],
    decoratePresentation: true,
    skin: DEFAULT_SKIN
  }
]);

function stableValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value instanceof Set) return Array.from(value).sort();
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableJson(value: any): string {
  return JSON.stringify(stableValue(value));
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildStablePlaybackExecutionDigest(input: any): string {
  const mode = input && input.mode ? input.mode : {};
  const execution = input && input.execution ? input.execution : {};
  const trace = Array.isArray(execution.phaseCompletionTrace)
    ? execution.phaseCompletionTrace.map((entry: any) => ({
        phase: entry && entry.phase,
        depth: entry && entry.depth,
        eventTypes: Array.isArray(entry && entry.eventTypes) ? entry.eventTypes : []
      }))
    : [];
  return sha256(stableJson({
    mode: {
      name: mode.name,
      reducedMotion: mode.reducedMotion,
      noAnim: mode.noAnim === true
    },
    inputDigest: input && input.inputDigest,
    semanticDigest: input && input.semanticDigest,
    phaseCompletionOrder: Array.isArray(execution.phaseCompletionOrder)
      ? execution.phaseCompletionOrder
      : [],
    phaseCompletionTrace: trace,
    soundKeys: Array.isArray(execution.soundKeys) ? execution.soundKeys : [],
    finalBoardDigest: input && input.finalBoardDigest,
    settled: {
      playbackActive: execution.playbackActive === true,
      processing: execution.processing === true,
      cardAnimating: execution.cardAnimating === true
    }
  }));
}

function buildStablePlaybackAggregateDigest(contract: any, modes: any[]): string {
  return sha256(stableJson({
    fixtureName: contract && contract.fixtureName,
    inputDigest: contract && contract.inputDigest,
    semanticDigest: contract && contract.semanticDigest,
    canonicalFinalDigest: contract && contract.canonicalFinalDigest,
    modes: (Array.isArray(modes) ? modes : []).map((mode: any) => ({
      name: mode && mode.name,
      prefersReducedMotion: mode && mode.prefersReducedMotion === true,
      noAnim: mode && mode.noAnim === true,
      phaseCompletionOrder: mode && mode.phaseCompletionOrder,
      soundKeys: mode && mode.soundKeys,
      finalBoardDigest: mode && mode.finalBoardDigest,
      executionDigest: mode && mode.executionDigest
    }))
  }));
}

function readGitCommit(rootDir: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (_error) {
    return 'unknown';
  }
}

function createTopologyFixture(definition: TopologyFixtureDefinition): any {
  const boardConfig = SharedBoardUtils.normalizeBoardConfig(definition);
  const board = SharedBoardUtils.createEmptyBoard(boardConfig);
  const boardExpansion = {
    cells: (definition.expansionCells || []).map((cell) => ({ ...cell })),
    usedByPlayer: { black: false, white: false }
  };
  const cardState = {
    markers: (definition.holes || []).map((cell, index) => ({
      id: `baseline-hole-${index}`,
      kind: 'specialStone',
      row: cell.row,
      col: cell.col,
      data: { type: 'METEOR_HOLE' }
    }))
  };
  SharedBoardUtils.attachBoardShape(board, { boardConfig, boardExpansion, cardState });
  const state = { board, boardConfig, boardExpansion, cardState };
  const topology = SharedBoardUtils.buildBoardTopology(state, { cardState });
  const snapshot = {
    name: definition.name,
    config: { rows: boardConfig.rows, cols: boardConfig.cols, shape: boardConfig.shape },
    baseKeys: Array.from(topology.baseKeys).sort(),
    expansionKeys: Array.from(topology.expansionKeys).sort(),
    existingKeys: Array.from(topology.existingKeys).sort(),
    playableKeys: Array.from(topology.playableKeys).sort(),
    holeKeys: Array.from(topology.holeKeys).sort(),
    contentBounds: topology.contentBounds,
    renderBounds: topology.renderBounds,
    candidateBounds: topology.candidateBounds
  };
  return {
    ...snapshot,
    digest: sha256(stableJson(snapshot))
  };
}

function buildTopologyFixtures(): any[] {
  return TOPOLOGY_FIXTURES.map(createTopologyFixture);
}

function listSourceFiles(rootDir: string): string[] {
  const roots = ['ui', 'scripts', 'test', 'tests'];
  const output: string[] = [];
  const visit = (absoluteDir: string): void => {
    if (!fs.existsSync(absoluteDir)) return;
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolute = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'worker-public') continue;
        visit(absolute);
      } else if (/\.(?:ts|js)$/.test(entry.name)) {
        output.push(path.relative(rootDir, absolute).replace(/\\/g, '/'));
      }
    }
  };
  roots.forEach((relative) => visit(path.join(rootDir, relative)));
  return output.sort();
}

function countSelectorToken(source: string, token: '.cell' | '.disc'): number {
  const escaped = token.replace('.', '\\.');
  const pattern = new RegExp(`${escaped}(?![A-Za-z0-9_-])`, 'g');
  return (source.match(pattern) || []).length;
}

function countIdentifierToken(source: string, token: string): number {
  const pattern = new RegExp(`\\b${token}\\b`, 'g');
  return (source.match(pattern) || []).length;
}

function collectSelectorInventory(rootDir: string): any {
  const entries: Array<{ path: string; category: string; tokens: Record<string, number> }> = [];
  const totals: Record<string, number> = Object.fromEntries(SELECTOR_TOKENS.map((token) => [token, 0]));
  for (const relativePath of listSourceFiles(rootDir)) {
    if (SELECTOR_INVENTORY_EXCLUDES.has(relativePath)) continue;
    const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
    const tokens: Record<string, number> = {};
    for (const token of SELECTOR_TOKENS) {
      const count = token === '.cell' || token === '.disc'
        ? countSelectorToken(source, token)
        : countIdentifierToken(source, token);
      if (count > 0) {
        tokens[token] = count;
        totals[token] += count;
      }
    }
    if (Object.keys(tokens).length > 0) {
      entries.push({ path: relativePath, category: relativePath.split('/')[0], tokens });
    }
  }
  const byCategory = entries.reduce((acc: Record<string, number>, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + 1;
    return acc;
  }, {});
  return {
    tokens: SELECTOR_TOKENS,
    totals,
    byCategory,
    entries,
    digest: sha256(stableJson(entries))
  };
}

function collectPresentationInventory(rootDir: string): any {
  const sourcePaths = [
    'ui/animation-engine.ts',
    'ui/animation-flip-events.ts',
    'ui/animation-placement-events.ts',
    'ui/animation-destroy-events.ts',
    'ui/animation-destroy-source-events.ts',
    'ui/animation-move-events.ts',
    'ui/animation-status-events.ts',
    'ui/animation-theory-events.ts',
    'ui/presentation-handler.ts',
    'ui/playback-engine.ts',
    'ui/network/presentation-timeline.ts',
    'ui/network/visual-state-store.ts'
  ];
  const sources = sourcePaths.map((relativePath) => {
    const absolute = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolute)) throw new Error(`presentation baseline source is missing: ${relativePath}`);
    return { path: relativePath, sha256: sha256(fs.readFileSync(absolute)) };
  });
  return {
    eventTypes: PRESENTATION_EVENT_TYPES,
    sources,
    digest: sha256(stableJson({ eventTypes: PRESENTATION_EVENT_TYPES, sources }))
  };
}

function createPlaybackEventFixture(): any {
  const initialBoard = Array.from({ length: 8 }, () => Array(8).fill(0));
  initialBoard[3][2] = -1;
  initialBoard[3][3] = -1;
  initialBoard[4][4] = 1;
  initialBoard[5][2] = 1;
  const events = [
    { type: 'place', phase: 1, targets: [{ r: 3, col: 4, owner: 'black', after: { color: 1 } }] },
    { type: 'sound_effect', phase: 1, targets: [{ soundKey: 'stone_place' }] },
    { type: 'flip', phase: 2, targets: [{ r: 3, col: 3, ownerBefore: 'white', ownerAfter: 'black', after: { color: 1 } }] },
    { type: 'sound_effect', phase: 2, targets: [{ soundKey: 'stone_flip' }] },
    { type: 'destroy', phase: 3, targets: [{ r: 5, col: 2, ownerBefore: 'black', cause: 'SNIPER_WILL', reason: 'sniper_shot' }] },
    { type: 'sound_effect', phase: 3, targets: [{ soundKey: 'stone_destroy' }] },
    { type: 'spawn', phase: 4, targets: [{ r: 2, col: 2, owner: 'white', special: 'BREEDING', after: { color: -1, special: 'BREEDING' } }] },
    { type: 'sound_effect', phase: 4, targets: [{ soundKey: 'breeding_spawn' }] },
    { type: 'move', phase: 5, targets: [{ from: { r: 4, col: 4 }, to: { r: 4, col: 6 }, owner: 'black', after: { color: 1 }, cause: 'TELEPORT_WILL', reason: 'teleport_move' }] },
    { type: 'sound_effect', phase: 5, targets: [{ soundKey: 'hyperactive_move' }] },
    { type: 'status_applied', phase: 6, targets: [{ r: 4, col: 6, owner: 'black', special: 'GUARD', remainingOwnerTurns: 3 }] },
    { type: 'sound_effect', phase: 6, targets: [{ soundKey: 'guard_apply' }] },
    { type: 'spawn', phase: 7, rawType: 'BOARD_EXPANSION', targets: [{ r: -1, col: 3, owner: 'black', after: { color: 1 }, reason: 'board_expansion' }] },
    { type: 'sound_effect', phase: 7, targets: [{ soundKey: 'board_expand' }] },
    { type: 'theory_incarnation_spawn_roulette', phase: 8, targets: [{ r: 1, col: 1, owner: 'white', special: 'THEORY_INCARNATION', after: { color: -1, special: 'THEORY_INCARNATION' } }] },
    { type: 'sound_effect', phase: 8, targets: [{ soundKey: 'theory_incarnation_spawn' }] },
    { type: 'observer_bubble', phase: 9, targets: [{ r: 1, col: 1, owner: 'white', reason: 'observer_will' }] },
    { type: 'manifest_ending', phase: 10, targets: [{ owner: 'white', special: 'ULTIMATE_REVERSE_DRAGON' }] },
    { type: 'sound_effect', phase: 10, targets: [{ soundKey: 'manifest_ending' }] }
  ];
  const finalBoard = initialBoard.map((row: number[]) => row.slice());
  finalBoard[3][4] = 1;
  finalBoard[3][3] = 1;
  finalBoard[5][2] = 0;
  finalBoard[2][2] = -1;
  finalBoard[4][4] = 0;
  finalBoard[4][6] = 1;
  finalBoard[1][1] = -1;
  return {
    name: 'representative-production-playback',
    config: { rows: 8, cols: 8, shape: 'rectangle' },
    initialBoard,
    finalBoard,
    finalExpansionCells: [{ row: -1, col: 3, side: 'top', owner: 1 }],
    finalMarkers: [
      { id: 'playback-breeding', kind: 'specialStone', row: 2, col: 2, owner: 'white', data: { type: 'BREEDING', remainingOwnerTurns: 3 } },
      { id: 'playback-guard', kind: 'specialStone', row: 4, col: 6, owner: 'black', data: { type: 'GUARD', remainingOwnerTurns: 3 } },
      { id: 'playback-theory', kind: 'specialStone', row: 1, col: 1, owner: 'white', data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 4 } }
    ],
    events
  };
}

function collectPlaybackSoundKeys(events: any[]): string[] {
  const keys: string[] = [];
  const add = (value: any): void => {
    const key = typeof value === 'string' ? value.trim() : '';
    if (key && !keys.includes(key)) keys.push(key);
  };
  for (const event of events) {
    add(event && event.soundKey);
    add(event && event.meta && event.meta.soundKey);
    for (const target of (event && Array.isArray(event.targets) ? event.targets : [])) {
      add(target && target.soundKey);
      add(target && target.meta && target.meta.soundKey);
    }
  }
  return keys;
}

function buildPlaybackEventFixtureContract(): any {
  const fixture = createPlaybackEventFixture();
  const inputDigest = sha256(stableJson(fixture.events));
  const semanticDigest = PlaybackDigest.computePlaybackDigest(fixture.events);
  return {
    fixtureName: fixture.name,
    sourceEventTypes: PRESENTATION_EVENT_TYPES,
    eventCount: fixture.events.length,
    events: fixture.events,
    inputDigest,
    semanticDigest,
    declaredSoundKeys: collectPlaybackSoundKeys(fixture.events),
    canonicalFinalDigest: sha256(stableJson({
      board: fixture.finalBoard,
      markers: fixture.finalMarkers,
      expansionCells: fixture.finalExpansionCells
    })),
    digest: sha256(stableJson(fixture))
  };
}

function createNetworkBoard(source?: { row: number; col: number }, destination?: { row: number; col: number }): number[][] {
  const board = Array.from({ length: 8 }, () => Array(8).fill(0));
  if (source) board[source.row][source.col] = 1;
  if (destination) board[destination.row][destination.col] = 1;
  return board;
}

function createNetworkSnapshot(version: number, options?: any): any {
  const opts = options && typeof options === 'object' ? options : {};
  return {
    stateVersion: version,
    _meta: { authority: 'server', version, turnStartReconciled: true },
    gameState: {
      currentPlayer: 1,
      turnNumber: version,
      board: opts.board || createNetworkBoard()
    },
    cardState: {
      markers: opts.markers || [],
      pendingEffectByPlayer: opts.pendingEffectByPlayer || { black: null, white: null },
      presentationEvents: []
    }
  };
}

function createNetworkFrame(visualSeq: number, from: number, to: number, playbackEvents: any[], snapshotAfter: any): any {
  return {
    roomId: 'PIXIBASE',
    visualSeq,
    stateVersionFrom: from,
    stateVersionTo: to,
    operationId: `pixi_baseline_${visualSeq}`,
    actorSeatKey: 'black',
    actionType: 'place',
    playbackEvents,
    snapshotAfter,
    createdAt: 1000 + visualSeq
  };
}

async function runNetworkTimelineScenario(config: any): Promise<any> {
  const store = NetworkVisualStateStore.createNetworkVisualStateStore();
  store.setCanonicalSnapshot(config.canonicalSnapshot);
  store.setBaseVisualSnapshot(config.baseSnapshot, {
    visualSeq: config.initialVisualSeq || 0,
    visualVersion: config.initialVisualVersion,
    source: 'baseline'
  });
  const commits: any[] = [];
  const playback: any[] = [];
  const timeline = NetworkPresentationTimeline.createNetworkPresentationTimeline({
    initialVisualSeq: config.initialVisualSeq || 0,
    initialVisualVersion: config.initialVisualVersion,
    visualStateStore: store,
    onFrameCommitted: (frame: any, meta: any) => {
      commits.push({ visualSeq: frame.visualSeq, visualVersion: meta.visualVersion, snapshot: store.peekRenderSnapshot() });
    }
  });
  const checkpoints: any[] = [];
  const dispatcher = {
    dispatchNetworkPlaybackEvents: async (events: any[], meta: any) => {
      playback.push({ events, meta, renderSnapshot: store.peekRenderSnapshot() });
      return { started: true, method: 'baseline' };
    }
  };
  for (const step of config.steps) {
    const accepted = timeline.enqueueFrames(step.frames, step.options);
    const drained = step.drain === false ? 0 : await timeline.drainPlayableFrames(dispatcher);
    checkpoints.push({ accepted, drained, diagnostics: timeline.getDiagnostics() });
  }
  const result = {
    name: config.name,
    checkpoints,
    playback,
    commits,
    timeline: timeline.getDiagnostics(),
    store: store.getDiagnostics(),
    renderSnapshot: store.getRenderSnapshot()
  };
  return {
    name: config.name,
    checkpoints,
    playbackDigest: sha256(stableJson(playback)),
    commitDigest: sha256(stableJson(commits)),
    finalVisualDigest: sha256(stableJson(result.renderSnapshot)),
    finalDiagnostics: { timeline: result.timeline, store: result.store },
    digest: sha256(stableJson(result))
  };
}

async function buildNetworkVisualBaselines(): Promise<any> {
  const emptyEvents = [{ type: 'status_applied', phase: 1, targets: [{ r: 0, col: 0, special: 'BASELINE' }] }];
  const reconnectBase = createNetworkSnapshot(1);
  const reconnectV2 = createNetworkSnapshot(2);
  const reconnectV3 = createNetworkSnapshot(3);
  const reconnectFrames = [
    createNetworkFrame(1, 1, 2, emptyEvents, reconnectV2),
    createNetworkFrame(2, 2, 3, emptyEvents, reconnectV3)
  ];
  const source = { row: 3, col: 3 };
  const destination = { row: 3, col: 4 };
  const moveBase = createNetworkSnapshot(4, { board: createNetworkBoard(source) });
  const moveFinal = createNetworkSnapshot(5, { board: createNetworkBoard(undefined, destination) });
  const moveEvents = [{
    type: 'move', phase: 1, targets: [{
      from: { r: source.row, col: source.col },
      to: { r: destination.row, col: destination.col },
      cause: 'ROBOT_VACUUM_WILL',
      reason: 'robot_vacuum_move'
    }]
  }];
  const pendingBase = createNetworkSnapshot(8, {
    pendingEffectByPlayer: {
      black: { type: 'FREE_PLACEMENT', stage: 'selectTarget', effectId: 'baseline-pending' },
      white: null
    }
  });
  const pendingFinal = createNetworkSnapshot(9);
  const scenarios = await Promise.all([
    runNetworkTimelineScenario({
      name: 'reconnect-journal-gap-recovery',
      initialVisualVersion: 1,
      baseSnapshot: reconnectBase,
      canonicalSnapshot: reconnectV3,
      steps: [
        { frames: [reconnectFrames[1]], options: { source: 'stream', allowBaseCursorAdvance: false } },
        { frames: reconnectFrames, options: { source: 'journal_recovery', allowBaseCursorAdvance: true } }
      ]
    }),
    runNetworkTimelineScenario({
      name: 'late-snapshot-base-cursor-advance',
      initialVisualVersion: 1,
      baseSnapshot: reconnectBase,
      canonicalSnapshot: reconnectV3,
      steps: [{
        frames: [createNetworkFrame(2, 2, 3, emptyEvents, reconnectV3)],
        options: { source: 'stream', allowBaseCursorAdvance: true }
      }]
    }),
    runNetworkTimelineScenario({
      name: 'move-source-empty-after-visual-commit',
      initialVisualVersion: 4,
      baseSnapshot: moveBase,
      canonicalSnapshot: moveFinal,
      steps: [{
        frames: [createNetworkFrame(1, 4, 5, moveEvents, moveFinal)],
        options: { source: 'state_sync', allowBaseCursorAdvance: false }
      }]
    }),
    runNetworkTimelineScenario({
      name: 'pending-selection-reconcile-after-visual-commit',
      initialVisualVersion: 8,
      baseSnapshot: pendingBase,
      canonicalSnapshot: pendingFinal,
      steps: [{
        frames: [createNetworkFrame(1, 8, 9, [{ type: 'status_removed', phase: 1, targets: [] }], pendingFinal)],
        options: { source: 'state_sync', allowBaseCursorAdvance: false }
      }]
    })
  ]);
  return {
    scenarios,
    digest: sha256(stableJson(scenarios))
  };
}

function roundMetric(value: any): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 1000) / 1000 : 0;
}

async function applyBrowserFixture(page: any, fixture: BrowserFixtureDefinition): Promise<any> {
  await page.evaluate((definition: any) => {
    const root = window as any;
    const resolveModule = (globalNames: string[], moduleId: string): any => {
      for (const name of globalNames) {
        if (root[name]) return root[name];
      }
      try {
        if (typeof root.require === 'function') return root.require(moduleId);
      } catch (_error) { /* ignore */ }
      return null;
    };
    const core = resolveModule(['CoreLogic', 'Core'], 'game/logic/core');
    const boardUtils = resolveModule(['SharedBoardUtils'], 'shared/shared-board-utils');
    if (!core || typeof core.createGameState !== 'function') throw new Error('CoreLogic.createGameState unavailable');
    const gameState = core.createGameState({ rows: definition.rows, cols: definition.cols, shape: definition.shape });
    gameState.boardExpansion = {
      active: Array.isArray(definition.expansionCells) && definition.expansionCells.length > 0,
      side: definition.expansionCells && definition.expansionCells.length ? definition.expansionCells[definition.expansionCells.length - 1].side : null,
      row: definition.expansionCells && definition.expansionCells.length ? definition.expansionCells[definition.expansionCells.length - 1].row : null,
      owner: definition.expansionCells && definition.expansionCells.length ? definition.expansionCells[definition.expansionCells.length - 1].owner : 0,
      usedByPlayer: { black: false, white: false },
      cells: (definition.expansionCells || []).map((cell: any) => ({ ...cell }))
    };
    const cardState = root.cardState && typeof root.cardState === 'object' ? root.cardState : {};
    const holeMarkers = (definition.holes || []).map((cell: any, index: number) => ({
      id: `pixi-baseline-hole-${index}`,
      kind: 'specialStone',
      row: cell.row,
      col: cell.col,
      owner: 'black',
      data: { type: 'METEOR_HOLE' }
    }));
    const markers = holeMarkers.concat((definition.markers || []).map((marker: any) => JSON.parse(JSON.stringify(marker))));
    cardState.markers = markers;
    cardState.pendingEffectByPlayer = { black: null, white: null };
    cardState.boardBonusByCell = {};
    cardState.boardBonusConsumedByCell = {};
    cardState.theoryNumberCellByCell = {};
    cardState.presentationEvents = [];
    cardState._presentationEventsPersist = [];
    for (const hole of (definition.holes || [])) {
      if (gameState.board[hole.row]) gameState.board[hole.row][hole.col] = 0;
    }
    for (const marker of markers) {
      if (!marker || marker.data?.type === 'METEOR_HOLE' || marker.data?.type === 'SEED') continue;
      if (!gameState.board[marker.row] || !Number.isInteger(marker.col)) continue;
      gameState.board[marker.row][marker.col] = String(marker.owner || '').toLowerCase() === 'white' ? -1 : 1;
    }
    if (boardUtils && typeof boardUtils.attachBoardShape === 'function') {
      boardUtils.attachBoardShape(gameState.board, {
        boardConfig: gameState.boardConfig,
        boardExpansion: gameState.boardExpansion,
        cardState
      });
    }
    root.gameState = gameState;
    root.cardState = cardState;

    const skin = definition.skin || {
      board: 'bluegreen-felt', frame: 'marsh-forged-iron', stone: 'o-stone'
    };
    const boardSkinRuntime = resolveModule(['BoardSkinRuntimeModule'], 'ui/board-skin/runtime');
    const stoneSkinRuntime = resolveModule(['StoneSkinRuntimeModule'], 'ui/stone-skin/runtime');
    if (boardSkinRuntime && typeof boardSkinRuntime.applyBoardSkin === 'function') boardSkinRuntime.applyBoardSkin(root, skin.board);
    if (boardSkinRuntime && typeof boardSkinRuntime.applyBoardFrameSkin === 'function') boardSkinRuntime.applyBoardFrameSkin(root, skin.frame);
    if (stoneSkinRuntime && typeof stoneSkinRuntime.applyStoneSkin === 'function') stoneSkinRuntime.applyStoneSkin(root, skin.stone);

    const board = document.getElementById('board');
    if (!board || typeof root.forceFullRender !== 'function') throw new Error('DOM board renderer unavailable');
    root.forceFullRender(board);
  }, fixture);

  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  if (fixture.decoratePresentation) {
    await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('#board .cell:not(.cell-void)')) as HTMLElement[];
      const add = (index: number, ...classes: string[]) => {
        const cell = cells[index];
        if (cell) cell.classList.add(...classes);
      };
      add(0, 'legal');
      add(1, 'legal-free');
      add(2, 'effect-target-highlight');
      add(3, 'effect-target-highlight-positive');
      add(4, 'random-spawn-preview');
      add(5, 'super-attraction-path-preview');
      add(6, 'super-attraction-preview-destination');
      add(7, 'selectable-friendly');
      add(8, 'keyboard-legal-cursor');
    });
  }
  await page.evaluate(() => (document as any).fonts && (document as any).fonts.ready);
  await page.waitForTimeout(120);
  return page.evaluate((definition: any) => {
    const round = (value: number) => Math.round(value * 1000) / 1000;
    const rectSnapshot = (element: Element | null): any => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height) };
    };
    const board = document.getElementById('board');
    const frame = document.getElementById('board-frame');
    const cells = Array.from(document.querySelectorAll('#board .cell')) as HTMLElement[];
    const semanticCells = cells.map((cell) => ({
      row: Number(cell.dataset.row),
      col: Number(cell.dataset.col),
      classes: Array.from(cell.classList).sort(),
      children: Array.from(cell.children).map((child) => ({
        tag: child.tagName.toLowerCase(),
        classes: Array.from(child.classList).sort(),
        text: String(child.textContent || '').trim()
      }))
    }));
    const classHistogram: Record<string, number> = {};
    for (const cell of semanticCells) {
      for (const className of cell.classes) classHistogram[className] = (classHistogram[className] || 0) + 1;
    }
    const requestedKeys = new Set<string>([
      '0,0',
      `${Math.floor(definition.rows / 2)},${Math.floor(definition.cols / 2)}`,
      `${definition.rows - 1},${definition.cols - 1}`,
      ...(definition.expansionCells || []).map((cell: any) => `${cell.row},${cell.col}`)
    ]);
    const selectedClientRects: Record<string, any> = {};
    for (const key of requestedKeys) {
      const [row, col] = key.split(',');
      selectedClientRects[key] = rectSnapshot(document.querySelector(`#board .cell[data-row="${row}"][data-col="${col}"]`));
    }
    const starPseudo = cells.map((cell) => {
      const before = getComputedStyle(cell, '::before');
      const after = getComputedStyle(cell, '::after');
      return {
        key: `${cell.dataset.row},${cell.dataset.col}`,
        before: { content: before.content, background: before.backgroundColor, width: before.width, height: before.height },
        after: { content: after.content, background: after.backgroundColor, width: after.width, height: after.height }
      };
    }).filter((item) => (
      (item.before.content && item.before.content !== 'none' && item.before.content !== 'normal')
      || (item.after.content && item.after.content !== 'none' && item.after.content !== 'normal')
      || (item.before.background && item.before.background !== 'rgba(0, 0, 0, 0)')
      || (item.after.background && item.after.background !== 'rgba(0, 0, 0, 0)')
    ));
    const firstExistingCell = document.querySelector('#board .cell:not(.cell-void)');
    const boardRect = rectSnapshot(board);
    const firstCellRect = rectSnapshot(firstExistingCell);
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      fixture: definition.name,
      config: { rows: definition.rows, cols: definition.cols, shape: definition.shape },
      captureKind: definition.captureKind,
      boardRect,
      frameRect: rectSnapshot(frame),
      firstCellRect,
      cellScale: boardRect && firstCellRect ? {
        widthToBoard: round(firstCellRect.width / boardRect.width),
        heightToBoard: round(firstCellRect.height / boardRect.height)
      } : null,
      selectedClientRects,
      cellCount: cells.length,
      existingCellCount: cells.filter((cell) => !cell.classList.contains('cell-void')).length,
      voidCellCount: cells.filter((cell) => cell.classList.contains('cell-void')).length,
      discCount: document.querySelectorAll('#board .disc').length,
      frameNodeCount: frame ? frame.querySelectorAll('*').length + 1 : 0,
      documentNodeCount: document.querySelectorAll('*').length,
      classHistogram,
      starPseudo,
      skinSnapshot: {
        boardSkinId: document.documentElement.getAttribute('data-board-skin-id'),
        frameSkinId: document.documentElement.getAttribute('data-board-frame-skin-id'),
        stoneSkinId: document.documentElement.getAttribute('data-stone-skin-id'),
        boardTexture: rootStyle.getPropertyValue('--board-surface-texture-image').trim(),
        frameImage: rootStyle.getPropertyValue('--board-frame-image').trim(),
        blackStoneImage: rootStyle.getPropertyValue('--normal-stone-black-image').trim(),
        whiteStoneImage: rootStyle.getPropertyValue('--normal-stone-white-image').trim()
      },
      semanticCells
    };
  }, fixture);
}

async function captureProductionPlaybackBaselines(page: any): Promise<any> {
  const fixture = createPlaybackEventFixture();
  const contract = buildPlaybackEventFixtureContract();
  const modeDefinitions = [
    { name: 'normal', reducedMotion: 'no-preference', noAnim: false },
    { name: 'reduced-motion', reducedMotion: 'reduce', noAnim: false },
    { name: 'NOANIM=1', reducedMotion: 'no-preference', noAnim: true }
  ];
  const modes: any[] = [];
  for (const mode of modeDefinitions) {
    await page.emulateMedia({ reducedMotion: mode.reducedMotion });
    const execution = await page.evaluate(async ({ playbackFixture, playbackMode }: any) => {
      const root = window as any;
      const resolveModule = (globalNames: string[], moduleId: string): any => {
        for (const name of globalNames) {
          if (root[name]) return root[name];
        }
        try {
          if (typeof root.require === 'function') return root.require(moduleId);
        } catch (_error) { /* ignore */ }
        return null;
      };
      const core = resolveModule(['CoreLogic', 'Core'], 'game/logic/core');
      const boardUtils = resolveModule(['SharedBoardUtils'], 'shared/shared-board-utils');
      const engine = resolveModule(['AnimationEngine'], 'ui/animation-engine');
      const board = document.getElementById('board');
      if (!core || !boardUtils || !engine || !board || typeof engine.play !== 'function') {
        throw new Error('production playback fixture runtime unavailable');
      }
      const createState = (boardValues: number[][], expansionCells: any[]) => {
        const state = core.createGameState(playbackFixture.config);
        state.board = boardValues.map((row: number[]) => row.slice());
        state.boardExpansion = {
          active: expansionCells.length > 0,
          side: expansionCells.length ? expansionCells[expansionCells.length - 1].side : null,
          row: expansionCells.length ? expansionCells[expansionCells.length - 1].row : null,
          owner: expansionCells.length ? expansionCells[expansionCells.length - 1].owner : 0,
          usedByPlayer: { black: false, white: false },
          cells: expansionCells.map((cell: any) => ({ ...cell }))
        };
        boardUtils.attachBoardShape(state.board, {
          boardConfig: state.boardConfig,
          boardExpansion: state.boardExpansion
        });
        return state;
      };
      const cardState = root.cardState && typeof root.cardState === 'object' ? root.cardState : {};
      cardState.pendingEffectByPlayer = { black: null, white: null };
      cardState.boardBonusByCell = {};
      cardState.boardBonusConsumedByCell = {};
      cardState.presentationEvents = [];
      cardState._presentationEventsPersist = [];
      cardState.markers = [];
      root.cardState = cardState;
      root.gameState = createState(playbackFixture.initialBoard, []);
      root.forceFullRender(board);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      cardState.markers = playbackFixture.finalMarkers.map((marker: any) => JSON.parse(JSON.stringify(marker)));
      root.gameState = createState(playbackFixture.finalBoard, playbackFixture.finalExpansionCells);
      boardUtils.attachBoardShape(root.gameState.board, {
        boardConfig: root.gameState.boardConfig,
        boardExpansion: root.gameState.boardExpansion,
        cardState
      });
      root.DISABLE_ANIMATIONS = playbackMode.noAnim === true;
      engine.boardEl = board;

      const phaseCompletionTrace: any[] = [];
      const soundKeys: string[] = [];
      const originalExecutePhase = engine.executePhase;
      const originalHandleSoundEffect = engine.handleSoundEffect;
      const soundEngine = root.SoundEngine && typeof root.SoundEngine === 'object'
        ? root.SoundEngine
        : null;
      const originalSoundInit = soundEngine && soundEngine.init;
      const originalPlayEffectByKey = soundEngine && soundEngine.playEffectByKey;
      if (soundEngine) {
        soundEngine.init = () => undefined;
        soundEngine.playEffectByKey = () => true;
      }
      let phaseDepth = 0;
      engine.executePhase = async function (events: any[]) {
        const depth = phaseDepth;
        phaseDepth += 1;
        const startedAt = performance.now();
        const phase = Number(events && events[0] && events[0].phase || 0);
        try {
          return await originalExecutePhase.call(this, events);
        } finally {
          phaseDepth -= 1;
          phaseCompletionTrace.push({
            phase,
            depth,
            durationMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
            eventTypes: (Array.isArray(events) ? events : []).map((event: any) => event && event.type || null)
          });
        }
      };
      engine.handleSoundEffect = async function (event: any) {
        const values: string[] = [];
        if (event && event.soundKey) values.push(String(event.soundKey));
        for (const target of (event && Array.isArray(event.targets) ? event.targets : [])) {
          if (target && target.soundKey) values.push(String(target.soundKey));
        }
        for (const value of values) {
          const key = value.trim();
          if (key && !soundKeys.includes(key)) soundKeys.push(key);
        }
        return originalHandleSoundEffect.call(this, event);
      };

      const startedAt = performance.now();
      try {
        await engine.play(playbackFixture.events);
      } finally {
        engine.executePhase = originalExecutePhase;
        engine.handleSoundEffect = originalHandleSoundEffect;
        if (soundEngine) {
          soundEngine.init = originalSoundInit;
          soundEngine.playEffectByKey = originalPlayEffectByKey;
        }
        root.DISABLE_ANIMATIONS = false;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const cells = Array.from(document.querySelectorAll('#board .cell, #board-expansion-layer .cell')) as HTMLElement[];
      const dom = cells.map((cell) => ({
        row: Number(cell.dataset.row),
        col: Number(cell.dataset.col),
        classes: Array.from(cell.classList).sort(),
        children: Array.from(cell.children).map((child) => ({
          classes: Array.from(child.classList).sort(),
          text: String(child.textContent || '').trim()
        }))
      })).sort((left, right) => left.row - right.row || left.col - right.col);
      return {
        durationMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
        phaseCompletionTrace,
        phaseCompletionOrder: phaseCompletionTrace.filter((entry) => entry.depth === 0).map((entry) => entry.phase),
        soundKeys,
        finalVisualState: {
          board: root.gameState.board,
          boardExpansion: root.gameState.boardExpansion,
          markers: root.cardState.markers,
          dom
        },
        playbackActive: root.VisualPlaybackActive === true,
        processing: root.isProcessing === true,
        cardAnimating: root.isCardAnimating === true
      };
    }, { playbackFixture: fixture, playbackMode: mode });
    const finalBoardDigest = sha256(stableJson(execution.finalVisualState));
    const phaseCompletionOrder = execution.phaseCompletionOrder;
    if (stableJson(phaseCompletionOrder) !== stableJson([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) {
      throw new Error(`${mode.name} production playback phase order drifted: ${stableJson(phaseCompletionOrder)}`);
    }
    if (stableJson(execution.soundKeys) !== stableJson(contract.declaredSoundKeys)) {
      throw new Error(`${mode.name} production playback sound keys drifted: ${stableJson(execution.soundKeys)}`);
    }
    if (execution.playbackActive || execution.processing || execution.cardAnimating) {
      throw new Error(`${mode.name} production playback did not settle interaction flags`);
    }
    const executionDigest = buildStablePlaybackExecutionDigest({
      mode,
      execution,
      inputDigest: contract.inputDigest,
      semanticDigest: contract.semanticDigest,
      finalBoardDigest
    });
    modes.push({
      name: mode.name,
      prefersReducedMotion: mode.reducedMotion === 'reduce',
      noAnim: mode.noAnim,
      animationsEnabled: mode.noAnim !== true,
      inputDigest: contract.inputDigest,
      semanticDigest: contract.semanticDigest,
      phaseCompletionOrder,
      phaseCompletionTrace: execution.phaseCompletionTrace,
      soundKeys: execution.soundKeys,
      durationMs: execution.durationMs,
      finalBoardDigest,
      executionDigest
    });
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return {
    fixtureName: contract.fixtureName,
    productionModule: 'ui/animation-engine',
    sourceEventTypes: contract.sourceEventTypes,
    eventCount: contract.eventCount,
    inputDigest: contract.inputDigest,
    semanticDigest: contract.semanticDigest,
    declaredSoundKeys: contract.declaredSoundKeys,
    canonicalFinalDigest: contract.canonicalFinalDigest,
    modes,
    digest: buildStablePlaybackAggregateDigest(contract, modes)
  };
}

async function captureBrowserPerformance(page: any): Promise<any> {
  const idle = await page.evaluate(async () => {
    const root = window as any;
    const startCount = Number(root.__pixiBaselineRafCallbackCount || 0);
    await new Promise((resolve) => setTimeout(resolve, 350));
    return {
      durationMs: 350,
      callbackCount: Number(root.__pixiBaselineRafCallbackCount || 0) - startCount,
      pixiTickerPresent: !!(root.PIXI && root.__PIXI_APP__ && root.__PIXI_APP__.ticker)
    };
  });
  const measurements = await page.evaluate(async () => {
    const root = window as any;
    const board = document.getElementById('board');
    const core = root.CoreLogic || root.Core || (typeof root.require === 'function' ? root.require('game/logic/core') : null);
    if (!board || !core || typeof root.forceFullRender !== 'function') throw new Error('performance fixture runtime unavailable');
    const state = core.createGameState({ rows: 8, cols: 8, shape: 'rectangle' });
    root.gameState = state;
    root.forceFullRender(board);
    const coordinates = [[2, 2], [2, 3], [2, 4], [3, 2], [3, 5], [4, 2], [4, 5], [5, 3]];
    const frameDeltas: number[] = [];
    for (let index = 0; index < 30; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const startedAt = performance.now();
      for (const [row, col] of coordinates) state.board[row][col] = index % 2 === 0 ? 1 : -1;
      root.forceFullRender(board);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      frameDeltas.push(performance.now() - startedAt);
    }
    const state16 = core.createGameState({ rows: 16, cols: 16, shape: 'rectangle' });
    root.gameState = state16;
    const applyStartedAt = performance.now();
    root.forceFullRender(board);
    const sixteenApplyMs = performance.now() - applyStartedAt;
    const sorted = frameDeltas.slice().sort((a, b) => a - b);
    const percentile = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
    return {
      frameSampleCount: sorted.length,
      multiFlipFrameP50Ms: percentile(0.5),
      multiFlipFrameP95Ms: percentile(0.95),
      sixteenBySixteenApplyMs: sixteenApplyMs,
      sixteenBySixteenCellCount: board.querySelectorAll('.cell').length,
      sixteenBySixteenDomNodeCount: document.querySelectorAll('*').length
    };
  });
  return {
    idle,
    frameSampleCount: measurements.frameSampleCount,
    multiFlipFrameP50Ms: roundMetric(measurements.multiFlipFrameP50Ms),
    multiFlipFrameP95Ms: roundMetric(measurements.multiFlipFrameP95Ms),
    sixteenBySixteenApplyMs: roundMetric(measurements.sixteenBySixteenApplyMs),
    sixteenBySixteenCellCount: measurements.sixteenBySixteenCellCount,
    sixteenBySixteenDomNodeCount: measurements.sixteenBySixteenDomNodeCount
  };
}

function buildExpansionRectComparisons(fixtures: any[]): any[] {
  const baseline = fixtures.find((fixture) => fixture.fixture === 'rectangle-8x8-four-stars');
  if (!baseline) return [];
  return fixtures
    .filter((fixture) => /^rectangle-8x8-expanded-|rectangle-8x8-multistage-negative$/.test(fixture.fixture))
    .map((fixture) => {
      const keys = ['0,0', '4,4', '7,7'];
      const rects = keys.map((key) => {
        const before = baseline.selectedClientRects[key] || null;
        const after = fixture.selectedClientRects[key] || null;
        return {
          key,
          before,
          after,
          delta: before && after ? {
            x: roundMetric(after.x - before.x),
            y: roundMetric(after.y - before.y),
            width: roundMetric(after.width - before.width),
            height: roundMetric(after.height - before.height)
          } : null
        };
      });
      return { fixture: fixture.fixture, rects, digest: sha256(stableJson(rects)) };
    });
}

async function captureBrowserLane(rootDir: string, lane: any, captureBuffers: Record<string, Buffer>, logProgress: boolean): Promise<any> {
  const fixtureCaptures: any[] = [];
  const result = await runBrowserUiControlSmoke({
    rootDir,
    entryPath: lane.entryPath,
    captureComparison: false,
    readyOnly: true,
    log: false,
    pageOptions: { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 },
    beforeGoto: async (page: any) => {
      await page.addInitScript(() => {
        const root = window as any;
        const original = window.requestAnimationFrame.bind(window);
        root.__pixiBaselineRafCallbackCount = 0;
        root.__pixiBaselineFirstBoardObservedMs = null;
        window.requestAnimationFrame = ((callback: FrameRequestCallback) => original((timestamp: number) => {
          root.__pixiBaselineRafCallbackCount += 1;
          callback(timestamp);
        })) as typeof window.requestAnimationFrame;
        const installBoardObserver = () => {
          if (!document.documentElement) return;
          const check = () => {
            const board = document.getElementById('board');
            const cell = board && board.querySelector('.cell');
            if (!board || !cell) return false;
            const rect = board.getBoundingClientRect();
            if (!(rect.width > 0 && rect.height > 0)) return false;
            if (root.__pixiBaselineFirstBoardObservedMs === null) {
              root.__pixiBaselineFirstBoardObservedMs = performance.now();
            }
            return true;
          };
          if (check()) return;
          const observer = new MutationObserver(() => {
            if (check()) observer.disconnect();
          });
          observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
        };
        if (document.documentElement) installBoardObserver();
        else document.addEventListener('DOMContentLoaded', installBoardObserver, { once: true });
      });
    },
    afterReady: async (page: any) => {
      const laneMeta = await page.evaluate(() => ({
        lane: String((window as any).__CARD_REVERSI_BROWSER_LANE__ || ''),
        htmlLane: String(document.documentElement.getAttribute('data-browser-lane') || ''),
        bootState: String(document.documentElement.getAttribute('data-browser-boot-state') || ''),
        firstBoardObservedMs: Number((window as any).__pixiBaselineFirstBoardObservedMs)
      }));
      for (const fixture of BROWSER_FIXTURES) {
        if (logProgress) console.log(`[pixijs-playfield-baseline] ${lane.key}: ${fixture.name}`);
        const semantic = await applyBrowserFixture(page, fixture);
        const capturePath = `${CAPTURE_DIR}/${lane.key}-${fixture.name}.png`;
        const buffer = await page.locator('#board').screenshot({
          type: 'png',
          animations: 'disabled',
          caret: 'hide'
        });
        captureBuffers[capturePath] = buffer;
        let frameCapturePath: string | null = null;
        let frameCaptureSha256: string | null = null;
        if (fixture.captureKind === 'presentation') {
          frameCapturePath = `${CAPTURE_DIR}/${lane.key}-${fixture.name}-frame.png`;
          const frameBuffer = await page.locator('#board-frame').screenshot({
            type: 'png',
            animations: 'disabled',
            caret: 'hide'
          });
          captureBuffers[frameCapturePath] = frameBuffer;
          frameCaptureSha256 = sha256(frameBuffer);
        }
        const semanticDigest = sha256(stableJson({
          cells: semantic.semanticCells,
          skin: semantic.skinSnapshot
        }));
        delete semantic.semanticCells;
        fixtureCaptures.push({
          ...semantic,
          semanticDigest,
          capturePath,
          captureSha256: sha256(buffer),
          frameCapturePath,
          frameCaptureSha256
        });
      }
      let productionPlayback = null;
      if (lane.key === 'classic') {
        if (logProgress) console.log('[pixijs-playfield-baseline] classic: production playback modes');
        productionPlayback = await captureProductionPlaybackBaselines(page);
      }
      if (logProgress) console.log(`[pixijs-playfield-baseline] ${lane.key}: performance`);
      return { laneMeta, productionPlayback, performance: await captureBrowserPerformance(page) };
    }
  });
  if (!result || !result.evaluation || result.evaluation.ok !== true) {
    const errors = result && result.evaluation && Array.isArray(result.evaluation.errors)
      ? result.evaluation.errors.join('; ')
      : 'missing comparison capture';
    throw new Error(`DOM lane baseline failed: ${errors}`);
  }
  const afterReadyResult = result.afterReadyResult as any;
  const performance = afterReadyResult?.performance || null;
  const laneMeta = afterReadyResult?.laneMeta || {};
  if (!(Number.isFinite(laneMeta.firstBoardObservedMs) && laneMeta.firstBoardObservedMs > 0)) {
    throw new Error(`${lane.key} did not record first board display timing`);
  }
  return {
    lane: laneMeta.lane || lane.key,
    htmlLane: laneMeta.htmlLane || lane.key,
    bootState: laneMeta.bootState || '',
    readyMs: result.readyMs,
    firstBoardObservedMs: roundMetric(laneMeta.firstBoardObservedMs),
    browserVersion: result.browserVersion,
    userAgent: result.userAgent,
    requestedResourceCount: result.requestedUrls.length,
    pageErrors: result.sample.pageErrors,
    consoleErrors: result.sample.consoleErrors,
    resourceErrors: result.sample.resourceErrors || [],
    fixtures: fixtureCaptures,
    fixtureDigest: sha256(stableJson(fixtureCaptures.map((fixture) => ({
      fixture: fixture.fixture,
      semanticDigest: fixture.semanticDigest,
      captureSha256: fixture.captureSha256,
      selectedClientRects: fixture.selectedClientRects
    })))),
    expansionRectComparisons: buildExpansionRectComparisons(fixtureCaptures),
    productionPlayback: afterReadyResult?.productionPlayback || null,
    performance
  };
}

function buildBrowserLaneParity(lanes: Record<string, any>): any {
  const classic = lanes.classic && Array.isArray(lanes.classic.fixtures) ? lanes.classic.fixtures : [];
  const vite = lanes.vite && Array.isArray(lanes.vite.fixtures) ? lanes.vite.fixtures : [];
  const comparisons = classic.map((classicFixture: any) => {
    const viteFixture = vite.find((fixture: any) => fixture.fixture === classicFixture.fixture);
    return {
      fixture: classicFixture.fixture,
      pixelMatch: !!viteFixture && classicFixture.captureSha256 === viteFixture.captureSha256,
      semanticMatch: !!viteFixture && classicFixture.semanticDigest === viteFixture.semanticDigest,
      classicCaptureSha256: classicFixture.captureSha256,
      viteCaptureSha256: viteFixture ? viteFixture.captureSha256 : null
    };
  });
  return {
    comparisons,
    allPixelMatch: comparisons.length === BROWSER_FIXTURES.length && comparisons.every((item: any) => item.pixelMatch),
    allSemanticMatch: comparisons.length === BROWSER_FIXTURES.length && comparisons.every((item: any) => item.semanticMatch),
    digest: sha256(stableJson(comparisons))
  };
}

function toMarkdown(report: any): string {
  const topologyRows = report.topologyFixtures.map((fixture: any) => (
    `| ${fixture.name} | ${fixture.config.rows}x${fixture.config.cols} ${fixture.config.shape} | ${fixture.existingKeys.length} | ${fixture.holeKeys.length} | \`${fixture.digest}\` |`
  )).join('\n');
  const laneRows = Object.values(report.browserLanes).map((lane: any) => (
    `| ${lane.lane} | ${lane.browserVersion} | ${lane.firstBoardObservedMs} / ${lane.readyMs} | ${lane.fixtures.length} | ${lane.performance.multiFlipFrameP50Ms} / ${lane.performance.multiFlipFrameP95Ms} | ${lane.performance.sixteenBySixteenApplyMs} | \`${lane.fixtureDigest}\` |`
  )).join('\n');
  const eventRows = report.playbackEvents.modes.map((mode: any) => (
    `| ${mode.name} | ${mode.phaseCompletionOrder.join(' → ')} | ${mode.soundKeys.length} | \`${mode.finalBoardDigest}\` |`
  )).join('\n');
  const networkRows = report.networkVisualState.scenarios.map((scenario: any) => (
    `| ${scenario.name} | \`${scenario.finalVisualDigest}\` | \`${scenario.digest}\` |`
  )).join('\n');
  return [
    '# PixiJS playfield migration DOM baseline',
    '',
    '- Status: active pre-migration baseline',
    `- Commit: \`${report.commit}\``,
    `- Captured at: ${report.capturedAt}`,
    `- Node: ${report.environment.node}`,
    `- Platform: ${report.environment.platform} ${report.environment.arch}`,
    '- Scope: classic/Vite DOM pixels and semantic render digests, topology/client rects, playback/event settlement, network visual state, performance, and selector dependencies',
    '',
    '## Browser lane captures',
    '',
    '| lane | browser version | first board / app ready ms | captures | multi-flip p50 / p95 ms | 16x16 apply ms | fixture digest |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
    laneRows || '| not captured | - | - | - | - | - | - |',
    '',
    `- Classic/Vite pixel parity: ${report.browserLaneParity.allPixelMatch ? 'PASS' : 'FAIL'}`,
    `- Classic/Vite semantic parity: ${report.browserLaneParity.allSemanticMatch ? 'PASS' : 'FAIL'}`,
    '',
    '## Topology fixtures',
    '',
    '| fixture | config | existing | holes | digest |',
    '| --- | --- | ---: | ---: | --- |',
    topologyRows,
    '',
    '## Playback event settlement',
    '',
    '| mode | phase completion order | sound keys | final board digest |',
    '| --- | --- | ---: | --- |',
    eventRows,
    '',
    '## Network visual-state settlement',
    '',
    '| scenario | final visual digest | scenario digest |',
    '| --- | --- | --- |',
    networkRows,
    '',
    '## Migration inventories',
    '',
    `- Presentation source digest: \`${report.presentationInventory.digest}\``,
    `- DOM selector dependency digest: \`${report.selectorInventory.digest}\``,
    `- Files with selector dependencies: ${report.selectorInventory.entries.length}`,
    '',
    '## Reproduction',
    '',
    '- `npm run baseline:pixijs-playfield`',
    '- Existing visual-regression baselines outside `pixijs-playfield-dom/` are not overwritten.',
    '- Timing values are machine-specific; compare only with the same browser, viewport, DPR, and machine.',
    ''
  ].join('\n');
}

async function capturePixijsPlayfieldBaseline(options: CaptureOptions = {}): Promise<any> {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const write = options.write !== false;
  const captureBrowsers = options.captureBrowsers !== false;
  const topologyFixtures = buildTopologyFixtures();
  const selectorInventory = collectSelectorInventory(rootDir);
  const presentationInventory = collectPresentationInventory(rootDir);
  const networkVisualState = await buildNetworkVisualBaselines();
  const browserLanes: Record<string, any> = {};
  const captureBuffers: Record<string, Buffer> = {};

  if (captureBrowsers) {
    for (const lane of [
      { key: 'classic', entryPath: '/index.classic.html' },
      { key: 'vite', entryPath: '/' }
    ]) {
      browserLanes[lane.key] = await captureBrowserLane(rootDir, lane, captureBuffers, options.log !== false);
    }
  }
  const browserLaneParity = buildBrowserLaneParity(browserLanes);
  if (captureBrowsers && (!browserLaneParity.allPixelMatch || !browserLaneParity.allSemanticMatch)) {
    const mismatches = browserLaneParity.comparisons
      .filter((item: any) => !item.pixelMatch || !item.semanticMatch)
      .map((item: any) => `${item.fixture}:pixel=${item.pixelMatch}:semantic=${item.semanticMatch}`);
    throw new Error(`classic/Vite DOM baseline parity failed: ${mismatches.join(', ')}`);
  }
  const playbackEvents = browserLanes.classic?.productionPlayback || {
    ...buildPlaybackEventFixtureContract(),
    productionModule: null,
    modes: []
  };
  if (captureBrowsers && playbackEvents.productionModule !== 'ui/animation-engine') {
    throw new Error('production playback baseline was not captured');
  }

  const report = {
    schemaVersion: 'pixijs_playfield_dom_baseline.v2',
    capturedAt: new Date().toISOString(),
    commit: readGitCommit(rootDir),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      viewport: { width: 1366, height: 900 },
      dpr: 1,
      browser: 'playwright-chromium',
      browserVersions: Object.fromEntries(Object.entries(browserLanes).map(([key, lane]) => [key, (lane as any).browserVersion || null])),
      userAgents: Object.fromEntries(Object.entries(browserLanes).map(([key, lane]) => [key, (lane as any).userAgent || null]))
    },
    browserFixtureDefinitions: BROWSER_FIXTURES,
    browserLanes,
    browserLaneParity,
    topologyFixtures,
    topologyDigest: sha256(stableJson(topologyFixtures)),
    playbackEvents,
    networkVisualState,
    presentationInventory,
    selectorInventory,
    verificationContracts: [
      'npm run match:playback-board-writer-check',
      'npm run compare:browser-lanes',
      'npm run test:visual',
      'npm run test:network:parity'
    ]
  };

  if (write) {
    const captureRoot = path.join(rootDir, CAPTURE_DIR);
    if (fs.existsSync(captureRoot)) {
      const expected = new Set(Object.keys(captureBuffers).map((relativePath) => path.resolve(rootDir, relativePath)));
      for (const entry of fs.readdirSync(captureRoot, { withFileTypes: true })) {
        const absolute = path.join(captureRoot, entry.name);
        if (entry.isFile() && entry.name.endsWith('.png') && !expected.has(path.resolve(absolute))) fs.unlinkSync(absolute);
      }
    }
    for (const [relativePath, buffer] of Object.entries(captureBuffers)) {
      const absolute = path.join(rootDir, relativePath);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, buffer);
    }
    const jsonPath = path.join(rootDir, REPORT_JSON_PATH);
    const markdownPath = path.join(rootDir, REPORT_MARKDOWN_PATH);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(markdownPath, toMarkdown(report), 'utf8');
  }
  if (options.log !== false) {
    console.log(JSON.stringify({
      schemaVersion: report.schemaVersion,
      browserCaptures: Object.fromEntries(Object.entries(browserLanes).map(([key, lane]) => [key, (lane as any).fixtures.length])),
      browserParity: browserLaneParity,
      topologyDigest: report.topologyDigest,
      playbackDigest: playbackEvents.digest,
      networkDigest: networkVisualState.digest,
      selectorDigest: selectorInventory.digest
    }, null, 2));
  }
  return report;
}

if (require.main === module) {
  capturePixijsPlayfieldBaseline().catch((error) => {
    console.error(`[pixijs-playfield-baseline] failed: ${error && error.message ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  BROWSER_FIXTURES,
  CAPTURE_DIR,
  PRESENTATION_EVENT_TYPES,
  REPORT_JSON_PATH,
  REPORT_MARKDOWN_PATH,
  SELECTOR_TOKENS,
  TOPOLOGY_FIXTURES,
  buildNetworkVisualBaselines,
  buildPlaybackEventFixtureContract,
  buildStablePlaybackAggregateDigest,
  buildStablePlaybackExecutionDigest,
  buildTopologyFixtures,
  capturePixijsPlayfieldBaseline,
  collectPresentationInventory,
  collectSelectorInventory,
  stableJson,
  toMarkdown
};
