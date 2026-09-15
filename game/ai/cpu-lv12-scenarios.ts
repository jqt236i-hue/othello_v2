import DeckSpec = require('../../shared/deck-spec');
import Progression = require('../logic/cards-internal/progression');
import StateHash = require('../../shared/state-hash');
import Core = require('../logic/core');
const Prng:any = require('../schema/prng');
import { cloneLv10, LV10_POSITION_LIMITS, type Lv10Observation, type Lv10Player, type Lv10Position } from './cpu-lv10-position';
const Cards:any = require('../logic/cards');
import { lv12CardPotential, lv12CardDefinition } from './cpu-lv12-evaluation';

/** Purely public inputs seed isolated hypothetical
 * worlds. Two uniform worlds and one adverse-hand world are a risk estimate,
 * not a claim that an unseen opponent actually holds those cards. */
export function createLv12ScenarioSampler(observation:Lv10Observation,
    seeds:readonly number[],publicRecipes?:Partial<Record<Lv10Player,readonly string[]>>){
    const opponent=observation.player==='black'?'white':'black';
    const knownOpponentHand=[...(observation.cardState.hands?.[opponent]||[])];
    const publicSelection=observation.cardState.pendingEffectByPlayer?.[observation.player];
    if(publicSelection&&['CONDEMN_WILL','OBSERVER_WILL'].includes(publicSelection.type)){
        for(const offer of publicSelection.offers||[]){
            if(Number.isInteger(offer.handIndex)&&offer.handIndex>=0&&offer.handIndex<knownOpponentHand.length
                &&typeof offer.cardId==='string')knownOpponentHand[offer.handIndex]=offer.cardId;
        }
    }
    // Neutral own-hand bookkeeping supplies no new information about an
    // opponent. Do not reroll every hypothetical hand when cycling a card.
    // Board/turn and genuinely observed opponent information still condition
    // the worlds. Every field here comes from the public observation.
    const signal={player:observation.player,gameState:observation.gameState,
        markers:observation.cardState.markers,knownOpponentHand,
        opponentDeckRemaining:observation.cardState.deckRemainingByPlayer?.[opponent],
        opponentLastUsed:observation.cardState.lastUsedCardByPlayer?.[opponent],
        opponentVisibleCosts:observation.cardState.handCostAdjustmentsByPlayer?.[opponent],publicRecipes};
    let publicHash=2166136261;
    for(const char of StateHash.stableStringify(signal))publicHash=Math.imul(publicHash^char.charCodeAt(0),16777619);
    const sampleSeeds=seeds.map(seed=>(Math.imul(publicHash^seed,0x45d9f3b)>>>0));
    const cards=DeckSpec.getEnabledCardDefMap();
    const recentType=lv12CardDefinition(observation.cardState.lastUsedCardByPlayer?.[opponent])?.type;
    const generatedAfterRecentUse=(Progression.getThrowChainConfig(recentType)
        ||Progression.getChainWillConfig(recentType))?.nextCardId as string|undefined;
    const revealed=new Map<number,string>();
    const selection=observation.cardState.pendingEffectByPlayer?.[observation.player];
    if(selection&&['CONDEMN_WILL','OBSERVER_WILL'].includes(selection.type)){
        for(const offer of selection.offers||[]){
            if(Number.isInteger(offer.handIndex)&&typeof offer.cardId==='string')revealed.set(offer.handIndex,offer.cardId);
        }
    }
    const weight=(id:string)=>{
        const type=cards.get(id)?.type;
        const tactical:Record<string,number>={LAST_RESORT:30,INFINITE_PLACE:35,TRIPLE_PLACE:25,
            QUAD_PLACE:30,CAPTURE_WILL:24,TEMPT_WILL:26,SUPER_ATTRACTION_WILL:22,FREE_PLACEMENT:18};
        const power=tactical[type||'']??lv12CardPotential(id);
        return Math.min(16,(1+Math.max(0,power)/8)**2);
    };
    return {sampleSeeds,sample(index:number){
        if(index<0||index>=seeds.length)throw new Error('Unknown public scenario');
        if(index!==seeds.length-1||seeds.length<3)return sampleIndependentPosition(observation,sampleSeeds[index],publicRecipes);
        const view:Lv10Observation=JSON.parse(JSON.stringify(observation));
        const hand:string[]=view.cardState.hands[opponent];
        const pool=[...(publicRecipes?.[opponent]||DeckSpec.getEnabledCardIds())];
        for(let i=0;i<hand.length;i++){
            if(revealed.has(i))hand[i]=revealed.get(i)!;
            if(!String(hand[i]).startsWith('__hidden_hand__:')){
                const at=pool.indexOf(hand[i]);if(at>=0)pool.splice(at,1);
            }
        }
        // The last publicly used progression card can have created a stronger
        // card. Include that possibility in the adverse world only. Two normal
        // worlds leave ownership/disposal uncertain; known slots always win.
        // This is a hand hypothesis, never an addition to a real or sampled deck.
        if(generatedAfterRecentUse&&!hand.includes(generatedAfterRecentUse)){
            const unknown=hand.findIndex(id=>String(id).startsWith('__hidden_hand__:'));
            if(unknown>=0)hand[unknown]=generatedAfterRecentUse;
        }
        // Sparse positions can be lost to one multi-placement, destruction or
        // relocation attack. A weighted random hand frequently contains none
        // of them. Cover these distinct threats in the adverse world while the
        // other two worlds retain their ordinary public prior. This is a stress
        // scenario, not a posterior assertion about the opponent's real hand.
        if(Core.countDiscs(view.gameState,view.cardState)[observation.player]<=10){
            for(const type of ['DOUBLE_PLACE','ULTIMATE_DESTROY_GOD','SUPER_ATTRACTION_WILL']){
                const id=pool.find(id=>cards.get(id)?.type===type);
                const unknown=hand.findIndex(id=>String(id).startsWith('__hidden_hand__:'));
                if(unknown<0)break;
                if(!id||hand.includes(id))continue;
                hand[unknown]=id;
                pool.splice(pool.indexOf(id),1);
            }
        }
        const rng=Prng.createPRNG((sampleSeeds[index]^0x6a09e667)>>>0);
        for(let i=0;i<hand.length;i++){
            if(!String(hand[i]).startsWith('__hidden_hand__:'))continue;
            if(!pool.length)pool.push(...(publicRecipes?.[opponent]||DeckSpec.getEnabledCardIds()));
            const weights=pool.map(weight),total=weights.reduce((a,b)=>a+b,0);
            let threshold=rng.random()*total,at=weights.length-1;
            for(let j=0;j<weights.length;j++){threshold-=weights[j];if(threshold<=0){at=j;break;}}
            hand[i]=pool.splice(at,1)[0];
        }
        return sampleIndependentPosition(view,sampleSeeds[index],publicRecipes);
    }};
}

/** Public prior construction only; game rules still run through the existing
 * counted canonical apply/start functions. Independent seat streams prevent
 * a known-card removal on black from rerolling white's unknown hand/deck.
 * Hypothetical effect randomness has its own stream and never uses live RNG. */
function sampleIndependentPosition(observation:Lv10Observation,seed:number,
    publicRecipes?:Partial<Record<Lv10Player,readonly string[]>>):Lv10Position{
    if(observation.schema!=='cpu_lv10_observation.v1')throw new Error('Invalid Lv12 observation schema');
    if(!Number.isInteger(seed))throw new Error('Lv12 scenario requires an integer seed');
    const state:Lv10Position=cloneLv10({gameState:observation.gameState,cardState:observation.cardState});
    const cs=state.cardState;cs.decks={};
    for(const side of ['black','white'] as const){
        const pool=[...(publicRecipes?.[side]||DeckSpec.getEnabledCardIds())];
        if(!pool.length||pool.length>LV10_POSITION_LIMITS.maxDeck||pool.some(id=>!Cards.getCardDef(id)))
            throw new Error('Invalid public deck prior');
        const hand:string[]=cs.hands?.[side]?.slice();
        const count=cs.deckRemainingByPlayer?.[side]??0;
        if(!Array.isArray(hand)||hand.length>LV10_POSITION_LIMITS.maxHand
            ||!Number.isInteger(count)||count<0||count>LV10_POSITION_LIMITS.maxDeck)
            throw new Error('Lv12 hand/deck exceeds budget');
        const selecting=side==='black'?'white':'black',selection=cs.pendingEffectByPlayer?.[selecting];
        if(selection&&['CONDEMN_WILL','OBSERVER_WILL'].includes(selection.type)){
            for(const offer of selection.offers||[]){
                if(Number.isInteger(offer.handIndex)&&offer.handIndex>=0&&offer.handIndex<hand.length
                    &&typeof offer.cardId==='string'&&Cards.getCardDef(offer.cardId))hand[offer.handIndex]=offer.cardId;
            }
        }
        const rng=Prng.createPRNG((seed^(side==='black'?0x243f6a88:0x85a308d3))>>>0);
        const remaining=pool.slice();
        rng.shuffle(remaining);
        // Condition one prior ordering on visible cards. Removing a known
        // card must not reshuffle every other hypothetical future draw.
        for(const id of hand){const at=remaining.indexOf(id);if(at>=0)remaining.splice(at,1);}
        const draw=():string=>{
            if(!remaining.length){remaining.push(...pool);rng.shuffle(remaining);}
            return remaining.pop()!;
        };
        cs.hands[side]=hand.map(id=>String(id).startsWith('__hidden_hand__:')?draw():id);
        cs.decks[side]=Array.from({length:count},draw);
    }
    cs.deck=cs.decks.black.slice();
    // Canonical copy/cost bookkeeping, matching the public observation's slots.
    Cards.ensureCardCopyState(cs);
    for(const side of ['black','white'] as const){
        (cs.handCostAdjustmentsByPlayer?.[side]||[]).forEach((adjustment:any,index:number)=>{
            if(!adjustment)return;
            const copyId=cs._handCopyIdsByPlayer[side][index];
            if(Number.isFinite(adjustment.overrideCost))cs.cardCostOverridesByCopyId[copyId]={cost:adjustment.overrideCost};
            if(Number.isFinite(adjustment.delta))cs.cardCostModifiersByCopyId[copyId]=[{delta:adjustment.delta}];
        });
    }
    state.prngState=Prng.createPRNG((seed^0x13198a2e)>>>0).getState();
    return state;
}
