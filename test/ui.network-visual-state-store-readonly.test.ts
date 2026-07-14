import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';

const Store = require('../ui/network/visual-state-store');

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value as any).forEach(deepFreeze);
  return value;
}

function snapshot(version: number, label: string) {
  return {
    stateVersion: version,
    gameState: {
      currentPlayer: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      label
    },
    cardState: {
      markers: [],
      hands: { black: [label], white: [] },
      pendingEffectByPlayer: { black: null, white: null },
      fateWillControllerByTurnOwner: {}
    }
  };
}

describe('NetworkVisualStateStore clone inventory and readonly rendering', () => {
  test('deep-freezes production-owned snapshots before exposing a zero-copy peek', () => {
    const store = Store.createNetworkVisualStateStore();
    const source = snapshot(3, 'owned');

    store.setCanonicalSnapshot(source);
    const peeked = store.peekRenderSnapshot();

    expect(peeked).not.toBe(source);
    expect(Object.isFrozen(peeked)).toBe(true);
    expect(Object.isFrozen(peeked.gameState)).toBe(true);
    expect(Object.isFrozen(peeked.gameState.board)).toBe(true);
    expect(Object.isFrozen(peeked.gameState.board[0])).toBe(true);
    expect(Object.isFrozen(peeked.cardState.hands.black)).toBe(true);

    source.gameState.label = 'mutated-source';
    source.gameState.board[0][0] = 1;
    expect(peeked.gameState.label).toBe('owned');
    expect(peeked.gameState.board[0][0]).toBe(0);
  });

  test('strict network board rendering prefers readonly peek and keeps clone getter as fallback', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'board-renderer.ts'), 'utf8');
    const resolver = source.slice(
      source.indexOf('function _resolveBoardRenderStateForBoardRenderer()'),
      source.indexOf('function _getBoardShapeForBoardRenderer()')
    );

    expect(resolver).toContain("typeof store.peekRenderSnapshot === 'function'");
    expect(resolver).toContain('store.peekRenderSnapshot()');
    expect(resolver).toContain("typeof store.getRenderSnapshot === 'function'");
    expect(resolver.indexOf('store.peekRenderSnapshot()')).toBeLessThan(resolver.indexOf('store.getRenderSnapshot()'));
  });

  test('characterizes ownership clones for set/get/frame/render operations', () => {
    const cloneReasons: string[] = [];
    const store = Store.createNetworkVisualStateStore({
      cloneData: (value: any) => deepClone(value),
      onClone: (reason: string) => cloneReasons.push(reason)
    });
    const canonical = snapshot(2, 'canonical');
    const visual = snapshot(1, 'visual');

    store.setCanonicalSnapshot(canonical, { stateVersion: 2 });
    store.setBaseVisualSnapshot(visual, { visualSeq: 0, visualVersion: 1 });
    const canonicalRead = store.getCanonicalSnapshot();
    const visualRead = store.getVisualSnapshot();
    const laggingRenderRead = store.getRenderSnapshot();
    store.commitFrame({ visualSeq: 1, stateVersionTo: 2, snapshotAfter: canonical });
    const committedRenderRead = store.getRenderSnapshot();
    store.clearVisualSnapshot();
    const idleRenderRead = store.getRenderSnapshot();

    expect(cloneReasons).toEqual([
      'setCanonicalSnapshot',
      'setBaseVisualSnapshot',
      'getCanonicalSnapshot',
      'getVisualSnapshot',
      'getRenderSnapshot',
      'commitFrame',
      'getRenderSnapshot',
      'getCanonicalSnapshot'
    ]);
    expect(laggingRenderRead.gameState.label).toBe('visual');
    expect(committedRenderRead.gameState.label).toBe('canonical');
    expect(idleRenderRead.gameState.label).toBe('canonical');

    canonicalRead.gameState.label = 'mutated-canonical-read';
    visualRead.gameState.label = 'mutated-visual-read';
    expect(store.getCanonicalSnapshot().gameState.label).toBe('canonical');
    store.setBaseVisualSnapshot(visual, { visualSeq: 0, visualVersion: 1 });
    expect(store.getVisualSnapshot().gameState.label).toBe('visual');
  });

  test('frozen render snapshot survives board projection without mutation', () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).boardEl = dom.window.document.getElementById('board');
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).getPlayerKey = (player: number) => player === 1 ? 'black' : 'white';
    (global as any).getLegalMoves = jest.fn(() => []);
    (global as any).CardLogic = {
      getCardContext: jest.fn(() => ({ protectedStones: [], permaProtectedStones: [], bombs: [], blockedCells: [] })),
      getSelectableTargets: jest.fn(() => []),
      isFreePlacementPendingType: jest.fn(() => false)
    };

    try {
      const store = Store.createNetworkVisualStateStore({
        cloneData: (value: any) => deepClone(value),
        freezeOwnedSnapshot: (value: any) => deepFreeze(value)
      });
      store.setCanonicalSnapshot(snapshot(2, 'canonical'));
      store.setBaseVisualSnapshot(snapshot(1, 'visual'), { visualSeq: 0, visualVersion: 1 });
      const frozenRenderSnapshot = store.getRenderSnapshot();
      const before = JSON.stringify(frozenRenderSnapshot);
      (global as any).gameState = frozenRenderSnapshot.gameState;
      (global as any).cardState = frozenRenderSnapshot.cardState;
      const diff = require('../ui/diff-renderer.js');

      expect(Object.isFrozen(frozenRenderSnapshot)).toBe(true);
      expect(Object.isFrozen(frozenRenderSnapshot.gameState.board)).toBe(true);
      expect(() => diff.buildCurrentCellState(diff.createBoardRenderProjection())).not.toThrow();
      expect(JSON.stringify(frozenRenderSnapshot)).toBe(before);
      expect(store.getDiagnostics()).toMatchObject({ canonicalVersion: 2, visualVersion: 1, lagging: true });
    } finally {
      dom.window.close();
      for (const key of ['window', 'document', 'HTMLElement', 'boardEl', 'BLACK', 'WHITE', 'EMPTY', 'getPlayerKey', 'getLegalMoves', 'CardLogic', 'gameState', 'cardState']) {
        delete (global as any)[key];
      }
    }
  });

  test('readonly render peek returns the selected owned snapshot without cloning', () => {
    const cloneReasons: string[] = [];
    const peeked: any[] = [];
    const store = Store.createNetworkVisualStateStore({
      cloneData: (value: any) => deepClone(value),
      onClone: (reason: string) => cloneReasons.push(reason),
      onReadonlyPeek: (_reason: string, value: any) => peeked.push(value),
      freezeOwnedSnapshot: (value: any) => deepFreeze(value)
    });
    store.setCanonicalSnapshot(snapshot(2, 'canonical'));
    store.setBaseVisualSnapshot(snapshot(1, 'visual'), { visualSeq: 0, visualVersion: 1 });
    const clonesBeforePeek = cloneReasons.length;

    const laggingPeek = store.peekRenderSnapshot();
    const secondLaggingPeek = store.peekRenderSnapshot();

    expect(cloneReasons).toHaveLength(clonesBeforePeek);
    expect(laggingPeek).toBe(secondLaggingPeek);
    expect(laggingPeek.gameState.label).toBe('visual');
    expect(Object.isFrozen(laggingPeek)).toBe(true);
    expect(peeked).toEqual([laggingPeek, laggingPeek]);

    const publicClone = store.getRenderSnapshot();
    expect(publicClone).not.toBe(laggingPeek);
    expect(publicClone).toEqual(laggingPeek);
    store.clearVisualSnapshot();
    expect(store.peekRenderSnapshot().gameState.label).toBe('canonical');
  });

  test('returns the same frozen committed snapshot only for the current store receipt', () => {
    const store = Store.createNetworkVisualStateStore();
    const otherStore = Store.createNetworkVisualStateStore();
    const committed = snapshot(4, 'committed');
    const receipt = store.commitFrame({
      visualSeq: 1,
      stateVersionFrom: 3,
      stateVersionTo: 4,
      snapshotAfter: committed
    });
    const boundSnapshot = store.getSnapshotForReceipt(receipt);

    expect(store.isCurrentCommitReceipt(receipt)).toBe(true);
    expect(otherStore.isCurrentCommitReceipt(receipt)).toBe(false);
    expect(boundSnapshot).toBe(store.peekRenderSnapshot());
    expect(Object.isFrozen(boundSnapshot)).toBe(true);
    expect(Object.isFrozen(boundSnapshot.gameState.board[0])).toBe(true);

    const forgedReceipt = Object.freeze({ ...receipt });
    expect(store.isCurrentCommitReceipt(forgedReceipt)).toBe(false);
    expect(store.getSnapshotForReceipt(forgedReceipt)).toBeNull();
    expect(otherStore.getSnapshotForReceipt(receipt)).toBeNull();
  });
});
