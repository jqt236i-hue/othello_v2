export type DiffRendererViewerContext = {
  seatKey: 'black' | 'white' | null;
  localPlayerKey: 'black' | 'white' | null;
  isNetworkMode: boolean;
  debugHumanVsHuman: boolean;
};

function normalizePlayerKey(value: any): 'black' | 'white' | null {
  return value === 'black' || value === 'white' ? value : null;
}

export function resolveDiffRendererViewerContext(root: any, ownerHelpers?: any): DiffRendererViewerContext {
  const win = root || (typeof window !== 'undefined' ? window : null);
  let seatKey: 'black' | 'white' | null = null;
  try {
    if (win && win.NetworkMatchClient && typeof win.NetworkMatchClient.getSeatKey === 'function') {
      seatKey = normalizePlayerKey(win.NetworkMatchClient.getSeatKey());
    }
  } catch (e: any) { seatKey = null; }

  let localPlayerKey: 'black' | 'white' | null = null;
  try {
    if (ownerHelpers && typeof ownerHelpers.resolveLocalPlayerKey === 'function') {
      localPlayerKey = normalizePlayerKey(ownerHelpers.resolveLocalPlayerKey(win));
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
    debugHumanVsHuman: !!(win && win.DEBUG_HUMAN_VS_HUMAN === true)
  };
}

module.exports = {
  resolveDiffRendererViewerContext
};
