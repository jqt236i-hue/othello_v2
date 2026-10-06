import {searchLv13,LV13_SEARCH_CONFIG} from '../game/ai/cpu-lv13-search';
import {searchLv12} from '../game/ai/cpu-lv12-search';
const opening=require('./fixtures/cpu-lv13-opening.json');
const cardChoice=require('./fixtures/cpu-lv13-card-choice.json');
const handDestroy=require('./fixtures/cpu-lv13-hand-destroy.json');
const marginOf=(action:any)=>action.type==='use_card'?LV13_SEARCH_CONFIG.cardUseMargin:action.type==='destroy_hand_card'?LV13_SEARCH_CONFIG.destroyHandMargin:0;

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
        expect(candidate.score).toBeCloseTo(original.score-marginOf(candidate.action),10);
    });
},120000);

test('destroying a hand card must beat the best root that keeps it by the margin',()=>{
    const options={publicRecipes:handDestroy.publicRecipes,maxTransitions:512};
    const lv12=searchLv12(handDestroy.observation,options);
    const lv13=searchLv13(handDestroy.observation,options);
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

test('Lv13 features equal the Lv12 extraction on sampled public worlds',()=>{
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
                    expect(extractLv13ValueFeatures(state,player)).toEqual(extractLv12ValueFeatures(state,player));
                    compared++;
                }
            }
        }
    });
    expect(compared).toBe(18);
},120000);
