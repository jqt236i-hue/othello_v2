export type DiffRendererViewerContext = {
  seatKey: 'black' | 'white' | null;
  localPlayerKey: 'black' | 'white' | null;
  isNetworkMode: boolean;
  isSpectator: boolean;
  debugHumanVsHuman: boolean;
};

export type BoardViewerContext = 'black' | 'white' | 'spectator';

function normalizePlayerKey(value: any): 'black' | 'white' | null {
  return value === 'black' || value === 'white' ? value : null;
}

export function resolveDiffRendererViewerContext(
  root: any,
  ownerHelpers?: any,
  preparedCardState?: unknown
): DiffRendererViewerContext {
  const win = root || (typeof window !== 'undefined' ? window : null);
  const networkClient = win && win.NetworkMatchClient;
  let seatKey: 'black' | 'white' | null = null;
  try {
    if (networkClient && typeof networkClient.getSeatKey === 'function') {
      seatKey = normalizePlayerKey(networkClient.getSeatKey());
    }
  } catch (e: any) { seatKey = null; }

  let isSpectator = false;
  try {
    isSpectator = !!(
      networkClient
      && typeof networkClient.isSpectator === 'function'
      && networkClient.isSpectator() === true
    );
  } catch (e: any) { isSpectator = false; }

  let localPlayerKey: 'black' | 'white' | null = null;
  try {
    if (ownerHelpers && typeof ownerHelpers.resolveLocalPlayerKey === 'function') {
      let ownerRoot = win;
      if (preparedCardState !== undefined && win && typeof win === 'object') {
        ownerRoot = Object.create(win);
        Object.defineProperty(ownerRoot, 'cardState', {
          configurable: true,
          enumerable: false,
          value: preparedCardState
        });
      }
      localPlayerKey = normalizePlayerKey(ownerHelpers.resolveLocalPlayerKey(ownerRoot));
    }
  } catch (e: any) { localPlayerKey = null; }
  if (!localPlayerKey) {
    try {
      const directKeys = [
        win && win.LOCAL_PLAYER_KEY,
        win && win.__LOCAL_PLAYER_KEY,
        win && win.BOARD_VIEWER_KEY
      ];
      for (const key of directKeys) {
        localPlayerKey = normalizePlayerKey(key);
        if (localPlayerKey) break;
      }
    } catch (e: any) { localPlayerKey = null; }
  }

  let isNetworkMode = false;
  try {
    isNetworkMode = ownerHelpers && typeof ownerHelpers.isNetworkMode === 'function'
      ? ownerHelpers.isNetworkMode(win) === true
      : !!(
        win &&
        (
          (typeof win.getCurrentMatchMode === 'function' && win.getCurrentMatchMode() === 'network') ||
          win.MATCH_MODE === 'network'
        )
      );
  } catch (e: any) { isNetworkMode = false; }

  return {
    seatKey,
    localPlayerKey,
    isNetworkMode,
    isSpectator,
    debugHumanVsHuman: !!(win && win.DEBUG_HUMAN_VS_HUMAN === true)
  };
}

export function toBoardViewerContext(value: unknown): BoardViewerContext {
  if (value === 'white' || value === 'spectator') return value;
  if (value === 'black') return 'black';
  const context = value && typeof value === 'object'
    ? value as Partial<DiffRendererViewerContext> & { viewerRole?: unknown }
    : null;
  if (!context) return 'black';
  if (context.isSpectator === true || String(context.viewerRole || '').trim().toLowerCase() === 'spectator') {
    return 'spectator';
  }
  if (context.seatKey === 'white' || context.seatKey === 'black') return context.seatKey;
  if (context.localPlayerKey === 'white' || context.localPlayerKey === 'black') return context.localPlayerKey;
  return 'black';
}

module.exports = {
  resolveDiffRendererViewerContext,
  toBoardViewerContext
};
