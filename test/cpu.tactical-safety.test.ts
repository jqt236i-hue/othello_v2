const Safety = require('../game/ai/cpu-tactical-safety');
const CardsSafety = require('../game/logic/cards');
const CoreSafety = require('../game/logic/core');
const PrngSafety = require('../game/schema/prng');
require('../game/logic/presentation').setPresentationRuntime({emitPresentationEvent:require('../game/logic/board_ops').emitPresentationEvent});
const placementBoard = [[0,-1,0,0,0,0,-1,-1],[0,0,-1,-1,-1,-1,-1,1],[1,1,1,-1,-1,-1,1,1],[1,1,0,-1,-1,1,0,1],[0,1,1,-1,-1,1,1,0],[0,0,1,1,-1,-1,1,0],[-1,-1,-1,1,1,1,1,1],[0,0,0,1,1,1,1,1]];
const cardBoard = [[1,1,1,1,1,1,1,0],[1,1,1,1,-1,-1,1,-1],[-1,1,1,1,-1,-1,1,-1],[-1,-1,-1,-1,1,1,1,-1],[-1,-1,-1,1,1,1,1,-1],[-1,-1,1,-1,-1,1,1,-1],[-1,-1,-1,-1,-1,1,-1,-1],[1,-1,-1,-1,-1,-1,-1,-1]];
const replyTrapBoard = [[1,1,1,1,1,1,0,-1],[1,1,1,-1,1,1,-1,-1],[0,1,1,-1,-1,-1,-1,-1],[1,1,1,1,-1,-1,-1,-1],[1,1,-1,-1,1,1,-1,-1],[1,1,-1,-1,1,-1,-1,-1],[1,1,1,1,1,1,-1,-1],[0,-1,1,1,1,1,1,-1]];
function setupSafety(board: number[][], flip = false) {
    const rng = PrngSafety.createPRNG(1), cs = CardsSafety.createCardState(rng), gs = CoreSafety.createGameState();
    gs.board = board.map(row => row.map(v => flip ? -v : v)); gs.currentPlayer = flip ? 1 : -1;
    gs.turnNumber = board === cardBoard ? 59 : 43;
    const playerKey = flip ? 'black' : 'white';
    cs.hands = {black:[],white:[]};cs.charge[playerKey]=99;cs.lastTurnStartedFor=playerKey;
    return {gameState:gs,cardState:cs,playerKey,level:6,rng};
}

test('stability counts anchored edge chains, stops at gaps, and distinguishes early/late boards',()=>{
    const board=Array.from({length:8},()=>Array(8).fill(0));
    board[0]=[-1,-1,-1,0,-1,0,0,0];board[3][3]=-1;
    const s=setupSafety(board);
    expect(Safety.tacticalPositionFeatures(s.gameState,s.cardState,'white')).toMatchObject({stable:3,own:5,late:false,danger:0});
    s.gameState.board[0][3]=-1;
    expect(Safety.tacticalPositionFeatures(s.gameState,s.cardState,'white').stable).toBe(5);
    s.cardState.markers=[{kind:'specialStone',row:3,col:3,owner:'white',data:{type:'PERMA_PROTECTED',sourceCardId:'perma_01'}}];
    expect(Safety.tacticalPositionFeatures(s.gameState,s.cardState,'white').stable).toBe(6);
    expect(Safety.tacticalPositionFeatures(setupSafety(cardBoard).gameState,s.cardState,'white').late).toBe(true);
});

test('few exposed stones are risky but three protected stones are not treated as immediate destruction targets',()=>{
    const board=Array.from({length:8},()=>Array(8).fill(0));board[3][3]=-1;board[3][4]=-1;board[4][3]=-1;
    const s=setupSafety(board);
    expect(Safety.tacticalPositionFeatures(s.gameState,s.cardState,'white').danger).toBe(1);
    s.cardState.markers=[[3,3],[3,4],[4,3]].map(([row,col])=>({kind:'specialStone',row,col,owner:'white',data:{type:'GUARD',remainingOwnerTurns:2,sourceCardId:'guard_01'}}));
    expect(Safety.tacticalPositionFeatures(s.gameState,s.cardState,'white').danger).toBe(0);
    s.cardState.markers=[];s.gameState.board[4][3]=0;
    expect(Safety.tacticalPositionFeatures(s.gameState,s.cardState,'white').danger).toBe(2);
});

test('stability follows an expanded board boundary',()=>{
    const board=Array.from({length:8},()=>Array(8).fill(0));board[0][7]=-1;
    const s=setupSafety(board);
    expect(Safety.tacticalPositionFeatures(s.gameState,s.cardState,'white').stable).toBe(1);
    s.gameState.boardExpansion.cells=[{side:'right',row:0,col:8,owner:1}];
    expect(Safety.tacticalPositionFeatures(s.gameState,s.cardState,'white').stable).toBe(0);
});

test.each([false,true])('midgame gives up one transient stone to retain three more stable stones (flip=%s)',flip=>{
    const s=setupSafety([[0,1,1,1,0,1,0,0],[0,-1,-1,-1,1,1,1,0],[-1,-1,-1,-1,0,1,1,0],[-1,-1,-1,-1,1,-1,1,-1],[-1,-1,1,1,-1,-1,1,0],[1,-1,1,-1,-1,-1,1,0],[1,-1,-1,-1,1,-1,-1,0],[1,-1,0,-1,1,-1,-1,-1]],flip),sign=s.gameState.currentPlayer;
    // The recorded position is black to move; setupSafety defaults to white.
    s.gameState.board=s.gameState.board.map((row:number[])=>row.map(v=>-v));
    const candidates=CoreSafety.getLegalMoves(s.gameState,sign),selected=candidates.find((m:any)=>m.row===1&&m.col===0);
    const result=Safety.avoidTacticalBlunder({...s,selected,candidates});
    expect(result.changed).toBe(true);expect(result.selected).toMatchObject({row:7,col:2});
    const before=CoreSafety.applyMove(s.gameState,selected),after=CoreSafety.applyMove(s.gameState,result.selected);
    const original=Safety.tacticalPositionFeatures(before,s.cardState,s.playerKey),alternative=Safety.tacticalPositionFeatures(after,s.cardState,s.playerKey);
    expect(original).toMatchObject({late:false,own:30,stable:7});
    expect(alternative).toMatchObject({late:false,own:29,stable:10});
});
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

test.each([false,true])('rejects a corner-saving replacement that loses ten more discs after the reply (flip=%s)',flip=>{
    const s=setupSafety(replyTrapBoard,flip), sign=s.gameState.currentPlayer;
    const candidates=CoreSafety.getLegalMoves(s.gameState,sign);
    const selected=candidates.find((m:any)=>m.row===0&&m.col===6);
    const tempting=candidates.find((m:any)=>m.row===7&&m.col===0);
    const worst=(move:any)=>{
        const after=CoreSafety.applyMove(s.gameState,move);
        return Math.min(...CoreSafety.getLegalMoves(after,-sign).map((reply:any)=>{
            const end=CoreSafety.applyMove(after,reply),count=CoreSafety.countDiscs(end);
            return sign*(count.black-count.white);
        }));
    };
    expect(worst(selected)).toBe(-9);expect(worst(tempting)).toBe(-19);
    const result=Safety.avoidTacticalBlunder({...s,selected,candidates});
    expect(result.changed).toBe(false);expect(result.selected).toEqual(selected);
    expect(result.reason).toBe('no_dominating_alternative');
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
