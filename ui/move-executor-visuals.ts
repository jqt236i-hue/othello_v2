'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let AnimationShared: any = (typeof _require === 'function') ? _require('./animation-helpers') : (typeof window !== 'undefined' ? (window as any).AnimationHelpers : null);
let PlaybackStateModule: any = (typeof _require === 'function') ? (function () {
  try { return _require('./playback-state-manager'); } catch (e) { return (typeof window !== 'undefined' ? (window as any).PlaybackStateManager : null); }
}()) : (typeof window !== 'undefined' ? (window as any).PlaybackStateManager : null);
let AnimationUtilsModule: any = (typeof _require === 'function') ? (function () {
  try { return _require('./animation-utils'); } catch (e) { return (typeof window !== 'undefined' ? window : null); }
}()) : (typeof window !== 'undefined' ? window : null);

function _isPlaybackActiveForLegacyVisuals(): boolean {
  if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackActive === 'function') {
    return PlaybackStateModule.getPlaybackActive() === true;
  }
  return false;
}

function _assertNotDuringPlayback(): boolean {
  if (_isPlaybackActiveForLegacyVisuals()) {
    if (typeof window !== 'undefined' && (window as any).__DEV__ === true) {
      throw new Error('Legacy visual helper called during active VisualPlayback (dev fail-fast)');
    } else {
      console.error('Legacy visual helper called during active VisualPlayback. Aborting playback and syncing final state (prod fallback)');
      if (typeof window !== 'undefined') { (window as any).__telemetry__ = (window as any).__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; (window as any).__telemetry__.singleVisualWriterHits = ((window as any).__telemetry__.singleVisualWriterHits || 0) + 1; }
      if (typeof (AnimationEngine as any) !== 'undefined' && (AnimationEngine as any) && typeof (AnimationEngine as any).abortAndSync === 'function') {
        (AnimationEngine as any).abortAndSync();
      }
      return false;
    }
  }
  return true;
}

let _isNoAnim = (typeof AnimationShared !== 'undefined' && AnimationShared && AnimationShared.isNoAnim) ? AnimationShared.isNoAnim : function () {
  try {
    if (typeof window !== 'undefined' && (window as any).DISABLE_ANIMATIONS === true) return true;
    if (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)) return true;
    if (typeof process !== 'undefined' && (process.env.NOANIM === '1' || process.env.NOANIM === 'true' || process.env.DISABLE_ANIMATIONS === '1')) return true;
  } catch (e) { }
  return false;
};

function applyFlipAnimations(flipsToAnimate: any[]): void {
  if (!_assertNotDuringPlayback()) return;
  requestAnimationFrame(() => {
    flipsToAnimate.forEach(([r, c]: [number, number]) => {
      const cell = (boardEl as any).querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      const disc = cell ? cell.querySelector('.disc') : null;
      if (disc) {
        if (typeof AnimationShared !== 'undefined' && AnimationShared && AnimationShared.removeFlip) {
          AnimationShared.removeFlip(disc);
        } else {
          (disc as HTMLElement).classList.remove('flip');
        }
        void (disc as HTMLElement).offsetWidth;
        console.log(`Suppressed flip animation for (${r},${c})`);
      }
    });
  });
}

const StoneVisuals = (typeof _require === 'function') ? _require('./stone-visuals') : (typeof window !== 'undefined' ? (window as any).StoneVisuals : null);

function setDiscColorAt(row: number, col: number, color: number): void {
  if (!_assertNotDuringPlayback()) return;
  if (StoneVisuals && typeof StoneVisuals.setDiscColorAt === 'function') return StoneVisuals.setDiscColorAt(row, col, color);
  const cell = (boardEl as any).querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  const disc = cell ? cell.querySelector('.disc') : null;
  if (!disc) return;
  (disc as HTMLElement).classList.remove('black', 'white');
  (disc as HTMLElement).classList.add(color === BLACK ? 'black' : 'white');
  if (typeof window !== 'undefined' && typeof (window as any).setDiscStoneImage === 'function') {
    (window as any).setDiscStoneImage(disc, color);
  }
}

function removeBombOverlayAt(row: number, col: number): void {
  if (!_assertNotDuringPlayback()) return;
  if (StoneVisuals && typeof StoneVisuals.removeBombOverlayAt === 'function') return StoneVisuals.removeBombOverlayAt(row, col);
  const cell = (boardEl as any).querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  const disc = cell ? cell.querySelector('.disc') : null;
  if (!disc) return;
  (disc as HTMLElement).classList.remove('bomb', 'bomb-black', 'bomb-white');
  const timer = disc.querySelector('.bomb-timer');
  if (timer) timer.remove();
  const icon = disc.querySelector('.bomb-icon');
  if (icon) icon.remove();
}

function clearAllStoneVisualEffectsAt(row: number, col: number): void {
  if (!_assertNotDuringPlayback()) return;
  if (StoneVisuals && typeof StoneVisuals.clearAllStoneVisualEffectsAt === 'function') return StoneVisuals.clearAllStoneVisualEffectsAt(row, col);
  const cell = (boardEl as any).querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  const disc = cell ? cell.querySelector('.disc') : null;
  if (!disc) return;

  (disc as HTMLElement).classList.remove('special-stone', 'ud-black', 'ud-white', 'breeding-black', 'breeding-white');
  delete (disc as HTMLElement).dataset.ud;
  delete (disc as HTMLElement).dataset.breeding;

  try {
    if (typeof (STONE_VISUAL_EFFECTS as any) !== 'undefined' && (STONE_VISUAL_EFFECTS as any)) {
      for (const k of Object.keys((STONE_VISUAL_EFFECTS as any))) {
        const eff = (STONE_VISUAL_EFFECTS as any)[k];
        if (eff && eff.cssClass) (disc as HTMLElement).classList.remove(eff.cssClass);
      }
    }
  } catch (e) {
    // visuals only
  }

  (disc as HTMLElement).style.removeProperty('--special-stone-image');
  (disc as HTMLElement).style.removeProperty('--disc-overlay-image');
  (disc as HTMLElement).style.removeProperty('--disc-overlay-scale');
  (disc as HTMLElement).style.removeProperty('--dragon-image-path');
  (disc as HTMLElement).style.removeProperty('--breeding-image-path');
  if (typeof window !== 'undefined' && typeof (window as any).setDiscStoneImage === 'function') {
    (window as any).setDiscStoneImage(disc, (disc as HTMLElement).classList.contains('white') ? WHITE : BLACK);
  }
}

function syncDiscVisualToCurrentState(row: number, col: number): void {
  if (!_assertNotDuringPlayback()) return;
  if (StoneVisuals && typeof StoneVisuals.syncDiscVisualToCurrentState === 'function') return StoneVisuals.syncDiscVisualToCurrentState(row, col);
  const cell = (boardEl as any).querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  const disc = cell ? cell.querySelector('.disc') : null;
  if (!disc) return;

  const markerKinds = (typeof (MarkersAdapter as any) !== 'undefined' && (MarkersAdapter as any) && (MarkersAdapter as any).MARKER_KINDS)
    ? (MarkersAdapter as any).MARKER_KINDS
    : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
  const isBombCategoryMarker = (marker: any) => {
    if (!marker || typeof marker !== 'object') return false;
    if (typeof (MarkersAdapter as any) !== 'undefined' && (MarkersAdapter as any) && typeof (MarkersAdapter as any).isBombCategoryMarker === 'function') {
      return (MarkersAdapter as any).isBombCategoryMarker(marker);
    }
    const data = (marker.data && typeof marker.data === 'object') ? marker.data : null;
    const category = String(data && data.category ? data.category : '').trim().toLowerCase();
    const type = String(data && data.type ? data.type : '').trim().toUpperCase();
    return marker.kind === 'bomb' || category === 'bomb' || type === 'TIME_BOMB';
  };
  let bomb: any = null;
  if ((cardState as any) && Array.isArray((cardState as any).markers)) {
    bomb = (
      typeof (MarkersAdapter as any) !== 'undefined'
      && (MarkersAdapter as any)
      && typeof (MarkersAdapter as any).findBombMarkerAt === 'function'
    )
      ? (MarkersAdapter as any).findBombMarkerAt(cardState, row, col)
      : ((cardState as any).markers.find((m: any) => isBombCategoryMarker(m) && m.row === row && m.col === col) || null);
    if (bomb && bomb.data) {
      bomb = { row, col, remainingTurns: bomb.data.remainingTurns, owner: bomb.owner };
    }
  }
  if (!bomb) {
    removeBombOverlayAt(row, col);
  } else {
    const bombOwner = (bomb.owner === 'black' || bomb.owner === BLACK || bomb.owner === 1) ? BLACK : WHITE;
    (disc as HTMLElement).classList.add('bomb', 'special-stone', bombOwner === BLACK ? 'bomb-black' : 'bomb-white');
    if (!disc.querySelector('.bomb-timer')) {
      const timeLabel = document.createElement('div');
      timeLabel.className = 'bomb-timer';
      timeLabel.textContent = bomb.remainingTurns;
      disc.appendChild(timeLabel);
    } else {
      try {
        (disc.querySelector('.bomb-timer') as HTMLElement).textContent = bomb.remainingTurns;
      } catch (e) { /* ignore */ }
    }
  }

  clearAllStoneVisualEffectsAt(row, col);

  let special: any = null;
  if ((cardState as any) && Array.isArray((cardState as any).markers)) {
    const s = (cardState as any).markers.find((m: any) => (
      m.kind === markerKinds.SPECIAL_STONE
      && !isBombCategoryMarker(m)
      && m.row === row
      && m.col === col
    )) || null;
    if (s && s.data) {
      special = { row, col, type: s.data.type, owner: s.owner, remainingOwnerTurns: s.data.remainingOwnerTurns, regenRemaining: s.data.regenRemaining };
    }
  }
  if (!special) return;

  const ownerVal = (special.owner === 'black') ? BLACK : (special.owner === 'white') ? WHITE : (Number.isFinite(special.owner) ? special.owner : null);
  const effectKey = (typeof (getEffectKeyForSpecialType as any) === 'function') ? (getEffectKeyForSpecialType as any)(special.type) : null;
  if (effectKey && typeof (applyStoneVisualEffect as any) === 'function') {
    if (special.type === 'REGEN' && (special.regenRemaining || 0) <= 0) {
      return;
    }
    (applyStoneVisualEffect as any)(disc, effectKey, { owner: ownerVal });
  }
}

const TIME_BOMB_TURNS = (typeof (CardLogic as any) !== 'undefined' && Number.isFinite((CardLogic as any).TIME_BOMB_TURNS))
  ? (CardLogic as any).TIME_BOMB_TURNS
  : 3;

function getFlipAnimMs(): number {
  return (typeof FLIP_ANIMATION_DURATION_MS !== 'undefined' && Number.isFinite(FLIP_ANIMATION_DURATION_MS))
    ? FLIP_ANIMATION_DURATION_MS
    : 600;
}

function getPhaseGapMs(): number {
  return (typeof PHASE_GAP_MS !== 'undefined' && Number.isFinite(PHASE_GAP_MS))
    ? PHASE_GAP_MS
    : 200;
}

function getTurnTransitionGapMs(): number {
  return (typeof TURN_TRANSITION_GAP_MS !== 'undefined' && Number.isFinite(TURN_TRANSITION_GAP_MS))
    ? TURN_TRANSITION_GAP_MS
    : getPhaseGapMs();
}

async function animateFlipsWithDeferredColor(flips: any[], fromColor: number, toColor: number, options?: any): Promise<void> {
  if (!_assertNotDuringPlayback()) return;
  if (!flips || flips.length === 0) return;
  const opts = arguments[3] && typeof arguments[3] === 'object' ? arguments[3] : {};
  const skipVisualSync = opts.skipVisualSync || null;
  const applyColorAfterFlip = !!opts.applyColorAfterFlip;
  const delay = getFlipAnimMs();

  const discsToAnimate: any[] = [];

  if (applyColorAfterFlip) {
    for (const [r, c] of flips) {
      setDiscColorAt(r, c, fromColor);
      if (!skipVisualSync || !skipVisualSync.has(`${r},${c}`)) {
        syncDiscVisualToCurrentState(r, c);
      }
      const cell = (boardEl as any).querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      const disc = cell ? cell.querySelector('.disc') : null;
      if (!disc) continue;
      discsToAnimate.push({ r, c, disc });
    }

    await new Promise(resolve => requestAnimationFrame(() => {
      for (const { r, c, disc } of discsToAnimate) {
        if (typeof AnimationShared !== 'undefined' && AnimationShared && AnimationShared.removeFlip) {
          AnimationShared.removeFlip(disc);
        } else {
          (disc as HTMLElement).classList.remove('flip');
        }
        void (disc as HTMLElement).offsetWidth;
        console.log(`Deferred flip suppressed for (${r},${c}) with color-after option`);
      }
      setTimeout(resolve, delay);
    }));

    for (const [r, c] of flips) {
      setDiscColorAt(r, c, toColor);
      if (!skipVisualSync || !skipVisualSync.has(`${r},${c}`)) {
        syncDiscVisualToCurrentState(r, c);
      }
    }

  } else {
    for (const [r, c] of flips) {
      setDiscColorAt(r, c, toColor);
      if (!skipVisualSync || !skipVisualSync.has(`${r},${c}`)) {
        syncDiscVisualToCurrentState(r, c);
      }

      const cell = (boardEl as any).querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      const disc = cell ? cell.querySelector('.disc') : null;
      if (!disc) continue;
      discsToAnimate.push({ r, c, disc });
    }

    await new Promise(resolve => requestAnimationFrame(() => {
      for (const { r, c, disc } of discsToAnimate) {
        if (typeof AnimationShared !== 'undefined' && AnimationShared && AnimationShared.removeFlip) {
          AnimationShared.removeFlip(disc);
        } else {
          (disc as HTMLElement).classList.remove('flip');
        }
        void (disc as HTMLElement).offsetWidth;
        console.log(`Deferred flip suppressed for (${r},${c})`);
      }
      setTimeout(resolve, delay);
    }));
  }
}

async function animateRegenBack(regenedPositions: any[], flipperColor: number): Promise<void> {
  if (!_assertNotDuringPlayback()) return;
  if (!regenedPositions || regenedPositions.length === 0) return;

  const ownerColor = -flipperColor;
  const durationMs = 600;

  for (const { row, col } of regenedPositions) {
    const cell = (boardEl as any).querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc) continue;

    setDiscColorAt(row, col, ownerColor);

    await (crossfadeStoneVisual as any)(disc, {
      effectKey: 'regenStone',
      owner: ownerColor,
      durationMs,
      autoFadeOut: true
    });
  }
}

function applyPendingSpecialstoneVisual(move: any, pendingType: string): void {
  if (!_assertNotDuringPlayback()) return;
  if (!pendingType) return;

  const placedCell = (boardEl as any).querySelector(`.cell[data-row="${move.row}"][data-col="${move.col}"]`);
  const disc = placedCell ? placedCell.querySelector('.disc') : null;
  if (!disc) return;

  if (pendingType === 'TIME_BOMB') {
    const ownerClass = move.player === BLACK ? 'bomb-black' : 'bomb-white';
    (disc as HTMLElement).classList.add('bomb', 'special-stone', ownerClass);
    if (!disc.querySelector('.bomb-timer')) {
      const timeLabel = document.createElement('div');
      timeLabel.className = 'bomb-timer';
      timeLabel.textContent = TIME_BOMB_TURNS;
      disc.appendChild(timeLabel);
    }
  }

  const effectKey = (typeof (getEffectKeyForPendingType as any) === 'function')
    ? (getEffectKeyForPendingType as any)(pendingType)
    : null;
  if (effectKey && typeof (applyStoneVisualEffect as any) === 'function') {
    (applyStoneVisualEffect as any)(disc, effectKey, { owner: move.player });
  }
}

function waitForPlaybackIdle(): Promise<void> {
  return new Promise(resolve => {
    try {
      if (typeof window === 'undefined') return resolve();

      const startDeadline = Date.now() + 250;

      const tick = () => {
        try {
          if (_isPlaybackActiveForLegacyVisuals()) {
            const waitEnd = () => {
              if (!_isPlaybackActiveForLegacyVisuals()) return resolve();
              try { requestAnimationFrame(waitEnd); } catch (e) { setTimeout(waitEnd, 16); }
            };
            return waitEnd();
          }

          if (Date.now() > startDeadline) return resolve();
          try { requestAnimationFrame(tick); } catch (e) { setTimeout(tick, 16); }
        } catch (e) {
          resolve();
        }
      };

      try { requestAnimationFrame(tick); } catch (e) { setTimeout(tick, 0); }
    } catch (e) {
      resolve();
    }
  });
}

async function animateHyperactiveMoveChain(moves: any[]): Promise<void> {
  const animateMove = (AnimationUtilsModule && typeof AnimationUtilsModule.animateHyperactiveMove === 'function')
    ? AnimationUtilsModule.animateHyperactiveMove
    : (typeof (animateHyperactiveMove as any) === 'function' ? animateHyperactiveMove : null);
  const path = Array.isArray(moves) ? moves.filter((move: any) => !!(move && move.from && move.to)) : [];
  if (!animateMove || path.length === 0) return;

  let carryDisc: any = null;
  if (path.length > 1 && typeof (boardEl as any) !== 'undefined' && boardEl && typeof (boardEl as any).querySelector === 'function') {
    const lastMove = path[path.length - 1];
    const lastToCell = (boardEl as any).querySelector(`.cell[data-row="${lastMove.to.row}"][data-col="${lastMove.to.col}"]`);
    const lastToDisc = lastToCell ? lastToCell.querySelector('.disc') : null;
    if (lastToDisc) {
      carryDisc = lastToDisc;
    }
  }

  for (const move of path) {
    if (carryDisc) {
      await animateMove(move.from, move.to, { carryDisc });
    } else {
      await animateMove(move.from, move.to);
    }
  }
}

function hasPlaybackEngine(): boolean {
  const engine = (typeof (PlaybackEngine as any) !== 'undefined' && (PlaybackEngine as any))
    ? (PlaybackEngine as any)
    : ((typeof window !== 'undefined' && (window as any).PlaybackEngine) ? (window as any).PlaybackEngine : null);
  return !!(engine && typeof engine.playPresentationEvents === 'function');
}

async function runMoveVisualSequence(move: any, hadSelection: boolean, phases: any, effects: any, immediate: any): Promise<void> {
  if (!_assertNotDuringPlayback()) return;
  if (typeof window !== 'undefined') {
    if ((window as any).__moveVisualSequenceActive) {
      console.warn('[Visuals] Reentrant runMoveVisualSequence detected - ignoring to avoid recursion');
      return;
    }
    (window as any).__moveVisualSequenceActive = true;
  }
  try {
    const primaryFlips = phases.primaryFlips || [];
    const chainFlips = phases.chainFlips || [];
    const regenCaptureFlips = phases.regenCaptureFlips || [];
    const regened = phases.regened || [];

    const totalFlipCount = primaryFlips.length + chainFlips.length + regenCaptureFlips.length;
    const movedPlayer = getPlayerName(move.player);

    if (typeof (logPlacementEffects as any) === 'function') {
      (logPlacementEffects as any)(effects, move.player);
    }

    addLog(LOG_MESSAGES.placedWithFlips(movedPlayer, posToNotation(move.row, move.col), totalFlipCount));
    if (regened.length > 0) addLog(LOG_MESSAGES.regenTriggered(regened.length));
    if (regenCaptureFlips.length > 0) addLog(LOG_MESSAGES.regenCapture(regenCaptureFlips.length));

    if (typeof (resetRenderStats as any) === 'function') (resetRenderStats as any)();

    if (typeof (BoardUpdateDispatch as any) !== 'undefined' && (BoardUpdateDispatch as any) && typeof (BoardUpdateDispatch as any).requestBoardUpdate === 'function') {
      (BoardUpdateDispatch as any).requestBoardUpdate();
    } else {
      emitBoardUpdate();
    }
    if (hadSelection && typeof (emitCardStateChange as any) === 'function') (emitCardStateChange as any)();

    try {
      if (effects && effects.workPlaced) {
        console.log('[Visuals] workPlaced detected — syncing visuals for placed cell', move.row, move.col);
        syncDiscVisualToCurrentState(move.row, move.col);
        if (typeof (ensureWorkVisualsApplied as any) === 'function') (ensureWorkVisualsApplied as any)();
      }

      if (effects && effects.hyperactivePlaced) {
        const hasImmediateHyperactiveMove = !!(
          immediate &&
          Array.isArray(immediate.hyperactiveMoved) &&
          immediate.hyperactiveMoved.length > 0
        );
        if (hasImmediateHyperactiveMove) {
          console.log('[Visuals] hyperactivePlaced with immediate move detected — syncing placed cell before movement', move.row, move.col);
          syncDiscVisualToCurrentState(move.row, move.col);
        } else {
          console.log('[Visuals] hyperactivePlaced detected — relying on diff-renderer visuals');
        }
      }
    } catch (e) {
      /* defensive */
    }

    if (chainFlips.length > 0) {
      for (const [r, c] of chainFlips) setDiscColorAt(r, c, -move.player);
    }
    if (regenCaptureFlips.length > 0) {
      for (const [r, c] of regenCaptureFlips) setDiscColorAt(r, c, move.player);
    }

    if (primaryFlips.length > 0) {
      await animateFlipsWithDeferredColor(primaryFlips, -move.player, move.player);
    }
    if (chainFlips.length > 0) {
      await animateFlipsWithDeferredColor(chainFlips, -move.player, move.player);
    }
    if (regened.length > 0) {
      for (const p of regened) setDiscColorAt(p.row, p.col, move.player);
      await animateRegenBack(regened, move.player);
    }
    if (regenCaptureFlips.length > 0) {
      await animateFlipsWithDeferredColor(regenCaptureFlips, move.player, -move.player);
    }

    if (immediate.dragonConverted && immediate.dragonConverted.length > 0) {
      const coords = immediate.dragonConverted.map((p: any) => [p.row, p.col]);
      await animateFlipsWithDeferredColor(coords, -move.player, move.player, { applyColorAfterFlip: true });
    }
    if (immediate.breedingSpawned && immediate.breedingSpawned.length > 0) {
      const BREEDING_FADE_MS = 350;
      for (const spawn of immediate.breedingSpawned) {
        const cell = (boardEl as any).querySelector(`.cell[data-row="${spawn.row}"][data-col="${spawn.col}"]`);
        if (cell) {
          let disc = cell.querySelector('.disc');
          if (!disc) {
            disc = document.createElement('div');
            disc.className = 'disc ' + (player === BLACK ? 'black' : 'white');
            cell.appendChild(disc);
          } else {
            try { (disc as HTMLElement).style.opacity = ''; } catch (e) { }
          }

          await new Promise(resolve => setTimeout(resolve, BREEDING_FADE_MS));
        }
      }
    }
    if (immediate.udgDestroyed && immediate.udgDestroyed.length > 0) {
      for (const p of immediate.udgDestroyed) await (animateFadeOutAt as any)(p.row, p.col);
    }
    if (immediate.hyperactiveMoved && immediate.hyperactiveMoved.length > 0) {
      for (const m of immediate.hyperactiveMoved) {
        if (typeof (animateHyperactiveMove as any) === 'function') await (animateHyperactiveMove as any)(m.from, m.to);
      }
    }

    emitGameStateChange();
  } finally {
    if (typeof window !== 'undefined') (window as any).__moveVisualSequenceActive = false;
  }
}

if (typeof window !== 'undefined') {
  (window as any).applyFlipAnimations = applyFlipAnimations;
  (window as any).setDiscColorAt = setDiscColorAt;
  (window as any).removeBombOverlayAt = removeBombOverlayAt;
  (window as any).clearAllStoneVisualEffectsAt = clearAllStoneVisualEffectsAt;
  (window as any).syncDiscVisualToCurrentState = syncDiscVisualToCurrentState;
  (window as any).getFlipAnimMs = getFlipAnimMs;
  (window as any).getPhaseGapMs = getPhaseGapMs;
  (window as any).getTurnTransitionGapMs = getTurnTransitionGapMs;
  (window as any).animateFlipsWithDeferredColor = animateFlipsWithDeferredColor;
  (window as any).animateRegenBack = animateRegenBack;
  (window as any).applyPendingSpecialstoneVisual = applyPendingSpecialstoneVisual;
  (window as any).waitForPlaybackIdle = waitForPlaybackIdle;
  if (typeof (window as any).runMoveVisualSequence !== 'function') (window as any).runMoveVisualSequence = runMoveVisualSequence;
}

try {
  const gameVisuals = _require('../game/move-executor-visuals');
  if (gameVisuals && typeof gameVisuals.setUIImpl === 'function') {
    gameVisuals.setUIImpl({
      applyFlipAnimations,
      setDiscColorAt,
      removeBombOverlayAt,
      clearAllStoneVisualEffectsAt,
      syncDiscVisualToCurrentState,
      getFlipAnimMs,
      getPhaseGapMs,
      getTurnTransitionGapMs,
      animateFlipsWithDeferredColor,
      animateRegenBack,
      animateFadeOutAt: AnimationUtilsModule && typeof AnimationUtilsModule.animateFadeOutAt === 'function'
        ? AnimationUtilsModule.animateFadeOutAt
        : undefined,
      animateDestroyAt: AnimationUtilsModule && typeof AnimationUtilsModule.animateDestroyAt === 'function'
        ? AnimationUtilsModule.animateDestroyAt
        : undefined,
      animateHyperactiveMove: AnimationUtilsModule && typeof AnimationUtilsModule.animateHyperactiveMove === 'function'
        ? AnimationUtilsModule.animateHyperactiveMove
        : undefined,
      animateHyperactiveMoveChain,
      hasPlaybackEngine,
      applyPendingSpecialstoneVisual,
      waitForPlayback: waitForPlaybackIdle,
      runMoveVisualSequence
    });
  }
} catch (e) { /* not available in some environments */ }

const MoveExecutorVisualsModule = {
  applyFlipAnimations,
  setDiscColorAt,
  removeBombOverlayAt,
  clearAllStoneVisualEffectsAt,
  syncDiscVisualToCurrentState,
  getFlipAnimMs,
  getPhaseGapMs,
  getTurnTransitionGapMs,
  animateFlipsWithDeferredColor,
  animateRegenBack,
  animateFadeOutAt: AnimationUtilsModule && typeof AnimationUtilsModule.animateFadeOutAt === 'function'
    ? AnimationUtilsModule.animateFadeOutAt
    : (typeof (animateFadeOutAt as any) === 'function' ? animateFadeOutAt : undefined),
  animateDestroyAt: AnimationUtilsModule && typeof AnimationUtilsModule.animateDestroyAt === 'function'
    ? AnimationUtilsModule.animateDestroyAt
    : (typeof (animateDestroyAt as any) === 'function' ? animateDestroyAt : undefined),
  animateHyperactiveMove: AnimationUtilsModule && typeof AnimationUtilsModule.animateHyperactiveMove === 'function'
    ? AnimationUtilsModule.animateHyperactiveMove
    : (typeof (animateHyperactiveMove as any) === 'function' ? animateHyperactiveMove : undefined),
  animateHyperactiveMoveChain,
  hasPlaybackEngine,
  applyPendingSpecialstoneVisual,
  waitForPlaybackIdle,
  runMoveVisualSequence
};

export = MoveExecutorVisualsModule;
