import * as Position from '../game/ai/cpu-lv10-position';
import { searchLv12, LV12_SEARCH_CONFIG } from '../game/ai/cpu-lv12-search';
const fixture=require('./fixtures/cpu-lv12-additional-root-comparison.json');
const planKey=(candidate:any)=>JSON.stringify([candidate.action,...candidate.continuation]);

function tracked(check:any,clock:'fixed'|'interrupt-extra'|'slow'){
    let operations=0;
    const original=JSON.stringify(check.observation),applyOriginal=Position.applyLv10Action,startOriginal=Position.startLv10Turn;
    const apply=jest.spyOn(Position,'applyLv10Action').mockImplementation((...args)=>{operations++;return applyOriginal(...args);});
    const start=jest.spyOn(Position,'startLv10Turn').mockImplementation((...args)=>{operations++;return startOriginal(...args);});
    try{
        const result=searchLv12(check.observation,{publicRecipes:check.publicRecipes,excludedActions:check.excludedActions,
            ...(clock==='fixed'?{}:{now:()=>clock==='slow'?operations*6:operations<=check.baselineFixed.transitions?0:4800})});
        expect(result.transitions).toBe(operations);
        expect(operations).toBeLessThanOrEqual(4096);
        expect(JSON.stringify(check.observation)).toBe(original);
        return result;
    }finally{apply.mockRestore();start.mockRestore();}
}

describe.each(fixture.cases)('additional-root regression $id (baseline $baselineOutcome; candidate $candidateOutcome)',check=>{
    test('keeps original completed comparisons and counts the additional alternative inside the same allowance',()=>{
        const result=tracked(check,'fixed'),before=check.baselineFixed;
        expect(LV12_SEARCH_CONFIG).toMatchObject({maxTransitions:4096,maxMs:4800,maxAdditionalDeepCandidates:1});
        expect(result.additionalDeepeningAttempts).toBe(1);
        expect(result.additionalDeepeningCompleted).toBe(1);
        expect(result.additionalDeepeningStartedAtTransitions).toBe(before.transitions);
        expect(result.comparisonDepths).toEqual([5,5,5]);
        expect(result.scenarioSampleSeeds).toEqual(before.scenarioSampleSeeds);
        const originals=before.candidates.filter((c:any)=>c.retainedForDeepening);
        for(const prior of originals){
            const retained=result.candidates!.find(c=>planKey(c)===planKey(prior));
            expect(retained?.retainedForDeepening).toBe(true);
            expect(retained?.replies).toEqual(prior.replies);
            expect(retained?.score).toBe(prior.score);
        }
        const extra=result.candidates!.filter(c=>c.additionalDeepeningAttempted);
        expect(extra).toHaveLength(1);
        expect(extra[0].scenarioSeeds).toEqual([...LV12_SEARCH_CONFIG.scenarioSeeds]);
        expect(extra[0].score).toBeGreaterThan(Math.max(...originals.map((c:any)=>c.score)));
        expect(result.action).toEqual(extra[0].action);
        // A higher score is not a match-win assertion: one fixture is an actual regression.
    },60000);

    test('interrupting the extra work keeps the original decision and completed values',()=>{
        const result=tracked(check,'interrupt-extra'),before=check.baselineFixed;
        expect(result.additionalDeepeningAttempts).toBe(1);
        expect(result.additionalDeepeningCompleted).toBe(0);
        expect(result.additionalDeepeningStartedAtTransitions).toBe(before.transitions);
        expect(result.transitions).toBe(before.transitions+1);
        expect(result.action).toEqual(before.action);
        expect(result.continuation).toEqual(before.continuation);
        expect(result.value).toBe(before.value);
        expect(result.comparisonDepths).toEqual(before.comparisonDepths);
        expect(result.elapsedMs).toBe(4800);
    },60000);

    test('a slow common clock leaves the original comparison intact when no complete extra fits',()=>{
        const result=tracked(check,'slow'),before=check.baselineSlow;
        expect(result.additionalDeepeningCompleted).toBe(0);
        expect(result.transitions).toBe(before.transitions);
        expect(result.action).toEqual(before.action);
        expect(result.continuation).toEqual(before.continuation);
        expect(result.value).toBe(before.value);
        expect(result.elapsedMs).toBeLessThanOrEqual(4800);
    },60000);
});
