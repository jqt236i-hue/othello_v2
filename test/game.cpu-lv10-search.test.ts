import { observeLv10Position } from '../game/ai/cpu-lv10-observation';
import Core = require('../game/logic/core');
import { searchLv10, evaluateLv10Position, LV10_SEARCH_CONFIG } from '../game/ai/cpu-lv10-search';
import { sampleLv10Position, cloneLv10, applyLv10Action } from '../game/ai/cpu-lv10-position';

const Cards: any = require('../game/logic/cards');
const Prng: any = require('../game/schema/prng');

function initialObservation() {
    const gameState = Core.createGameState();
    const cardState = Cards.createCardState(Prng.createPRNG(13));
    cardState.hands = { black: ['destroy_01', 'perma_01'], white: ['gold_stone'] };
    cardState.charge = { black: 99, white: 99 };
    gameState.turnNumber = 6;
    Cards.ensureCardCopyState(cardState);
    return observeLv10Position({gameState,cardState}, 'black');
}

describe('bounded canonical Lv10 development search', () => {
    test('a failed move of a frozen stone is not a way to advance the sampled RNG before choosing another target', () => {
        // Public projection of development seed2089148261, turn20. Dev4 chose
        // frozen (1,5), followed by an effective target after consuming RNG.
        const observation = cloneLv10(require('./fixtures/cpu-lv10-frozen-target.json'));
        const state = sampleLv10Position(observation, 100901), before = cloneLv10(state);
        const failed = applyLv10Action(state, { type: 'place', strongWindTarget: { row: 1, col: 5 } });
        expect(failed).toMatchObject({ ok: true, selectionFailed: true });
        expect(state).toEqual(before);
        const result = searchLv10(observation);
        expect(result.action).toBeTruthy();
        const selected = applyLv10Action(state, result.action!);
        expect(selected.ok).toBe(true);
        if (!selected.ok) throw new Error(selected.reason);
        expect(selected.selectionFailed).not.toBe(true);
        expect(selected.state.cardState.pendingEffectByPlayer.black).toBeNull();
    });

    test('finds a legal action reproducibly without changing its public observation', () => {
        const observation = initialObservation(), before = cloneLv10(observation);
        const a = searchLv10(observation, {maxTransitions:96});
        const b = searchLv10(observation, {maxTransitions:96});
        expect(a).toEqual(b);
        expect(a.action).toBeTruthy();
        expect(a.transitions).toBeLessThanOrEqual(96);
        const state = sampleLv10Position(observation, 100901);
        expect(applyLv10Action(state,a.action!).ok).toBe(true);
        expect(observation).toEqual(before);
    });

    test('one-node budget returns an actually legal action, with an explicit incomplete-search result', () => {
        const observation=initialObservation();
        const result=searchLv10(observation,{maxTransitions:1});
        expect(result.transitions).toBe(1);
        expect(result.action).toBeTruthy();
        expect(['node_budget','no_completed_plan']).toContain(result.stopped);
        expect(applyLv10Action(sampleLv10Position(observation,100901),result.action!).ok).toBe(true);
    });

    test('rejects NaN or unbounded budgets instead of silently running without a ceiling', () => {
        const observation=initialObservation();
        for (const value of [NaN,Infinity,-1,0,1.5]) expect(()=>searchLv10(observation,{maxTransitions:value})).toThrow();
        expect(()=>searchLv10(observation,{maxMs:Infinity})).toThrow();
        expect(searchLv10(observation,{maxTransitions:100000}).transitions).toBeLessThanOrEqual(LV10_SEARCH_CONFIG.maxTransitions);
    });

    test('a canonical winning final pass outranks opening the board with a card', () => {
        const observation=initialObservation();
        observation.gameState.board=Array.from({length:8},()=>Array(8).fill(1));
        observation.gameState.board[0][0]=-1;
        observation.gameState.consecutivePasses=1;
        const result=searchLv10(observation,{maxTransitions:128});
        expect(result.action).toEqual({type:'pass'});
        const terminal=applyLv10Action(sampleLv10Position(observation,100901),result.action!);
        if(!terminal.ok)throw new Error(terminal.reason);
        expect(Core.isGameOver(terminal.state.gameState)).toBe(true);
        expect(evaluateLv10Position(terminal.state,'black')).toBeGreaterThan(100000);
    });

    test('a filled board is evaluated as a nonterminal card game until the second pass', () => {
        const observation=initialObservation();
        observation.gameState.board=Array.from({length:8},()=>Array(8).fill(1));
        const state=sampleLv10Position(observation,8);
        expect(Math.abs(evaluateLv10Position(state,'black'))).toBeLessThan(100000);
        state.gameState.consecutivePasses=2;
        expect(searchLv10({...observation,gameState:state.gameState}).stopped).toBe('terminal');
    });

    test('many continuations of a free-placement card do not remove other card choices from reply search', () => {
        const gameState=Core.createGameState(),cardState=Cards.createCardState(Prng.createPRNG(13));
        gameState.turnNumber=6;
        cardState.hands={black:['destroy_01','perma_01','breeding_01','udr_01','gold_stone'],white:[]};
        cardState.charge={black:99,white:99};
        Cards.ensureCardCopyState(cardState);
        const result=searchLv10(observeLv10Position({gameState,cardState},'black'));
        const comparedCards=new Set(result.candidates!.filter(c=>c.action.type==='use_card'&&c.replies.length).map(c=>c.action.useCardId));
        expect(comparedCards.size).toBeGreaterThanOrEqual(2);
    });

    test.each(['POISONED','SCORCHED'])('an own %s stone is a liability that grows as destruction approaches', type => {
        const state=sampleLv10Position(initialObservation(),42), normal=evaluateLv10Position(state,'black');
        state.cardState.markers=[{id:100,kind:'specialStone',owner:'black',row:3,col:4,data:{type,remainingTurns:5}}];
        const delayed=evaluateLv10Position(state,'black');
        state.cardState.markers[0].data.remainingTurns=1;
        const imminent=evaluateLv10Position(state,'black');
        expect(delayed).toBeLessThan(normal);
        expect(imminent).toBeLessThan(delayed);
    });
});
