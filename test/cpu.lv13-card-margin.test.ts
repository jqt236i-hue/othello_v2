import {searchLv13,LV13_SEARCH_CONFIG} from '../game/ai/cpu-lv13-search';
import {searchLv12} from '../game/ai/cpu-lv12-search';
const opening=require('./fixtures/cpu-lv13-opening.json');
const cardChoice=require('./fixtures/cpu-lv13-card-choice.json');
const handDestroy=require('./fixtures/cpu-lv13-hand-destroy.json');
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
    deep(lv13).forEach((candidate,index)=>{
        const original=deep(lv12)[index];
        expect(candidate.action).toEqual(original.action);
        expect(candidate.score).toBeCloseTo(original.score-marginOf(candidate.action),10);
    });
},120000);

test('destroying a hand card must beat the best root that keeps it by the margin',()=>{
    const options={publicRecipes:handDestroy.publicRecipes,maxTransitions:512};
    const lv12=searchLv12(handDestroy.observation,options);
    const lv13=searchLv13(handDestroy.observation,{...options,valueWeights:lv12Weights});
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
