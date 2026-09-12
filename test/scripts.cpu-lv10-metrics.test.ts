import {lv10ComparisonThinkingMs,frozenLv9InvocationTimes} from '../scripts/summarize-cpu-lv10-metrics';
import {FROZEN_LV9_MODEL_SETTINGS,verifyFrozenLv9ModelStatus} from '../scripts/cpu-lv10-frozen-oracle';

test('a completed game cannot hide a missing or reconfigured frozen Lv9 model',()=>{
    const status={...FROZEN_LV9_MODEL_SETTINGS,loaded:true,lastError:null};
    expect(()=>verifyFrozenLv9ModelStatus(status)).not.toThrow();
    for(const invalid of [{...status,loaded:false},{...status,lastError:'inference failure'},{...status,topK:2}]) {
        expect(()=>verifyFrozenLv9ModelStatus(invalid)).toThrow('Frozen Lv9 model');
    }
});

test('thinking metrics merge nested intervals and omit unrelated stages',()=>{
    expect(lv10ComparisonThinkingMs([
        {stage:'card-policy',startMs:10,endMs:30},{stage:'card-context',startMs:15,endMs:20},
        {stage:'move-candidates',startMs:28,endMs:45},{stage:'tactical-safety',startMs:50,endMs:55},
        {stage:'minimum-think',startMs:55,endMs:300},{stage:'presentation',startMs:300,endMs:900}
    ])).toBe(40);
    expect(lv10ComparisonThinkingMs([])).toBe(0);
});

test('a frozen full-turn trace is measured by original invocation, not by delivered action or whole turn',()=>{
    const answers=[{turnPlan:{index:0},performanceEntries:[]},{turnPlan:{index:1},performanceEntries:[
        {runId:7,stage:'card-policy',startMs:10,endMs:18},
        {runId:7,stage:'card-context',startMs:12,endMs:15},
        {runId:7,stage:'presentation',startMs:18,endMs:180},
        {runId:8,stage:'move-candidates',startMs:200,endMs:212},
        {runId:null,correlationId:'delay',stage:'handoff-delay',startMs:180,endMs:200}
    ]}];
    expect(frozenLv9InvocationTimes(answers)).toEqual([8,12]);
});
