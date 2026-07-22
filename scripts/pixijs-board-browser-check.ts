import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import BrowserUiControlSmoke from './browser-ui-control-smoke';
import PixijsPlayfieldBaseline from './capture-pixijs-playfield-baseline';

const { runBrowserUiControlSmoke } = BrowserUiControlSmoke as any;
const { BROWSER_FIXTURES, CAPTURE_DIR } = PixijsPlayfieldBaseline as any;

const DEFAULT_SKIN = Object.freeze({
  board: 'bluegreen-felt',
  frame: 'marsh-forged-iron',
  stone: 'o-stone'
});
const STATIC_ENTRY_QUERY = 'debug=1&boardRenderer=pixi&noanim=1';
const REQUIRED_EXPANSION_FIXTURES = Object.freeze([
  'rectangle-8x8-expanded-top',
  'rectangle-8x8-expanded-right',
  'rectangle-8x8-expanded-bottom',
  'rectangle-8x8-expanded-left',
  'rectangle-8x8-multistage-negative'
]);
const VIRTUALIZATION_FIXTURE = Object.freeze({
  name: 'virtualization-8x8-sparse-multistage',
  rows: 8,
  cols: 8,
  shape: 'rectangle',
  captureKind: 'topology',
  // Keep the base 8x8 cell size while making the sparse logical surface
  // larger than the viewport in both axes. The distant edge cells also
  // exercise ephemeral void materialization between sparse coordinates.
  expansionCells: Object.freeze([
    Object.freeze({ row: -4, col: 3, side: 'top', owner: 0 }),
    Object.freeze({ row: 11, col: 4, side: 'bottom', owner: 0 }),
    Object.freeze({ row: 3, col: -4, side: 'left', owner: 0 }),
    Object.freeze({ row: 4, col: 11, side: 'right', owner: 0 })
  ])
}) as FixtureDefinition;
const IDLE_RAF_OBSERVATION_MS = 180;
const RECT_TOLERANCE_PX = 0.05;
const GUTTER_TOLERANCE_PX = 1.5;
const PNG_PIXELMATCH_THRESHOLD = 0.12;
const PNG_DIFF_PIXEL_BUDGET = 4000;
const PHASE_ZERO_REPORT_PATH = 'docs/perf/pixijs-playfield-baseline.json';
const VIEWPORT_WIDTH = 1366;
const VIEWPORT_HEIGHT = 900;
const SPECIAL_TIMER_BADGE_FIXTURE = 'presentation-special-timer-badge';
const SPECIAL_TIMER_BADGE_EXPECTATIONS = Object.freeze({
  '1,1': Object.freeze({
    specialType: 'ULTIMATE_HYPERACTIVE',
    statusLabels: Object.freeze(['special:12', 'flip-evade:2', 'destroy-evade:3'])
  }),
  '1,2': Object.freeze({ specialType: 'GUARD', statusLabels: Object.freeze(['guard:4']) }),
  '1,3': Object.freeze({ specialType: 'REGEN', statusLabels: Object.freeze(['regen:3']) }),
  '1,4': Object.freeze({
    specialType: 'ZOMBIE',
    statusLabels: Object.freeze(['countdown:3', 'regen:1'])
  }),
  '2,1': Object.freeze({ specialType: 'TIME_STOP', statusLabels: Object.freeze(['countdown:4']) }),
  '2,2': Object.freeze({ specialType: 'TIME_BOMB', statusLabels: Object.freeze(['bomb:10']) }),
  '2,3': Object.freeze({ specialType: 'POISONED', statusLabels: Object.freeze(['poison:5']) }),
  // The frozen and manifest rows pin their dedicated marker/aura branches.
  '5,5': Object.freeze({ specialType: 'FREEZE', statusLabels: Object.freeze(['freeze:3']) }),
  '6,6': Object.freeze({
    specialType: 'ULTIMATE_REVERSE_DRAGON',
    statusLabels: Object.freeze(['special:8']),
    renderedMarkerKinds: Object.freeze(['special', 'manifest-aura'])
  })
});

type Lane = 'classic' | 'vite';

interface FixtureDefinition {
  name: string;
  rows: number;
  cols: number;
  shape: 'rectangle' | 'circle';
  captureKind: 'topology' | 'presentation';
  expansionCells?: Array<{ row: number; col: number; side: string; owner: number }>;
  breedingSproutByOwner?: {
    black?: Array<{ row: number; col: number }>;
    white?: Array<{ row: number; col: number }>;
  };
  holes?: Array<{ row: number; col: number }>;
  markers?: any[];
  decoratePresentation?: boolean;
  skin?: { board: string; frame: string; stone: string };
}

interface CheckOptions {
  rootDir?: string;
  lanes?: readonly Lane[];
  dprs?: readonly number[];
  log?: boolean;
  comparePhaseZero?: boolean;
}

function finite(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sha256(value: Buffer | string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fixtureByName(name: string): FixtureDefinition {
  const fixture = (BROWSER_FIXTURES as readonly FixtureDefinition[]).find((candidate) => candidate.name === name);
  if (!fixture) throw new Error(`Phase 0 browser fixture is missing: ${name}`);
  return fixture;
}

function topologyBounds(definition: FixtureDefinition): {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
  renderRows: number;
  renderCols: number;
} {
  const expansion = Array.isArray(definition.expansionCells) ? definition.expansionCells : [];
  const rows = [0, definition.rows - 1, ...expansion.map((cell) => cell.row)];
  const cols = [0, definition.cols - 1, ...expansion.map((cell) => cell.col)];
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  return {
    minRow,
    maxRow,
    minCol,
    maxCol,
    renderRows: maxRow - minRow + 1,
    renderCols: maxCol - minCol + 1
  };
}

function rectDelta(before: any, after: any): number {
  if (!before || !after) return Number.POSITIVE_INFINITY;
  return Math.max(
    Math.abs(finite(before.left) - finite(after.left)),
    Math.abs(finite(before.top) - finite(after.top)),
    Math.abs(finite(before.width) - finite(after.width)),
    Math.abs(finite(before.height) - finite(after.height))
  );
}

function isStrictMonotonicGrowth(values: readonly number[]): boolean {
  return values.length >= 3 && values.every((value, index) => index === 0 || value > values[index - 1]);
}

function hasNetGrowthAfterWarmup(values: readonly number[], warmupSamples = 1): boolean {
  const finiteValues = values.map((value) => finite(value));
  const warmup = Math.max(0, Math.min(
    Math.trunc(finite(warmupSamples)),
    Math.max(0, finiteValues.length - 2)
  ));
  const steady = finiteValues.slice(warmup);
  return steady.length >= 2 && steady[steady.length - 1] > steady[0];
}

function lifecycleSeriesGrowth(samples: readonly any[]): Record<string, boolean> {
  const metric = (read: (sample: any) => unknown) => hasNetGrowthAfterWarmup(
    samples.map((sample) => finite(read(sample)))
  );
  return Object.freeze({
    active: metric((sample) => sample.display?.active),
    pooled: metric((sample) => sample.display?.pooled),
    leases: metric((sample) => sample.leases?.total),
    backingWidth: metric((sample) => sample.canvasBackingWidth),
    backingHeight: metric((sample) => sample.canvasBackingHeight)
  });
}

function comparePngBuffers(baseline: Buffer, current: Buffer): {
  dimensionMatch: boolean;
  width: number;
  height: number;
  diffPixels: number;
} {
  const PNG = require('pngjs').PNG;
  let pixelmatch = require('pixelmatch');
  if (pixelmatch && pixelmatch.default) pixelmatch = pixelmatch.default;
  const left = PNG.sync.read(baseline);
  const right = PNG.sync.read(current);
  if (left.width !== right.width || left.height !== right.height) {
    return {
      dimensionMatch: false,
      width: right.width,
      height: right.height,
      diffPixels: Number.POSITIVE_INFINITY
    };
  }
  const diffPixels = pixelmatch(
    left.data,
    right.data,
    null,
    left.width,
    left.height,
    { threshold: PNG_PIXELMATCH_THRESHOLD }
  );
  return { dimensionMatch: true, width: right.width, height: right.height, diffPixels };
}

function readPhaseZeroFixtureBaseline(rootDir: string, lane: Lane, fixtureName: string): any | null {
  const reportPath = path.join(rootDir, PHASE_ZERO_REPORT_PATH);
  if (!fs.existsSync(reportPath)) return null;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const laneValue = report?.browserLanes?.[lane];
  const laneRuns = Array.isArray(laneValue) ? laneValue : (laneValue ? [laneValue] : []);
  for (const run of laneRuns) {
    const fixture = Array.isArray(run?.fixtures)
      ? run.fixtures.find((candidate: any) => candidate?.fixture === fixtureName)
      : null;
    if (fixture) return fixture;
  }
  return null;
}

function rectCoordinate(rect: any, axis: 'x' | 'y'): number {
  return finite(rect?.[axis], finite(rect?.[axis === 'x' ? 'left' : 'top'], Number.NaN));
}

function comparePhaseZeroGeometryAndSkin(probe: any, baselineFixture: any): {
  ok: boolean;
  baselineKeyCount: number;
  commonKeyCount: number;
  maxCellSizeDeltaPx: number;
  maxRelativePositionDeltaPx: number;
  skinMatch: boolean;
} {
  const baselineRects = baselineFixture?.selectedClientRects || {};
  const currentRects = probe?.cellRects || {};
  const baselineKeys = Object.keys(baselineRects);
  const commonKeys = baselineKeys.filter((key) => {
    const baseline = baselineRects[key];
    const current = currentRects[key];
    return baseline && current
      && Number.isFinite(rectCoordinate(baseline, 'x'))
      && Number.isFinite(rectCoordinate(baseline, 'y'))
      && Number.isFinite(rectCoordinate(current, 'x'))
      && Number.isFinite(rectCoordinate(current, 'y'))
      && Number.isFinite(Number(baseline.width))
      && Number.isFinite(Number(baseline.height))
      && Number.isFinite(Number(current.width))
      && Number.isFinite(Number(current.height));
  });
  let maxCellSizeDeltaPx = Number.POSITIVE_INFINITY;
  let maxRelativePositionDeltaPx = Number.POSITIVE_INFINITY;
  if (commonKeys.length > 0) {
    const anchorKey = commonKeys[0];
    const baselineAnchor = baselineRects[anchorKey];
    const currentAnchor = currentRects[anchorKey];
    maxCellSizeDeltaPx = 0;
    maxRelativePositionDeltaPx = 0;
    for (const key of commonKeys) {
      const baseline = baselineRects[key];
      const current = currentRects[key];
      maxCellSizeDeltaPx = Math.max(
        maxCellSizeDeltaPx,
        Math.abs(finite(current.width) - finite(baseline.width)),
        Math.abs(finite(current.height) - finite(baseline.height))
      );
      const baselineRelativeX = rectCoordinate(baseline, 'x') - rectCoordinate(baselineAnchor, 'x');
      const baselineRelativeY = rectCoordinate(baseline, 'y') - rectCoordinate(baselineAnchor, 'y');
      const currentRelativeX = rectCoordinate(current, 'x') - rectCoordinate(currentAnchor, 'x');
      const currentRelativeY = rectCoordinate(current, 'y') - rectCoordinate(currentAnchor, 'y');
      maxRelativePositionDeltaPx = Math.max(
        maxRelativePositionDeltaPx,
        Math.abs(currentRelativeX - baselineRelativeX),
        Math.abs(currentRelativeY - baselineRelativeY)
      );
    }
  }
  const baselineSkin = baselineFixture?.skinSnapshot || {};
  const skinMatch = probe?.skin?.board === baselineSkin.boardSkinId
    && probe?.skin?.frame === baselineSkin.frameSkinId
    && probe?.skin?.stone === baselineSkin.stoneSkinId;
  const fullCoverage = baselineKeys.length > 0 && commonKeys.length === baselineKeys.length;
  return {
    ok: fullCoverage
      && maxCellSizeDeltaPx <= RECT_TOLERANCE_PX
      && maxRelativePositionDeltaPx <= RECT_TOLERANCE_PX
      && skinMatch,
    baselineKeyCount: baselineKeys.length,
    commonKeyCount: commonKeys.length,
    maxCellSizeDeltaPx,
    maxRelativePositionDeltaPx,
    skinMatch
  };
}

async function installBrowserProbe(page: any): Promise<void> {
  await page.addInitScript(() => {
    const root = window as any;
    const originalRaf = window.requestAnimationFrame.bind(window);
    const contextEntries: Array<{ canvas: HTMLCanvasElement; context: unknown }> = [];
    let rafCallbackCount = 0;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => originalRaf((timestamp) => {
      rafCallbackCount += 1;
      callback(timestamp);
    })) as typeof window.requestAnimationFrame;

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(
      this: HTMLCanvasElement,
      type: any,
      ...args: any[]
    ): any {
      const context = (originalGetContext as any).call(this, type, ...args);
      if ((type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') && context) {
        const present = contextEntries.some((entry) => entry.canvas === this && entry.context === context);
        if (!present) contextEntries.push({ canvas: this, context });
      }
      return context;
    } as typeof HTMLCanvasElement.prototype.getContext;

    Object.defineProperty(root, '__pixiBoardBrowserCheckProbe', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({
        resetRafCallbacks() { rafCallbackCount = 0; },
        getRafCallbackCount() { return rafCallbackCount; },
        getConnectedBoardContextCount() {
          return new Set(contextEntries
            .filter((entry) => entry.canvas.isConnected && !!entry.canvas.closest('#board'))
            .map((entry) => entry.context)).size;
        }
      })
    });
  });
}

async function applyPhaseZeroFixture(page: any, fixture: FixtureDefinition): Promise<{
  presentationCandidateKeys: string[];
}> {
  const diagnostics = await page.evaluate(async (definition: FixtureDefinition) => {
    const root = window as any;
    const resolveModule = (globalNames: string[], moduleId: string): any => {
      for (const name of globalNames) {
        if (root[name]) return root[name];
      }
      try {
        if (typeof root.require === 'function') return root.require(moduleId);
      } catch (_error) { /* explicit failure below */ }
      return null;
    };
    const core = resolveModule(['CoreLogic', 'Core'], 'game/logic/core');
    const boardUtils = resolveModule(['SharedBoardUtils'], 'shared/shared-board-utils');
    if (!core || typeof core.createGameState !== 'function') {
      throw new Error('CoreLogic.createGameState unavailable for Pixi board fixture');
    }
    const gameState = core.createGameState({
      rows: definition.rows,
      cols: definition.cols,
      shape: definition.shape
    });
    const expansionCells = Array.isArray(definition.expansionCells)
      ? definition.expansionCells.map((cell) => ({ ...cell }))
      : [];
    gameState.boardExpansion = {
      active: expansionCells.length > 0,
      side: expansionCells.length ? expansionCells[expansionCells.length - 1].side : null,
      row: expansionCells.length ? expansionCells[expansionCells.length - 1].row : null,
      owner: expansionCells.length ? expansionCells[expansionCells.length - 1].owner : 0,
      usedByPlayer: { black: false, white: false },
      cells: expansionCells
    };

    const cardState = root.cardState && typeof root.cardState === 'object' ? root.cardState : {};
    const holeMarkers = (definition.holes || []).map((cell, index) => ({
      id: `pixi-static-hole-${index}`,
      kind: 'specialStone',
      row: cell.row,
      col: cell.col,
      owner: 'black',
      data: { type: 'METEOR_HOLE' }
    }));
    const markers = holeMarkers.concat((definition.markers || []).map((marker) => JSON.parse(JSON.stringify(marker))));
    cardState.markers = markers;
    cardState.pendingEffectByPlayer = { black: null, white: null };
    cardState.boardBonusByCell = {};
    cardState.boardBonusConsumedByCell = {};
    cardState.theoryNumberCellByCell = {};
    const breedingSprouts = definition.breedingSproutByOwner || {};
    cardState.breedingSproutByOwner = {
      black: (breedingSprouts.black || []).map((position) => ({ ...position })),
      white: (breedingSprouts.white || []).map((position) => ({ ...position }))
    };
    cardState.presentationEvents = [];
    cardState._presentationEventsPersist = [];
    for (const hole of definition.holes || []) {
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
    if (boardSkinRuntime && typeof boardSkinRuntime.applyBoardSkin === 'function') {
      boardSkinRuntime.applyBoardSkin(root, skin.board);
    }
    if (boardSkinRuntime && typeof boardSkinRuntime.applyBoardFrameSkin === 'function') {
      boardSkinRuntime.applyBoardFrameSkin(root, skin.frame);
    }
    if (stoneSkinRuntime && typeof stoneSkinRuntime.applyStoneSkin === 'function') {
      stoneSkinRuntime.applyStoneSkin(root, skin.stone);
    }
    const board = document.getElementById('board');
    if (!board || typeof root.renderBoard !== 'function') {
      throw new Error('Public board render path unavailable for Pixi board fixture');
    }
    await Promise.resolve(root.renderBoard());
    if (!root.__boardVisualDebug || typeof root.__boardVisualDebug.waitForIdle !== 'function') {
      throw new Error('Gated board visual diagnostics unavailable');
    }
    await root.__boardVisualDebug.waitForIdle();
    // Resource/font readiness may invalidate the canonical theme frame. Let
    // those invalidations settle before submitting the synthetic presentation
    // overlay so the fixture remains the final visual frame being asserted.
    if ((document as any).fonts && (document as any).fonts.ready) await (document as any).fonts.ready;
    await root.__boardVisualDebug.waitForIdle();
    return { presentationCandidateKeys: [] };
  }, fixture);
  // Keep the Phase 0 capture's deterministic post-font/image quiet window.
  // Synthetic presentation decoration is installed only after the separate
  // idle-rAF observation in captureFixture(), so resource invalidations have
  // already settled and cannot overwrite the asserted overlay.
  await page.waitForTimeout(120);
  await page.evaluate(async () => (window as any).__boardVisualDebug.waitForIdle());
  return diagnostics || { presentationCandidateKeys: [] };
}

async function decorateCurrentPresentationFixture(page: any): Promise<{
  presentationCandidateKeys: string[];
  presentationSubmission: Record<string, unknown>;
}> {
  return page.evaluate(async () => {
    const root = window as any;
    const resolveModule = (moduleId: string): any => {
      try {
        if (typeof root.require === 'function') return root.require(moduleId);
      } catch (_error) { /* explicit failure below */ }
      return null;
    };
    const renderer = resolveModule('ui/board-renderer');
    const modelModule = resolveModule('ui/board-visual/model');
    const controller = renderer && typeof renderer.getBoardVisualController === 'function'
      ? renderer.getBoardVisualController()
      : null;
    if (!renderer || typeof renderer.buildBoardVisualFrame !== 'function'
      || !modelModule || typeof modelModule.createBoardRenderModel !== 'function'
      || !controller || typeof controller.submitFrame !== 'function') {
      throw new Error('Static presentation fixture seam unavailable');
    }
    const buildDecoration = () => {
      const baseFrame = renderer.buildBoardVisualFrame(controller);
      const candidates = baseFrame.model.cells
        .filter((cell: any) => cell.kind === 'playable' && !cell.stone)
        .slice(0, 9);
      if (candidates.length < 9) throw new Error('Static presentation fixture needs nine playable cells');
      const kinds = new Map<string, number>(candidates.map((cell: any, index: number) => [cell.key, index]));
      const cells = baseFrame.model.cells.map((cell: any) => {
        const index = kinds.get(cell.key);
        const interaction = { ...cell.interaction };
        interaction.previewKinds = Array.from(interaction.previewKinds || []);
        interaction.selectionKinds = Array.from(interaction.selectionKinds || []);
        interaction.directionHints = Array.from(interaction.directionHints || []);
        interaction.directionHintIds = Array.from(interaction.directionHintIds || []);
        interaction.localPendingHintIds = Array.from(interaction.localPendingHintIds || []);
        if (index === 0) interaction.legal = true;
        if (index === 1) interaction.legalFree = true;
        if (index === 2) {
          interaction.selected = true;
          interaction.previewKinds.push('selected-target');
        }
        if (index === 3) {
          interaction.selectable = true;
          interaction.selectionKinds.push('positive-target');
        }
        if (index === 4) interaction.previewKinds.push('random-spawn');
        if (index === 5) interaction.previewKinds.push('super-attraction-path');
        if (index === 6) interaction.previewKinds.push('super-attraction-destination');
        if (index === 7) {
          interaction.selectable = true;
          interaction.selectionKinds.push('friendly');
        }
        interaction.interactionLocked = false;
        const next = { ...cell, interaction };
        delete next.visualSignature;
        return next;
      });
      const decoratedModel = modelModule.createBoardRenderModel({
        visualRevision: Number(baseFrame.model.visualRevision || 0) + 1,
        topology: baseFrame.model.topology,
        cells,
        viewerContext: baseFrame.model.viewerContext,
        currentPlayer: baseFrame.model.currentPlayer,
        canControlCurrentTurn: baseFrame.model.canControlCurrentTurn,
        isHumanTurn: baseFrame.model.isHumanTurn,
        overlay: { keyboardCursorKey: candidates[8].key }
      });
      if (decoratedModel.cells.find((cell: any) => cell.key === candidates[0].key)
        ?.interaction?.legal !== true) {
        throw new Error('Static presentation fixture model dropped the legal hint');
      }
      return { baseFrame, candidates, decoratedModel };
    };
    const submitDecoration = async (attempt: number) => {
      const decoration = buildDecoration();
      const frame = Object.freeze({
        ...decoration.baseFrame,
        frameToken: `${decoration.baseFrame.frameToken}:static-presentation:${attempt}`,
        model: decoration.decoratedModel
      });
      const submitted = controller.submitFrame(frame);
      if (submitted !== true) throw new Error('Static presentation fixture frame was not submitted while idle');
      // A submitted frame is not yet the visual baseline. The controller
      // publishes its digest/frame only after backend visual settlement.
      const digestImmediatelyAfterSubmit = controller.getVisualFrameDigest();
      await root.__boardVisualDebug.waitForIdle();
      return {
        ...decoration,
        frameToken: frame.frameToken,
        submitted,
        digestImmediatelyAfterSubmit,
        digestAfterSettlement: controller.getVisualFrameDigest(),
        settledFrameToken: controller.getSettledFrame?.()?.frameToken || null
      };
    };
    const digestBeforeSubmit = controller.getVisualFrameDigest();
    let applied = await submitDecoration(1);
    const supersededOnce = applied.settledFrameToken !== applied.frameToken;
    if (supersededOnce) applied = await submitDecoration(2);
    const presentationCandidateKeys = applied.candidates.map((cell: any) => cell.key);
    const [firstRow, firstCol] = applied.candidates[0].key.split(',').map(Number);
    const renderedLegal = root.__boardVisualDebug.getRenderedCell(firstRow, firstCol)?.hint?.legal === true;
    if (!renderedLegal || applied.settledFrameToken !== applied.frameToken) {
      throw new Error('Static presentation fixture did not stabilize after one resource invalidation retry');
    }
    return {
      presentationCandidateKeys,
      presentationSubmission: {
        submitted: applied.submitted,
        decoratedLegal: true,
        renderedLegal,
        supersededOnce,
        digestBeforeSubmit,
        digestImmediatelyAfterSubmit: applied.digestImmediatelyAfterSubmit,
        digestAfterSettlement: applied.digestAfterSettlement,
        settledFrameToken: applied.settledFrameToken,
        writerMode: controller.getMode()
      }
    };
  });
}

async function waitForIdleRafStop(page: any): Promise<number> {
  await page.evaluate(async () => {
    const root = window as any;
    await root.__boardVisualDebug.waitForIdle();
    root.__pixiBoardBrowserCheckProbe.resetRafCallbacks();
  });
  await page.waitForTimeout(IDLE_RAF_OBSERVATION_MS);
  return page.evaluate(() => (window as any).__pixiBoardBrowserCheckProbe.getRafCallbackCount());
}

async function readFixtureProbe(
  page: any,
  fixture: FixtureDefinition,
  requestedDpr: number,
  presentationCandidateKeys: readonly string[] = []
): Promise<any> {
  const bounds = topologyBounds(fixture);
  return page.evaluate((input: {
    definition: FixtureDefinition;
    topology: ReturnType<typeof topologyBounds>;
    expectedDpr: number;
    presentationCandidateKeys: readonly string[];
  }) => {
    const { definition, topology, expectedDpr, presentationCandidateKeys } = input;
    const root = window as any;
    const debug = root.__boardVisualDebug;
    const board = document.getElementById('board');
    const canvas = board?.querySelector('canvas') as HTMLCanvasElement | null;
    const viewport = document.getElementById('board-scroll-viewport') as HTMLElement | null;
    const surface = document.getElementById('board-scroll-surface') as HTMLElement | null;
    const canvasRect = canvas?.getBoundingClientRect() || null;
    const viewportRect = viewport?.getBoundingClientRect() || null;
    const centerRow = Math.floor(definition.rows / 2);
    const centerCol = Math.floor(definition.cols / 2);
    const centerRect = debug.getCellClientRect(centerRow, centerCol);
    const cellSize = Number(centerRect && centerRect.width || 0);
    const dpr = Number(window.devicePixelRatio || 1);
    const resolution = Math.min(2, dpr);
    const visibleRows = cellSize > 0 && viewportRect ? Math.ceil(viewportRect.height / cellSize) : 0;
    const visibleCols = cellSize > 0 && viewportRect ? Math.ceil(viewportRect.width / cellSize) : 0;
    const materializationMax = Math.min(topology.renderRows, visibleRows + 6)
      * Math.min(topology.renderCols, visibleCols + 6);
    const displayObjectCounts = debug.getDisplayObjectCounts();
    const textureLeaseCounts = debug.getTextureLeaseCounts();
    const requestedKeys = new Set<string>([
      '0,0',
      `${centerRow},${centerCol}`,
      `${definition.rows - 1},${definition.cols - 1}`,
      ...(definition.expansionCells || []).map((cell: any) => `${cell.row},${cell.col}`),
      ...(definition.holes || []).map((cell: any) => `${cell.row},${cell.col}`),
      ...(definition.markers || []).map((marker: any) => `${marker.row},${marker.col}`),
      ...presentationCandidateKeys
    ]);
    const renderedCells: Record<string, unknown> = {};
    const cellRects: Record<string, unknown> = {};
    for (const key of requestedKeys) {
      const [row, col] = key.split(',').map(Number);
      renderedCells[key] = debug.getRenderedCell(row, col);
      cellRects[key] = debug.getCellClientRect(row, col);
    }
    const expectedSkin = definition.skin || {
      board: 'bluegreen-felt', frame: 'marsh-forged-iron', stone: 'o-stone'
    };
    const backingMaxWidth = viewportRect && cellSize > 0
      ? Math.ceil((viewportRect.width + cellSize * 4) * resolution) + 4
      : 0;
    const backingMaxHeight = viewportRect && cellSize > 0
      ? Math.ceil((viewportRect.height + cellSize * 4) * resolution) + 4
      : 0;
    const gutter = canvasRect && viewportRect ? {
      top: viewportRect.top - canvasRect.top,
      right: canvasRect.right - viewportRect.right,
      bottom: canvasRect.bottom - viewportRect.bottom,
      left: viewportRect.left - canvasRect.left,
      expected: cellSize * 2
    } : null;
    return {
      fixture: definition.name,
      renderer: board?.getAttribute('data-board-renderer') || '',
      canvasCount: document.querySelectorAll('#board canvas').length,
      domCellCount: Number(debug.getBackendDiagnostics()?.domCellCount || 0),
      scrollSurfaceCellCount: surface
        ? Array.from(surface.children).filter((child) => child.hasAttribute('data-row') && child.hasAttribute('data-col')).length
        : 0,
      canvasAriaHidden: canvas?.getAttribute('aria-hidden') === 'true',
      connectedBoardContextCount: root.__pixiBoardBrowserCheckProbe.getConnectedBoardContextCount(),
      requestedDpr: expectedDpr,
      observedDpr: dpr,
      frameDigest: debug.getVisualFrameDigest(),
      backendDiagnostics: debug.getBackendDiagnostics(),
      centerRect,
      canvas: canvasRect ? {
        cssWidth: canvasRect.width,
        cssHeight: canvasRect.height,
        backingWidth: Number(canvas?.width || 0),
        backingHeight: Number(canvas?.height || 0),
        backingMaxWidth,
        backingMaxHeight
      } : null,
      viewport: viewportRect ? {
        width: viewportRect.width,
        height: viewportRect.height,
        scrollWidth: Number(viewport?.scrollWidth || 0),
        scrollHeight: Number(viewport?.scrollHeight || 0),
        scrollLeft: Number(viewport?.scrollLeft || 0),
        scrollTop: Number(viewport?.scrollTop || 0)
      } : null,
      surface: surface ? {
        width: Number.parseFloat(surface.style.width || '0'),
        height: Number.parseFloat(surface.style.height || '0'),
        childCount: surface.childElementCount
      } : null,
      gutter,
      materializationMax,
      displayObjectCounts,
      textureLeaseCounts,
      renderedCells,
      cellRects,
      presentationCandidateKeys,
      skin: {
        expected: expectedSkin,
        board: document.documentElement.getAttribute('data-board-skin-id'),
        frame: document.documentElement.getAttribute('data-board-frame-skin-id'),
        stone: document.documentElement.getAttribute('data-stone-skin-id')
      }
    };
  }, {
    definition: fixture,
    topology: bounds,
    expectedDpr: requestedDpr,
    presentationCandidateKeys
  });
}

async function captureFixture(
  page: any,
  rootDir: string,
  lane: Lane,
  requestedDpr: number,
  fixture: FixtureDefinition,
  comparePhaseZero: boolean
): Promise<any> {
  await applyPhaseZeroFixture(page, fixture);
  const idleRafCallbacks = await waitForIdleRafStop(page);
  const applied = fixture.decoratePresentation
    ? await decorateCurrentPresentationFixture(page)
    : { presentationCandidateKeys: [], presentationSubmission: null };
  const probe = await readFixtureProbe(page, fixture, requestedDpr, applied.presentationCandidateKeys);
  const png = await page.locator('#board').screenshot({ animations: 'disabled' });
  const framePng = fixture.captureKind === 'presentation'
    ? await page.locator('#board-frame').screenshot({ animations: 'disabled' })
    : null;
  const baselinePath = path.join(rootDir, CAPTURE_DIR, `${lane}-${fixture.name}.png`);
  const frameBaselinePath = path.join(rootDir, CAPTURE_DIR, `${lane}-${fixture.name}-frame.png`);
  const comparison = requestedDpr === 1 && comparePhaseZero && fs.existsSync(baselinePath)
    ? comparePngBuffers(fs.readFileSync(baselinePath), png)
    : null;
  const phaseZeroFixture = requestedDpr === 1 && comparePhaseZero
    ? readPhaseZeroFixtureBaseline(rootDir, lane, fixture.name)
    : null;
  const geometrySkinComparison = comparison?.dimensionMatch === false
    && Array.isArray(fixture.expansionCells)
    && fixture.expansionCells.length > 0
    ? comparePhaseZeroGeometryAndSkin(probe, phaseZeroFixture)
    : null;
  const frameComparison = framePng && requestedDpr === 1 && comparePhaseZero && fs.existsSync(frameBaselinePath)
    ? comparePngBuffers(fs.readFileSync(frameBaselinePath), framePng)
    : null;
  return {
    ...probe,
    presentationSubmission: applied.presentationSubmission,
    idleRafCallbacks,
    screenshotSha256: sha256(png),
    frameScreenshotSha256: framePng ? sha256(framePng) : null,
    phaseZeroComparison: comparison ? {
      baselinePath: path.relative(rootDir, baselinePath).replace(/\\/g, '/'),
      ...comparison
    } : null,
    phaseZeroGeometrySkinComparison: geometrySkinComparison,
    phaseZeroFrameComparison: frameComparison ? {
      baselinePath: path.relative(rootDir, frameBaselinePath).replace(/\\/g, '/'),
      ...frameComparison
    } : null
  };
}

async function readRuntimeSnapshot(
  page: any,
  probeKeys: { topLeft: string; bottomRight: string } = { topLeft: '0,0', bottomRight: '15,15' }
): Promise<any> {
  return page.evaluate((keys: { topLeft: string; bottomRight: string }) => {
    const root = window as any;
    const debug = root.__boardVisualDebug;
    const canvas = document.querySelector('#board canvas') as HTMLCanvasElement | null;
    const viewport = document.getElementById('board-scroll-viewport') as HTMLElement | null;
    const surface = document.getElementById('board-scroll-surface') as HTMLElement | null;
    const cellRect = debug.getCellClientRect(3, 3);
    const dpr = Math.min(2, Number(window.devicePixelRatio || 1));
    const backingMaxWidth = Math.ceil((Number(viewport?.clientWidth || 0) + Number(cellRect?.width || 0) * 4) * dpr) + 4;
    const backingMaxHeight = Math.ceil((Number(viewport?.clientHeight || 0) + Number(cellRect?.height || 0) * 4) * dpr) + 4;
    const renderedCell = (key: string) => {
      const [row, col] = key.split(',').map(Number);
      return debug.getRenderedCell(row, col);
    };
    return {
      display: debug.getDisplayObjectCounts(),
      leases: debug.getTextureLeaseCounts(),
      frameDigest: debug.getVisualFrameDigest(),
      topLeft: renderedCell(keys.topLeft),
      bottomRight: renderedCell(keys.bottomRight),
      canvasBackingWidth: Number(canvas?.width || 0),
      canvasBackingHeight: Number(canvas?.height || 0),
      backingMaxWidth,
      backingMaxHeight,
      viewportWidth: Number(viewport?.clientWidth || 0),
      viewportHeight: Number(viewport?.clientHeight || 0),
      logicalWidth: Number(surface?.scrollWidth || 0),
      logicalHeight: Number(surface?.scrollHeight || 0),
      scrollLeft: Number(viewport?.scrollLeft || 0),
      scrollTop: Number(viewport?.scrollTop || 0)
    };
  }, probeKeys);
}

async function scrollPixiViewport(
  page: any,
  position: 'start' | 'end',
  probeKeys?: { topLeft: string; bottomRight: string }
): Promise<any> {
  await page.evaluate((target: string) => {
    const viewport = document.getElementById('board-scroll-viewport') as HTMLElement | null;
    if (!viewport) throw new Error('Pixi scroll viewport unavailable');
    viewport.scrollLeft = target === 'end' ? Math.max(0, viewport.scrollWidth - viewport.clientWidth) : 0;
    viewport.scrollTop = target === 'end' ? Math.max(0, viewport.scrollHeight - viewport.clientHeight) : 0;
    viewport.dispatchEvent(new Event('scroll'));
  }, position);
  await page.evaluate(async () => (window as any).__boardVisualDebug.waitForIdle());
  return readRuntimeSnapshot(page, probeKeys);
}

async function captureVirtualizationLifecycle(page: any): Promise<any> {
  await applyPhaseZeroFixture(page, VIRTUALIZATION_FIXTURE);
  const bounds = topologyBounds(VIRTUALIZATION_FIXTURE);
  const probeKeys = {
    topLeft: `${bounds.minRow},${bounds.minCol}`,
    bottomRight: `${bounds.maxRow},${bounds.maxCol}`
  };
  const samples: any[] = [];
  for (let index = 0; index < 12; index += 1) {
    samples.push(await scrollPixiViewport(page, index % 2 === 0 ? 'start' : 'end', probeKeys));
  }
  const backingWidths = samples.map((sample) => finite(sample.canvasBackingWidth));
  const backingHeights = samples.map((sample) => finite(sample.canvasBackingHeight));
  const activeCounts = samples.map((sample) => finite(sample.display?.active));
  const pooledCounts = samples.map((sample) => finite(sample.display?.pooled));
  const leaseCounts = samples.map((sample) => finite(sample.leases?.total));

  const base = fixtureByName('rectangle-8x8-four-stars');
  const expanded = fixtureByName('rectangle-8x8-multistage-negative');
  const expansionSamples: any[] = [];
  for (let index = 0; index < 10; index += 1) {
    await applyPhaseZeroFixture(page, index % 2 === 0 ? base : expanded);
    expansionSamples.push(await readRuntimeSnapshot(page));
  }
  const viewportStartSamples = samples.filter((_sample, index) => index % 2 === 0);
  const viewportEndSamples = samples.filter((_sample, index) => index % 2 === 1);
  const baseSamples = expansionSamples.filter((_sample, index) => index % 2 === 0);
  const expandedSamples = expansionSamples.filter((_sample, index) => index % 2 === 1);
  return {
    sampleCount: samples.length,
    fixture: VIRTUALIZATION_FIXTURE.name,
    bounds,
    probeKeys,
    topMaterialized: samples.some((sample) => sample.topLeft != null && sample.bottomRight == null),
    bottomMaterialized: samples.some((sample) => sample.topLeft == null && sample.bottomRight != null),
    maxBackingWidth: Math.max(...backingWidths),
    minBackingWidth: Math.min(...backingWidths),
    maxBackingHeight: Math.max(...backingHeights),
    minBackingHeight: Math.min(...backingHeights),
    maxBackingWidthLimit: Math.max(...samples.map((sample) => finite(sample.backingMaxWidth))),
    maxBackingHeightLimit: Math.max(...samples.map((sample) => finite(sample.backingMaxHeight))),
    logicalExceedsViewport: samples.every((sample) => (
      finite(sample.logicalWidth) > finite(sample.viewportWidth)
      && finite(sample.logicalHeight) > finite(sample.viewportHeight)
    )),
    maxActive: Math.max(...activeCounts),
    maxPooled: Math.max(...pooledCounts),
    // Compare only like-for-like samples after one warm-up observation. A
    // plateau between increases (10,11,11,12,...) remains a leak instead of
    // escaping the old strict-every-step monotonic predicate.
    seriesGrowth: Object.freeze({
      viewportStart: lifecycleSeriesGrowth(viewportStartSamples),
      viewportEnd: lifecycleSeriesGrowth(viewportEndSamples),
      base: lifecycleSeriesGrowth(baseSamples),
      expanded: lifecycleSeriesGrowth(expandedSamples)
    }),
    activeStrictMonotonicGrowth: isStrictMonotonicGrowth(activeCounts),
    pooledStrictMonotonicGrowth: isStrictMonotonicGrowth(pooledCounts),
    leasesStrictMonotonicGrowth: isStrictMonotonicGrowth(leaseCounts),
    backingStrictMonotonicGrowth: isStrictMonotonicGrowth(backingWidths)
      || isStrictMonotonicGrowth(backingHeights),
    expansionActiveStrictMonotonicGrowth: isStrictMonotonicGrowth(
      expansionSamples.map((sample) => finite(sample.display?.active))
    ),
    expansionPooledStrictMonotonicGrowth: isStrictMonotonicGrowth(
      expansionSamples.map((sample) => finite(sample.display?.pooled))
    ),
    expansionLeasesStrictMonotonicGrowth: isStrictMonotonicGrowth(
      expansionSamples.map((sample) => finite(sample.leases?.total))
    ),
    finalLeaseCount: leaseCounts[leaseCounts.length - 1] || 0,
    samples,
    expansionSamples
  };
}

async function captureExpansionRectInvariance(page: any): Promise<any[]> {
  const base = fixtureByName('rectangle-8x8-four-stars');
  const results: any[] = [];
  for (const fixtureName of REQUIRED_EXPANSION_FIXTURES) {
    await applyPhaseZeroFixture(page, base);
    const before = await page.evaluate(() => (window as any).__boardVisualDebug.getCellClientRect(3, 3));
    await applyPhaseZeroFixture(page, fixtureByName(fixtureName));
    const after = await page.evaluate(() => (window as any).__boardVisualDebug.getCellClientRect(3, 3));
    results.push({ fixture: fixtureName, before, after, maxDeltaPx: rectDelta(before, after) });
  }
  return results;
}

async function captureVisualViewport(page: any): Promise<any> {
  await applyPhaseZeroFixture(page, fixtureByName('rectangle-8x8-four-stars'));
  const before = await page.evaluate(() => {
    const viewport = window.visualViewport;
    return {
      rect: (window as any).__boardVisualDebug.getCellClientRect(3, 3),
      viewport: {
        scale: Number(viewport?.scale || 1),
        offsetLeft: Number(viewport?.offsetLeft || 0),
        offsetTop: Number(viewport?.offsetTop || 0)
      }
    };
  });
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.25 });
    await page.waitForFunction(() => Number(window.visualViewport?.scale || 1) >= 1.2, null, { timeout: 5000 });
    try {
      await cdp.send('Input.synthesizeScrollGesture', {
        x: Math.floor(VIEWPORT_WIDTH / 2),
        y: Math.floor(VIEWPORT_HEIGHT / 2),
        xDistance: 24,
        yDistance: 18,
        speed: 400,
        gestureSourceType: 'touch'
      });
    } catch (_error) { /* scale/revision remains a real Chromium assertion */ }
    await page.evaluate(async () => (window as any).__boardVisualDebug.waitForIdle());
    const after = await page.evaluate(() => {
      const viewport = window.visualViewport;
      return {
        rect: (window as any).__boardVisualDebug.getCellClientRect(3, 3),
        viewport: {
          scale: Number(viewport?.scale || 1),
          offsetLeft: Number(viewport?.offsetLeft || 0),
          offsetTop: Number(viewport?.offsetTop || 0)
        }
      };
    });
    const actualLeftDelta = finite(after.rect?.left) - finite(before.rect?.left);
    const actualTopDelta = finite(after.rect?.top) - finite(before.rect?.top);
    const expectedLeftDelta = -(finite(after.viewport.offsetLeft) - finite(before.viewport.offsetLeft));
    const expectedTopDelta = -(finite(after.viewport.offsetTop) - finite(before.viewport.offsetTop));
    return {
      before,
      after,
      scaleChanged: finite(after.viewport.scale) > finite(before.viewport.scale),
      layoutRevisionAdvanced: finite(after.rect?.layoutRevision) > finite(before.rect?.layoutRevision),
      cellSizeStable: Math.abs(finite(after.rect?.width) - finite(before.rect?.width)) <= RECT_TOLERANCE_PX,
      offsetCoordinateDelta: {
        actualLeftDelta,
        actualTopDelta,
        expectedLeftDelta,
        expectedTopDelta,
        matches: Math.abs(actualLeftDelta - expectedLeftDelta) <= RECT_TOLERANCE_PX
          && Math.abs(actualTopDelta - expectedTopDelta) <= RECT_TOLERANCE_PX
      }
    };
  } finally {
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    await cdp.detach();
  }
}

async function createCustomSkinBlobFixture(page: any): Promise<any> {
  await applyPhaseZeroFixture(page, fixtureByName('rectangle-8x8-four-stars'));
  const baseline = await page.evaluate(() => {
    const root = window as any;
    const storage = root.require('ui/custom-skin/storage');
    return {
      leases: root.__boardVisualDebug.getTextureLeaseCounts(),
      objectUrls: storage.getCustomSkinObjectUrlLeaseDiagnostics(root)
    };
  });
  const custom = await page.evaluate(async () => {
    const root = window as any;
    const resolve = (id: string) => {
      if (typeof root.require !== 'function') throw new Error(`Browser module registry unavailable for ${id}`);
      return root.require(id);
    };
    const storage = resolve('ui/custom-skin/storage');
    const boardRuntime = resolve('ui/board-skin/runtime');
    const stoneRuntime = resolve('ui/stone-skin/runtime');
    const makePng = async (color: string, width: number, height: number): Promise<Blob> => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D canvas unavailable for custom skin fixture');
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      return new Promise<Blob>((resolveBlob, reject) => canvas.toBlob((blob) => {
        if (blob) resolveBlob(blob);
        else reject(new Error('Custom skin PNG encoding failed'));
      }, 'image/png'));
    };
    const boardBlob = await makePng('#174b42', 128, 96);
    const blackBlob = await makePng('#151515', 96, 96);
    const whiteBlob = await makePng('#f2f2ee', 96, 96);
    const board = await storage.saveCustomSkin(root, {
      kind: 'board', label: 'Pixi browser board', boardImage: boardBlob
    });
    const stone = await storage.saveCustomSkin(root, {
      kind: 'stone', label: 'Pixi browser stones', blackImage: blackBlob, whiteImage: whiteBlob
    });
    boardRuntime.applyBoardSkin(root, board.id);
    stoneRuntime.applyStoneSkin(root, stone.id);
    await Promise.resolve(root.renderBoard());
    await root.__boardVisualDebug.waitForIdle();
    return {
      boardId: board.id,
      stoneId: stone.id,
      originalBlobSizes: [boardBlob.size, blackBlob.size, whiteBlob.size]
    };
  });
  const active = await page.evaluate(() => {
    const root = window as any;
    const debug = (window as any).__boardVisualDebug;
    const storage = root.require('ui/custom-skin/storage');
    return {
      boardCell: debug.getRenderedCell(3, 3),
      leases: debug.getTextureLeaseCounts(),
      objectUrls: storage.getCustomSkinObjectUrlLeaseDiagnostics(root),
      skin: {
        board: document.documentElement.getAttribute('data-board-skin-id'),
        stone: document.documentElement.getAttribute('data-stone-skin-id')
      }
    };
  });
  const released = await page.evaluate(async (ids: { boardId: string; stoneId: string }) => {
    const { boardId, stoneId } = ids;
    const root = window as any;
    const storage = root.require('ui/custom-skin/storage');
    const boardRuntime = root.require('ui/board-skin/runtime');
    const stoneRuntime = root.require('ui/stone-skin/runtime');
    boardRuntime.applyBoardSkin(root, 'bluegreen-felt');
    stoneRuntime.applyStoneSkin(root, 'o-stone');
    await Promise.resolve(root.renderBoard());
    await root.__boardVisualDebug.waitForIdle();
    await storage.deleteCustomSkin(root, boardId);
    await storage.deleteCustomSkin(root, stoneId);
    return {
      leases: root.__boardVisualDebug.getTextureLeaseCounts(),
      objectUrls: storage.getCustomSkinObjectUrlLeaseDiagnostics(root)
    };
  }, custom);
  return { ...custom, baseline, active, released };
}

function evaluatePixijsBoardLaneReport(report: any): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const prefix = `${report?.lane || 'unknown'}@${report?.requestedDpr || '?'}`;
  const expectedNames = (BROWSER_FIXTURES as readonly FixtureDefinition[]).map((fixture) => fixture.name);
  const fixtures = Array.isArray(report?.fixtures) ? report.fixtures : [];
  const byName = new Map(fixtures.map((fixture: any) => [fixture.fixture, fixture]));
  for (const name of expectedNames) {
    if (!byName.has(name)) errors.push(`${prefix}: missing Phase 0 fixture ${name}`);
  }
  for (const fixture of fixtures) {
    const name = `${prefix}:${fixture.fixture}`;
    if (fixture.renderer !== 'pixi') errors.push(`${name}: renderer was ${fixture.renderer || 'missing'}`);
    if (fixture.canvasCount !== 1) errors.push(`${name}: expected one canvas, got ${fixture.canvasCount}`);
    if (fixture.domCellCount !== 0 || fixture.scrollSurfaceCellCount !== 0) {
      errors.push(`${name}: DOM cells were materialized`);
    }
    if (fixture.canvasAriaHidden !== true) errors.push(`${name}: canvas is not aria-hidden`);
    if (fixture.connectedBoardContextCount !== 1) {
      errors.push(`${name}: expected one connected WebGL context, got ${fixture.connectedBoardContextCount}`);
    }
    if (Math.abs(finite(fixture.observedDpr) - finite(fixture.requestedDpr)) > 0.01) {
      errors.push(`${name}: DPR mismatch ${fixture.observedDpr}`);
    }
    if (!fixture.frameDigest) errors.push(`${name}: visual frame digest is missing`);
    const application = fixture.backendDiagnostics?.application;
    if (application && (application.tickerRunning === true
      || application.privateTickerRunning === true
      || application.sharedTickerRunning === true
      || application.systemTickerRunning === true)) {
      errors.push(`${name}: Pixi ticker remained active after visual settlement`);
    }
    if (!fixture.canvas || fixture.canvas.backingWidth <= 0 || fixture.canvas.backingHeight <= 0) {
      errors.push(`${name}: canvas backing store is missing`);
    } else {
      if (fixture.canvas.backingWidth > fixture.canvas.backingMaxWidth) {
        errors.push(`${name}: canvas backing width is unbounded (${fixture.canvas.backingWidth} > ${fixture.canvas.backingMaxWidth})`);
      }
      if (fixture.canvas.backingHeight > fixture.canvas.backingMaxHeight) {
        errors.push(`${name}: canvas backing height is unbounded (${fixture.canvas.backingHeight} > ${fixture.canvas.backingMaxHeight})`);
      }
    }
    if (finite(fixture.displayObjectCounts?.active) > finite(fixture.materializationMax)) {
      errors.push(`${name}: active view count exceeded visible + overscan/gutter bound`);
    }
    if (finite(fixture.displayObjectCounts?.active) > 256 || finite(fixture.displayObjectCounts?.pooled) > 256) {
      errors.push(`${name}: retained view pool exceeded its hard bound`);
    }
    if (finite(fixture.idleRafCallbacks) !== 0) errors.push(`${name}: rAF continued after waitForIdle`);
    const gutter = fixture.gutter;
    if (!gutter) {
      errors.push(`${name}: effect gutter geometry is missing`);
    } else {
      for (const side of ['top', 'right', 'bottom', 'left']) {
        if (Math.abs(finite(gutter[side]) - finite(gutter.expected)) > GUTTER_TOLERANCE_PX) {
          errors.push(`${name}: ${side} effect gutter was ${gutter[side]}, expected ${gutter.expected}`);
        }
      }
    }
    const expectedSkin = fixture.skin?.expected || DEFAULT_SKIN;
    if (fixture.skin?.board !== expectedSkin.board
      || fixture.skin?.frame !== expectedSkin.frame
      || fixture.skin?.stone !== expectedSkin.stone) {
      errors.push(`${name}: applied skin descriptor does not match the Phase 0 fixture`);
    }
    const definition = (BROWSER_FIXTURES as readonly FixtureDefinition[])
      .find((candidate) => candidate.name === fixture.fixture);
    const isExpansionFixture = Array.isArray(definition?.expansionCells)
      && definition.expansionCells.length > 0;
    if (fixture.phaseZeroComparison) {
      if (fixture.phaseZeroComparison.dimensionMatch !== true) {
        const geometry = fixture.phaseZeroGeometrySkinComparison;
        if (!isExpansionFixture || geometry?.ok !== true) {
          const detail = geometry
            ? ` (${geometry.commonKeyCount}/${geometry.baselineKeyCount} cells, size delta ${geometry.maxCellSizeDeltaPx}px, relative delta ${geometry.maxRelativePositionDeltaPx}px, skin ${geometry.skinMatch ? 'matched' : 'mismatched'})`
            : '';
          errors.push(`${name}: Phase 0 screenshot dimensions changed without equivalent cell geometry/skin${detail}`);
        }
      } else if (finite(fixture.phaseZeroComparison.diffPixels, Number.POSITIVE_INFINITY) > PNG_DIFF_PIXEL_BUDGET) {
        errors.push(`${name}: Phase 0 screenshot diff was ${fixture.phaseZeroComparison.diffPixels} pixels`);
      }
    }
    if (fixture.phaseZeroFrameComparison) {
      if (fixture.phaseZeroFrameComparison.dimensionMatch !== true) {
        if (!isExpansionFixture || fixture.phaseZeroGeometrySkinComparison?.ok !== true) {
          errors.push(`${name}: Phase 0 frame screenshot dimensions changed`);
        }
      } else if (finite(fixture.phaseZeroFrameComparison.diffPixels, Number.POSITIVE_INFINITY) > PNG_DIFF_PIXEL_BUDGET) {
        errors.push(`${name}: Phase 0 frame screenshot diff was ${fixture.phaseZeroFrameComparison.diffPixels} pixels`);
      }
    }
    if (definition?.decoratePresentation) {
      const presentationCandidateKeys = Array.isArray(fixture.presentationCandidateKeys)
        ? fixture.presentationCandidateKeys
        : [];
      const hints = presentationCandidateKeys
        .map((key: string) => fixture.renderedCells?.[key])
        .map((cell: any) => cell && cell.hint)
        .filter(Boolean);
      const hasPreview = hints.some((hint: any) => Array.isArray(hint.previewKinds) && hint.previewKinds.length > 0);
      if (presentationCandidateKeys.length !== 9
        || !hints.some((hint: any) => hint.legal === true)
        || !hints.some((hint: any) => hint.selectable === true)
        || !hints.some((hint: any) => hint.selected === true)
        || !hints.some((hint: any) => hint.keyboardCursor === true)
        || !hasPreview) {
        errors.push(`${name}: static legal/selection/preview/keyboard hints are incomplete`);
      }
    }
    if (fixture.fixture === SPECIAL_TIMER_BADGE_FIXTURE) {
      for (const [key, expectation] of Object.entries(SPECIAL_TIMER_BADGE_EXPECTATIONS)) {
        const stone = fixture.renderedCells?.[key]?.stone;
        const statusLabels = Array.isArray(stone?.statusLabels)
          ? stone.statusLabels.map((entry: any) => `${entry.kind}:${entry.value}`)
          : [];
        if (stone?.visible !== true
          || stone?.specialType !== expectation.specialType
          || JSON.stringify(statusLabels) !== JSON.stringify(expectation.statusLabels)
          || ('renderedMarkerKinds' in expectation
            && JSON.stringify(stone?.renderedMarkerKinds || []) !== JSON.stringify(expectation.renderedMarkerKinds))) {
          errors.push(`${name}:${key}: Phase 0 special timer/badge visual drifted`);
        }
      }
      // Phase 0 intentionally placed SEED over an occupied opening stone. Pin
      // that baseline suppression here; the empty-cell seed branch has its own
      // retained-view fixture.
      const occupiedSeed = fixture.renderedCells?.['4,4'];
      if (occupiedSeed?.stone?.specialType != null
        || (occupiedSeed?.cell?.renderedMarkerKinds || []).includes('seed')) {
        errors.push(`${name}:4,4: occupied Phase 0 seed suppression drifted`);
      }
    }
  }

  const rects = Array.isArray(report?.expansionRectInvariance) ? report.expansionRectInvariance : [];
  const rectByName = new Map(rects.map((entry: any) => [entry.fixture, entry]));
  for (const fixtureName of REQUIRED_EXPANSION_FIXTURES) {
    const entry: any = rectByName.get(fixtureName);
    if (!entry) errors.push(`${prefix}: missing rect invariance ${fixtureName}`);
    else if (finite(entry.maxDeltaPx, Number.POSITIVE_INFINITY) > RECT_TOLERANCE_PX) {
      errors.push(`${prefix}:${fixtureName}: existing cell moved ${entry.maxDeltaPx}px`);
    }
  }

  const virtual = report?.virtualization || {};
  if (virtual.topMaterialized !== true || virtual.bottomMaterialized !== true) {
    errors.push(`${prefix}: viewport scrolling did not replace offscreen materialization`);
  }
  if (finite(virtual.maxActive) > 256 || finite(virtual.maxPooled) > 256) {
    errors.push(`${prefix}: virtualization exceeded retained view bounds`);
  }
  if (virtual.logicalExceedsViewport !== true) {
    errors.push(`${prefix}: sparse expanded logical surface did not exceed the visible viewport`);
  }
  if (finite(virtual.maxBackingWidth) > finite(virtual.maxBackingWidthLimit)
    || finite(virtual.maxBackingHeight) > finite(virtual.maxBackingHeightLimit)) {
    errors.push(`${prefix}: canvas backing store exceeded viewport + effect gutter`);
  }
  if (Math.abs(finite(virtual.maxBackingWidth) - finite(virtual.minBackingWidth)) > 4
    || Math.abs(finite(virtual.maxBackingHeight) - finite(virtual.minBackingHeight)) > 4) {
    errors.push(`${prefix}: canvas backing store changed while only the viewport scrolled`);
  }
  const seriesGrowth = virtual.seriesGrowth;
  if (!seriesGrowth || typeof seriesGrowth !== 'object') {
    errors.push(`${prefix}: like-for-like lifecycle growth evidence is missing`);
  } else {
    const requiredSeries = ['viewportStart', 'viewportEnd', 'base', 'expanded'];
    const requiredMetrics = ['active', 'pooled', 'leases', 'backingWidth', 'backingHeight'];
    for (const seriesName of requiredSeries) {
      const metrics = (seriesGrowth as Record<string, unknown>)[seriesName];
      if (!metrics || typeof metrics !== 'object') {
        errors.push(`${prefix}: lifecycle series ${seriesName} is missing`);
        continue;
      }
      for (const metricName of requiredMetrics) {
        const grew = (metrics as Record<string, unknown>)[metricName];
        if (typeof grew !== 'boolean') {
          errors.push(`${prefix}: lifecycle metric ${seriesName}.${metricName} is missing`);
          continue;
        }
        if (grew === true) {
          errors.push(`${prefix}: ${seriesName}.${metricName} has net growth after warm-up`);
        }
      }
    }
  }

  const zoom = report?.visualViewport || {};
  if (zoom.scaleChanged !== true) errors.push(`${prefix}: Chromium visualViewport scale did not change`);
  if (zoom.layoutRevisionAdvanced !== true) errors.push(`${prefix}: visualViewport did not advance layout revision`);
  if (zoom.cellSizeStable !== true) errors.push(`${prefix}: visualViewport changed stable cell size`);
  if (zoom.offsetCoordinateDelta?.matches !== true) {
    errors.push(`${prefix}: visualViewport offsets and cell coordinates diverged`);
  }

  const custom = report?.customBlob || {};
  if (!custom.boardId || !custom.stoneId) errors.push(`${prefix}: custom Blob skin was not saved`);
  if (custom.active?.skin?.board !== custom.boardId || custom.active?.skin?.stone !== custom.stoneId) {
    errors.push(`${prefix}: custom Blob skin did not become the active appearance`);
  }
  if (finite(custom.active?.leases?.source) < 1
    || finite(custom.active?.objectUrls?.activeLeaseCount) < 1) {
    errors.push(`${prefix}: custom Blob source/object URL lease was not retained`);
  }
  const leaseKeys = ['total', 'cached', 'external', 'source'];
  const returnedToBaseline = custom.baseline?.leases && custom.released?.leases
    && leaseKeys.every((key) => Number.isFinite(Number(custom.baseline.leases[key]))
      && Number.isFinite(Number(custom.released.leases[key]))
      && Number(custom.baseline.leases[key]) === Number(custom.released.leases[key]));
  if (!returnedToBaseline) {
    errors.push(`${prefix}: custom Blob texture leases did not return to their pre-custom baseline`);
  }
  if (finite(custom.released?.objectUrls?.activeLeaseCount) !== 0
    || finite(custom.released?.objectUrls?.retainedUrlCount) !== 0) {
    errors.push(`${prefix}: custom skin object URLs were not released`);
  }
  return { ok: errors.length === 0, errors };
}

function publicEntryPath(lane: Lane): string {
  return lane === 'classic'
    ? `/index.classic.html?${STATIC_ENTRY_QUERY}`
    : `/?${STATIC_ENTRY_QUERY}`;
}

function serializeBrowserCheckError(error: unknown): Record<string, unknown> {
  const candidate = error && typeof error === 'object' ? error as any : null;
  const serialized: Record<string, unknown> = {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error)
  };
  if (candidate?.code != null) serialized.code = String(candidate.code);
  if (candidate?.stage != null) serialized.stage = String(candidate.stage);
  if (error instanceof Error && error.stack) serialized.stack = error.stack;
  return serialized;
}

function createFailedLaneReport(lane: Lane, requestedDpr: number, error: unknown): any {
  const failure = serializeBrowserCheckError(error);
  return {
    lane,
    requestedDpr,
    publicEntry: publicEntryPath(lane),
    failure,
    evaluation: {
      ok: false,
      errors: [`${lane}@${requestedDpr}: browser capture failed: ${failure.message}`]
    }
  };
}

async function captureLane(
  rootDir: string,
  lane: Lane,
  requestedDpr: number,
  comparePhaseZero: boolean
): Promise<any> {
  const entryPath = publicEntryPath(lane);
  const smoke = await runBrowserUiControlSmoke({
    rootDir,
    entryPath,
    readyOnly: true,
    log: false,
    pageOptions: {
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      deviceScaleFactor: requestedDpr
    },
    beforeGoto: installBrowserProbe,
    afterReady: async (page: any) => {
      const fixtures: any[] = [];
      for (const fixture of BROWSER_FIXTURES as readonly FixtureDefinition[]) {
        fixtures.push(await captureFixture(
          page,
          rootDir,
          lane,
          requestedDpr,
          fixture,
          comparePhaseZero
        ));
      }
      return {
        fixtures,
        expansionRectInvariance: await captureExpansionRectInvariance(page),
        virtualization: await captureVirtualizationLifecycle(page),
        visualViewport: await captureVisualViewport(page),
        customBlob: await createCustomSkinBlobFixture(page)
      };
    }
  });
  const body = smoke.afterReadyResult || {};
  const report = {
    lane,
    requestedDpr,
    browserVersion: smoke.browserVersion,
    userAgent: smoke.userAgent,
    publicEntry: entryPath,
    smokeEvaluation: smoke.evaluation,
    ...body
  };
  const evaluation = evaluatePixijsBoardLaneReport(report);
  const smokeErrors = smoke.evaluation?.ok === true ? [] : (smoke.evaluation?.errors || ['browser smoke failed']);
  return {
    ...report,
    evaluation: {
      ok: evaluation.ok && smokeErrors.length === 0,
      errors: smokeErrors.concat(evaluation.errors)
    }
  };
}

async function runPixijsBoardBrowserCheck(options: CheckOptions = {}): Promise<any> {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const lanes = Array.from(new Set(options.lanes || ['classic', 'vite'])) as Lane[];
  const dprs = Array.from(new Set(options.dprs || [1, 2])).map(Number);
  const comparePhaseZero = options.comparePhaseZero !== false;
  const reports: any[] = [];
  for (const lane of lanes) {
    for (const dpr of dprs) {
      if (lane !== 'classic' && lane !== 'vite') throw new Error(`Unsupported browser lane: ${lane}`);
      if (dpr !== 1 && dpr !== 2) throw new Error(`Pixi static browser check DPR must be 1 or 2: ${dpr}`);
      if (options.log !== false) console.log(`[pixijs-board-browser-check] ${lane} DPR ${dpr}`);
      let report: any;
      try {
        report = await captureLane(rootDir, lane, dpr, comparePhaseZero);
      } catch (error) {
        report = createFailedLaneReport(lane, dpr, error);
      }
      reports.push(report);
    }
  }
  const result = {
    schemaVersion: 'pixijs_board_static_browser_check.v1',
    fixtureNames: (BROWSER_FIXTURES as readonly FixtureDefinition[]).map((fixture) => fixture.name),
    reports,
    ok: reports.every((report) => report.evaluation.ok === true)
  };
  if (options.log !== false) {
    console.log(JSON.stringify({
      schemaVersion: result.schemaVersion,
      ok: result.ok,
      lanes: reports.map((report) => ({
        lane: report.lane,
        dpr: report.requestedDpr,
        fixtureCount: Array.isArray(report.fixtures) ? report.fixtures.length : 0,
        screenshotDigest: sha256(JSON.stringify(
          Array.isArray(report.fixtures)
            ? report.fixtures.map((fixture: any) => fixture.screenshotSha256)
            : []
        )),
        failure: report.failure || null
      }))
    }, null, 2));
  }
  if (!result.ok) {
    const error = new Error(reports
      .flatMap((report) => report.evaluation?.errors || [])
      .join('; ')) as Error & { report?: any };
    error.name = 'PixijsBoardBrowserCheckError';
    error.report = result;
    throw error;
  }
  return result;
}

function parseCliOptions(argv: readonly string[]): CheckOptions {
  const classicOnly = argv.includes('--classic-only');
  const viteOnly = argv.includes('--vite-only');
  if (classicOnly && viteOnly) throw new Error('--classic-only and --vite-only are mutually exclusive');
  const dprArg = argv.find((arg) => /^--dpr=/.test(arg));
  const dprs = dprArg ? [Number(dprArg.slice('--dpr='.length))] : [1, 2];
  return {
    lanes: classicOnly ? ['classic'] : (viteOnly ? ['vite'] : ['classic', 'vite']),
    dprs,
    comparePhaseZero: !argv.includes('--no-phase-zero-pixel-check')
  };
}

if (require.main === module) {
  let options: CheckOptions;
  try {
    options = parseCliOptions(process.argv.slice(2));
  } catch (error) {
    console.error(`[pixijs-board-browser-check] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
  runPixijsBoardBrowserCheck(options).then(() => {
    console.log('[pixijs-board-browser-check] success');
  }).catch((error) => {
    const report = error && typeof error === 'object' ? (error as any).report : null;
    if (report) {
      console.error(JSON.stringify({
        schemaVersion: report.schemaVersion,
        ok: false,
        reports: (report.reports || []).filter((entry: any) => entry.evaluation?.ok !== true)
      }, null, 2));
    }
    console.error(`[pixijs-board-browser-check] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  BROWSER_FIXTURES,
  GUTTER_TOLERANCE_PX,
  PNG_DIFF_PIXEL_BUDGET,
  RECT_TOLERANCE_PX,
  REQUIRED_EXPANSION_FIXTURES,
  STATIC_ENTRY_QUERY,
  VIRTUALIZATION_FIXTURE,
  SPECIAL_TIMER_BADGE_EXPECTATIONS,
  applyPhaseZeroFixture,
  comparePhaseZeroGeometryAndSkin,
  comparePngBuffers,
  createFailedLaneReport,
  evaluatePixijsBoardLaneReport,
  hasNetGrowthAfterWarmup,
  isStrictMonotonicGrowth,
  parseCliOptions,
  readPhaseZeroFixtureBaseline,
  runPixijsBoardBrowserCheck,
  topologyBounds
};
