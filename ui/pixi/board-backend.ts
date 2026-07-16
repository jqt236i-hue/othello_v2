import type {
  BoardClientRect,
  BoardPlaybackContext,
  BoardVisualBackend,
  BoardVisualBackendDeps,
  BoardVisualFrame,
  BoardViewportLayout
} from '../board-visual/types';
import BoardSkinCatalog = require('../board-skin/catalog');
import StoneSkinCatalog = require('../stone-skin/catalog');
import PixiRuntimeContract = require('./runtime-contract');
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
import type { PixiStaticTextureSource } from './cell-view';

export type PixiBoardBackendErrorStage =
  | 'runtime'
  | 'webgl'
  | 'application'
  | 'camera-init'
  | 'mount'
  | 'scene-init'
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
  readonly application: ReturnType<PixiBoardApplication['getDiagnostics']> | null;
  readonly camera: ReturnType<PixiBoardCamera['getDiagnostics']> | null;
  readonly scene: ReturnType<PixiBoardScene['getDiagnostics']> | null;
  readonly textures: ReturnType<PixiTextureManager['getDiagnostics']> | null;
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
  readonly webglPreflight?: (runtime: any) => boolean | Promise<boolean>;
  readonly textureRuntime?: PixiTextureManagerRuntime;
  readonly applicationFactory?: (options: PixiBoardApplicationOptions) => PixiBoardApplication;
  readonly cameraFactory?: (options: PixiBoardCameraOptions) => PixiBoardCamera;
  readonly sceneFactory?: (options: PixiBoardSceneOptions) => PixiBoardScene;
  readonly textureManagerFactory?: (options: PixiTextureManagerOptions) => PixiTextureManager;
  readonly resolveAppearance?: AppearanceResolver;
  readonly resolveDefaultAppearance?: AppearanceResolver;
  readonly acquireAppearanceLease?: (
    appearance: ResolvedBoardAppearance,
    frame: BoardVisualFrame
  ) => BoardAppearanceObjectUrlLease;
  readonly resolveSpecialAppearance?: SpecialAppearanceResolver;
}

interface FrameWork {
  readonly sequence: number;
  readonly frame: BoardVisualFrame;
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
}

const DEFAULT_EFFECT_GUTTER_CELLS = 2;
const COMPATIBILITY_FALLBACK_CODES = new Set([
  'pixi_runtime_unavailable',
  'pixi_webgl_unavailable',
  'pixi_application_init_failed',
  'pixi_webgl_init_failed',
  'pixi_renderer_init_failed'
]);

function finitePositive(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
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
    }
  });
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
    guard: 'GUARD'
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
  const textureManagerFactory = options.textureManagerFactory || createPixiTextureManager;
  const runtime = options.runtime || PixiRuntimeContract.getPixiRuntime();
  const noAnimation = options.noAnimation === true;
  let state: PixiBoardBackendDiagnostics['state'] = 'new';
  let host: HTMLElement | null = null;
  let diagnosticsPort: BoardVisualBackendDeps['diagnostics'] | undefined;
  let application: PixiBoardApplication | null = null;
  let camera: PixiBoardCamera | null = null;
  let scene: PixiBoardScene | null = null;
  let textureManager: PixiTextureManager | null = null;
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
    if (state !== 'ready' || !application || !camera || !scene || !textureManager) {
      throw rememberError(backendError({
        code: 'pixi_backend_not_mounted',
        stage: 'lifecycle',
        message: 'Pixi board backend is not mounted'
      }));
    }
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
    defaults: ResolvedBoardAppearance
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
    for (const special of collectSpecialStones(frame)) {
      const resource = resolveSpecialAppearance(special.type, special.owner, frame);
      if (!resource) continue;
      const purpose = `special-stone:${special.type}:${special.owner}`;
      const fallbackRole = `${special.owner}-stone` as BoardAppearanceResourceDescriptor['role'];
      const fallback = defaultByRole.get(fallbackRole);
      const isFullCellStatusOverlay = special.type === 'FREEZE';
      const physical = resourcePhysicalLimit(purpose, frame, effectGutterCells);
      requests.set(purpose, Object.freeze({
        purpose,
        kind: resource.sourceBlob ? 'custom' : 'built-in',
        url: resource.url,
        sourceBlob: resource.sourceBlob,
        contentFingerprint: resource.contentFingerprint,
        maxPhysicalWidth: physical.width,
        maxPhysicalHeight: physical.height,
        fallback: fallback && !isFullCellStatusOverlay
          ? Object.freeze({ kind: 'built-in' as const, url: fallback.url, contentFingerprint: fallback.contentFingerprint })
          : Object.freeze({ kind: 'procedural' as const, id: `${purpose}:procedural` })
      }));
    }
    return Object.freeze(Array.from(requests.values()));
  }

  async function prepareResources(work: FrameWork): Promise<void> {
    assertMounted();
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
    work.settled = true;
    work.error = null;
    liveWorks.delete(work);
    if (visualCommit) {
      settledFrameToken = work.frame.frameToken;
      if (pendingCameraRenderError) {
        if (lastErrorCode === pendingCameraRenderError.code) lastErrorCode = null;
        pendingCameraRenderError = null;
      }
    }
    work.resolveSettlement();
  }

  function finishWorkFailure(work: FrameWork, error: PixiBoardBackendError): void {
    if (work.settled) return;
    if (work.prepared && work.prepared.state === 'prepared') work.prepared.release();
    work.prepared = null;
    work.settled = true;
    work.error = error;
    liveWorks.delete(work);
    work.rejectSettlement(error);
  }

  function cancelWork(work: FrameWork): void {
    if (work.cancelled || work.settled) return;
    work.cancelled = true;
    if (work.prepared && work.prepared.state === 'prepared') work.prepared.release();
    work.prepared = null;
    stalePrepareCount += 1;
    finishWorkSuccess(work, false);
  }

  function resizeApplication(canvasViewport: PixiBoardCanvasViewport, layout: BoardViewportLayout): void {
    try {
      application!.resize(canvasViewport.width, canvasViewport.height, layout.dpr);
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
    canvasViewport: PixiBoardCanvasViewport
  ): void {
    try {
      scene!.applyFrame(frame, {
        textures: textureSource(snapshot),
        textureRevision: snapshot.generation,
        canvasViewport
      });
    } catch (error) {
      throw rememberError(backendError({
        code: 'pixi_scene_apply_failed',
        stage: 'scene-apply',
        message: `Pixi board scene apply failed: ${errorMessage(error)}`,
        detail: error
      }));
    }
    let renderFailure: { readonly error: unknown } | null = null;
    try {
      application!.render();
    } catch (error) {
      renderFailure = { error };
    } finally {
      try {
        application!.stopTicker();
      } catch (error) {
        if (!renderFailure) renderFailure = { error };
      }
    }
    if (renderFailure) {
      throw rememberError(backendError({
        code: 'pixi_render_failed',
        stage: 'render',
        message: `Pixi board render failed: ${errorMessage(renderFailure.error)}`,
        detail: renderFailure.error
      }));
    }
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
      const presentedFrame = work.presentedFrame || work.frame;
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
          applySceneAndRender(renderFrame, snapshot, canvasViewport);
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
      record('pixi-backend:frame-settled', { frameToken: work.frame.frameToken });
      finishWorkSuccess(work);
    } catch (error) {
      const normalized = nestedBackendError(error) || rememberError(backendError({
        code: 'pixi_scene_apply_failed',
        stage: 'scene-apply',
        message: `Pixi board frame apply failed: ${errorMessage(error)}`,
        detail: error
      }));
      finishWorkFailure(work, normalized);
      throw normalized;
    } finally {
      suppressCameraCallback = false;
      work.committing = false;
    }
  }

  function startWork(frame: BoardVisualFrame, force = false): FrameWork {
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
      error: null
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
    applySceneAndRender(renderFrame, snapshot, canvasViewport);
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
    }
  }

  function cleanupOwnedResources(): void {
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
    try { scene?.destroy(); } catch (_error) { /* continue releasing GPU resources */ }
    try { textureManager?.destroy(); } catch (_error) { /* continue releasing the context */ }
    try { camera?.destroy(); } catch (_error) { /* continue releasing the canvas */ }
    try { application?.destroy(); } catch (_error) { /* terminal cleanup */ }
    scene = null;
    textureManager = null;
    camera = null;
    application = null;
    currentFrame = null;
    latestWork = null;
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
        scene = sceneFactory({ runtime, stage: application!.getStage(), effectGutterCells });
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
        textureManager = textureManagerFactory({
          runtime: options.textureRuntime,
          pixiRuntime: runtime,
          root,
          documentRef: doc,
          baseUri: doc?.baseURI || null,
          maxTextureSize: readRendererMaxTextureSize(application!.getRenderer())
        });
      } catch (error) {
        throw backendError({
          code: 'pixi_texture_init_failed',
          stage: 'texture-init',
          message: `Pixi texture manager initialization failed: ${errorMessage(error)}`,
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
    const presentationOverride = resolvePresentedFrame(frame, presentedFrame);
    const work = startWork(frame);
    applyRequestCount += 1;
    if (work.settled && work.error) throw work.error;
    work.presentedFrame = presentationOverride;
    work.applyRequested = true;
    if (work.prepared) commitWork(work);
  }

  function waitForVisualSettlement(frame?: BoardVisualFrame): Promise<void> {
    const work = frame && typeof frame === 'object'
      ? workByFrame.get(frame as object)
      : latestWork;
    if (pendingCameraRenderError && (!work || work.settled)) {
      return Promise.reject(pendingCameraRenderError);
    }
    if (!work) return Promise.resolve();
    return work.settlement;
  }

  async function playPhase(
    _events: readonly unknown[],
    _context: BoardPlaybackContext
  ): Promise<void> {
    assertMounted();
    playPhaseCount += 1;
    if (!noAnimation) {
      throw rememberError(backendError({
        code: 'pixi_static_animation_unsupported',
        stage: 'play-phase',
        message: 'Phase 4 Pixi backend only supports no-animation playback'
      }));
    }
  }

  function resize(layout: BoardViewportLayout): void {
    assertMounted();
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
    const presentationOverride = resolvePresentedFrame(frame, presentedFrame);
    restoreCount += 1;
    const work = startWork(frame, true);
    work.presentedFrame = presentationOverride;
    work.applyRequested = true;
    await work.preparation;
    if (!work.settled && work.prepared) commitWork(work);
    await work.settlement;
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

  function getDiagnostics(): PixiBoardBackendDiagnostics {
    const appDiagnostics = application?.getDiagnostics() || null;
    const cameraDiagnostics = camera?.getDiagnostics() || null;
    const sceneDiagnostics = scene?.getDiagnostics() || null;
    const textureDiagnostics = textureManager?.getDiagnostics() || null;
    const canvas = application?.getCanvas();
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
      application: appDiagnostics,
      camera: cameraDiagnostics,
      scene: sceneDiagnostics,
      textures: textureDiagnostics
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
    playPhase,
    waitForVisualSettlement,
    getRenderedCell: (row: number, col: number) => scene?.getRenderedCell(row, col) || null,
    getCellClientRect: (row: number, col: number) => camera?.getCellClientRect(row, col) || null,
    getBoardClientRect: () => camera?.getBoardClientRect() || null,
    resize,
    restore,
    getDisplayObjectCounts,
    getTextureLeaseCounts,
    getDiagnostics,
    destroy
  });
}
