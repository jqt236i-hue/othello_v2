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
const CardMarkers = __importStar(require("../game/logic/cards/markers.js"));
const CardExpansion = __importStar(require("../game/logic/cards/expansion.js"));
const Core = __importStar(require("../game/logic/core.js"));
describe('CardMarkers module', () => {
    const originalBoardOps = globalThis.BoardOps;
    beforeEach(() => {
        globalThis.BoardOps = {
            emitPresentationEvent: jest.fn((cardState, ev) => {
                if (!Array.isArray(cardState.presentationEvents))
                    cardState.presentationEvents = [];
                cardState.presentationEvents.push(ev);
            })
        };
    });
    afterEach(() => {
        if (typeof originalBoardOps === 'undefined') {
            delete globalThis.BoardOps;
        }
        else {
            globalThis.BoardOps = originalBoardOps;
        }
    });
    test('addMarker emits status and backfills the latest spawn meta for matching action', () => {
        const cardState = {
            markers: [],
            _nextMarkerId: 1,
            _nextCreatedSeq: 1,
            _currentActionMeta: { actionId: 'action-1' },
            _presentationEventsPersist: [
                { type: 'SPAWN', row: 4, col: 4, actionId: 'action-1', meta: { existing: true } }
            ],
            presentationEvents: []
        };
        const marker = CardMarkers.addMarker(cardState, CardMarkers.MARKER_KINDS.SPECIAL_STONE, 4, 4, 'black', { type: 'GUARD', remainingOwnerTurns: 2, flipEvadeRemaining: 1 });
        expect(marker).toMatchObject({
            id: 1,
            createdSeq: 1,
            row: 4,
            col: 4,
            kind: CardMarkers.MARKER_KINDS.SPECIAL_STONE,
            owner: 'black',
            data: { type: 'GUARD', remainingOwnerTurns: 2, flipEvadeRemaining: 1 }
        });
        expect(globalThis.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(cardState, expect.objectContaining({
            type: 'STATUS_APPLIED',
            row: 4,
            col: 4,
            meta: expect.objectContaining({
                special: 'GUARD',
                timer: 2,
                owner: 'black',
                flipEvadeRemaining: 1
            })
        }));
        expect(cardState._presentationEventsPersist[0].meta).toMatchObject({
            existing: true,
            special: 'GUARD',
            timer: 2,
            owner: 'black',
            flipEvadeRemaining: 1
        });
    });
    test('addMarker does not emit status or backfill spawn meta for hidden trap', () => {
        const cardState = {
            markers: [],
            _nextMarkerId: 1,
            _nextCreatedSeq: 1,
            _currentActionMeta: { actionId: 'action-trap' },
            _presentationEventsPersist: [
                { type: 'SPAWN', row: 5, col: 5, actionId: 'action-trap', meta: { existing: true } }
            ],
            presentationEvents: []
        };
        const marker = CardMarkers.addMarker(cardState, CardMarkers.MARKER_KINDS.SPECIAL_STONE, 5, 5, 'black', { type: 'TRAP', hidden: true, armedForPlayer: 'white' });
        expect(marker).toMatchObject({
            id: 1,
            row: 5,
            col: 5,
            kind: CardMarkers.MARKER_KINDS.SPECIAL_STONE,
            owner: 'black',
            data: { type: 'TRAP', hidden: true, armedForPlayer: 'white' }
        });
        expect(globalThis.BoardOps.emitPresentationEvent).not.toHaveBeenCalledWith(cardState, expect.objectContaining({
            type: 'STATUS_APPLIED',
            row: 5,
            col: 5
        }));
        expect(cardState._presentationEventsPersist[0].meta).toMatchObject({ existing: true });
        expect(cardState._presentationEventsPersist[0].meta.special).toBeUndefined();
    });
    test('swapCellCoordinates swaps main and expansion stone ids and marker-linked positions', () => {
        const gameState = Core.createGameState();
        CardExpansion.ensureExpansionCellForCard(gameState, -1, 0, Core.EMPTY);
        const cardState = {
            stoneIdMap: Array.from({ length: 8 }, () => Array(8).fill(null)),
            expansionStoneIdByCell: {},
            markers: [
                { id: 1, row: 0, col: 0, kind: CardMarkers.MARKER_KINDS.SPECIAL_STONE, owner: 'black', createdSeq: 1, data: { type: 'WORK' } },
                { id: 2, row: -1, col: 0, kind: CardMarkers.MARKER_KINDS.SPECIAL_STONE, owner: 'white', createdSeq: 2, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }
            ],
            workAnchorPosByPlayer: { black: { row: 0, col: 0 }, white: null },
            breedingSproutByOwner: { black: [{ row: -1, col: 0 }], white: [] },
            breedingFrontierByAnchorId: {
                anchorA: [{ row: 0, col: 0 }, { row: -1, col: 0 }]
            }
        };
        CardMarkers.setStoneIdAtForCard(cardState, gameState, 0, 0, 's-main');
        CardMarkers.setStoneIdAtForCard(cardState, gameState, -1, 0, 's-expansion');
        CardMarkers.swapCellCoordinates(cardState, gameState, { row: 0, col: 0 }, { row: -1, col: 0 });
        expect(CardMarkers.getStoneIdAtForCard(cardState, gameState, 0, 0)).toBe('s-expansion');
        expect(CardMarkers.getStoneIdAtForCard(cardState, gameState, -1, 0)).toBe('s-main');
        expect(cardState.markers).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 1, row: -1, col: 0 }),
            expect.objectContaining({ id: 2, row: 0, col: 0 })
        ]));
        expect(cardState.workAnchorPosByPlayer.black).toEqual({ row: -1, col: 0 });
        expect(cardState.breedingSproutByOwner.black).toEqual([{ row: 0, col: 0 }]);
        expect(cardState.breedingFrontierByAnchorId.anchorA).toEqual([
            { row: -1, col: 0 },
            { row: 0, col: 0 }
        ]);
    });
});
//# sourceMappingURL=game.cards.markers-module.test.js.map