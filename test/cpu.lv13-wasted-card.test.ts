import {searchLv13} from '../game/ai/cpu-lv13-search';
const freeWill=require('./fixtures/cpu-lv13-wasted-free-will.json');
const cardChoice=require('./fixtures/cpu-lv13-card-choice.json');

const usesCard=(id:string)=>(candidate:any)=>[candidate.action,...candidate.continuation]
    .some((action:any)=>action.type==='use_card'&&action.useCardId===id);

// Self-play position: black spent Free Will (14 charge) before placing on
// (4,1), a placement that was legal without it. Under the 2,048-transition
// reading budget the deep comparison preferred the card by search noise.
test('a card turn that ends exactly like the same turn without the card is never chosen',()=>{
    const before=JSON.stringify(freeWill.observation);
    const result=searchLv13(freeWill.observation,{publicRecipes:freeWill.publicRecipes,maxTransitions:2048});
    const twin=result.candidates!.find(candidate=>usesCard('free_01')(candidate)
        &&JSON.stringify(candidate.continuation)===JSON.stringify([{type:'place',row:4,col:1}]));
    // The twin is still compared (its slot is not handed to another card plan).
    expect(twin?.retainedForDeepening).toBe(true);
    expect(result.action).toEqual({type:'place',row:4,col:1});
    expect(JSON.stringify(freeWill.observation)).toBe(before);
},120000);

// Charge is already at its cap of 99 after the placement, so the treasure box
// adds nothing. Even without the card-use margin it is not chosen.
test('a treasure box at the charge cap is not chosen even without the card-use margin',()=>{
    const result=searchLv13(cardChoice.observation,{publicRecipes:cardChoice.publicRecipes,maxTransitions:512,tuning:{cardUseMargin:0}});
    const deep=result.candidates!.filter(candidate=>candidate.retainedForDeepening);
    const chest=deep.find(usesCard('chest_01'))!, holding=deep.find(candidate=>
        JSON.stringify([candidate.action,...candidate.continuation])===JSON.stringify(chest.continuation))!;
    // The chest plan and its holding twin are compared as a pair; the twin wins regardless of the margin.
    expect(chest).toBeTruthy();
    expect(holding).toBeTruthy();
    expect(result.action).toEqual(holding.action);
},120000);
