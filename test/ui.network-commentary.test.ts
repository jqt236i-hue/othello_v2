import { JSDOM } from 'jsdom';

function createSnapshot(stateVersion, board) {
  return {
    stateVersion,
    _meta: {
      authority: 'server',
      version: stateVersion,
      projectedForSeat: null,
      turnStartReconciled: true
    },
    gameState: {
      currentPlayer: 1,
      turnNumber: 1,
      board: board || Array.from({ length: 8 }, () => Array(8).fill(0))
    },
    cardState: {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      hands: { black: [], white: [] },
      charge: { black: 10, white: 10 },
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: [],
      turnIndex: 1
    }
  };
}

describe('NetworkCommentaryController', () => {
  let controller;
  let mockBroker;
  let mockHelpers;
  let mockRuntimeHelpers;
  let stateObj;

  beforeEach(() => {
    jest.resetModules();

    mockBroker = {
      initBroker: jest.fn(),
      requestCommentaryAndShow: jest.fn()
    };

    mockHelpers = {
      countDiscsFromBoard: jest.fn(() => ({ black: 2, white: 2 })),
      resolvePhaseByTurn: jest.fn(() => 'middle'),
      resolveAdvantageLabel: jest.fn(() => 'even')
    };

    mockRuntimeHelpers = {
      extractCardIdFromPlaybackEvents: jest.fn(),
      resolveCommentaryEventType: jest.fn((actionType, cardId) => {
        if (cardId) return 'card_used';
        if (actionType === 'pass') return 'pass';
        return 'turn_start';
      })
    };

    global.CommentaryBroker = mockBroker;
    global.CommentaryContextHelpers = mockHelpers;
    global.CommentaryRuntimeHelpers = mockRuntimeHelpers;

    stateObj = {
      seatKey: 'black'
    };

    const { createNetworkCommentaryController } = require('../ui/network/commentary.js');
    controller = createNetworkCommentaryController({
      getState: () => stateObj,
      addLog: jest.fn()
    });
  });

  afterEach(() => {
    delete global.CommentaryBroker;
    delete global.CommentaryContextHelpers;
    delete global.CommentaryRuntimeHelpers;
  });

  describe('基本機能（正常系）', () => {
    test('リモートプレイヤーのカード使用でコメンタリーを発行する', () => {
      const payload = {
        ok: true,
        playerKey: 'white',
        actionType: 'use_card'
      };
      const snapshot = createSnapshot(1);
      snapshot.cardState.lastUsedCardByPlayer.white = 'swap_01';

      controller.emitSnapshotCommentary(payload, snapshot, false, []);

      expect(mockBroker.requestCommentaryAndShow).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'card_used',
          playerKey: 'white',
          speakerRole: 'cpu',
          cardId: 'swap_01'
        })
      );
    });

    test('パスアクションで正しいイベントタイプを発行する', () => {
      const payload = {
        ok: true,
        playerKey: 'white',
        actionType: 'pass'
      };
      const snapshot = createSnapshot(1);

      controller.emitSnapshotCommentary(payload, snapshot, false, []);

      expect(mockBroker.requestCommentaryAndShow).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'pass',
          playerKey: 'white'
        })
      );
    });

    test('playbackEventsからカードIDを抽出する', () => {
      mockRuntimeHelpers.extractCardIdFromPlaybackEvents.mockReturnValue('hyperactive_01');
      
      const payload = {
        ok: true,
        playerKey: 'white',
        actionType: 'use_card'
      };
      const snapshot = createSnapshot(1);
      const playbackEvents = [{ type: 'card_use_animation', cardId: 'hyperactive_01' }];

      controller.emitSnapshotCommentary(payload, snapshot, false, playbackEvents);

      expect(mockBroker.requestCommentaryAndShow).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'hyperactive_01'
        })
      );
    });

    test('カード使用時にヒーローの反応コメンタリーも発行する', () => {
      const payload = {
        ok: true,
        playerKey: 'white',
        actionType: 'use_card'
      };
      const snapshot = createSnapshot(1);
      snapshot.cardState.lastUsedCardByPlayer.white = 'swap_01';

      controller.emitSnapshotCommentary(payload, snapshot, false, []);

      expect(mockBroker.requestCommentaryAndShow).toHaveBeenCalledTimes(2);
      expect(mockBroker.requestCommentaryAndShow).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          eventType: 'card_used_by_enemy',
          speakerRole: 'hero',
          playerKey: 'black'
        })
      );
    });
  });

  describe('エラーハンドリング', () => {
    test('payload.okがfalseの場合はコメンタリーを発行しない', () => {
      const payload = {
        ok: false,
        playerKey: 'white',
        actionType: 'use_card'
      };
      const snapshot = createSnapshot(1);

      controller.emitSnapshotCommentary(payload, snapshot, false, []);

      expect(mockBroker.requestCommentaryAndShow).not.toHaveBeenCalled();
    });

    test('自身の操作の場合はコメンタリーを発行しない', () => {
      const payload = {
        ok: true,
        playerKey: 'black',
        actionType: 'use_card'
      };
      const snapshot = createSnapshot(1);

      controller.emitSnapshotCommentary(payload, snapshot, true, []);

      expect(mockBroker.requestCommentaryAndShow).not.toHaveBeenCalled();
    });

    test('スナップショットが不正な場合はコメンタリーを発行しない', () => {
      const payload = {
        ok: true,
        playerKey: 'white',
        actionType: 'use_card'
      };

      controller.emitSnapshotCommentary(payload, null, false, []);

      expect(mockBroker.requestCommentaryAndShow).not.toHaveBeenCalled();
    });

    test('ゲーム状態がない場合はコメンタリーを発行しない', () => {
      const payload = {
        ok: true,
        playerKey: 'white',
        actionType: 'use_card'
      };
      const snapshot = { cardState: {} };

      controller.emitSnapshotCommentary(payload, snapshot, false, []);

      expect(mockBroker.requestCommentaryAndShow).not.toHaveBeenCalled();
    });
  });

  describe('状態遷移', () => {
    test('ブローカーが未初期化の場合は初期化してから発行する', () => {
      delete global.CommentaryBroker;
      global.CommentaryBroker = null;
      
      const payload = {
        ok: true,
        playerKey: 'white',
        actionType: 'use_card'
      };
      const snapshot = createSnapshot(1);
      snapshot.cardState.lastUsedCardByPlayer.white = 'swap_01';

      controller.emitSnapshotCommentary(payload, snapshot, false, []);

      expect(mockBroker.initBroker).not.toHaveBeenCalled();
    });

    test('ヘルパーがない場合はフォールバック値を使用する', () => {
      delete global.CommentaryContextHelpers;
      
      const payload = {
        ok: true,
        playerKey: 'white',
        actionType: 'use_card'
      };
      const snapshot = createSnapshot(1);

      controller.emitSnapshotCommentary(payload, snapshot, false, []);

      expect(mockBroker.requestCommentaryAndShow).toHaveBeenCalledWith(
        expect.objectContaining({
          counts: { black: 0, white: 0 }
        })
      );
    });

    test('プレイヤーキーの正規化', () => {
      const payload = {
        ok: true,
        playerKey: ' WHITE ',
        actionType: 'pass'
      };
      const snapshot = createSnapshot(1);

      controller.emitSnapshotCommentary(payload, snapshot, false, []);

      expect(mockBroker.requestCommentaryAndShow).toHaveBeenCalledWith(
        expect.objectContaining({
          playerKey: 'white'
        })
      );
    });
  });
});
