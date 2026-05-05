"use strict";
const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');
const BoardOps = require('../game/logic/board_ops');
function createPrng(sequence = [0.5]) {
    let index = 0;
    return {
        shuffle: (arr) => arr,
        random: () => {
            const safeIndex = Math.min(index, sequence.length - 1);
            const value = sequence[safeIndex];
            index += 1;
            return value;
        }
    };
}
function createGameState(board) {
    return {
        board,
        currentPlayer: Shared.BLACK,
        turnNumber: 1,
        consecutivePasses: 0
    };
}
function createSparseGameState(blackPositions, whitePositions) {
    const board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
    for (const [row, col] of blackPositions || [])
        board[row][col] = Shared.BLACK;
    for (const [row, col] of whitePositions || [])
        board[row][col] = Shared.WHITE;
    return createGameState(board);
}
function createDenseGameState(emptyPositions, blackCount, whiteCount) {
    const board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
    const emptySet = new Set((emptyPositions || []).map(([row, col]) => `${row},${col}`));
    const totalFilled = Number(blackCount) + Number(whiteCount);
    if (totalFilled !== (64 - emptySet.size)) {
        throw new Error('blackCount + whiteCount must match the non-empty cell count');
    }
    let remainingWhite = Number(whiteCount);
    let remainingBlack = Number(blackCount);
    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            if (emptySet.has(`${row},${col}`))
                continue;
            if (remainingWhite > 0) {
                board[row][col] = Shared.WHITE;
                remainingWhite -= 1;
                continue;
            }
            if (remainingBlack > 0) {
                board[row][col] = Shared.BLACK;
                remainingBlack -= 1;
                continue;
            }
        }
    }
    if (remainingWhite !== 0 || remainingBlack !== 0) {
        throw new Error('failed to allocate the requested disc counts');
    }
    return createGameState(board);
}
function createCardState(prng, cardId, cost) {
    const cardState = CardLogic.createCardState(prng);
    cardState.debugNoDraw = true;
    cardState.hands.black = [cardId];
    cardState.charge.black = Math.max(99, Number(cost) || 0);
    return cardState;
}
function getEqualityWillDef() {
    return (Shared.CARD_DEFS || []).find((card) => card && card.type === 'EQUALITY_WILL');
}
function getEqualitySpawnEvents(result) {
    return (result.presentationEvents || []).filter((event) => (event &&
        event.type === 'SPAWN' &&
        event.cause === 'EQUALITY_WILL' &&
        event.reason === 'equality_will_spawn'));
}
function getEqualityFlipEvents(result) {
    return (result.presentationEvents || []).filter((event) => (event &&
        event.type === 'CHANGE' &&
        event.cause === 'EQUALITY_WILL' &&
        event.reason === 'equality_will_flip'));
}
describe('EQUALITY_WILL（平等の意志）', () => {
    const equalityWillDef = getEqualityWillDef();
    test('盤面石数 helper は比較条件と同じ黒白カウントを返す', () => {
        const gameState = createSparseGameState([[7, 7], [7, 6]], [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [3, 0], [3, 1]]);
        expect(CardLogic.getEqualityWillBoardCounts(gameState)).toEqual({ black: 2, white: 11 });
    });
    test('10個差未満では使用できない', () => {
        expect(equalityWillDef).toBeTruthy();
        const prng = createPrng([0]);
        const cardState = createCardState(prng, equalityWillDef.id, equalityWillDef.cost);
        const gameState = createSparseGameState([[7, 7]], [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [3, 0]]);
        expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([]);
        expect(CardLogic.applyCardUsage(cardState, gameState, 'black', equalityWillDef.id)).toBe(false);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('ちょうど10個差なら使用できる', () => {
        expect(equalityWillDef).toBeTruthy();
        const prng = createPrng([0]);
        const cardState = createCardState(prng, equalityWillDef.id, equalityWillDef.cost);
        const gameState = createSparseGameState([[7, 7]], [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [3, 0], [3, 1]]);
        expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([equalityWillDef.id]);
        expect(CardLogic.applyCardUsage(cardState, gameState, 'black', equalityWillDef.id)).toBe(true);
        expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
            type: 'EQUALITY_WILL',
            cardId: equalityWillDef.id,
            stage: null
        }));
    });
    test('use_cardで即時解決し、固定PRNGで生成位置・メタデータが決まり、生成石から通常反転する', () => {
        expect(equalityWillDef).toBeTruthy();
        const prng = createPrng([0, 0, 0]);
        const cardState = createCardState(prng, equalityWillDef.id, equalityWillDef.cost);
        const gameState = createSparseGameState([[0, 0]], [[0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7]]);
        expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([equalityWillDef.id]);
        const spawnSpy = jest.spyOn(BoardOps, 'spawnAt');
        try {
            const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: equalityWillDef.id }, prng);
            const resolveEvent = result.events.find((event) => event && event.type === 'equality_will_resolved');
            const spawnEvents = getEqualitySpawnEvents(result);
            const flipEvents = getEqualityFlipEvents(result);
            expect(result.cardState.pendingEffectByPlayer.black).toBeNull();
            expect(resolveEvent).toMatchObject({
                type: 'equality_will_resolved',
                player: 'black',
                requestedCount: 3,
                spawnedCount: 3,
                flippedCount: 3
            });
            expect((resolveEvent.spawned || []).map((entry) => [entry.row, entry.col])).toEqual([
                [0, 4],
                [0, 5],
                [0, 6]
            ]);
            expect((resolveEvent.flipped || []).map((entry) => [entry.row, entry.col])).toEqual([
                [0, 3],
                [0, 2],
                [0, 1]
            ]);
            expect(spawnSpy).toHaveBeenCalledTimes(3);
            expect(spawnSpy.mock.calls.map((call) => [call[2], call[3]])).toEqual([
                [0, 4],
                [0, 5],
                [0, 6]
            ]);
            for (const call of spawnSpy.mock.calls) {
                expect(call[4]).toBe('black');
                expect(call[5]).toBe('EQUALITY_WILL');
                expect(call[6]).toBe('equality_will_spawn');
                expect(call[7]).toEqual(expect.objectContaining({
                    owner: 'black',
                    requestedCount: 3
                }));
            }
            expect(spawnEvents).toHaveLength(3);
            expect(spawnEvents.map((event) => [event.row, event.col])).toEqual([
                [0, 4],
                [0, 5],
                [0, 6]
            ]);
            expect(spawnEvents.map((event) => event.meta && event.meta.spawnIndex)).toEqual([1, 2, 3]);
            for (const event of spawnEvents) {
                expect(event.meta).toEqual(expect.objectContaining({
                    owner: 'black',
                    requestedCount: 3
                }));
            }
            expect(flipEvents.map((event) => [event.row, event.col])).toEqual([
                [0, 3],
                [0, 2],
                [0, 1]
            ]);
            expect(gameState.board[0][1]).toBe(Shared.BLACK);
            expect(gameState.board[0][2]).toBe(Shared.BLACK);
            expect(gameState.board[0][3]).toBe(Shared.BLACK);
            expect(gameState.board[0][4]).toBe(Shared.BLACK);
            expect(gameState.board[0][5]).toBe(Shared.BLACK);
            expect(gameState.board[0][6]).toBe(Shared.BLACK);
            expect(result.cardState.totalFlipCountByPlayer.black).toBe(3);
        }
        finally {
            spawnSpy.mockRestore();
        }
    });
    test('空きマスが3未満なら存在する数だけ生成する', () => {
        expect(equalityWillDef).toBeTruthy();
        const prng = createPrng([0, 0, 0]);
        const cardState = createCardState(prng, equalityWillDef.id, equalityWillDef.cost);
        const gameState = createDenseGameState([[7, 6], [7, 7]], 26, 36);
        const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: equalityWillDef.id }, prng);
        const resolveEvent = result.events.find((event) => event && event.type === 'equality_will_resolved');
        const spawnEvents = getEqualitySpawnEvents(result);
        expect(result.cardState.pendingEffectByPlayer.black).toBeNull();
        expect(resolveEvent).toMatchObject({
            type: 'equality_will_resolved',
            player: 'black',
            requestedCount: 3,
            spawnedCount: 2
        });
        expect((resolveEvent.spawned || []).map((entry) => [entry.row, entry.col])).toEqual([
            [7, 6],
            [7, 7]
        ]);
        expect(spawnEvents).toHaveLength(2);
        expect(spawnEvents.map((event) => [event.row, event.col])).toEqual([
            [7, 6],
            [7, 7]
        ]);
        expect(new Set(spawnEvents.map((event) => `${event.row},${event.col}`)).size).toBe(2);
        expect(gameState.board[7][6]).toBe(Shared.BLACK);
        expect(gameState.board[7][7]).toBe(Shared.BLACK);
    });
});
//# sourceMappingURL=game.equality-will.test.js.map