type HandFadeRuntimeRoot = typeof globalThis & Record<string, any>;

let OwnerHelpersModule: any = null;
try {
  if (typeof require === 'function') {
    OwnerHelpersModule = require('../../utils/owner-helpers');
  }
} catch (e: any) { /* ignore */ }

function resolveRoot(rootRef?: any): any {
  if (rootRef && typeof rootRef === 'object') return rootRef;
  try {
    if (typeof window !== 'undefined' && window) return window;
  } catch (e: any) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined') return globalThis;
  } catch (e: any) { /* ignore */ }
  return null;
}

function normalizeOwnerKey(value: any): 'black' | 'white' {
  if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKey === 'function') {
    return OwnerHelpersModule.normalizePlayerKey(value, 'black') === 'white' ? 'white' : 'black';
  }
  if (value === 'white' || value === -1 || value === '-1') return 'white';
  return 'black';
}

function normalizeQueuedHandFadeInState(fadeState: any): any {
  if (!fadeState || typeof fadeState !== 'object') return null;
  const token = typeof fadeState.token === 'string' && fadeState.token.trim()
    ? fadeState.token
    : null;
  if (!token) return null;
  return {
    playerKey: normalizeOwnerKey(fadeState.playerKey),
    count: Number.isFinite(fadeState.count) ? Math.max(0, Math.trunc(fadeState.count)) : 0,
    token
  };
}

function getQueuedHandFadeInState(rootRef?: any): any {
  try {
    const root = resolveRoot(rootRef);
    if (!root) return null;
    return normalizeQueuedHandFadeInState(root.__handFadeInState || root.__handFadeInHint || null);
  } catch (e: any) {
    return null;
  }
}

function setQueuedHandFadeInState(fadeState: any, rootRef?: any): any {
  const nextState = normalizeQueuedHandFadeInState(fadeState);
  try {
    const root = resolveRoot(rootRef);
    if (!root) return nextState;
    root.__handFadeInState = nextState;
    root.__handFadeInHint = nextState;
  } catch (e: any) { /* ignore */ }
  return nextState;
}

function clearQueuedHandFadeInState(criteria?: any, rootRef?: any): void {
  const token = (criteria && typeof criteria === 'object')
    ? (typeof criteria.token === 'string' ? criteria.token : null)
    : (typeof criteria === 'string' ? criteria : null);
  const ownerKey = (criteria && typeof criteria === 'object' && typeof criteria.ownerKey !== 'undefined' && criteria.ownerKey !== null)
    ? normalizeOwnerKey(criteria.ownerKey)
    : null;
  try {
    const root = resolveRoot(rootRef);
    if (!root) return;
    const activeState = getQueuedHandFadeInState(root);
    const activeHint = normalizeQueuedHandFadeInState(root.__handFadeInHint || null);
    const shouldClearAll = !token && !ownerKey;
    if (
      shouldClearAll ||
      (activeState && token && activeState.token === token) ||
      (activeState && ownerKey && activeState.playerKey === ownerKey)
    ) {
      root.__handFadeInState = null;
    }
    if (
      shouldClearAll ||
      (activeHint && token && activeHint.token === token) ||
      (activeHint && ownerKey && activeHint.playerKey === ownerKey)
    ) {
      root.__handFadeInHint = null;
    }
  } catch (e: any) { /* ignore */ }
}

const HandFadeStateModule = {
  normalizeQueuedHandFadeInState,
  getQueuedHandFadeInState,
  setQueuedHandFadeInState,
  clearQueuedHandFadeInState
};

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as HandFadeRuntimeRoot).HandFadeStateModule = HandFadeStateModule;
  }
} catch (e: any) { /* ignore */ }

export = HandFadeStateModule;
