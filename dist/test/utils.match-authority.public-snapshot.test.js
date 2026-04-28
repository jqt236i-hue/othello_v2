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
const MatchAuthority = __importStar(require("../utils/match-authority.js"));
describe('match authority public snapshot trap visibility', () => {
    function createSnapshot() {
        return {
            stateVersion: 7,
            gameState: {
                currentPlayer: 1,
                turnNumber: 12
            },
            cardState: {
                hands: {
                    black: ['b1'],
                    white: ['w1']
                },
                markers: [
                    {
                        id: 10,
                        kind: 'specialStone',
                        row: 2,
                        col: 2,
                        owner: 'black',
                        data: { type: 'TRAP', hidden: true, armedForPlayer: 'white' }
                    },
                    {
                        id: 11,
                        kind: 'specialStone',
                        row: 3,
                        col: 3,
                        owner: 'white',
                        data: { type: 'BREEDING', remainingOwnerTurns: 2 }
                    }
                ],
                specialStones: [
                    {
                        row: 2,
                        col: 2,
                        type: 'TRAP',
                        owner: 'black',
                        remainingOwnerTurns: 1
                    },
                    {
                        row: 3,
                        col: 3,
                        type: 'BREEDING',
                        owner: 'white',
                        remainingOwnerTurns: 2
                    }
                ]
            }
        };
    }
    test('hides trap marker details from opposing viewer snapshots', () => {
        const snapshot = createSnapshot();
        const projected = MatchAuthority.projectSnapshotForViewer(snapshot, 'white');
        expect(projected.cardState.markers).toEqual([
            expect.objectContaining({
                row: 3,
                col: 3,
                owner: 'white',
                data: expect.objectContaining({ type: 'BREEDING' })
            })
        ]);
        expect(projected.cardState.specialStones).toEqual([
            expect.objectContaining({
                row: 3,
                col: 3,
                owner: 'white',
                type: 'BREEDING'
            })
        ]);
        expect(snapshot.cardState.markers).toHaveLength(2);
        expect(snapshot.cardState.specialStones).toHaveLength(2);
    });
    test('keeps trap marker details for the owner viewer snapshot', () => {
        const projected = MatchAuthority.projectSnapshotForViewer(createSnapshot(), 'black');
        expect(projected.cardState.markers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                row: 2,
                col: 2,
                owner: 'black',
                data: expect.objectContaining({ type: 'TRAP', hidden: true })
            })
        ]));
        expect(projected.cardState.specialStones).toEqual(expect.arrayContaining([
            expect.objectContaining({
                row: 2,
                col: 2,
                owner: 'black',
                type: 'TRAP'
            })
        ]));
    });
    test('stripTransientPresentationState は時間停止状態を保ったまま transient state を除去する', () => {
        const snapshot = {
            stateVersion: 8,
            gameState: {
                currentPlayer: 1,
                turnNumber: 13,
                __resultShown: true
            },
            cardState: {
                hands: {
                    black: ['b1'],
                    white: ['__hidden_hand__:white:0']
                },
                discard: ['__hidden_hand__:white:0'],
                pendingEffectByPlayer: { black: null, white: null },
                markers: [
                    {
                        id: 50,
                        kind: 'specialStone',
                        row: 4,
                        col: 4,
                        owner: 'black',
                        data: { type: 'TIME_STOP', remainingOwnerTurns: 1 }
                    }
                ],
                timeStopConsecutiveTurnsRemainingByPlayer: { black: 1, white: 0 },
                presentationEvents: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }],
                _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] }]
            }
        };
        const sanitized = MatchAuthority.stripTransientPresentationState(snapshot);
        expect(sanitized.cardState.hands.white).toEqual(['__hidden_hand__:white:0']);
        expect(sanitized.cardState.discard).toEqual(['__hidden_hand__:white:0']);
        expect(sanitized.cardState.timeStopConsecutiveTurnsRemainingByPlayer).toEqual({ black: 1, white: 0 });
        expect(sanitized.cardState.markers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                row: 4,
                col: 4,
                owner: 'black',
                data: expect.objectContaining({ type: 'TIME_STOP', remainingOwnerTurns: 1 })
            })
        ]));
        expect(sanitized.cardState.presentationEvents).toEqual([]);
        expect(sanitized.cardState._presentationEventsPersist).toEqual([]);
        expect(sanitized.gameState.__resultShown).toBeUndefined();
    });
    test('stripTransientChargeDeltaState は charge ledger を残したまま stale delta queue だけ除去する', () => {
        const snapshot = {
            stateVersion: 9,
            gameState: {
                currentPlayer: 1,
                turnNumber: 14
            },
            cardState: {
                charge: { black: 3, white: 1 },
                chargeGainedTotal: { black: 3, white: 1 },
                chargeDeltaEvents: [
                    { seq: 1, player: 'black', delta: 1, before: 2, after: 3, reason: 'turn_gain' }
                ]
            }
        };
        const sanitized = MatchAuthority.stripTransientChargeDeltaState(snapshot);
        expect(sanitized.cardState.charge).toEqual({ black: 3, white: 1 });
        expect(sanitized.cardState.chargeGainedTotal).toEqual({ black: 3, white: 1 });
        expect(sanitized.cardState.chargeDeltaEvents).toEqual([]);
    });
    test('time stop marker details stay visible in opponent public snapshots', () => {
        const snapshot = createSnapshot();
        snapshot.cardState.markers.push({
            id: 12,
            kind: 'specialStone',
            row: 4,
            col: 4,
            owner: 'black',
            data: { type: 'TIME_STOP', remainingOwnerTurns: 1 }
        });
        snapshot.cardState.specialStones.push({
            row: 4,
            col: 4,
            owner: 'black',
            type: 'TIME_STOP',
            remainingOwnerTurns: 1
        });
        snapshot.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 1, white: 0 };
        const projected = MatchAuthority.projectSnapshotForViewer(snapshot, 'white');
        expect(projected.cardState.markers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                row: 4,
                col: 4,
                owner: 'black',
                data: expect.objectContaining({ type: 'TIME_STOP', remainingOwnerTurns: 1 })
            })
        ]));
        expect(projected.cardState.specialStones).toEqual(expect.arrayContaining([
            expect.objectContaining({
                row: 4,
                col: 4,
                owner: 'black',
                type: 'TIME_STOP',
                remainingOwnerTurns: 1
            })
        ]));
        expect(projected.cardState.timeStopConsecutiveTurnsRemainingByPlayer).toEqual({ black: 1, white: 0 });
    });
    test('projectSnapshotForViewer reveals only marked opponent hand copies and strips internal copy metadata', () => {
        const snapshot = {
            stateVersion: 10,
            gameState: { currentPlayer: 1 },
            cardState: {
                hands: {
                    black: ['b1'],
                    white: ['w1', 'w2', 'w3']
                },
                discard: [],
                pendingEffectByPlayer: { black: null, white: null },
                _nextCardCopySeq: 20,
                _handCopyIdsByPlayer: {
                    black: [1],
                    white: [11, 12, 13]
                },
                _deckCopyIdsByPlayer: { black: [], white: [] },
                _discardCopyIds: [],
                _revealedHandCopyIdsByViewer: {
                    black: [11, 13],
                    white: []
                }
            }
        };
        const projected = MatchAuthority.projectSnapshotForViewer(snapshot, 'black');
        expect(projected.cardState.hands.white).toEqual(['w1', '__hidden_hand__:white:1', 'w3']);
        expect(projected.cardState._nextCardCopySeq).toBeUndefined();
        expect(projected.cardState._handCopyIdsByPlayer).toBeUndefined();
        expect(projected.cardState._deckCopyIdsByPlayer).toBeUndefined();
        expect(projected.cardState._discardCopyIds).toBeUndefined();
        expect(projected.cardState._revealedHandCopyIdsByViewer).toBeUndefined();
    });
    test('projectSnapshotForViewer reconnect sanitizes malformed hidden tokens instead of leaking raw token ids', () => {
        const snapshot = createSnapshot();
        snapshot.cardState.hands.white = ['__hidden_hand__:white:99', 'w2'];
        snapshot.cardState.discard = ['w_discard', '__hidden_hand__:white:99'];
        snapshot.cardState.selectedCardId = '__hidden_hand__:white:77';
        snapshot.cardState.selectedCardOwnerKey = 'white';
        snapshot.cardState.pendingEffectByPlayer = {
            black: null,
            white: {
                type: 'CONDEMN_WILL',
                stage: 'selectTarget',
                offers: [
                    { handIndex: 99, cardId: '__hidden_hand__:black:99' },
                    { handIndex: 99, cardId: '__hidden_hand__:black:199' }
                ]
            }
        };
        const projected = MatchAuthority.projectSnapshotForViewer(snapshot, 'white');
        expect(projected.cardState.hands.white).toEqual(['__hidden_hand__:white:0', 'w2']);
        expect(projected.cardState.discard).toEqual(['w_discard']);
        expect(projected.cardState.selectedCardId).toBeNull();
        expect(projected.cardState.selectedCardOwnerKey).toBeNull();
        expect(projected.cardState.pendingEffectByPlayer.white.offers).toEqual([
            { handIndex: 0, cardId: 'b1' },
            { handIndex: null, cardId: null }
        ]);
    });
});
//# sourceMappingURL=utils.match-authority.public-snapshot.test.js.map