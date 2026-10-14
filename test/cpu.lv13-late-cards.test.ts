import {searchLv13,LV13_SEARCH_CONFIG} from '../game/ai/cpu-lv13-search';
import {aggregateLv13ScenarioValues} from '../game/ai/cpu-lv13-evaluation';
const lateCard=require('./fixtures/cpu-lv13-late-card.json');
const terminalLoss=require('./fixtures/cpu-lv13-terminal-loss.json');

test('a sampled terminal keeps its final stone margin as a tie-break',()=>{
    const TERMINAL=100000;
    // Losing by 6 is better than losing by 11; winning by 20 is better than by 5.
    expect(aggregateLv13ScenarioValues([-TERMINAL-6])).toBeGreaterThan(aggregateLv13ScenarioValues([-TERMINAL-11]));
    expect(aggregateLv13ScenarioValues([TERMINAL+20])).toBeGreaterThan(aggregateLv13ScenarioValues([TERMINAL+5]));
    // Every terminal still sits beyond any ordinary position of the same sign.
    expect(aggregateLv13ScenarioValues([TERMINAL+1])).toBeGreaterThan(aggregateLv13ScenarioValues([64]));
    expect(aggregateLv13ScenarioValues([-TERMINAL-60])).toBeLessThan(aggregateLv13ScenarioValues([-64]));
    // Ordinary positions keep the earlier scale.
    expect(aggregateLv13ScenarioValues([32])).toBeCloseTo(Math.tanh(.5),12);
});

// Human-condition development game: white (Lv13) is behind with 12 placements
// left and holds a bomb. With the earlier card-use margin it kept the bomb and
// placed; at the end of the game an unused card is worth nothing.
test('with few placements left a card is used without the card-use margin',()=>{
    const options={publicRecipes:lateCard.publicRecipes,maxTransitions:2048};
    const before=JSON.stringify(lateCard.observation);
    expect(LV13_SEARCH_CONFIG.cardUseMarginLate).toBeLessThan(LV13_SEARCH_CONFIG.cardUseMargin);
    const result=searchLv13(lateCard.observation,options);
    expect(result.action).toMatchObject({type:'use_card',useCardId:'bomb_01'});
    const earlier=searchLv13(lateCard.observation,{...options,tuning:{cardUseMarginLate:LV13_SEARCH_CONFIG.cardUseMargin}});
    expect(earlier.action?.type).toBe('place');
    expect(JSON.stringify(lateCard.observation)).toBe(before);
},120000);

// Same series: every line ends the game lost. Passing loses by 11; destroying
// a hand card to use Super Gravity loses by 6. The earlier search scored every
// sampled loss alike and the card margins made it pass.
test('when every compared line ends the game the smallest loss is chosen',()=>{
    const result=searchLv13(terminalLoss.observation,{publicRecipes:terminalLoss.publicRecipes,maxTransitions:2048});
    const deep=result.candidates!.filter(candidate=>candidate.retainedForDeepening);
    expect(deep.every(candidate=>candidate.replies.every(value=>Math.abs(value)>=100000))).toBe(true);
    const pass=deep.find(candidate=>candidate.action.type==='pass')!;
    expect(pass).toBeDefined();
    expect(result.action?.type).toBe('destroy_hand_card');
    const chosen=deep.find(candidate=>JSON.stringify(candidate.action)===JSON.stringify(result.action))!;
    expect(chosen.continuation.some((action:any)=>action.type==='use_card'&&action.useCardId==='super_gravity_01')).toBe(true);
    expect(Math.min(...chosen.replies)).toBeGreaterThan(Math.max(...pass.replies));
},120000);
