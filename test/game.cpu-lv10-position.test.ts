import { observeLv10Position } from '../game/ai/cpu-lv10-observation';
import Core = require('../game/logic/core');
import Board = require('../shared/shared-board-utils');
import {
    applyLv10Action, cloneLv10, enumerateLv10Actions,
    sampleLv10Position, startLv10Turn
} from '../game/ai/cpu-lv10-position';

const Cards: any = require('../game/logic/cards');
const Prng: any = require('../game/schema/prng');

function fixture() {
    const rng = Prng.createPRNG(91310000);
    const gameState = Core.createGameState();
    const cardState = Cards.createCardState(rng);
    cardState.hands = { black: ['destroy_01', 'perma_01'], white: ['gold_stone', 'swap_01'] };
    cardState.charge = { black: 99, white: 99 };
    gameState.turnNumber = 6;
    Cards.ensureCardCopyState(cardState);
    return { gameState, cardState, prngState: rng.getState() };
}

function sampled() { return sampleLv10Position(observeLv10Position(fixture(), 'black'), 42); }

test.each(['BOARD_SHRINK_WILL','BOARD_SHRINK_GOD'])('sampled %s uses its injected RNG through destruction and revival',type=>{
    const observation=cloneLv10(require('./fixtures/cpu-lv10-shrink-random-target.json'));
    if(type==='BOARD_SHRINK_GOD') observation.cardState.pendingEffectByPlayer.black={
        type,cardId:'board_shrink_god_01',stage:'selectTarget',firstTarget:{row:0,col:0}
    };
    const state=sampleLv10Position(observation,100901),before=JSON.stringify(state);
    const action=enumerateLv10Actions(state)[0];
    expect(action).toBeDefined();
    const result=applyLv10Action(state,action);
    expect(result.ok).toBe(true);
    if(!result.ok)throw new Error(result.reason);
    expect(result.state.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(result.state.prngState.calls).toBeGreaterThan(state.prngState.calls);
    expect(applyLv10Action(state,action)).toEqual(result);
    expect(JSON.stringify(state)).toBe(before);
});

describe('Lv10 public information and canonical transitions', () => {
    test('hidden hand identities, both deck orders and all live random states cannot affect the observation or sampled world', () => {
        const a = fixture(), b = cloneLv10(a);
        b.cardState.hands.white = ['udr_01', 'board_expand_01'];
        b.cardState.decks.black.reverse();
        b.cardState.decks.white.reverse();
        b.prngState = Prng.createPRNG(987654).getState();
        b.cardState.prngState = b.prngState;
        b.gameState.prngState = b.prngState;
        b.cardState._defaultRandomSource = Prng.createPRNG(999);
        b.cardState._boardOpsRandomSource = Prng.createPRNG(888);
        const left = observeLv10Position(a, 'black'), right = observeLv10Position(b, 'black');
        expect(left).toEqual(right);
        expect(left.cardState.hands.white.every((id: string) => id.startsWith('__hidden_hand__:'))).toBe(true);
        expect(left.cardState.decks).toBeUndefined();
        expect(left.cardState._defaultRandomSource).toBeUndefined();
        expect(sampleLv10Position(left, 12)).toEqual(sampleLv10Position(right, 12));
    });

    test('legitimately observed copies remain available and unrevealed copies stay hidden', () => {
        const state = fixture();
        state.cardState._revealedHandCopyIdsByViewer = { black: [state.cardState._handCopyIdsByPlayer.white[0]], white: [] };
        const view = observeLv10Position(state, 'black');
        expect(view.cardState.hands.white).toEqual(['gold_stone', '__hidden_hand__:white:1']);
        expect(sampleLv10Position(view, 99).cardState.hands.white[0]).toBe('gold_stone');
    });

    test('sampling preserves own effective costs and never changes the original match', () => {
        const state = fixture();
        const copyId = state.cardState._handCopyIdsByPlayer.black[0];
        state.cardState.cardCostOverridesByCopyId[copyId] = { cost: 7 };
        const before = cloneLv10(state);
        const liveRng = state.cardState._defaultRandomSource;
        const rngBefore = liveRng.getState();
        const sampled = sampleLv10Position(observeLv10Position(state, 'black'), 31);
        const syntheticCopy = sampled.cardState._handCopyIdsByPlayer.black[0];
        expect(Cards.getEffectiveCardCostForCopy(sampled.cardState, 'destroy_01', syntheticCopy)).toBe(7);
        expect(cloneLv10(state)).toEqual(before);
        expect(state.cardState._defaultRandomSource).toBe(liveRng);
        expect(liveRng.getState()).toEqual(rngBefore);
    });

    test('visible hand selection offers constrain sampling even before a reveal marker exists', () => {
        const state = fixture();
        state.cardState.pendingEffectByPlayer.black = {
            type: 'OBSERVER_WILL', stage: 'selectTarget', offers: [{ handIndex: 1, cardId: 'swap_01' }]
        };
        const view = observeLv10Position(state, 'black');
        expect(sampleLv10Position(view, 17).cardState.hands.white[1]).toBe('swap_01');
    });

    test('card permission uses total turnNumber 6 and retains the option to hold', () => {
        const state = sampled();
        state.gameState.turnNumber = 5;
        expect(enumerateLv10Actions(state).some(a => a.type === 'use_card')).toBe(false);
        state.gameState.turnNumber = 6;
        const actions = enumerateLv10Actions(state);
        expect(actions.some(a => a.type === 'use_card')).toBe(true);
        expect(actions.some(a => a.type === 'place' && Number.isInteger(a.row))).toBe(true);
        expect(actions.some(a => a.type === 'pass')).toBe(false);
    });

    test('card use, target selection and following placement use actual rules without mutating the input', () => {
        const state = sampled(), before = cloneLv10(state);
        const use = enumerateLv10Actions(state).find(a => a.useCardId === 'destroy_01')!;
        expect(use).toBeDefined();
        const used = applyLv10Action(state, use);
        expect(used.ok).toBe(true);
        if (!used.ok) throw new Error(used.reason);
        expect(used.state.cardState.pendingEffectByPlayer.black.type).toBe('DESTROY_ONE_STONE');
        const targets = enumerateLv10Actions(used.state);
        const action = targets.find(a => a.destroyTarget?.row === 3 && a.destroyTarget?.col === 3)!;
        expect(action).toBeDefined();
        const targeted = applyLv10Action(used.state, action);
        expect(targeted.ok).toBe(true);
        if (!targeted.ok) throw new Error(targeted.reason);
        expect(targeted.state.gameState.board[3][3]).toBe(0);
        expect(Core.countDiscs(targeted.state.gameState, targeted.state.cardState)).toMatchObject({ black: 2, white: 1 });
        expect(targeted.state.gameState.currentPlayer).toBe(1);
        expect(enumerateLv10Actions(targeted.state).some(a => a.type === 'use_card')).toBe(false);
        expect(state).toEqual(before);
    });

    test('illegal placements are reported, without advancing board or RNG', () => {
        const state = sampled(), before = cloneLv10(state);
        const result = applyLv10Action(state, { type: 'place', row: 3, col: 3 });
        expect(result.ok).toBe(false);
        expect(state).toEqual(before);
    });

    test('board-full is not a terminal shortcut; only the canonical consecutive passes end the game', () => {
        const state = sampled();
        state.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(1));
        state.cardState.hands = { black: [], white: [] };
        expect(Core.isGameOver(state.gameState)).toBe(false);
        const first = applyLv10Action(state, { type: 'pass' });
        if (!first.ok) throw new Error(first.reason);
        expect(Core.isGameOver(first.state.gameState)).toBe(false);
        const next = startLv10Turn(first.state);
        const second = applyLv10Action(next, { type: 'pass' });
        if (!second.ok) throw new Error(second.reason);
        expect(Core.isGameOver(second.state.gameState)).toBe(true);
        expect(enumerateLv10Actions(second.state)).toEqual([]);
    });

    test('expansion cells contribute to canonical results and legal placement generation', () => {
        const state = sampled();
        Board.addStateExpansionCells(state.gameState, [{ row: -1, col: 0, owner: 1 }], state.cardState);
        expect(Core.countDiscs(state.gameState, state.cardState)).toMatchObject({ black: 3, white: 2 });
        const before = cloneLv10(state);
        expect(enumerateLv10Actions(state).length).toBeGreaterThan(0);
        expect(state).toEqual(before);
    });

    test('two-stage position swap preserves the pending choice until its second target', () => {
        const state = fixture();
        state.cardState.hands.black = ['position_swap_01'];
        Cards.ensureCardCopyState(state.cardState);
        let position = sampleLv10Position(observeLv10Position(state, 'black'), 42);
        const actions: any[] = [];
        for (let step = 0; step < 3; step++) {
            const action = step === 0 ? enumerateLv10Actions(position).find(a => a.useCardId === 'position_swap_01')!
                : enumerateLv10Actions(position)[0];
            expect(action).toBeDefined();
            actions.push(action);
            const next = applyLv10Action(position, action);
            if (!next.ok) throw new Error(next.reason);
            expect(next.selectionFailed).not.toBe(true);
            position = next.state;
            if (step < 2) expect(position.cardState.pendingEffectByPlayer.black?.stage).toBe('selectTarget');
        }
        expect(position.cardState.pendingEffectByPlayer.black).toBeNull();
        expect(position.gameState.currentPlayer).toBe(1);
        expect(actions[1]).not.toEqual(actions[2]);
    });

    test('FATE controller receives the legitimately exposed victim hand, without a private future deck', () => {
        const state = fixture();
        state.cardState.fateWillControllerByTurnOwner.black = 'white';
        const view = observeLv10Position(state, 'white');
        expect(view.cardState.hands.black).toEqual(state.cardState.hands.black);
        expect(view.cardState.decks).toBeUndefined();
        const sampled = sampleLv10Position(view, 9);
        const action = enumerateLv10Actions(sampled).find(a => a.useCardId === 'destroy_01')!;
        expect(action.useCardOwnerKey).toBe('black');
        const next = applyLv10Action(sampled, action);
        expect(next.ok).toBe(true);
    });
});
