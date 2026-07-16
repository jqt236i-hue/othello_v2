import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import BrowserUiControlSmoke from './browser-ui-control-smoke';

const { runBrowserUiControlSmoke } = BrowserUiControlSmoke as any;

type BrowserLane = 'classic' | 'vite';
type BoardRenderer = 'dom' | 'pixi';
type PlaybackMode = 'normal' | 'reduced-motion' | 'noanim';

interface PlaybackStoneFixture {
  readonly row: number;
  readonly col: number;
  readonly color: 1 | -1;
}

interface PlaybackScenarioDefinition {
  readonly name: string;
  readonly eventType: string;
  readonly soundKey: string;
  readonly initialStones: readonly PlaybackStoneFixture[];
  readonly finalStones: readonly PlaybackStoneFixture[];
  readonly initialMarkers?: readonly unknown[];
  readonly finalMarkers?: readonly unknown[];
  readonly probeCells: readonly Readonly<{ row: number; col: number }>[];
  readonly events: readonly unknown[];
}

interface PlaybackBrowserCheckOptions {
  readonly rootDir?: string;
  readonly lanes?: readonly BrowserLane[];
  readonly modes?: readonly PlaybackMode[];
  readonly artifactDir?: string;
  readonly writeArtifacts?: boolean;
  readonly log?: boolean;
}

const BOARD_ROWS = 8;
const BOARD_COLS = 8;
const PLAYBACK_BOARD_SIZE = Object.freeze({ rows: BOARD_ROWS, cols: BOARD_COLS });
const DEFAULT_ARTIFACT_DIR = 'artifacts/pixijs-playback-browser-check';
const PLAYBACK_MODES: readonly PlaybackMode[] = Object.freeze([
  'normal',
  'reduced-motion',
  'noanim'
]);

function specialMarker(
  id: string,
  row: number,
  col: number,
  owner: 'black' | 'white',
  type: string,
  remainingOwnerTurns = 3
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    id,
    kind: 'specialStone',
    row,
    col,
    owner,
    data: Object.freeze({ type, remainingOwnerTurns })
  });
}

const PLAYBACK_SCENARIOS: readonly PlaybackScenarioDefinition[] = Object.freeze([
  Object.freeze({
    name: 'place',
    eventType: 'place',
    soundKey: 'stone_place',
    initialStones: Object.freeze([]),
    finalStones: Object.freeze([{ row: 2, col: 2, color: 1 as const }]),
    probeCells: Object.freeze([{ row: 2, col: 2 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'place',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          r: 2,
          col: 2,
          owner: 'black',
          after: Object.freeze({ color: 1 }),
          cause: 'SYSTEM',
          reason: 'standard_place',
          meta: Object.freeze({ placementKind: 'normal_placement' })
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'stone_place' }]) })
    ])
  }),
  Object.freeze({
    name: 'spawn',
    eventType: 'spawn',
    soundKey: 'breeding_spawn',
    initialStones: Object.freeze([]),
    finalStones: Object.freeze([{ row: 2, col: 3, color: -1 as const }]),
    finalMarkers: Object.freeze([specialMarker('pixi-playback-spawn', 2, 3, 'white', 'BREEDING')]),
    probeCells: Object.freeze([{ row: 2, col: 3 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'spawn',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          r: 2,
          col: 3,
          owner: 'white',
          after: Object.freeze({ color: -1, special: 'BREEDING', remainingOwnerTurns: 3 }),
          cause: 'BREEDING',
          reason: 'breeding_spawn'
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'breeding_spawn' }]) })
    ])
  }),
  Object.freeze({
    name: 'flip',
    eventType: 'flip',
    soundKey: 'stone_flip',
    initialStones: Object.freeze([{ row: 3, col: 3, color: -1 as const }]),
    finalStones: Object.freeze([{ row: 3, col: 3, color: 1 as const }]),
    finalMarkers: Object.freeze([specialMarker('pixi-playback-zombie', 3, 3, 'black', 'ZOMBIE')]),
    probeCells: Object.freeze([{ row: 3, col: 3 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'flip',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          r: 3,
          col: 3,
          ownerBefore: 'white',
          ownerAfter: 'black',
          before: Object.freeze({ color: -1 }),
          after: Object.freeze({ color: 1, special: 'ZOMBIE', remainingOwnerTurns: 3 }),
          cause: 'ZOMBIE',
          reason: 'zombie_infection'
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'stone_flip' }]) })
    ])
  }),
  Object.freeze({
    name: 'destroy',
    eventType: 'destroy',
    soundKey: 'stone_destroy',
    initialStones: Object.freeze([{ row: 4, col: 3, color: 1 as const }]),
    finalStones: Object.freeze([]),
    probeCells: Object.freeze([{ row: 4, col: 3 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'destroy',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          r: 4,
          col: 3,
          ownerBefore: 'black',
          before: Object.freeze({ color: 1 }),
          cause: 'SYSTEM',
          reason: 'board_effect'
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'stone_destroy' }]) })
    ])
  }),
  Object.freeze({
    name: 'move',
    eventType: 'move',
    soundKey: 'hyperactive_move',
    initialStones: Object.freeze([{ row: 4, col: 4, color: 1 as const }]),
    finalStones: Object.freeze([{ row: 4, col: 6, color: 1 as const }]),
    probeCells: Object.freeze([{ row: 4, col: 4 }, { row: 4, col: 6 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'move',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          from: Object.freeze({ r: 4, col: 4 }),
          to: Object.freeze({ r: 4, col: 6 }),
          owner: 'black',
          before: Object.freeze({ color: 1 }),
          after: Object.freeze({ color: 1 }),
          cause: 'STRONG_WIND_WILL',
          reason: 'strong_wind_move',
          meta: Object.freeze({ moveIntent: 'wind_move' })
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'hyperactive_move' }]) })
    ])
  }),
  Object.freeze({
    name: 'status',
    eventType: 'status_applied',
    soundKey: 'guard_apply',
    initialStones: Object.freeze([{ row: 5, col: 4, color: 1 as const }]),
    finalStones: Object.freeze([{ row: 5, col: 4, color: 1 as const }]),
    finalMarkers: Object.freeze([specialMarker('pixi-playback-guard', 5, 4, 'black', 'GUARD')]),
    probeCells: Object.freeze([{ row: 5, col: 4 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'status_applied',
        rawType: 'STATUS_APPLIED',
        phase: 1,
        meta: Object.freeze({ special: 'GUARD', highlightTone: 'positive' }),
        targets: Object.freeze([Object.freeze({
          r: 5,
          col: 4,
          owner: 'black',
          before: Object.freeze({ color: 1 }),
          after: Object.freeze({ color: 1, special: 'GUARD', remainingOwnerTurns: 3 })
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'guard_apply' }]) })
    ])
  })
]);

function stableValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableJson(value: any): string {
  return JSON.stringify(stableValue(value));
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildPlaybackParityDigest(value: {
  eventTypes: readonly string[];
  soundKeys: readonly string[];
  finalModelDigest: string;
}): string {
  return sha256(stableJson({
    eventTypes: value.eventTypes,
    soundKeys: value.soundKeys,
    finalModelDigest: value.finalModelDigest
  }));
}

function boardFromStones(stones: readonly PlaybackStoneFixture[]): number[][] {
  const board = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(0));
  for (const stone of stones) board[stone.row][stone.col] = stone.color;
  return board;
}

function canonicalFinalModelDigest(scenario: PlaybackScenarioDefinition): string {
  const markers = Array.from(scenario.finalMarkers || []).map(stableValue).sort((left: any, right: any) => (
    String(left?.id || '').localeCompare(String(right?.id || ''))
  ));
  return sha256(stableJson({
    board: boardFromStones(scenario.finalStones),
    boardConfig: { rows: BOARD_ROWS, cols: BOARD_COLS, shape: 'rectangle' },
    markers
  }));
}

function createBrowserScenarioPayload(scenario: PlaybackScenarioDefinition): Readonly<{
  definition: PlaybackScenarioDefinition;
  boardSize: Readonly<{ rows: number; cols: number }>;
}> {
  return Object.freeze({ definition: scenario, boardSize: PLAYBACK_BOARD_SIZE });
}

function expectedFinalRenderedCells(
  scenario: PlaybackScenarioDefinition
): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  const output: Record<string, Readonly<Record<string, unknown>>> = {};
  const markers = Array.from(scenario.finalMarkers || []) as any[];
  for (const coordinate of scenario.probeCells) {
    const key = `${coordinate.row},${coordinate.col}`;
    const fixture = scenario.finalStones.find((stone) => (
      stone.row === coordinate.row && stone.col === coordinate.col
    ));
    const marker = markers.find((candidate) => (
      Number(candidate?.row) === coordinate.row
      && Number(candidate?.col) === coordinate.col
      && String(candidate?.kind || '') === 'specialStone'
    ));
    output[key] = Object.freeze({
      hasStone: !!fixture,
      owner: fixture ? (fixture.color === 1 ? 'black' : 'white') : null,
      specialType: fixture && marker ? String(marker?.data?.type || '').trim().toUpperCase() || null : null
    });
  }
  return Object.freeze(output);
}

function publicEntryPath(lane: BrowserLane, renderer: BoardRenderer, mode: PlaybackMode): string {
  const query = new URLSearchParams({ debug: '1', boardRenderer: renderer });
  if (mode === 'noanim') query.set('noanim', '1');
  return lane === 'classic'
    ? `/index.classic.html?${query.toString()}`
    : `/?${query.toString()}`;
}

function serializeError(error: unknown): Readonly<Record<string, unknown>> {
  const candidate = error && typeof error === 'object' ? error as any : null;
  return Object.freeze({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    code: candidate?.code == null ? null : String(candidate.code),
    stage: candidate?.stage == null ? null : String(candidate.stage)
  });
}

async function installPlaybackProbe(page: any, mode: PlaybackMode): Promise<void> {
  await page.emulateMedia({ reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
}

async function startScenario(
  page: any,
  scenario: PlaybackScenarioDefinition,
  mode: PlaybackMode
): Promise<any> {
  return page.evaluate(async (input: ReturnType<typeof createBrowserScenarioPayload> & {
    readonly mode: PlaybackMode;
  }) => {
    const definition = input.definition;
    const boardRows = Number(input.boardSize.rows);
    const boardCols = Number(input.boardSize.cols);
    const root = window as any;
    const resolveModule = (names: string[], moduleId: string): any => {
      for (const name of names) if (root[name]) return root[name];
      try {
        if (typeof root.require === 'function') return root.require(moduleId);
      } catch (_error) { /* explicit failure below */ }
      return null;
    };
    const core = resolveModule(['CoreLogic', 'Core'], 'game/logic/core');
    const boardUtils = resolveModule(['SharedBoardUtils'], 'shared/shared-board-utils');
    const engine = resolveModule(['AnimationEngine'], 'ui/animation-engine');
    const renderer = resolveModule(['BoardRenderer'], 'ui/board-renderer');
    const debug = root.__boardVisualDebug;
    const boardElement = document.getElementById('board');
    if (!core || !boardUtils || !engine || !renderer || !debug || !boardElement) {
      throw new Error('Pixi playback browser fixture runtime is unavailable');
    }
    if (typeof renderer.playBoardVisualPhase !== 'function'
      || typeof renderer.getBoardVisualControllerReady !== 'function'
      || typeof renderer.getBoardVisualController !== 'function'
      || typeof root.forceFullRender !== 'function') {
      throw new Error('Pixi playback browser fixture seam is unavailable');
    }
    await renderer.getBoardVisualControllerReady();
    await debug.waitForIdle();

    const createState = (stones: readonly PlaybackStoneFixture[], markers: readonly unknown[]) => {
      const state = core.createGameState({ rows: boardRows, cols: boardCols, shape: 'rectangle' });
      state.board = Array.from({ length: boardRows }, () => Array(boardCols).fill(0));
      for (const stone of stones) state.board[stone.row][stone.col] = stone.color;
      state.boardExpansion = {
        active: false,
        side: null,
        row: null,
        owner: 0,
        usedByPlayer: { black: false, white: false },
        cells: []
      };
      boardUtils.attachBoardShape(state.board, {
        boardConfig: state.boardConfig,
        boardExpansion: state.boardExpansion,
        cardState: { markers }
      });
      return state;
    };
    const configureCardState = (markers: readonly unknown[]) => {
      const cardState = root.cardState && typeof root.cardState === 'object' ? root.cardState : {};
      cardState.markers = markers.map((marker: unknown) => JSON.parse(JSON.stringify(marker)));
      cardState.pendingEffectByPlayer = { black: null, white: null };
      cardState.boardBonusByCell = {};
      cardState.boardBonusConsumedByCell = {};
      cardState.theoryNumberCellByCell = {};
      cardState.presentationEvents = [];
      cardState._presentationEventsPersist = [];
      root.cardState = cardState;
      return cardState;
    };

    const initialMarkers = Array.from(definition.initialMarkers || []);
    const finalMarkers = Array.from(definition.finalMarkers || []);
    configureCardState(initialMarkers);
    root.gameState = createState(definition.initialStones, initialMarkers);
    await Promise.resolve(root.forceFullRender(boardElement));
    await debug.waitForIdle();
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
    await debug.waitForIdle();

    const initialVisualDigest = debug.getVisualFrameDigest();
    const initialBackendDiagnostics = debug.getBackendDiagnostics();
    const cardState = configureCardState(finalMarkers);
    root.gameState = createState(definition.finalStones, finalMarkers);
    engine.boardEl = boardElement;

    const originalPlayBoardVisualPhase = renderer.playBoardVisualPhase;
    const originalHandleSoundEffect = engine.handleSoundEffect;
    const probe: any = {
      scenario: definition.name,
      boardLaunches: [],
      boardCompletions: [],
      soundKeys: [],
      activeBoardLaunches: 0,
      keyFrame: null,
      keyFrameProbeError: null,
      keyFrameReady: null,
      done: false,
      error: null,
      promise: null
    };
    let resolveKeyFrameReady!: () => void;
    probe.keyFrameReady = new Promise<void>((resolve) => {
      resolveKeyFrameReady = resolve;
    });

    const captureCanvasPngDataUrl = (): Readonly<{
      dataUrl: string | null;
      source: 'pixi-extract' | null;
      error: string | null;
    }> => {
      const canvas = boardElement.querySelector('canvas');
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) {
        return Object.freeze({ dataUrl: null, source: null, error: 'Pixi canvas is unavailable' });
      }
      try {
        const controller = renderer.getBoardVisualController();
        if (!controller || typeof controller.captureDebugFramePngDataUrl !== 'function') {
          return Object.freeze({
            dataUrl: null,
            source: null,
            error: 'Pixi debug frame extractor is unavailable'
          });
        }
        const extracted = controller.captureDebugFramePngDataUrl();
        if (/^data:image\/png;base64,[A-Za-z0-9+/=\r\n]+$/.test(String(extracted || ''))) {
          return Object.freeze({ dataUrl: extracted, source: 'pixi-extract' as const, error: null });
        }
        return Object.freeze({ dataUrl: null, source: null, error: 'Pixi extractor returned an invalid PNG' });
      } catch (error) {
        return Object.freeze({
          dataUrl: null,
          source: null,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };
    const readRenderedCells = (): Readonly<Record<string, unknown>> => {
      const renderedCells: Record<string, unknown> = {};
      for (const cell of definition.probeCells) {
        const rendered = debug.getRenderedCell(cell.row, cell.col);
        const stone = rendered?.stone || null;
        const pixiDiagnostics = stone && typeof stone.visible === 'boolean';
        const visible = pixiDiagnostics ? stone.visible === true : !!stone;
        const markers = Array.isArray(rendered?.markers) ? rendered.markers : [];
        const markerSpecialType = (() => {
          for (const marker of markers) {
            const kind = String(marker?.kind || '').trim().toLowerCase();
            const explicit = String(marker?.data?.type || '').trim().toUpperCase();
            if (explicit) return explicit;
            if (kind === 'guard') return 'GUARD';
            if (kind === 'living-will-aura') return 'LIVING_WILL';
            if (kind === 'blockade') return 'BLOCKADE';
            if (kind === 'frozen') return 'FREEZE';
            if (kind === 'seed') return 'SEED';
            if (kind === 'poison-cell') return 'POISON_CELL';
            if (kind === 'poisoned') return 'POISONED';
          }
          return null;
        })();
        renderedCells[`${cell.row},${cell.col}`] = {
          rendered: rendered?.rendered !== false,
          hasStone: visible && !!stone?.owner,
          owner: visible ? stone?.owner || null : null,
          specialType: visible ? stone?.specialType || markerSpecialType : null,
          playbackHidden: rendered?.playback?.hidden === true
        };
      }
      return renderedCells;
    };
    const readKeyFrameCandidate = (captureStage: string): any => ({
      captureStage,
      writerMode: debug.getWriterMode(),
      visualFrameDigest: debug.getVisualFrameDigest(),
      backendDiagnostics: debug.getBackendDiagnostics(),
      displayObjectCounts: debug.getDisplayObjectCounts(),
      renderedCells: readRenderedCells(),
      activeBoardLaunches: Number(probe.activeBoardLaunches || 0)
    });
    const activeProjectionCount = (candidate: any): number => {
      const pool = candidate?.backendDiagnostics?.pool || {};
      return Number(pool.activePlaybackGhostCount || 0)
        + Number(pool.activePlaybackHighlightLeaseCount || 0);
    };
    const baselineRenderCount = Number(initialBackendDiagnostics?.application?.renderCount || 0);
    const isRenderedActiveCandidate = (candidate: any): boolean => {
      const timeline = candidate?.backendDiagnostics?.timeline || {};
      const application = candidate?.backendDiagnostics?.application || {};
      if (candidate?.writerMode !== 'playback'
        || Number(timeline.activeRunCount || 0) < 1
        || Number(application.renderCount || 0) <= baselineRenderCount) {
        return false;
      }
      const reducedDestroy = input.mode === 'reduced-motion' && definition.name === 'destroy';
      return reducedDestroy || activeProjectionCount(candidate) >= 1;
    };
    const commitKeyFrame = (candidate: any, captureKind: 'active' | 'settled'): void => {
      if (probe.keyFrame) return;
      const frameCapture = captureCanvasPngDataUrl();
      probe.keyFrame = {
        ...candidate,
        captureKind,
        capturedInsidePlayback: true,
        playbackDone: captureKind === 'settled',
        canvasPngDataUrl: frameCapture.dataUrl,
        canvasCaptureSource: frameCapture.source,
        canvasCaptureError: frameCapture.error
      };
      resolveKeyFrameReady();
    };
    const serializeProbeError = (error: any): Readonly<Record<string, unknown>> => ({
      name: String(error?.name || 'Error'),
      message: String(error?.message || error || '')
    });

    renderer.playBoardVisualPhase = async function (...args: any[]) {
      const events = Array.isArray(args[1]) ? args[1] : [];
      const eventTypes = events.map((event: any) => String(event?.type || '').trim().toLowerCase());
      probe.boardLaunches.push(eventTypes);
      probe.activeBoardLaunches += 1;
      let phaseSettled = false;
      let samplingPromise: Promise<void> | null = null;
      try {
        const playbackResult = originalPlayBoardVisualPhase.apply(this, args);
        if (debug.getBackendKind() === 'pixi') {
          samplingPromise = (async () => {
            const sample = (captureStage: string): boolean => {
              const candidate = readKeyFrameCandidate(captureStage);
              if (input.mode !== 'noanim' && isRenderedActiveCandidate(candidate)) {
                commitKeyFrame(candidate, 'active');
                return true;
              }
              if (phaseSettled) {
                commitKeyFrame(candidate, 'settled');
                return true;
              }
              return false;
            };

            // Pixi timeline.run() publishes its projection synchronously, then
            // performs the first explicit renderer flush in a microtask. Sample
            // both boundaries before following private-ticker animation frames.
            if (sample('sync')) return;
            await Promise.resolve();
            if (sample('microtask')) return;
            let animationFrameCount = 0;
            while (!phaseSettled && animationFrameCount < 120) {
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
              animationFrameCount += 1;
              if (sample('animation-frame')) return;
            }
            sample('settled-fallback');
          })().catch((error: any) => {
            probe.keyFrameProbeError = serializeProbeError(error);
            resolveKeyFrameReady();
          });
        }
        const result = await playbackResult;
        probe.boardCompletions.push(eventTypes);
        return result;
      } finally {
        phaseSettled = true;
        if (samplingPromise) await samplingPromise;
        probe.activeBoardLaunches = Math.max(0, probe.activeBoardLaunches - 1);
      }
    };
    engine.handleSoundEffect = async function (event: any) {
      const keys: string[] = [];
      if (event?.soundKey) keys.push(String(event.soundKey));
      for (const target of (Array.isArray(event?.targets) ? event.targets : [])) {
        if (target?.soundKey) keys.push(String(target.soundKey));
      }
      for (const key of keys.map((value) => value.trim()).filter(Boolean)) probe.soundKeys.push(key);
    };

    const playbackPromise = (async () => {
      try {
        await engine.play(definition.events);
      } catch (error: any) {
        probe.error = {
          name: String(error?.name || 'Error'),
          message: String(error?.message || error || ''),
          code: error?.code == null ? null : String(error.code)
        };
      } finally {
        renderer.playBoardVisualPhase = originalPlayBoardVisualPhase;
        engine.handleSoundEffect = originalHandleSoundEffect;
        probe.done = true;
      }
      await debug.waitForIdle();
      return true;
    })();
    probe.promise = playbackPromise;
    playbackPromise.catch(() => undefined);
    root.__pixiPlaybackBrowserCheckProbe = probe;
    return {
      backendKind: debug.getBackendKind(),
      initialVisualDigest,
      initialBackendDiagnostics,
      finalMarkerCount: cardState.markers.length
    };
  }, { ...createBrowserScenarioPayload(scenario), mode });
}

async function waitForScenarioStart(page: any): Promise<void> {
  await page.waitForFunction(() => {
    const probe = (window as any).__pixiPlaybackBrowserCheckProbe;
    return !!probe && (probe.boardLaunches.length > 0 || probe.done === true);
  }, null, { timeout: 10000 });
}

async function readScenarioProbe(
  page: any,
  probeCells: readonly Readonly<{ row: number; col: number }>[]
): Promise<any> {
  return page.evaluate((cells: readonly Readonly<{ row: number; col: number }>[]) => {
    const root = window as any;
    const debug = root.__boardVisualDebug;
    const probe = root.__pixiPlaybackBrowserCheckProbe;
    const renderedCells: Record<string, unknown> = {};
    for (const cell of cells) {
      const rendered = debug.getRenderedCell(cell.row, cell.col);
      const stone = rendered?.stone || null;
      const pixiDiagnostics = stone && typeof stone.visible === 'boolean';
      const visible = pixiDiagnostics ? stone.visible === true : !!stone;
      const markers = Array.isArray(rendered?.markers) ? rendered.markers : [];
      const markerSpecialType = (() => {
        for (const marker of markers) {
          const kind = String(marker?.kind || '').trim().toLowerCase();
          const explicit = String(marker?.data?.type || '').trim().toUpperCase();
          if (explicit) return explicit;
          if (kind === 'guard') return 'GUARD';
          if (kind === 'living-will-aura') return 'LIVING_WILL';
          if (kind === 'blockade') return 'BLOCKADE';
          if (kind === 'frozen') return 'FREEZE';
          if (kind === 'seed') return 'SEED';
          if (kind === 'poison-cell') return 'POISON_CELL';
          if (kind === 'poisoned') return 'POISONED';
        }
        return null;
      })();
      renderedCells[`${cell.row},${cell.col}`] = {
        rendered: rendered?.rendered !== false,
        hasStone: visible && !!stone?.owner,
        owner: visible ? stone?.owner || null : null,
        specialType: visible ? stone?.specialType || markerSpecialType : null,
        playbackHidden: rendered?.playback?.hidden === true
      };
    }
    return {
      writerMode: debug.getWriterMode(),
      visualFrameDigest: debug.getVisualFrameDigest(),
      backendDiagnostics: debug.getBackendDiagnostics(),
      displayObjectCounts: debug.getDisplayObjectCounts(),
      renderedCells,
      playbackDone: probe?.done === true,
      activeBoardLaunches: Number(probe?.activeBoardLaunches || 0)
    };
  }, probeCells);
}

async function readInPageKeyFrame(page: any): Promise<any> {
  await page.waitForFunction(() => {
    const probe = (window as any).__pixiPlaybackBrowserCheckProbe;
    return !!probe && (!!probe.keyFrame || !!probe.keyFrameProbeError || probe.done === true);
  }, null, { timeout: 10000 });
  return page.evaluate(() => {
    const probe = (window as any).__pixiPlaybackBrowserCheckProbe;
    if (probe?.keyFrameProbeError) {
      return {
        capturedInsidePlayback: true,
        captureKind: 'failed',
        playbackDone: probe?.done === true,
        probeError: probe.keyFrameProbeError,
        canvasPngDataUrl: null
      };
    }
    return probe?.keyFrame || null;
  });
}

function renderedCellSemantics(cells: unknown): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  if (!cells || typeof cells !== 'object' || Array.isArray(cells)) return Object.freeze({});
  const output: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const key of Object.keys(cells as Record<string, unknown>).sort()) {
    const cell = (cells as Record<string, any>)[key] || {};
    output[key] = Object.freeze({
      hasStone: cell.hasStone === true,
      owner: cell.hasStone === true ? cell.owner || null : null,
      specialType: cell.hasStone === true ? cell.specialType || null : null
    });
  }
  return Object.freeze(output);
}

async function completeScenario(page: any): Promise<any> {
  return page.evaluate(async (boardSize: Readonly<{ rows: number; cols: number }>) => {
    const root = window as any;
    const probe = root.__pixiPlaybackBrowserCheckProbe;
    if (!probe?.promise) throw new Error('Pixi playback browser scenario promise is unavailable');
    await probe.promise;
    await root.__boardVisualDebug.waitForIdle();
    const stable = (value: any): any => {
      if (Array.isArray(value)) return value.map(stable);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    };
    const markers = Array.from(root.cardState?.markers || [])
      .map(stable)
      .sort((left: any, right: any) => String(left?.id || '').localeCompare(String(right?.id || '')));
    return {
      boardLaunches: probe.boardLaunches,
      boardCompletions: probe.boardCompletions,
      soundKeys: probe.soundKeys,
      error: probe.error,
      finalModel: {
        board: root.gameState.board.map((row: any[]) => Array.from(row)),
        boardConfig: {
          rows: Number(root.gameState.boardConfig?.rows || boardSize.rows),
          cols: Number(root.gameState.boardConfig?.cols || boardSize.cols),
          shape: String(root.gameState.boardConfig?.shape || 'rectangle')
        },
        markers
      },
      playbackActive: root.VisualPlaybackActive === true,
      processing: root.isProcessing === true,
      cardAnimating: root.isCardAnimating === true,
      writerMode: root.__boardVisualDebug.getWriterMode(),
      finalVisualDigest: root.__boardVisualDebug.getVisualFrameDigest(),
      backendDiagnostics: root.__boardVisualDebug.getBackendDiagnostics(),
      displayObjectCounts: root.__boardVisualDebug.getDisplayObjectCounts()
    };
  }, PLAYBACK_BOARD_SIZE);
}

function pngBufferFromDataUrl(value: unknown): Buffer | null {
  if (typeof value !== 'string') return null;
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
  if (!match) return null;
  const buffer = Buffer.from(match[1].replace(/[\r\n]/g, ''), 'base64');
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buffer.length > pngSignature.length && buffer.subarray(0, pngSignature.length).equals(pngSignature)
    ? buffer
    : null;
}

async function captureScenario(
  page: any,
  scenario: PlaybackScenarioDefinition,
  renderer: BoardRenderer,
  mode: PlaybackMode,
  artifactDir: string,
  writeArtifacts: boolean
): Promise<any> {
  const started = await startScenario(page, scenario, mode);
  await waitForScenarioStart(page);
  const keyFrameProbe = renderer === 'pixi'
    ? await readInPageKeyFrame(page)
    : null;
  let keyFrameScreenshotSha256: string | null = null;
  let keyFrameArtifactPath: string | null = null;
  let keyFrameScreenshotSource: 'pixi-extract' | 'external-board-fallback' | null = null;
  if (renderer === 'pixi') {
    const inPageScreenshot = pngBufferFromDataUrl(keyFrameProbe?.canvasPngDataUrl);
    const screenshot = inPageScreenshot
      || await page.locator('#board').screenshot({ animations: 'allow' });
    keyFrameScreenshotSource = inPageScreenshot
      ? 'pixi-extract'
      : 'external-board-fallback';
    keyFrameScreenshotSha256 = sha256(screenshot);
    if (writeArtifacts) {
      keyFrameArtifactPath = path.join(artifactDir, `${mode}-${scenario.name}-key-frame.png`);
      fs.mkdirSync(path.dirname(keyFrameArtifactPath), { recursive: true });
      fs.writeFileSync(keyFrameArtifactPath, screenshot);
    }
  }

  const completion = await completeScenario(page);
  const finalProbe = await readScenarioProbe(page, scenario.probeCells);
  const finalModelDigest = sha256(stableJson(completion.finalModel));
  const eventTypes = completion.boardLaunches.flatMap((launch: string[]) => launch);
  const completedEventTypes = completion.boardCompletions.flatMap((launch: string[]) => launch);
  return {
    scenario: scenario.name,
    expectedEventType: scenario.eventType,
    expectedSoundKey: scenario.soundKey,
    expectedFinalModelDigest: canonicalFinalModelDigest(scenario),
    expectedFinalRenderedCells: expectedFinalRenderedCells(scenario),
    inputDigest: sha256(stableJson(scenario.events)),
    started,
    eventTypes,
    completedEventTypes,
    soundKeys: completion.soundKeys,
    error: completion.error,
    finalModelDigest,
    finalVisualDigest: completion.finalVisualDigest,
    settledFlags: {
      playbackActive: completion.playbackActive,
      processing: completion.processing,
      cardAnimating: completion.cardAnimating,
      writerMode: completion.writerMode
    },
    keyFrame: keyFrameProbe ? {
      ...Object.fromEntries(Object.entries(keyFrameProbe).filter(([key]) => key !== 'canvasPngDataUrl')),
      screenshotSha256: keyFrameScreenshotSha256,
      screenshotSource: keyFrameScreenshotSource,
      artifactPath: keyFrameArtifactPath
    } : null,
    final: finalProbe,
    parityDigest: buildPlaybackParityDigest({ eventTypes, soundKeys: completion.soundKeys, finalModelDigest })
  };
}

async function captureRendererLane(
  rootDir: string,
  lane: BrowserLane,
  renderer: BoardRenderer,
  mode: PlaybackMode,
  artifactRoot: string,
  writeArtifacts: boolean
): Promise<any> {
  const artifactDir = path.join(artifactRoot, lane, renderer);
  const smoke = await runBrowserUiControlSmoke({
    rootDir,
    entryPath: publicEntryPath(lane, renderer, mode),
    readyOnly: true,
    log: false,
    pageOptions: { viewport: { width: 980, height: 760 }, deviceScaleFactor: 1 },
    beforeGoto: (page: any) => installPlaybackProbe(page, mode),
    afterReady: async (page: any) => {
      const scenarios: any[] = [];
      for (const scenario of PLAYBACK_SCENARIOS) {
        scenarios.push(await captureScenario(
          page,
          scenario,
          renderer,
          mode,
          artifactDir,
          writeArtifacts
        ));
      }
      return { scenarios };
    }
  });
  return {
    lane,
    renderer,
    mode,
    publicEntry: publicEntryPath(lane, renderer, mode),
    browserVersion: smoke.browserVersion,
    userAgent: smoke.userAgent,
    smokeEvaluation: smoke.evaluation,
    scenarios: smoke.afterReadyResult?.scenarios || []
  };
}

function evaluateScenario(report: any, errors: string[]): void {
  const prefix = `${report.lane}/${report.renderer}/${report.mode}/${report.scenario}`;
  if (stableJson(report.eventTypes) !== stableJson([report.expectedEventType])) {
    errors.push(`${prefix}: board event start order drifted`);
  }
  if (stableJson(report.completedEventTypes) !== stableJson([report.expectedEventType])) {
    errors.push(`${prefix}: board event completion order drifted`);
  }
  if (stableJson(report.soundKeys) !== stableJson([report.expectedSoundKey])) {
    errors.push(`${prefix}: sound order drifted`);
  }
  if (report.error) errors.push(`${prefix}: playback failed: ${report.error.message || report.error}`);
  if (report.finalModelDigest !== report.expectedFinalModelDigest) {
    errors.push(`${prefix}: final model digest drifted`);
  }
  if (stableJson(renderedCellSemantics(report.final?.renderedCells))
    !== stableJson(renderedCellSemantics(report.expectedFinalRenderedCells))) {
    errors.push(`${prefix}: final rendered cell semantics drifted`);
  }
  for (const cell of Object.values(report.final?.renderedCells || {}) as any[]) {
    if (cell?.rendered === false || cell?.playbackHidden === true) {
      errors.push(`${prefix}: final rendered cell remained offscreen or playback-hidden`);
      break;
    }
  }
  if (report.parityDigest !== buildPlaybackParityDigest(report)) {
    errors.push(`${prefix}: event, sound, and final-model parity digest is inconsistent`);
  }
  if (report.settledFlags?.playbackActive
    || report.settledFlags?.processing
    || report.settledFlags?.cardAnimating
    || report.settledFlags?.writerMode !== 'idle') {
    errors.push(`${prefix}: playback flags or writer did not settle`);
  }
  if (report.renderer !== 'pixi') return;
  if (report.keyFrame?.capturedInsidePlayback !== true) {
    errors.push(`${prefix}: key-frame was not captured inside board playback`);
  }
  if (report.keyFrame?.probeError) {
    errors.push(`${prefix}: in-page key-frame probe failed: ${report.keyFrame.probeError.message || report.keyFrame.probeError}`);
  }
  if (report.keyFrame?.canvasCaptureError) {
    errors.push(`${prefix}: Pixi key-frame extraction failed: ${report.keyFrame.canvasCaptureError}`);
  }
  if (!/^[a-f0-9]{64}$/.test(String(report.keyFrame?.screenshotSha256 || ''))) {
    errors.push(`${prefix}: key-frame screenshot evidence is missing`);
  }
  if (report.keyFrame?.screenshotSource !== 'pixi-extract') {
    errors.push(`${prefix}: key-frame screenshot was not captured through Pixi's offscreen extractor`);
  }
  if (report.mode !== 'noanim') {
    const pool = report.keyFrame?.backendDiagnostics?.pool || {};
    const timeline = report.keyFrame?.backendDiagnostics?.timeline || {};
    const activeProjectionCount = Number(pool.activePlaybackGhostCount || 0)
      + Number(pool.activePlaybackHighlightLeaseCount || 0);
    const observedBeforeSettlement = report.keyFrame?.writerMode === 'playback'
      && report.keyFrame?.playbackDone !== true
      && Number(timeline.activeRunCount || 0) >= 1;
    const observedReducedSettlement = report.mode === 'reduced-motion'
      && (report.keyFrame?.writerMode === 'idle' || report.keyFrame?.writerMode === 'playback')
      && report.keyFrame?.playbackDone === true
      && report.keyFrame?.captureKind === 'settled'
      && Number(timeline.activeRunCount || 0) === 0;
    if (!observedBeforeSettlement && !observedReducedSettlement) {
      errors.push(`${prefix}: animated key-frame was not observed before settlement`);
    }
    if (report.mode === 'normal' && report.keyFrame?.captureKind !== 'active') {
      errors.push(`${prefix}: normal-motion key-frame was not captured from an active frame`);
    }
    const reducedDestroy = report.mode === 'reduced-motion' && report.scenario === 'destroy';
    if (observedBeforeSettlement && (reducedDestroy ? activeProjectionCount !== 0 : activeProjectionCount < 1)) {
      errors.push(reducedDestroy
        ? `${prefix}: reduced-motion destroy retained a visual ghost after its immediate fade`
        : `${prefix}: animated key-frame had no active projection`);
    }
  } else if (report.keyFrame?.captureKind !== 'settled') {
    errors.push(`${prefix}: NOANIM key-frame did not capture immediate settlement`);
  }
  const diagnostics = report.final?.backendDiagnostics || {};
  const timeline = diagnostics.timeline || {};
  const playback = diagnostics.playback || {};
  const pool = diagnostics.pool || {};
  if (diagnostics.tickerRunning === true
    || timeline.tickerRunning === true
    || timeline.tickerSubscribed === true
    || Number(timeline.activeRunCount || 0) !== 0) {
    errors.push(`${prefix}: private ticker remained active after settlement`);
  }
  if (Number(diagnostics.application?.tickerListenerCount || 0) !== 0) {
    errors.push(`${prefix}: private ticker listener remained subscribed after settlement`);
  }
  if (Number(timeline.startedRunCount || 0)
    <= Number(report.started?.initialBackendDiagnostics?.timeline?.startedRunCount || 0)) {
    errors.push(`${prefix}: effect did not traverse the Pixi timeline`);
  }
  if (Number(playback.inFlightEffectCount || 0) !== 0
    || Number(playback.projectedStoneCount || 0) !== 0
    || Number(playback.retainedFinalGhostCount || 0) !== 0
    || playback.activeScopeKey != null) {
    errors.push(`${prefix}: playback projection remained active after settlement`);
  }
  if (Number(pool.activePlaybackGhostCount || 0) !== 0
    || Number(pool.activePlaybackHighlightLeaseCount || 0) !== 0
    || Number(pool.renderedPlaybackHighlightCount || 0) !== 0) {
    errors.push(`${prefix}: playback object-pool lease remained active after settlement`);
  }
  if (Number(pool.pooledPlaybackGhostCount || 0) > 2
    || Number(pool.pooledPlaybackHighlightCount || 0) > 1) {
    errors.push(`${prefix}: playback object pool exceeded the six-scenario fixture bound`);
  }
  if (Number(diagnostics.domCellCount || 0) !== 0
    || Number(diagnostics.canvasCount || 0) !== 1) {
    errors.push(`${prefix}: Pixi/DOM exclusive render surface contract drifted`);
  }
}

function evaluatePixiPlaybackBrowserReport(result: any): { ok: boolean; errors: string[] } {
  const reports = Array.isArray(result?.reports) ? result.reports : [];
  const errors: string[] = [];
  for (const report of reports) {
    if (report.failure) {
      errors.push(`${report.lane}/${report.renderer}/${report.mode}: ${report.failure.message || report.failure}`);
      continue;
    }
    for (const error of report.smokeEvaluation?.errors || []) {
      errors.push(`${report.lane}/${report.renderer}/${report.mode}: ${error}`);
    }
    const names = (report.scenarios || []).map((scenario: any) => scenario.scenario);
    if (stableJson(names) !== stableJson(PLAYBACK_SCENARIOS.map((scenario) => scenario.name))) {
      errors.push(`${report.lane}/${report.renderer}/${report.mode}: six-event fixture coverage is incomplete`);
    }
    for (const scenario of report.scenarios || []) evaluateScenario({ ...scenario, ...report }, errors);
  }

  const lanes = Array.from(new Set(reports.map((report: any) => report.lane)));
  const modes = Array.from(new Set(reports.map((report: any) => report.mode)));
  for (const lane of lanes) {
    for (const mode of modes) {
      const dom = reports.find((report: any) => report.lane === lane && report.mode === mode && report.renderer === 'dom');
      const pixi = reports.find((report: any) => report.lane === lane && report.mode === mode && report.renderer === 'pixi');
      if (!dom || !pixi || dom.failure || pixi.failure) continue;
      for (const definition of PLAYBACK_SCENARIOS) {
        const domScenario = dom.scenarios.find((scenario: any) => scenario.scenario === definition.name);
        const pixiScenario = pixi.scenarios.find((scenario: any) => scenario.scenario === definition.name);
        if (!domScenario || !pixiScenario) continue;
        if (domScenario.inputDigest !== pixiScenario.inputDigest
          || buildPlaybackParityDigest(domScenario) !== buildPlaybackParityDigest(pixiScenario)) {
          errors.push(`${lane}/${mode}/${definition.name}: DOM/Pixi event, sound, or final-model digest drifted`);
        }
        if (stableJson(renderedCellSemantics(domScenario.final?.renderedCells))
          !== stableJson(renderedCellSemantics(pixiScenario.final?.renderedCells))) {
          errors.push(`${lane}/${mode}/${definition.name}: DOM/Pixi final rendered state drifted`);
        }
      }
    }
  }

  for (const mode of modes) {
    const pixiReports = reports.filter((report: any) => report.renderer === 'pixi' && report.mode === mode && !report.failure);
    if (pixiReports.length < 2) continue;
    for (const definition of PLAYBACK_SCENARIOS) {
      const digests = new Set(pixiReports.map((report: any) => (
        report.scenarios.find((scenario: any) => scenario.scenario === definition.name)?.parityDigest
      )));
      if (digests.size !== 1) errors.push(`${mode}/${definition.name}: classic/Vite Pixi parity drifted`);
      const visualDigests = new Set(pixiReports.map((report: any) => (
        report.scenarios.find((scenario: any) => scenario.scenario === definition.name)?.finalVisualDigest
      )));
      if (visualDigests.size !== 1) errors.push(`${mode}/${definition.name}: classic/Vite Pixi final visual digest drifted`);
    }
  }
  return { ok: errors.length === 0, errors };
}

async function runPixiPlaybackBrowserCheck(options: PlaybackBrowserCheckOptions = {}): Promise<any> {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const lanes = Array.from(new Set(options.lanes || ['classic', 'vite'])) as BrowserLane[];
  const modes = Array.from(new Set(options.modes || PLAYBACK_MODES)) as PlaybackMode[];
  const artifactRoot = path.resolve(rootDir, options.artifactDir || DEFAULT_ARTIFACT_DIR);
  const reports: any[] = [];
  for (const lane of lanes) {
    for (const mode of modes) {
      for (const renderer of ['dom', 'pixi'] as const) {
        if (options.log !== false) console.log(`[pixijs-board-playback-check] ${lane}/${renderer}/${mode}`);
        try {
          reports.push(await captureRendererLane(
            rootDir,
            lane,
            renderer,
            mode,
            artifactRoot,
            options.writeArtifacts !== false
          ));
        } catch (error) {
          reports.push({ lane, renderer, mode, failure: serializeError(error), scenarios: [] });
        }
      }
    }
  }
  const draft = {
    schemaVersion: 'pixijs_board_playback_browser_check.v1',
    scenarioNames: PLAYBACK_SCENARIOS.map((scenario) => scenario.name),
    reports
  };
  const evaluation = evaluatePixiPlaybackBrowserReport(draft);
  const result = { ...draft, evaluation, ok: evaluation.ok };
  if (options.writeArtifacts !== false) {
    fs.mkdirSync(artifactRoot, { recursive: true });
    fs.writeFileSync(path.join(artifactRoot, 'report.json'), `${JSON.stringify(result, null, 2)}\n`);
  }
  if (options.log !== false) {
    console.log(JSON.stringify({
      schemaVersion: result.schemaVersion,
      ok: result.ok,
      reportCount: reports.length,
      scenarioCount: reports.reduce((sum, report) => sum + (report.scenarios?.length || 0), 0),
      errors: evaluation.errors
    }, null, 2));
  }
  if (!result.ok) {
    const error = new Error(evaluation.errors.join('; ')) as Error & { report?: any };
    error.name = 'PixiPlaybackBrowserCheckError';
    error.report = result;
    throw error;
  }
  return result;
}

function parseCliOptions(argv: readonly string[]): PlaybackBrowserCheckOptions {
  const classicOnly = argv.includes('--classic-only');
  const viteOnly = argv.includes('--vite-only');
  if (classicOnly && viteOnly) throw new Error('--classic-only and --vite-only are mutually exclusive');
  const modeArg = argv.find((arg) => arg.startsWith('--mode='));
  const mode = modeArg ? modeArg.slice('--mode='.length) as PlaybackMode : null;
  if (mode && !PLAYBACK_MODES.includes(mode)) throw new Error(`Unsupported playback mode: ${mode}`);
  return {
    lanes: classicOnly ? ['classic'] : (viteOnly ? ['vite'] : ['classic', 'vite']),
    modes: mode ? [mode] : PLAYBACK_MODES,
    writeArtifacts: !argv.includes('--no-artifacts')
  };
}

if (require.main === module) {
  let options: PlaybackBrowserCheckOptions;
  try {
    options = parseCliOptions(process.argv.slice(2));
  } catch (error) {
    console.error(`[pixijs-board-playback-check] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
  runPixiPlaybackBrowserCheck(options).then(() => {
    console.log('[pixijs-board-playback-check] success');
  }).catch((error) => {
    console.error(`[pixijs-board-playback-check] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  PLAYBACK_MODES,
  PLAYBACK_BOARD_SIZE,
  PLAYBACK_SCENARIOS,
  buildPlaybackParityDigest,
  canonicalFinalModelDigest,
  createBrowserScenarioPayload,
  expectedFinalRenderedCells,
  renderedCellSemantics,
  evaluatePixiPlaybackBrowserReport,
  parseCliOptions,
  publicEntryPath,
  runPixiPlaybackBrowserCheck
};
