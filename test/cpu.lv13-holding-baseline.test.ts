import {searchLv13,LV13_SEARCH_CONFIG} from '../game/ai/cpu-lv13-search';
const fixture=require('./fixtures/cpu-lv13-holding-baseline.json');

// A plan holds the hand when its own turn neither uses nor destroys a card.
const holds=(candidate:any)=>![candidate.action,...candidate.continuation]
    .some((action:any)=>action.type==='use_card'||action.type==='destroy_hand_card');
const options={publicRecipes:fixture.publicRecipes,maxTransitions:2048};

// Forcing the best holding turn into the compared roots was measured to lose
// (docs/cpu-lv13-development-plan.md, 第5段階): when the shallow comparison
// keeps only card roots, the card-use margin must not change the judgment.
test('when every compared root spends a card the card-use margin does not change the judgment',()=>{
    const before=JSON.stringify(fixture.observation);
    const withMargin=searchLv13(fixture.observation,options);
    const withoutMargin=searchLv13(fixture.observation,{...options,tuning:{cardUseMargin:0}});
    expect(LV13_SEARCH_CONFIG.cardUseMargin).toBeGreaterThan(0);
    const compared=withMargin.candidates!.filter(candidate=>candidate.retainedForDeepening);
    expect(compared.length).toBeGreaterThan(1);
    expect(compared.some(holds)).toBe(false);
    expect(withMargin.action).toEqual(withoutMargin.action);
    expect(withMargin.candidates!.map(candidate=>candidate.score)).toEqual(withoutMargin.candidates!.map(candidate=>candidate.score));
    expect(JSON.stringify(fixture.observation)).toBe(before);
},120000);
