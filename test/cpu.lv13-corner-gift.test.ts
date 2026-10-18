import {searchLv13,LV13_SEARCH_CONFIG} from '../game/ai/cpu-lv13-search';
import {lv10PlacementMoves,applyLv10Action,sampleLv10Position} from '../game/ai/cpu-lv10-position';
const Board=require('../shared/shared-board-utils');
const gift=require('./fixtures/cpu-lv13-corner-gift.json');
const early=require('./fixtures/cpu-lv13-corner-gift-early.json');

const noGiftRules={cornerGiftPenalty:0,cornerGiftMargin:0};
// Corners (of the shape after the turn) black can newly place on after white's
// single placement: corners black could already place on before the turn do not count.
function blackCorners(state:any):Set<string>{
    const context=Board.prepareBoardForSearch(Board.createBoardContext(state.gameState,state.cardState));
    const corners=new Set(Board.getCornerCells(context).map((cell:any)=>`${cell.row},${cell.col}`));
    return new Set(lv10PlacementMoves(state,'black').map((move:any)=>`${move.row},${move.col}`).filter(key=>corners.has(key)));
}
function blackCornersAfter(fixture:any,action:any):string[]{
    const state=sampleLv10Position(fixture.observation,100901,fixture.publicRecipes);
    const before=blackCorners(state);
    const after=applyLv10Action(state,action);
    if(!after.ok)throw new Error('placement rejected');
    return [...blackCorners(after.state)].filter(key=>!before.has(key));
}

// Human-condition development game (turn 43): white's best-valued placement
// (7,4) lets black place on the corner (7,5) next turn, while (7,5) itself and
// other placements give no corner. A human takes an offered corner every time,
// so a near-tie is settled in favour of the turn that gives none.
test('a placement that newly offers the opponent a corner must beat the others by the gift margin',()=>{
    expect(LV13_SEARCH_CONFIG.cornerGiftMargin).toBeGreaterThan(0);
    expect(LV13_SEARCH_CONFIG.cornerGiftPenalty).toBeGreaterThan(0);
    expect(blackCornersAfter(gift,{type:'place',row:7,col:4})).toEqual(['7,5']);
    expect(blackCornersAfter(gift,{type:'place',row:7,col:5})).toEqual([]);
    const options={publicRecipes:gift.publicRecipes,maxTransitions:2048};
    const before=JSON.stringify(gift.observation);
    const result=searchLv13(gift.observation,options);
    expect(result.action?.type).toBe('place');
    expect(blackCornersAfter(gift,result.action)).toEqual([]);
    const plain=searchLv13(gift.observation,{...options,tuning:noGiftRules});
    expect(plain.action).toEqual({type:'place',row:7,col:4});
    expect(JSON.stringify(gift.observation)).toBe(before);
},120000);

// Same series, turn 13: (1,7) opens the corner (2,7) of the current shape.
test('an early placement next to an open corner is replaced when an equal placement gives no corner',()=>{
    const options={publicRecipes:early.publicRecipes,maxTransitions:2048};
    expect(blackCornersAfter(early,{type:'place',row:1,col:7})).toEqual(['2,7']);
    const result=searchLv13(early.observation,options);
    expect(result.action?.type).toBe('place');
    expect(blackCornersAfter(early,result.action)).toEqual([]);
    expect(searchLv13(early.observation,{...options,tuning:noGiftRules}).action).toEqual({type:'place',row:1,col:7});
},120000);
