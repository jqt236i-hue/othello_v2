import * as fs from 'fs';
import * as path from 'path';

const {
  createBoardVisualRenderStateSource
} = require('../ui/board-visual/render-state-source');

function createHarness(options?: any) {
  const localPair = options?.localPair || {
    gameState: { label: 'local-game' },
    cardState: { label: 'local-card' }
  };
  const store = options?.store || null;
  const timeline = options?.timeline || null;
  return createBoardVisualRenderStateSource({
    getVisualStore: () => store,
    getPresentationTimeline: () => timeline,
    getLocalPair: () => localPair
  });
}

describe('board visual render-state source', () => {
  test('is dependency-injected and contains no browser-global discovery', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'ui', 'board-visual', 'render-state-source.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/\bwindow\b/);
    expect(source).not.toMatch(/\bglobalThis\b/);
    expect(source).not.toContain('getDiagnostics(');
  });

  test('prefers a readonly network peek and never calls the clone fallback when available', () => {
    const peeked = {
      stateVersion: 4,
      gameState: { label: 'visual-game' },
      cardState: { label: 'visual-card' }
    };
    const store = {
      peekRenderSnapshot: jest.fn(() => peeked),
      getRenderSnapshot: jest.fn(() => ({
        gameState: { label: 'clone-game' },
        cardState: { label: 'clone-card' }
      }))
    };
    const source = createHarness({ store });

    expect(source.resolvePair()).toEqual({
      gameState: peeked.gameState,
      cardState: peeked.cardState,
      stateVersion: 4,
      source: 'network_visual_state'
    });
    expect(store.peekRenderSnapshot).toHaveBeenCalledTimes(1);
    expect(store.getRenderSnapshot).not.toHaveBeenCalled();
  });

  test('keeps prepared overrides instance-scoped and restores the previous pair explicitly', () => {
    const first = createHarness();
    const second = createHarness();
    const prepared = {
      stateVersion: 8,
      gameState: { label: 'prepared-game' },
      cardState: { label: 'prepared-card' }
    };

    const previous = first.setPreparedState(prepared);
    expect(previous).toBeNull();
    expect(first.resolvePair()).toMatchObject({ source: 'prepared', stateVersion: 8 });
    expect(second.resolvePair()).toMatchObject({ source: 'local' });

    expect(first.setPreparedState(previous)).toEqual(prepared);
    expect(first.resolvePair()).toMatchObject({ source: 'local' });
  });

  test('preserves the pre-game local pair for guarded bootstrap consumers', () => {
    const source = createHarness({
      localPair: { gameState: null, cardState: {} }
    });

    expect(source.resolvePair()).toEqual({
      gameState: null,
      cardState: {},
      source: 'local'
    });
  });

  test('uses lightweight operational state for strict activity and input epoch', () => {
    const store = {
      getOperationalState: jest.fn(() => ({
        canonicalVersion: 6,
        visualSeq: 3,
        visualVersion: 5,
        lagging: true,
        hasCanonicalSnapshot: true,
        hasVisualSnapshot: true
      }))
    };
    const timeline = {
      getOperationalState: jest.fn(() => ({
        visualSeq: 3,
        visualVersion: 5,
        pendingFrameCount: 0,
        playing: false,
        paused: false,
        blocksInput: false,
        disposed: false,
        disposing: false
      }))
    };
    const source = createHarness({ store, timeline });

    expect(source.isStrictNetworkVisualRenderActive()).toBe(true);
    expect(source.resolveNetworkInputEpoch(
      { stateVersion: 6 },
      { isNetworkMode: true }
    )).toEqual({ stateVersion: 6, visualSeq: 3 });
    expect(store.getOperationalState).toHaveBeenCalled();
  });

  test('resolves only the exact current receipt and never falls back to latest or local state', () => {
    const receipt = Object.freeze({ kind: 'network-visual-commit', visualSeq: 2 });
    const bound = {
      stateVersion: 7,
      gameState: { label: 'bound-game' },
      cardState: { label: 'bound-card' }
    };
    const store = {
      isCurrentCommitReceipt: jest.fn((value) => value === receipt),
      getSnapshotForReceipt: jest.fn((value) => value === receipt ? bound : null),
      peekRenderSnapshot: jest.fn(() => ({
        gameState: { label: 'latest-game' },
        cardState: { label: 'latest-card' }
      }))
    };
    const source = createHarness({ store });

    expect(source.resolveReceiptBoundPair(receipt)).toEqual({
      gameState: bound.gameState,
      cardState: bound.cardState,
      stateVersion: 7,
      source: 'receipt_bound'
    });
    expect(store.peekRenderSnapshot).not.toHaveBeenCalled();
    expect(() => source.resolveReceiptBoundPair(Object.freeze({ ...receipt })))
      .toThrow('Committed board visual receipt is not current for the visual store');
    expect(store.peekRenderSnapshot).not.toHaveBeenCalled();
  });

  describe('local multi-stage selection preview', () => {
    function createSelectionHarness(localPending: any, overrides?: any) {
      const networkPending = { type: 'BOARD_SHRINK_WILL', stage: 'selectTarget', pendingEffectId: 'pe-1', selectedTargets: [] };
      const snapshot = {
        stateVersion: 7,
        gameState: { currentPlayer: 1, turnNumber: 5 },
        cardState: { label: 'visual-card', pendingEffectByPlayer: { black: networkPending, white: null } }
      };
      const localPair = {
        gameState: { currentPlayer: 1, turnNumber: 5, ...(overrides?.localGameState || {}) },
        cardState: { pendingEffectByPlayer: { black: localPending, white: null } }
      };
      const store = {
        peekRenderSnapshot: () => snapshot,
        getOperationalState: () => ({ lagging: false })
      };
      const timeline = overrides?.timeline || null;
      return { source: createHarness({ store, localPair, timeline }), snapshot, networkPending };
    }

    test('shows cells the local player already picked before the final target is published', () => {
      const localPending = {
        type: 'BOARD_SHRINK_WILL',
        stage: 'selectTarget',
        pendingEffectId: 'pe-1',
        selectedTargets: [{ row: 0, col: 0 }]
      };
      const { source, snapshot } = createSelectionHarness(localPending);
      const pair = source.resolvePair();

      expect(pair.source).toBe('network_visual_state');
      expect(pair.gameState).toBe(snapshot.gameState);
      expect(pair.cardState.label).toBe('visual-card');
      expect(pair.cardState.pendingEffectByPlayer.black).toBe(localPending);
      expect(snapshot.cardState.pendingEffectByPlayer.black.selectedTargets).toEqual([]);
    });

    test('keeps the network pending when the local pending belongs to another instance or turn', () => {
      const otherInstance = { type: 'BOARD_SHRINK_WILL', stage: 'selectTarget', pendingEffectId: 'pe-0', selectedTargets: [{ row: 0, col: 0 }] };
      const first = createSelectionHarness(otherInstance);
      expect(first.source.resolvePair().cardState.pendingEffectByPlayer.black).toBe(first.networkPending);

      const sameInstance = { type: 'BOARD_SHRINK_WILL', stage: 'selectTarget', pendingEffectId: 'pe-1', selectedTargets: [{ row: 0, col: 0 }] };
      const otherTurn = createSelectionHarness(sameInstance, { localGameState: { turnNumber: 6 } });
      expect(otherTurn.source.resolvePair().cardState.pendingEffectByPlayer.black).toBe(otherTurn.networkPending);

      const noProgress = createSelectionHarness({ type: 'BOARD_SHRINK_WILL', stage: 'selectTarget', pendingEffectId: 'pe-1', selectedTargets: [] });
      expect(noProgress.source.resolvePair().cardState.pendingEffectByPlayer.black).toBe(noProgress.networkPending);
    });

    test('does not mix the local preview into playback frames', () => {
      const localPending = { type: 'BOARD_SHRINK_WILL', stage: 'selectTarget', pendingEffectId: 'pe-1', selectedTargets: [{ row: 0, col: 0 }] };
      const { source, networkPending } = createSelectionHarness(localPending, {
        timeline: { getOperationalState: () => ({ playing: true, paused: false, pendingFrameCount: 1 }) }
      });
      expect(source.resolvePair().cardState.pendingEffectByPlayer.black).toBe(networkPending);
    });
  });
});
