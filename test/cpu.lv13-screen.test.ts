import * as Scenarios from '../game/ai/cpu-lv13-scenarios';
import {searchLv13,LV13_SEARCH_CONFIG} from '../game/ai/cpu-lv13-search';
const fixture=require('./fixtures/cpu-lv13-adverse-screen.json');

test('screens retained roots with the adverse world before the second ordinary world',()=>{
    const indices:number[]=[];
    const original=Scenarios.createLv13ScenarioSampler;
    const spy=jest.spyOn(Scenarios,'createLv13ScenarioSampler').mockImplementation((...args)=>{
        const sampler=original(...args);
        return {...sampler,sample(index:number){indices.push(index);return sampler.sample(index);}};
    });
    try{
        const before=JSON.stringify(fixture.observation);
        const result=searchLv13(fixture.observation);
        expect(indices[0]).toBe(0);
        expect(indices[1]).toBe(2);
        expect(indices).toContain(1);
        expect(result.transitions).toBeLessThanOrEqual(4096);
        expect(result.action).not.toBeNull();
        expect(JSON.stringify(fixture.observation)).toBe(before);
        expect(LV13_SEARCH_CONFIG.scenarioSeeds).toEqual([100901,100909,100913]);
    }finally{spy.mockRestore();}
},60000);
