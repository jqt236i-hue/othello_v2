import type {
  BoardClientRect,
  BoardPlaybackContext,
  BoardPlaybackValidationContext,
  BoardVisualBackend,
  BoardVisualBackendDeps,
  BoardVisualFrame,
  BoardViewportLayout
} from '../board-visual/types';
import BoardSkinCatalog = require('../board-skin/catalog');
import StoneSkinCatalog = require('../stone-skin/catalog');
import PixiRuntimeContract = require('./runtime-contract');
import { parsePlayerSeatKey } from '../../shared/player-seat-contract';
import {
  createPixiBoardApplication,
  type PixiBoardApplication,
  type PixiBoardApplicationOptions
} from './application';
import {
  createPixiBoardCamera,
  type PixiBoardCamera,
  type PixiBoardCameraOptions,
  type PixiBoardCanvasViewport
} from './camera';
import {
  acquireBoardAppearanceObjectUrlLease,
  resolveBoardAppearanceResources,
  resolveSpecialStoneAppearanceResource,
  type BoardAppearanceObjectUrlLease,
  type BoardAppearanceResourceDescriptor,
  type ResolvedBoardAppearance
} from './appearance-resolver';
import {
  createPixiTextureManager,
  PixiTextureManagerError,
  type PixiCommittedTextureSet,
  type PixiPreparedTextureSet,
  type PixiTextureManager,
  type PixiTextureManagerOptions,
  type PixiTextureManagerRuntime,
  type PixiTextureRequest
} from './texture-manager';
import {
  createPixiBoardScene,
  type PixiBoardScene,
  type PixiBoardSceneOptions
} from './board-scene';
import {
  createPixiBoardInput,
  type PixiBoardInput,
  type PixiBoardInputControllerPort,
  type PixiBoardInputOptions
} from './board-input';
import {
  createPixiBoardPlayback,
  type PixiBoardPlayback,
  type PixiBoardPlaybackOptions
} from './board-playback';
import {
  PIXI_PLAYBACK_RESTORE_INTERRUPTION_CODE,
  isPixiPlaybackControlledInterruption
} from '../board-visual/playback-interruption';
import type { PixiStaticTextureSource } from './cell-view';
import {
  classifyWebGlRenderer,
  type WebGlRendererClassification
} from '../../shared/webgl-renderer-classification';
import {
  createPixiContextRecovery,
  type PixiContextRecovery,
  type PixiContextRecoveryDiagnostics
} from './context-recovery';

export type PixiBoardBackendErrorStage =
  | 'runtime'
  | 'webgl'
  | 'application'
  | 'camera-init'
  | 'mount'
  | 'scene-init'
  | 'input-init'
  | 'playback-init'
  | 'texture-init'
  | 'texture-prepare'
  | 'texture-commit'
  | 'scene-apply'
  | 'render'
  | 'resize'
  | 'play-phase'
  | 'lifecycle';

export class PixiBoardBackendError extends Error {
  readonly code: string;
  readonly stage: PixiBoardBackendErrorStage;
  readonly fallbackEligible: boolean;
  readonly compatibilityFallbackEligible: boolean;
  readonly detail: unknown;

  constructor(options: {
    code: string;
    stage: PixiBoardBackendErrorStage;
    message: string;
    fallbackEligible?: boolean;
    detail?: unknown;
  }) {
    super(options.message);
    this.name = 'PixiBoardBackendError';
    this.code = options.code;
    this.stage = options.stage;
    this.fallbackEligible = options.fallbackEligible === true;
    this.compatibilityFallbackEligible = this.fallbackEligible;
    this.detail = options.detail;
  }
}

export interface PixiBoardBackendDiagnostics {
  readonly state: 'new' | 'mounting' | 'ready' | 'failed' | 'destroyed';
  readonly mounted: boolean;
  readonly noAnimation: boolean;
  readonly prepareCount: number;
  readonly applyRequestCount: number;
  readonly committedApplyCount: number;
  readonly stalePrepareCount: number;
  readonly restoreCount: number;
  readonly resizeRenderCount: number;
  readonly playPhaseCount: number;
  readonly latestFrameToken: string | null;
  readonly settledFrameToken: string | null;
  readonly canvasCount: number;
  readonly contextCount: number;
  readonly domCellCount: number;
  readonly canvasBackingWidth: number;
  readonly canvasBackingHeight: number;
  readonly maxTextureSize: number;
  readonly tickerRunning: boolean;
  readonly lastErrorCode: string | null;
  /** Debug-only semantic asset ids; never includes board coordinates or owners. */
  readonly neededSpecialAssetIds: readonly string[];
  readonly application: ReturnType<PixiBoardApplication['getDiagnostics']> | null;
  readonly camera: ReturnType<PixiBoardCamera['getDiagnostics']> | null;
  readonly scene: ReturnType<PixiBoardScene['getDiagnostics']> | null;
  readonly textures: ReturnType<PixiTextureManager['getDiagnostics']> | null;
  readonly playback: ReturnType<PixiBoardPlayback['getDiagnostics']> | null;
  readonly timeline: ReturnType<PixiBoardPlayback['getDiagnostics']>['timeline'] | null;
  readonly pool: Readonly<{
    activeViewCount: number;
    pooledViewCount: number;
    activePlaybackGhostCount: number;
    pooledPlaybackGhostCount: number;
    createdPlaybackGhostCount: number;
    destroyedPlaybackGhostCount: number;
    pooledPlaybackStoneGhostCount: number;
    createdPlaybackStoneGhostCount: number;
    destroyedPlaybackStoneGhostCount: number;
    pooledPlaybackMarkerGhostCount: number;
    createdPlaybackMarkerGhostCount: number;
    destroyedPlaybackMarkerGhostCount: number;
    activePlaybackHighlightLeaseCount: number;
    renderedPlaybackHighlightCount: number;
    pooledPlaybackHighlightCount: number;
  }> | null;
  readonly contextRecovery: PixiContextRecoveryDiagnostics | null;
}

export interface PixiBoardVisualBackend extends BoardVisualBackend {
  readonly kind: 'pixi';
  prepareFrame(frame: BoardVisualFrame): Promise<void>;
  applyFrame(frame: BoardVisualFrame, presentedFrame?: BoardVisualFrame): void;
  restore(frame: BoardVisualFrame, presentedFrame?: BoardVisualFrame): Promise<void>;
  waitForVisualSettlement(frame?: BoardVisualFrame): Promise<void>;
  getRenderedCell(row: number, col: number): unknown;
  getBoardClientRect(): BoardClientRect | null;
  getDisplayObjectCounts(): Readonly<Record<string, number>>;
  getTextureLeaseCounts(): Readonly<Record<string, number>>;
  captureDebugFramePngDataUrl(): string;
  captureDebugFrameAfterTickerElapsed(elapsedMs: number): Promise<Readonly<{ dataUrl: string; elapsedMs: number }>>;
  getDiagnostics(): PixiBoardBackendDiagnostics;
}

type AppearanceResolver = (frame: BoardVisualFrame) => ResolvedBoardAppearance;
type SpecialAppearanceResolver = (
  specialType: string,
  owner: 'black' | 'white',
  frame: BoardVisualFrame
) => BoardAppearanceResourceDescriptor | null;

export interface PixiBoardBackendOptions {
  readonly runtime?: any;
  readonly root?: Record<string, any> | null;
  readonly document?: Document;
  readonly devicePixelRatio?: number | (() => number);
  readonly visualViewport?: PixiBoardCameraOptions['visualViewport'];
  readonly createResizeObserver?: PixiBoardCameraOptions['createResizeObserver'];
  readonly measureViewport?: PixiBoardCameraOptions['measureViewport'];
  readonly effectGutterCells?: number;
  readonly noAnimation?: boolean;
  /** Explicit debug/test escape hatch; normal play must reject software WebGL. */
  readonly allowSoftwareRenderer?: boolean;
  readonly webglPreflight?: (runtime: any) => boolean | Promise<boolean>;
  readonly textureRuntime?: PixiTextureManagerRuntime;
  readonly applicationFactory?: (options: PixiBoardApplicationOptions) => PixiBoardApplication;
  readonly cameraFactory?: (options: PixiBoardCameraOptions) => PixiBoardCamera;
  readonly sceneFactory?: (options: PixiBoardSceneOptions) => PixiBoardScene;
  readonly inputFactory?: (options: PixiBoardInputOptions) => PixiBoardInput;
  readonly playbackFactory?: (options: PixiBoardPlaybackOptions) => PixiBoardPlayback;
  readonly getInputController?: () => PixiBoardInputControllerPort | null;
  readonly textureManagerFactory?: (options: PixiTextureManagerOptions) => PixiTextureManager;
  readonly resolveAppearance?: AppearanceResolver;
  readonly resolveDefaultAppearance?: AppearanceResolver;
  readonly acquireAppearanceLease?: (
    appearance: ResolvedBoardAppearance,
    frame: BoardVisualFrame
  ) => BoardAppearanceObjectUrlLease;
  readonly resolveSpecialAppearance?: SpecialAppearanceResolver;
  /** Non-board side effect fired once when an added-cell reveal starts. */
  readonly onTopologyRevealStart?: (
    keys: readonly string[],
    frame: BoardVisualFrame
  ) => void;
  readonly contextRecovery?: Readonly<{
    timeoutMs?: number;
    /** Must synchronously lock controller input/settlement before Pixi aborts. */
    onContextLost: (error: Error, event: Event) => void;
    /** Called after texture resources have been recreated. */
    onContextRestored: (event: Event) => boolean | Promise<boolean>;
    /** Must replace this backend with the exclusive DOM compatibility backend. */
    onFallbackRequired: (error: Error) => boolean | Promise<boolean>;
    onRecoveryFailed?: (error: Error) => void;
  }>;
}

interface FrameWork {
  readonly sequence: number;
  readonly frame: BoardVisualFrame;
  readonly cameraRecovery: boolean;
  presentedFrame: BoardVisualFrame | null;
  preparation: Promise<void>;
  settlement: Promise<void>;
  resolveSettlement: () => void;
  rejectSettlement: (error: unknown) => void;
  prepared: PixiPreparedTextureSet | null;
  applyRequested: boolean;
  committing: boolean;
  cancelled: boolean;
  settled: boolean;
  error: PixiBoardBackendError | null;
  topologyReveal: Promise<void> | null;
}

const DEFAULT_EFFECT_GUTTER_CELLS = 2;
const COMPATIBILITY_FALLBACK_CODES = new Set([
  'pixi_runtime_unavailable',
  'pixi_webgl_unavailable',
  'pixi_application_init_failed',
  'pixi_webgl_init_failed',
  'pixi_renderer_init_failed',
  'pixi_software_webgl_renderer'
]);

function finitePositive(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function addedTopologyKeys(
  current: BoardVisualFrame | null,
  next: BoardVisualFrame
): readonly string[] {
  if (!current) return Object.freeze([]);
  const previousKeys = new Set(current.model.topology.existingKeys);
  return Object.freeze(next.model.topology.existingKeys
    .filter((key) => !previousKeys.has(key))
    .slice()
    .sort((a, b) => {
      const [aRow, aCol] = a.split(',').map(Number);
      const [bRow, bCol] = b.split(',').map(Number);
      return aRow - bRow || aCol - bCol;
    }));
}

function backendError(options: {
  code: string;
  stage: PixiBoardBackendErrorStage;
  message: string;
  fallbackEligible?: boolean;
  detail?: unknown;
}): PixiBoardBackendError {
  return new PixiBoardBackendError(options);
}

function nestedBackendError(error: unknown, depth = 0): PixiBoardBackendError | null {
  if (error instanceof PixiBoardBackendError) return error;
  if (!error || typeof error !== 'object' || depth > 4) return null;
  const candidate = error as { detail?: unknown; cause?: unknown };
  return nestedBackendError(candidate.detail, depth + 1)
    || nestedBackendError(candidate.cause, depth + 1);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown error');
}

function isWebGlFailure(error: unknown): boolean {
  const code = String((error as any)?.code || '').toLowerCase();
  const message = errorMessage(error).toLowerCase();
  return code.includes('webgl')
    || /web\s*gl|gpu context|context creation|canvas context/.test(message);
}

export function isPixiCompatibilityFallbackError(error: unknown): boolean {
  return error instanceof PixiBoardBackendError
    && COMPATIBILITY_FALLBACK_CODES.has(error.code);
}

function textureSource(snapshot: PixiCommittedTextureSet): PixiStaticTextureSource {
  return Object.freeze({
    get(purpose: string) {
      return snapshot.get(purpose)?.texture || null;
    },
    getResource(purpose: string) {
      return snapshot.get(purpose);
    }
  });
}

function textureLaneRevision(
  snapshot: PixiCommittedTextureSet,
  lane: 'surface' | 'stone'
): string {
  const resources = snapshot.resources
    .filter((resource) => lane === 'surface' ? resource.purpose === 'board' : resource.purpose !== 'board')
    .map((resource) => [resource.purpose, resource.key] as const)
    .sort(([leftPurpose, leftKey], [rightPurpose, rightKey]) => (
      leftPurpose.localeCompare(rightPurpose) || leftKey.localeCompare(rightKey)
    ));
  return JSON.stringify(resources);
}

function frameTextureKey(frame: BoardVisualFrame, sequence: number): string {
  return [
    frame.frameToken,
    frame.model.visualRevision,
    frame.appearance.revision,
    frame.theme.revision,
    frame.theme.fontReadyEpoch,
    sequence
  ].join(':');
}

function collectSpecialStones(frame: BoardVisualFrame): ReadonlyArray<{
  type: string;
  owner: 'black' | 'white';
}> {
  const byKey = new Map<string, { type: string; owner: 'black' | 'white' }>();
  const markerTypeByKind: Readonly<Record<string, string>> = Object.freeze({
    bomb: 'TIME_BOMB',
    frozen: 'FREEZE',
    guard: 'GUARD',
    seed: 'SEED'
  });
  for (const cell of frame.model.cells) {
    const stone = cell.stone;
    const type = String(stone && stone.specialType || '').trim().toUpperCase();
    if (stone && type) {
      byKey.set(`${type}:${stone.owner}`, Object.freeze({ type, owner: stone.owner }));
    }
    for (const marker of cell.markers) {
      const markerType = String(
        marker.data && marker.data.type
        || markerTypeByKind[marker.kind]
        || ''
      ).trim().toUpperCase();
      const markerOwner = marker.owner || stone?.owner || null;
      if (!markerType || (markerOwner !== 'black' && markerOwner !== 'white')) continue;
      byKey.set(`${markerType}:${markerOwner}`, Object.freeze({ type: markerType, owner: markerOwner }));
    }
  }
  return Object.freeze(Array.from(byKey.values()));
}

interface PlaybackSpecialStone {
  readonly type: string;
  readonly owner: 'black' | 'white';
}

function normalizePlaybackSpecialType(value: unknown): string | null {
  const raw = value && typeof value === 'object' ? (value as any).type : value;
  const type = String(raw || '').trim().toUpperCase();
  return type || null;
}

function normalizePlaybackOwner(...values: unknown[]): 'black' | 'white' | null {
  for (const value of values) {
    const owner = parsePlayerSeatKey(value);
    if (owner === 'black' || owner === 'white') return owner;
  }
  return null;
}

function collectPlaybackSpecialStones(events: readonly unknown[]): readonly PlaybackSpecialStone[] {
  const byKey = new Map<string, PlaybackSpecialStone>();
  for (const rawEvent of Array.isArray(events) ? events : []) {
    const event = rawEvent && typeof rawEvent === 'object' ? rawEvent as any : null;
    if (!event) continue;
    const eventMeta = event.meta && typeof event.meta === 'object' ? event.meta : null;
    for (const rawTarget of Array.isArray(event.targets) ? event.targets : []) {
      const target = rawTarget && typeof rawTarget === 'object' ? rawTarget as any : null;
      if (!target) continue;
      const after = target.after && typeof target.after === 'object' ? target.after : null;
      const targetMeta = target.meta && typeof target.meta === 'object' ? target.meta : eventMeta;
      const type = normalizePlaybackSpecialType(
        after?.special
        || after?.specialType
        || target.spawnedMarkerType
        || targetMeta?.special
      );
      const owner = normalizePlaybackOwner(
        after?.owner,
        after?.color,
        target.ownerAfter,
        target.owner,
        target.player,
        targetMeta?.owner,
        event.owner,
        event.player
      );
      if (!type || !owner) continue;
      byKey.set(`${type}:${owner}`, Object.freeze({ type, owner }));
    }
  }
  return Object.freeze(Array.from(byKey.values()));
}

function resourcePhysicalLimit(
  purpose: string,
  frame: BoardVisualFrame,
  effectGutterCells: number
): Readonly<{ width: number; height: number }> {
  const dpr = Math.min(2, finitePositive(frame.layout.dpr) || 1);
  const cellPhysical = Math.max(1, Math.ceil(frame.layout.cellSize * dpr));
  if (purpose !== 'board') return Object.freeze({ width: cellPhysical, height: cellPhysical });
  const gutter = frame.layout.cellSize * effectGutterCells * 2;
  // Resource preparation starts from the source frame before the controller's
  // live-layout transaction caps the Pixi viewport. Keep custom board
  // derivatives bounded by the base viewport even when the source frame still
  // describes a much larger sparse logical surface.
  const baseViewportWidth = frame.model.topology.baseCols * frame.layout.cellSize;
  const baseViewportHeight = frame.model.topology.baseRows * frame.layout.cellSize;
  const viewportWidth = Math.min(frame.layout.camera.viewportWidth, baseViewportWidth);
  const viewportHeight = Math.min(frame.layout.camera.viewportHeight, baseViewportHeight);
  return Object.freeze({
    width: Math.max(cellPhysical, Math.ceil((viewportWidth + gutter) * dpr)),
    height: Math.max(cellPhysical, Math.ceil((viewportHeight + gutter) * dpr))
  });
}

function readRendererMaxTextureSize(renderer: any): number | null {
  const gl = renderer && (renderer.gl || renderer.context?.gl || renderer.context?.webGLContext);
  if (!gl || typeof gl.getParameter !== 'function') return null;
  try {
    return finitePositive(gl.getParameter(gl.MAX_TEXTURE_SIZE));
  } catch (_error) {
    return null;
  }
}

function readWebGlRendererClassification(renderer: any): WebGlRendererClassification {
  const gl = renderer && (renderer.gl || renderer.context?.gl || renderer.context?.webGLContext);
  if (!gl || typeof gl.getParameter !== 'function') return classifyWebGlRenderer('', '');
  let rendererValue: unknown = '';
  let vendorValue: unknown = '';
  try {
    const extension = typeof gl.getExtension === 'function'
      ? gl.getExtension('WEBGL_debug_renderer_info')
      : null;
    if (extension) {
      rendererValue = gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
      vendorValue = gl.getParameter(extension.UNMASKED_VENDOR_WEBGL);
    } else {
      rendererValue = gl.getParameter(gl.RENDERER);
      vendorValue = gl.getParameter(gl.VENDOR);
    }
  } catch (_error) {
    // Renderer disclosure may be unavailable for privacy or driver reasons.
    // Unknown is allowed in normal play; only explicit software evidence falls back.
  }
  return classifyWebGlRenderer(rendererValue, vendorValue);
}

function rendererExplicitlyNotWebGl(renderer: any, runtime: any): boolean {
  const rendererType = renderer && renderer.type;
  if (typeof rendererType === 'number') {
    const webGlType = runtime && runtime.RendererType && runtime.RendererType.WEBGL;
    if (typeof webGlType === 'number') return rendererType !== webGlType;
    return rendererType === 2 || rendererType === 4;
  }
  const type = String(renderer && (rendererType || renderer.name || renderer.constructor?.name) || '').toLowerCase();
  return !!type && (type.includes('webgpu') || type.includes('canvas')) && !type.includes('webgl');
}

function defaultRoot(explicit?: Record<string, any> | null): Record<string, any> | null {
  if (explicit) return explicit;
  try {
    if (typeof window !== 'undefined' && window) return window as unknown as Record<string, any>;
  } catch (_error) { /* explicit root is preferred */ }
  return null;
}

function prefersReducedMotion(root: Record<string, any> | null): boolean {
  try {
    return root && typeof root.matchMedia === 'function'
      ? root.matchMedia('(prefers-reduced-motion: reduce)').matches === true
      : false;
  } catch (_error) {
    return false;
  }
}

export function createPixiBoardVisualBackend(
  options: PixiBoardBackendOptions = {}
): PixiBoardVisualBackend {
  const root = defaultRoot(options.root);
  const doc = options.document || root?.document || (typeof document !== 'undefined' ? document : null);
  const effectGutterCells = typeof options.effectGutterCells === 'undefined'
    ? DEFAULT_EFFECT_GUTTER_CELLS
    : Math.max(0, Math.min(2, Math.trunc(Number(options.effectGutterCells))));
  const applicationFactory = options.applicationFactory || createPixiBoardApplication;
  const cameraFactory = options.cameraFactory || createPixiBoardCamera;
  const sceneFactory = options.sceneFactory || createPixiBoardScene;
  const inputFactory = options.inputFactory || createPixiBoardInput;
  const playbackFactory = options.playbackFactory || createPixiBoardPlayback;
  const onTopologyRevealStart = options.onTopologyRevealStart;
  const textureManagerFactory = options.textureManagerFactory || createPixiTextureManager;
  const runtime = options.runtime || PixiRuntimeContract.getPixiRuntime();
  const noAnimation = options.noAnimation === true;
  let state: PixiBoardBackendDiagnostics['state'] = 'new';
  let host: HTMLElement | null = null;
  let diagnosticsPort: BoardVisualBackendDeps['diagnostics'] | undefined;
  let application: PixiBoardApplication | null = null;
  let camera: PixiBoardCamera | null = null;
  let scene: PixiBoardScene | null = null;
  let input: PixiBoardInput | null = null;
  let playback: PixiBoardPlayback | null = null;
  let textureManager: PixiTextureManager | null = null;
  let contextRecovery: PixiContextRecovery | null = null;
  let contextLostError: PixiBoardBackendError | null = null;
  let mountPromise: Promise<void> | null = null;
  let latestWork: FrameWork | null = null;
  let currentFrame: BoardVisualFrame | null = null;
  let workSequence = 0;
  const workByFrame = new WeakMap<object, FrameWork>();
  const liveWorks = new Set<FrameWork>();
  let suppressCameraCallback = false;
  let prepareCount = 0;
  let applyRequestCount = 0;
  let committedApplyCount = 0;
  let stalePrepareCount = 0;
  let restoreCount = 0;
  let resizeRenderCount = 0;
  let playPhaseCount = 0;
  let playbackTextureWriterId: number | null = null;
  let playbackTexturePrepareSequence = 0;
  let playbackTexturePreparation: Promise<void> | null = null;
  let playbackLaunchGeneration = 0;
  let playbackInterruptReason: unknown = new Error('Pixi playback was interrupted before frame restore');
  // Covers the complete mutation lease: playback texture preparation, the
  // raw timeline, and final idle settlement. A canonical frame may be
  // prepared concurrently, but it must never commit while any lease is live.
  const activePlaybackPhases = new Set<Promise<void>>();
  const playbackSpecialStones = new Map<string, PlaybackSpecialStone>();
  let settledFrameToken: string | null = null;
  let lastErrorCode: string | null = null;
  let pendingCameraRenderError: PixiBoardBackendError | null = null;

  function record(event: string, detail?: unknown): void {
    diagnosticsPort?.record(event, detail);
  }

  function rememberError(error: PixiBoardBackendError): PixiBoardBackendError {
    lastErrorCode = error.code;
    record('pixi-backend:error', { code: error.code, stage: error.stage, message: error.message });
    return error;
  }

  function assertMounted(): void {
    if (state === 'destroyed') {
      throw rememberError(backendError({
        code: 'pixi_backend_destroyed',
        stage: 'lifecycle',
        message: 'Pixi board backend is destroyed'
      }));
    }
    if (state !== 'ready' || !application || !camera || !scene || !textureManager || !playback) {
      throw rememberError(backendError({
        code: 'pixi_backend_not_mounted',
        stage: 'lifecycle',
        message: 'Pixi board backend is not mounted'
      }));
    }
  }

  function assertContextHealthy(): void {
    if (contextLostError) throw contextLostError;
  }

  function createTextureManagerForRenderer(): PixiTextureManager {
    if (!application) throw new Error('Pixi renderer is unavailable for texture initialization');
    return textureManagerFactory({
      runtime: options.textureRuntime,
      pixiRuntime: runtime,
      root,
      documentRef: doc,
      baseUri: doc?.baseURI || null,
      maxTextureSize: readRendererMaxTextureSize(application.getRenderer())
    });
  }

  function contextLossError(error: unknown): PixiBoardBackendError {
    return backendError({
      code: 'pixi_context_lost',
      stage: 'lifecycle',
      message: `Pixi WebGL context was lost: ${errorMessage(error)}`,
      detail: error
    });
  }

  function interruptForContextLoss(error: PixiBoardBackendError): void {
    playback?.abort(error);
    for (const work of Array.from(liveWorks)) finishWorkFailure(work, error);
    application?.settleIdle();
  }

  async function reloadContextTextureResources(): Promise<void> {
    try { textureManager?.destroy(); } catch (_error) { /* replace the invalid context resources */ }
    textureManager = null;
    try {
      textureManager = createTextureManagerForRenderer();
    } catch (error) {
      throw rememberError(backendError({
        code: 'pixi_context_texture_reload_failed',
        stage: 'texture-init',
        message: `Pixi context texture reload failed: ${errorMessage(error)}`,
        detail: error
      }));
    }
  }

  function installContextRecovery(canvas: HTMLCanvasElement): void {
    const hooks = options.contextRecovery;
    if (!hooks) return;
    contextRecovery = createPixiContextRecovery({
      target: canvas,
      timeoutMs: hooks.timeoutMs,
      onContextLost(error, event) {
        const normalized = rememberError(contextLossError(error));
        contextLostError = normalized;
        // Controller ownership must move to recovering before abort rejects an
        // active board phase or frame settlement.
        try {
          hooks.onContextLost(normalized, event);
        } finally {
          // A controller hook failure is terminal for this recovery cycle, but
          // it must not leave Pixi playback or settlement work running against
          // the lost WebGL context.
          interruptForContextLoss(normalized);
          record('pixi-backend:context-lost', { frameToken: currentFrame?.frameToken || null });
        }
      },
      async onContextRestored(event) {
        record('pixi-backend:context-restore-start', { frameToken: currentFrame?.frameToken || null });
        try {
          await reloadContextTextureResources();
          application?.invalidateResizeCache();
          scene?.invalidateStaticViews();
          contextLostError = null;
          const recovered = await hooks.onContextRestored(event);
          if (recovered !== true) {
            contextLostError = contextLossError('controller checkpoint restore was rejected');
            return false;
          }
          lastErrorCode = null;
          record('pixi-backend:context-restored', { frameToken: currentFrame?.frameToken || null });
          return true;
        } catch (error) {
          contextLostError = contextLossError(error);
          record('pixi-backend:context-restore-error', { message: errorMessage(error) });
          throw error;
        }
      },
      async onFallbackRequired(error) {
        record('pixi-backend:context-fallback-start', { message: error.message });
        return hooks.onFallbackRequired(error);
      },
      onRecoveryFailed(error) {
        record('pixi-backend:context-recovery-failed', { message: error.message });
        hooks.onRecoveryFailed?.(error);
      }
    });
  }

  function resolveAppearance(frame: BoardVisualFrame): ResolvedBoardAppearance {
    if (options.resolveAppearance) return options.resolveAppearance(frame);
    return resolveBoardAppearanceResources(root, {
      boardSkinId: frame.appearance.boardSkinId,
      boardFrameSkinId: frame.appearance.boardFrameSkinId,
      stoneSkinId: frame.appearance.stoneSkinId,
      baseUri: doc?.baseURI || null
    });
  }

  function resolveDefaultAppearance(frame: BoardVisualFrame): ResolvedBoardAppearance {
    if (options.resolveDefaultAppearance) return options.resolveDefaultAppearance(frame);
    return resolveBoardAppearanceResources(root, {
      boardSkinId: BoardSkinCatalog.DEFAULT_BOARD_SKIN_ID,
      boardFrameSkinId: BoardSkinCatalog.DEFAULT_BOARD_FRAME_SKIN_ID,
      stoneSkinId: StoneSkinCatalog.DEFAULT_STONE_SKIN_ID,
      baseUri: doc?.baseURI || null
    });
  }

  function acquireAppearanceLease(
    appearance: ResolvedBoardAppearance,
    frame: BoardVisualFrame
  ): BoardAppearanceObjectUrlLease {
    if (options.acquireAppearanceLease) return options.acquireAppearanceLease(appearance, frame);
    return acquireBoardAppearanceObjectUrlLease(root, appearance);
  }

  function resolveSpecialAppearance(
    type: string,
    owner: 'black' | 'white',
    frame: BoardVisualFrame
  ): BoardAppearanceResourceDescriptor | null {
    if (options.resolveSpecialAppearance) return options.resolveSpecialAppearance(type, owner, frame);
    return resolveSpecialStoneAppearanceResource(root, type, owner, doc?.baseURI || null);
  }

  function buildTextureRequests(
    frame: BoardVisualFrame,
    appearance: ResolvedBoardAppearance,
    defaults: ResolvedBoardAppearance,
    additionalSpecialStones: readonly PlaybackSpecialStone[] = []
  ): readonly PixiTextureRequest[] {
    const defaultByRole = new Map(defaults.resources.map((resource) => [resource.role, resource]));
    const requests = new Map<string, PixiTextureRequest>();
    for (const resource of appearance.resources) {
      const fallback = defaultByRole.get(resource.role);
      const physical = resourcePhysicalLimit(resource.role, frame, effectGutterCells);
      requests.set(resource.role, Object.freeze({
        purpose: resource.role,
        kind: resource.sourceBlob ? 'custom' : 'built-in',
        url: resource.url,
        sourceBlob: resource.sourceBlob,
        contentFingerprint: resource.contentFingerprint,
        maxPhysicalWidth: physical.width,
        maxPhysicalHeight: physical.height,
        fallback: fallback && fallback.url !== resource.url
          ? Object.freeze({ kind: 'built-in' as const, url: fallback.url, contentFingerprint: fallback.contentFingerprint })
          : Object.freeze({ kind: 'procedural' as const, id: `${resource.role}:procedural` })
      }));
    }
    const specialStones = new Map<string, PlaybackSpecialStone>();
    for (const special of collectSpecialStones(frame)) {
      specialStones.set(`${special.type}:${special.owner}`, special);
    }
    for (const special of additionalSpecialStones) {
      specialStones.set(`${special.type}:${special.owner}`, special);
    }
    for (const special of specialStones.values()) {
      const resource = resolveSpecialAppearance(special.type, special.owner, frame);
      if (!resource) continue;
      const purpose = `special-stone:${special.type}:${special.owner}`;
      const fallbackRole = `${special.owner}-stone` as BoardAppearanceResourceDescriptor['role'];
      const fallback = defaultByRole.get(fallbackRole);
      const requiresProceduralFallback = special.type === 'FREEZE' || special.type === 'SEED';
      const physical = resourcePhysicalLimit(purpose, frame, effectGutterCells);
      requests.set(purpose, Object.freeze({
        purpose,
        kind: resource.sourceBlob ? 'custom' : 'built-in',
        url: resource.url,
        sourceBlob: resource.sourceBlob,
        contentFingerprint: resource.contentFingerprint,
        maxPhysicalWidth: physical.width,
        maxPhysicalHeight: physical.height,
        fallback: fallback && !requiresProceduralFallback
          ? Object.freeze({ kind: 'built-in' as const, url: fallback.url, contentFingerprint: fallback.contentFingerprint })
          : Object.freeze({ kind: 'procedural' as const, id: `${purpose}:procedural` })
      }));
    }
    return Object.freeze(Array.from(requests.values()));
  }

  async function preparePlaybackTextures(
    events: readonly unknown[],
    context: BoardPlaybackContext
  ): Promise<void> {
    const writerId = Number(context?.token?.id);
    if (!Number.isInteger(writerId)) return;
    if (playbackTextureWriterId !== writerId) {
      playbackTextureWriterId = writerId;
      playbackSpecialStones.clear();
    }
    for (const special of collectPlaybackSpecialStones(events)) {
      playbackSpecialStones.set(`${special.type}:${special.owner}`, special);
    }
    if (!playbackSpecialStones.size || !currentFrame) return;
    const textureManagerAtEntry = textureManager!;

    while (true) {
      assertMounted();
      assertContextHealthy();
      if (textureManager !== textureManagerAtEntry) {
        throw backendError({
          code: 'pixi_playback_texture_prepare_superseded',
          stage: 'texture-prepare',
          message: 'Pixi playback texture preparation was superseded by texture recovery'
        });
      }
      if (playbackTextureWriterId !== writerId) {
        throw backendError({
          code: 'pixi_playback_texture_prepare_superseded',
          stage: 'texture-prepare',
          message: `Pixi playback texture preparation was superseded by writer ${playbackTextureWriterId}`
        });
      }
      if (playbackTexturePreparation) {
        await playbackTexturePreparation;
        continue;
      }
      const frame = currentFrame;
      const frameKey = frameTextureKey(frame, 0);
      const appearance = resolveAppearance(frame);
      const defaults = resolveDefaultAppearance(frame);
      const requests = buildTextureRequests(
        frame,
        appearance,
        defaults,
        Object.freeze(Array.from(playbackSpecialStones.values()))
      );
      const specialPurposes = requests
        .map((request) => request.purpose)
        .filter((purpose) => purpose.startsWith('special-stone:'));
      const manager = textureManager;
      const active = manager.getActive();
      if (specialPurposes.every((purpose) => !!active?.get(purpose))) return;

      const sourceLease = acquireAppearanceLease(appearance, frame);
      const preparationId = `${frameTextureKey(frame, ++playbackTexturePrepareSequence)}:playback:${writerId}`;
      let prepared: PixiPreparedTextureSet | null = null;
      let failureStage: 'texture-prepare' | 'texture-commit' = 'texture-prepare';
      const preparation = (async () => {
        try {
          prepared = await manager.prepare(preparationId, requests, { sourceLease });
          assertMounted();
          assertContextHealthy();
          if (
            !currentFrame
            || playbackTextureWriterId !== writerId
            || textureManager !== manager
            || frameTextureKey(currentFrame, 0) !== frameKey
          ) {
            prepared.release();
            prepared = null;
            return;
          }
          assertCameraRenderHealthy();
          const canvasViewport = camera!.getCanvasViewport();
          if (!canvasViewport) throw new Error('Pixi camera canvas viewport is unavailable');
          failureStage = 'texture-commit';
          manager.commit(prepared, (snapshot) => {
            applySceneAndRender(currentFrame!, snapshot, canvasViewport, {
              preservePlaybackProjection: true
            });
          });
          prepared = null;
          record('pixi-backend:playback-textures-prepared', {
            writerId,
            resourceCount: requests.length,
            specialPurposes
          });
        } catch (error) {
          if (prepared && prepared.state === 'prepared') prepared.release();
          if (textureManager !== manager) return;
          const existing = nestedBackendError(error);
          throw rememberError(existing || backendError({
            code: 'pixi_playback_texture_prepare_failed',
            stage: failureStage,
            message: `Pixi playback texture preparation failed: ${errorMessage(error)}`,
            detail: error
          }));
        }
      })();
      playbackTexturePreparation = preparation;
      try {
        await preparation;
      } finally {
        if (playbackTexturePreparation === preparation) playbackTexturePreparation = null;
      }
    }
  }

  async function prepareResources(work: FrameWork): Promise<void> {
    assertMounted();
    assertContextHealthy();
    prepareCount += 1;
    try {
      const appearance = resolveAppearance(work.frame);
      const defaults = resolveDefaultAppearance(work.frame);
      const requests = buildTextureRequests(work.frame, appearance, defaults);
      const sourceLease = acquireAppearanceLease(appearance, work.frame);
      const prepared = await textureManager!.prepare(
        frameTextureKey(work.frame, work.sequence),
        requests,
        { sourceLease }
      );
      if (work.cancelled || latestWork !== work || state === 'destroyed') {
        if (!work.cancelled) stalePrepareCount += 1;
        prepared.release();
        return;
      }
      work.prepared = prepared;
      record('pixi-backend:prepared', {
        frameToken: work.frame.frameToken,
        resourceCount: prepared.resources.length
      });
    } catch (error) {
      if (work.cancelled || latestWork !== work || state === 'destroyed') return;
      const existing = nestedBackendError(error);
      throw rememberError(existing || backendError({
        code: 'pixi_texture_prepare_failed',
        stage: 'texture-prepare',
        message: `Pixi texture preparation failed: ${errorMessage(error)}`,
        detail: error
      }));
    }
  }

  function finishWorkSuccess(work: FrameWork, visualCommit = true): void {
    if (work.settled) return;
    work.topologyReveal = null;
    work.settled = true;
    work.error = null;
    liveWorks.delete(work);
    if (visualCommit) {
      settledFrameToken = work.frame.frameToken;
    }
    work.resolveSettlement();
  }

  function assertCameraRenderHealthy(): void {
    if (pendingCameraRenderError) throw pendingCameraRenderError;
  }

  function finishWorkFailure(work: FrameWork, error: PixiBoardBackendError): void {
    if (work.settled) return;
    if (work.prepared && work.prepared.state === 'prepared') work.prepared.release();
    work.prepared = null;
    work.topologyReveal = null;
    work.settled = true;
    work.error = error;
    liveWorks.delete(work);
    work.rejectSettlement(error);
  }

  function cancelWork(work: FrameWork): void {
    if (work.cancelled || work.settled) return;
    work.cancelled = true;
    if (work.topologyReveal) {
      playback?.abort(new Error(`Pixi topology reveal superseded: ${work.frame.frameToken}`));
    }
    if (work.prepared && work.prepared.state === 'prepared') work.prepared.release();
    work.prepared = null;
    stalePrepareCount += 1;
    finishWorkSuccess(work, false);
  }

  function resizeApplication(canvasViewport: PixiBoardCanvasViewport, layout: BoardViewportLayout): void {
    try {
      application!.resize(canvasViewport.width, canvasViewport.height, layout.dpr);
      input?.syncViewportMetrics({
        width: layout.camera.viewportWidth,
        height: layout.camera.viewportHeight,
        resolution: layout.dpr
      });
    } catch (error) {
      throw rememberError(backendError({
        code: 'pixi_resize_failed',
        stage: 'resize',
        message: `Pixi board resize failed: ${errorMessage(error)}`,
        detail: error
      }));
    }
  }

  function applySceneAndRender(
    frame: BoardVisualFrame,
    snapshot: PixiCommittedTextureSet,
    canvasViewport: PixiBoardCanvasViewport,
    options: {
      readonly preservePlaybackProjection?: boolean;
      readonly topologyRevealKeys?: readonly string[];
      readonly topologyRevealSourceFrame?: BoardVisualFrame;
      readonly onTopologyRevealStarted?: (settlement: Promise<void>) => void;
    } = {}
  ): void {
    try {
      const sceneContext = {
        textures: textureSource(snapshot),
        textureRevision: snapshot.generation,
        surfaceTextureRevision: textureLaneRevision(snapshot, 'surface'),
        stoneTextureRevision: textureLaneRevision(snapshot, 'stone'),
        canvasViewport,
        ...(Array.isArray(options.topologyRevealKeys) && options.topologyRevealKeys.length
          ? { topologyRevealKeys: options.topologyRevealKeys }
          : {}),
        ...(options.preservePlaybackProjection === true
          ? { preservePlaybackProjection: true as const }
          : {})
      };
      scene!.applyFrame(frame, sceneContext);
    } catch (error) {
      throw rememberError(backendError({
        code: 'pixi_scene_apply_failed',
        stage: 'scene-apply',
        message: `Pixi board scene apply failed: ${errorMessage(error)}`,
        detail: error
      }));
    }
    const revealKeys = Array.isArray(options.topologyRevealKeys)
      ? options.topologyRevealKeys
      : [];
    if (revealKeys.length) {
      try {
        const settlement = playback!.revealTopologyCells(revealKeys);
        options.onTopologyRevealStarted?.(settlement);
      } catch (error) {
        throw rememberError(backendError({
          code: 'pixi_topology_reveal_failed',
          stage: 'scene-apply',
          message: `Pixi topology reveal failed to start: ${errorMessage(error)}`,
          detail: error
        }));
      }
    }
    try {
      application!.render();
    } catch (error) {
      if (revealKeys.length) playback?.abort(error);
      throw rememberError(backendError({
        code: 'pixi_render_failed',
        stage: 'render',
        message: `Pixi board render failed: ${errorMessage(error)}`,
        detail: error
      }));
    }
    if (revealKeys.length) {
      try {
        onTopologyRevealStart?.(
          Object.freeze(revealKeys.slice()),
          options.topologyRevealSourceFrame || frame
        );
      }
      catch (_error) { /* sound/global presentation must not corrupt board settlement */ }
    }
    // Reflow must retain the active event projection. A canonical local or
    // network frame apply settles it only after the final pixels rendered.
    if (options.preservePlaybackProjection !== true) playback?.onFrameApplied();
  }

  function finishCommittedVisual(work: FrameWork): void {
    if (work.settled || work.cancelled) return;
    record('pixi-backend:frame-settled', { frameToken: work.frame.frameToken });
    finishWorkSuccess(work);
  }

  function observeTopologyReveal(work: FrameWork): void {
    const settlement = work.topologyReveal;
    // DOM compatibility commits immediately after starting its 260ms CSS
    // reveal.  Match that busy/input timing: the first successful Pixi render
    // settles the frame while the cosmetic reveal continues independently.
    finishCommittedVisual(work);
    if (!settlement) return;
    settlement.catch((error) => {
      if (work.cancelled || state === 'destroyed') return;
      nestedBackendError(error) || rememberError(backendError({
          code: 'pixi_topology_reveal_failed',
          stage: 'render',
          message: `Pixi topology reveal failed: ${errorMessage(error)}`,
          detail: error
      }));
    });
  }

  function commitWork(work: FrameWork): void {
    if (work.settled || work.committing) return;
    if (work.cancelled || latestWork !== work) {
      cancelWork(work);
      return;
    }
    if (!work.prepared || work.prepared.state !== 'prepared') return;
    assertMounted();
    work.committing = true;
    try {
      if (activePlaybackPhases.size > 0) {
        throw rememberError(backendError({
          code: 'pixi_frame_apply_during_playback',
          stage: 'scene-apply',
          message: 'Pixi canonical frame commit cannot overtake active board playback'
        }));
      }
      // A failed camera refresh poisons the current visual transaction. A
      // normal frame commit must not make that failure look successful; only
      // the explicit restore path is allowed to prove recovery and clear it.
      if (!work.cameraRecovery) assertCameraRenderHealthy();
      const presentedFrame = work.presentedFrame || work.frame;
      const revealKeys = work.cameraRecovery
        ? Object.freeze([] as string[])
        : addedTopologyKeys(currentFrame, presentedFrame);
      suppressCameraCallback = true;
      let syncedLayout: BoardViewportLayout;
      try {
        syncedLayout = camera!.sync(
          presentedFrame.model.topology,
          presentedFrame.layout,
          presentedFrame.renderSessionId
        );
      } finally {
        suppressCameraCallback = false;
      }
      const canvasViewport = camera!.getCanvasViewport();
      if (!canvasViewport) throw new Error('Pixi camera canvas viewport is unavailable');
      resizeApplication(canvasViewport, syncedLayout);
      const renderFrame = Object.freeze({ ...presentedFrame, layout: syncedLayout });
      try {
        textureManager!.commit(work.prepared, (snapshot) => {
          applySceneAndRender(renderFrame, snapshot, canvasViewport, {
            topologyRevealKeys: revealKeys,
            topologyRevealSourceFrame: work.frame,
            onTopologyRevealStarted(settlement) {
              work.topologyReveal = settlement;
            }
          });
        });
      } catch (error) {
        const nested = nestedBackendError(error);
        throw nested || rememberError(backendError({
          code: error instanceof PixiTextureManagerError
            ? 'pixi_texture_commit_failed'
            : 'pixi_scene_apply_failed',
          stage: error instanceof PixiTextureManagerError ? 'texture-commit' : 'scene-apply',
          message: `Pixi texture/frame commit failed: ${errorMessage(error)}`,
          detail: error
        }));
      }
      work.prepared = null;
      currentFrame = renderFrame;
      committedApplyCount += 1;
      observeTopologyReveal(work);
    } catch (error) {
      const normalized = nestedBackendError(error) || rememberError(backendError({
        code: 'pixi_scene_apply_failed',
        stage: 'scene-apply',
        message: `Pixi board frame apply failed: ${errorMessage(error)}`,
        detail: error
      }));
      if (work.topologyReveal) playback?.abort(normalized);
      finishWorkFailure(work, normalized);
      throw normalized;
    } finally {
      suppressCameraCallback = false;
      work.committing = false;
    }
  }

  function startWork(
    frame: BoardVisualFrame,
    force = false,
    cameraRecovery = false
  ): FrameWork {
    assertMounted();
    if (!frame || typeof frame !== 'object') {
      throw rememberError(backendError({
        code: 'pixi_frame_invalid',
        stage: 'scene-apply',
        message: 'Pixi board frame is required'
      }));
    }
    const existing = !force ? workByFrame.get(frame as object) : null;
    if (existing) return existing;
    if (latestWork && !latestWork.settled) cancelWork(latestWork);
    let resolveSettlement!: () => void;
    let rejectSettlement!: (error: unknown) => void;
    const settlement = new Promise<void>((resolve, reject) => {
      resolveSettlement = resolve;
      rejectSettlement = reject;
    });
    settlement.catch(() => undefined);
    const work = {
      sequence: ++workSequence,
      frame,
      cameraRecovery,
      presentedFrame: null,
      preparation: Promise.resolve(),
      settlement,
      resolveSettlement,
      rejectSettlement,
      prepared: null,
      applyRequested: false,
      committing: false,
      cancelled: false,
      settled: false,
      error: null,
      topologyReveal: null
    } as FrameWork;
    latestWork = work;
    workByFrame.set(frame as object, work);
    liveWorks.add(work);
    work.preparation = Promise.resolve().then(() => prepareResources(work));
    // Observe preparation independently. Direct applyFrame() is synchronous;
    // its required async failure is surfaced by waitForVisualSettlement().
    work.preparation.then(
      () => {
        if (work.cancelled || work.settled) return;
        if (work.applyRequested) {
          try { commitWork(work); }
          catch (_error) { /* recorded and exposed through settlement */ }
        }
      },
      (error) => {
        const normalized = nestedBackendError(error) || rememberError(backendError({
          code: 'pixi_texture_prepare_failed',
          stage: 'texture-prepare',
          message: `Pixi texture preparation failed: ${errorMessage(error)}`,
          detail: error
        }));
        finishWorkFailure(work, normalized);
      }
    );
    return work;
  }

  function renderCurrentAtLayout(
    layout: BoardViewportLayout,
    canvasViewport: PixiBoardCanvasViewport
  ): void {
    if (!application || !scene || !textureManager || !currentFrame || state !== 'ready') return;
    const snapshot = textureManager.getActive();
    if (!snapshot) return;
    resizeApplication(canvasViewport, layout);
    const renderFrame = Object.freeze({ ...currentFrame, layout });
    applySceneAndRender(renderFrame, snapshot, canvasViewport, {
      preservePlaybackProjection: true
    });
    currentFrame = renderFrame;
    resizeRenderCount += 1;
  }

  function onCameraLayoutChange(
    layout: BoardViewportLayout,
    canvasViewport: PixiBoardCanvasViewport
  ): void {
    if (suppressCameraCallback || state !== 'ready') return;
    try {
      renderCurrentAtLayout(layout, canvasViewport);
    } catch (error) {
      const normalized = nestedBackendError(error) || backendError({
        code: 'pixi_resize_failed',
        stage: 'resize',
        message: `Pixi viewport refresh failed: ${errorMessage(error)}`,
        detail: error
      });
      pendingCameraRenderError = rememberError(normalized);
      // A camera reflow is part of the active board visual transaction. If it
      // cannot render, the phase must reject instead of continuing on a stale
      // canvas and later looking successful after an unrelated frame commit.
      playback?.abort(normalized);
    }
  }

  function cleanupOwnedResources(): void {
    try { contextRecovery?.destroy(); } catch (_error) { /* continue releasing visual resources */ }
    for (const work of Array.from(liveWorks)) {
      if (work.prepared && work.prepared.state === 'prepared') work.prepared.release();
      work.prepared = null;
      if (!work.settled) {
        finishWorkFailure(work, backendError({
          code: 'pixi_backend_destroyed',
          stage: 'lifecycle',
          message: 'Pixi board backend was destroyed before visual settlement'
        }));
      }
    }
    try { playback?.destroy(); } catch (_error) { /* continue releasing visual resources */ }
    try { input?.destroy(); } catch (_error) { /* continue releasing visual resources */ }
    try { scene?.destroy(); } catch (_error) { /* continue releasing GPU resources */ }
    try { textureManager?.destroy(); } catch (_error) { /* continue releasing the context */ }
    try { camera?.destroy(); } catch (_error) { /* continue releasing the canvas */ }
    try { application?.destroy(); } catch (_error) { /* terminal cleanup */ }
    scene = null;
    input = null;
    playback = null;
    textureManager = null;
    contextRecovery = null;
    contextLostError = null;
    camera = null;
    application = null;
    currentFrame = null;
    latestWork = null;
    playbackSpecialStones.clear();
    pendingCameraRenderError = null;
  }

  async function runWebGlPreflight(): Promise<void> {
    if (options.webglPreflight) {
      const available = await options.webglPreflight(runtime);
      if (!available) throw new Error('WebGL preflight reported unavailable');
      return;
    }
    if (runtime && typeof runtime.isWebGLSupported === 'function') {
      const available = await runtime.isWebGLSupported();
      if (!available) throw new Error('WebGL runtime support check failed');
    }
  }

  function assertMountActive(): void {
    if (state === 'destroyed') {
      throw backendError({
        code: 'pixi_backend_destroyed',
        stage: 'lifecycle',
        message: 'Pixi board backend was destroyed during mount'
      });
    }
  }

  function isBackendDestroyed(): boolean {
    return state === 'destroyed';
  }

  async function mount(nextHost: HTMLElement, deps: BoardVisualBackendDeps): Promise<void> {
    if (state === 'destroyed') assertMounted();
    if (mountPromise) {
      if (host !== nextHost) {
        throw rememberError(backendError({
          code: 'pixi_backend_second_host',
          stage: 'lifecycle',
          message: 'Pixi board backend cannot mount a second host'
        }));
      }
      return mountPromise;
    }
    host = nextHost;
    diagnosticsPort = deps && deps.diagnostics;
    state = 'mounting';
    mountPromise = (async () => {
      if (!runtime || typeof runtime.Application !== 'function') {
        throw backendError({
          code: 'pixi_runtime_unavailable',
          stage: 'runtime',
          message: 'Pixi v8 runtime is unavailable',
          fallbackEligible: true
        });
      }
      const version = String(runtime.VERSION || '').trim();
      if (version && version !== PixiRuntimeContract.PIXI_RUNTIME_VERSION) {
        throw backendError({
          code: 'pixi_runtime_unavailable',
          stage: 'runtime',
          message: `Pixi runtime version ${version} is unsupported`,
          fallbackEligible: true
        });
      }
      try {
        await runWebGlPreflight();
      } catch (error) {
        throw backendError({
          code: 'pixi_webgl_unavailable',
          stage: 'webgl',
          message: `Pixi WebGL is unavailable: ${errorMessage(error)}`,
          fallbackEligible: true,
          detail: error
        });
      }
      assertMountActive();
      try {
        application = applicationFactory({
          runtime,
          devicePixelRatio: typeof options.devicePixelRatio === 'function'
            ? options.devicePixelRatio()
            : options.devicePixelRatio
        });
      } catch (error) {
        throw backendError({
          code: 'pixi_application_init_failed',
          stage: 'application',
          message: `Pixi Application construction failed: ${errorMessage(error)}`,
          fallbackEligible: true,
          detail: error
        });
      }
      let canvasLayer: HTMLElement;
      try {
        camera = cameraFactory({
          document: doc || undefined,
          effectGutterCells,
          devicePixelRatio: options.devicePixelRatio || (() => root?.devicePixelRatio || 1),
          visualViewport: options.visualViewport,
          createResizeObserver: options.createResizeObserver,
          measureViewport: options.measureViewport,
          onLayoutChange: onCameraLayoutChange
        });
        canvasLayer = camera.mount(nextHost);
      } catch (error) {
        throw backendError({
          code: 'pixi_camera_init_failed',
          stage: 'camera-init',
          message: `Pixi board camera initialization failed: ${errorMessage(error)}`,
          detail: error
        });
      }
      let canvas: HTMLCanvasElement;
      try {
        canvas = await application.mount(canvasLayer);
      } catch (error) {
        if (isBackendDestroyed()) throw backendError({
          code: 'pixi_backend_destroyed',
          stage: 'lifecycle',
          message: 'Pixi board backend was destroyed during Application initialization',
          detail: error
        });
        if (isWebGlFailure(error)) {
          throw backendError({
            code: 'pixi_webgl_init_failed',
            stage: 'webgl',
            message: `Pixi WebGL initialization failed: ${errorMessage(error)}`,
            fallbackEligible: true,
            detail: error
          });
        }
        throw backendError({
          code: 'pixi_application_init_failed',
          stage: 'application',
          message: `Pixi Application initialization failed: ${errorMessage(error)}`,
          fallbackEligible: true,
          detail: error
        });
      }
      assertMountActive();
      try {
        canvas.setAttribute?.('aria-hidden', 'true');
        const renderer = application.getRenderer();
        if (!renderer || rendererExplicitlyNotWebGl(renderer, runtime)) {
          throw backendError({
            code: 'pixi_renderer_init_failed',
            stage: 'webgl',
            message: 'Pixi WebGL renderer was not created',
            fallbackEligible: true
          });
        }
        const rendererClassification = readWebGlRendererClassification(renderer);
        record('pixi-backend:webgl-renderer', {
          renderer: rendererClassification.renderer,
          vendor: rendererClassification.vendor,
          explicitSoftware: rendererClassification.explicitSoftware
        });
        if (rendererClassification.explicitSoftware && options.allowSoftwareRenderer !== true) {
          throw backendError({
            code: 'pixi_software_webgl_renderer',
            stage: 'webgl',
            message: 'Pixi software WebGL renderer is not supported in normal play',
            fallbackEligible: true,
            detail: rendererClassification
          });
        }
      } catch (error) {
        const existing = nestedBackendError(error);
        if (existing) throw existing;
        throw backendError({
          code: 'pixi_renderer_init_failed',
          stage: 'webgl',
          message: `Pixi renderer initialization failed: ${errorMessage(error)}`,
          fallbackEligible: true,
          detail: error
        });
      }
      assertMountActive();
      try {
        scene = sceneFactory({
          runtime,
          stage: application!.getStage(),
          renderer: application!.getRenderer(),
          effectGutterCells
        });
      } catch (error) {
        throw backendError({
          code: 'pixi_scene_init_failed',
          stage: 'scene-init',
          message: `Pixi board scene initialization failed: ${errorMessage(error)}`,
          detail: error
        });
      }
      assertMountActive();
      try {
        textureManager = createTextureManagerForRenderer();
      } catch (error) {
        throw backendError({
          code: 'pixi_texture_init_failed',
          stage: 'texture-init',
          message: `Pixi texture manager initialization failed: ${errorMessage(error)}`,
          detail: error
        });
      }
      assertMountActive();
      if (typeof options.getInputController === 'function') {
        try {
          const viewport = camera!.getViewportElement();
          if (!viewport) throw new Error('Pixi board input viewport is unavailable');
          input = inputFactory({ getController: options.getInputController });
          input.mount({
            viewport,
            renderer: application!.getRenderer(),
            interactionLayer: scene!.layers.interaction
          });
        } catch (error) {
          throw backendError({
            code: 'pixi_input_init_failed',
            stage: 'input-init',
            message: `Pixi board input initialization failed: ${errorMessage(error)}`,
            detail: error
          });
        }
      }
      assertMountActive();
      try {
        playback = playbackFactory({
          application: application!,
          scene: scene!,
          getFrame: () => currentFrame,
          noAnimation,
          reducedMotion: () => prefersReducedMotion(root),
          acquireStoneTextureLease(owner) {
            if (!textureManager) throw new Error('Pixi texture manager is unavailable');
            const lease = textureManager.acquireActive(`${owner}-stone`);
            return Object.freeze({
              texture: lease.resource.texture,
              get released() { return lease.released; },
              release: () => lease.release()
            });
          },
          record
        });
      } catch (error) {
        throw backendError({
          code: 'pixi_playback_init_failed',
          stage: 'playback-init',
          message: `Pixi board playback initialization failed: ${errorMessage(error)}`,
          detail: error
        });
      }
      assertMountActive();
      try {
        installContextRecovery(canvas);
      } catch (error) {
        throw backendError({
          code: 'pixi_context_recovery_init_failed',
          stage: 'lifecycle',
          message: `Pixi context recovery initialization failed: ${errorMessage(error)}`,
          detail: error
        });
      }
      assertMountActive();
      state = 'ready';
      record('pixi-backend:mounted', { kind: 'pixi' });
    })().catch((error) => {
      const normalized = nestedBackendError(error) || backendError({
        code: 'pixi_backend_mount_failed',
        stage: 'mount',
        message: `Pixi backend mount failed: ${errorMessage(error)}`,
        detail: error
      });
      rememberError(normalized);
      if (state !== 'destroyed') state = 'failed';
      cleanupOwnedResources();
      throw normalized;
    });
    return mountPromise;
  }

  function prepareFrame(frame: BoardVisualFrame): Promise<void> {
    assertMounted();
    assertContextHealthy();
    assertCameraRenderHealthy();
    const work = startWork(frame);
    return work.preparation;
  }

  function resolvePresentedFrame(
    frame: BoardVisualFrame,
    presentedFrame?: BoardVisualFrame
  ): BoardVisualFrame | null {
    if (!presentedFrame || presentedFrame === frame) return null;
    const preservesPreparedFrame = presentedFrame.frameToken === frame.frameToken
      && presentedFrame.renderSessionId === frame.renderSessionId
      && presentedFrame.model === frame.model
      && presentedFrame.appearance === frame.appearance
      && presentedFrame.theme === frame.theme;
    if (!preservesPreparedFrame) {
      throw rememberError(backendError({
        code: 'pixi_frame_invalid',
        stage: 'scene-apply',
        message: 'Pixi presented frame may only replace the prepared frame layout'
      }));
    }
    return presentedFrame;
  }

  function applyFrame(frame: BoardVisualFrame, presentedFrame?: BoardVisualFrame): void {
    assertMounted();
    assertContextHealthy();
    assertCameraRenderHealthy();
    if (activePlaybackPhases.size > 0) {
      throw rememberError(backendError({
        code: 'pixi_frame_apply_during_playback',
        stage: 'scene-apply',
        message: 'Pixi canonical frame apply cannot overtake active board playback'
      }));
    }
    const presentationOverride = resolvePresentedFrame(frame, presentedFrame);
    const work = startWork(frame);
    applyRequestCount += 1;
    if (work.settled && work.error) throw work.error;
    work.presentedFrame = presentationOverride;
    work.applyRequested = true;
    if (work.prepared) commitWork(work);
  }

  async function waitForVisualSettlement(frame?: BoardVisualFrame): Promise<void> {
    assertMounted();
    assertContextHealthy();
    const work = frame && typeof frame === 'object'
      ? workByFrame.get(frame as object)
      : latestWork;
    if (pendingCameraRenderError) throw pendingCameraRenderError;
    if (work) await work.settlement;
    // A committed topology frame intentionally releases gameplay busy state
    // before its 260ms cosmetic reveal finishes. Do not stop the private
    // ticker while that timeline still owns a run; the timeline stops it when
    // its final frame releases the reveal lease.
    const activeRunCount = Number(playback?.getDiagnostics()?.timeline?.activeRunCount || 0);
    if (activeRunCount === 0) application?.settleIdle();
  }

  function validatePhase(
    events: readonly unknown[],
    context: BoardPlaybackValidationContext
  ): void {
    assertMounted();
    assertContextHealthy();
    assertCameraRenderHealthy();
    playback!.validatePhase(events, context);
  }

  async function playPhase(
    events: readonly unknown[],
    context: BoardPlaybackContext
  ): Promise<void> {
    assertMounted();
    assertContextHealthy();
    playPhaseCount += 1;
    const launchGeneration = playbackLaunchGeneration;
    let resolvePhaseLease!: () => void;
    const phaseLease = new Promise<void>((resolve) => {
      resolvePhaseLease = resolve;
    });
    activePlaybackPhases.add(phaseLease);
    try {
      assertCameraRenderHealthy();
      await preparePlaybackTextures(events, context);
      if (launchGeneration !== playbackLaunchGeneration) {
        throw playbackInterruptReason;
      }
      const rawPlayback = playback!.playPhase(events, context);
      await rawPlayback;
      // Multiple board event branches in one presentation phase share this
      // backend timeline. A shorter sibling must not stop the private ticker
      // while another run still needs clock ticks to settle.
      const activeRunCount = Number(playback?.getDiagnostics()?.timeline?.activeRunCount || 0);
      if (activeRunCount === 0) application?.settleIdle();
    } catch (error) {
      if (isPixiPlaybackControlledInterruption(error)) {
        record('pixi-backend:playback-interrupted', {
          code: String((error as any)?.code || ''),
          stage: String((error as any)?.stage || 'play-phase')
        });
        throw error;
      }
      lastErrorCode = String((error as any)?.code || 'pixi_playback_failed');
      record('pixi-backend:error', {
        code: lastErrorCode,
        stage: 'play-phase',
        message: errorMessage(error)
      });
      throw error;
    } finally {
      activePlaybackPhases.delete(phaseLease);
      resolvePhaseLease();
    }
  }

  async function interruptPlaybackBeforeRestore(frame: BoardVisualFrame): Promise<void> {
    playbackLaunchGeneration += 1;
    playbackInterruptReason = backendError({
      code: PIXI_PLAYBACK_RESTORE_INTERRUPTION_CODE,
      stage: 'play-phase',
      message: `Pixi playback was interrupted before restoring ${frame.frameToken}`
    });
    playbackTextureWriterId = null;
    playbackSpecialStones.clear();
    const activeAtInterrupt = Array.from(activePlaybackPhases);
    if (playback && typeof playback.abortAndWait === 'function') {
      await playback.abortAndWait(playbackInterruptReason);
    } else {
      playback?.abort(playbackInterruptReason);
    }
    if (activeAtInterrupt.length > 0) {
      await Promise.allSettled(activeAtInterrupt);
    }
    application?.settleIdle();
  }

  function resize(layout: BoardViewportLayout): void {
    assertMounted();
    assertContextHealthy();
    if (!currentFrame) return;
    suppressCameraCallback = true;
    let synced: BoardViewportLayout;
    try {
      synced = camera!.sync(
        currentFrame.model.topology,
        layout,
        currentFrame.renderSessionId
      );
    } finally {
      suppressCameraCallback = false;
    }
    const viewport = camera!.getCanvasViewport();
    if (!viewport) return;
    renderCurrentAtLayout(synced, viewport);
  }

  async function restore(frame: BoardVisualFrame, presentedFrame?: BoardVisualFrame): Promise<void> {
    assertMounted();
    assertContextHealthy();
    await interruptPlaybackBeforeRestore(frame);
    assertMounted();
    assertContextHealthy();
    const presentationOverride = resolvePresentedFrame(frame, presentedFrame);
    restoreCount += 1;
    const cameraErrorAtStart = pendingCameraRenderError;
    const work = startWork(frame, true, true);
    work.presentedFrame = presentationOverride;
    work.applyRequested = true;
    await work.preparation;
    if (!work.settled && work.prepared) commitWork(work);
    await work.settlement;
    if (cameraErrorAtStart && pendingCameraRenderError === cameraErrorAtStart) {
      pendingCameraRenderError = null;
      if (lastErrorCode === cameraErrorAtStart.code) lastErrorCode = null;
      record('pixi-backend:camera-restored', { frameToken: frame.frameToken });
    }
  }

  function getDisplayObjectCounts(): Readonly<Record<string, number>> {
    const value = scene?.getDiagnostics();
    return Object.freeze({
      total: value?.displayObjectCount || 0,
      active: value?.activeViewCount || 0,
      pooled: value?.pooledViewCount || 0,
      canvas: application?.getDiagnostics().canvasCount || 0
    });
  }

  function getTextureLeaseCounts(): Readonly<Record<string, number>> {
    const value = textureManager?.getDiagnostics();
    return Object.freeze({
      total: value?.referenceCount || 0,
      cached: value?.readyResourceCount || 0,
      external: value?.externalLeaseCount || 0,
      source: value?.sourceLeaseCount || 0
    });
  }

  function captureDebugFramePngDataUrl(): string {
    assertMounted();
    return application!.captureFramePngDataUrl(scene!.root);
  }

  function captureDebugFrameAfterTickerElapsed(
    elapsedMs: number
  ): Promise<Readonly<{ dataUrl: string; elapsedMs: number }>> {
    assertMounted();
    if (!playback) return Promise.reject(new Error('Pixi board playback is unavailable'));
    return playback.captureDebugFrameAtElapsed(elapsedMs);
  }

  function getDiagnostics(): PixiBoardBackendDiagnostics {
    const appDiagnostics = application?.getDiagnostics() || null;
    const cameraDiagnostics = camera?.getDiagnostics() || null;
    const sceneDiagnostics = scene?.getDiagnostics() || null;
    const textureDiagnostics = textureManager?.getDiagnostics() || null;
    const playbackDiagnostics = playback?.getDiagnostics() || null;
    const canvas = application?.getCanvas();
    const neededSpecialAssetIds = Object.freeze(Array.from(new Set([
      ...(currentFrame ? collectSpecialStones(currentFrame).map((special) => special.type) : []),
      ...Array.from(playbackSpecialStones.values()).map((special) => special.type)
    ])).sort());
    return Object.freeze({
      state,
      mounted: state === 'ready',
      noAnimation,
      prepareCount,
      applyRequestCount,
      committedApplyCount,
      stalePrepareCount,
      restoreCount,
      resizeRenderCount,
      playPhaseCount,
      latestFrameToken: latestWork?.frame.frameToken || null,
      settledFrameToken,
      canvasCount: appDiagnostics?.canvasCount || 0,
      contextCount: appDiagnostics?.contextCount || 0,
      domCellCount: host && typeof host.querySelectorAll === 'function'
        ? host.querySelectorAll('.cell').length
        : 0,
      canvasBackingWidth: Number(canvas && canvas.width || 0),
      canvasBackingHeight: Number(canvas && canvas.height || 0),
      maxTextureSize: textureDiagnostics?.maxTextureSize || 0,
      tickerRunning: appDiagnostics?.tickerRunning === true,
      lastErrorCode,
      neededSpecialAssetIds,
      application: appDiagnostics,
      camera: cameraDiagnostics,
      scene: sceneDiagnostics,
      textures: textureDiagnostics,
      playback: playbackDiagnostics,
      timeline: playbackDiagnostics?.timeline || null,
      pool: sceneDiagnostics ? Object.freeze({
        activeViewCount: sceneDiagnostics.activeViewCount,
        pooledViewCount: sceneDiagnostics.pooledViewCount,
        activePlaybackGhostCount: sceneDiagnostics.activePlaybackGhostCount || 0,
        pooledPlaybackGhostCount: sceneDiagnostics.pooledPlaybackGhostCount || 0,
        createdPlaybackGhostCount: sceneDiagnostics.createdPlaybackGhostCount || 0,
        destroyedPlaybackGhostCount: sceneDiagnostics.destroyedPlaybackGhostCount || 0,
        pooledPlaybackStoneGhostCount: sceneDiagnostics.pooledPlaybackStoneGhostCount || 0,
        createdPlaybackStoneGhostCount: sceneDiagnostics.createdPlaybackStoneGhostCount || 0,
        destroyedPlaybackStoneGhostCount: sceneDiagnostics.destroyedPlaybackStoneGhostCount || 0,
        pooledPlaybackMarkerGhostCount: sceneDiagnostics.pooledPlaybackMarkerGhostCount || 0,
        createdPlaybackMarkerGhostCount: sceneDiagnostics.createdPlaybackMarkerGhostCount || 0,
        destroyedPlaybackMarkerGhostCount: sceneDiagnostics.destroyedPlaybackMarkerGhostCount || 0,
        activePlaybackHighlightLeaseCount: sceneDiagnostics.activePlaybackHighlightLeaseCount || 0,
        renderedPlaybackHighlightCount: sceneDiagnostics.renderedPlaybackHighlightCount || 0,
        pooledPlaybackHighlightCount: sceneDiagnostics.pooledPlaybackHighlightCount || 0
      }) : null,
      contextRecovery: contextRecovery?.getDiagnostics() || null
    });
  }

  function destroy(): void {
    if (state === 'destroyed') return;
    state = 'destroyed';
    cleanupOwnedResources();
    record('pixi-backend:destroyed');
  }

  return Object.freeze({
    kind: 'pixi' as const,
    mount,
    prepareFrame,
    applyFrame,
    validatePhase,
    playPhase,
    waitForVisualSettlement,
    getRenderedCell: (row: number, col: number) => scene?.getRenderedCell(row, col) || null,
    getCellClientRect: (row: number, col: number) => camera?.getCellClientRect(row, col) || null,
    getBoardClientRect: () => camera?.getBoardClientRect() || null,
    resize,
    restore,
    getDisplayObjectCounts,
    getTextureLeaseCounts,
    captureDebugFramePngDataUrl,
    captureDebugFrameAfterTickerElapsed,
    getDiagnostics,
    destroy
  });
}
