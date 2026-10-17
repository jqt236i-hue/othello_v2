import {searchLv13,LV13_SEARCH_CONFIG} from '../game/ai/cpu-lv13-search';
import {searchLv12} from '../game/ai/cpu-lv12-search';
const opening=require('./fixtures/cpu-lv13-opening.json');
const cardChoice=require('./fixtures/cpu-lv13-card-choice.json');
const handDestroy=require('./fixtures/cpu-lv13-hand-destroy.json');
const destroyBeforeCard=require('./fixtures/cpu-lv13-destroy-before-card.json');
const marginOf=(action:any)=>action.type==='use_card'?LV13_SEARCH_CONFIG.cardUseMargin:action.type==='destroy_hand_card'?LV13_SEARCH_CONFIG.destroyHandMargin:0;
// Lv13 adds the stable-stone features after the Lv12 vector. With their
// weights at zero the evaluation is exactly the Lv12 evaluation.
const {LV13_VALUE_WEIGHTS}=require('../game/ai/cpu-lv13-model');
const {LV12_VALUE_WEIGHTS}=require('../game/ai/cpu-lv12-model');
const lv12Weights:number[]=[...LV13_VALUE_WEIGHTS.slice(0,LV12_VALUE_WEIGHTS.length),0,0];

test('the Lv13 weight vector extends the Lv12 vector by the stable-stone features',()=>{
    expect(LV13_VALUE_WEIGHTS.length).toBe(LV12_VALUE_WEIGHTS.length+2);
    expect(LV13_VALUE_WEIGHTS.slice(0,LV12_VALUE_WEIGHTS.length)).toEqual(LV12_VALUE_WEIGHTS);
});

test('without a card-using root and without stable-stone weights Lv13 judges exactly like Lv12',()=>{
    const before=JSON.stringify(opening.observation);
    const lv12=searchLv12(opening.observation,{maxTransitions:384});
    const lv13=searchLv13(opening.observation,{maxTransitions:384,valueWeights:lv12Weights});
    expect({...lv13,version:''}).toEqual({...lv12,version:''});
    expect(lv13.version).toBe(LV13_SEARCH_CONFIG.version);
    expect(JSON.stringify(opening.observation)).toBe(before);
},120000);

test('a card must beat the best root that keeps the hand by the margin',()=>{
    const options={publicRecipes:cardChoice.publicRecipes,maxTransitions:512};
    const lv12=searchLv12(cardChoice.observation,options);
    const lv13=searchLv13(cardChoice.observation,{...options,valueWeights:lv12Weights});
    expect(LV13_SEARCH_CONFIG.cardUseMargin).toBeGreaterThan(0);
    // Lv12 spends a treasure box for a near-tie with an ordinary placement.
    expect(lv12.action).toMatchObject({type:'use_card',useCardId:'chest_01'});
    expect(lv13.action?.type).toBe('place');
    expect(lv13.transitions).toBe(lv12.transitions);
    const deep=(result:typeof lv12)=>result.candidates!.filter(candidate=>candidate.retainedForDeepening);
    // Lv13 scores a sampled terminal with its stone margin as a tie-break, so
    // only roots without a terminal reply keep Lv12's exact score.
    const ordinary=(candidate:any)=>candidate.replies.every((value:number)=>Math.abs(value)<100000);
    expect(deep(lv13).filter(ordinary).length).toBeGreaterThan(0);
    deep(lv13).forEach((candidate,index)=>{
        const original=deep(lv12)[index];
        expect(candidate.action).toEqual(original.action);
        if(ordinary(candidate))expect(candidate.score).toBeCloseTo(original.score-marginOf(candidate.action),10);
    });
},120000);

// The draw rules (a full hand loses the next draw) are switched off here: this
// test is about the destroy margin alone.
const noDrawRules={keepDraws:false,drawHandLimit:99};

test('destroying a hand card must beat the best root that keeps it by the margin',()=>{
    const options={publicRecipes:handDestroy.publicRecipes,maxTransitions:512};
    const lv12=searchLv12(handDestroy.observation,options);
    const lv13=searchLv13(handDestroy.observation,{...options,valueWeights:lv12Weights,tuning:noDrawRules});
    expect(LV13_SEARCH_CONFIG.destroyHandMargin).toBeGreaterThan(0);
    // Lv12 destroys a card for a near-tie with an ordinary placement.
    expect(lv12.action?.type).toBe('destroy_hand_card');
    expect(lv13.action?.type).toBe('place');
    const deep=(result:typeof lv12)=>result.candidates!.filter(candidate=>candidate.retainedForDeepening);
    deep(lv13).forEach((candidate,index)=>{
        expect(candidate.action).toEqual(deep(lv12)[index].action);
        expect(candidate.score).toBeCloseTo(deep(lv12)[index].score-marginOf(candidate.action),10);
    });
},120000);

// The same position holds a full hand (5 cards) with cards left in the deck:
// placing without a destroy throws the next turn's draw away, which the
// evaluation (a fifth card counts for almost nothing) does not see. The turn
// starts by destroying a card it does not use, and ends with a free slot.
test('a full hand destroys a card rather than throw the next draw away',()=>{
    const options={publicRecipes:handDestroy.publicRecipes,maxTransitions:512,valueWeights:lv12Weights};
    const hand:string[]=handDestroy.observation.cardState.hands.white;
    expect(hand).toHaveLength(LV13_SEARCH_CONFIG.drawHandLimit);
    expect(handDestroy.observation.cardState.deckRemainingByPlayer.white).toBeGreaterThan(0);
    const result=searchLv13(handDestroy.observation,options);
    const turn=[result.action!,...result.continuation];
    expect(result.action?.type).toBe('destroy_hand_card');
    const destroyed=turn.filter((action:any)=>action.type==='destroy_hand_card').length;
    const used=turn.filter((action:any)=>action.type==='use_card').length;
    expect(hand.length-destroyed-used).toBeLessThan(LV13_SEARCH_CONFIG.drawHandLimit);
    expect(turn.some((action:any)=>action.type==='use_card'&&action.useCardId===result.action!.destroyCardId)).toBe(false);
    // Without the draw rules the same search keeps the full hand and places.
    expect(searchLv13(handDestroy.observation,{...options,tuning:noDrawRules}).action?.type).toBe('place');
},120000);

// Human-condition development game (turn 21, full hand): the best turns use a
// card. "Destroy Hard, then Gravity" was charged only the destroy margin (its
// first operation), less than the card margin Gravity alone paid, so a card was
// thrown away for nothing: the used card already frees the slot for the next draw.
test('a turn pays the card margin and the destroy margin for every operation, not only the first',()=>{
    const result=searchLv13(destroyBeforeCard.observation,{publicRecipes:destroyBeforeCard.publicRecipes,maxTransitions:6144});
    const operations=(candidate:any)=>[candidate.action,...candidate.continuation];
    expect(operations(result).some((action:any)=>action.type==='destroy_hand_card')).toBe(false);
    expect(result.action?.type).toBe('use_card');
    const deep=result.candidates!.filter(candidate=>candidate.retainedForDeepening);
    const destroyThenCard=deep.find(candidate=>candidate.action.type==='destroy_hand_card'
        &&candidate.continuation.some((action:any)=>action.type==='use_card'))!;
    expect(destroyThenCard).toBeDefined();
    // Every compared turn spends a card here, so only the destroy margin separates them.
    expect(deep.every(candidate=>operations(candidate).some((action:any)=>action.type==='use_card'))).toBe(true);
    const withoutDestroy=deep.find(candidate=>JSON.stringify(operations(candidate))===JSON.stringify(destroyThenCard.continuation));
    if(withoutDestroy)expect(destroyThenCard.score).toBeLessThan(withoutDestroy.score);
},120000);

test('Lv13 features extend the Lv12 extraction by the stable-stone features on sampled public worlds',()=>{
    const {extractLv12ValueFeatures}=require('../game/ai/cpu-lv12-evaluation');
    const {extractLv13ValueFeatures}=require('../game/ai/cpu-lv13-evaluation');
    const {createLv13ScenarioSampler}=require('../game/ai/cpu-lv13-scenarios');
    const Board=require('../shared/shared-board-utils');
    let compared=0;
    Board.withTopologyMemo(()=>{
        for(const fixture of [opening,cardChoice,handDestroy]){
            const sampler=createLv13ScenarioSampler(fixture.observation,[100901,100909,100913],fixture.publicRecipes);
            for(let scenario=0;scenario<3;scenario++){
                const state=sampler.sample(scenario);
                Board.markImmutableBoardSource(state.gameState);
                for(const player of ['black','white'] as const){
                    const lv12=extractLv12ValueFeatures(state,player);
                    const lv13=extractLv13ValueFeatures(state,player);
                    expect(lv13.length).toBe(lv12.length+2);
                    expect(lv13.slice(0,lv12.length)).toEqual(lv12);
                    // stableEnd is the stable-stone difference scaled by the endgame degree.
                    expect(Number.isFinite(lv13[lv12.length])).toBe(true);
                    expect(Math.abs(lv13[lv12.length+1])).toBeLessThanOrEqual(Math.abs(lv13[lv12.length])+1e-9);
                    // Black and white see the same count with opposite signs.
                    if(player==='white')expect(lv13[lv12.length]).toBe(-extractLv13ValueFeatures(state,'black')[lv12.length]);
                    compared++;
                }
            }
        }
    });
    expect(compared).toBe(18);
},120000);
