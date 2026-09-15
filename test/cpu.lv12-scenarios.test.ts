import {createLv12ScenarioSampler} from '../game/ai/cpu-lv12-scenarios';
import {createProductionPosition} from '../src/engine/production-match';
import {observeLv10Position} from '../game/ai/cpu-lv10-observation';
import DeckSpec = require('../shared/deck-spec');
import {applyLv10Action} from '../game/ai/cpu-lv10-position';

const seeds=[100901,100909,100913];

test('scenario diversity depends on the public position, never on actual hidden cards or match RNG',()=>{
    const actual=createProductionPosition(120041,{black:11,white:11});
    actual.cardState.hands.white=['perma_01','ghost_01','udr_01'];
    const before=observeLv10Position(actual,'black');
    const original=JSON.stringify(before),a=createLv12ScenarioSampler(before,seeds);
    actual.cardState.hands.white=['double_01','free_01','grass_will_01'];
    actual.cardState.decks.black.reverse();actual.cardState.decks.white.reverse();
    actual.prngState={notPublic:123};
    const after=observeLv10Position(actual,'black'),b=createLv12ScenarioSampler(after,seeds);
    expect(after).toEqual(before);
    expect(a.sampleSeeds).toEqual(b.sampleSeeds);
    const reordered={cardState:before.cardState,gameState:before.gameState,player:before.player,schema:before.schema};
    expect(createLv12ScenarioSampler(reordered,seeds).sampleSeeds).toEqual(a.sampleSeeds);
    for(let index=0;index<seeds.length;index++){
        expect(a.sample(index)).toEqual(b.sample(index));
        expect(a.sample(index).cardState.hands.black).toEqual(before.cardState.hands.black);
    }
    const later=JSON.parse(original);later.gameState.turnNumber++;
    expect(createLv12ScenarioSampler(later,seeds).sampleSeeds).not.toEqual(a.sampleSeeds);
    expect(JSON.stringify(before)).toBe(original);
});

test('adverse-hand scenarios preserve publicly revealed offers and use only public recipe cards',()=>{
    const actual=createProductionPosition(120042,{black:11,white:11});
    actual.cardState.hands.white=['perma_01','ghost_01','udr_01'];
    const observation=observeLv10Position(actual,'black');
    observation.cardState.pendingEffectByPlayer.black={type:'OBSERVER_WILL',stage:'selectTarget',offers:[{handIndex:0,cardId:'perma_01'}]};
    const recipes={black:DeckSpec.getEnabledCardIds(),white:DeckSpec.getEnabledCardIds()};
    const before=JSON.stringify(observation),sampler=createLv12ScenarioSampler(observation,seeds,recipes);
    for(let index=0;index<seeds.length;index++){
        const state=sampler.sample(index);
        expect(state.cardState.hands.white[0]).toBe('perma_01');
        expect(state.cardState.hands.white).toHaveLength(3);
        expect(state.cardState.decks.white).toHaveLength(observation.cardState.deckRemainingByPlayer.white);
        expect(state.cardState.hands.white.every((id:string)=>recipes.white.includes(id))).toBe(true);
    }
    expect(JSON.stringify(observation)).toBe(before);
});
test.each([
    ['double_01','triple_01'],['quad_01','infinite_01'],['triple_chain_01','quad_chain_01']
])('the adverse world considers a publicly used %s generating %s without changing the deck', (used,generated)=>{
    const actual=createProductionPosition(120802,{black:11,white:11});
    actual.cardState.hands.white=['perma_01','ghost_01','udr_01'];
    actual.cardState.lastUsedCardByPlayer.white=used;
    const observation=observeLv10Position(actual,'black'),before=JSON.stringify(observation);
    const recipes={black:DeckSpec.getAllCardsDeckCardIds(),white:DeckSpec.getAllCardsDeckCardIds()};
    const sampler=createLv12ScenarioSampler(observation,seeds,recipes);
    expect(sampler.sample(0).cardState.hands.white).not.toContain(generated);
    expect(sampler.sample(1).cardState.hands.white).not.toContain(generated);
    const adverse=sampler.sample(2);
    expect(adverse.cardState.hands.white).toContain(generated);
    expect(adverse.cardState.hands.white).toHaveLength(3);
    expect(adverse.cardState.decks.white).not.toContain(generated);
    expect(adverse.cardState.decks.white).toHaveLength(observation.cardState.deckRemainingByPlayer.white);
    expect(JSON.stringify(observation)).toBe(before);
    observation.cardState.hands.white=['perma_01','ghost_01','udr_01'];
    expect(createLv12ScenarioSampler(observation,seeds,recipes).sample(2).cardState.hands.white)
        .toEqual(observation.cardState.hands.white);
});


test.each(['black','white'] as const)('neutral own-hand destruction keeps %s opponent worlds and effect RNG stable',player=>{
    const actual=createProductionPosition(120901,{black:11,white:11});
    const opponent=player==='black'?'white':'black';
    actual.gameState.currentPlayer=player==='black'?1:-1;actual.gameState.turnNumber=20;
    actual.cardState.lastTurnStartedFor=player;
    actual.cardState.hands[player]=['silver_stone','hard_01','guard_01','double_01','ghost_01'];
    actual.cardState.hands[opponent]=['perma_01','regen_01','work_01','grass_will_01'];
    // These cards have left their respective decks. Keep the fixture inside
    // its initial deck cycle; a later refill legitimately reshuffles cards.
    for(const side of ['black','white'] as const){
        actual.cardState.decks[side]=actual.cardState.decks[side]
            .filter((id:string)=>!actual.cardState.hands[side].includes(id));
    }
    actual.cardState.deck=actual.cardState.decks.black.slice();
    const before=observeLv10Position(actual,player);
    const applied=applyLv10Action(actual,{type:'destroy_hand_card',destroyCardId:'silver_stone'});
    expect(applied.ok).toBe(true);
    const after=observeLv10Position(applied.state,player);
    expect(after.gameState).toEqual(before.gameState);
    expect(after.cardState.markers).toEqual(before.cardState.markers);
    expect(after.cardState.hands[opponent]).toEqual(before.cardState.hands[opponent]);
    expect(after.cardState.hands[player]).toHaveLength(4);
    const a=createLv12ScenarioSampler(before,seeds),b=createLv12ScenarioSampler(after,seeds);
    expect(a.sampleSeeds).toEqual(b.sampleSeeds);
    for(let index=0;index<seeds.length;index++){
        const first=a.sample(index),second=b.sample(index);
        expect(second.cardState.hands[opponent]).toEqual(first.cardState.hands[opponent]);
        expect(second.cardState.decks[opponent]).toEqual(first.cardState.decks[opponent]);
        expect(second.prngState).toEqual(first.prngState);
        expect(second.cardState.hands[player]).toEqual(after.cardState.hands[player]);
        const ownAfter=second.cardState.decks[player].filter((id:string)=>id!=='silver_stone');
        expect(ownAfter).toEqual(first.cardState.decks[player].slice(0,ownAfter.length));
    }
});

test('independent scenarios retain per-copy costs through canonical copy bookkeeping',()=>{
    const Cards=require('../game/logic/cards');
    const actual=createProductionPosition(120902,{black:11,white:11});
    const added=Cards.addCardToHand(actual.cardState,'black','hard_01');
    Cards.setCardCostOverrideForCopyId(actual.cardState,added.cardCopyId,0,'OBSERVER_WILL');
    Cards.addCardCostModifierForCopyId(actual.cardState,added.cardCopyId,5,'OBSERVER_WILL');
    const view=observeLv10Position(actual,'black'),index=view.cardState.hands.black.indexOf('hard_01');
    const sampler=createLv12ScenarioSampler(view,seeds);
    for(let scenario=0;scenario<seeds.length;scenario++){
        const state=sampler.sample(scenario),copy=Cards.getHandCopyIds(state.cardState,'black')[index];
        expect(Cards.getEffectiveCardCostForCopy(state.cardState,'hard_01',copy)).toBe(5);
    }
});

test.each(['black','white'] as const)('sparse %s positions cover distinct public-deck threats only in the adverse world',player=>{
    const actual=createProductionPosition(121001,{black:11,white:11});
    const opponent=player==='black'?'white':'black';
    actual.cardState.hands[opponent]=['perma_01','ghost_01','udr_01','guard_01','hard_01'];
    const view=observeLv10Position(actual,player),before=JSON.stringify(view);
    const recipes={black:DeckSpec.getAllCardsDeckCardIds(),white:DeckSpec.getAllCardsDeckCardIds()};
    const sampler=createLv12ScenarioSampler(view,seeds,recipes);
    const ordinary=createLv12ScenarioSampler(view,seeds.slice(0,2),recipes);
    for(let index=0;index<2;index++)expect(sampler.sample(index)).toEqual(ordinary.sample(index));
    const defs=DeckSpec.getEnabledCardDefMap();
    const adverse=sampler.sample(2),types=adverse.cardState.hands[opponent].map((id:string)=>defs.get(id)?.type);
    expect(types).toEqual(expect.arrayContaining(['DOUBLE_PLACE','ULTIMATE_DESTROY_GOD','SUPER_ATTRACTION_WILL']));
    expect(adverse.cardState.hands[opponent]).toHaveLength(5);
    expect(adverse.cardState.decks[opponent]).toHaveLength(view.cardState.deckRemainingByPlayer[opponent]);
    expect(adverse.cardState.hands[player]).toEqual(view.cardState.hands[player]);
    expect(JSON.stringify(view)).toBe(before);
    const allowed=['perma_01','ghost_01','guard_01','hard_01','regen_01'];
    const restricted=createLv12ScenarioSampler(view,seeds,{black:allowed,white:allowed}).sample(2);
    expect(restricted.cardState.hands[opponent].every((id:string)=>allowed.includes(id))).toBe(true);
});
