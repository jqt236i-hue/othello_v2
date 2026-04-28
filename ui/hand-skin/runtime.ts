'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const CPU_HAND_SKINS = Object.freeze([
  Object.freeze({
    id: 'cpu-lv1-2',
    label: 'CPU Lv1-2',
    note: 'CPU 固定',
    imagePath: 'assets/images/hand-skin/lv1-2.png'
  }),
  Object.freeze({
    id: 'cpu-lv3-5',
    label: 'CPU Lv3-5',
    note: 'CPU 固定',
    imagePath: 'assets/images/hand-skin/lv3-5.png'
  }),
  Object.freeze({
    id: 'cpu-lv4',
    label: 'CPU Lv4',
    note: 'CPU 固定',
    imagePath: 'assets/images/hand-skin/lv4.png'
  }),
  Object.freeze({
    id: 'cpu-lv6',
    label: 'CPU Lv6',
    note: 'CPU 固定',
    imagePath: 'assets/images/hand-skin/lv6.png'
  })
]);
const CPU_HAND_SKIN_BY_ID = Object.freeze((CPU_HAND_SKINS as any).reduce((acc: any, skin: any) => {
  acc[skin.id] = skin;
  return acc;
}, {}));
const CPU_HAND_SKIN_BY_LEVEL = Object.freeze({
  1: 'cpu-lv1-2',
  2: 'cpu-lv1-2',
  3: 'cpu-lv3-5',
  4: 'cpu-lv4',
  5: 'cpu-lv3-5',
  6: 'cpu-lv6'
} as any);

function resolveCatalogModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.HandSkinCatalogModule) return ctx.HandSkinCatalogModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).HandSkinCatalogModule) {
      return (globalThis as any).HandSkinCatalogModule;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('./catalog.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveSelectionModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.HandSkinSelectionModule) return ctx.HandSkinSelectionModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).HandSkinSelectionModule) {
      return (globalThis as any).HandSkinSelectionModule;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('./selection.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveOwnerHelpersModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.OwnerHelpers) return ctx.OwnerHelpers;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).OwnerHelpers) {
      return (globalThis as any).OwnerHelpers;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('../../utils/owner-helpers.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveRootRef(rootRef: any): any {
  if (rootRef && typeof rootRef === 'object') return rootRef;
  try {
    if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveDocument(rootRef: any): Document | null {
  if (rootRef && rootRef.document) return rootRef.document;
  if (typeof document !== 'undefined') return document;
  return null;
}

function resolveRegisteredUIGlobal(rootRef: any, key: string): any {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return null;
  const candidates: any[] = [];
  const pushCandidate = (candidate: any) => {
    if (!candidate || typeof candidate.getRegisteredUIGlobals !== 'function') return;
    if (candidates.indexOf(candidate) >= 0) return;
    candidates.push(candidate);
  };
  const ctx = resolveRootRef(rootRef);
  if (ctx && typeof ctx === 'object') {
    pushCandidate(ctx.UIBootstrap);
    pushCandidate(ctx.SharedUIBootstrap);
  }
  try {
    if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis === 'object') {
      pushCandidate((globalThis as any).UIBootstrap);
      pushCandidate((globalThis as any).SharedUIBootstrap);
    }
  } catch (e) { /* ignore */ }
  for (let index = 0; index < candidates.length; index += 1) {
    try {
      const registry = candidates[index].getRegisteredUIGlobals();
      if (registry && typeof registry === 'object' && Object.prototype.hasOwnProperty.call(registry, normalizedKey)) {
        return registry[normalizedKey];
      }
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveStateObject(rootRef: any, key: string): any {
  const ctx = resolveRootRef(rootRef);
  if (ctx && ctx[key] && typeof ctx[key] === 'object') return ctx[key];
  const registered = resolveRegisteredUIGlobal(rootRef, key);
  if (registered && typeof registered === 'object') return registered;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any)[key] && typeof (globalThis as any)[key] === 'object') {
      return (globalThis as any)[key];
    }
  } catch (e) { /* ignore */ }
  return null;
}

function normalizeOwnerKey(value: any, rootRef: any): string | null {
  const ownerHelpersModule = resolveOwnerHelpersModule(rootRef);
  if (ownerHelpersModule && typeof ownerHelpersModule.normalizePlayerKeyOptional === 'function') {
    const normalized = ownerHelpersModule.normalizePlayerKeyOptional(value);
    if (normalized) return normalized;
  }
  if (value === -1 || value === '-1' || value === 'white') return 'white';
  if (value === 1 || value === '1' || value === 'black') return 'black';
  return null;
}

function resolveCurrentTurnControllerKey(rootRef: any, turnOwnerKey: string): string | null {
  if (!turnOwnerKey) return null;
  const ownerHelpersModule = resolveOwnerHelpersModule(rootRef);
  const cardState = resolveStateObject(rootRef, 'cardState');
  if (!cardState) return null;
  if (ownerHelpersModule && typeof ownerHelpersModule.getFateWillControllerForTurnOwner === 'function') {
    return ownerHelpersModule.getFateWillControllerForTurnOwner(cardState, turnOwnerKey);
  }
  const controllerMap = (cardState.fateWillControllerByTurnOwner && typeof cardState.fateWillControllerByTurnOwner === 'object')
    ? cardState.fateWillControllerByTurnOwner
    : null;
  if (!controllerMap) return null;
  const rawController = controllerMap[turnOwnerKey];
  if (ownerHelpersModule && typeof ownerHelpersModule.normalizePlayerKeyOptional === 'function') {
    return ownerHelpersModule.normalizePlayerKeyOptional(rawController);
  }
  return rawController === 'white' ? 'white' : (rawController === 'black' ? 'black' : null);
}

function isNetworkMode(rootRef: any): boolean {
  const ownerHelpersModule = resolveOwnerHelpersModule(rootRef);
  if (ownerHelpersModule && typeof ownerHelpersModule.isNetworkMode === 'function') {
    return !!ownerHelpersModule.isNetworkMode(resolveRootRef(rootRef));
  }
  const ctx = resolveRootRef(rootRef);
  return !!(ctx && (ctx.MATCH_MODE === 'network' || ctx.__MATCH_MODE === 'network'));
}

function resolveLocalPlayerKey(rootRef: any): string {
  if (!isNetworkMode(rootRef)) {
    return 'black';
  }
  const ownerHelpersModule = resolveOwnerHelpersModule(rootRef);
  if (ownerHelpersModule && typeof ownerHelpersModule.resolveLocalPlayerKey === 'function') {
    return ownerHelpersModule.resolveLocalPlayerKey(resolveRootRef(rootRef));
  }
  return 'black';
}

function resolveNetworkMatchClient(rootRef: any): any {
  const ctx = resolveRootRef(rootRef);
  if (ctx && ctx.NetworkMatchClient && typeof ctx.NetworkMatchClient === 'object') {
    return ctx.NetworkMatchClient;
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).NetworkMatchClient) {
      return (globalThis as any).NetworkMatchClient;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function resolveNetworkSeatHandSkins(rootRef: any): any {
  const client = resolveNetworkMatchClient(rootRef);
  if (!client || typeof client.getSeatHandSkins !== 'function') {
    return { black: '', white: '' };
  }
  try {
    return client.getSeatHandSkins();
  } catch (e) { /* ignore */ }
  return { black: '', white: '' };
}

function isDebugHumanVsHumanEnabled(rootRef: any): boolean {
  const ctx = resolveRootRef(rootRef);
  return !!(ctx && ctx.DEBUG_HUMAN_VS_HUMAN === true);
}

function isOwnerOnBottomSlot(rootRef: any, ownerKey: string): boolean {
  const normalizedOwnerKey = normalizeOwnerKey(ownerKey, rootRef) || 'black';
  const docRef = resolveDocument(resolveRootRef(rootRef));
  if (!docRef) return normalizedOwnerKey === 'black';
  const bottomEl = docRef.getElementById('hand-black');
  const topEl = docRef.getElementById('hand-white');
  const bottomOwnerKey = normalizeOwnerKey(bottomEl && bottomEl.dataset ? bottomEl.dataset.ownerKey : null, rootRef) || 'black';
  const topOwnerKey = normalizeOwnerKey(topEl && topEl.dataset ? topEl.dataset.ownerKey : null, rootRef) || 'white';
  if (bottomOwnerKey === normalizedOwnerKey) return true;
  if (topOwnerKey === normalizedOwnerKey) return false;
  return normalizedOwnerKey === 'black';
}

function clampCpuLevel(value: any): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.floor(n)));
}

function resolveCpuLevel(rootRef: any, ownerKey: any, explicitLevel: any): number {
  if (Number.isFinite(Number(explicitLevel))) {
    return clampCpuLevel(explicitLevel);
  }
  const normalizedOwnerKey = normalizeOwnerKey(ownerKey, rootRef) || 'white';
  const smartness = resolveCpuSmartnessState(rootRef);
  const level = smartness && Object.prototype.hasOwnProperty.call(smartness, normalizedOwnerKey)
    ? smartness[normalizedOwnerKey]
    : 1;
  return clampCpuLevel(level);
}

function resolveCpuLevelFromSelect(rootRef: any, ownerKey: any): number | null {
  const normalizedOwnerKey = normalizeOwnerKey(ownerKey, rootRef) || 'white';
  const docRef = resolveDocument(resolveRootRef(rootRef));
  if (!docRef || typeof docRef.getElementById !== 'function') return null;
  const selectId = normalizedOwnerKey === 'black' ? 'smartBlack' : 'smartWhite';
  const selectEl = docRef.getElementById(selectId);
  if (!selectEl) return null;
  const rawValue = typeof (selectEl as HTMLSelectElement).value === 'string' ? (selectEl as HTMLSelectElement).value.trim() : String((selectEl as any).value || '').trim();
  if (!rawValue) return null;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return null;
  return clampCpuLevel(value);
}

function resolveCpuSmartnessState(rootRef: any): any {
  const smartness = resolveStateObject(rootRef, 'cpuSmartness');
  if (smartness && typeof smartness === 'object') return smartness;
  const blackLevel = resolveCpuLevelFromSelect(rootRef, 'black');
  const whiteLevel = resolveCpuLevelFromSelect(rootRef, 'white');
  if (!Number.isFinite(blackLevel) && !Number.isFinite(whiteLevel)) return null;
  return {
    black: Number.isFinite(blackLevel) ? blackLevel : 1,
    white: Number.isFinite(whiteLevel) ? whiteLevel : 1
  };
}

function isCpuMatchMode(rootRef: any): boolean {
  const ctx = resolveRootRef(rootRef);
  const rawMode = ctx && (ctx.MATCH_MODE || ctx.__MATCH_MODE);
  return String(rawMode || '').trim().toLowerCase() === 'cpu';
}

function getCpuHandSkinDefinition(level: number): any {
  const normalizedLevel = clampCpuLevel(level);
  const id = CPU_HAND_SKIN_BY_LEVEL[normalizedLevel] || CPU_HAND_SKIN_BY_LEVEL[1];
  return CPU_HAND_SKIN_BY_ID[id] || CPU_HAND_SKIN_BY_ID['cpu-lv1-2'];
}

function shouldUseCpuHandSkin(rootRef: any, ownerKey: any): boolean {
  if (isNetworkMode(rootRef) || isDebugHumanVsHumanEnabled(rootRef)) return false;
  const normalizedOwnerKey = normalizeOwnerKey(ownerKey, rootRef) || 'white';
  const smartness = resolveCpuSmartnessState(rootRef);
  const hasCpuConfig = !!(smartness && typeof smartness === 'object');
  const ctx = resolveRootRef(rootRef);
  const autoModeActive = !!(ctx && ctx.AUTO_MODE_ACTIVE === true);
  const cpuMatchMode = isCpuMatchMode(rootRef);
  if (isOwnerOnBottomSlot(rootRef, normalizedOwnerKey) === false) {
    return hasCpuConfig || cpuMatchMode || autoModeActive;
  }
  if (normalizedOwnerKey === 'black') {
    return autoModeActive;
  }
  if (normalizedOwnerKey !== 'white') return false;
  const controllerKey = resolveCurrentTurnControllerKey(rootRef, normalizedOwnerKey);
  const localPlayerKey = resolveLocalPlayerKey(rootRef);
  if (controllerKey && controllerKey === localPlayerKey) return false;
  return hasCpuConfig || cpuMatchMode;
}

function resolveHandVisualOptions(rootRef: any, ownerKey: any, options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const normalizedOwnerKey = normalizeOwnerKey(ownerKey, rootRef);
  if (!normalizedOwnerKey) {
    return { ownerKey: null, cpu: false, cpuLevel: null };
  }
  if (opts.forceCpu === true) {
    return {
      ownerKey: normalizedOwnerKey,
      cpu: true,
      cpuLevel: resolveCpuLevel(rootRef, normalizedOwnerKey, opts.cpuLevel)
    };
  }
  if (shouldUseCpuHandSkin(rootRef, normalizedOwnerKey)) {
    return {
      ownerKey: normalizedOwnerKey,
      cpu: true,
      cpuLevel: resolveCpuLevel(rootRef, normalizedOwnerKey, opts.cpuLevel)
    };
  }
  return {
    ownerKey: normalizedOwnerKey,
    cpu: false,
    cpuLevel: null
  };
}

function resolveHandAnimationContext(rootRef: any, preferredSkinId: any, options?: any): any {
  const ctx = resolveRootRef(rootRef);
  const opts = (options && typeof options === 'object') ? options : {};
  const catalogModule = resolveCatalogModule(ctx);
  const selectionModule = resolveSelectionModule(ctx);
  const explicitOwnerKey = normalizeOwnerKey(opts.ownerKey, ctx);
  const ownerKey = explicitOwnerKey || (
    isNetworkMode(ctx)
      ? resolveLocalPlayerKey(ctx)
      : (shouldUseCpuHandSkin(ctx, 'white') ? 'white' : 'black')
  );
  const visual = resolveHandVisualOptions(ctx, ownerKey, Object.assign({}, opts, {
    forceCpu: opts.forceCpu === true || opts.cpu === true
  }));
  const defaultSkinId = String((catalogModule && catalogModule.DEFAULT_HAND_SKIN_ID) || 'default').trim() || 'default';
  const storedSkinId = selectionModule && typeof selectionModule.readStoredHandSkinId === 'function'
    ? selectionModule.readStoredHandSkinId(ctx)
    : defaultSkinId;
  const localSelectedSkinId = catalogModule && typeof catalogModule.normalizeHandSkinId === 'function'
    ? catalogModule.normalizeHandSkinId(preferredSkinId || storedSkinId, ctx)
    : defaultSkinId;
  const isRemoteNetworkSeat = (
    visual.cpu !== true
    && isNetworkMode(ctx)
    && visual.ownerKey
    && visual.ownerKey !== resolveLocalPlayerKey(ctx)
  );
  const seatHandSkins = isRemoteNetworkSeat ? resolveNetworkSeatHandSkins(ctx) : null;
  const selectedSkinId = isRemoteNetworkSeat && catalogModule && typeof catalogModule.normalizeHandSkinId === 'function'
    ? catalogModule.normalizeHandSkinId(seatHandSkins && seatHandSkins[visual.ownerKey], null, { allowUnowned: true })
    : localSelectedSkinId;
  const renderedDefinition = visual.cpu
    ? getCpuHandSkinDefinition(visual.cpuLevel)
    : (catalogModule && typeof catalogModule.getHandSkinDefinition === 'function'
      ? catalogModule.getHandSkinDefinition(selectedSkinId, ctx, { allowUnowned: isRemoteNetworkSeat })
      : { id: defaultSkinId, imagePath: 'assets/images/hand-skin/勇者の手.png' });
  return {
    ownerKey: visual.ownerKey,
    cpu: visual.cpu === true,
    cpuLevel: visual.cpu === true ? visual.cpuLevel : null,
    selectedSkinId,
    renderedSkinId: renderedDefinition.id,
    renderedImagePath: renderedDefinition.imagePath,
    renderedDefinition
  };
}

function applyHandSkin(handImageEl: any, skinId: any, rootRef: any): any {
  if (!handImageEl) return null;
  const catalogModule = resolveCatalogModule(rootRef);
  const definition = catalogModule && typeof catalogModule.getHandSkinDefinition === 'function'
    ? catalogModule.getHandSkinDefinition(skinId, rootRef)
    : null;
  if (!definition) return null;
  handImageEl.setAttribute('src', definition.imagePath);
  handImageEl.setAttribute('data-hand-skin-id', definition.id);
  handImageEl.setAttribute('data-hand-selected-skin-id', definition.id);
  return definition;
}

function syncDisplayedHandSkin(rootRef: any, preferredSkinId: any, handImageEl?: any, options?: any): any {
  const ctx = resolveRootRef(rootRef);
  const docRef = resolveDocument(ctx);
  const imageEl = handImageEl || (docRef ? docRef.getElementById('handImage') : null);
  if (!imageEl) return null;
  const handContext = resolveHandAnimationContext(ctx, preferredSkinId, options);
  imageEl.setAttribute('src', handContext.renderedImagePath);
  imageEl.setAttribute('data-hand-skin-id', handContext.renderedSkinId);
  imageEl.setAttribute('data-hand-selected-skin-id', handContext.selectedSkinId);
  return handContext.renderedDefinition;
}

const HandSkinRuntimeModule = {
  resolveRootRef,
  resolveDocument,
  resolveNetworkMatchClient,
  isNetworkMode,
  resolveHandVisualOptions,
  resolveHandAnimationContext,
  applyHandSkin,
  syncDisplayedHandSkin
};

export = HandSkinRuntimeModule;
