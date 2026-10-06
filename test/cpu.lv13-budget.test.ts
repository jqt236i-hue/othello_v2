import * as Position from '../game/ai/cpu-lv10-position';
import {searchLv13,LV13_SEARCH_CONFIG} from '../game/ai/cpu-lv13-search';
import {createProductionPosition,ProductionMatch} from '../src/engine/production-match';
import {observeLv10Position} from '../game/ai/cpu-lv10-observation';

test('search counts every canonical transition and preserves its public input',()=>{
    const match=new ProductionMatch(createProductionPosition(901234,{black:12,white:12}));
    match.startTurn();
    const observation=observeLv10Position(match.snapshot(),'black');
    const before=JSON.stringify(observation);
    let transitions=0;
    const originalApply=Position.applyLv10Action,originalStart=Position.startLv10Turn;
    const apply=jest.spyOn(Position,'applyLv10Action').mockImplementation((...args)=>{transitions++;return originalApply(...args);});
    const start=jest.spyOn(Position,'startLv10Turn').mockImplementation((...args)=>{transitions++;return originalStart(...args);});
    try{
        const result=searchLv13(observation,{maxTransitions:256});
        expect(result.transitions).toBe(transitions);
        expect(transitions).toBeLessThanOrEqual(256);
        expect(result.action).not.toBeNull();
        expect(JSON.stringify(observation)).toBe(before);
    }finally{apply.mockRestore();start.mockRestore();}
},60000);

test('clock boundary preserves an already checked action within the 5 s judgment',()=>{
    const match=new ProductionMatch(createProductionPosition(901234,{black:12,white:12}));
    match.startTurn();
    const observation=observeLv10Position(match.snapshot(),'black');
    let transitions=0;
    const originalApply=Position.applyLv10Action;
    const originalStart=Position.startLv10Turn;
    const apply=jest.spyOn(Position,'applyLv10Action').mockImplementation((...args)=>{transitions++;return originalApply(...args);});
    const start=jest.spyOn(Position,'startLv10Turn').mockImplementation((...args)=>{transitions++;return originalStart(...args);});
    try{
        const result=searchLv13(observation,{now:()=>transitions*1000});
        expect(LV13_SEARCH_CONFIG).toMatchObject({maxTransitions:6144,maxMs:4700});
        expect(result.action).not.toBeNull();
        expect(result.stopped).toBe('time_budget');
        // The clock is checked before each transition; a deliberately atomic
        // 1000 ms transition ends the search at the first check past 4700 ms.
        expect(result.elapsedMs).toBe(5000);
        expect(result.transitions).toBe(5);
    }finally{apply.mockRestore();start.mockRestore();}
},60000);
