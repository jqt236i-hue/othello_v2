import {
  BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY,
  collectBoardSourceTrajectoryRequests,
  getBoardSourceTrajectoryIdsForTarget,
  resolveBoardSourceTrajectoryDurationMs,
  type BoardSourceTrajectoryBatch,
  type BoardSourceTrajectoryRequest
} from '../board-visual/source-trajectory';
import { getBoardClientRect, getCellClientRect as getFrameCellClientRect } from '../board-visual/layout';
import type {
  BoardClientRect,
  BoardPlaybackContext,
  BoardPlaybackValidationContext,
  BoardVisualFrame
} from '../board-visual/types';
import {
  PresentationPlaybackError,
  type PresentationPlaybackEvent
} from '../board-visual/playback-types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;
const AnimationDestroySourceEvents = _require('../animation-destroy-source-events');

type DestroySourceAnimationDeps = {
  isNoAnim: () => boolean;
  getCellClientRect: (row: unknown, col: unknown) => BoardClientRect | null;
  resolveSniperSource: (target: unknown) => Readonly<{ row: number; col: number }> | null;
  resolveRobotVacuumSource: (target: unknown) => Readonly<{ row: number; col: number }> | null;
  resolveDestroyDragonSource: (target: unknown) => Readonly<{ row: number; col: number }> | null;
  waitForAnimationFinish: (animation: unknown, durationMs: unknown, paddingMs: unknown) => Promise<void>;
  sleep: (ms: unknown) => Promise<void>;
  timer: () => unknown;
  playbackScope: unknown;
  transientOverlayBatch: DomSourceTrajectoryOverlayBatch | null;
  random: () => number;
  suppressTargetImpact: false;
  abortSignal: AbortSignal | null;
};

interface DomSourceTrajectoryOverlayBatch {
  getRoot?: (options?: unknown) => HTMLElement | null;
  append?: (element: HTMLElement) => boolean;
  cleanup?: () => boolean;
}

export interface DomBoardSourceTrajectoryDeps {
  readonly documentRef: Document | null;
  readonly boardElement: HTMLElement | null;
  readonly frame: BoardVisualFrame | null;
  readonly isNoAnim: () => boolean;
  readonly getFallbackCellClientRect: (row: unknown, col: unknown) => BoardClientRect | null;
  readonly waitForAnimationFinish: (animation: unknown, durationMs: unknown, paddingMs: unknown) => Promise<void>;
  readonly sleep: (ms: unknown) => Promise<void>;
  readonly timer: () => unknown;
  readonly playbackScope: unknown;
  readonly transientOverlayBatch: DomSourceTrajectoryOverlayBatch | null;
  readonly createVisualRandom: (event: PresentationPlaybackEvent, target: unknown) => () => number;
  readonly prefersReducedMotion?: () => boolean;
  readonly record?: (event: string, detail?: unknown) => void;
  readonly abortSignal?: AbortSignal | null;
}

export interface DomBoardSourceTrajectoryRun {
  readonly batch: BoardSourceTrajectoryBatch;
  readonly trajectoryById: ReadonlyMap<string, Promise<void>>;
  readonly settlement: Promise<void>;
  waitForTarget(
    eventType: 'destroy' | 'flip',
    target: unknown,
    event?: PresentationPlaybackEvent | null
  ): Promise<void>;
  waitForOptionalFlipTarget(target: unknown): Promise<void>;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

const DESTROY_METHOD_BY_PROFILE = Object.freeze({
  sniperShot: 'animateSniperProjectile',
  robotVacuumSuck: 'animateRobotVacuumSuction',
  destroyDragonBreath: 'animateDestroyDragonBreath',
  meteorGodBlackBeam: 'animateMeteorGodBlackBeam',
  lightningDestroyed: 'animateUdgLightningStrike',
  udgDestroyed: 'animateUdgLightningStrike'
} as const);

function finiteRect(rect: Partial<BoardClientRect> | null | undefined): BoardClientRect | null {
  if (!rect) return null;
  const left = Number(rect.left);
  const top = Number(rect.top);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return Object.freeze({
    left,
    top,
    right: Number.isFinite(Number(rect.right)) ? Number(rect.right) : left + width,
    bottom: Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : top + height,
    width,
    height,
    layoutRevision: Number.isFinite(Number(rect.layoutRevision)) ? Number(rect.layoutRevision) : 0
  });
}

function unionRects(first: BoardClientRect, second: BoardClientRect): BoardClientRect {
  const left = Math.min(first.left, second.left);
  const top = Math.min(first.top, second.top);
  const right = Math.max(first.right, second.right);
  const bottom = Math.max(first.bottom, second.bottom);
  return Object.freeze({
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    layoutRevision: Math.max(first.layoutRevision, second.layoutRevision)
  });
}

function resolveBoardViewportRect(deps: DomBoardSourceTrajectoryDeps): BoardClientRect | null {
  if (deps.frame?.layout?.camera) return finiteRect(getBoardClientRect(deps.frame.layout));
  return finiteRect(deps.boardElement?.getBoundingClientRect());
}

function resolveCellRect(
  request: BoardSourceTrajectoryRequest,
  coordinate: Readonly<{ row: number; col: number }>,
  deps: DomBoardSourceTrajectoryDeps
): BoardClientRect | null {
  const frame = deps.frame;
  if (frame?.model?.topology && frame?.layout?.camera) {
    return finiteRect(getFrameCellClientRect(frame.model.topology, frame.layout, coordinate.row, coordinate.col));
  }
  return finiteRect(deps.getFallbackCellClientRect(coordinate.row, coordinate.col));
}

function center(rect: BoardClientRect): Point {
  return Object.freeze({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
}

function legacyAnimationRect(rect: BoardClientRect): BoardClientRect {
  // The legacy DOM renderer consumes only CSS geometry. Keep its historical
  // DTO shape so compatibility instrumentation does not observe a new field.
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height
  } as BoardClientRect;
}

function pointInsideRect(point: Point, rect: BoardClientRect): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function segmentIntersectsRect(start: Point, end: Point, rect: BoardClientRect): boolean {
  if (pointInsideRect(start, rect) || pointInsideRect(end, rect)) return true;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let startT = 0;
  let endT = 1;
  const boundaries = [
    [-dx, start.x - rect.left],
    [dx, rect.right - start.x],
    [-dy, start.y - rect.top],
    [dy, rect.bottom - start.y]
  ] as const;
  for (const [p, q] of boundaries) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
      continue;
    }
    const ratio = q / p;
    if (p < 0) startT = Math.max(startT, ratio);
    else endT = Math.min(endT, ratio);
    if (startT > endT) return false;
  }
  return true;
}

function viewportSize(documentRef: Document | null, boardRect: BoardClientRect): Readonly<{ width: number; height: number }> {
  const windowRef = documentRef?.defaultView;
  return Object.freeze({
    width: Math.max(1, Number(windowRef?.innerWidth) || 0, Number(documentRef?.documentElement?.clientWidth) || 0, boardRect.right),
    height: Math.max(1, Number(windowRef?.innerHeight) || 0, Number(documentRef?.documentElement?.clientHeight) || 0, boardRect.bottom)
  });
}

function prepareClippedOverlayBatch(
  batch: DomSourceTrajectoryOverlayBatch | null,
  boardRect: BoardClientRect | null,
  documentRef: Document | null
): DomSourceTrajectoryOverlayBatch | null {
  if (!batch || !boardRect || typeof batch.getRoot !== 'function') return batch;
  const root = batch.getRoot({ className: 'transient-overlay-batch dom-board-source-trajectory-layer', zIndex: 1260 });
  if (!root) return batch;
  const viewport = viewportSize(documentRef, boardRect);
  const top = Math.max(0, boardRect.top);
  const right = Math.max(0, viewport.width - boardRect.right);
  const bottom = Math.max(0, viewport.height - boardRect.bottom);
  const left = Math.max(0, boardRect.left);
  root.classList.add('dom-board-source-trajectory-layer');
  root.dataset.boardSourceTrajectoryLayer = 'true';
  root.style.position = 'fixed';
  root.style.left = '0';
  root.style.top = '0';
  root.style.width = `${viewport.width}px`;
  root.style.height = `${viewport.height}px`;
  root.style.pointerEvents = 'none';
  root.style.overflow = 'hidden';
  root.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
  return batch;
}

function sourceCoordinate(target: unknown): Readonly<{ row: number; col: number }> | null {
  const candidate = target && typeof target === 'object' ? target as any : {};
  const meta = candidate.meta && typeof candidate.meta === 'object' ? candidate.meta : {};
  const row = Number(Object.prototype.hasOwnProperty.call(candidate, 'sourceRow') ? candidate.sourceRow : meta.sourceRow);
  const col = Number(Object.prototype.hasOwnProperty.call(candidate, 'sourceCol') ? candidate.sourceCol : meta.sourceCol);
  return Number.isInteger(row) && Number.isInteger(col) ? Object.freeze({ row, col }) : null;
}

function isReducedMotion(deps: DomBoardSourceTrajectoryDeps): boolean {
  if (typeof deps.prefersReducedMotion === 'function') return deps.prefersReducedMotion() === true;
  try {
    return deps.documentRef?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch (_error) {
    return false;
  }
}

function abortable<T>(pending: Promise<T>, signal: AbortSignal | null | undefined): Promise<T> {
  if (!signal) return pending;
  if (signal.aborted) return Promise.reject(signal.reason || new Error('DOM source trajectory aborted'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason || new Error('DOM source trajectory aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    pending.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

function settlementDurationMs(request: BoardSourceTrajectoryRequest, distancePx: number): number {
  const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[request.profileKey];
  const durationMs = resolveBoardSourceTrajectoryDurationMs(request.profileKey, distancePx);
  return profile.settlement === 'fixed-deadline' ? durationMs + profile.deadlinePaddingMs : durationMs;
}

async function playZombieBite(
  request: BoardSourceTrajectoryRequest,
  sourceRect: BoardClientRect,
  targetRect: BoardClientRect,
  overlayBatch: DomSourceTrajectoryOverlayBatch | null,
  deps: DomBoardSourceTrajectoryDeps
): Promise<void> {
  if (deps.isNoAnim() || isReducedMotion(deps)) return;
  const root = overlayBatch?.getRoot?.({ className: 'transient-overlay-batch dom-board-source-trajectory-layer', zIndex: 1260 });
  const documentRef = deps.documentRef;
  if (!root || !documentRef) {
    await abortable(deps.sleep(800), deps.abortSignal);
    return;
  }
  const start = center(sourceRect);
  const end = center(targetRect);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const shadow = documentRef.createElement('div');
  shadow.className = 'dom-board-source-trajectory__zombie-shadow';
  shadow.style.left = `${start.x}px`;
  shadow.style.top = `${start.y}px`;
  shadow.style.width = `${distance}px`;
  shadow.style.transform = `rotate(${angle}deg)`;
  const upperFang = documentRef.createElement('div');
  upperFang.className = 'dom-board-source-trajectory__zombie-fang dom-board-source-trajectory__zombie-fang--upper';
  const lowerFang = documentRef.createElement('div');
  lowerFang.className = 'dom-board-source-trajectory__zombie-fang dom-board-source-trajectory__zombie-fang--lower';
  for (const fang of [upperFang, lowerFang]) {
    fang.style.left = `${end.x}px`;
    fang.style.top = `${end.y}px`;
    fang.style.setProperty('--dom-zombie-bite-angle', `${angle}deg`);
  }
  root.appendChild(shadow);
  root.appendChild(upperFang);
  root.appendChild(lowerFang);
  try {
    await abortable(deps.sleep(800), deps.abortSignal);
  } finally {
    shadow.remove();
    upperFang.remove();
    lowerFang.remove();
  }
}

function animationDeps(
  request: BoardSourceTrajectoryRequest,
  sourceRect: BoardClientRect,
  targetRect: BoardClientRect,
  overlayBatch: DomSourceTrajectoryOverlayBatch | null,
  deps: DomBoardSourceTrajectoryDeps
): DestroySourceAnimationDeps {
  return {
    isNoAnim: deps.isNoAnim,
    getCellClientRect: (row: unknown, col: unknown) => {
      const numericRow = Number(row);
      const numericCol = Number(col);
      if (numericRow === request.source.row && numericCol === request.source.col) return legacyAnimationRect(sourceRect);
      if (numericRow === request.target.row && numericCol === request.target.col) return legacyAnimationRect(targetRect);
      return deps.getFallbackCellClientRect(row, col);
    },
    resolveSniperSource: sourceCoordinate,
    resolveRobotVacuumSource: sourceCoordinate,
    resolveDestroyDragonSource: sourceCoordinate,
    waitForAnimationFinish: (animation: unknown, durationMs: unknown, paddingMs: unknown) => abortable(
      deps.waitForAnimationFinish(animation, durationMs, paddingMs),
      deps.abortSignal
    ),
    sleep: (ms: unknown) => abortable(deps.sleep(ms), deps.abortSignal),
    timer: deps.timer,
    playbackScope: deps.playbackScope,
    transientOverlayBatch: overlayBatch,
    random: deps.createVisualRandom(request.event, request.targetPayload),
    // DOM compatibility historically owns these target flashes/rings inside
    // the same source animation. Keeping them here preserves fallback parity;
    // the Pixi lane continues to use its target-local effect owner.
    suppressTargetImpact: false,
    abortSignal: deps.abortSignal || null
  };
}

function playRequest(
  request: BoardSourceTrajectoryRequest,
  deps: DomBoardSourceTrajectoryDeps
): Promise<void> {
  const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[request.profileKey];
  if (!profile) {
    return Promise.reject(new Error(`DOM source trajectory profile is unavailable for ${request.profileKey}`));
  }
  if (deps.isNoAnim() || (profile.reducedMotion === 'skip-source' && isReducedMotion(deps))) {
    // NOANIM/reduced-motion source skips must not require layout geometry or
    // materialize an overlay. They still use the normal tracked start/settle
    // path so target gates and strict playback settlement remain unchanged.
    deps.record?.('dom-source-trajectory:start', {
      trajectoryId: request.trajectoryId,
      profileKey: request.profileKey,
      source: request.source,
      target: request.target,
      direction: request.direction,
      geometry: null,
      layoutRevision: null,
      visible: false
    });
    return Promise.resolve();
  }
  const sourceRect = resolveCellRect(request, request.source, deps);
  const targetRect = resolveCellRect(request, request.target, deps);
  const boardRect = resolveBoardViewportRect(deps) || (sourceRect && targetRect ? unionRects(sourceRect, targetRect) : null);
  if (!sourceRect || !targetRect || !boardRect) {
    return Promise.reject(new Error(`DOM source trajectory geometry is unavailable for ${request.profileKey}`));
  }
  const sourceCenter = center(sourceRect);
  const targetCenter = center(targetRect);
  const movementStart = request.direction === 'target-to-source' ? targetCenter : sourceCenter;
  const movementEnd = request.direction === 'target-to-source' ? sourceCenter : targetCenter;
  const distancePx = Math.hypot(targetCenter.x - sourceCenter.x, targetCenter.y - sourceCenter.y);
  const durationMs = settlementDurationMs(request, distancePx);
  const pathIntersectsViewport = segmentIntersectsRect(sourceCenter, targetCenter, boardRect);
  deps.record?.('dom-source-trajectory:start', {
    trajectoryId: request.trajectoryId,
    profileKey: request.profileKey,
    source: request.source,
    target: request.target,
    direction: request.direction,
    geometry: Object.freeze({
      sourceCenter,
      targetCenter,
      movementStart,
      movementEnd,
      distancePx,
      visibleClip: boardRect,
      pathIntersectsViewport
    }),
    layoutRevision: sourceRect.layoutRevision,
    visible: pathIntersectsViewport
  });
  if (!pathIntersectsViewport) {
    return abortable(deps.sleep(durationMs), deps.abortSignal);
  }
  const overlayBatch = prepareClippedOverlayBatch(deps.transientOverlayBatch, boardRect, deps.documentRef);
  if (request.profileKey === 'zombieBite') {
    return playZombieBite(request, sourceRect, targetRect, overlayBatch, deps);
  }
  const methodName = DESTROY_METHOD_BY_PROFILE[request.profileKey as keyof typeof DESTROY_METHOD_BY_PROFILE];
  const animation = methodName ? AnimationDestroySourceEvents?.[methodName] : null;
  if (typeof animation !== 'function') {
    return Promise.reject(new Error(`DOM source trajectory renderer is unavailable for ${request.profileKey}`));
  }
  return Promise.resolve(animation(
    request.targetPayload,
    animationDeps(request, sourceRect, targetRect, overlayBatch, deps)
  ));
}

function batchContext(context: BoardPlaybackValidationContext | BoardPlaybackContext): Readonly<{ phaseKey: string; stepIndex: number }> {
  return Object.freeze({
    phaseKey: String(context?.phaseScope?.phaseKey ?? 'phase'),
    stepIndex: Number.isInteger(Number(context?.phaseScope?.stepIndex)) ? Number(context?.phaseScope?.stepIndex) : 0
  });
}

function collectLaunchTrajectoryBatch(
  events: readonly PresentationPlaybackEvent[],
  context: BoardPlaybackValidationContext | BoardPlaybackContext
): BoardSourceTrajectoryBatch {
  const rawEvents = Array.from(events || []);
  const scopedEvents = context?.phaseScope && Array.isArray(context.phaseScope.events)
    ? context.phaseScope.events as readonly PresentationPlaybackEvent[]
    : [];
  const collected = collectBoardSourceTrajectoryRequests(
    scopedEvents.length ? scopedEvents : rawEvents,
    batchContext(context)
  );
  if (!scopedEvents.length) return collected;
  const launchEvents = new Set(rawEvents);
  return Object.freeze({
    phaseKey: collected.phaseKey,
    stepIndex: collected.stepIndex,
    requests: Object.freeze(collected.requests.filter((request) => launchEvents.has(request.event))),
    memberships: Object.freeze(collected.memberships.filter((membership) => launchEvents.has(membership.event)))
  });
}

export function validateDomBoardSourceTrajectoryPhase(
  events: readonly PresentationPlaybackEvent[],
  context: BoardPlaybackValidationContext | BoardPlaybackContext,
  frame: BoardVisualFrame | null
): BoardSourceTrajectoryBatch {
  const batch = collectLaunchTrajectoryBatch(events, context);
  if (!batch.requests.length) return batch;
  if (!frame?.model?.topology || !frame?.layout?.camera) {
    throw new Error('DOM source trajectory requires a committed board frame');
  }
  const topology = frame.model.topology;
  const existingKeys = new Set(topology.existingKeys);
  for (const request of batch.requests) {
    for (const coordinate of [request.source, request.target]) {
      if (!existingKeys.has(`${coordinate.row},${coordinate.col}`)) {
        throw new PresentationPlaybackError(
          'board_source_trajectory_endpoint_invalid',
          request.event,
          { strictNetworkPlayback: context?.strictNetworkPlayback === true }
        );
      }
    }
  }
  return batch;
}

export function startDomBoardSourceTrajectoryBatch(
  events: readonly PresentationPlaybackEvent[],
  context: BoardPlaybackContext,
  deps: DomBoardSourceTrajectoryDeps
): DomBoardSourceTrajectoryRun {
  const batch = collectLaunchTrajectoryBatch(events, context);
  const trajectoryById = new Map<string, Promise<void>>();
  for (const request of batch.requests) {
    let pending: Promise<void>;
    try {
      pending = playRequest(request, deps);
    } catch (error) {
      pending = Promise.reject(error);
    }
    const tracked = pending.then(
      () => deps.record?.('dom-source-trajectory:settle', {
        trajectoryId: request.trajectoryId,
        profileKey: request.profileKey,
        status: 'completed'
      }),
      (error) => {
        deps.record?.('dom-source-trajectory:settle', {
          trajectoryId: request.trajectoryId,
          profileKey: request.profileKey,
          status: 'failed',
          error
        });
        throw error;
      }
    ).then(() => undefined);
    trajectoryById.set(request.trajectoryId, tracked);
  }
  const settlement = Promise.all(Array.from(trajectoryById.values())).then(() => undefined);
  const waitForMembership = async (
    eventType: 'destroy' | 'flip',
    target: unknown,
    event: PresentationPlaybackEvent | null,
    allowMissing: boolean
  ): Promise<void> => {
    const ids = getBoardSourceTrajectoryIdsForTarget(batch, eventType, target, event);
    if (!ids.length) {
      if (allowMissing) return;
      throw new Error(`DOM source trajectory membership is missing for ${eventType} target`);
    }
    await Promise.all(ids.map((id) => {
      const pending = trajectoryById.get(id);
      if (!pending) throw new Error(`DOM source trajectory Promise is missing: ${id}`);
      return pending;
    }));
  };
  return Object.freeze({
    batch,
    trajectoryById,
    settlement,
    async waitForTarget(
      eventType: 'destroy' | 'flip',
      target: unknown,
      event: PresentationPlaybackEvent | null = null
    ): Promise<void> {
      await waitForMembership(eventType, target, event, false);
    },
    async waitForOptionalFlipTarget(target: unknown): Promise<void> {
      await waitForMembership('flip', target, null, true);
    }
  });
}
