import { BattleMatch } from '../game/battle/match';
import Core = require('../game/logic/core');
const Cards: any = require('../game/logic/cards');
const Prng: any = require('../game/schema/prng');

function base() {
    const rng = Prng.createPRNG(24), cardState = Cards.createCardState(rng), gameState = Core.createGameState();
    cardState.debugNoDraw = true;
    cardState.hands = { black: [], white: [] };
    cardState.charge = { black: 99, white: 99 };
    return { rng, cardState, gameState };
}
function matchOf(b: ReturnType<typeof base>) {
    return new BattleMatch({ cardState: b.cardState, gameState: b.gameState, prngState: b.rng.getState() });
}
function place(match: BattleMatch, actor = match.owner) {
    const snapshot = match.snapshot();
    const target = Core.getLegalMoves(snapshot.gameState, match.owner === 'black' ? 1 : -1, Cards.getCardContext(snapshot.cardState))[0];
    expect(target).toBeDefined();
    expect(match.apply({ type: 'place', row: target.row, col: target.col }, undefined, actor).ok).toBe(true);
}

describe('FATE_WILL reservation and exactly one completed turn', () => {
    test('controller extra turns preserve the reservation until the next opponent turn', () => {
        const b = base();
        b.cardState.hands.black = ['fate_will_01'];
        b.gameState.board[0][0] = 1;
        Cards.addMarker(b.cardState, 'specialStone', 0, 0, 'black', { type: 'TIME_STOP_DEITY', remainingOwnerTurns: 1 });
        const match = matchOf(b);
        match.startTurn();
        expect(match.apply({ type: 'use_card', useCardId: 'fate_will_01' }).ok).toBe(true);
        for (let turn = 0; turn < 4; turn++) {
            expect(match.snapshot().cardState.fateWillPhaseByTurnOwner.white).toBe('waiting');
            expect(match.apply({ type: 'pass', timeoutPass: true } as any).ok).toBe(true);
            match.startTurn();
        }
        expect(match.owner).toBe('white');
        expect(match.controller).toBe('black');
        expect(match.snapshot().cardState.fateWillPhaseByTurnOwner.white).toBe('active');
        place(match, 'black');
        expect(match.snapshot().cardState.fateWillControllerByTurnOwner.white).toBeNull();
        expect(match.snapshot().cardState.fateWillPhaseByTurnOwner.white).toBeNull();
    });

    test.each(['place', 'pass', 'timeout'] as const)('%s releases control before the time-stopped owner extra turn', completion => {
        const b = base();
        b.gameState.currentPlayer = -1;
        b.gameState.board[0][0] = -1;
        if (completion === 'pass') b.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(-1));
        b.cardState.fateWillControllerByTurnOwner.white = 'black';
        b.cardState.fateWillPhaseByTurnOwner.white = 'waiting';
        b.cardState.hands.white = ['fate_will_01'];
        Cards.addMarker(b.cardState, 'specialStone', 0, 0, 'white', { type: 'TIME_STOP_DEITY', remainingOwnerTurns: 1 });
        const match = matchOf(b);
        match.startTurn();
        expect(match.controller).toBe('black');
        expect(match.snapshot().cardState.fateWillPhaseByTurnOwner.white).toBe('active');
        // Nested FATE is consumed from the owner's hand, but never reserves control of black.
        expect(match.apply({ type: 'use_card', useCardId: 'fate_will_01' }, undefined, 'black').ok).toBe(true);
        expect(match.snapshot().cardState.hands.white).toEqual([]);
        expect(match.snapshot().cardState.charge.white).toBe(49);
        expect(match.snapshot().cardState.charge.black).toBe(99);
        expect(match.snapshot().cardState.fateWillControllerByTurnOwner.black).toBeNull();
        if (completion === 'place') place(match, 'black');
        else expect(match.apply({ type: 'pass', ...(completion === 'timeout' ? { timeoutPass: true, reason: 'timeout' } : {}) } as any, undefined, 'black').ok).toBe(true);
        expect(match.snapshot().cardState.fateWillControllerByTurnOwner.white).toBeNull();
        expect(match.snapshot().cardState.fateWillPhaseByTurnOwner.white).toBeNull();
        expect(match.owner).toBe('white');
        expect(match.controller).toBe('white');
        match.startTurn();
        expect(match.controller).toBe('white');
        expect(match.snapshot().cardState.timeStopConsecutiveTurnsRemainingByPlayer.white).toBe(3);
    });

    test('a selection-only end-turn card also releases control before the extra turn', () => {
        const b = base();
        b.gameState.currentPlayer = -1;
        b.cardState.fateWillControllerByTurnOwner.white = 'black';
        b.cardState.fateWillPhaseByTurnOwner.white = 'waiting';
        b.cardState.timeStopConsecutiveTurnsRemainingByPlayer.white = 4;
        b.cardState.hands.white = ['trap_01'];
        const match = matchOf(b);
        match.startTurn();
        expect(match.apply({ type: 'use_card', useCardId: 'trap_01' }, undefined, 'black').ok).toBe(true);
        expect(match.controller).toBe('black');
        const state = match.snapshot();
        const target = Cards.getTrapTargets(state.cardState, state.gameState, 'white')[0];
        expect(target).toBeDefined();
        expect(match.apply({ type: 'place', trapTarget: target } as any, undefined, 'black').ok).toBe(true);
        expect(match.owner).toBe('white');
        expect(match.controller).toBe('white');
        expect(match.snapshot().cardState.fateWillPhaseByTurnOwner.white).toBeNull();
        expect(match.snapshot().cardState.timeStopConsecutiveTurnsRemainingByPlayer.white).toBe(3);
    });

    test('copyCardState keeps reservation and active phase independently', () => {
        const b = base();
        b.cardState.fateWillControllerByTurnOwner.white = 'black';
        b.cardState.fateWillPhaseByTurnOwner.white = 'waiting';
        const copy = Cards.copyCardState(b.cardState);
        expect(copy.fateWillPhaseByTurnOwner).toEqual({ black: null, white: 'waiting' });
        copy.fateWillPhaseByTurnOwner.white = 'active';
        expect(b.cardState.fateWillPhaseByTurnOwner.white).toBe('waiting');
    });
});
