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
const SharedConstants = __importStar(require("../shared-constants.js"));
const Core = __importStar(require("../game/logic/core.js"));
const TurnPipeline = __importStar(require("../game/turn/turn_pipeline.js"));
const CardLogic = __importStar(require("../game/logic/cards.js"));
const BoardOps = __importStar(require("../game/logic/board_ops.js"));
function createPrng(randomValue = 0.5) {
    return {
        shuffle: (arr) => arr,
        random: () => randomValue
    };
}
function createEmptyGameState() {
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.turnNumber = 1;
    gameState.consecutivePasses = 0;
    return gameState;
}
function getGhostWillDef() {
    return (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'GHOST_WILL');
}
function findGhostMarker(cardState, row, col) {
    return (cardState.markers || []).find((marker) => (marker &&
        marker.kind === 'specialStone' &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        marker.data.type === 'GHOST'));
}
describe('GHOST_WILL（幽霊の意志）', () => {
    test('use card -> place creates GHOST marker with 5 owner turns', () => {
        const def = getGhostWillDef();
        expect(def).toBeTruthy();
        const prng = createPrng(0);
        const cardState = CardLogic.createCardState(prng);
        const gameState = createEmptyGameState();
        cardState.debugNoDraw = true;
        cardState.hands.black = [def.id];
        cardState.charge.black = def.cost;
        gameState.board[2][4] = Core.WHITE;
        gameState.board[2][5] = Core.BLACK;
        gameState.board[2][6] = Core.WHITE;
        const useRes = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' }, prng, { skipTurnStart: true });
        expect(useRes.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'card_used', player: 'black', cardId: def.id })
        ]));
        expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({ type: 'GHOST_WILL' }));
        const placeRes = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng, { skipTurnStart: true });
        expect(placeRes.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'placement_effects',
                player: 'black',
                effects: expect.objectContaining({ ghostPlaced: true, chargeGained: 1 })
            })
        ]));
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        const marker = findGhostMarker(cardState, 2, 3);
        expect(marker).toBeTruthy();
        expect(marker.owner).toBe('black');
        expect(marker.data.remainingOwnerTurns).toBe(CardLogic.GHOST_WILL_TURNS);
    });
    test('standard flip targets ghost but leaves the ghost stone unchanged', () => {
        const prng = createPrng(0);
        const cardState = CardLogic.createCardState(prng);
        const gameState = createEmptyGameState();
        gameState.currentPlayer = Core.WHITE;
        gameState.board[2][3] = Core.BLACK;
        gameState.board[2][4] = Core.BLACK;
        gameState.board[2][5] = Core.BLACK;
        gameState.board[2][6] = Core.WHITE;
        cardState.markers.push({
            id: 1,
            kind: 'specialStone',
            row: 2,
            col: 3,
            owner: 'black',
            data: { type: 'GHOST', remainingOwnerTurns: 5 }
        });
        expect(Core.getFlipsWithContext(gameState, 2, 2, Core.WHITE, CardLogic.getCardContext(cardState))).toEqual([
            [2, 3],
            [2, 4],
            [2, 5]
        ]);
        const placeRes = TurnPipeline.applyTurn(cardState, gameState, 'white', { type: 'place', row: 2, col: 2 }, prng, { skipTurnStart: true });
        expect(gameState.board[2][2]).toBe(Core.WHITE);
        expect(gameState.board[2][3]).toBe(Core.BLACK);
        expect(gameState.board[2][4]).toBe(Core.WHITE);
        expect(gameState.board[2][5]).toBe(Core.WHITE);
        expect(placeRes.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'placement_effects',
                player: 'white',
                effects: expect.objectContaining({ chargeGained: 2 })
            })
        ]));
    });
    test('BoardOps.changeAt emits blocked flip presentation for ghost', () => {
        const prng = createPrng(0);
        const cardState = CardLogic.createCardState(prng);
        const gameState = createEmptyGameState();
        gameState.board[2][3] = Core.BLACK;
        cardState.markers.push({
            id: 11,
            kind: 'specialStone',
            row: 2,
            col: 3,
            owner: 'black',
            data: { type: 'GHOST', remainingOwnerTurns: 5 }
        });
        const changeRes = BoardOps.changeAt(cardState, gameState, 2, 3, 'white', 'SYSTEM', 'standard_flip');
        expect(changeRes).toMatchObject({ changed: false, blockedByGhost: true, reason: 'ghost_protected' });
        expect(gameState.board[2][3]).toBe(Core.BLACK);
        const pres = CardLogic.flushPresentationEvents(cardState) || [];
        expect(pres).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'CHANGE',
                row: 2,
                col: 3,
                meta: expect.objectContaining({
                    blockedByGhost: true,
                    special: 'GHOST'
                })
            })
        ]));
    });
    test('ghost blocks stone destruction but still allows meteor cell destruction', () => {
        const prng = createPrng(0);
        const cardState = CardLogic.createCardState(prng);
        const gameState = createEmptyGameState();
        gameState.board[3][3] = Core.BLACK;
        cardState.markers.push({
            id: 2,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'GHOST', remainingOwnerTurns: 5 }
        });
        const blocked = BoardOps.destroyAt(cardState, gameState, 3, 3, 'DESTROY_ONE_STONE', 'destroy_one_stone');
        expect(blocked).toMatchObject({ kind: 'ghost_blocked', destroyed: false, blockedByGhost: true, reason: 'ghost_protected' });
        expect(gameState.board[3][3]).toBe(Core.BLACK);
        expect(findGhostMarker(cardState, 3, 3)).toBeTruthy();
        const blockedEvents = CardLogic.flushPresentationEvents(cardState) || [];
        expect(blockedEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DESTROY',
                row: 3,
                col: 3,
                meta: expect.objectContaining({ blockedByGhost: true, special: 'GHOST' })
            })
        ]));
        const meteor = BoardOps.destroyAt(cardState, gameState, 3, 3, 'METEOR_WILL', 'meteor_cell_destroy', { ignoreGuard: true });
        expect(meteor).toMatchObject({ destroyed: true, evaded: false });
        expect(gameState.board[3][3]).toBe(Core.EMPTY);
        expect(findGhostMarker(cardState, 3, 3)).toBeUndefined();
    });
    test('tempt and position swap still work on ghost stone', () => {
        const prng = createPrng(0);
        const cardState = CardLogic.createCardState(prng);
        const gameState = createEmptyGameState();
        gameState.board[4][4] = Core.BLACK;
        cardState.markers.push({
            id: 3,
            kind: 'specialStone',
            row: 4,
            col: 4,
            owner: 'black',
            data: { type: 'GHOST', remainingOwnerTurns: 5 }
        });
        cardState.pendingEffectByPlayer.white = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };
        const temptRes = CardLogic.applyTemptWill(cardState, gameState, 'white', 4, 4);
        expect(temptRes && temptRes.applied).toBe(true);
        expect(gameState.board[4][4]).toBe(Core.WHITE);
        expect(findGhostMarker(cardState, 4, 4)).toEqual(expect.objectContaining({ owner: 'white' }));
        gameState.board[1][1] = Core.BLACK;
        cardState.markers.push({
            id: 4,
            kind: 'specialStone',
            row: 1,
            col: 1,
            owner: 'black',
            data: { type: 'GHOST', remainingOwnerTurns: 4 }
        });
        cardState.pendingEffectByPlayer.black = { type: 'POSITION_SWAP_WILL', stage: 'selectTarget', cardId: 'position_swap_01' };
        const first = CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 1, 1);
        expect(first).toMatchObject({ applied: true, completed: false });
        const second = CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 4, 4);
        expect(second).toMatchObject({ applied: true, completed: true });
        expect(findGhostMarker(cardState, 4, 4)).toEqual(expect.objectContaining({ id: 4, row: 4, col: 4 }));
    });
    test('owner turn starts decrement ghost duration and remove it on the 5th start', () => {
        const prng = createPrng(0);
        const cardState = CardLogic.createCardState(prng);
        const gameState = createEmptyGameState();
        gameState.board[5][5] = Core.BLACK;
        cardState.markers.push({
            id: 5,
            kind: 'specialStone',
            row: 5,
            col: 5,
            owner: 'black',
            data: { type: 'GHOST', remainingOwnerTurns: 5 }
        });
        for (let i = 0; i < 4; i += 1) {
            CardLogic.onTurnStart(cardState, 'black', gameState, prng);
            expect(findGhostMarker(cardState, 5, 5)).toBeTruthy();
        }
        CardLogic.onTurnStart(cardState, 'black', gameState, prng);
        expect(findGhostMarker(cardState, 5, 5)).toBeUndefined();
        expect(gameState.board[5][5]).toBe(Core.BLACK);
        expect(CardLogic.flushPresentationEvents(cardState)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'STATUS_REMOVED',
                row: 5,
                col: 5,
                cause: 'SYSTEM',
                reason: 'duration_end',
                meta: expect.objectContaining({ special: 'GHOST' })
            })
        ]));
    });
    test('super buoyancy passes through ghost instead of failing on collision destroy', () => {
        const prng = createPrng(0);
        const cardState = CardLogic.createCardState(prng);
        const gameState = createEmptyGameState();
        gameState.board[4][3] = Core.BLACK;
        gameState.board[2][3] = Core.WHITE;
        cardState.markers.push({
            id: 6,
            kind: 'specialStone',
            row: 2,
            col: 3,
            owner: 'white',
            data: { type: 'GHOST', remainingOwnerTurns: 5 }
        });
        cardState.pendingEffectByPlayer.black = {
            type: 'SUPER_BUOYANCY_WILL',
            stage: 'selectTarget',
            cardId: 'super_buoyancy_01'
        };
        const res = CardLogic.applySuperBuoyancyWill(cardState, gameState, 'black', 4, 3);
        expect(res).toMatchObject({
            applied: true,
            from: { row: 4, col: 3 },
            destroyedCount: 1
        });
        expect(gameState.board[0][3]).toBe(Core.BLACK);
        expect(gameState.board[2][3]).toBe(Core.WHITE);
        expect(findGhostMarker(cardState, 2, 3)).toBeTruthy();
    });
});
//# sourceMappingURL=game.ghost-will.test.js.map