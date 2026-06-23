'use strict';

type NetworkAutoRoot = Record<string, any>;

type NetworkAutoController = {
  tick: () => Promise<{ handled: boolean; published?: boolean; reason?: string }>;
};

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire | null = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : (typeof require === 'function' ? require : null);

let cpuNetworkCommandPlannerModule: any = null;
let pendingCoordinatorModule: any = null;
let pendingSelectionRegistryModule: any = null;
let cardLogicModule: any = null;

function normalizePlayerKey(value: any): string {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'white' || raw === 'w' || raw === '-1' || raw === '2') return 'white';
  return 'black';
}

function playerValueToKey(root: NetworkAutoRoot, value: any): string {
  const whiteValue = root && typeof root.WHITE !== 'undefined' ? root.WHITE : -1;
  return Number(value) === Number(whiteValue) ? 'white' : 'black';
}

function safeRequire(id: string): any | null {
  if (!_require) return null;
  try {
    return _require(id);
  } catch (e) {
    return null;
  }
}

function resolveCpuNetworkCommandPlanner(root: NetworkAutoRoot): any | null {
  if (root && root.CpuNetworkCommandPlanner && typeof root.CpuNetworkCommandPlanner.planCpuNetworkCommand === 'function') {
    return root.CpuNetworkCommandPlanner;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).CpuNetworkCommandPlanner) {
    return (globalThis as any).CpuNetworkCommandPlanner;
  }
  if (!cpuNetworkCommandPlannerModule) {
    cpuNetworkCommandPlannerModule = safeRequire('../../game/cpu-network-command-planner')
      || safeRequire('../game/cpu-network-command-planner');
  }
  return cpuNetworkCommandPlannerModule;
}

function resolvePendingCoordinator(root: NetworkAutoRoot): any | null {
  if (root && root.PendingCoordinator) return root.PendingCoordinator;
  if (typeof globalThis !== 'undefined' && (globalThis as any).PendingCoordinator) return (globalThis as any).PendingCoordinator;
  if (!pendingCoordinatorModule) {
    pendingCoordinatorModule = safeRequire('../../game/turn/pending-coordinator')
      || safeRequire('../game/turn/pending-coordinator');
  }
  return pendingCoordinatorModule;
}

function resolvePendingSelectionRegistry(root: NetworkAutoRoot): any | null {
  if (root && root.PendingSelectionRegistry) return root.PendingSelectionRegistry;
  if (typeof globalThis !== 'undefined' && (globalThis as any).PendingSelectionRegistry) return (globalThis as any).PendingSelectionRegistry;
  if (!pendingSelectionRegistryModule) {
    pendingSelectionRegistryModule = safeRequire('../../game/logic/cards-internal/pending-selection-registry')
      || safeRequire('../game/logic/cards-internal/pending-selection-registry');
  }
  return pendingSelectionRegistryModule;
}

function resolveCardLogic(root: NetworkAutoRoot): any | null {
  if (root && root.CardLogic) return root.CardLogic;
  if (typeof globalThis !== 'undefined' && (globalThis as any).CardLogic) return (globalThis as any).CardLogic;
  if (!cardLogicModule) {
    cardLogicModule = safeRequire('../../game/logic/cards')
      || safeRequire('../game/logic/cards');
  }
  return cardLogicModule;
}

function isNetworkModeActive(root: NetworkAutoRoot): boolean {
  try {
    if (root && root.MatchMode && typeof root.MatchMode.isNetworkModeActive === 'function') {
      return root.MatchMode.isNetworkModeActive() === true;
    }
    if (root && typeof root.isNetworkModeActive === 'function') {
      return root.isNetworkModeActive() === true;
    }
    return String(root && (root.MATCH_MODE || root.__MATCH_MODE) || '').trim().toLowerCase() === 'network';
  } catch (e) {
    return false;
  }
}

function isBusy(root: NetworkAutoRoot): boolean {
  try {
    if (!root) return true;
    if (root.isProcessing === true || root.isCardAnimating === true || root.VisualPlaybackActive === true) return true;
    const playback = root.PlaybackStateManager;
    if (playback && typeof playback.getPlaybackActive === 'function' && playback.getPlaybackActive() === true) return true;
    if (playback && typeof playback.getCardAnimating === 'function' && playback.getCardAnimating() === true) return true;
  } catch (e) {
    return true;
  }
  return false;
}

function resolvePublishActionType(action: any, plannedActionType?: any): string {
  const planned = String(plannedActionType || '').trim().toLowerCase();
  if (planned) return planned;
  const type = String(action && (action.type || action.actionType) || '').trim().toLowerCase();
  if (type === 'pass') return 'pass';
  if (type === 'use_card' || type === 'usecard') return 'use_card';
  return 'place';
}

function toFiniteIntegerOrNull(value: any): number | null {
  if (!Number.isFinite(Number(value))) return null;
  return Math.trunc(Number(value));
}

function readClientStateVersion(client: any): number | null {
  try {
    if (client && typeof client.getStateVersion === 'function') {
      return toFiniteIntegerOrNull(client.getStateVersion());
    }
  } catch (e) { /* ignore */ }
  return null;
}

function resolveSignatureVersion(root: NetworkAutoRoot, client: any, state: any): number | string {
  const candidates = [
    readClientStateVersion(client),
    root && toFiniteIntegerOrNull(root.stateVersion),
    state && toFiniteIntegerOrNull(state.stateVersion),
    state && state._meta && toFiniteIntegerOrNull(state._meta.version),
    state && toFiniteIntegerOrNull(state.turnNumber)
  ];
  for (const value of candidates) {
    if (value !== null && typeof value !== 'undefined') return value;
  }
  return '';
}

function buildSignature(action: any, actionType: string, roomId: string, seatKey: string, version: number | string): string {
  const pendingState = action && action.pendingSelectionState && typeof action.pendingSelectionState === 'object'
    ? action.pendingSelectionState
    : null;
  return [
    roomId,
    seatKey,
    version,
    actionType,
    action && action.type,
    action && action.row,
    action && action.col,
    action && action.useCardId,
    action && action.turnIndex,
    action && action.autoNoActionPass === true ? 'autoNoActionPass' : '',
    pendingState && pendingState.pendingEffectId
  ].join(':');
}

function createPlannerInput(root: NetworkAutoRoot, state: any, seatKey: string): any {
  return {
    playerKey: seatKey,
    gameState: state,
    cardState: root && root.cardState ? root.cardState : null,
    protectedStones: root && root.protectedStones ? root.protectedStones : [],
    permaProtectedStones: root && root.permaProtectedStones ? root.permaProtectedStones : [],
    getLegalMoves: root && root.getLegalMoves,
    selectCpuMoveWithPolicy: root && root.selectCpuMoveWithPolicy,
    computeCpuAction: root && root.computeCpuAction,
    selectCardToUse: root && root.selectCardToUse,
    CoreLogic: root && (root.CoreLogic || root.Core),
    CardLogic: resolveCardLogic(root),
    PendingCoordinator: resolvePendingCoordinator(root),
    PendingSelectionRegistry: resolvePendingSelectionRegistry(root)
  };
}

function createNetworkAutoPlayController(rootRef?: NetworkAutoRoot): NetworkAutoController {
  const root = rootRef || (typeof window !== 'undefined' ? (window as any) : (globalThis as any));
  let publishing = false;
  let lastSignature = '';

  async function tick(): Promise<{ handled: boolean; published?: boolean; reason?: string }> {
    if (!isNetworkModeActive(root)) return { handled: false, reason: 'NOT_NETWORK_MODE' };
    const client = root && root.NetworkMatchClient;
    if (!client || typeof client.publishCommand !== 'function') return { handled: true, reason: 'CLIENT_UNAVAILABLE' };
    if (typeof client.isActive === 'function' && client.isActive() !== true) return { handled: true, reason: 'ROOM_INACTIVE' };
    if (typeof client.isSpectator === 'function' && client.isSpectator() === true) return { handled: true, reason: 'SPECTATOR' };
    if (typeof client.getNetworkAutoEnabled === 'function' && client.getNetworkAutoEnabled() !== true) {
      return { handled: true, reason: 'ROOM_AUTO_DISABLED' };
    }
    if (publishing || isBusy(root)) return { handled: true, reason: 'BUSY' };

    const state = root && root.gameState ? root.gameState : null;
    if (!state || typeof state !== 'object') return { handled: true, reason: 'NO_STATE' };
    const seatKey = normalizePlayerKey(typeof client.getSeatKey === 'function' ? client.getSeatKey() : root.LOCAL_PLAYER_KEY);
    const turnKey = playerValueToKey(root, state.currentPlayer);
    if (seatKey !== turnKey) return { handled: true, reason: 'NOT_OWN_TURN' };

    const planner = resolveCpuNetworkCommandPlanner(root);
    if (!planner || typeof planner.planCpuNetworkCommand !== 'function') {
      return { handled: true, reason: 'PLANNER_UNAVAILABLE' };
    }

    const planned = planner.planCpuNetworkCommand(createPlannerInput(root, state, seatKey));
    const action = planned && planned.action;
    if (!action) return { handled: true, reason: 'NO_ACTION_SELECTED' };

    const actionType = resolvePublishActionType(action, planned && planned.actionType);
    const version = resolveSignatureVersion(root, client, state);
    const roomId = typeof client.getRoomId === 'function' ? String(client.getRoomId() || '') : '';
    const signature = buildSignature(action, actionType, roomId, seatKey, version);
    if (signature && signature === lastSignature) return { handled: true, reason: 'DUPLICATE_TICK' };

    publishing = true;
    lastSignature = signature;
    try {
      const result = await client.publishCommand({
        playerKey: seatKey,
        actionType,
        action,
        playbackEvents: []
      });
      if (!result || result.ok !== true) {
        lastSignature = '';
      }
      return { handled: true, published: !!(result && result.ok === true), reason: result && result.reason };
    } catch (e) {
      lastSignature = '';
      return { handled: true, published: false, reason: 'PUBLISH_FAILED' };
    } finally {
      publishing = false;
    }
  }

  return { tick };
}

function getOrCreateNetworkAutoPlayController(rootRef?: NetworkAutoRoot): NetworkAutoController {
  const root = rootRef || (typeof window !== 'undefined' ? (window as any) : (globalThis as any));
  if (root.NetworkAutoPlay && typeof root.NetworkAutoPlay.tick === 'function') {
    return root.NetworkAutoPlay;
  }
  const controller = createNetworkAutoPlayController(root);
  root.NetworkAutoPlay = controller;
  return controller;
}

export = {
  createNetworkAutoPlayController,
  getOrCreateNetworkAutoPlayController
};
