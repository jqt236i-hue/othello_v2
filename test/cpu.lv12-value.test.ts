import {createProductionPosition} from '../src/engine/production-match';
import {extractLv12ValueFeatures,LV12_VALUE_FEATURE_NAMES,LV12_PRIOR_VALUE_WEIGHTS,evaluateLv12Position} from '../game/ai/cpu-lv12-evaluation';
import {LV12_VALUE_WEIGHTS} from '../game/ai/cpu-lv12-model';
import {sampleLv10Position} from '../game/ai/cpu-lv10-position';
import {observeLv10Position} from '../game/ai/cpu-lv10-observation';

test('public sampled value features are finite, zero-sum and do not modify the board or cards',()=>{
    const state=createProductionPosition(120501,{black:11,white:11});
    const observation=observeLv10Position(state,'black');
    const sampled=sampleLv10Position(observation,100901),before=JSON.stringify(sampled);
    const black=extractLv12ValueFeatures(sampled,'black'),white=extractLv12ValueFeatures(sampled,'white');
    expect(black).toHaveLength(LV12_VALUE_FEATURE_NAMES.length);
    expect(LV12_VALUE_WEIGHTS).toHaveLength(black.length);
    expect(LV12_PRIOR_VALUE_WEIGHTS).toHaveLength(black.length);
    black.forEach((value,index)=>{expect(Number.isFinite(value)).toBe(true);expect(value+white[index]).toBeCloseTo(0,10);});
    expect(evaluateLv12Position(sampled,'black')+evaluateLv12Position(sampled,'white')).toBeCloseTo(0,10);
    expect(JSON.stringify(sampled)).toBe(before);
});
test.each([
    ['double_01','triple_01'],['triple_01','quad_01'],['quad_01','infinite_01'],
    ['double_chain_01','triple_chain_01'],['triple_chain_01','quad_chain_01'],['quad_chain_01','infinite_chain_01']
])('a publicly held generated %s -> %s upgrade retains positive hand value', (previous,next)=>{
    const state=createProductionPosition(120801,{black:11,white:11});
    state.cardState.hands={black:[previous],white:[]};
    const previousValue=extractLv12ValueFeatures(state,'black')[LV12_VALUE_FEATURE_NAMES.indexOf('hand')];
    state.cardState.hands.black=[next];
    const nextValue=extractLv12ValueFeatures(state,'black')[LV12_VALUE_FEATURE_NAMES.indexOf('hand')];
    expect(nextValue).toBeGreaterThan(previousValue);
    expect(nextValue).toBeGreaterThan(0);
});
