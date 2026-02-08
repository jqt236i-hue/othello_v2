/**
 * 金/銀の意志 — プレゼンテーションイベント → playback イベント変換テスト
 *
 * 確認事項:
 * 1. SPAWN と DESTROY が別フェーズに分離される（UI が石を表示→フェード→消す順序を保証）
 * 2. DESTROY の after.color === 0（EMPTY 状態）
 * 3. 通常石の SPAWN は DESTROY を含まない（回帰確認）
 */
const path = require('path');

describe('金/銀 — pipeline_ui_adapter 変換', () => {
    let adapter;

    beforeEach(() => {
        jest.resetModules();
        global.BLACK = 1;
        global.WHITE = -1;
        global.EMPTY = 0;
        adapter = require('../game/turn/pipeline_ui_adapter');
    });

    afterEach(() => {
        delete global.BLACK;
        delete global.WHITE;
        delete global.EMPTY;
    });

    function makeMinimalState() {
        return {
            gameState: {
                board: Array.from({ length: 8 }, () => Array(8).fill(0)),
                currentPlayer: -1
            },
            cardState: {
                markers: [],
                turnIndex: 1,
                stoneIdMap: Array.from({ length: 8 }, () => Array(8).fill(null))
            }
        };
    }

    test('GOLD_STONE: SPAWN → CHANGE → DESTROY の順で、DESTROY は後のフェーズに入る', () => {
        const { gameState, cardState } = makeMinimalState();

        const presEvents = [
            { type: 'CARD_USED', player: 'black', cardId: 'gold_stone', meta: { owner: 'black', cost: 6, name: '金の意志' } },
            { type: 'SPAWN', stoneId: 's5', row: 2, col: 3, ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_place', meta: {} },
            { type: 'CHANGE', stoneId: 's1', row: 3, col: 3, ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip', meta: {} },
            { type: 'DESTROY', stoneId: 's5', row: 2, col: 3, ownerBefore: 'black', cause: 'SYSTEM', reason: 'gold_stone_sacrifice', meta: {} }
        ];

        const playback = adapter.mapToPlaybackEvents(presEvents, cardState, gameState);

        // spawn event
        const spawn = playback.find(e => e.type === 'spawn');
        expect(spawn).toBeDefined();

        // flip event
        const flip = playback.find(e => e.type === 'flip');
        expect(flip).toBeDefined();

        // destroy event
        const destroy = playback.find(e => e.type === 'destroy');
        expect(destroy).toBeDefined();
        expect(destroy.targets[0].after.color).toBe(0); // EMPTY

        // Key assertion: destroy is in a later phase than spawn
        expect(destroy.phase).toBeGreaterThan(spawn.phase);
    });

    test('SILVER_STONE: DESTROY は SPAWN/CHANGE より後のフェーズ', () => {
        const { gameState, cardState } = makeMinimalState();

        const presEvents = [
            { type: 'CARD_USED', player: 'black', cardId: 'silver_stone', meta: { owner: 'black', cost: 4, name: '銀の意志' } },
            { type: 'SPAWN', stoneId: 's5', row: 2, col: 3, ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_place', meta: {} },
            { type: 'CHANGE', stoneId: 's1', row: 3, col: 3, ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip', meta: {} },
            { type: 'DESTROY', stoneId: 's5', row: 2, col: 3, ownerBefore: 'black', cause: 'SYSTEM', reason: 'silver_stone_sacrifice', meta: {} }
        ];

        const playback = adapter.mapToPlaybackEvents(presEvents, cardState, gameState);
        const spawn = playback.find(e => e.type === 'spawn');
        const destroy = playback.find(e => e.type === 'destroy');

        expect(spawn).toBeDefined();
        expect(destroy).toBeDefined();
        expect(destroy.phase).toBeGreaterThan(spawn.phase);
    });

    test('通常配置: DESTROY イベントを含まない（回帰確認）', () => {
        const { gameState, cardState } = makeMinimalState();
        gameState.board[2][3] = 1; // placed stone remains

        const presEvents = [
            { type: 'SPAWN', stoneId: 's5', row: 2, col: 3, ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_place', meta: {} },
            { type: 'CHANGE', stoneId: 's1', row: 3, col: 3, ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip', meta: {} }
        ];

        const playback = adapter.mapToPlaybackEvents(presEvents, cardState, gameState);

        const destroy = playback.find(e => e.type === 'destroy');
        expect(destroy).toBeUndefined();

        const spawn = playback.find(e => e.type === 'spawn');
        expect(spawn).toBeDefined();
    });
});
