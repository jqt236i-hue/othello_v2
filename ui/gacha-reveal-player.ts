'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const DEFAULT_TIMINGS = Object.freeze({
  introMs: 2000,
  heroMs: 280,
  gridMs: 420,
  finishMs: 120
});
const RARITY_REVEAL_EFFECTS = Object.freeze({
  EXR: 'singularity',
  UR: 'cataclysm',
  SSR: 'nova',
  SR: 'prism',
  R: 'slash',
  N: 'subtle'
} as Record<string, string>);

function resolveDocument(rootRef: any): Document | null {
  if (rootRef && rootRef.document) return rootRef.document;
  if (typeof document !== 'undefined') return document;
  return null;
}

function resolveAnimationSharedModule(): any {
  if (typeof _require === 'function') {
    try {
      return _require('./animation-shared');
    } catch (e) { /* ignore */ }
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).AnimationShared) return (globalThis as any).AnimationShared;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaHelpersModule(): any {
  if (typeof _require === 'function') {
    try {
      return _require('../shared/gacha-helpers');
    } catch (e) { /* ignore */ }
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaHelpersModule) return (globalThis as any).GachaHelpersModule;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaRevealStageModule(): any {
  if (typeof _require === 'function') {
    try {
      return _require('./gacha/gacha-reveal-stage');
    } catch (e) { /* ignore */ }
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaRevealStageModule) return (globalThis as any).GachaRevealStageModule;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaRevealAudioModule(): any {
  if (typeof _require === 'function') {
    try {
      return _require('./gacha/gacha-reveal-audio');
    } catch (e) { /* ignore */ }
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaRevealAudioModule) return (globalThis as any).GachaRevealAudioModule;
  } catch (e) { /* ignore */ }
  return null;
}

function prefersReducedMotion(rootRef: any): boolean {
  const win = rootRef || (typeof window !== 'undefined' ? window : null);
  if (!win || typeof win.matchMedia !== 'function') return false;
  try {
    return win.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch (e) {
    return false;
  }
}

function isInstantPlayback(rootRef: any): boolean {
  const animationShared = resolveAnimationSharedModule();
  if (animationShared && typeof animationShared.isNoAnim === 'function' && animationShared.isNoAnim()) {
    return true;
  }
  return prefersReducedMotion(rootRef);
}

function nextFrame(rootRef: any): Promise<void> {
  return new Promise((resolve) => {
    const win = rootRef || (typeof window !== 'undefined' ? window : null);
    if (win && typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 16);
  });
}

function waitForStep(state: any, durationMs: any): Promise<void> {
  const duration = Math.max(0, Math.floor(Number(durationMs) || 0));
  if (duration <= 0 || state.skipRequested === true || state.isActive !== true) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const startedAt = Date.now();
    (function tick() {
      if (state.skipRequested === true || state.isActive !== true) {
        resolve();
        return;
      }
      if ((Date.now() - startedAt) >= duration) {
        resolve();
        return;
      }
      setTimeout(tick, 16);
    }());
  });
}

function describeObservedItem(item: any): string {
  return String(item && item.kind || '').trim().toLowerCase() === 'placement_sound'
    ? '配置音を観測しました'
    : '手の見た目を観測しました';
}

function waitForDismiss(state: any): Promise<void> {
  if (state.isActive !== true) return Promise.resolve();

  return new Promise((resolve) => {
    (function tick() {
      if (state.dismissRequested === true || state.isActive !== true) {
        resolve();
        return;
      }
      setTimeout(tick, 16);
    }());
  });
}

function resolveRarityRank(rarity: any, helpersModule: any): number {
  const normalized = helpersModule && typeof helpersModule.normalizeRarity === 'function'
    ? helpersModule.normalizeRarity(rarity)
    : String(rarity || '').trim().toUpperCase();
  const configured = Array.isArray(helpersModule && helpersModule.CONFIGURED_RARITIES)
    ? helpersModule.CONFIGURED_RARITIES
    : ['EXR', 'UR', 'SSR', 'SR', 'R', 'N'];
  const rank = configured.indexOf(normalized);
  return rank >= 0 ? rank : configured.length;
}

function resolveSpotlightPull(pulls: any[], helpersModule: any): any {
  const safePulls = Array.isArray(pulls) ? pulls.filter((pull: any) => pull && pull.item) : [];
  if (!safePulls.length) return null;

  return safePulls.reduce((best: any, pull: any) => {
    if (!best) return pull;
    return resolveRarityRank(pull.rarity, helpersModule) < resolveRarityRank(best.rarity, helpersModule)
      ? pull
      : best;
  }, null);
}

function resolveRevealEffectKey(rarity: any, helpersModule: any): string {
  const normalized = helpersModule && typeof helpersModule.normalizeRarity === 'function'
    ? helpersModule.normalizeRarity(rarity)
    : String(rarity || '').trim().toUpperCase();
  return (RARITY_REVEAL_EFFECTS as any)[normalized] || RARITY_REVEAL_EFFECTS.N;
}

function createGachaRevealPlayer(options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
  const docRef = opts.document || resolveDocument(rootRef);
  const overlay = opts.overlay || (docRef ? docRef.getElementById('gachaOverlay') : null);
  const stageModule = opts.stageModule || resolveGachaRevealStageModule();
  const audioModule = opts.audioModule || resolveGachaRevealAudioModule();
  const refs = stageModule && typeof stageModule.ensureGachaRevealStage === 'function'
    ? stageModule.ensureGachaRevealStage(docRef, overlay)
    : null;
  const helpersModule = resolveGachaHelpersModule();
  const timings = Object.assign({}, DEFAULT_TIMINGS, opts.timings || {});
  const audioSession = audioModule && typeof audioModule.createGachaRevealAudioSession === 'function'
    ? audioModule.createGachaRevealAudioSession({
      root: rootRef,
      createAudio: opts.createAudio
    })
    : null;
  const state: { skipRequested: boolean; dismissRequested: boolean; phase: string; isActive: boolean } = {
    skipRequested: false,
    dismissRequested: false,
    phase: 'idle',
    isActive: false
  };

  if (!refs || !refs.stage || !stageModule) return null;

  function requestSkip(): boolean {
    if (state.isActive !== true) return false;
    if (state.phase === 'waiting-dismiss') {
      state.dismissRequested = true;
      return true;
    }
    state.skipRequested = true;
    refs.stage.classList.add('is-skip-requested');
    return true;
  }

  if (!refs.skipBtn.__gachaRevealSkipBound) {
    refs.skipBtn.addEventListener('click', function (event: any) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      requestSkip();
    });
    refs.skipBtn.__gachaRevealSkipBound = true;
  }

  if (!refs.stage.__gachaRevealStageBound) {
    refs.stage.addEventListener('click', function (event: any) {
      if (!event || event.target === refs.skipBtn) return;
      if (state.phase !== 'waiting-dismiss') return;
      state.dismissRequested = true;
    });
    refs.stage.__gachaRevealStageBound = true;
  }

  async function play(transaction?: any): Promise<any> {
    const safeTransaction = (transaction && typeof transaction === 'object') ? transaction : {};
    const pulls = Array.isArray(safeTransaction.pulls) ? safeTransaction.pulls.filter((pull: any) => pull && pull.item) : [];
    const newlyUnlockedIdSet = new Set(Array.isArray(safeTransaction.newlyUnlockedIds) ? safeTransaction.newlyUnlockedIds : []);
    const spotlightPull = resolveSpotlightPull(pulls, helpersModule);
    const highestRarity = spotlightPull && spotlightPull.rarity ? spotlightPull.rarity : 'N';
    const highestRarityId = String(highestRarity || 'N').trim().toLowerCase();
    const revealEffect = resolveRevealEffectKey(highestRarity, helpersModule);
    const isTenPull = pulls.length > 1;

    if (audioSession && typeof audioSession.destroy === 'function') {
      audioSession.destroy();
    }
    stageModule.hideStage(refs.stage);
    refs.grid.innerHTML = '';
    state.skipRequested = false;
    state.dismissRequested = false;
    state.phase = 'animating';
    state.isActive = true;

    refs.stage.setAttribute('data-rarity', highestRarityId);
    refs.stage.setAttribute('data-gacha-rarity', highestRarityId);
    refs.stage.setAttribute('data-reveal-effect', revealEffect);
    refs.stage.classList.remove('is-awaiting-dismiss');
    refs.skipBtn.textContent = 'SKIP';
    refs.headline.textContent = isTenPull ? '大量観測を開始します' : '観測が収束しています';
    refs.subtitle.textContent = isTenPull
      ? 'もっとも強い反応を先に解析します'
      : '強い反応を解析しています';
    stageModule.populateHero(refs, spotlightPull, newlyUnlockedIdSet);
    stageModule.populateGrid(refs, pulls, newlyUnlockedIdSet, spotlightPull);

    if (isInstantPlayback(rootRef)) {
      stageModule.hideStage(refs.stage);
      refs.skipBtn.textContent = 'SKIP';
      state.phase = 'idle';
      state.isActive = false;
      return {
        finishedWith: 'instant',
        highestRarity,
        spotlightPull
      };
    }

    stageModule.resetStageVisualState(refs.stage, isTenPull);
    const revealStartedAt = Date.now();
    refs.stage.classList.add('is-active');
    refs.stage.classList.add('is-charging');
    if (audioSession && typeof audioSession.play === 'function') {
      audioSession.play();
    }
    await nextFrame(rootRef);
    await waitForStep(state, Math.max(0, timings.introMs - (Date.now() - revealStartedAt)));

    if ((state as any).skipRequested !== true) {
      refs.headline.textContent = '観測が収束しました';
      refs.subtitle.textContent = isTenPull
        ? 'もっとも強い反応を観測しました'
        : describeObservedItem(spotlightPull && spotlightPull.item ? spotlightPull.item : null);
      refs.stage.classList.add('is-impact-visible');
      refs.stage.classList.add('is-hero-visible');
      await waitForStep(state, timings.heroMs);
    }

    if ((state as any).skipRequested !== true && isTenPull) {
      refs.stage.classList.add('is-grid-visible');
      await waitForStep(state, timings.gridMs);
    }

    const finishedWith = (state as any).skipRequested === true ? 'skipped' : 'animated';
    if ((state as any).skipRequested !== true) {
      state.phase = 'waiting-dismiss';
      refs.stage.classList.add('is-awaiting-dismiss');
      refs.skipBtn.textContent = '一覧へ';
      refs.subtitle.textContent = 'タップで結果一覧へ';
      await waitForDismiss(state);
    }

    if ((state as any).skipRequested === true) {
      refs.stage.classList.add('is-finishing');
      await waitForStep(state, timings.finishMs);
    }

    if (audioSession && typeof audioSession.destroy === 'function') {
      audioSession.destroy();
    }
    stageModule.hideStage(refs.stage);
    refs.skipBtn.textContent = 'SKIP';
    state.phase = 'idle';
    state.isActive = false;
    return {
      finishedWith,
      highestRarity,
      spotlightPull
    };
  }

  function destroy(): void {
    state.skipRequested = true;
    state.dismissRequested = true;
    state.phase = 'idle';
    state.isActive = false;
    if (audioSession && typeof audioSession.destroy === 'function') {
      audioSession.destroy();
    }
    stageModule.hideStage(refs.stage);
    try {
      if (refs.stage.parentElement) refs.stage.parentElement.removeChild(refs.stage);
    } catch (e) { /* ignore */ }
  }

  return {
    play,
    requestSkip,
    isActive: function () {
      return state.isActive === true;
    },
    destroy
  };
}

const GachaRevealPlayerModule = {
  createGachaRevealPlayer,
  resolveRevealEffectKey,
  resolveSpotlightPull,
  isInstantPlayback
};

export = GachaRevealPlayerModule;



