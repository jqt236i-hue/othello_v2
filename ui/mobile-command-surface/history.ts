interface MobileHistoryMarker {
  token: string;
  kind: string;
}

interface MobileHistoryController {
  promote(kind: string): void;
  consume(): void;
  releaseOnPop(): boolean;
  owns(kind?: string): boolean;
}

const HISTORY_STATE_KEY = '__cardReversiMobileCommandSurface';

function createMobileHistoryController(
  root: Window,
  stateKey = HISTORY_STATE_KEY,
): MobileHistoryController {
  let ownedMarker: MobileHistoryMarker | null = null;
  let sequence = 0;

  const currentMarker = (): MobileHistoryMarker | null => {
    const historyState = root.history.state;
    if (!historyState || typeof historyState !== 'object') return null;
    const marker = (historyState as Record<string, unknown>)[stateKey];
    if (!marker || typeof marker !== 'object') return null;
    const value = marker as Partial<MobileHistoryMarker>;
    if (typeof value.token !== 'string' || typeof value.kind !== 'string') return null;
    return { token: value.token, kind: value.kind };
  };

  const nextHistoryState = (marker: MobileHistoryMarker): Record<string, unknown> => {
    const historyState = root.history.state;
    const nextState = historyState && typeof historyState === 'object'
      ? { ...(historyState as Record<string, unknown>) }
      : {};
    nextState[stateKey] = marker;
    return nextState;
  };

  const push = (kind: string): void => {
    const marker: MobileHistoryMarker = {
      token: `mobile-command-${Date.now()}-${sequence += 1}`,
      kind,
    };
    try {
      root.history.pushState(nextHistoryState(marker), '');
      ownedMarker = marker;
    } catch (_error) {
      ownedMarker = null;
    }
  };

  return {
    promote(kind: string): void {
      if (!ownedMarker) {
        push(kind);
        return;
      }
      const activeMarker = currentMarker();
      if (!activeMarker || activeMarker.token !== ownedMarker.token) {
        ownedMarker = null;
        push(kind);
        return;
      }
      const marker = { ...ownedMarker, kind };
      try {
        root.history.replaceState(nextHistoryState(marker), '');
        ownedMarker = marker;
      } catch (_error) {
        ownedMarker = null;
      }
    },
    consume(): void {
      const marker = ownedMarker;
      ownedMarker = null;
      if (!marker) return;
      const activeMarker = currentMarker();
      if (!activeMarker || activeMarker.token !== marker.token) return;
      try {
        root.history.back();
      } catch (_error) {
        // Visual state is already closed; never navigate an unowned entry.
      }
    },
    releaseOnPop(): boolean {
      if (!ownedMarker) return false;
      ownedMarker = null;
      return true;
    },
    owns(kind?: string): boolean {
      return ownedMarker !== null && (kind === undefined || ownedMarker.kind === kind);
    },
  };
}

export {
  HISTORY_STATE_KEY,
  createMobileHistoryController,
};

export type {
  MobileHistoryController,
};
