import {searchLv13,LV13_SEARCH_CONFIG} from '../game/ai/cpu-lv13-search';
const SharedConstants=require('../shared-constants');
const held=require('./fixtures/cpu-lv13-keep-relocation-held.json');
const corner=require('./fixtures/cpu-lv13-keep-relocation-corner.json');

const typeOf=(id:string)=>SharedConstants.CARD_DEFS.find((card:any)=>card.id===id)?.type;
const kept=new Set(LV13_SEARCH_CONFIG.cornerOnlyCardTypes);
const touchesKept=(result:any)=>[result.action,...result.continuation].some((action:any)=>
    (action.type==='use_card'&&kept.has(typeOf(action.useCardId)))
    ||(action.type==='destroy_hand_card'&&kept.has(typeOf(action.destroyCardId))));

test('relocation and board-expansion cards are the kept card types',()=>{
    expect([...kept].sort()).toEqual(['BOARD_EXPANSION_GOD','BOARD_EXPANSION_WILL','BUOYANCY_WILL','GRAVITY_WILL',
        'POSITION_SWAP_WILL','STRONG_WIND_WILL','SUPER_BUOYANCY_WILL','SUPER_GRAVITY_WILL','SWAP_WITH_ENEMY','TELEPORT_WILL']);
});

// Self-play position (turn 14): without the rule black swaps an enemy stone
// that brings no corner. The card is kept instead.
test('a relocation card that gains no corner is kept, neither used nor destroyed',()=>{
    const options={publicRecipes:held.publicRecipes,maxTransitions:512};
    const before=JSON.stringify(held.observation);
    const free=searchLv13(held.observation,{...options,tuning:{cornerOnlyCardTypes:[]}});
    expect(typeOf(free.action!.useCardId!)).toBe('SWAP_WITH_ENEMY');
    const result=searchLv13(held.observation,options);
    expect(touchesKept(result)).toBe(false);
    expect(JSON.stringify(held.observation)).toBe(before);
},120000);

// Self-play position (turn 19): white's stone on (4,0) floats up the empty
// left edge into the corner (0,0). A relocation card that takes a corner is used.
test('a relocation card that takes a corner is still used',()=>{
    const result=searchLv13(corner.observation,{publicRecipes:corner.publicRecipes,maxTransitions:512});
    expect(typeOf(result.action!.useCardId!)).toBe('BUOYANCY_WILL');
    expect(result.continuation[0]).toMatchObject({buoyancyTarget:{row:4,col:0}});
    expect(corner.observation.gameState.board[0][0]).toBe(0);
},120000);
