import { observeLv10Position } from '../game/ai/cpu-lv10-observation';
import Core = require('../game/logic/core');

import { searchLv10 } from '../game/ai/cpu-lv10-search';
import { parseLv10AdvisorRequest } from '../game/ai/cpu-lv10-advisor-contract';
import { runLv10Turn } from '../game/cpu-lv10-turn';
import { executeLv10WorkerMessage } from '../browser-vite/cpu-worker/lv10-worker-entry';
import { CPU_WORKER_OPERATIONS, CPU_WORKER_PROTOCOL_VERSION } from '../browser-vite/cpu-worker/protocol';

const Cards: any = require('../game/logic/cards');
function fixture() {
    return { gameState: Core.createGameState(), cardState: Cards.createCardState() };
}

test('a rejected action is remembered from public feedback and reconsidered only after a public change',async()=>{
    const state=fixture(),memory={identity:null as string|null,actions:[] as any[]};
    const requests:any[]=[];
    const deps={getState:()=>state,getPublicRecipes:()=>undefined,isCurrent:()=>true,rejectedActions:memory,
        advise:async(request:any)=>{requests.push(request);return searchLv10(request.observation,{maxTransitions:1,excludedActions:request.excludedActions});},
        apply:jest.fn(async()=>false)};
    const first=await runLv10Turn('black',deps);
    expect(first.outcome).toBe('rejected'); // UI pass/move helpers may return a boolean.
    expect(memory.actions).toEqual([first.action]);
    const second=await runLv10Turn('black',deps);
    expect(requests[1].excludedActions).toEqual([first.action]);
    expect(second.action).not.toEqual(first.action);
    expect(second.excludedActions).toEqual([first.action]);
    state.gameState.turnNumber++;
    await runLv10Turn('black',deps);
    expect(requests[2].excludedActions).toEqual([]);
});

test('Lv10 Worker uses the canonical advisor and does not load a legacy model', async () => {
    const state = fixture();
    // A real terminal state keeps the Worker integration test quick.
    state.gameState.consecutivePasses = 2;
    const payload = { observation: observeLv10Position(state, 'black') };
    expect(parseLv10AdvisorRequest(payload)).toBe(payload);
    const response = executeLv10WorkerMessage({ protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
        requestId: 'lv10-test-1', kind: 'request', operation: CPU_WORKER_OPERATIONS.LV10_ADVISE,
        decisionEpoch: 1, stateVersion: null, turnNumber: 0, payload });
    expect(response).toMatchObject({ ok: true, result: { stopped: 'terminal', action: null } });
});

test('private live deck and RNG are refused by the advisor transport', () => {
    const observation = observeLv10Position(fixture(), 'black');
    observation.cardState.decks = { black: ['gold_stone'], white: [] };
    expect(() => parseLv10AdvisorRequest({ observation })).toThrow('Private state');
});

test('a stale asynchronous recommendation cannot mutate a reset match', async () => {
    const state = fixture(), apply = jest.fn();
    const result = await runLv10Turn('black', { getState: () => state, getPublicRecipes: () => undefined,
        advise: async request => {
            const result = searchLv10(request.observation, { maxTransitions: 1 });
            state.gameState.turnNumber++;
            return result;
        }, isCurrent: () => true, apply });
    expect(result.outcome).toBe('stale');
    expect(apply).not.toHaveBeenCalled();
});

test('Worker failure returns a legal emergency move, without invoking shared Lv6 policy', async () => {
    const state = fixture(), apply = jest.fn(async () => ({ ok: true }));
    const before = JSON.stringify(state);
    const result = await runLv10Turn('black', { getState: () => state, getPublicRecipes: () => undefined,
        advise: async () => { throw new Error('simulated Worker timeout'); }, isCurrent: () => true, apply });
    expect(result).toMatchObject({ source: 'fallback', outcome: 'applied', error: 'simulated Worker timeout' });
    expect(Core.getLegalMoves(state.gameState, 1)).toEqual(expect.arrayContaining([expect.objectContaining({ row: result.action!.row, col: result.action!.col })]));
    expect(JSON.stringify(state)).toBe(before);
});

test('emergency target choice skips accepted commands whose movement effect fails', async () => {
    const { sampleLv10Position, applyLv10Action } = require('../game/ai/cpu-lv10-position');
    const observation = JSON.parse(JSON.stringify(require('./fixtures/cpu-lv10-frozen-target.json')));
    observation.cardState.markers.push({ id: 80, kind: 'specialStone', owner: 'black', row: 0, col: 3,
        data: { type: 'FREEZE', remainingOwnerTurns: 5 } });
    const state = sampleLv10Position(observation, 100901);
    expect(applyLv10Action(state, { type: 'place', strongWindTarget: { row: 0, col: 3 } })).toMatchObject({ selectionFailed: true });
    const applied: any[] = [];
    const clock = jest.spyOn(performance, 'now').mockReturnValue(0);
    try {
        const record = await runLv10Turn('black', { getState: () => state, getPublicRecipes: () => undefined,
            advise: async () => { throw new Error('simulated Worker timeout'); }, isCurrent: () => true,
            apply: async action => { const result = applyLv10Action(state, action); applied.push(result); return result; } });
        expect(record).toMatchObject({ source: 'fallback', outcome: 'applied', action: { type: 'place' } });
        expect(applied).toHaveLength(1);
        expect(applied[0].selectionFailed).not.toBe(true);
        expect(applied[0].state.cardState.pendingEffectByPlayer.black).toBeNull();
    } finally { clock.mockRestore(); }
});

test('an unresolvable cancellable selection uses the normal cancellation action', async () => {
    const { sampleLv10Position, applyLv10Action, lv10CancellationAction } = require('../game/ai/cpu-lv10-position');
    const observation = JSON.parse(JSON.stringify(require('./fixtures/cpu-lv10-frozen-target.json')));
    // Strong Wind itself is not cancellable; do not grant it a new rule.
    expect(lv10CancellationAction(sampleLv10Position(observation, 100901))).toBeNull();
    observation.cardState.pendingEffectByPlayer.black = { type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget' };
    observation.gameState.board.forEach((row: number[], r: number) => row.forEach((cell: number, c: number) => {
        if (cell) observation.cardState.markers.push({ id: 100+r*8+c, kind: 'specialStone', owner: cell===1?'black':'white', row:r, col:c,
            data: { type: 'FREEZE', remainingOwnerTurns: 5 } });
    }));
    const state = sampleLv10Position(observation, 100901), before = JSON.stringify(state);
    let elapsed = 0;
    const clock = jest.spyOn(performance, 'now').mockImplementation(() => elapsed += 25);
    try {
        const apply = jest.fn(async action => applyLv10Action(state, action));
        const record = await runLv10Turn('black', { getState: () => state, getPublicRecipes: () => undefined,
            advise: async () => { throw new Error('simulated Worker timeout'); }, isCurrent: () => true, apply });
        expect(record).toMatchObject({ source: 'fallback', outcome: 'applied', action: { type: 'cancel_card' } });
        expect(apply).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(state)).toBe(before);
    } finally { clock.mockRestore(); }
});
