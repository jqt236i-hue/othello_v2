import * as Position from '../game/ai/cpu-lv10-position';
import { createProductionPosition } from '../src/engine/production-match';
import { observeLv10Position } from '../game/ai/cpu-lv10-observation';
import { searchLv12, LV12_SEARCH_CONFIG, commonLv12DepthValues } from '../game/ai/cpu-lv12-search';
import { LV11_SEARCH_CONFIG } from '../game/ai/cpu-lv11-search';
import { evaluateLv12Position } from '../game/ai/cpu-lv12-evaluation';
import { parseLv10AdvisorRequest, parseLv10AdvisorResult } from '../game/ai/cpu-lv10-advisor-contract';
import * as Scenarios from '../game/ai/cpu-lv12-scenarios';

test('Lv12 counts every canonical apply and turn-start against one shared transition budget', () => {
    const actual = createProductionPosition(12009141,{black:11,white:11});
    actual.gameState.turnNumber = 8;
    actual.cardState.hands.black = ['udr_01','perma_01'];
    const observation = observeLv10Position(actual,'black'), before=JSON.stringify(observation);
    const apply=jest.spyOn(Position,'applyLv10Action'), start=jest.spyOn(Position,'startLv10Turn');
    try {
        const result=searchLv12(observation,{maxTransitions:128});
        expect(result.transitions).toBe(apply.mock.calls.length+start.mock.calls.length);
        expect(result.transitions).toBeLessThanOrEqual(128);
        expect(result.action).not.toBeNull();
        expect(parseLv10AdvisorResult(result)).toBe(result);
        expect(searchLv12(observation,{maxTransitions:128})).toEqual(result);
        expect(JSON.stringify(observation)).toBe(before);
        expect(Position.applyLv10Action(Position.sampleLv10Position(observation,100901),result.action!).ok).toBe(true);
    } finally {apply.mockRestore();start.mockRestore();}
    expect(LV12_SEARCH_CONFIG).toMatchObject({maxTransitions:4096,maxMs:4800});
    expect(LV11_SEARCH_CONFIG).toMatchObject({version:'lv11-sparse-endgame-dev5',maxTransitions:4096,maxMs:4800});
});

test('unrevealed opponent cards, private deck order and match random state do not change the public judgment', () => {
    const actual=createProductionPosition(12009142,{black:11,white:11});
    const before=observeLv10Position(actual,'black');
    actual.cardState.hands.white=actual.cardState.hands.white.map(()=> 'perma_01');
    actual.cardState.decks.black.reverse();actual.cardState.decks.white.reverse();
    actual.prngState={fake:'must not reach the CPU'};
    const after=observeLv10Position(actual,'black');
    expect(after).toEqual(before);
    expect(parseLv10AdvisorRequest({observation:after})).toEqual({observation:before});
    expect(searchLv12(after,{maxTransitions:64})).toEqual(searchLv12(before,{maxTransitions:64}));
});

test('Lv12 uses the injected clock, clamps both limits, and preserves the live input', () => {
    const observation=observeLv10Position(createProductionPosition(12009143,{black:11,white:11}),'black');
    const original=JSON.stringify(observation);let ticks=0;
    const result=searchLv12(observation,{maxTransitions:999999,maxMs:999999,now:()=>ticks++*1000});
    expect(result.stopped).toBe('time_budget');
    expect(result.transitions).toBeLessThan(8);
    expect(JSON.stringify(observation)).toBe(original);
    expect(()=>searchLv12(observation,{maxTransitions:0})).toThrow('positive');
});

test('sparse endgame remains a material deficit and only canonical termination is a solved outcome', () => {
    const fixture=require('./fixtures/cpu-lv11-sparse-endgame.json');
    for(const seed of LV12_SEARCH_CONFIG.scenarioSeeds){
        const state=Position.sampleLv10Position(fixture.observation,seed,fixture.publicRecipes);
        const value=evaluateLv12Position(state,'white');
        expect(value).toBeLessThan(-6);expect(value).toBeGreaterThan(-100000);
        state.gameState.consecutivePasses=2;
        expect(evaluateLv12Position(state,'white')).toBeLessThanOrEqual(-100000);
    }
});

test('opponent comparisons use the deepest layer completed by every compared candidate in the same sampled world', () => {
    const common=commonLv12DepthValues([
        [[10,20,100000],[11,21,31]],
        [[12,22,null],[13,23,33]],
        [[null,null,null],[null,null,null]]
    ]);
    expect(common.depths).toEqual([1,2]);
    expect(common.values).toEqual([[20,31],[22,33],[null,null]]);
    const interrupted=commonLv12DepthValues([[[10,50,null]],[[20,null,null]]]);
    expect(interrupted.values).toEqual([[10],[20]]);
    expect(interrupted.depths).toEqual([0]);
});

test('slow transition throughput still completes common opponent worlds within the unchanged clock budget',()=>{
    const fixture=require('./fixtures/cpu-lv12-budget-slice.json');
    let transitions=0;
    const originalApply=Position.applyLv10Action,originalStart=Position.startLv10Turn;
    const apply=jest.spyOn(Position,'applyLv10Action').mockImplementation((...args)=>{transitions++;return originalApply(...args);});
    const start=jest.spyOn(Position,'startLv10Turn').mockImplementation((...args)=>{transitions++;return originalStart(...args);});
    try {
        // Deterministic slow clock for regression only. Production supplies
        // performance.now; this clock does not change game or search rules.
        const result=searchLv12(fixture.observation,{publicRecipes:fixture.publicRecipes,now:()=>transitions*6});
        expect(result.comparisonScenarioSeeds).toEqual([...LV12_SEARCH_CONFIG.scenarioSeeds]);
        expect(result.transitions).toBe(transitions);
        expect(result.transitions).toBeLessThanOrEqual(4096);
        expect(result.elapsedMs).toBeLessThanOrEqual(4800);
        expect(result.action).not.toBeNull();
    } finally {apply.mockRestore();start.mockRestore();}
},30000);

test('a changed chance outcome replans a now-illegal continuation without dropping the adverse sampled world',()=>{
    const fixture=require('./fixtures/cpu-lv12-chance-continuation.json');
    const hypothetical=require('./fixtures/cpu-lv12-chance-worlds.json');
    // Preserve the exact previously failing chance branch independently of
    // changes to public-prior sampling. Every transition below stays real.
    const sample=jest.spyOn(Scenarios,'createLv12ScenarioSampler').mockReturnValue({
        sampleSeeds:hypothetical.sampleSeeds,
        sample:index=>Position.cloneLv10(hypothetical.worlds[index])
    });
    const apply=jest.spyOn(Position,'applyLv10Action'),start=jest.spyOn(Position,'startLv10Turn');
    try{
        const result=searchLv12(fixture.observation,{publicRecipes:fixture.publicRecipes,maxTransitions:4096});
        expect(result.alternatePlanRepairs).toBeGreaterThan(0);
        expect(result.comparisonScenarioSeeds).toEqual([...LV12_SEARCH_CONFIG.scenarioSeeds]);
        expect(result.transitions).toBe(apply.mock.calls.length+start.mock.calls.length);
        expect(result.transitions).toBeLessThanOrEqual(4096);
    }finally{apply.mockRestore();start.mockRestore();sample.mockRestore();}
},30000);

test('card-use planning retains a stronger interior free placement before comparing opponent responses',()=>{
    const fixture=require('./fixtures/cpu-lv12-free-placement.json');
    const result=searchLv12(fixture.observation,{publicRecipes:fixture.publicRecipes,maxTransitions:4096});
    const destroyGod=result.candidates!.filter(candidate=>candidate.action.useCardId==='udg_01');
    // The recorded predecessor considered only (2,2)/(1,2). Full canonical
    // expansion identifies (4,4), preserving one more stone with equal enemy
    // material, as the stronger completed placement in this public world.
    expect(destroyGod.some(candidate=>candidate.continuation.some(action=>action.row===4&&action.col===4))).toBe(true);
    expect(result.transitions).toBeLessThanOrEqual(4096);
},30000);

test('a sparse opening with many legal lines reads the second card attack before choosing its placement',()=>{
    const fixture=require('./fixtures/cpu-lv12-sparse-card-threat.json');
    const initial=Scenarios.createLv12ScenarioSampler(fixture.observation,LV12_SEARCH_CONFIG.scenarioSeeds,fixture.publicRecipes).sample(0);
    expect(Position.lv10PlacementMoves(initial,'black').length+Position.lv10PlacementMoves(initial,'white').length).toBeGreaterThan(6);
    const apply=jest.spyOn(Position,'applyLv10Action'),start=jest.spyOn(Position,'startLv10Turn');
    try{
        const result=searchLv12(fixture.observation,{publicRecipes:fixture.publicRecipes});
        // The former three-turn horizon missed the generated follow-up card.
        // A04 deliberately compares another legal root after retaining the
        // original three. The old exact (1,2) expectation was not a forced-win
        // witness: audited first-action continuations of both (1,2) and (4,2)
        // lost, while (6,1) won with the newer continuation policy. Preserve
        // the tactical-depth/coverage contract without fixing an old choice.
        expect(result.comparisonDepths).toEqual([5,5,5]);
        const originalDefense=result.candidates!.find(candidate=>candidate.action.row===1&&candidate.action.col===2)!;
        expect(originalDefense.retainedForDeepening).toBe(true);
        expect(originalDefense.scenarioSeeds).toEqual([...LV12_SEARCH_CONFIG.scenarioSeeds]);
        expect(originalDefense.replies).toHaveLength(3);
        const selected=result.candidates!.find(candidate=>JSON.stringify(candidate.action)===JSON.stringify(result.action)
            &&JSON.stringify(candidate.continuation)===JSON.stringify(result.continuation))!;
        expect(selected.retainedForDeepening).toBe(true);
        expect(selected.scenarioSeeds).toEqual([...LV12_SEARCH_CONFIG.scenarioSeeds]);
        expect(selected.replies).toHaveLength(3);
        expect(result.value).toBe(selected.score);
        expect(Position.applyLv10Action(initial,result.action!).ok).toBe(true);
        // The legality probe above is outside the CPU judgment's allowance.
        const countedApplyCalls=apply.mock.calls.length-1;
        expect(result.transitions).toBe(countedApplyCalls+start.mock.calls.length);
        expect(result.transitions).toBeLessThanOrEqual(4096);
    }finally{apply.mockRestore();start.mockRestore();}
},45000);


test('an unfinished deeper layer keeps every candidate at the last common completed horizon',()=>{
    // The selected policy has the three 2/3/5-turn layers. The fourth-layer
    // fixture belonged to the unselected seven-turn experiment and is kept
    // in the archived research tests with its implementation.
    const incomplete=commonLv12DepthValues([
        [[10,20,100000],[11,21,31]],
        [[12,22,null],[13,null,null]]
    ]);
    expect(incomplete.depths).toEqual([1,0]);
    expect(incomplete.values).toEqual([[20,11],[22,13]]);
    const terminal=commonLv12DepthValues([[[100000,100000,100000]],[[1,2,3]]]);
    expect(terminal.values).toEqual([[100000],[3]]);
});

test('the early white opening completes all three five-turn comparisons within the counted budget',()=>{
    const fixture=require('./fixtures/cpu-lv12-opening-card-unlock.json');
    const apply=jest.spyOn(Position,'applyLv10Action'),start=jest.spyOn(Position,'startLv10Turn');
    const before=JSON.stringify(fixture.observation);
    try{
        const result=searchLv12(fixture.observation,{publicRecipes:fixture.publicRecipes});
        expect(result.comparisonScenarioSeeds).toEqual([...LV12_SEARCH_CONFIG.scenarioSeeds]);
        expect(result.comparisonDepths).toEqual([5,5,5]);
        expect(result.transitions).toBe(apply.mock.calls.length+start.mock.calls.length);
        expect(result.transitions).toBeLessThanOrEqual(4096);
        expect(JSON.stringify(fixture.observation)).toBe(before);
    }finally{apply.mockRestore();start.mockRestore();}
},45000);

test('the bounded opening completes every sampled five-turn line at slower throughput',()=>{
    const fixture=require('./fixtures/cpu-lv12-opening-reuse.json');
    const before=JSON.stringify(fixture.observation);
    let transitions=0;
    const actualApply=Position.applyLv10Action,actualStart=Position.startLv10Turn;
    const apply=jest.spyOn(Position,'applyLv10Action').mockImplementation((...args)=>{transitions++;return actualApply(...args);});
    const start=jest.spyOn(Position,'startLv10Turn').mockImplementation((...args)=>{transitions++;return actualStart(...args);});
    try{
        // The production horizon is now bounded at five turns; every world
        // must still finish at the slower recorded transition throughput.
        const result=searchLv12(fixture.observation,{publicRecipes:fixture.publicRecipes,now:()=>transitions*3});
        expect(result.comparisonDepths).toEqual([5,5,5]);
        expect(result.comparisonScenarioSeeds).toEqual([...LV12_SEARCH_CONFIG.scenarioSeeds]);
        expect(result.transitions).toBe(apply.mock.calls.length+start.mock.calls.length);
        expect(result.transitions).toBeLessThanOrEqual(4096);
        expect(result.elapsedMs).toBeLessThanOrEqual(4800);
        expect(JSON.stringify(fixture.observation)).toBe(before);
    }finally{apply.mockRestore();start.mockRestore();}
},45000);
