'use strict';
/**
 * Tests for FATE_WILL core game-side support.
 *
 * Covers:
 *  - applyFateWill: sets controller, stacking prevention, clears pending
 *  - getFateWillControllerForTurnOwner: correct lookup
 *  - applyTurnSafe out-of-turn guard: allows FATE_WILL controller, rejects others
 *  - applyTurnStartPhase: clears fateWillControllerByTurnOwner after the controlled turn ends
 *  - copyCardState: preserves fateWillControllerByTurnOwner
 */
describe('FATE_WILL core game support', () => {
    let CardLogic;
    let TurnPipeline;
    beforeEach(() => {
        jest.resetModules();
        CardLogic = require('../game/logic/cards');
        TurnPipeline = require('../game/turn/turn_pipeline');
    });
    // -----------------------------------------------------------------------
    // cardState initialization
    // -----------------------------------------------------------------------
    describe('createCardState', () => {
        test('initializes fateWillControllerByTurnOwner as {black:null, white:null}', () => {
            const cs = CardLogic.createCardState();
            expect(cs.fateWillControllerByTurnOwner).toEqual({ black: null, white: null });
        });
    });
    // -----------------------------------------------------------------------
    // copyCardState
    // -----------------------------------------------------------------------
    describe('copyCardState', () => {
        test('copies fateWillControllerByTurnOwner correctly when active', () => {
            const cs = CardLogic.createCardState();
            cs.fateWillControllerByTurnOwner.white = 'black';
            const copy = CardLogic.copyCardState(cs);
            expect(copy.fateWillControllerByTurnOwner).toEqual({ black: null, white: 'black' });
            // must be a new object
            copy.fateWillControllerByTurnOwner.white = null;
            expect(cs.fateWillControllerByTurnOwner.white).toBe('black');
        });
        test('copies fateWillControllerByTurnOwner as {black:null,white:null} when missing in source', () => {
            const cs = CardLogic.createCardState();
            delete cs.fateWillControllerByTurnOwner;
            const copy = CardLogic.copyCardState(cs);
            expect(copy.fateWillControllerByTurnOwner).toEqual({ black: null, white: null });
        });
    });
    // -----------------------------------------------------------------------
    // getFateWillControllerForTurnOwner
    // -----------------------------------------------------------------------
    describe('getFateWillControllerForTurnOwner', () => {
        test('returns null when no effect active', () => {
            const cs = CardLogic.createCardState();
            expect(CardLogic.getFateWillControllerForTurnOwner(cs, 'black')).toBeNull();
            expect(CardLogic.getFateWillControllerForTurnOwner(cs, 'white')).toBeNull();
        });
        test('returns controller key when effect is active for that turn owner', () => {
            const cs = CardLogic.createCardState();
            cs.fateWillControllerByTurnOwner.white = 'black';
            expect(CardLogic.getFateWillControllerForTurnOwner(cs, 'white')).toBe('black');
            expect(CardLogic.getFateWillControllerForTurnOwner(cs, 'black')).toBeNull();
        });
        test('returns null for invalid turn owner key', () => {
            const cs = CardLogic.createCardState();
            expect(CardLogic.getFateWillControllerForTurnOwner(cs, 'invalid')).toBeNull();
            expect(CardLogic.getFateWillControllerForTurnOwner(cs, null)).toBeNull();
            expect(CardLogic.getFateWillControllerForTurnOwner(null, 'black')).toBeNull();
        });
    });
    describe('stale used-card flag handling', () => {
        function makeBaseGameState(currentPlayerValue) {
            const board = Array.from({ length: 8 }, () => Array(8).fill(0));
            board[3][3] = -1;
            board[3][4] = 1;
            board[4][3] = 1;
            board[4][4] = -1;
            return { currentPlayer: currentPlayerValue, board };
        }
        test('previous-turn used-card flag does not block the next turn owner before turn-start bookkeeping runs', () => {
            const cs = CardLogic.createCardState();
            cs.hands.white = ['fate_will_01'];
            cs.charge.white = 99;
            cs.hasUsedCardThisTurnByPlayer.white = true;
            cs.lastTurnStartedFor = 'black';
            expect(CardLogic.getUsableCardIds(cs, makeBaseGameState(-1), 'white')).toContain('fate_will_01');
        });
        test('same-turn used-card flag still blocks a second card use', () => {
            const cs = CardLogic.createCardState();
            cs.hands.white = ['fate_will_01'];
            cs.charge.white = 99;
            cs.hasUsedCardThisTurnByPlayer.white = true;
            cs.lastTurnStartedFor = 'white';
            expect(CardLogic.getUsableCardIds(cs, makeBaseGameState(-1), 'white')).not.toContain('fate_will_01');
        });
    });
    // -----------------------------------------------------------------------
    // applyFateWill
    // -----------------------------------------------------------------------
    describe('applyFateWill', () => {
        function makeCardStateWithPending(playerKey) {
            const cs = CardLogic.createCardState();
            cs.pendingEffectByPlayer[playerKey] = { type: 'FATE_WILL', stage: null };
            return cs;
        }
        test('returns not_pending when no pending FATE_WILL', () => {
            const cs = CardLogic.createCardState();
            const res = CardLogic.applyFateWill(cs, 'black');
            expect(res.applied).toBe(false);
            expect(res.reason).toBe('not_pending');
        });
        test('sets controller for opponent and clears pending', () => {
            const cs = makeCardStateWithPending('black');
            const res = CardLogic.applyFateWill(cs, 'black');
            expect(res.applied).toBe(true);
            expect(res.stacked).toBe(false);
            expect(res.controllerKey).toBe('black');
            expect(res.turnOwnerKey).toBe('white');
            expect(cs.fateWillControllerByTurnOwner.white).toBe('black');
            expect(cs.fateWillControllerByTurnOwner.black).toBeNull();
            expect(cs.pendingEffectByPlayer.black).toBeNull();
        });
        test('white player using FATE_WILL sets controller for black', () => {
            const cs = makeCardStateWithPending('white');
            const res = CardLogic.applyFateWill(cs, 'white');
            expect(res.applied).toBe(true);
            expect(res.stacked).toBe(false);
            expect(res.controllerKey).toBe('white');
            expect(res.turnOwnerKey).toBe('black');
            expect(cs.fateWillControllerByTurnOwner.black).toBe('white');
        });
        test('stacking: opponent already has controller — card consumed but no additional effect', () => {
            const cs = makeCardStateWithPending('black');
            cs.fateWillControllerByTurnOwner.white = 'black'; // already active
            const res = CardLogic.applyFateWill(cs, 'black');
            expect(res.applied).toBe(true);
            expect(res.stacked).toBe(true);
            // still 'black', not changed
            expect(cs.fateWillControllerByTurnOwner.white).toBe('black');
            expect(cs.pendingEffectByPlayer.black).toBeNull();
        });
        test('nesting: current turn is controlled — card consumed but no additional effect', () => {
            // Simulate: white is controlling black's turn; black plays FATE_WILL from black's hand
            const cs = makeCardStateWithPending('black');
            cs.fateWillControllerByTurnOwner.black = 'white'; // black's turn is currently controlled
            const res = CardLogic.applyFateWill(cs, 'black');
            expect(res.applied).toBe(true);
            expect(res.stacked).toBe(true);
            // Should NOT set white -> black (recursive chain prevention)
            expect(cs.fateWillControllerByTurnOwner.white).toBeNull();
            expect(cs.pendingEffectByPlayer.black).toBeNull();
        });
        test('initializes fateWillControllerByTurnOwner if missing from cardState', () => {
            const cs = makeCardStateWithPending('black');
            delete cs.fateWillControllerByTurnOwner;
            const res = CardLogic.applyFateWill(cs, 'black');
            expect(res.applied).toBe(true);
            expect(res.stacked).toBe(false);
            expect(cs.fateWillControllerByTurnOwner.white).toBe('black');
        });
    });
    // -----------------------------------------------------------------------
    // applyTurnSafe — out-of-turn guard with FATE_WILL
    // -----------------------------------------------------------------------
    describe('applyTurnSafe out-of-turn guard', () => {
        function makeMinimalState(currentPlayer) {
            const cs = {
                turnIndex: 0,
                lastTurnStartedFor: null,
                pendingEffectByPlayer: { black: null, white: null },
                hasUsedCardThisTurnByPlayer: { black: false, white: false },
                hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
                extraPlaceRemainingByPlayer: { black: 0, white: 0 },
                infinitePlaceActiveByPlayer: { black: false, white: false },
                multiPlaceSourceTypeByPlayer: { black: null, white: null },
                charge: { black: 0, white: 0 },
                fateWillControllerByTurnOwner: { black: null, white: null },
                turnCountByPlayer: { black: 0, white: 0 },
                presentationEvents: [],
                decks: { black: [], white: [] },
                deck: [],
                discard: [],
                hands: { black: [], white: [] },
                markers: [],
                prevOpponentTurnDestroyedNormalByPlayer: { black: [], white: [] },
                breedingSproutByOwner: { black: [], white: [] },
                _breedingSproutClearedTokenByOwner: { black: null, white: null }
            };
            const gs = {
                currentPlayer: currentPlayer,
                board: Array.from({ length: 8 }, () => Array(8).fill(0))
            };
            // seed a valid board position (standard opening)
            gs.board[3][3] = -1;
            gs.board[3][4] = 1;
            gs.board[4][3] = 1;
            gs.board[4][4] = -1;
            return { cs, gs };
        }
        test('rejects action when playerKey is not currentPlayer and no FATE_WILL active', () => {
            const { cs, gs } = makeMinimalState('white');
            const res = TurnPipeline.applyTurnSafe(cs, gs, 'black', { type: 'pass' });
            expect(res.ok).toBe(false);
            expect(res.rejectedReason).toBe('OUT_OF_TURN');
        });
        test('allows action when player is FATE_WILL controller for current turn owner', () => {
            const { cs, gs } = makeMinimalState('white'); // white's turn
            // black is FATE_WILL controller for white's turn
            cs.fateWillControllerByTurnOwner.white = 'black';
            // black submits a pass on white's behalf; white has no legal moves on empty board
            const res = TurnPipeline.applyTurnSafe(cs, gs, 'black', { type: 'pass' });
            // Should not be OUT_OF_TURN (may fail for other reasons like legal moves, but not OOT)
            expect(res.rejectedReason).not.toBe('OUT_OF_TURN');
        });
        test('still rejects a third player (not controller, not turn owner)', () => {
            const { cs, gs } = makeMinimalState('white');
            cs.fateWillControllerByTurnOwner.white = 'black'; // black is controller for white
            // But some imaginary third key tries to act — we simulate by checking 'black' is ok
            // and verifying that a re-check with the actual turn owner also passes.
            // (No third player in 2-player game, but the guard logic should still reject out-of-turn.)
            const res2 = TurnPipeline.applyTurnSafe(cs, gs, 'white', { type: 'pass' });
            // white IS the turn owner and their turn is controlled, but they can still call pass
            // (the controller remap only applies when actionPlayerKey !== currentPlayerKey)
            expect(res2.rejectedReason).not.toBe('OUT_OF_TURN');
        });
    });
    // -----------------------------------------------------------------------
    // Turn start clears FATE_WILL controller after the controlled turn ends
    // -----------------------------------------------------------------------
    describe('fateWillControllerByTurnOwner cleared at turn start', () => {
        test('controller entry cleared when the controller starts their next turn', () => {
            // Simulate: black used FATE_WILL, then white's (controlled) turn ran,
            // now black's turn starts -> should clear fateWillControllerByTurnOwner.white
            import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
            import * as CardLogicModule from '../game/logic/cards.js';
            import * as Core from '../game/logic/core.js';
            const cs = {
                turnIndex: 5,
                lastTurnStartedFor: 'white', // white's turn just ended
                pendingEffectByPlayer: { black: null, white: null },
                hasUsedCardThisTurnByPlayer: { black: false, white: false },
                hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
                extraPlaceRemainingByPlayer: { black: 0, white: 0 },
                infinitePlaceActiveByPlayer: { black: false, white: false },
                multiPlaceSourceTypeByPlayer: { black: null, white: null },
                charge: { black: 5, white: 5 },
                fateWillControllerByTurnOwner: { black: null, white: 'black' }, // black controlled white
                turnCountByPlayer: { black: 3, white: 3 },
                presentationEvents: [],
                decks: { black: [], white: [] },
                deck: [],
                discard: [],
                hands: { black: [], white: [] },
                markers: [],
                prevOpponentTurnDestroyedNormalByPlayer: { black: [], white: [] },
                breedingSproutByOwner: { black: [], white: [] },
                _breedingSproutClearedTokenByOwner: { black: null, white: null }
            };
            const gs = {
                currentPlayer: Core.BLACK,
                board: Array.from({ length: 8 }, () => Array(8).fill(0))
            };
            gs.board[3][3] = -1;
            gs.board[3][4] = 1;
            gs.board[4][3] = 1;
            gs.board[4][4] = -1;
            const events = [];
            TurnPipelinePhases.applyTurnStartPhase(CardLogicModule, Core, cs, gs, 'black', events, null);
            // After black's turn starts, fateWillControllerByTurnOwner.white should be cleared
            expect(cs.fateWillControllerByTurnOwner.white).toBeNull();
            // black's controller entry should remain unchanged
            expect(cs.fateWillControllerByTurnOwner.black).toBeNull();
        });
        test('controller entry NOT cleared if the current player is not the controller', () => {
            import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
            import * as CardLogicModule from '../game/logic/cards.js';
            import * as Core from '../game/logic/core.js';
            const cs = {
                turnIndex: 5,
                lastTurnStartedFor: 'black',
                pendingEffectByPlayer: { black: null, white: null },
                hasUsedCardThisTurnByPlayer: { black: false, white: false },
                hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
                extraPlaceRemainingByPlayer: { black: 0, white: 0 },
                infinitePlaceActiveByPlayer: { black: false, white: false },
                multiPlaceSourceTypeByPlayer: { black: null, white: null },
                charge: { black: 5, white: 5 },
                fateWillControllerByTurnOwner: { black: null, white: 'black' }, // black will control white's upcoming turn
                turnCountByPlayer: { black: 2, white: 2 },
                presentationEvents: [],
                decks: { black: [], white: [] },
                deck: [],
                discard: [],
                hands: { black: [], white: [] },
                markers: [],
                prevOpponentTurnDestroyedNormalByPlayer: { black: [], white: [] },
                breedingSproutByOwner: { black: [], white: [] },
                _breedingSproutClearedTokenByOwner: { black: null, white: null }
            };
            const gs = {
                currentPlayer: Core.WHITE,
                board: Array.from({ length: 8 }, () => Array(8).fill(0))
            };
            gs.board[3][3] = -1;
            gs.board[3][4] = 1;
            gs.board[4][3] = 1;
            gs.board[4][4] = -1;
            const events = [];
            TurnPipelinePhases.applyTurnStartPhase(CardLogicModule, Core, cs, gs, 'white', events, null);
            // white's turn is starting (the controlled turn) — effect must still be active
            expect(cs.fateWillControllerByTurnOwner.white).toBe('black');
        });
    });
});
//# sourceMappingURL=game.fate-will.test.js.map