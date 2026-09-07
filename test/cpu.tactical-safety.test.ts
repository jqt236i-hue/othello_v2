const Safety = require('../game/ai/cpu-tactical-safety');
const CardsSafety = require('../game/logic/cards');
const CoreSafety = require('../game/logic/core');
const PrngSafety = require('../game/schema/prng');
require('../game/logic/presentation').setPresentationRuntime({emitPresentationEvent:require('../game/logic/board_ops').emitPresentationEvent});
const placementBoard = [[0,-1,0,0,0,0,-1,-1],[0,0,-1,-1,-1,-1,-1,1],[1,1,1,-1,-1,-1,1,1],[1,1,0,-1,-1,1,0,1],[0,1,1,-1,-1,1,1,0],[0,0,1,1,-1,-1,1,0],[-1,-1,-1,1,1,1,1,1],[0,0,0,1,1,1,1,1]];
const cardBoard = [[1,1,1,1,1,1,1,0],[1,1,1,1,-1,-1,1,-1],[-1,1,1,1,-1,-1,1,-1],[-1,-1,-1,-1,1,1,1,-1],[-1,-1,-1,1,1,1,1,-1],[-1,-1,1,-1,-1,1,1,-1],[-1,-1,-1,-1,-1,1,-1,-1],[1,-1,-1,-1,-1,-1,-1,-1]];
function setupSafety(board: number[][], flip = false) {
    const rng = PrngSafety.createPRNG(1), cs = CardsSafety.createCardState(rng), gs = CoreSafety.createGameState();
    gs.board = board.map(row => row.map(v => flip ? -v : v)); gs.currentPlayer = flip ? 1 : -1;
    gs.turnNumber = board === cardBoard ? 59 : 43;
    const playerKey = flip ? 'black' : 'white';
    cs.hands = {black:[],white:[]};cs.charge[playerKey]=99;cs.lastTurnStartedFor=playerKey;
    return {gameState:gs,cardState:cs,playerKey,level:6,rng};
}
test.each([false,true])('avoids a witnessed corner giveaway without mutating state or RNG (flip=%s)',flip=>{
    const s=setupSafety(placementBoard,flip), candidates=CoreSafety.getLegalMoves(s.gameState,s.gameState.currentPlayer);
    const selected=candidates.find((m:any)=>m.row===1&&m.col===1),before=JSON.stringify(s);
    const r=Safety.avoidTacticalBlunder({...s,selected,candidates});
    expect(r.changed).toBe(true);expect(r.witness).toEqual({row:0,col:0});expect(r.steps).toBeLessThanOrEqual(Safety.MAX_SAFETY_STEPS);
    expect(JSON.stringify(s)).toBe(before);
    expect(Safety.avoidTacticalBlunder({...s,selected:r.selected,candidates}).changed).toBe(false);
    expect(Safety.avoidTacticalBlunder({...s,selected,candidates:[selected]}).changed).toBe(false);
    expect(Safety.avoidTacticalBlunder({...s,selected,candidates,level:5}).changed).toBe(false);
    const hidden=s.playerKey==='white'?'black':'white';
    s.cardState.hands[hidden]=['destroy_01','tempt_01'];s.cardState.decks[hidden].reverse();
    expect(Safety.avoidTacticalBlunder({...s,selected,candidates}).selected).toEqual(r.selected);
});
test.each([false,true])('holds Gold when every resulting placement exposes a corner (flip=%s)',flip=>{
    const s=setupSafety(cardBoard,flip);s.cardState.hands[s.playerKey]=['gold_stone'];
    const before=JSON.stringify(s);
    const r=Safety.shouldHoldTacticallyUnsafeCard({...s,cardId:'gold_stone'});
    expect(r.hold).toBe(true);expect(r.steps).toBeLessThanOrEqual(Safety.MAX_SAFETY_STEPS);expect(JSON.stringify(s)).toBe(before);
    expect(Safety.shouldHoldTacticallyUnsafeCard({...s,cardId:'gold_stone',forceUseCard:true}).hold).toBe(false);
    expect(Safety.shouldHoldTacticallyUnsafeCard({...s,cardId:'gold_stone',level:5}).hold).toBe(false);
    s.cardState.charge[s.playerKey]=10;
    CardsSafety.ensureCardCopyState(s.cardState);
    s.cardState.cardCostOverridesByCopyId[s.cardState._handCopyIdsByPlayer[s.playerKey][0]]={cost:0};
    expect(Safety.shouldHoldTacticallyUnsafeCard({...s,cardId:'gold_stone'}).hold).toBe(false);
});
test('unknown/random card and excessive branches do not justify holding',()=>{
    const s=setupSafety(placementBoard);s.cardState.hands.white=['chest_01'];
    expect(Safety.shouldHoldTacticallyUnsafeCard({...s,cardId:'chest_01'}).hold).toBe(false);
    s.cardState.hands.white=['destroy_01'];
    expect(Safety.shouldHoldTacticallyUnsafeCard({...s,cardId:'destroy_01'}).hold).toBe(false);
});

test.each([false,true])('does not destroy its own corner when another target and all its placements are safe (flip=%s)',flip=>{
    const s=setupSafety(cardBoard,flip), PipelineSafety=require('../game/turn/turn_pipeline');
    s.cardState.hands[s.playerKey]=['destroy_01'];
    const used=PipelineSafety.applyTurnSafe(s.cardState,s.gameState,s.playerKey,{type:'use_card',useCardId:'destroy_01'},s.rng,{skipTurnStart:true});
    expect(used.ok).toBe(true);
    const candidates=CardsSafety.getDestroyTargets(used.cardState,used.gameState),selected={row:7,col:7};
    const input={...s,gameState:used.gameState,cardState:used.cardState,selected,candidates,pendingType:'DESTROY_ONE_STONE'};
    const before=JSON.stringify(input),r=Safety.avoidTacticalBlunder(input);
    expect(r.changed).toBe(true);expect(r.selected).toMatchObject({row:0,col:0});expect(r.witness).toEqual({row:7,col:7});
    expect(JSON.stringify(input)).toBe(before);
    const target=PipelineSafety.applyTurnSafe(used.cardState,used.gameState,s.playerKey,{type:'place',destroyTarget:r.selected},s.rng,{skipTurnStart:true});
    expect(target.ok).toBe(true);expect(target.cardState.pendingEffectByPlayer[s.playerKey]).toBeNull();
    const moves=CoreSafety.getLegalMoves(target.gameState,s.gameState.currentPlayer,{...CardsSafety.getCardContext(target.cardState),cardState:target.cardState});
    expect(moves.length).toBeGreaterThan(0);
    for(const move of moves){
        const placed=PipelineSafety.applyTurnSafe(target.cardState,target.gameState,s.playerKey,{type:'place',row:move.row,col:move.col},s.rng,{skipTurnStart:true});
        expect(placed.ok).toBe(true);
        const replies=CoreSafety.getLegalMoves(placed.gameState,-s.gameState.currentPlayer,{...CardsSafety.getCardContext(placed.cardState),cardState:placed.cardState});
        expect(replies.some((m:any)=>m.row===7&&m.col===7)).toBe(false);
    }
});
