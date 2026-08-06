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
});
