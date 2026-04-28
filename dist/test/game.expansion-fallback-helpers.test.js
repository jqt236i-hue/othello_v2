"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const Shared = __importStar(require("../shared-constants.js"));
const DragonEffects = __importStar(require("../game/logic/effects/dragon.js"));
function createBoard(rows = 8, cols = rows) {
    return Array.from({ length: rows }, () => Array(cols).fill(Shared.EMPTY));
}
function createExpansionState(cells) {
    return {
        active: false,
        side: null,
        row: null,
        owner: Shared.EMPTY,
        usedByPlayer: { black: true, white: true },
        cells: (cells || []).map((cell) => ({ ...cell }))
    };
}
function loadWithoutBoardOps(modulePath, extraMocks = []) {
    jest.resetModules();
    jest.doMock('../game/logic/board_ops', () => null);
    for (const [mockPath, factory] of extraMocks) {
        jest.doMock(mockPath, factory);
    }
    let loadedModule;
    jest.isolateModules(() => {
        loadedModule = require(modulePath);
    });
    jest.dontMock('../game/logic/board_ops');
    for (const [mockPath] of extraMocks) {
        jest.dontMock(mockPath);
    }
    return loadedModule;
}
afterEach(() => {
    jest.resetModules();
    jest.dontMock('../game/logic/board_ops');
    jest.dontMock('../game/logic/cards/utils');
});
describe('expansion fallback helpers', () => {
    test('DragonEffects converts top-edge and corner expansion cells around an expansion anchor', () => {
        const cardState = {
            markers: [{
                    id: 1,
                    kind: 'specialStone',
                    row: -1,
                    col: 0,
                    owner: 'black',
                    data: { type: 'DRAGON', remainingOwnerTurns: 5 }
                }]
        };
        const gameState = {
            board: createBoard(),
            boardExpansion: createExpansionState([
                { side: 'top', row: -1, col: 0, owner: Shared.BLACK },
                { side: 'left', row: -1, col: -1, owner: Shared.WHITE }
            ])
        };
        gameState.board[0][0] = Shared.WHITE;
        const out = DragonEffects.processDragonEffectsAtAnchor(cardState, gameState, 'black', -1, 0);
        expect(out.converted).toEqual(expect.arrayContaining([
            { row: -1, col: -1 },
            { row: 0, col: 0 }
        ]));
        expect(gameState.board[0][0]).toBe(Shared.BLACK);
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === -1 && cell.col === -1).owner).toBe(Shared.BLACK);
    });
    test('DragonEffects clears a bottom expansion anchor on expiry', () => {
        const cardState = {
            markers: [{
                    id: 2,
                    kind: 'specialStone',
                    row: 8,
                    col: 7,
                    owner: 'black',
                    data: { type: 'DRAGON', remainingOwnerTurns: 1 }
                }]
        };
        const gameState = {
            board: createBoard(),
            boardExpansion: createExpansionState([
                { side: 'bottom', row: 8, col: 7, owner: Shared.BLACK },
                { side: 'right', row: 7, col: 8, owner: Shared.WHITE }
            ])
        };
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                gameState.board[row][col] = Shared.WHITE;
            }
        }
        gameState.board[7][7] = Shared.WHITE;
        const out = DragonEffects.processDragonEffectsAtTurnStartAnchor(cardState, gameState, 'black', 8, 7);
        expect(out.converted).toEqual(expect.arrayContaining([
            { row: 7, col: 7 },
            { row: 7, col: 8 }
        ]));
        expect(out.destroyed).toEqual([expect.objectContaining({ row: 8, col: 7, reason: 'anchor_expired' })]);
        expect(gameState.board[7][7]).toBe(Shared.BLACK);
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 7 && cell.col === 8).owner).toBe(Shared.BLACK);
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 8 && cell.col === 7).owner).toBe(Shared.EMPTY);
        expect(cardState.markers).toEqual([]);
    });
    test('sniper fallback can target a top expansion cell without BoardOps', () => {
        const CardSniper = loadWithoutBoardOps('../game/logic/cards/sniper');
        const cardState = {
            markers: [{
                    id: 10,
                    kind: 'specialStone',
                    row: 0,
                    col: 0,
                    owner: 'black',
                    data: { type: 'SNIPER', remainingOwnerTurns: 2 }
                }]
        };
        const gameState = {
            board: createBoard(),
            boardExpansion: createExpansionState([
                { side: 'top', row: -1, col: 0, owner: Shared.WHITE }
            ])
        };
        gameState.board[0][0] = Shared.BLACK;
        const destroyAt = jest.fn(() => true);
        const out = CardSniper.processSniperWillEffects(cardState, gameState, 'black', { destroyAt, random: () => 0 });
        expect(destroyAt).toHaveBeenCalledWith(cardState, gameState, -1, 0);
        expect(out.destroyed).toEqual([expect.objectContaining({ row: -1, col: 0, sourceRow: 0, sourceCol: 0 })]);
    });
    test('sniper fallback can target a right expansion cell on 10x10 without BoardOps', () => {
        const CardSniper = loadWithoutBoardOps('../game/logic/cards/sniper');
        const cardState = {
            markers: [{
                    id: 101,
                    kind: 'specialStone',
                    row: 0,
                    col: 9,
                    owner: 'black',
                    data: { type: 'SNIPER', remainingOwnerTurns: 2 }
                }]
        };
        const gameState = {
            board: createBoard(10, 10),
            boardExpansion: createExpansionState([
                { side: 'right', row: 0, col: 10, owner: Shared.WHITE }
            ])
        };
        gameState.board[0][9] = Shared.BLACK;
        const destroyAt = jest.fn(() => true);
        const out = CardSniper.processSniperWillEffects(cardState, gameState, 'black', { destroyAt, random: () => 0 });
        expect(destroyAt).toHaveBeenCalledWith(cardState, gameState, 0, 10);
        expect(out.destroyed).toEqual([expect.objectContaining({ row: 0, col: 10, sourceRow: 0, sourceCol: 9 })]);
    });
    test('lightning fallback can target a bottom expansion cell without BoardOps', () => {
        const CardLightning = loadWithoutBoardOps('../game/logic/cards/lightning');
        const cardState = {
            markers: [{
                    id: 11,
                    kind: 'specialStone',
                    row: 7,
                    col: 7,
                    owner: 'black',
                    data: { type: 'LIGHTNING', remainingOwnerTurns: 2 }
                }]
        };
        const gameState = {
            board: createBoard(),
            boardExpansion: createExpansionState([
                { side: 'bottom', row: 8, col: 7, owner: Shared.WHITE }
            ])
        };
        gameState.board[7][7] = Shared.BLACK;
        const destroyAt = jest.fn(() => true);
        const out = CardLightning.processLightningWillEffects(cardState, gameState, 'black', { destroyAt, random: () => 0 });
        expect(destroyAt).toHaveBeenCalledWith(cardState, gameState, 8, 7);
        expect(out.destroyed).toEqual([expect.objectContaining({ row: 8, col: 7, sourceRow: 7, sourceCol: 7 })]);
    });
    test('time bomb fallback includes top expansion cells in blast range without BoardOps', () => {
        const CardTimeBomb = loadWithoutBoardOps('../game/logic/cards/time_bomb');
        const cardState = {
            turnIndex: 3,
            markers: [
                { id: 12, kind: 'specialStone', row: 0, col: 0, owner: 'black', createdSeq: 1, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1, placedTurn: 0 } }
            ]
        };
        const gameState = {
            board: createBoard(),
            boardExpansion: createExpansionState([
                { side: 'top', row: -1, col: 0, owner: Shared.WHITE }
            ])
        };
        const destroyAt = jest.fn(() => true);
        const out = CardTimeBomb.tickBombAt(cardState, gameState, cardState.markers[0], 'black', { destroyAt });
        expect(out.removed).toBe(true);
        expect(destroyAt).toHaveBeenCalledWith(cardState, gameState, -1, 0);
    });
    test('time bomb fallback includes a bottom expansion cell on 10x10 without BoardOps', () => {
        const CardTimeBomb = loadWithoutBoardOps('../game/logic/cards/time_bomb');
        const cardState = {
            turnIndex: 3,
            markers: [
                { id: 102, kind: 'specialStone', row: 9, col: 9, owner: 'black', createdSeq: 1, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1, placedTurn: 0 } }
            ]
        };
        const gameState = {
            board: createBoard(10, 10),
            boardExpansion: createExpansionState([
                { side: 'bottom', row: 10, col: 9, owner: Shared.WHITE }
            ])
        };
        const destroyAt = jest.fn(() => true);
        const out = CardTimeBomb.tickBombAt(cardState, gameState, cardState.markers[0], 'black', { destroyAt });
        expect(out.removed).toBe(true);
        expect(destroyAt).toHaveBeenCalledWith(cardState, gameState, 10, 9);
    });
    test('destroy dragon fallback can target a top expansion neighbor without BoardOps', () => {
        const CardDestroyDragon = loadWithoutBoardOps('../game/logic/cards/destroy_dragon');
        const cardState = {
            markers: [{
                    id: 13,
                    kind: 'specialStone',
                    row: 0,
                    col: 0,
                    owner: 'black',
                    data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 2 }
                }]
        };
        const gameState = {
            board: createBoard(),
            boardExpansion: createExpansionState([
                { side: 'top', row: -1, col: 0, owner: Shared.WHITE }
            ])
        };
        gameState.board[0][0] = Shared.BLACK;
        const destroyAt = jest.fn(() => true);
        const out = CardDestroyDragon.processDestroyDragonEffects(cardState, gameState, 'black', { destroyAt, random: () => 0 });
        expect(destroyAt).toHaveBeenCalledWith(cardState, gameState, -1, 0);
        expect(out.destroyed).toEqual([expect.objectContaining({ row: -1, col: 0, sourceRow: 0, sourceCol: 0 })]);
    });
    test('UDG fallback destroys top and corner expansion neighbors without BoardOps', () => {
        const CardUdG = loadWithoutBoardOps('../game/logic/cards/udg');
        const cardState = {
            markers: [{
                    id: 14,
                    kind: 'specialStone',
                    row: 0,
                    col: 0,
                    owner: 'black',
                    data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 2 }
                }]
        };
        const gameState = {
            board: createBoard(),
            boardExpansion: createExpansionState([
                { side: 'top', row: -1, col: 0, owner: Shared.WHITE },
                { side: 'left', row: -1, col: -1, owner: Shared.WHITE }
            ])
        };
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                gameState.board[row][col] = Shared.WHITE;
            }
        }
        gameState.board[0][0] = Shared.BLACK;
        const destroyAt = jest.fn(() => true);
        CardUdG.processUltimateDestroyGodEffects(cardState, gameState, 'black', { destroyAt });
        expect(destroyAt).toHaveBeenCalledWith(cardState, gameState, -1, 0);
        expect(destroyAt).toHaveBeenCalledWith(cardState, gameState, -1, -1);
    });
    test('UDG fallback destroys right and bottom expansion neighbors on 10x10 without BoardOps', () => {
        const CardUdG = loadWithoutBoardOps('../game/logic/cards/udg');
        const cardState = {
            markers: [{
                    id: 103,
                    kind: 'specialStone',
                    row: 9,
                    col: 9,
                    owner: 'black',
                    data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 2 }
                }]
        };
        const gameState = {
            board: createBoard(10, 10),
            boardExpansion: createExpansionState([
                { side: 'right', row: 9, col: 10, owner: Shared.WHITE },
                { side: 'bottom', row: 10, col: 9, owner: Shared.WHITE },
                { side: 'bottom', row: 10, col: 10, owner: Shared.WHITE }
            ])
        };
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                gameState.board[row][col] = Shared.WHITE;
            }
        }
        gameState.board[9][9] = Shared.BLACK;
        const destroyAt = jest.fn(() => true);
        CardUdG.processUltimateDestroyGodEffects(cardState, gameState, 'black', { destroyAt });
        expect(destroyAt).toHaveBeenCalledWith(cardState, gameState, 9, 10);
        expect(destroyAt).toHaveBeenCalledWith(cardState, gameState, 10, 9);
        expect(destroyAt).toHaveBeenCalledWith(cardState, gameState, 10, 10);
    });
    test('DESTROY_ONE_STONE fallback clears a top expansion cell without BoardOps', () => {
        const DestroyOneStone = loadWithoutBoardOps('../game/logic/effects/destroy_one_stone');
        const cardState = {
            markers: [{ id: 15, kind: 'specialStone', row: -1, col: 0, owner: 'white', data: { type: 'REGEN' } }],
            pendingEffectByPlayer: { black: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' }, white: null }
        };
        const gameState = {
            board: createBoard(),
            boardExpansion: createExpansionState([
                { side: 'top', row: -1, col: 0, owner: Shared.WHITE }
            ])
        };
        const out = DestroyOneStone.applyDestroyOneStone(cardState, gameState, 'black', -1, 0);
        expect(out.destroyed).toBe(true);
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === -1 && cell.col === 0).owner).toBe(Shared.EMPTY);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('DESTROY_ONE_STONE fallback clears a right expansion cell on 10x10 without BoardOps', () => {
        const DestroyOneStone = loadWithoutBoardOps('../game/logic/effects/destroy_one_stone');
        const cardState = {
            markers: [{ id: 104, kind: 'specialStone', row: 0, col: 10, owner: 'white', data: { type: 'REGEN' } }],
            pendingEffectByPlayer: { black: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' }, white: null }
        };
        const gameState = {
            board: createBoard(10, 10),
            boardExpansion: createExpansionState([
                { side: 'right', row: 0, col: 10, owner: Shared.WHITE }
            ])
        };
        const out = DestroyOneStone.applyDestroyOneStone(cardState, gameState, 'black', 0, 10);
        expect(out.destroyed).toBe(true);
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 0 && cell.col === 10).owner).toBe(Shared.EMPTY);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('WORK fallback clears a top expansion anchor on expiry without BoardOps', () => {
        const CardWork = loadWithoutBoardOps('../game/logic/cards/work_will', [
            ['../game/logic/cards/utils', () => ({ isFrozenCell: () => false })]
        ]);
        const cardState = {
            charge: { black: 0, white: 0 },
            chargeGainedTotal: { black: 0, white: 0 },
            workAnchorPosByPlayer: { black: { row: -1, col: 0 }, white: null },
            markers: [{
                    id: 16,
                    kind: 'specialStone',
                    row: -1,
                    col: 0,
                    owner: 'black',
                    data: { type: 'WORK', ownerColor: 'black', workStage: 0, remainingOwnerTurns: 1 }
                }]
        };
        const gameState = {
            board: createBoard(),
            boardExpansion: createExpansionState([
                { side: 'top', row: -1, col: 0, owner: Shared.BLACK }
            ])
        };
        const out = CardWork.processWorkEffects(cardState, gameState, 'black');
        expect(out).toMatchObject({ gained: 1, removed: true, row: -1, col: 0, removedReason: 'duration_end' });
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === -1 && cell.col === 0).owner).toBe(Shared.EMPTY);
    });
    test('WORK fallback clears a right expansion anchor on 10x10 without BoardOps', () => {
        const CardWork = loadWithoutBoardOps('../game/logic/cards/work_will', [
            ['../game/logic/cards/utils', () => ({ isFrozenCell: () => false })]
        ]);
        const cardState = {
            charge: { black: 0, white: 0 },
            chargeGainedTotal: { black: 0, white: 0 },
            workAnchorPosByPlayer: { black: { row: 0, col: 10 }, white: null },
            markers: [{
                    id: 105,
                    kind: 'specialStone',
                    row: 0,
                    col: 10,
                    owner: 'black',
                    data: { type: 'WORK', ownerColor: 'black', workStage: 0, remainingOwnerTurns: 1 }
                }]
        };
        const gameState = {
            board: createBoard(10, 10),
            boardExpansion: createExpansionState([
                { side: 'right', row: 0, col: 10, owner: Shared.BLACK }
            ])
        };
        const out = CardWork.processWorkEffects(cardState, gameState, 'black');
        expect(out).toMatchObject({ gained: 1, removed: true, row: 0, col: 10, removedReason: 'duration_end' });
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 0 && cell.col === 10).owner).toBe(Shared.EMPTY);
    });
});
//# sourceMappingURL=game.expansion-fallback-helpers.test.js.map