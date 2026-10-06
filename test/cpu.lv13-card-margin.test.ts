import {searchLv13,LV13_SEARCH_CONFIG} from '../game/ai/cpu-lv13-search';
import {searchLv12} from '../game/ai/cpu-lv12-search';
const opening=require('./fixtures/cpu-lv13-opening.json');
const cardChoice=require('./fixtures/cpu-lv13-card-choice.json');

test('without a card-using root Lv13 judges exactly like Lv12',()=>{
    const before=JSON.stringify(opening.observation);
    const lv12=searchLv12(opening.observation,{maxTransitions:384});
    const lv13=searchLv13(opening.observation,{maxTransitions:384});
    expect({...lv13,version:''}).toEqual({...lv12,version:''});
    expect(lv13.version).toBe(LV13_SEARCH_CONFIG.version);
    expect(JSON.stringify(opening.observation)).toBe(before);
},120000);

test('a card must beat the best root that keeps the hand by the margin',()=>{
    const options={publicRecipes:cardChoice.publicRecipes,maxTransitions:512};
    const lv12=searchLv12(cardChoice.observation,options);
    const lv13=searchLv13(cardChoice.observation,options);
    expect(LV13_SEARCH_CONFIG.cardUseMargin).toBeGreaterThan(0);
    // Lv12 spends a treasure box for a near-tie with an ordinary placement.
    expect(lv12.action).toMatchObject({type:'use_card',useCardId:'chest_01'});
    expect(lv13.action?.type).toBe('place');
    expect(lv13.transitions).toBe(lv12.transitions);
    const deep=(result:typeof lv12)=>result.candidates!.filter(candidate=>candidate.retainedForDeepening);
    deep(lv13).forEach((candidate,index)=>{
        const original=deep(lv12)[index];
        expect(candidate.action).toEqual(original.action);
        expect(candidate.score).toBeCloseTo(original.score-(candidate.action.type==='use_card'?LV13_SEARCH_CONFIG.cardUseMargin:0),10);
    });
},120000);
