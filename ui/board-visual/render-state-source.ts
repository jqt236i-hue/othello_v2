export interface BoardVisualRenderPair {
  readonly gameState: any;
  readonly cardState: any;
  readonly stateVersion?: number;
  readonly source: 'prepared' | 'network_visual_state' | 'local' | 'receipt_bound';
}

export interface BoardVisualPreparedState {
  readonly gameState: any;
  readonly cardState: any;
  readonly stateVersion?: number;
}

export interface NetworkVisualOperationalState {
  readonly canonicalVersion: number | null;
  readonly visualSeq: number;
  readonly visualVersion: number | null;
  readonly lagging: boolean;
  readonly hasCanonicalSnapshot: boolean;
  readonly hasVisualSnapshot: boolean;
}

export interface NetworkTimelineOperationalState {
  readonly visualSeq: number;
  readonly visualVersion: number | null;
  readonly pendingFrameCount: number;
  readonly playing: boolean;
  readonly paused: boolean;
  readonly blocksInput: boolean;
  readonly disposed: boolean;
  readonly disposing: boolean;
}

export interface NetworkVisualStateStorePort {
  peekRenderSnapshot?(): any;
  getRenderSnapshot?(): any;
  getOperationalState?(): NetworkVisualOperationalState;
  isCurrentCommitReceipt?(receipt: unknown): boolean;
  getSnapshotForReceipt?(receipt: unknown): any;
}

export interface NetworkPresentationTimelinePort {
  getOperationalState?(): NetworkTimelineOperationalState;
}

export interface BoardVisualRenderStateSourceDependencies {
  getVisualStore(): NetworkVisualStateStorePort | null;
  getPresentationTimeline(): NetworkPresentationTimelinePort | null;
  getLocalPair(): Readonly<{ gameState: any; cardState: any }>;
}

export interface BoardVisualRenderStateSource {
  setPreparedState(value: BoardVisualPreparedState | null): BoardVisualPreparedState | null;
  getPreparedState(): BoardVisualPreparedState | null;
  resolveNetworkSnapshot(): any | null;
  resolvePair(): BoardVisualRenderPair;
  resolveReceiptBoundPair(receipt: unknown): BoardVisualRenderPair;
  resolveNetworkInputEpoch(
    snapshot: any,
    viewerContext: Readonly<{ isNetworkMode?: boolean }> | null
  ): Readonly<{ stateVersion: number | null; visualSeq: number | null }>;
  isStrictNetworkVisualRenderActive(): boolean;
}

function toIntegerOrNull(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && Number.isInteger(numberValue)
    ? numberValue
    : null;
}

function requirePair(
  value: any,
  source: BoardVisualRenderPair['source'],
  options?: Readonly<{ allowMissingGameState?: boolean }>
): BoardVisualRenderPair {
  if (!value || (!value.gameState && options?.allowMissingGameState !== true) || !value.cardState) {
    throw new Error(`Board visual ${source} state pair is unavailable`);
  }
  const stateVersion = toIntegerOrNull(value.stateVersion);
  return Object.freeze({
    gameState: value.gameState,
    cardState: value.cardState,
    ...(stateVersion !== null ? { stateVersion } : {}),
    source
  });
}

export function createBoardVisualRenderStateSource(
  dependencies: BoardVisualRenderStateSourceDependencies
): BoardVisualRenderStateSource {
  if (!dependencies || typeof dependencies !== 'object') {
    throw new Error('Board visual render-state source dependencies are required');
  }
  if (
    typeof dependencies.getVisualStore !== 'function'
    || typeof dependencies.getPresentationTimeline !== 'function'
    || typeof dependencies.getLocalPair !== 'function'
  ) {
    throw new Error('Board visual render-state source dependencies are incomplete');
  }

  let preparedState: BoardVisualPreparedState | null = null;

  const getVisualStore = (): NetworkVisualStateStorePort | null => {
    const value = dependencies.getVisualStore();
    return value && typeof value === 'object' ? value : null;
  };

  const getTimeline = (): NetworkPresentationTimelinePort | null => {
    const value = dependencies.getPresentationTimeline();
    return value && typeof value === 'object' ? value : null;
  };

  const resolveNetworkSnapshot = (): any | null => {
    const store = getVisualStore();
    if (!store) return null;
    const snapshot = typeof store.peekRenderSnapshot === 'function'
      ? store.peekRenderSnapshot()
      : (typeof store.getRenderSnapshot === 'function' ? store.getRenderSnapshot() : null);
    return snapshot && snapshot.gameState && snapshot.cardState ? snapshot : null;
  };

  const resolvePair = (): BoardVisualRenderPair => {
    if (preparedState) return requirePair(preparedState, 'prepared');
    const visualSnapshot = resolveNetworkSnapshot();
    if (visualSnapshot) return requirePair(visualSnapshot, 'network_visual_state');
    // Browser bootstrap and injected-controller tests can legitimately render
    // an already-built frame before the first local game state exists. Keep
    // that pre-game local pair observable so guarded consumers can no-op.
    return requirePair(dependencies.getLocalPair(), 'local', { allowMissingGameState: true });
  };

  const resolveReceiptBoundPair = (receipt: unknown): BoardVisualRenderPair => {
    const store = getVisualStore();
    if (
      !receipt
      || !store
      || typeof store.isCurrentCommitReceipt !== 'function'
      || typeof store.getSnapshotForReceipt !== 'function'
      || store.isCurrentCommitReceipt(receipt) !== true
    ) {
      throw new Error('Committed board visual receipt is not current for the visual store');
    }
    const snapshot = store.getSnapshotForReceipt(receipt);
    if (!snapshot || !snapshot.gameState || !snapshot.cardState) {
      throw new Error('Committed board visual receipt has no bound snapshot');
    }
    return requirePair(snapshot, 'receipt_bound');
  };

  const resolveNetworkInputEpoch = (
    snapshot: any,
    viewerContext: Readonly<{ isNetworkMode?: boolean }> | null
  ): Readonly<{ stateVersion: number | null; visualSeq: number | null }> => {
    if (!viewerContext || viewerContext.isNetworkMode !== true) {
      return Object.freeze({ stateVersion: null, visualSeq: null });
    }
    const store = getVisualStore();
    const operational = store && typeof store.getOperationalState === 'function'
      ? store.getOperationalState()
      : null;
    const snapshotVersion = toIntegerOrNull(snapshot && snapshot.stateVersion);
    const visualVersion = toIntegerOrNull(operational && operational.visualVersion);
    const visualSeq = toIntegerOrNull(operational && operational.visualSeq);
    return Object.freeze({
      stateVersion: snapshotVersion ?? visualVersion,
      visualSeq
    });
  };

  const isStrictNetworkVisualRenderActive = (): boolean => {
    const store = getVisualStore();
    const storeState = store && typeof store.getOperationalState === 'function'
      ? store.getOperationalState()
      : null;
    if (storeState && storeState.lagging === true) return true;
    const timeline = getTimeline();
    const timelineState = timeline && typeof timeline.getOperationalState === 'function'
      ? timeline.getOperationalState()
      : null;
    return !!(
      timelineState
      && (
        timelineState.playing === true
        || timelineState.paused === true
        || Number(timelineState.pendingFrameCount) > 0
      )
    );
  };

  return Object.freeze({
    setPreparedState(value: BoardVisualPreparedState | null): BoardVisualPreparedState | null {
      const previous = preparedState;
      preparedState = value && typeof value === 'object'
        ? Object.freeze({
          gameState: value.gameState,
          cardState: value.cardState,
          ...(toIntegerOrNull(value.stateVersion) !== null
            ? { stateVersion: toIntegerOrNull(value.stateVersion)! }
            : {})
        })
        : null;
      return previous;
    },
    getPreparedState: () => preparedState,
    resolveNetworkSnapshot,
    resolvePair,
    resolveReceiptBoundPair,
    resolveNetworkInputEpoch,
    isStrictNetworkVisualRenderActive
  });
}
