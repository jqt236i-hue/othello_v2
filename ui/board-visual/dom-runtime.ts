import type { DomBoardPlaybackHandlers } from './dom-playback';
import type { BoardPlaybackContext } from './types';
import type { PresentationPlaybackEvent } from './playback-types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const Constants = _require('../animation-constants');
const Visuals = _require('../stone-visuals');
const AnimationShared = _require('../animation-helpers');
const AnimationFeedbackEvents = _require('../animation-feedback-events');
const AnimationDestroyEvents = _require('../animation-destroy-events');
const AnimationDestroySourceEvents = _require('../animation-destroy-source-events');
const AnimationFlipEvents = _require('../animation-flip-events');
const AnimationMoveEvents = _require('../animation-move-events');
const AnimationPlacementEvents = _require('../animation-placement-events');
const AnimationStatusEvents = _require('../animation-status-events');
const AnimationTheoryEvents = _require('../animation-theory-events');
const LayoutReadBatch = _require('../layout-read-batch');
const TransientOverlayBatch = _require('../transient-overlay-batch');
const PresentationEffectProfiles = _require('../../shared/presentation-effect-profiles');
const PresentationVisualSeed = _require('../presentation/visual-seed');
const StoneStatusSnapshot = _require('../../shared/stone-status-snapshot');
const SpecialMarkerRenderer = _require('../diff-renderer/special-marker-renderer');

const {
  EVENT_TYPES,
  FLIP_MS,
  POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS,
  BREEDING_SPAWN_FADE_MS,
  REGEN_CONSUME_FADE_MS,
  FADE_OUT_MS,
  OVERLAY_CROSSFADE_MS,
  MOVE_MS,
  OBSERVER_BUBBLE_MS,
  OBSERVER_BUBBLE_FADE_MS,
  THEORY_SPAWN_ROULETTE_MS,
  THEORY_SPAWN_MATERIALIZE_MS
} = Constants;

const EFFECT_TARGET_HIGHLIGHT_CLASS = 'effect-target-highlight';
const EFFECT_TARGET_POSITIVE_HIGHLIGHT_CLASS = 'effect-target-highlight-positive';
const EFFECT_TARGET_PLACEMENT_HIGHLIGHT_CLASS = 'effect-target-highlight-placement';
const EFFECT_TARGET_SPAWN_HIGHLIGHT_CLASS = 'effect-target-highlight-spawn';
const TRANSIENT_CELL_HIGHLIGHT_CLASS_DATASET_KEY = 'transientCellHighlightClass';
const TRANSIENT_CELL_HIGHLIGHT_TOKEN_DATASET_KEY = 'transientCellHighlightToken';
const RANDOM_SPAWN_PREVIEW_CLASS = 'random-spawn-preview';
const HIGHLIGHT_TONE_NEGATIVE = 'negative';
const HIGHLIGHT_TONE_POSITIVE = 'positive';
const HIGHLIGHT_TONE_PLACEMENT = 'placement';
const SACRIFICE_ABSORB_MS = 2600;

const matchesCauseAndReasonPrefix = PresentationEffectProfiles.matchesCauseAndReasonPrefix;
const matchesSpawnProfileTarget = PresentationEffectProfiles.matchesSpawnProfileTarget;
const POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS = PresentationEffectProfiles.POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS;
const SPECIAL_DESTROY_TARGET_PROFILES = PresentationEffectProfiles.SPECIAL_DESTROY_TARGET_PROFILES;

const DESTROY_SOURCE_ANIMATION_PROFILES = Object.freeze([
  Object.freeze({ ...SPECIAL_DESTROY_TARGET_PROFILES.sniperShot, sourceResolver: 'sniper', animationMethod: 'animateSniperProjectile' }),
  Object.freeze({ ...SPECIAL_DESTROY_TARGET_PROFILES.destroyDragonBreath, sourceResolver: 'dragon', animationMethod: 'animateDestroyDragonBreath' }),
  Object.freeze({ ...SPECIAL_DESTROY_TARGET_PROFILES.udgDestroyed, sourceResolver: 'sniper', animationMethod: 'animateUdgLightningStrike' }),
  Object.freeze({ ...SPECIAL_DESTROY_TARGET_PROFILES.lightningDestroyed, sourceResolver: 'sniper', animationMethod: 'animateUdgLightningStrike' }),
  Object.freeze({ ...SPECIAL_DESTROY_TARGET_PROFILES.meteorGodBlackBeam, sourceResolver: 'sniper', animationMethod: 'animateMeteorGodBlackBeam' }),
  Object.freeze({ ...SPECIAL_DESTROY_TARGET_PROFILES.willHunterKingSlash, sourceResolver: null, animationMethod: 'animateWillHunterKingSlash' }),
  Object.freeze({ ...SPECIAL_DESTROY_TARGET_PROFILES.robotVacuumSuck, sourceResolver: 'vacuum', animationMethod: 'animateRobotVacuumSuction', afterDestroy: 'clearCell' })
]);

interface DomPhaseRuntimeContext {
  key: string;
  superCrushDestinations: Map<string, { sourceHadDisc: boolean; destinationHadDisc: boolean }>;
  cellElements: Map<string, HTMLElement | null>;
  layoutBatch: any;
  transientOverlayBatch: any;
}

interface ActiveDomPhase {
  readonly phase: DomPhaseRuntimeContext;
  leases: number;
}

export interface DomBoardPlaybackRuntimeOptions {
  boardElement?: HTMLElement | null;
  getBoardElement?: () => HTMLElement | null;
  documentRef?: Document | null;
  isNoAnim?: () => boolean;
  getTimer?: () => any;
  getPlaybackScope?: () => unknown;
}

export interface DomBoardPlaybackRuntimeHandlers extends DomBoardPlaybackHandlers {
  beginPhase(events: readonly PresentationPlaybackEvent[], context: BoardPlaybackContext): void;
  endPhase(context: BoardPlaybackContext): void;
  destroy(): void;
}

function phaseTokenKey(context: BoardPlaybackContext): string {
  const token = context && context.token;
  return token ? `${token.id}:${token.frameToken}:${token.mode}` : 'dom-runtime:unclaimed';
}

function phaseMapKey(context: BoardPlaybackContext): object | string {
  const scope = context && context.phaseScope;
  return scope && typeof scope === 'object' ? scope : phaseTokenKey(context);
}

function phaseDebugKey(context: BoardPlaybackContext): string {
  const scope = context && context.phaseScope;
  if (!scope) return phaseTokenKey(context);
  const suffix = typeof scope.phaseKey === 'string'
    ? `${scope.phaseKey}:${Number.isInteger(scope.stepIndex) ? scope.stepIndex : 'scope'}`
    : 'scope';
  return `${phaseTokenKey(context)}:${suffix}`;
}

function readGlobal(name: string): any {
  try {
    if (typeof globalThis === 'undefined') return null;
    const root = globalThis as any;
    if (typeof root[name] !== 'undefined') return root[name];
    return root.window && typeof root.window[name] !== 'undefined' ? root.window[name] : null;
  } catch (_error) {
    return null;
  }
}

function resolveSpecialTimerClass(specialType: unknown): string {
  const typeUpper = String(specialType || '').toUpperCase();
  if (typeUpper === 'TIME_BOMB') return 'bomb-timer countdown-timer';
  if (typeUpper === 'GUARD') return 'guard-timer';
  if (StoneStatusSnapshot && typeof StoneStatusSnapshot.createSpecialStoneStatusSnapshot === 'function') {
    const snapshot = StoneStatusSnapshot.createSpecialStoneStatusSnapshot({ type: typeUpper }, { mode: 'raw' });
    if (snapshot && snapshot.timerClass) {
      const timerClass = String(snapshot.timerClass);
      return timerClass === 'countdown-timer' ? timerClass : `stone-timer ${timerClass}`;
    }
  }
  if (typeUpper === 'DRAGON' || typeUpper === 'DESTROY_DRAGON') return 'stone-timer dragon-timer';
  if (typeUpper === 'ULTIMATE_DESTROY_GOD') return 'stone-timer udg-timer';
  if (typeUpper === 'BREEDING') return 'stone-timer breeding-timer';
  if (typeUpper === 'WORK') return 'stone-timer work-timer';
  if (typeUpper === 'TIME_STOP') return 'countdown-timer';
  return 'stone-timer special-timer';
}

class DomBoardPlaybackRuntime {
  private readonly options: DomBoardPlaybackRuntimeOptions;
  private readonly activePhases = new Map<object | string, ActiveDomPhase>();
  private transientHighlightSequence = 0;

  constructor(options: DomBoardPlaybackRuntimeOptions) {
    this.options = options;
  }

  get documentRef(): Document | null {
    if (Object.prototype.hasOwnProperty.call(this.options, 'documentRef')) return this.options.documentRef || null;
    return typeof document !== 'undefined' ? document : null;
  }

  get boardElement(): HTMLElement | null {
    if (typeof this.options.getBoardElement === 'function') return this.options.getBoardElement() || null;
    if (this.options.boardElement) return this.options.boardElement;
    return this.documentRef && typeof this.documentRef.getElementById === 'function'
      ? this.documentRef.getElementById('board')
      : null;
  }

  isNoAnim(): boolean {
    if (typeof this.options.isNoAnim === 'function') return this.options.isNoAnim() === true;
    return !!(AnimationShared && typeof AnimationShared.isNoAnim === 'function' && AnimationShared.isNoAnim());
  }

  timer(): any {
    if (typeof this.options.getTimer === 'function') return this.options.getTimer();
    if (AnimationShared && typeof AnimationShared.getTimer === 'function') return AnimationShared.getTimer();
    return {
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: any) => clearTimeout(id)
    };
  }

  playbackScope(): unknown {
    if (typeof this.options.getPlaybackScope === 'function') return this.options.getPlaybackScope();
    return readGlobal('_currentPlaybackScope');
  }

  async sleep(ms: unknown): Promise<void> {
    if (this.isNoAnim()) return;
    await new Promise<void>((resolve) => {
      const timer = this.timer();
      if (timer && typeof timer.setTimeout === 'function') {
        timer.setTimeout(resolve, Math.max(0, Number(ms) || 0), this.playbackScope());
      } else {
        setTimeout(resolve, Math.max(0, Number(ms) || 0));
      }
    });
  }

  beginPhase(events: readonly PresentationPlaybackEvent[], context: BoardPlaybackContext): void {
    const key = phaseMapKey(context);
    const active = this.activePhases.get(key);
    if (active) {
      active.leases += 1;
      return;
    }
    const scopedEvents = context && context.phaseScope && Array.isArray(context.phaseScope.events)
      ? context.phaseScope.events as readonly PresentationPlaybackEvent[]
      : events;
    this.activePhases.set(key, {
      phase: this.buildPhase(scopedEvents, phaseDebugKey(context)),
      leases: 1
    });
  }

  endPhase(context: BoardPlaybackContext): void {
    const key = phaseMapKey(context);
    const active = this.activePhases.get(key);
    if (!active) return;
    active.leases -= 1;
    if (active.leases > 0) return;
    this.activePhases.delete(key);
    this.cleanupPhase(active.phase);
  }

  destroy(): void {
    for (const active of this.activePhases.values()) this.cleanupPhase(active.phase);
    this.activePhases.clear();
  }

  private cleanupPhase(phase: DomPhaseRuntimeContext): void {
    try { if (phase.transientOverlayBatch && typeof phase.transientOverlayBatch.cleanup === 'function') phase.transientOverlayBatch.cleanup(); } catch (_error) { /* compatibility cleanup */ }
    try { if (phase.layoutBatch && typeof phase.layoutBatch.clear === 'function') phase.layoutBatch.clear(); } catch (_error) { /* compatibility cleanup */ }
    phase.cellElements.clear();
  }

  private buildPhase(events: readonly PresentationPlaybackEvent[], key: string): DomPhaseRuntimeContext {
    const phase: DomPhaseRuntimeContext = {
      key,
      superCrushDestinations: new Map(),
      cellElements: new Map(),
      layoutBatch: LayoutReadBatch && typeof LayoutReadBatch.createLayoutReadBatch === 'function'
        ? LayoutReadBatch.createLayoutReadBatch()
        : null,
      transientOverlayBatch: TransientOverlayBatch && typeof TransientOverlayBatch.createTransientOverlayBatch === 'function'
        ? TransientOverlayBatch.createTransientOverlayBatch({ documentRef: this.documentRef })
        : null
    };
    for (const event of events || []) {
      if (!event || event.type !== EVENT_TYPES.MOVE || !Array.isArray(event.targets)) continue;
      for (const rawTarget of event.targets) {
        const target: any = rawTarget;
        if (!this.isSuperCrushMoveTarget(target)) continue;
        const from = target && target.from;
        const to = target && target.to;
        if (!to || !Number.isInteger(to.r) || !Number.isInteger(to.col)) continue;
        const fromCell = from && Number.isInteger(from.r) && Number.isInteger(from.col)
          ? this.getCellEl(from.r, from.col, phase)
          : null;
        const toCell = this.getCellEl(to.r, to.col, phase);
        phase.superCrushDestinations.set(`${to.r},${to.col}`, {
          sourceHadDisc: !!(fromCell && fromCell.querySelector('.disc')),
          destinationHadDisc: !!(toCell && toCell.querySelector('.disc'))
        });
      }
    }
    return phase;
  }

  private async runInPhase<T>(
    events: readonly PresentationPlaybackEvent[],
    context: BoardPlaybackContext,
    runner: (phase: DomPhaseRuntimeContext) => Promise<T> | T
  ): Promise<T> {
    const key = phaseMapKey(context);
    const installed = this.activePhases.get(key);
    if (installed) return runner(installed.phase);
    const implicit = this.buildPhase(events, `${phaseDebugKey(context)}:implicit`);
    try {
      return await runner(implicit);
    } finally {
      this.cleanupPhase(implicit);
    }
  }

  private getCellEl(row: unknown, col: unknown, phase?: DomPhaseRuntimeContext): HTMLElement | null {
    const key = `${row},${col}`;
    if (phase && phase.cellElements.has(key)) return phase.cellElements.get(key) || null;
    const selector = `.cell[data-row="${row}"][data-col="${col}"]`;
    const board = this.boardElement;
    let cell = board && typeof board.querySelector === 'function'
      ? board.querySelector(selector) as HTMLElement | null
      : null;
    if (!cell) {
      const boardStack = board && typeof board.closest === 'function' ? board.closest('#board-stack') : null;
      const scopedLayer = boardStack && typeof boardStack.querySelector === 'function'
        ? boardStack.querySelector('#board-expansion-layer')
        : null;
      const expansionLayer = scopedLayer || (this.documentRef ? this.documentRef.getElementById('board-expansion-layer') : null);
      cell = expansionLayer && typeof expansionLayer.querySelector === 'function'
        ? expansionLayer.querySelector(selector) as HTMLElement | null
        : null;
    }
    if (phase) phase.cellElements.set(key, cell);
    return cell;
  }

  private getCellClientRect(row: unknown, col: unknown, phase: DomPhaseRuntimeContext): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null {
    const cell = this.getCellEl(row, col, phase);
    if (!cell) return null;
    let rect: any = null;
    if (phase.layoutBatch && typeof phase.layoutBatch.readRect === 'function') {
      rect = phase.layoutBatch.readRect(cell);
    } else if (typeof cell.getBoundingClientRect === 'function') {
      rect = cell.getBoundingClientRect();
    }
    if (!rect) return null;
    const left = Number(rect.left);
    const top = Number(rect.top);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (![left, top, width, height].every(Number.isFinite)) return null;
    const right = Number.isFinite(Number(rect.right)) ? Number(rect.right) : left + width;
    const bottom = Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : top + height;
    return Object.freeze({ left, top, right, bottom, width, height });
  }

  private getTargetCause(target: any): string {
    return String(target && target.cause || '').toUpperCase();
  }

  private getTargetReason(target: any): string {
    return String(target && target.reason || '').toLowerCase();
  }

  private isSuperCrushCause(cause: unknown): boolean {
    return ['BUOYANCY_WILL', 'SUPER_BUOYANCY_WILL', 'GRAVITY_WILL', 'SUPER_GRAVITY_WILL', 'SUPER_ATTRACTION_WILL'].includes(String(cause || ''));
  }

  private isSuperCrushMoveTarget(target: any): boolean {
    const cause = this.getTargetCause(target);
    const reason = this.getTargetReason(target);
    return this.isSuperCrushCause(cause)
      || reason.startsWith('super_buoyancy_move')
      || reason.startsWith('super_gravity_move')
      || reason.startsWith('super_attraction_move');
  }

  private resolveMoveDurationScale(target: any): number {
    const cause = this.getTargetCause(target);
    const reason = this.getTargetReason(target);
    if (cause === 'SUPER_ATTRACTION_WILL' || reason.startsWith('super_attraction_move') || reason.startsWith('super_attraction_collision')) return 0.5;
    return target && target.isPositionSwapMove ? 0.8 : 1;
  }

  private resolveSuperCrushCollisionDelayMs(target: any): number {
    if (!this.isSuperCrushCause(this.getTargetCause(target))) return 0;
    const progress = Number(target && target.meta && target.meta.collisionProgress);
    if (!Number.isFinite(progress)) return 0;
    const duration = Math.max(1, Math.round((Number(MOVE_MS) || 400) * this.resolveMoveDurationScale(target)));
    return Math.max(0, Math.round(duration * Math.max(0, Math.min(0.88, progress))));
  }

  private resolveOwnerColorFromBefore(ownerBefore: unknown): 1 | -1 | null {
    return ownerBefore === 'black' ? 1 : (ownerBefore === 'white' ? -1 : null);
  }

  private resolveOwnerClassFromColor(ownerColor: unknown): 'black' | 'white' {
    return Number(ownerColor) === 1 ? 'black' : 'white';
  }

  private normalizePlayerKeyOptional(value: unknown): 'black' | 'white' | null {
    if (value === 'black' || value === 1 || value === '1') return 'black';
    if (value === 'white' || value === -1 || value === '-1') return 'white';
    return null;
  }

  private resolveVisualColorFromState(state: any, fallbackDisc: HTMLElement | null, fallbackOwner: unknown): 1 | -1 | null {
    const rawColor = Number(state && state.color);
    if (rawColor === 1 || rawColor === -1) return rawColor;
    const normalizedOwner = this.normalizePlayerKeyOptional(
      state && Object.prototype.hasOwnProperty.call(state, 'owner') ? state.owner : fallbackOwner
    );
    if (normalizedOwner === 'black') return 1;
    if (normalizedOwner === 'white') return -1;
    if (fallbackDisc && fallbackDisc.classList.contains('black')) return 1;
    if (fallbackDisc && fallbackDisc.classList.contains('white')) return -1;
    return null;
  }

  private getTargetMeta(target: any): any {
    return target && target.meta && typeof target.meta === 'object' ? target.meta : {};
  }

  private resolvePlacementHighlightTone(eventType: unknown, target: any): string | null {
    if (eventType !== EVENT_TYPES.SPAWN && eventType !== EVENT_TYPES.PLACE) return null;
    const meta = this.getTargetMeta(target);
    const placementKind = String(meta.placementKind || '').trim().toLowerCase();
    if (placementKind === 'normal_placement') return HIGHLIGHT_TONE_PLACEMENT;
    if (placementKind === 'effect_placement') return HIGHLIGHT_TONE_POSITIVE;
    const cause = this.getTargetCause(target);
    const reason = this.getTargetReason(target);
    if (cause !== 'SYSTEM' || reason !== 'standard_place') return null;
    const after = target && target.after && typeof target.after === 'object' ? target.after : {};
    const special = String(meta.special || after.special || (target && target.special) || '').trim();
    return special ? HIGHLIGHT_TONE_POSITIVE : HIGHLIGHT_TONE_PLACEMENT;
  }

  private resolveEffectTargetHighlightTone(eventType: unknown, target: any): string | null {
    if (this.isNoAnim()) return null;
    if (target && target.meta && (target.meta.blockedByGhost === true || target.meta.proliferated === true || target.meta.regenerated === true)) {
      return eventType === EVENT_TYPES.DESTROY ? HIGHLIGHT_TONE_NEGATIVE : HIGHLIGHT_TONE_POSITIVE;
    }
    const placementTone = this.resolvePlacementHighlightTone(eventType, target);
    if (placementTone) return placementTone;
    const cause = this.getTargetCause(target);
    if (!cause || cause === 'SYSTEM') return null;
    if (eventType === EVENT_TYPES.DESTROY) return HIGHLIGHT_TONE_NEGATIVE;
    if (eventType === EVENT_TYPES.MOVE && (cause === 'DESTROY_EVADE' || this.getTargetReason(target).startsWith('destroy_evade_move'))) return HIGHLIGHT_TONE_NEGATIVE;
    return [EVENT_TYPES.FLIP, EVENT_TYPES.SPAWN, EVENT_TYPES.PLACE, EVENT_TYPES.MOVE].includes(eventType)
      ? HIGHLIGHT_TONE_POSITIVE
      : null;
  }

  private resolveSpawnTargetHighlightMinimumMs(target: any): number {
    const cause = this.getTargetCause(target);
    const reason = this.getTargetReason(target);
    return POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS.some((profile: any) => matchesSpawnProfileTarget(target, cause, reason, profile))
      ? POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS
      : 0;
  }

  private resolveDestroyTargetHighlightMinimumMs(target: any): number {
    if (!target || !target.meta || !(target.meta.proliferated === true || target.meta.blockedByGhost === true || target.meta.regenerated === true)) return 0;
    const cause = this.getTargetCause(target);
    const reason = this.getTargetReason(target);
    return (cause === 'GLUTTONOUS_WILL' && reason.startsWith('gluttonous_eat'))
      || (cause === 'WILL_HUNTER_KING' && reason.startsWith('will_hunter_king_slash'))
      ? Math.max(120, Math.floor(MOVE_MS / 2))
      : 0;
  }

  private resolveStatusChangeHighlightTone(event: any, target: any): string | null {
    if (!event || (event.type !== EVENT_TYPES.STATUS_APPLIED && event.type !== EVENT_TYPES.STATUS_REMOVED)) return null;
    const meta = event.meta && typeof event.meta === 'object' ? event.meta : {};
    const explicitTone = String(meta.highlightTone || '').toLowerCase();
    if (explicitTone === 'none') return null;
    const reason = String(meta.reason || event.reason || (target && target.reason) || '').toLowerCase();
    const special = String(meta.special || (target && target.after && target.after.special) || '').toUpperCase();
    if (special === 'BLOCKADE' || special === 'FREEZE') return null;
    if (special === 'TRAP_REVEAL' || reason === 'trap_expired_reveal') return HIGHLIGHT_TONE_NEGATIVE;
    if (explicitTone === HIGHLIGHT_TONE_POSITIVE || explicitTone === HIGHLIGHT_TONE_NEGATIVE) return HIGHLIGHT_TONE_POSITIVE;
    if (String(event.rawType || '').toUpperCase() === 'STATUS_TICK' || !special) return null;
    return HIGHLIGHT_TONE_POSITIVE;
  }

  private async runWithTransientCellHighlight(
    cell: HTMLElement,
    highlightTone: string | null,
    runner: () => Promise<any> | any,
    minimumVisibleMs: unknown,
    extraClasses: readonly string[] = []
  ): Promise<any> {
    const baseClass = highlightTone === HIGHLIGHT_TONE_POSITIVE
      ? EFFECT_TARGET_POSITIVE_HIGHLIGHT_CLASS
      : highlightTone === HIGHLIGHT_TONE_PLACEMENT
        ? EFFECT_TARGET_PLACEMENT_HIGHLIGHT_CLASS
        : highlightTone === HIGHLIGHT_TONE_NEGATIVE
          ? EFFECT_TARGET_HIGHLIGHT_CLASS
          : null;
    if (!baseClass) return runner();
    const classes = extraClasses.filter(Boolean);
    const minimum = Math.max(0, Math.trunc(Number(minimumVisibleMs) || 0));
    const startedAt = Date.now();
    const token = `${baseClass}:${++this.transientHighlightSequence}`;
    cell.dataset[TRANSIENT_CELL_HIGHLIGHT_CLASS_DATASET_KEY] = baseClass;
    cell.dataset[TRANSIENT_CELL_HIGHLIGHT_TOKEN_DATASET_KEY] = token;
    cell.classList.add(baseClass, ...classes);
    try {
      return await runner();
    } finally {
      const remaining = minimum - (Date.now() - startedAt);
      if (remaining > 0) await this.sleep(remaining);
      const stillOwner = !cell.dataset[TRANSIENT_CELL_HIGHLIGHT_TOKEN_DATASET_KEY]
        || cell.dataset[TRANSIENT_CELL_HIGHLIGHT_TOKEN_DATASET_KEY] === token;
      if (stillOwner) {
        delete cell.dataset[TRANSIENT_CELL_HIGHLIGHT_CLASS_DATASET_KEY];
        delete cell.dataset[TRANSIENT_CELL_HIGHLIGHT_TOKEN_DATASET_KEY];
        cell.classList.remove(baseClass, ...classes);
      }
    }
  }

  private runWithEffectTargetHighlight(cell: HTMLElement, eventType: unknown, target: any, runner: () => Promise<any> | any, minimumVisibleMs: unknown): Promise<any> {
    const tone = this.resolveEffectTargetHighlightTone(eventType, target);
    const minimum = Number(minimumVisibleMs) > 0 ? Number(minimumVisibleMs) : (tone ? POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS : 0);
    const extra = tone === HIGHLIGHT_TONE_NEGATIVE && eventType === EVENT_TYPES.SPAWN ? [EFFECT_TARGET_SPAWN_HIGHLIGHT_CLASS] : [];
    return this.runWithTransientCellHighlight(cell, tone, runner, minimum, extra);
  }

  private async waitForAnimationFinish(animation: any, durationMs: unknown, paddingMs: unknown): Promise<void> {
    if (!animation) return;
    const timeout = Math.max(0, Math.round(Number(durationMs) || 0)) + Math.max(0, Math.round(Number(paddingMs) || 0));
    await new Promise<void>((resolve) => {
      let finished = false;
      let timeoutId: any = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        try { animation.removeEventListener('finish', finish); } catch (_error) { /* compatibility */ }
        if (timeoutId !== null) try { this.timer().clearTimeout(timeoutId); } catch (_error) { /* compatibility */ }
        resolve();
      };
      try { animation.addEventListener('finish', finish, { once: true }); } catch (_error) { /* compatibility */ }
      timeoutId = this.timer().setTimeout(finish, timeout, this.playbackScope());
      try { if (animation.finished && typeof animation.finished.then === 'function') animation.finished.then(finish).catch(finish); } catch (_error) { /* compatibility */ }
    });
  }

  private async waitForOpacityTransition(element: HTMLElement | null, durationMs: unknown, paddingMs: unknown, starter: (() => void) | null, cleanup: (() => void) | null): Promise<void> {
    if (!element) {
      if (cleanup) cleanup();
      return;
    }
    const timeout = Math.max(0, Math.round(Number(durationMs) || 0)) + Math.max(0, Math.round(Number(paddingMs) || 0));
    await new Promise<void>((resolve) => {
      let finished = false;
      let timeoutId: any = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (timeoutId !== null) try { this.timer().clearTimeout(timeoutId); } catch (_error) { /* compatibility */ }
        try { element.removeEventListener('transitionend', onEnd); } catch (_error) { /* compatibility */ }
        if (cleanup) try { cleanup(); } catch (_error) { /* compatibility */ }
        resolve();
      };
      const onEnd = (event: TransitionEvent) => { if (!event || event.propertyName === 'opacity') finish(); };
      try { element.addEventListener('transitionend', onEnd); } catch (_error) { /* compatibility */ }
      timeoutId = this.timer().setTimeout(finish, timeout, this.playbackScope());
      if (starter) try { starter(); } catch (_error) { finish(); }
    });
  }

  private createDisc(state: any): HTMLElement {
    const documentRef = this.documentRef;
    if (!documentRef) throw new Error('DOM board playback document unavailable');
    const disc = documentRef.createElement('div');
    disc.className = 'disc';
    this.syncDiscVisual(disc, state);
    return disc;
  }

  private createFlipProtectionBadge(): HTMLElement | null {
    const documentRef = this.documentRef;
    if (!documentRef) return null;
    if (SpecialMarkerRenderer && typeof SpecialMarkerRenderer.createSpecialMarkerRenderer === 'function') {
      const renderer = SpecialMarkerRenderer.createSpecialMarkerRenderer({ documentRef });
      if (renderer && typeof renderer.createFlipProtectionBadge === 'function') return renderer.createFlipProtectionBadge();
    }
    const badge = documentRef.createElement('div');
    badge.className = 'stone-flip-protection-badge';
    badge.textContent = '反';
    badge.setAttribute('aria-hidden', 'true');
    return badge;
  }

  private createRegenBadge(value: unknown, specialType: unknown): HTMLElement | null {
    const documentRef = this.documentRef;
    const remaining = Math.max(0, Math.trunc(Number(value)));
    if (!documentRef || !Number.isFinite(remaining) || remaining <= 0) return null;
    if (SpecialMarkerRenderer && typeof SpecialMarkerRenderer.createSpecialMarkerRenderer === 'function') {
      const renderer = SpecialMarkerRenderer.createSpecialMarkerRenderer({ documentRef });
      if (renderer && typeof renderer.createRegenBadgeLabel === 'function') {
        return renderer.createRegenBadgeLabel(remaining, { specialType });
      }
    }
    const badge = documentRef.createElement('div');
    badge.className = 'stone-regen-badge';
    if (String(specialType || '').toUpperCase() === 'ZOMBIE') badge.classList.add('stone-regen-badge--zombie');
    badge.dataset.count = String(remaining);
    if (remaining >= 10) badge.classList.add('timer-double-digit');
    const label = documentRef.createElement('span');
    label.className = 'stone-regen-badge-value';
    label.textContent = String(remaining);
    badge.appendChild(label);
    return badge;
  }

  private shouldShowFlipProtectionBadge(state: any, specialType: string): boolean {
    if (!StoneStatusSnapshot || typeof StoneStatusSnapshot.createSpecialStoneStatusSnapshot !== 'function') return false;
    const snapshot = StoneStatusSnapshot.createSpecialStoneStatusSnapshot({
      type: specialType || null,
      remainingOwnerTurns: state && state.timer,
      flipEvadeRemaining: state && state.flipEvadeRemaining,
      destroyEvadeRemaining: state && state.destroyEvadeRemaining,
      hasGuard: specialType === 'GUARD' || !!(state && (state.hasGuard || state.guard))
    }, { mode: 'raw' });
    return !!(snapshot && snapshot.hasFlipProtection);
  }

  private syncDiscVisual(disc: HTMLElement, state: any): void {
    if (!state) return;
    disc.classList.remove('black', 'white');
    if (state.color === 1) disc.classList.add('black');
    else if (state.color === -1) disc.classList.add('white');
    disc.classList.toggle('living-will-aura', !!state.livingWillAura);
    disc.classList.remove('manifest-stone-aura', 'manifest-stone-aura-black', 'manifest-stone-aura-white');
    if (state.manifestAura) {
      const owner = state.manifestAura.owner !== undefined ? state.manifestAura.owner : state.owner;
      const ownerClass = owner === 'white' || owner === -1 || owner === '-1' ? 'white' : 'black';
      disc.classList.add('manifest-stone-aura', `manifest-stone-aura-${ownerClass}`);
    }

    const setDiscStoneImage = readGlobal('setDiscStoneImage');
    const clearStoneVisualEffectState = readGlobal('clearStoneVisualEffectState');
    const applyStoneVisualEffect = readGlobal('applyStoneVisualEffect');
    const getEffectKeyForSpecialType = readGlobal('getEffectKeyForSpecialType');
    const specialType = state.special;
    if (specialType) {
      const effectKey = typeof getEffectKeyForSpecialType === 'function' ? getEffectKeyForSpecialType(specialType) : null;
      if (typeof clearStoneVisualEffectState === 'function') clearStoneVisualEffectState(disc, { skipRenderReset: true });
      else {
        disc.classList.remove('special-stone');
        disc.style.removeProperty('--special-stone-image');
        disc.style.removeProperty('--disc-overlay-image');
        disc.style.removeProperty('--disc-overlay-scale');
      }
      if (typeof applyStoneVisualEffect === 'function' && effectKey) {
        applyStoneVisualEffect(disc, effectKey, { owner: state.owner !== undefined && state.owner !== null ? state.owner : state.color });
      } else if (typeof setDiscStoneImage === 'function') setDiscStoneImage(disc, state.color);
    } else if (typeof clearStoneVisualEffectState === 'function') {
      clearStoneVisualEffectState(disc);
    } else {
      disc.classList.remove('special-stone');
      disc.style.removeProperty('--special-stone-image');
      disc.style.removeProperty('--disc-overlay-image');
      disc.style.removeProperty('--disc-overlay-scale');
      if (typeof setDiscStoneImage === 'function') setDiscStoneImage(disc, state.color);
    }
    this.syncDiscTimerOnly(disc, state);
  }

  private syncDiscTimerOnly(disc: HTMLElement, state: any): void {
    if (!disc || !state) return;
    disc.querySelectorAll('.stone-timer, .bomb-timer, .special-timer, .countdown-timer, .dragon-timer, .udg-timer, .breeding-timer, .work-timer, .guard-timer, .flip-evade-timer, .destroy-evade-timer, .stone-flip-protection-badge, .stone-regen-badge')
      .forEach((element) => element.remove());
    const specialType = String(state.special || '').toUpperCase();
    let primaryTimerValue = Number(state.timer);
    if (specialType === 'PERMA_PROTECTED') primaryTimerValue = NaN;
    const parseCounter = (raw: unknown) => {
      if (raw === null || raw === undefined || raw === '') return NaN;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : NaN;
    };
    const appendTimer = (className: string, value: number, allowZero = false) => {
      if (!(Number.isFinite(value) && (allowZero ? value >= 0 : value > 0))) return;
      const timer = this.documentRef!.createElement('div');
      timer.className = className;
      timer.textContent = String(Math.max(0, Math.trunc(value)));
      disc.appendChild(timer);
    };
    const flipEvadeRemaining = parseCounter(state.flipEvadeRemaining);
    const destroyEvadeRemaining = parseCounter(state.destroyEvadeRemaining);
    const reviveRemaining = specialType === 'REGEN' ? primaryTimerValue : parseCounter(state.regenRemaining);
    if ((specialType === 'REGEN' || specialType === 'ZOMBIE') && Number.isFinite(reviveRemaining) && reviveRemaining > 0) {
      const badge = this.createRegenBadge(reviveRemaining, specialType);
      if (badge) disc.appendChild(badge);
    }
    if (specialType !== 'REGEN' && Number.isFinite(primaryTimerValue) && primaryTimerValue > 0) {
      appendTimer(resolveSpecialTimerClass(specialType), primaryTimerValue);
    }
    if (this.shouldShowFlipProtectionBadge(state, specialType)) {
      const badge = this.createFlipProtectionBadge();
      if (badge) disc.appendChild(badge);
    }
    if (['HYPERACTIVE', 'AFTERIMAGE_WILL', 'EXTREME_HYPERACTIVE', 'ESCAPE_HYPERACTIVE', 'ULTIMATE_HYPERACTIVE', 'WILL_HUNTER_KING'].includes(specialType)
      && Number.isFinite(flipEvadeRemaining)) {
      appendTimer('stone-timer flip-evade-timer', flipEvadeRemaining, true);
    }
    if (['ULTIMATE_HYPERACTIVE', 'EXTREME_HYPERACTIVE', 'WILL_HUNTER_KING', 'AFTERIMAGE_WILL'].includes(specialType)
      && Number.isFinite(destroyEvadeRemaining)) {
      appendTimer('stone-timer destroy-evade-timer', destroyEvadeRemaining, true);
    }
  }

  private removeDiscFromCell(cell: HTMLElement | null, disc: Element | null): void {
    if (!cell || !disc) return;
    try { if (disc.parentElement === cell) cell.removeChild(disc); } catch (_error) { /* compatibility */ }
    try { if (!cell.querySelector('.disc')) cell.classList.remove('has-disc'); } catch (_error) { /* compatibility */ }
  }

  private async waitForDisc(row: unknown, col: unknown, attempts: unknown, phase: DomPhaseRuntimeContext): Promise<HTMLElement | null> {
    let remaining = Number.isFinite(Number(attempts)) ? Number(attempts) : 1;
    while (remaining > 0) {
      const cell = this.getCellEl(row, col, phase);
      const disc = cell ? cell.querySelector('.disc') as HTMLElement | null : null;
      if (disc) return disc;
      remaining -= 1;
      await new Promise<void>((resolve) => {
        try { requestAnimationFrame(() => setTimeout(resolve, 0)); } catch (_error) { setTimeout(resolve, 0); }
      });
    }
    return null;
  }

  private async fadeOutFreezeOverlay(cell: HTMLElement, durationMs: number): Promise<void> {
    const freezeMark = cell.querySelector('.freeze-mark') as HTMLElement | null;
    cell.classList.remove('frozen-cell');
    if (!freezeMark) return;
    if (this.isNoAnim() || !Number.isFinite(durationMs) || durationMs <= 0) {
      freezeMark.remove();
      return;
    }
    const ghost = freezeMark.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '85', opacity: '1' });
    freezeMark.remove();
    cell.appendChild(ghost);
    ghost.style.transition = `opacity ${durationMs}ms ease`;
    await this.waitForOpacityTransition(ghost, durationMs, 120, () => {
      try { requestAnimationFrame(() => { ghost.style.opacity = '0'; }); } catch (_error) { ghost.style.opacity = '0'; }
    }, () => ghost.remove());
  }

  private async crossfadeDiscToState(disc: HTMLElement, after: any, durationMs: number): Promise<void> {
    const cell = disc.parentElement;
    if (!cell || this.isNoAnim() || !Number.isFinite(durationMs) || durationMs <= 0) {
      this.syncDiscVisual(disc, after);
      return;
    }
    const ghost = disc.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', margin: '0', pointerEvents: 'none', zIndex: '85', opacity: '1' });
    ghost.classList.add('stone-instant');
    cell.appendChild(ghost);
    const previousTransition = disc.style.transition || '';
    disc.style.opacity = '0';
    this.syncDiscVisual(disc, after);
    disc.classList.add('stone-instant');
    void disc.offsetHeight;
    disc.classList.remove('stone-instant');
    disc.style.transition = previousTransition ? `${previousTransition}, opacity ${durationMs}ms ease` : `opacity ${durationMs}ms ease`;
    ghost.style.transition = `opacity ${durationMs}ms ease`;
    await this.waitForOpacityTransition(ghost, durationMs, 120, () => {
      try { requestAnimationFrame(() => { disc.style.opacity = '1'; ghost.style.opacity = '0'; }); }
      catch (_error) { disc.style.opacity = '1'; ghost.style.opacity = '0'; }
    }, () => {
      ghost.remove();
      disc.style.opacity = '';
      disc.style.transition = previousTransition;
    });
  }

  private isBoardShrinkHoleStatusChange(event: any, target: any): boolean {
    const meta = event && event.meta && typeof event.meta === 'object' ? event.meta : {};
    const targetMeta = target && target.meta && typeof target.meta === 'object' ? target.meta : {};
    return String(targetMeta.visualVariant || meta.visualVariant || (target && target.after && target.after.visualVariant) || '').toUpperCase() === 'BOARD_FRAME';
  }

  private async playBoardShrinkHolePushIn(cell: HTMLElement): Promise<void> {
    const documentRef = this.documentRef;
    if (!documentRef) return;
    cell.classList.add('blocked-cell', 'board-shrink-hole-cell');
    cell.classList.remove('meteor-hole-cell');
    let mark = cell.querySelector('.board-shrink-hole-mark') as HTMLElement | null;
    if (!mark) {
      mark = documentRef.createElement('div');
      mark.className = 'board-shrink-hole-mark';
      cell.appendChild(mark);
    }
    if (this.isNoAnim()) return;
    try {
      cell.classList.add('board-shrink-hole-push-active');
      mark.classList.add('board-shrink-hole-push-in');
      await this.sleep(Math.max(180, Math.min(360, Math.round(FADE_OUT_MS * 0.55))));
    } finally {
      mark.classList.remove('board-shrink-hole-push-in');
      cell.classList.remove('board-shrink-hole-push-active');
    }
  }

  private resolveSourceCell(target: any): { row: number; col: number } | null {
    const meta = target && target.meta && typeof target.meta === 'object' ? target.meta : {};
    const row = Number(Object.prototype.hasOwnProperty.call(target || {}, 'sourceRow') ? target.sourceRow : meta.sourceRow);
    const col = Number(Object.prototype.hasOwnProperty.call(target || {}, 'sourceCol') ? target.sourceCol : meta.sourceCol);
    return Number.isFinite(row) && Number.isFinite(col) ? { row: Math.trunc(row), col: Math.trunc(col) } : null;
  }

  private resolveDestroySourceAnimationProfile(target: any): any {
    const cause = this.getTargetCause(target);
    const reason = this.getTargetReason(target);
    for (const profile of DESTROY_SOURCE_ANIMATION_PROFILES as readonly any[]) {
      if (!matchesCauseAndReasonPrefix(cause, reason, profile)) continue;
      if (profile.sourceResolver && !this.resolveSourceCell(target)) continue;
      return profile;
    }
    return null;
  }

  private createVisualRandom(event: any, target: any): () => number {
    if (!PresentationVisualSeed || typeof PresentationVisualSeed.createVisualRandom !== 'function') return () => 0.5;
    const source = event && typeof event === 'object' ? event : {};
    const seedEvent = Object.assign({}, source, {
      presentationBatchId: source.presentationBatchId || 'local-presentation:0',
      effectKind: 'destroy-source',
      target: target && typeof target === 'object' ? { row: target.r ?? target.row, col: target.col ?? target.c } : target
    });
    try { return PresentationVisualSeed.createVisualRandom({ event: seedEvent }); }
    catch (_error) { return PresentationVisualSeed.createVisualRandom(0x9e3779b9); }
  }

  private destroySourceDeps(event: any, target: any, phase: DomPhaseRuntimeContext): any {
    return {
      isNoAnim: () => this.isNoAnim(),
      getCellClientRect: (row: unknown, col: unknown) => this.getCellClientRect(row, col, phase),
      resolveSniperSource: (candidate: any) => this.resolveSourceCell(candidate),
      resolveRobotVacuumSource: (candidate: any) => this.resolveSourceCell(candidate),
      resolveDestroyDragonSource: (candidate: any) => this.resolveSourceCell(candidate),
      waitForAnimationFinish: (animation: any, duration: unknown, padding: unknown) => this.waitForAnimationFinish(animation, duration, padding),
      sleep: (ms: unknown) => this.sleep(ms),
      timer: () => this.timer(),
      playbackScope: this.playbackScope(),
      transientOverlayBatch: phase.transientOverlayBatch,
      random: this.createVisualRandom(event, target)
    };
  }

  private async playDestroySourceAnimation(target: any, profile: any, event: any, phase: DomPhaseRuntimeContext): Promise<void> {
    if (!profile || !profile.animationMethod) return;
    const animation = AnimationDestroySourceEvents && AnimationDestroySourceEvents[profile.animationMethod];
    if (typeof animation === 'function') await animation(target, this.destroySourceDeps(event, target, phase));
  }

  private async animateDestroyGhostAtCell(cell: HTMLElement, ownerColor: unknown): Promise<void> {
    const documentRef = this.documentRef;
    if (!documentRef) return;
    const ghost = documentRef.createElement('div');
    ghost.className = `disc ${Number(ownerColor) === 1 ? 'black' : (Number(ownerColor) === -1 ? 'white' : '')}`.trim();
    ghost.style.pointerEvents = 'none';
    ghost.classList.add('destroy-fade');
    cell.appendChild(ghost);
    await this.sleep(FADE_OUT_MS);
    ghost.remove();
  }

  private animateLegacyFadeOut(row: unknown, col: unknown, options: any, phase: DomPhaseRuntimeContext): Promise<void> {
    const opts = options || {};
    return new Promise<void>((resolve) => {
      const cell = this.getCellEl(row, col, phase);
      if (!cell) return resolve();
      let disc = cell.querySelector('.disc') as HTMLElement | null;
      let createdGhost = false;
      if (!disc && opts.createGhost && this.documentRef) {
        disc = this.documentRef.createElement('div');
        const black = readGlobal('BLACK') ?? 1;
        disc.className = `disc ${opts.color === black ? 'black' : 'white'}`;
        disc.style.pointerEvents = 'none';
        cell.appendChild(disc);
        createdGhost = true;
        const applyStoneVisualEffect = readGlobal('applyStoneVisualEffect');
        if (opts.effectKey && typeof applyStoneVisualEffect === 'function') {
          applyStoneVisualEffect(disc, opts.effectKey, { owner: opts.color });
        }
      }
      if (!disc || disc.classList.contains('destroy-fade')) return resolve();
      if (this.isNoAnim()) {
        if (createdGhost && disc.parentElement) disc.parentElement.removeChild(disc);
        return resolve();
      }

      disc.classList.remove('flip', 'shatter', 'breeding-spawn');
      void disc.offsetWidth;
      let resolved = false;
      let timerId: any = null;
      const timer = this.timer();
      const sharedConstants = readGlobal('SharedConstants');
      const windowFadeMs = readGlobal('DESTROY_FADE_MS');
      const fadeMs = sharedConstants && Number(sharedConstants.DESTROY_FADE_MS) > 0
        ? Number(sharedConstants.DESTROY_FADE_MS)
        : (Number(windowFadeMs) > 0 ? Number(windowFadeMs) : 500);
      const startedAt = Date.now();
      const safeResolve = () => {
        if (resolved) return;
        resolved = true;
        disc!.removeEventListener('animationend', onEnd);
        if (timerId !== null) {
          try { timer.clearTimeout(timerId); } catch (_error) { /* compatibility */ }
          timerId = null;
        }
        if (createdGhost && disc!.parentElement) disc!.parentElement.removeChild(disc!);
        resolve();
      };
      const onEnd = () => {
        if ((Date.now() - startedAt) < fadeMs) return;
        safeResolve();
      };
      if (!opts.createGhost) disc.addEventListener('animationend', onEnd);
      disc.classList.add('destroy-fade');
      timerId = timer.setTimeout(safeResolve, fadeMs + 200, this.playbackScope());
    });
  }

  private animateLegacyStrongWillApply(row: unknown, col: unknown, phase: DomPhaseRuntimeContext): Promise<void> {
    return new Promise<void>((resolve) => {
      const cell = this.getCellEl(row, col, phase);
      const disc = cell ? cell.querySelector('.disc') as HTMLElement | null : null;
      if (!disc || this.isNoAnim()) return resolve();
      disc.classList.remove('strong-will-apply');
      void disc.offsetWidth;
      let resolved = false;
      let timerId: any = null;
      const timer = this.timer();
      const safeResolve = () => {
        if (resolved) return;
        resolved = true;
        disc.removeEventListener('animationend', safeResolve);
        disc.classList.remove('strong-will-apply');
        if (timerId !== null) {
          try { timer.clearTimeout(timerId); } catch (_error) { /* compatibility */ }
          timerId = null;
        }
        resolve();
      };
      disc.addEventListener('animationend', safeResolve);
      disc.classList.add('strong-will-apply');
      timerId = timer.setTimeout(safeResolve, 600, this.playbackScope());
    });
  }

  private clearRandomSpawnPreviewHints(): void {
    const roots: Element[] = [];
    const board = this.boardElement;
    if (board) roots.push(board);
    const boardStack = board && typeof board.closest === 'function' ? board.closest('#board-stack') : null;
    const scopedLayer = boardStack && boardStack.querySelector('#board-expansion-layer');
    const documentLayer = this.documentRef && this.documentRef.getElementById('board-expansion-layer');
    if (scopedLayer && !roots.includes(scopedLayer)) roots.push(scopedLayer);
    if (documentLayer && !roots.includes(documentLayer)) roots.push(documentLayer);
    for (const root of roots) {
      root.classList.remove(RANDOM_SPAWN_PREVIEW_CLASS);
      root.querySelectorAll(`.${RANDOM_SPAWN_PREVIEW_CLASS}`).forEach((cell) => cell.classList.remove(RANDOM_SPAWN_PREVIEW_CLASS));
    }
  }

  private shouldClearRandomSpawnPreview(event: any): boolean {
    return (Array.isArray(event && event.targets) ? event.targets : []).some((target: any) => {
      const cause = this.getTargetCause(target);
      const reason = this.getTargetReason(target);
      return (cause === 'REINFORCEMENT_WILL' && reason.startsWith('reinforcement_will_spawn'))
        || (cause === 'SUPPORT_TROOPS_WILL' && reason.startsWith('support_troops_will_spawn'));
    });
  }

  async playPlace(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, async (phase) => {
      if (!AnimationPlacementEvents || typeof AnimationPlacementEvents.handlePlaceEvent !== 'function') throw new Error('DOM placement event module unavailable');
      await AnimationPlacementEvents.handlePlaceEvent(event, this.placementDeps(phase));
    });
  }

  async playFlipBatch(events: readonly PresentationPlaybackEvent[], context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase(events, context, async (phase) => {
      if (!AnimationFlipEvents || typeof AnimationFlipEvents.handleFlipEvent !== 'function') throw new Error('DOM flip event module unavailable');
      const targets: unknown[] = [];
      for (const event of events) for (const target of Array.isArray(event.targets) ? event.targets : []) targets.push(target);
      if (!targets.length) return;
      await AnimationFlipEvents.handleFlipEvent({ type: EVENT_TYPES.FLIP, targets }, {
        eventTypes: EVENT_TYPES,
        flipMs: FLIP_MS,
        fadeOutMs: FADE_OUT_MS,
        zombieBiteMs: 800,
        isNoAnim: () => this.isNoAnim(),
        getCellEl: (row: unknown, col: unknown) => this.getCellEl(row, col, phase),
        getCellClientRect: (row: unknown, col: unknown) => this.getCellClientRect(row, col, phase),
        resolveOwnerColorFromBefore: (owner: unknown) => this.resolveOwnerColorFromBefore(owner),
        resolveOwnerClassFromColor: (color: unknown) => this.resolveOwnerClassFromColor(color),
        syncDiscVisual: (disc: HTMLElement, state: any) => this.syncDiscVisual(disc, state),
        runWithEffectTargetHighlight: (cell: HTMLElement, type: unknown, target: any, runner: () => Promise<any>, minimum: unknown) => this.runWithEffectTargetHighlight(cell, type, target, runner, minimum),
        sleep: (ms: unknown) => this.sleep(ms),
        animationShared: AnimationShared
      });
    });
  }

  private placementDeps(phase: DomPhaseRuntimeContext): any {
    return {
      eventTypes: EVENT_TYPES,
      breedingSpawnFadeMs: BREEDING_SPAWN_FADE_MS,
      isNoAnim: () => this.isNoAnim(),
      getCellEl: (row: unknown, col: unknown) => this.getCellEl(row, col, phase),
      createDisc: (state: any) => this.createDisc(state),
      runWithEffectTargetHighlight: (cell: HTMLElement, type: unknown, target: any, runner: () => Promise<any>, minimum: unknown) => this.runWithEffectTargetHighlight(cell, type, target, runner, minimum),
      resolveSpawnTargetHighlightMinimumMs: (target: any) => this.resolveSpawnTargetHighlightMinimumMs(target),
      waitForOpacityTransition: (element: HTMLElement, duration: unknown, padding: unknown, starter: () => void, cleanup: () => void) => this.waitForOpacityTransition(element, duration, padding, starter, cleanup)
    };
  }

  async playSpawn(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, async (phase) => {
      if (!AnimationPlacementEvents || typeof AnimationPlacementEvents.handleSpawnEvent !== 'function') throw new Error('DOM spawn event module unavailable');
      if (this.shouldClearRandomSpawnPreview(event)) this.clearRandomSpawnPreviewHints();
      await AnimationPlacementEvents.handleSpawnEvent(event, this.placementDeps(phase));
    });
  }

  async playDestroy(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, async (phase) => {
      if (!AnimationDestroyEvents || typeof AnimationDestroyEvents.handleDestroyEvent !== 'function') throw new Error('DOM destroy event module unavailable');
      await AnimationDestroyEvents.handleDestroyEvent(event, {
        eventTypes: EVENT_TYPES,
        fadeOutMs: FADE_OUT_MS,
        getCellEl: (row: unknown, col: unknown) => this.getCellEl(row, col, phase),
        sleep: (ms: unknown) => this.sleep(ms),
        getTargetCause: (target: any) => this.getTargetCause(target),
        getTargetReason: (target: any) => this.getTargetReason(target),
        isSuperCrushCause: (cause: unknown) => this.isSuperCrushCause(cause),
        getSuperCrushDestinationContext: (row: unknown, col: unknown) => phase.superCrushDestinations.get(`${row},${col}`) || null,
        resolveSuperCrushTargetDelayMs: (target: any) => this.resolveSuperCrushCollisionDelayMs(target),
        resolveOwnerColorFromBefore: (owner: unknown) => this.resolveOwnerColorFromBefore(owner),
        shouldPreserveDiscOnDestroy: (target: any) => !!(target && target.meta && (target.meta.blockedByGhost || target.meta.proliferated === true || target.meta.regenerated === true)),
        resolveDestroyTargetHighlightMinimumMs: (target: any) => this.resolveDestroyTargetHighlightMinimumMs(target),
        resolveEffectTargetHighlightTone: (type: unknown, target: any) => this.resolveEffectTargetHighlightTone(type, target),
        runWithEffectTargetHighlight: (cell: HTMLElement, type: unknown, target: any, runner: () => Promise<any>, minimum: unknown) => this.runWithEffectTargetHighlight(cell, type, target, runner, minimum),
        resolveDestroySourceAnimationProfile: (target: any) => this.resolveDestroySourceAnimationProfile(target),
        playDestroySourceAnimation: (target: any, profile: any) => this.playDestroySourceAnimation(target, profile, event, phase),
        animateDestroyGhostAtCell: (cell: HTMLElement, color: unknown) => this.animateDestroyGhostAtCell(cell, color),
        createDisc: (state: any) => this.createDisc(state),
        removeDiscFromCell: (cell: HTMLElement, disc: HTMLElement) => this.removeDiscFromCell(cell, disc),
        resolveOwnerClassFromColor: (color: unknown) => this.resolveOwnerClassFromColor(color),
        animateFadeOutAt: (row: unknown, col: unknown, options: any) => this.animateLegacyFadeOut(row, col, options, phase),
        onDestroyGhostFallback: (target: any, details: any) => {
          const registry = readGlobal('__destroyGhostFallbackEvents');
          if (Array.isArray(registry)) registry.push({ target, context: details });
        }
      });
    });
  }

  async playMove(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, async (phase) => {
      if (!AnimationMoveEvents || typeof AnimationMoveEvents.handleMoveEvent !== 'function') throw new Error('DOM move event module unavailable');
      await AnimationMoveEvents.handleMoveEvent(event, {
        eventTypes: EVENT_TYPES,
        moveMs: MOVE_MS,
        effectTargetHighlightClass: EFFECT_TARGET_HIGHLIGHT_CLASS,
        effectTargetPositiveHighlightClass: EFFECT_TARGET_POSITIVE_HIGHLIGHT_CLASS,
        highlightToneNegative: HIGHLIGHT_TONE_NEGATIVE,
        highlightTonePositive: HIGHLIGHT_TONE_POSITIVE,
        isNoAnim: () => this.isNoAnim(),
        getCellEl: (row: unknown, col: unknown) => this.getCellEl(row, col, phase),
        getCellClientRect: (row: unknown, col: unknown) => this.getCellClientRect(row, col, phase),
        createDisc: (state: any) => this.createDisc(state),
        getTargetCause: (target: any) => this.getTargetCause(target),
        getTargetReason: (target: any) => this.getTargetReason(target),
        resolveEffectTargetHighlightTone: (type: unknown, target: any) => this.resolveEffectTargetHighlightTone(type, target),
        resolveMoveDurationScale: (target: any) => this.resolveMoveDurationScale(target),
        waitForAnimationFinish: (animation: any, duration: unknown, padding: unknown) => this.waitForAnimationFinish(animation, duration, padding),
        syncDiscVisual: (disc: HTMLElement, state: any) => this.syncDiscVisual(disc, state),
        removeDiscFromCell: (cell: HTMLElement, disc: HTMLElement) => this.removeDiscFromCell(cell, disc)
      });
    });
  }

  async playStatusChange(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, async (phase) => {
      if (!AnimationStatusEvents || typeof AnimationStatusEvents.handleStatusChangeEvent !== 'function') throw new Error('DOM status event module unavailable');
      await AnimationStatusEvents.handleStatusChangeEvent(event, {
        eventTypes: EVENT_TYPES,
        visuals: Visuals,
        overlayCrossfadeMs: OVERLAY_CROSSFADE_MS,
        regenConsumeFadeMs: REGEN_CONSUME_FADE_MS,
        getCellEl: (row: unknown, col: unknown) => this.getCellEl(row, col, phase),
        resolveStatusChangeHighlightTone: (candidate: any, target: any) => this.resolveStatusChangeHighlightTone(candidate, target),
        runWithTransientCellHighlight: (cell: HTMLElement, tone: string | null, runner: () => Promise<any>, minimum: unknown, classes: string[]) => this.runWithTransientCellHighlight(cell, tone, runner, minimum, classes),
        resolveStatusChangeHighlightMinimumMs: (tone: unknown) => tone ? POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS : 0,
        waitForDisc: (row: unknown, col: unknown, attempts: unknown) => this.waitForDisc(row, col, attempts, phase),
        syncDiscTimerOnly: (disc: HTMLElement, state: any) => this.syncDiscTimerOnly(disc, state),
        fadeOutFreezeOverlay: (cell: HTMLElement, duration: number) => this.fadeOutFreezeOverlay(cell, duration),
        crossfadeDiscToState: (disc: HTMLElement, state: any, duration: number) => this.crossfadeDiscToState(disc, state, duration),
        isBoardShrinkHoleStatusChange: (candidate: any, target: any) => this.isBoardShrinkHoleStatusChange(candidate, target),
        playBoardShrinkHolePushIn: (cell: HTMLElement) => this.playBoardShrinkHolePushIn(cell),
        removeDiscFromCell: (cell: HTMLElement, disc: HTMLElement) => this.removeDiscFromCell(cell, disc),
        resolveVisualColorFromState: (state: any, disc: HTMLElement, owner: unknown) => this.resolveVisualColorFromState(state, disc, owner),
        syncDiscVisual: (disc: HTMLElement, state: any) => this.syncDiscVisual(disc, state)
      });
    });
  }

  async playCrossfadeStone(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, async (phase) => {
      const row = Number(event && event.row);
      const col = Number(event && event.col);
      if (!Number.isFinite(row) || !Number.isFinite(col)) return;
      await new Promise<void>((resolve, reject) => {
        const settleFailure = (error: unknown): void => {
          if (context.strictNetworkPlayback === true) reject(error instanceof Error ? error : new Error(String(error || 'crossfade_stone_failed')));
          else resolve();
        };
        const tryApply = (retries: number): void => {
          try {
            const cell = this.getCellEl(row, col, phase);
            const disc = cell ? cell.querySelector('.disc') as HTMLElement | null : null;
            if (!disc) {
              phase.cellElements.delete(`${row},${col}`);
              if (retries > 0) {
                this.timer().setTimeout(() => tryApply(retries - 1), 80, this.playbackScope());
              } else {
                settleFailure(new Error(`crossfade_stone_target_unavailable:${row},${col}`));
              }
              return;
            }
            try {
              if (Visuals && typeof Visuals.syncDiscVisualToCurrentState === 'function') {
                Visuals.syncDiscVisualToCurrentState(row, col);
              }
            } catch (_error) { /* preserve legacy best-effort sync */ }
            const options = {
              effectKey: event.effectKey,
              owner: event.owner,
              newColor: event.newColor,
              durationMs: event.durationMs,
              autoFadeOut: event.autoFadeOut,
              fadeWholeStone: event.fadeWholeStone
            };
            if (Visuals && typeof Visuals.crossfadeStoneVisual === 'function') {
              Promise.resolve(Visuals.crossfadeStoneVisual(disc, options)).then(resolve, settleFailure);
            } else if (Visuals && typeof Visuals.applyStoneVisualState === 'function') {
              Visuals.applyStoneVisualState(disc, options);
              resolve();
            } else {
              const fallback = readGlobal('applyStoneVisualEffect');
              if (typeof fallback === 'function') fallback(disc, event.effectKey, { owner: event.owner });
              resolve();
            }
          } catch (error) {
            phase.cellElements.delete(`${row},${col}`);
            if (retries > 0) {
              this.timer().setTimeout(() => tryApply(retries - 1), 80, this.playbackScope());
            } else {
              settleFailure(error);
            }
          }
        };
        tryApply(5);
      });
    });
  }

  async playProtectionExpire(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    // Preserve the legacy optional hook exactly. Some classic hosts install
    // it; hosts without it intentionally render no separate expiry effect.
    const animate = readGlobal('animateProtectionExpireAt');
    if (typeof animate !== 'function') return;
    try {
      await Promise.resolve(animate(event.row, event.col));
    } catch (error) {
      if (context.strictNetworkPlayback === true) throw error;
    }
  }

  async playLegacyFadeOut(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, (phase) => this.animateLegacyFadeOut(event.row, event.col, event.options, phase));
  }

  async playLegacyStrongWillApply(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, (phase) => this.animateLegacyStrongWillApply(event.row, event.col, phase));
  }

  async playLegacyHyperactiveMove(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, (phase) => new Promise<void>((resolve) => {
      const from: any = event.from;
      const to: any = event.to;
      const opts: any = event.options || {};
      if (!from || !to) return resolve();
      const fromCell = this.getCellEl(from.row, from.col, phase);
      const toCell = this.getCellEl(to.row, to.col, phase);
      if (!fromCell || !toCell) return resolve();

      let fromDisc = fromCell.querySelector('.disc') as HTMLElement | null;
      let sourceCell: HTMLElement = fromCell;
      if (!fromDisc && opts.carryDisc && opts.carryDisc.parentElement) {
        fromDisc = opts.carryDisc as HTMLElement;
        sourceCell = opts.carryDisc.parentElement as HTMLElement;
      }
      if (!fromDisc) {
        const toDisc = toCell.querySelector('.disc') as HTMLElement | null;
        if (!toDisc) return resolve();
        fromDisc = toDisc;
        sourceCell = toCell;
      }
      fromDisc.classList.remove('destroy-fade', 'shatter');

      if (this.isNoAnim()) {
        try {
          if (fromDisc.parentElement === fromCell) fromCell.removeChild(fromDisc);
          toCell.appendChild(fromDisc);
        } catch (_error) { /* preserve final frame sync fallback */ }
        return resolve();
      }

      const documentRef = this.documentRef;
      const board = this.boardElement;
      const fxLayer = documentRef && (documentRef.getElementById('card-fx-layer') || board);
      const fromRect = this.getCellClientRect(from.row, from.col, phase);
      const toRect = this.getCellClientRect(to.row, to.col, phase);
      const fxRawRect = fxLayer && typeof fxLayer.getBoundingClientRect === 'function'
        ? fxLayer.getBoundingClientRect()
        : null;
      if (!fxLayer || !fromRect || !toRect || !fxRawRect) return resolve();
      const fxLeft = Math.round(Number(fxRawRect.left) || 0);
      const fxTop = Math.round(Number(fxRawRect.top) || 0);

      let discWidth = 0;
      let discHeight = 0;
      let discInsetX = NaN;
      let discInsetY = NaN;
      try {
        const windowRef = documentRef && documentRef.defaultView;
        const boardStyle = windowRef && board && typeof windowRef.getComputedStyle === 'function'
          ? windowRef.getComputedStyle(board)
          : null;
        const cssDiscSize = Number.parseFloat(boardStyle && boardStyle.getPropertyValue('--board-disc-size-px') || '');
        const cssDiscInset = Number.parseFloat(boardStyle && boardStyle.getPropertyValue('--board-disc-inset-px') || '');
        if (Number.isFinite(cssDiscSize) && cssDiscSize > 0) {
          discWidth = cssDiscSize;
          discHeight = cssDiscSize;
        }
        if (Number.isFinite(cssDiscInset) && cssDiscInset >= 0) {
          discInsetX = cssDiscInset;
          discInsetY = cssDiscInset;
        }
      } catch (_error) { /* use the legacy percentage fallback below */ }
      if (!(discWidth > 0)) discWidth = fromRect.width * 0.82;
      if (!(discHeight > 0)) discHeight = fromRect.height * 0.82;
      if (!Number.isFinite(discInsetX)) discInsetX = Math.max(0, (fromRect.width - discWidth) / 2);
      if (!Number.isFinite(discInsetY)) discInsetY = Math.max(0, (fromRect.height - discHeight) / 2);

      const startX = Math.round((fromRect.left - fxLeft) + discInsetX);
      const startY = Math.round((fromRect.top - fxTop) + discInsetY);
      const endX = Math.round((toRect.left - fxLeft) + discInsetX);
      const endY = Math.round((toRect.top - fxTop) + discInsetY);
      const ghostWidth = Math.max(1, Math.round(discWidth));
      const ghostHeight = Math.max(1, Math.round(discHeight));
      const animationConstants = readGlobal('AnimationConstants');
      const durationMs = Math.max(1, Math.round(
        animationConstants && Number.isFinite(Number(animationConstants.MOVE_MS))
          ? Number(animationConstants.MOVE_MS)
          : (Number(MOVE_MS) || 400)
      ));

      const ghost = fromDisc.cloneNode(true) as HTMLElement;
      ghost.classList.remove('destroy-fade', 'shatter');
      ghost.classList.add('hyperactive-move-ghost');
      ghost.style.position = 'absolute';
      ghost.style.left = `${startX}px`;
      ghost.style.top = `${startY}px`;
      ghost.style.width = `${ghostWidth}px`;
      ghost.style.height = `${ghostHeight}px`;
      ghost.style.pointerEvents = 'none';
      ghost.style.transform = 'none';
      ghost.style.transition = 'none';
      fromDisc.style.visibility = 'hidden';
      fxLayer.appendChild(ghost);

      let finished = false;
      let timeoutId: any = null;
      let transitionKickoffId: any = null;
      const timer = this.timer();
      const windowRef = documentRef && documentRef.defaultView;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (timeoutId !== null) {
          timer.clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (transitionKickoffId !== null && windowRef && typeof windowRef.cancelAnimationFrame === 'function') {
          try { windowRef.cancelAnimationFrame(transitionKickoffId); } catch (_error) { /* compatibility */ }
          transitionKickoffId = null;
        }
        try { ghost.removeEventListener('transitionend', handleTransitionEnd); } catch (_error) { /* compatibility */ }
        if (ghost.parentElement) ghost.parentElement.removeChild(ghost);
        try {
          const existing = toCell.querySelector('.disc');
          if (existing && existing !== fromDisc) existing.remove();
          fromDisc.style.visibility = '';
          if (sourceCell === fromCell && fromDisc.parentElement === fromCell) fromCell.removeChild(fromDisc);
          toCell.appendChild(fromDisc);
        } catch (_error) { /* final board frame owns recovery */ }
        resolve();
      };
      const handleTransitionEnd = (transitionEvent: Event) => {
        if (!transitionEvent || transitionEvent.target !== ghost) return;
        const propertyName = String((transitionEvent as TransitionEvent).propertyName || '');
        if (propertyName && propertyName !== 'left' && propertyName !== 'top') return;
        finish();
      };
      const startTransition = () => {
        if (finished) return;
        ghost.style.transition = `left ${durationMs}ms cubic-bezier(0.2, 0.85, 0.3, 1), top ${durationMs}ms cubic-bezier(0.2, 0.85, 0.3, 1)`;
        ghost.style.left = `${endX}px`;
        ghost.style.top = `${endY}px`;
      };
      ghost.addEventListener('transitionend', handleTransitionEnd);
      try {
        if (windowRef && typeof windowRef.requestAnimationFrame === 'function') {
          transitionKickoffId = windowRef.requestAnimationFrame(startTransition);
        } else {
          timer.setTimeout(startTransition, 0, this.playbackScope());
        }
      } catch (_error) {
        timer.setTimeout(startTransition, 0, this.playbackScope());
      }
      timeoutId = timer.setTimeout(finish, durationMs + 220, this.playbackScope());
    }));
  }

  async playLegacySacrificeAbsorbPulse(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, async (phase) => {
      const row = Number(event.row);
      const col = Number(event.col);
      if (!Number.isInteger(row) || !Number.isInteger(col) || this.isNoAnim()) return;
      const cell = this.getCellEl(row, col, phase);
      if (!cell) return;
      const durationMs = Number.isFinite(Number(event.durationMs))
        ? Math.max(0, Math.round(Number(event.durationMs)))
        : SACRIFICE_ABSORB_MS;
      if (typeof cell.animate !== 'function') {
        await this.sleep(durationMs + 40);
        return;
      }
      const animation = cell.animate([
        { filter: 'none' },
        { filter: 'drop-shadow(0 0 16px rgba(255, 55, 55, 0.88)) brightness(1.12)' },
        { filter: 'none' }
      ], {
        duration: durationMs,
        easing: 'ease-out',
        fill: 'none'
      });
      await this.waitForAnimationFinish(animation, durationMs, 140);
    });
  }

  async playObserverBubble(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, async (phase) => {
      if (!AnimationFeedbackEvents || typeof AnimationFeedbackEvents.handleObserverBubbleEvent !== 'function') throw new Error('DOM observer event module unavailable');
      await AnimationFeedbackEvents.handleObserverBubbleEvent(event, {
        isNoAnim: () => this.isNoAnim(),
        observerBubbleMs: OBSERVER_BUBBLE_MS,
        observerBubbleFadeMs: OBSERVER_BUBBLE_FADE_MS,
        getCellClientRect: (row: unknown, col: unknown) => this.getCellClientRect(row, col, phase)
      });
    });
  }

  async playTheoryIncarnationRoulette(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, async (phase) => {
      if (!AnimationTheoryEvents || typeof AnimationTheoryEvents.handleTheoryIncarnationSpawnRouletteEvent !== 'function') throw new Error('DOM theory event module unavailable');
      await AnimationTheoryEvents.handleTheoryIncarnationSpawnRouletteEvent(event, {
        isNoAnim: () => this.isNoAnim(),
        getCellEl: (row: unknown, col: unknown) => this.getCellEl(row, col, phase),
        createDisc: (state: any) => this.createDisc(state),
        waitForOpacityTransition: (element: HTMLElement, duration: unknown, padding: unknown, starter: () => void, cleanup: () => void) => this.waitForOpacityTransition(element, duration, padding, starter, cleanup),
        timer: () => this.timer(),
        playbackScope: this.playbackScope(),
        defaultDurationMs: THEORY_SPAWN_ROULETTE_MS,
        defaultMaterializeMs: THEORY_SPAWN_MATERIALIZE_MS
      });
    });
  }

  private syncManifestEndingTarget(target: any, phase: DomPhaseRuntimeContext): void {
    if (!target) return;
    const row = Number.isInteger(target.r) ? target.r : target.row;
    const col = Number.isInteger(target.col) ? target.col : target.c;
    const cell = this.getCellEl(row, col, phase);
    const disc = cell ? cell.querySelector('.disc') as HTMLElement | null : null;
    if (!disc) return;
    const after = target.after && typeof target.after === 'object' ? { ...target.after } : {};
    delete after.manifestAura;
    if (after.color !== 1 && after.color !== -1) after.color = disc.classList.contains('white') ? -1 : 1;
    after.special = null;
    after.timer = null;
    this.syncDiscVisual(disc, after);
  }

  async playManifestEndingBoard(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    await this.runInPhase([event], context, async (phase) => {
      for (const target of Array.isArray(event.targets) ? event.targets : []) this.syncManifestEndingTarget(target, phase);
    });
  }

  async playCompatibilityFinalState(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> {
    const source = event && event.sourceEvent && typeof event.sourceEvent === 'object'
      ? event.sourceEvent as PresentationPlaybackEvent
      : event;
    await this.runInPhase([source], context, async (phase) => {
      for (const rawTarget of Array.isArray(source.targets) ? source.targets : []) {
        const target: any = rawTarget;
        const state = target.after || { color: 0, special: null, timer: null };
        const cell = this.getCellEl(target.r, target.col, phase);
        if (!cell) continue;
        if (state.color === 0) {
          cell.innerHTML = '';
          continue;
        }
        let disc = cell.querySelector('.disc') as HTMLElement | null;
        if (!disc) {
          disc = this.createDisc(state);
          cell.appendChild(disc);
        }
        this.syncDiscVisual(disc, state);
      }
    });
  }
}

export function createDomBoardPlaybackHandlers(
  options: DomBoardPlaybackRuntimeOptions = {}
): DomBoardPlaybackRuntimeHandlers {
  const runtime = new DomBoardPlaybackRuntime(options);
  return Object.freeze({
    beginPhase: (events: readonly PresentationPlaybackEvent[], context: BoardPlaybackContext) => runtime.beginPhase(events, context),
    endPhase: (context: BoardPlaybackContext) => runtime.endPhase(context),
    destroy: () => runtime.destroy(),
    playPlace: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playPlace(event, context),
    playFlipBatch: (events: readonly PresentationPlaybackEvent[], context: BoardPlaybackContext) => runtime.playFlipBatch(events, context),
    playDestroy: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playDestroy(event, context),
    playSpawn: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playSpawn(event, context),
    playMove: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playMove(event, context),
    playStatusChange: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playStatusChange(event, context),
    playCrossfadeStone: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playCrossfadeStone(event, context),
    playProtectionExpire: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playProtectionExpire(event, context),
    playLegacyFadeOut: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playLegacyFadeOut(event, context),
    playLegacyStrongWillApply: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playLegacyStrongWillApply(event, context),
    playLegacyHyperactiveMove: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playLegacyHyperactiveMove(event, context),
    playLegacySacrificeAbsorbPulse: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playLegacySacrificeAbsorbPulse(event, context),
    playObserverBubble: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playObserverBubble(event, context),
    playTheoryIncarnationRoulette: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playTheoryIncarnationRoulette(event, context),
    playManifestEndingBoard: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playManifestEndingBoard(event, context),
    playCompatibilityFinalState: (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => runtime.playCompatibilityFinalState(event, context)
  });
}
