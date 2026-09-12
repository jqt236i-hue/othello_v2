import {lv10ComparisonThinkingMs} from '../scripts/summarize-cpu-lv10-metrics';

test('thinking metrics merge nested intervals and omit presentation and minimum-think waits',()=>{
    expect(lv10ComparisonThinkingMs([
        {stage:'card-policy',startMs:10,endMs:30},{stage:'card-context',startMs:15,endMs:20},
        {stage:'move-candidates',startMs:28,endMs:45},{stage:'tactical-safety',startMs:50,endMs:55},
        {stage:'minimum-think',startMs:55,endMs:300},{stage:'presentation',startMs:300,endMs:900}
    ])).toBe(40);
    expect(lv10ComparisonThinkingMs([])).toBe(0);
});
